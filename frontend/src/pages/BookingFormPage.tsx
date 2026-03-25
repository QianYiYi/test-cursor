import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Calendar, Card, Modal, Space, Table, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { BookingForm } from '../components/BookingForm';
import { api } from '../api';
import type { BookingPayload, BookingRow, CalendarDayResult, CalendarSummary } from '../api';
import { STATUS_OPTIONS } from '../constants';
import { can } from '../auth';
import { getHttpError } from '../lib/http-error';
import { useReferenceOptions } from '../hooks/use-reference-options';

function conflictMessage(errorData: ReturnType<typeof getHttpError>['data']) {
  const conflicts = Array.isArray(errorData?.conflicts) ? errorData.conflicts : [];
  if (!conflicts.length) {
    return '排班冲突：该实验员该时间段已被占用';
  }
  const first = conflicts[0];
  return `排班冲突：${first.customerUnit || ''}${first.customerName ? ` ${first.customerName}` : ''}（${first.visitTime} ~ ${first.serviceEndTime}）`;
}

function statusLabel(v: string) {
  return STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color
      }}
    />
  );
}

/** 与后端 calendar/summary 一致：按当日样本合计 busyLevel */
function busyLevelDotColor(code) {
  if (code === 'busy') return '#faad14';
  if (code === 'full') return '#ff4d4f';
  return '#52c41a';
}

