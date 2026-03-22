import nodemailer from 'nodemailer';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import { getPool } from './db.js';

let mailTransporter;

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return mailTransporter;
}

async function writeNotificationLog({
  bookingId,
  experimenterId,
  channel,
  target,
  status,
  message,
  errorMessage
}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO booking_notifications
      (booking_id, experimenter_id, channel, target, status, message, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      experimenterId ?? null,
      channel,
      target ?? null,
      status,
      message,
      errorMessage ?? null
    ]
  );
}

function buildNotificationText(booking) {
  return [
    '【单细胞预约通知】',
    `合同编号：${booking.contractNo}`,
    `客户：${booking.customerUnit} ${booking.customerName}`,
    `服务时间：${booking.visitTime} ~ ${booking.serviceEndTime}`,
    `样本信息：${booking.sampleInfo}（${booking.sampleCount}份）`,
    `测序类型：${booking.seqType}`,
    `平台：${booking.platform}`,
    `销售：${booking.salesName}`
  ].join('\n');
}

async function sendEmail({ to, subject, text }) {
  const transporter = getMailTransporter();
  if (!transporter) {
    throw new Error('SMTP 未配置，请设置 SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS');
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text
  });
}

async function sendSms({ phone, text }) {
  if (!phone) throw new Error('未配置手机号');
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';
  const region = process.env.ALIYUN_SMS_REGION || 'cn-hangzhou';
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error(
      '阿里云短信未配置，请设置 ALIYUN_SMS_ACCESS_KEY_ID/ALIYUN_SMS_ACCESS_KEY_SECRET/ALIYUN_SMS_SIGN_NAME/ALIYUN_SMS_TEMPLATE_CODE'
    );
  }

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret
  });
  config.endpoint = `dysmsapi.${region}.aliyuncs.com`;
  const client = new Dysmsapi20170525(config);
  const req = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    // 模板中可使用 ${content} 变量承载预约通知正文
    templateParam: JSON.stringify({ content: text })
  });
  const resp = await client.sendSms(req);
  const code = String(resp?.body?.code || '');
  if (code !== 'OK') {
    throw new Error(`阿里云短信发送失败: ${code || 'UNKNOWN'} ${resp?.body?.message || ''}`.trim());
  }
}

async function sendTeams({ webhook, text }) {
  if (!webhook) throw new Error('未配置 Teams webhook');
  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!resp.ok) {
    throw new Error(`Teams webhook 请求失败: ${resp.status}`);
  }
}

export async function notifyExperimenterForBooking({ booking, experimenter }) {
  const methods = Array.isArray(booking.notifyMethods) ? booking.notifyMethods : [];
  if (!experimenter || !experimenter.id || !methods.length) {
    return { sent: [], failed: [], skipped: [] };
  }

  const text = buildNotificationText(booking);
  const summary = { sent: [], failed: [], skipped: [] };
  const teamsWebhook = process.env.TEAMS_WEBHOOK_URL || '';

  for (const method of methods) {
    const channel = method === '电话' ? '手机号码' : method;
    try {
      if (channel === '邮件') {
        if (!experimenter.email) throw new Error('实验员未配置邮箱');
        await sendEmail({
          to: experimenter.email,
          subject: `预约通知 - ${booking.contractNo}`,
          text
        });
        await writeNotificationLog({
          bookingId: booking.id,
          experimenterId: experimenter.id,
          channel,
          target: experimenter.email,
          status: 'sent',
          message: text
        });
        summary.sent.push(channel);
        continue;
      }

      if (channel === '手机号码') {
        await sendSms({ phone: experimenter.phone, text });
        await writeNotificationLog({
          bookingId: booking.id,
          experimenterId: experimenter.id,
          channel,
          target: experimenter.phone,
          status: 'sent',
          message: text
        });
        summary.sent.push(channel);
        continue;
      }

      if (channel === 'Teams') {
        await sendTeams({ webhook: teamsWebhook, text });
        await writeNotificationLog({
          bookingId: booking.id,
          experimenterId: experimenter.id,
          channel,
          target: experimenter.teamsId || teamsWebhook,
          status: 'sent',
          message: text
        });
        summary.sent.push(channel);
        continue;
      }

      if (channel === '微信' || channel === '其他') {
        await writeNotificationLog({
          bookingId: booking.id,
          experimenterId: experimenter.id,
          channel,
          target: channel === '微信' ? experimenter.wechatId : experimenter.otherContact,
          status: 'skipped',
          message: text,
          errorMessage: `${channel} 渠道待接入`
        });
        summary.skipped.push(channel);
        continue;
      }

      await writeNotificationLog({
        bookingId: booking.id,
        experimenterId: experimenter.id,
        channel,
        target: null,
        status: 'skipped',
        message: text,
        errorMessage: '未知通知方式'
      });
      summary.skipped.push(channel);
    } catch (err) {
      const errorMessage = String(err?.message || err);
      await writeNotificationLog({
        bookingId: booking.id,
        experimenterId: experimenter.id,
        channel,
        target: null,
        status: 'failed',
        message: text,
        errorMessage
      });
      summary.failed.push({ channel, error: errorMessage });
    }
  }

  return summary;
}
