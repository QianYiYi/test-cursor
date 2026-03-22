import React, { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu, Typography } from 'antd';
import {
  FormOutlined,
  TableOutlined,
  DashboardOutlined,
  AreaChartOutlined,
  TeamOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { BookingFormPage } from './pages/BookingFormPage';
import { RecordsPage } from './pages/RecordsPage';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { ExperimentersPage } from './pages/ExperimentersPage';
import { SeqTypesPage } from './pages/SeqTypesPage';
import { can, getCurrentUser, isLoggedIn, logout, setCurrentUser } from './auth';
import { api } from './api';

const { Header, Content, Sider } = Layout;

const items = [
  { key: '/new', icon: <FormOutlined />, label: '预约登记', permission: 'booking:create' },
  { key: '/records', icon: <TableOutlined />, label: '预约记录', permission: 'booking:read' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '订单状态', permission: 'booking:read' },
  { key: '/analytics', icon: <AreaChartOutlined />, label: '统计趋势', permission: 'analytics:read' },
  { key: '/experimenters', icon: <TeamOutlined />, label: '实验员配置', permission: 'experimenter:manage' },
  { key: '/seq-types', icon: <AppstoreOutlined />, label: '测序类型配置', permission: 'seq-type:manage' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理', permission: 'user:manage' },
  { key: '/roles', icon: <SafetyCertificateOutlined />, label: '角色管理', permission: 'role:manage' }
];

export function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const user = getCurrentUser();
  const authed = isLoggedIn();
  const menuItems = useMemo(() => {
    if (!authed) return [];
    const allowedMenus = Array.isArray(user?.menus) ? user.menus : [];
    return items.filter((i) => allowedMenus.includes(i.key) || can(i.permission));
  }, [authed, user]);

  useEffect(() => {
    if (!authed) return;
    api.me()
      .then((r) => {
        if (r?.user) setCurrentUser(r.user);
      })
      .catch(() => {
        // ignore; 401 is already handled in api layer
      });
  }, [authed]);

  return (
    <Layout className="appShell">
      <Sider width={220} theme="dark" collapsed={!authed} collapsedWidth={0}>
        <div style={{ height: 64, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
          <Typography.Title level={5} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
            单细胞预约系统
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={menuItems}
          selectedKeys={[menuItems.find(i => loc.pathname.startsWith(i.key))?.key || '/records']}
          onClick={(e) => nav(e.key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div />
            {authed ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Typography.Text style={{ color: '#000000' }}>
                  登录名称：{user?.name || user?.email || '已登录'}
                </Typography.Text>
                <Button
                  size="small"
                  onClick={() => {
                    logout();
                    nav('/login');
                  }}
                >
                  退出
                </Button>
              </div>
            ) : null}
          </div>
        </Header>
        <Content className="contentWrap">
          <Routes>
            <Route path="/" element={<Navigate to={authed ? '/records' : '/login'} replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/new" element={authed ? <BookingFormPage /> : <Navigate to="/login" replace />} />
            <Route path="/records" element={authed ? <RecordsPage /> : <Navigate to="/login" replace />} />
            <Route path="/dashboard" element={authed ? <DashboardPage /> : <Navigate to="/login" replace />} />
            <Route path="/analytics" element={authed ? <AnalyticsPage /> : <Navigate to="/login" replace />} />
            <Route path="/experimenters" element={authed && can('experimenter:manage') ? <ExperimentersPage /> : <Navigate to="/records" replace />} />
            <Route path="/seq-types" element={authed && can('seq-type:manage') ? <SeqTypesPage /> : <Navigate to="/records" replace />} />
            <Route path="/users" element={authed && can('user:manage') ? <UsersPage /> : <Navigate to="/records" replace />} />
            <Route path="/roles" element={authed && can('role:manage') ? <RolesPage /> : <Navigate to="/records" replace />} />
            <Route path="*" element={<Navigate to="/records" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

