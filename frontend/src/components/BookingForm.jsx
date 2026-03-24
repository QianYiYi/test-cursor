import React, { useEffect, useMemo } from 'react';
import { Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import dayjs from 'dayjs';
import { PLATFORMS, SEQ_TYPES } from '../constants';

const { RangePicker } = DatePicker;

/** 多日出差：仅选「上门服务时刻」；结束时间 = 上门后 1 小时，不超过出差结束、且不跨自然日后再截断 */
function computeServiceEndTime(visitAt, tripEnd) {
  if (!visitAt?.isValid() || !tripEnd?.isValid()) return null;
  let end = visitAt.add(1, 'hour');
  if (end.format('YYYY-MM-DD') !== visitAt.format('YYYY-MM-DD')) {
    end = visitAt.endOf('day');
  }
  if (end.isAfter(tripEnd)) {
    end = tripEnd;
  }
  if (!end.isAfter(visitAt)) {
    end = visitAt.add(1, 'minute');
    if (end.isAfter(tripEnd)) {
      return null;
    }
  }
  return end;
}

const notifyOptions = [
  { label: '微信', value: '微信' },
  { label: '邮件', value: '邮件' },
  { label: '手机号码', value: '手机号码' },
  { label: 'Teams', value: 'Teams' },
  { label: '其他', value: '其他' }
];

function formatDt(d) {
  return d ? d.format('YYYY-MM-DD HH:mm:ss') : '';
}

function normalizeMobile(s) {
  return String(s ?? '').replace(/\s+/g, '');
}

export function BookingForm({
  initialValues,
  onSubmit,
  submitting,
  submitText = '提交预约',
  experimenters = [],
  seqTypeOptions,
  pmOwners = []
}) {
  const [form] = Form.useForm();
  const tripRange = Form.useWatch('tripRange', form);

  const typeList = useMemo(() => {
    if (Array.isArray(seqTypeOptions) && seqTypeOptions.length) return seqTypeOptions;
    return SEQ_TYPES;
  }, [seqTypeOptions]);

  /** 旧数据无出差范围时，仅保留原「服务开始/结束」编辑方式 */
  const isLegacyEdit = Boolean(
    initialValues?.id && !initialValues?.tripStart && !initialValues?.tripEnd
  );

  useEffect(() => {
    if (!initialValues) {
      form.resetFields();
      return;
    }
    if (isLegacyEdit) {
      form.setFieldsValue({
        ...initialValues,
        visitTime: initialValues.visitTime ? dayjs(initialValues.visitTime) : null,
        serviceEndTime: initialValues.serviceEndTime ? dayjs(initialValues.serviceEndTime) : null
      });
      return;
    }
    const ts = initialValues.tripStart ? dayjs(initialValues.tripStart) : null;
    const te = initialValues.tripEnd ? dayjs(initialValues.tripEnd) : null;
    form.setFieldsValue({
      ...initialValues,
      tripRange: ts && te ? [ts, te] : undefined,
      visitAt: initialValues.visitTime ? dayjs(initialValues.visitTime) : undefined
    });
  }, [initialValues, form, isLegacyEdit]);

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          let payload;
          if (isLegacyEdit) {
            payload = {
              salesName: values.salesName,
              contractNo: values.contractNo,
              customerUnit: values.customerUnit,
              customerName: values.customerName,
              customerContact: normalizeMobile(values.customerContact),
              needDissociation: Boolean(values.needDissociation),
              sampleInfo: values.sampleInfo,
              visitTime: formatDt(values.visitTime),
              serviceEndTime: formatDt(values.serviceEndTime),
              experimenter: values.experimenter,
              sampleCount: Number(values.sampleCount || 0),
              seqType: values.seqType,
              seqDataVolume: values.seqDataVolume || null,
              pmOwner: values.pmOwner || null,
              platform: values.platform,
              notifyMethods: values.notifyMethods || [],
              remark: values.remark || null
            };
          } else {
            const [tStart, tEnd] = values.tripRange || [];
            if (!tStart || !tEnd) {
              return;
            }
            const tripStart = formatDt(tStart);
            const tripEnd = formatDt(tEnd);
            const va = values.visitAt;
            if (!va) return;
            const visitAt = dayjs(va);
            const tripEndD = dayjs(tEnd);
            const endAt = computeServiceEndTime(visitAt, tripEndD);
            if (!endAt) return;
            const visitTime = formatDt(visitAt);
            const serviceEndTime = formatDt(endAt);
            payload = {
              salesName: values.salesName,
              contractNo: values.contractNo,
              customerUnit: values.customerUnit,
              customerName: values.customerName,
              customerContact: normalizeMobile(values.customerContact),
              needDissociation: Boolean(values.needDissociation),
              sampleInfo: values.sampleInfo,
              tripStart,
              tripEnd,
              visitTime,
              serviceEndTime,
              experimenter: values.experimenter,
              sampleCount: Number(values.sampleCount || 0),
              seqType: values.seqType,
              seqDataVolume: values.seqDataVolume || null,
              pmOwner: values.pmOwner || null,
              platform: values.platform,
              notifyMethods: values.notifyMethods || [],
              remark: values.remark || null
            };
          }
          return onSubmit?.(payload);
        }}
        initialValues={{
          needDissociation: false,
          notifyMethods: []
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Form.Item label="销售姓名" name="salesName" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="请输入销售姓名" />
          </Form.Item>
          <Form.Item label="合同编号" name="contractNo" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="请输入合同编号" />
          </Form.Item>
          <Form.Item label="客户单位" name="customerUnit" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="请输入客户单位" />
          </Form.Item>
          <Form.Item label="客户姓名" name="customerName" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="请输入客户姓名" />
          </Form.Item>
          <Form.Item
            label="客户联系方式"
            name="customerContact"
            rules={[
              {
                validator: (_, value) => {
                  const s = normalizeMobile(value);
                  if (!s) return Promise.reject(new Error('必填'));
                  if (!/^1[3-9]\d{9}$/.test(s)) return Promise.reject(new Error('手机格式错误'));
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input placeholder="手机" />
          </Form.Item>
          <Form.Item label="是否需要解离" name="needDissociation" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item
            label="样本及样本类型"
            name="sampleInfo"
            rules={[{ required: true, message: '必填' }]}
            style={{ gridColumn: '1 / -1' }}
          >
            <Input placeholder="如：外周血、组织等" />
          </Form.Item>

          {isLegacyEdit ? (
            <>
              <Form.Item label="服务开始时间" name="visitTime" rules={[{ required: true, message: '必填' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="服务结束时间"
                name="serviceEndTime"
                dependencies={['visitTime']}
                rules={[
                  { required: true, message: '必填' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const start = getFieldValue('visitTime');
                      if (!start || !value) return Promise.resolve();
                      if (value.isAfter(start)) return Promise.resolve();
                      return Promise.reject(new Error('结束时间必须晚于开始时间'));
                    }
                  })
                ]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                label="实验员出差服务范围"
                name="tripRange"
                style={{ gridColumn: '1 / -1' }}
                rules={[
                  { required: true, message: '请选择出差服务时间范围' },
                  () => ({
                    validator(_, value) {
                      if (!value?.[0] || !value?.[1]) return Promise.resolve();
                      if (value[1].isAfter(value[0])) return Promise.resolve();
                      return Promise.reject(new Error('出差结束须晚于开始'));
                    }
                  })
                ]}
                extra="例如 3 月 22 日出发、24 日返回，则选 22 日 0 点 至 24 日 23:59（按实际约定调整）。"
              >
                <RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                  label="具体上门服务时间"
                  name="visitAt"
                  style={{ gridColumn: '1 / -1' }}
                  dependencies={['tripRange']}
                  rules={[
                    { required: true, message: '请选择具体上门服务时间' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const tr = getFieldValue('tripRange');
                        if (!tr?.[0] || !tr?.[1] || !value) {
                          return Promise.resolve();
                        }
                        const t0 = tr[0].valueOf();
                        const t1 = tr[1].valueOf();
                        const v = value.valueOf();
                        if (v < t0 || v > t1) {
                          return Promise.reject(new Error('上门服务时间须在出差服务范围之内'));
                        }
                        const endAt = computeServiceEndTime(dayjs(value), tr[1]);
                        if (!endAt) {
                          return Promise.reject(new Error('出差结束时间过晚，无法安排上门后服务时长，请调整'));
                        }
                        return Promise.resolve();
                      }
                    })
                  ]}
                  extra="日历与样本统计按该时刻所在日期计算；系统会按上门后约 1 小时生成服务结束时间（不超过出差结束）。"
                >
                  <DatePicker
                    showTime
                    style={{ width: '100%' }}
                    disabledDate={(current) => {
                      if (!tripRange?.[0] || !tripRange?.[1] || !current) return false;
                      return (
                        current.isBefore(tripRange[0], 'day') || current.isAfter(tripRange[1], 'day')
                      );
                    }}
                  />
                </Form.Item>
            </>
          )}

          <Form.Item
            label="上门实验员"
            name="experimenter"
            rules={[{ required: true, message: '请选择上门实验员' }]}
          >
            <Select
              placeholder="请选择实验员"
              options={experimenters.map(v => ({ value: v.name, label: v.name }))}
            />
          </Form.Item>
          <Form.Item label="样本数量" name="sampleCount" rules={[{ required: true, message: '必填' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="测序类型"
            name="seqType"
            rules={[{ required: true, message: '必填' }]}
          >
            <Select
              placeholder="请选择"
              options={typeList.map(v => ({ value: v, label: v }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="测序数据量" name="seqDataVolume">
            <Input placeholder="如：200G / 800M reads" />
          </Form.Item>
          <Form.Item label="PM负责人" name="pmOwner">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="请选择PM负责人"
              options={pmOwners.map((v) => ({ value: v.name, label: v.name }))}
            />
          </Form.Item>
          <Form.Item label="实验平台" name="platform" rules={[{ required: true, message: '必填' }]}>
            <Select placeholder="请选择" options={PLATFORMS.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="通知方式" name="notifyMethods" style={{ gridColumn: '1 / -1' }}>
            <Checkbox.Group options={notifyOptions} />
          </Form.Item>
          <Form.Item label="备注" name="remark" style={{ gridColumn: '1 / -1' }}>
            <Input.TextArea rows={3} placeholder="可选，填写补充说明" />
          </Form.Item>
        </div>

        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {submitText}
          </Button>
          <Button
            onClick={() => {
              form.resetFields();
            }}
          >
            重置
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
