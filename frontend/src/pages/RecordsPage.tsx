import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, DatePicker, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { BookingForm } from '../components/BookingForm';
import { PLATFORMS, STATUS_OPTIONS } from '../constants';
import { api, getAuthToken } from '../api';
import type { BookingPayload, BookingRow, ExperimenterRow, ListBookingsParams, PmOwnerRow } from '../api';
import { can, getCurrentUser } from '../auth';
import { getHttpError } from '../lib/http-error';
import { useReferenceOptions } from '../hooks/use-reference-options';

const { RangePicker } = DatePicker;

function conflictMessage(errorData: ReturnType<typeof getHttpError>['data']) {
  const conflicts = Array.isArray(errorData?.conflicts) ? errorData.conflicts : [];
  if (!conflicts.length) {
    return '排班冲突：该实验员该时间段已被占用';
  }
  const first = conflicts[0];
  return `排班冲突：${first.customerUnit || ''}${first.customerName ? ` ${first.customerName}` : ''}（${first.visitTime} ~ ${first.serviceEndTime}）`;
}

function statusTag(status: string) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  if (!opt) return <Tag>未知</Tag>;
  const color = status === 'done' ? 'green' : status === 'in_progress' ? 'blue' : 'gold';
  return <Tag color={color}>{opt.label}</Tag>;
}

