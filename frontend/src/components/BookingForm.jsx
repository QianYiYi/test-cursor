import React, { useEffect, useMemo } from 'react';
import { Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { PLATFORMS, SEQ_TYPES } from '../constants';

const { RangePicker } = DatePicker;

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

export function BookingForm({
  initialValues,
  onSubmit,
  submitting,
  submitText = '提交预约',
  experimenters = [],
  seqTypeOptions
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

  const tripSameDay = useMemo(() => {
    if (!tripRange?.[0] || !tripRange?.[1]) return false;
    return tripRange[0].format('YYYY-MM-DD') === tripRange[1].format('YYYY-MM-DD');
  }, [tripRange]);

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
    const same =
      ts &&
      te &&
      ts.isValid() &&
      te.isValid() &&
      ts.format('YYYY-MM-DD') === te.format('YYYY-MM-DD');
    form.setFieldsValue({
      ...initialValues,
      tripRange: ts && te ? [ts, te] : undefined,
      visitRange:
        ts && te && !same
          ? [dayjs(initialValues.visitTime), dayjs(initialValues.serviceEndTime)]
          : undefined
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
              customerContact: values.customerContact,
              needDissociation: Boolean(values.needDissociation),
              sampleInfo: values.sampleInfo,
              visitTime: formatDt(values.visitTime),
              serviceEndTime: formatDt(values.serviceEndTime),
              experimenter: values.experimenter,
              sampleCount: Number(values.sampleCount || 0),
              seqType: values.seqType,
              platform: values.platform,
              notifyMethods: values.notifyMethods || []
            };
          } else {
            const [tStart, tEnd] = values.tripRange || [];
            if (!tStart || !tEnd) {
              return;
            }
            const tripStart = formatDt(tStart);
            const tripEnd = formatDt(tEnd);
            const sameDay = tStart.format('YYYY-MM-DD') === tEnd.format('YYYY-MM-DD');
            let visitTime;
            let serviceEndTime;
            if (sameDay) {
              visitTime = tripStart;
              serviceEndTime = tripEnd;
            } else {
              const [v0, v1] = values.visitRange || [];
              if (!v0 || !v1) return;
              visitTime = formatDt(v0);
              serviceEndTime = formatDt(v1);
            }
            payload = {
              salesName: values.salesName,
              contractNo: values.contractNo,
              customerUnit: values.customerUnit,
              customerName: values.customerName,
              customerContact: values.customerContact,
              needDissociation: Boolean(values.needDissociation),
              sampleInfo: values.sampleInfo,
              tripStart,
              tripEnd,
              visitTime,
              serviceEndTime,
              experimenter: values.experimenter,
              sampleCount: Number(values.sampleCount || 0),
              seqType: values.seqType,
              platform: values.platform,
              notifyMethods: values.notifyMethods || []
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
          <Form.Item label="客户联系方式" name="customerContact" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="手机/邮箱" />
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
              {tripSameDay && tripRange?.[0] ? (
                <Typography.Paragraph type="secondary" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                  当前为<strong>单日</strong>出差：上门订单时间与服务范围相同，无需再选「上门订单时间」。
                </Typography.Paragraph>
              ) : null}
              {!tripSameDay && tripRange?.[0] && tripRange?.[1] ? (
                <Form.Item
                  label="上门订单时间范围"
                  name="visitRange"
                  style={{ gridColumn: '1 / -1' }}
                  dependencies={['tripRange']}
                  rules={[
                    { required: true, message: '请选择实际上门时段' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const tr = getFieldValue('tripRange');
                        if (!tr?.[0] || !tr?.[1] || !value?.[0] || !value?.[1]) {
                          return Promise.resolve();
                        }
                        const t0 = tr[0].valueOf();
                        const t1 = tr[1].valueOf();
                        const v0 = value[0].valueOf();
                        const v1 = value[1].valueOf();
                        if (v1 <= v0) return Promise.reject(new Error('上门结束须晚于开始'));
                        if (v0 < t0 || v1 > t1) {
                          return Promise.reject(new Error('上门订单时间须在出差服务范围之内'));
                        }
                        return Promise.resolve();
                      }
                    })
                  ]}
                  extra="须在出差范围内，例如出差 22–24 日，上门可选 23 日 08:00–20:00。"
                >
                  <RangePicker
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
              ) : null}
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
            style={{ gridColumn: '1 / -1' }}
          >
            <Select
              placeholder="请选择"
              options={typeList.map(v => ({ value: v, label: v }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="实验平台" name="platform" rules={[{ required: true, message: '必填' }]}>
            <Select placeholder="请选择" options={PLATFORMS.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="通知方式" name="notifyMethods" style={{ gridColumn: '1 / -1' }}>
            <Checkbox.Group options={notifyOptions} />
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
