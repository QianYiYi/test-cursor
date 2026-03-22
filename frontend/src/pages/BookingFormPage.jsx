import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Calendar, Card, Modal, Space, Table, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import { BookingForm } from '../components/BookingForm';
import { createBooking, fetchBookings, setLastQuery } from '../store/bookingsSlice';
import { api } from '../api';
import { STATUS_OPTIONS } from '../constants';
import { can } from '../auth';

function conflictMessage(errorData) {
  const conflicts = Array.isArray(errorData?.conflicts) ? errorData.conflicts : [];
  if (!conflicts.length) return '排班冲突：该实验员该时间段已被占用';
  const first = conflicts[0];
  return `排班冲突：${first.customerUnit || ''}${first.customerName ? ` ${first.customerName}` : ''}（${first.visitTime} ~ ${first.serviceEndTime}）`;
}

function statusLabel(v) {
  return STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
}

function ColorDot({ color }) {
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

export function BookingFormPage() {
  const dispatch = useDispatch();
  const canCreate = can('booking:create');
  const [submitting, setSubmitting] = useState(false);
  const [experimenters, setExperimenters] = useState([]);
  const [seqTypeOptions, setSeqTypeOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
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

  const loadDay = useCallback(async (ymd) => {
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
    let mounted = true;
    api.listExperimenters()
      .then((r) => {
        if (!mounted) return;
        const items = (r.items || []).filter((e) => e.isActive);
        setExperimenters(items);
      })
      .catch(() => {
        if (!mounted) return;
        setExperimenters([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    api.listSeqTypes()
      .then((r) => {
        if (!mounted) return;
        setSeqTypeOptions(Array.isArray(r.all) ? r.all : []);
      })
      .catch(() => {
        if (!mounted) return;
        setSeqTypeOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const dayMap = useMemo(() => {
    const m = new Map();
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
    (value) => {
      const key = value.format('YYYY-MM-DD');
      const info = dayMap.get(key);
      const resolved = info || {
        orderCount: 0,
        sampleSum: 0,
        remainingExperimenters: Number(summary?.activeExperimenters || 0),
        busyLevel: 'idle'
      };
      return (
        <div style={{ fontSize: 11, lineHeight: 1.35 }}>
          <div>{resolved.orderCount} 单</div>
          <div style={{ marginTop: 2 }}>
            样本 {resolved.sampleSum} · 剩余实验员 {resolved.remainingExperimenters}
          </div>
        </div>
      );
    },
    [dayMap, summary]
  );

  const onSelectDate = (d, info) => {
    if (info?.source && info.source !== 'date') return;
    const ymd = d.format('YYYY-MM-DD');
    setDayModalDate(ymd);
    setDayModalOpen(true);
    loadDay(ymd);
  };

  const dayColumns = [
    { title: '合同编号', dataIndex: 'contractNo', width: 120 },
    { title: '客户单位', dataIndex: 'customerUnit', width: 160 },
    { title: '客户', dataIndex: 'customerName', width: 90 },
    { title: '出差范围起', dataIndex: 'tripStart', width: 130, render: (v) => v || '—' },
    { title: '出差范围止', dataIndex: 'tripEnd', width: 130, render: (v) => v || '—' },
    { title: '上门开始', dataIndex: 'visitTime', width: 155 },
    { title: '上门结束', dataIndex: 'serviceEndTime', width: 155 },
    { title: '实验员', dataIndex: 'experimenter', width: 90 },
    { title: '样本', dataIndex: 'sampleCount', width: 60 },
    { title: '测序类型', dataIndex: 'seqType', width: 140 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v) => statusLabel(v) }
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
            <span style={{ color: '#000' }}>≤8 单不忙</span>
          </Space>
          <Space size={6}>
            <ColorDot color="#faad14" />
            <span style={{ color: '#000' }}>9-16 单忙碌</span>
          </Space>
          <Space size={6}>
            <ColorDot color="#ff4d4f" />
            <span style={{ color: '#000' }}>{'>=17 单爆满'}</span>
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
        width={960}
        footer={null}
        destroyOnClose
      >
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          {dayDetail
            ? `公司当日（与上门时段重叠）共 ${dayDetail.companyOrderCount} 单，样本合计 ${dayDetail.companySampleSum}`
            : null}
        </div>
        <Table
          size="small"
          rowKey="id"
          loading={dayLoading}
          columns={dayColumns}
          dataSource={dayDetail?.items || []}
          scroll={{ x: 1100 }}
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
            submitting={submitting}
            submitText="提交预约"
            onSubmit={async (payload) => {
              try {
                setSubmitting(true);
                await dispatch(createBooking(payload)).unwrap();
                message.success('已提交预约');
                dispatch(setLastQuery({}));
                await dispatch(fetchBookings({ page: 1, pageSize: 50 })).unwrap();
                setCreateModalOpen(false);
                await loadSummary();
                if (dayModalDate) await loadDay(dayModalDate);
              } catch (e) {
                if (e?.data?.code === 'SCHEDULE_CONFLICT') message.error(conflictMessage(e?.data));
                else message.error(e?.message || '提交失败');
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
