import React, { useEffect, useMemo } from 'react';
import { Card, Typography, Alert } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAnalytics } from '../store/analyticsSlice';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export function AnalyticsPage() {
  const dispatch = useDispatch();
  const { data, loading, error } = useSelector(s => s.analytics);

  useEffect(() => {
    dispatch(fetchAnalytics());
  }, [dispatch]);

  const statusData = useMemo(() => (data?.status || []).map(s => ({ name: s.label, count: s.count })), [data]);
  const seqData = useMemo(() => (data?.seqType || []).slice(0, 10).map(s => ({ name: s.seqType, count: s.count })), [data]);
  const platformData = useMemo(() => (data?.platform || []).map(p => ({ name: p.platform, count: p.count })), [data]);
  const trendData = useMemo(() => (data?.trend || []).map(t => ({ day: String(t.day).slice(5), count: t.count })), [data]);
  const personalTrendData = useMemo(() => (data?.personal?.trend || []).map(t => ({ day: String(t.day).slice(5), count: t.count })), [data]);
  const personalSeqData = useMemo(() => (data?.personal?.seqType || []).slice(0, 10).map(s => ({ name: s.seqType, count: s.count })), [data]);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">统计表趋势</Typography.Title>
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}

      <div className="cardGrid" style={{ marginBottom: 12 }}>
        <Card title="状态分布" loading={loading}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1677ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="实验平台分布" loading={loading}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#00c9a7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="测序类型（Top 10）" loading={loading} style={{ marginBottom: 12 }}>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seqData} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={220} />
              <Tooltip />
              <Bar dataKey="count" fill="#d29922" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="近 30 天预约趋势（按上门日期）" loading={loading} style={{ marginBottom: 12 }}>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="count" name="预约数量" stroke="#00c9a7" fill="#00c9a7" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="简要分析" loading={loading}>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          {data?.insight || '暂无分析内容'}
        </div>
      </Card>

      {data?.personal ? (
        <Card title={`个人统计（${data.personal.experimenter}）`} loading={loading} style={{ marginTop: 12 }}>
          <div className="cardGrid" style={{ marginBottom: 12 }}>
            <Card size="small" title="个人总订单量">{data.personal.total || 0}</Card>
            <Card size="small" title="个人完成订单">{data.personal.done || 0}</Card>
            <Card size="small" title="个人未完成订单">{data.personal.undone || 0}</Card>
          </div>
          <div className="cardGrid">
            <Card size="small" title="个人订单趋势">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={personalTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" name="个人订单量" stroke="#7c4dff" fill="#7c4dff" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card size="small" title="个人测序类型分布">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={personalSeqData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7c4dff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