async function exportAllToExcel(query: ListBookingsParams) {
  const url = api.exportBookingsUrl(query || {});
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `导出失败: ${res.status}`;
    try {
      const data = text ? JSON.parse(text) : null;
      msg = data?.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = `单细胞实验室预约记录_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildListParamsFromForm(values: Record<string, unknown>, pageSize: number): ListBookingsParams {
  const visitRange = values.visitRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
  const visitFrom = visitRange?.[0] ? visitRange[0].format('YYYY-MM-DD 00:00:00') : undefined;
  const visitTo = visitRange?.[1] ? visitRange[1].format('YYYY-MM-DD 23:59:59') : undefined;

  return {
    salesName: String(values.salesName || '') || undefined,
    contractNo: String(values.contractNo || '') || undefined,
    customerUnit: String(values.customerUnit || '') || undefined,
    customerName: String(values.customerName || '') || undefined,
    needDissociation:
      values.needDissociation === undefined ? undefined : String(values.needDissociation),
    sampleInfo: String(values.sampleInfo || '') || undefined,
    experimenter: String(values.experimenter || '') || undefined,
    sampleCount: values.sampleCount === undefined ? undefined : String(values.sampleCount),
    seqType: String(values.seqType || '') || undefined,
    pmOwner: String(values.pmOwner || '') || undefined,
    platform: String(values.platform || '') || undefined,
    status: String(values.status || '') || undefined,
    visitFrom,
    visitTo,
    page: 1,
    pageSize
  };
}

export function RecordsPage() {
  const queryClient = useQueryClient();
  const [listParams, setListParams] = useState<ListBookingsParams>({ page: 1, pageSize: 50 });

  const { data, isPending: loading } = useQuery({
    queryKey: ['bookings', 'list', listParams],
    queryFn: () => api.listBookings(listParams)
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? listParams.page ?? 1;
  const pageSize = data?.pageSize ?? listParams.pageSize ?? 50;

  const updateBookingMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: BookingPayload }) => api.updateBooking(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] })
  });

  const deleteBookingMut = useMutation({
    mutationFn: (id: number) => api.deleteBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] })
  });
  const [filterForm] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const { experimenters, pmOwners, seqTypeOptions } = useReferenceOptions();
  const user = getCurrentUser();
  const isTechnician = user?.roleCode === 'technician';
  const canEditForm = can('booking:update') && !isTechnician;
  const canChangeStatus = can('booking:update') && user?.roleCode !== 'customer_booking';

  const columns = useMemo(() => {
    const cols = [
    {
      title: '操作状态',
      dataIndex: 'status',
      width: 112,
      onCell: () => ({ style: { overflow: 'visible' } }),
      render: (_, r) =>
        canChangeStatus ? (
          <Select
            size="small"
            value={r.status}
            style={{ width: '100%', minWidth: 92 }}
            options={STATUS_OPTIONS}
            optionFilterProp="label"
            getPopupContainer={() => document.body}
            dropdownStyle={{ zIndex: 1100 }}
            onChange={async (v) => {
              try {
                await updateBookingMut.mutateAsync({ id: r.id, body: { status: v } });
                message.success('状态已更新');
                await queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
              } catch (e) {
                const he = getHttpError(e);
                if (he.data?.code === 'SCHEDULE_CONFLICT') {
                  message.error(conflictMessage(he.data));
                } else {
                  message.error(he?.message || '更新失败');
                }
              }
            }}
          />
        ) : (
          statusTag(r.status)
        )
    },
    { title: '销售姓名', dataIndex: 'salesName', width: 110 },
    { title: '合同编号', dataIndex: 'contractNo', width: 140 },
    { title: '客户单位', dataIndex: 'customerUnit', width: 200 },
    { title: '客户姓名', dataIndex: 'customerName', width: 110 },
    { title: '联系方式', dataIndex: 'customerContact', width: 160 },
    { title: '是否解离', dataIndex: 'needDissociation', width: 90, render: v => (v ? '是' : '否') },
    { title: '样本及类型', dataIndex: 'sampleInfo', width: 220 },
    { title: '出差范围起', dataIndex: 'tripStart', width: 150, render: (v) => v || '—' },
    { title: '出差范围止', dataIndex: 'tripEnd', width: 150, render: (v) => v || '—' },
    { title: '上门服务时间', dataIndex: 'visitTime', width: 170 },
    { title: '实验员', dataIndex: 'experimenter', width: 110 },
    { title: '样本数量', dataIndex: 'sampleCount', width: 90 },
    { title: '测序类型', dataIndex: 'seqType', width: 220 },
    { title: '测序数据量', dataIndex: 'seqDataVolume', width: 140, render: (v) => v || '—' },
    { title: 'PM负责人', dataIndex: 'pmOwner', width: 120, render: (v) => v || '—' },
    { title: '实验平台', dataIndex: 'platform', width: 90 },
    { title: '备注', dataIndex: 'remark', width: 220, render: (v) => v || '—' },
    {
      title: '通知方式',
      dataIndex: 'notifyMethods',
      width: 180,
      render: v => (Array.isArray(v) ? v.join(', ') : '')
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 170,
      render: (_, r) => (
        <Space>
          {canEditForm ? (
            <Button
              size="small"
              onClick={() => {
                setEditing(r);
                setDrawerOpen(true);
              }}
            >
              编辑
            </Button>
          ) : null}
          {can('booking:delete') ? (
            <Popconfirm
              title="确定删除该记录？"
              okText="删除"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await deleteBookingMut.mutateAsync(r.id);
                  message.success('已删除');
                  await queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
                } catch (e) {
                  message.error(getHttpError(e)?.message || '删除失败');
                }
              }}
            >
              <Button danger size="small">删除</Button>
            </Popconfirm>
          ) : null}
        </Space>
      )
    }
    ];
    if (isTechnician) {
      return cols.filter((c) => c.key !== 'actions');
    }
    return cols;
  }, [canChangeStatus, canEditForm, deleteBookingMut, isTechnician, queryClient, updateBookingMut, page, pageSize]);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">预约记录</Typography.Title>

      <Card style={{ marginBottom: 12 }}>
        <Form
          form={filterForm}
          layout="inline"
          style={{ rowGap: 12 }}
          onFinish={async (values) => {
            setListParams(buildListParamsFromForm(values, pageSize));
          }}
        >
          <Form.Item name="salesName" label="销售姓名">
            <Input placeholder="模糊匹配" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="contractNo" label="合同编号">
            <Input placeholder="模糊匹配" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="customerUnit" label="客户单位">
            <Input placeholder="模糊匹配" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="模糊匹配" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="needDissociation" label="是否解离">
            <Select
              allowClear
              style={{ width: 120 }}
              options={[
                { value: true, label: '是' },
                { value: false, label: '否' }
              ]}
            />
          </Form.Item>
          <Form.Item name="sampleInfo" label="样本类型">
            <Input placeholder="模糊匹配" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="visitRange" label="上门时间">
            <RangePicker />
          </Form.Item>
          <Form.Item name="experimenter" label="实验员">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="请选择实验员"
              style={{ width: 160 }}
              options={experimenters.map((v: ExperimenterRow) => ({ value: v.name, label: v.name }))}
            />
          </Form.Item>
          <Form.Item name="sampleCount" label="样本数量">
            <InputNumber min={1} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="seqType" label="测序类型">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              options={seqTypeOptions.map((v: string) => ({ value: v, label: v }))}
            />
          </Form.Item>
          <Form.Item name="pmOwner" label="PM负责人">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 160 }}
              options={pmOwners.map((v: PmOwnerRow) => ({ value: v.name, label: v.name }))}
            />
          </Form.Item>
          <Form.Item name="platform" label="平台">
            <Select allowClear style={{ width: 120 }} options={PLATFORMS.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear style={{ width: 120 }} options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">筛选</Button>
              <Button
                onClick={() => {
                  filterForm.resetFields();
                  setListParams({ page: 1, pageSize: 50 });
                }}
              >
                清空
              </Button>
              {can('booking:export') ? (
                <Button
                  onClick={async () => {
                    try {
                      await exportAllToExcel(listParams || {});
                      message.success('已导出 Excel');
                    } catch (e) {
                      message.error(e instanceof Error ? e.message : '导出失败');
                    }
                  }}
                >
                  导出 Excel
                </Button>
              ) : null}
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <div className="muted" style={{ marginBottom: 8 }}>
          总计：{total} 条 {loading ? '（加载中…）' : ''}
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1860 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            onChange: (p, ps) => {
              setListParams((prev) => ({ ...prev, page: p, pageSize: ps }));
            }
          }}
        />
      </Card>

      <Drawer
        title="编辑预约记录"
        width={720}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        destroyOnClose
      >
        <BookingForm
          experimenters={experimenters}
          seqTypeOptions={seqTypeOptions}
          pmOwners={pmOwners}
          initialValues={editing}
          submitText="保存修改"
          onSubmit={async (payload) => {
            if (!editing?.id) {
              return;
            }
            try {
              await updateBookingMut.mutateAsync({ id: editing.id, body: payload });
              message.success('已保存');
              setDrawerOpen(false);
              setEditing(null);
              await queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
            } catch (e) {
              const he = getHttpError(e);
              if (he.data?.code === 'SCHEDULE_CONFLICT') {
                message.error(conflictMessage(he.data));
              } else {
                message.error(he?.message || '保存失败');
              }
            }
          }}
        />
      </Drawer>
    </div>
  );
}

