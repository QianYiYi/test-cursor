import React, { useEffect, useMemo } from 'react';
import { Card, List, Typography } from 'antd';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBookings } from '../store/bookingsSlice';
import { STATUS_OPTIONS } from '../constants';
import { fetchAnalytics } from '../store/analyticsSlice';
import { getCurrentUser } from '../auth';

const panelTextStyle = { color: '#000' };

/** 待完成且已超过上门结束日期的日历天数：结束日次日为逾期第 1 天 */
function pendingOverdueDays(serviceEndTime) {
  const end = dayjs(serviceEndTime).startOf('day');
  const today = dayjs().startOf('day');
  const d = today.diff(end, 'day');
  return d > 0 ? d : 0;
}

function overdueStyle(days) {
  if (days <= 0) return null;
  if (days <= 2) return { color: '#389e0d', fontWeight: 600 };
  if (days <= 5) return { color: '#d46b08', fontWeight: 600 };
  return { color: '#cf1322', fontWeight: 600 };
}

export function DashboardPage() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector(s => s.bookings);
  const analytics = useSelector((s) => s.analytics.data);
  const user = getCurrentUser();
  const isCustomer = user?.roleCode === 'customer_booking';

  useEffect(() => {
    dispatch(fetchBookings({ page: 1, pageSize: 200 }));
    dispatch(fetchAnalytics());
  }, [dispatch]);

  const groups = useMemo(() => {
    const map = { pending: [], in_progress: [], done: [] };
    for (const it of items || []) {
      map[it.status]?.push(it);
    }
    return map;
  }, [items]);

  const dailyMap = useMemo(() => {
    const map = new Map();
    for (const row of analytics?.dailyCompany || []) {
      const key = dayjs(row.day).format('YYYY-MM-DD');
      map.set(key, Number(row.count || 0));
    }
    return map;
  }, [analytics]);

  const today = dayjs().format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('week');
  const weekEnd = dayjs().endOf('week');
  const monthStart = dayjs().startOf('month');
  const monthEnd = dayjs().endOf('month');
  const totals = useMemo(() => {
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    for (const [day, count] of dailyMap.entries()) {
      const d = dayjs(day);
      if (day === today) todayCount += count;
      if ((d.isAfter(weekStart) || d.isSame(weekStart, 'day')) && (d.isBefore(weekEnd) || d.isSame(weekEnd, 'day'))) weekCount += count;
      if ((d.isAfter(monthStart) || d.isSame(monthStart, 'day')) && (d.isBefore(monthEnd) || d.isSame(monthEnd, 'day'))) monthCount += count;
    }
    return { todayCount, weekCount, monthCount };
  }, [dailyMap, monthEnd, monthStart, today, weekEnd, weekStart]);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">预约订单状态</Typography.Title>
      {isCustomer ? (
        <div className="cardGrid" style={{ marginBottom: 12 }}>
          <Card title="今日公司总订单量" styles={{ body: panelTextStyle }}>
            <span style={panelTextStyle}>{totals.todayCount}</span>
          </Card>
          <Card title="本周公司总订单量" styles={{ body: panelTextStyle }}>
            <span style={panelTextStyle}>{totals.weekCount}</span>
          </Card>
          <Card title="本月公司总订单量" styles={{ body: panelTextStyle }}>
            <span style={panelTextStyle}>{totals.monthCount}</span>
          </Card>
        </div>
      ) : null}
      <div className="cardGrid">
        {STATUS_OPTIONS.map(s => (
          <Card
            key={s.value}
            title={<span style={panelTextStyle}>{`${s.label}（${groups[s.value]?.length || 0}）`}</span>}
            loading={loading}
            styles={{ body: panelTextStyle }}
          >
            <List
              size="small"
              dataSource={(groups[s.value] || []).slice(0, 8)}
              renderItem={(item) => {
                const od =
                  s.value === 'pending' ? pendingOverdueDays(item.serviceEndTime) : 0;
                const odStyle = s.value === 'pending' ? overdueStyle(od) : null;
                return (
                  <List.Item>
                    <div style={{ width: '100%', ...panelTextStyle }}>
                      <div style={{ fontWeight: 600, color: '#000' }}>
                        {item.customerUnit} · {item.customerName}
                        {od > 0 ? (
                          <span style={{ marginLeft: 8, ...odStyle }}>
                            逾期 {od} 天
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: '#000' }}>
                        {item.visitTime} · {item.seqType} · {item.platform} · 样本 {item.sampleCount}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
            {(groups[s.value]?.length || 0) > 8 ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#000' }}>
                仅展示前 8 条，完整列表请到「预约记录」。
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