export function BookingFormPage() {
  const queryClient = useQueryClient();
  const createBookingMut = useMutation({
    mutationFn: (body: BookingPayload) => api.createBooking(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  });
  const canCreate = can('booking:create');
  const [submitting, setSubmitting] = useState(false);
  const { experimenters, pmOwners, seqTypeOptions } = useReferenceOptions();
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayResult | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.getCalendarSummary();
      setSummary(r);
    } catch (e) {
      message.error(e?.message || '加载日历汇总失败');
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (ymd: string) => {
    if (!ymd) return;
    setDayLoading(true);
    try {
      const r = await api.getCalendarDay(ymd);
      setDayDetail(r);
    } catch (e) {
      message.error(e?.message || '加载当日订单失败');
      setDayDetail(null);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const dayMap = useMemo(() => {
    const m = new Map<string, NonNullable<CalendarSummary['days']>[number]>();
    for (const d of summary?.days || []) {
      m.set(d.day, d);
    }
    return m;
  }, [summary]);

  const rangeTotals = useMemo(() => {
    const days = summary?.days || [];
    const today = dayjs().format('YYYY-MM-DD');
    const ws = dayjs().startOf('week');
    const we = dayjs().endOf('week');
    const ms = dayjs().startOf('month');
    const me = dayjs().endOf('month');
    let todayOrders = 0;
    let todaySamples = 0;
    let weekOrders = 0;
    let weekSamples = 0;
    let monthOrders = 0;
    let monthSamples = 0;
    for (const row of days) {
      const dj = dayjs(row.day);
      const o = Number(row.orderCount || 0);
      const s = Number(row.sampleSum || 0);
      if (row.day === today) {
        todayOrders += o;
        todaySamples += s;
      }
      if ((dj.isAfter(ws) || dj.isSame(ws, 'day')) && (dj.isBefore(we) || dj.isSame(we, 'day'))) {
        weekOrders += o;
        weekSamples += s;
      }
      if ((dj.isAfter(ms) || dj.isSame(ms, 'day')) && (dj.isBefore(me) || dj.isSame(me, 'day'))) {
        monthOrders += o;
        monthSamples += s;
      }
    }
    return { todayOrders, todaySamples, weekOrders, weekSamples, monthOrders, monthSamples };
  }, [summary]);

  const cellRender = useCallback(
    (value: dayjs.Dayjs) => {
      const key = value.format('YYYY-MM-DD');
      const info = dayMap.get(key);
      const resolved = info || {
        orderCount: 0,
        sampleSum: 0,
        remainingExperimenters: Number(summary?.activeExperimenters || 0),
        busyLevel: 'idle'
      };
      const dotColor = busyLevelDotColor(resolved.busyLevel);
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.35 }}>
          <span style={{ flexShrink: 0, marginTop: 3 }}>
            <ColorDot color={dotColor} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div>{resolved.orderCount} 单</div>
            <div style={{ marginTop: 2 }}>
              样本 {resolved.sampleSum} · 剩余实验员 {resolved.remainingExperimenters}
            </div>
          </div>
        </div>
      );
    },
    [dayMap, summary]
  );

  const onSelectDate = (d: dayjs.Dayjs, info: { source?: string }) => {
    if (info?.source && info.source !== 'date') return;
    const ymd = d.format('YYYY-MM-DD');
    setDayModalDate(ymd);
    setDayModalOpen(true);
    loadDay(ymd);
  };

  /** 与 `BookingForm` 字段顺序、文案一致，并保留「状态」便于查看进度 */
  const dayColumns = [
    { title: '销售姓名', dataIndex: 'salesName', width: 100 },
    { title: '合同编号', dataIndex: 'contractNo', width: 120 },
    { title: '客户单位', dataIndex: 'customerUnit', width: 160 },
    { title: '客户姓名', dataIndex: 'customerName', width: 100 },
    { title: '客户联系方式', dataIndex: 'customerContact', width: 120 },
    { title: '是否解离', dataIndex: 'needDissociation', width: 100, render: (v) => (v ? '是' : '否') },
    { title: '样本及样本类型', dataIndex: 'sampleInfo', width: 180, render: (v) => v || '—' },
    { title: '出差范围起', dataIndex: 'tripStart', width: 150, render: (v) => v || '—' },
    { title: '出差范围止', dataIndex: 'tripEnd', width: 150, render: (v) => v || '—' },
    { title: '上门服务时间', dataIndex: 'visitTime', width: 170 },
    { title: '上门实验员', dataIndex: 'experimenter', width: 100 },
    { title: '样本数量', dataIndex: 'sampleCount', width: 80 },
    { title: '测序类型', dataIndex: 'seqType', width: 160 },
    { title: '测序数据量', dataIndex: 'seqDataVolume', width: 120, render: (v) => v || '—' },
    { title: 'PM负责人', dataIndex: 'pmOwner', width: 100, render: (v) => v || '—' },
    { title: '实验平台', dataIndex: 'platform', width: 90 },
    {
      title: '通知方式',
      dataIndex: 'notifyMethods',
      width: 160,
      render: (v) => (Array.isArray(v) ? v.join('、') : '')
    },
    { title: '备注', dataIndex: 'remark', width: 180, render: (v) => v || '—' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => statusLabel(v) }
  ];

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">填写预约记录</Typography.Title>

      <Card
        title="单细胞每日预约单量（日历视图）"
        loading={summaryLoading}
        style={{ marginBottom: 16 }}
        extra={
          canCreate ? (
            <Button type="primary" onClick={() => setCreateModalOpen(true)}>
              新增预约
            </Button>
          ) : null
        }
      >
        <Space size={12} style={{ marginBottom: 8, fontSize: 12 }}>
          <Space size={6}>
            <ColorDot color="#52c41a" />
            <span style={{ color: '#000' }}>≤8 样本不忙</span>
          </Space>
          <Space size={6}>
            <ColorDot color="#faad14" />
            <span style={{ color: '#000' }}>9-16 样本忙碌</span>
          </Space>
          <Space size={6}>
            <ColorDot color="#ff4d4f" />
            <span style={{ color: '#000' }}>{'>=17 样本爆满'}</span>
          </Space>
        </Space>
        <div className="cardGrid" style={{ marginBottom: 12 }}>
          <Card size="small" title="今日（公司）">
            {rangeTotals.todayOrders} 单 · 样本 {rangeTotals.todaySamples}
          </Card>
          <Card size="small" title="本周（公司）">
            {rangeTotals.weekOrders} 单 · 样本 {rangeTotals.weekSamples}
          </Card>
          <Card size="small" title="本月（公司）">
            {rangeTotals.monthOrders} 单 · 样本 {rangeTotals.monthSamples}
          </Card>
        </div>
        <Calendar className="bookingCalendar" cellRender={cellRender} onSelect={onSelectDate} />
      </Card>

      <Modal
        title={dayModalDate ? `${dayModalDate} 预约列表` : '当日预约'}
        open={dayModalOpen}
        onCancel={() => {
          setDayModalOpen(false);
          setDayModalDate(null);
          setDayDetail(null);
        }}
        width={1100}
        footer={null}
        destroyOnClose
      >
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          {dayDetail
            ? `公司当日（以上门服务时间所在日期计）共 ${dayDetail.companyOrderCount} 单，样本合计 ${dayDetail.companySampleSum}`
            : null}
        </div>
        <Table
          size="small"
          rowKey="id"
          loading={dayLoading}
          columns={dayColumns}
          dataSource={dayDetail?.items || []}
          scroll={{ x: 2480 }}
          pagination={false}
        />
      </Modal>

      {canCreate ? (
        <Modal
          title="新增预约"
          open={createModalOpen}
          onCancel={() => setCreateModalOpen(false)}
          footer={null}
          width={800}
          destroyOnClose
        >
          <BookingForm
            experimenters={experimenters}
            seqTypeOptions={seqTypeOptions}
            pmOwners={pmOwners}
            submitting={submitting}
            submitText="提交预约"
            onSubmit={async (payload) => {
              try {
                setSubmitting(true);
                await createBookingMut.mutateAsync(payload);
                message.success('已提交预约');
                await queryClient.invalidateQueries({ queryKey: ['bookings'] });
                setCreateModalOpen(false);
                await loadSummary();
                if (dayModalDate) {
                  await loadDay(dayModalDate);
                }
              } catch (e) {
                const he = getHttpError(e);
                if (he.data?.code === 'SCHEDULE_CONFLICT') {
                  message.error(conflictMessage(he.data));
                } else {
                  message.error(he?.message || '提交失败');
                }
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
