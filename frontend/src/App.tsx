import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FormOutlined,
  TableOutlined,
  DashboardOutlined,
  AreaChartOutlined,
  TeamOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import { can, getCurrentUser, isLoggedIn, logout, setCurrentUser } from './auth';
import { api } from './api';
import { AppShell } from './layout/app-shell';
import { AppRoutes } from './routes/app-routes';

const items = [
  { key: '/new', icon: <FormOutlined />, label: '预约登记', permission: 'booking:create' },
  { key: '/records', icon: <TableOutlined />, label: '预约记录', permission: 'booking:read' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '订单状态', permission: 'booking:read' },
  { key: '/analytics', icon: <AreaChartOutlined />, label: '统计趋势', permission: 'analytics:read' },
  { key: '/experimenters', icon: <TeamOutlined />, label: '实验员配置', permission: 'experimenter:manage' },
  { key: '/pm-owners', icon: <IdcardOutlined />, label: 'PM配置', permission: 'pm-owner:manage' },
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
    if (!authed) {
      return [];
    }
    const allowedMenus = Array.isArray(user?.menus) ? user.menus : [];
    return items.filter((i) => allowedMenus.includes(i.key) || can(i.permission));
  }, [authed, user]);

  const selectedMenuKey = menuItems.find((i) => loc.pathname.startsWith(i.key))?.key || '/records';
  const userName = user?.name || user?.email || '已登录';

  useEffect(() => {
    if (!authed) {
      return;
    }
    api
      .me()
      .then((r) => {
        if (r?.user) {
          setCurrentUser(r.user);
        }
      })
      .catch(() => {
        // ignore; 401 is already handled in api layer
      });
  }, [authed]);

  return (
    <AppShell
      authed={authed}
      menuItems={menuItems}
      selectedMenuKey={selectedMenuKey}
      onMenuClick={(e) => nav(String(e.key))}
      userName={userName}
      onLogout={() => {
        logout();
        nav('/login');
      }}
    >
      <AppRoutes authed={authed} />
    </AppShell>
  );
}
