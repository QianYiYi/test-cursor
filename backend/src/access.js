export const MENU_OPTIONS = [
  { key: '/new', label: '预约登记' },
  { key: '/records', label: '预约记录' },
  { key: '/dashboard', label: '订单状态' },
  { key: '/analytics', label: '统计趋势' },
  { key: '/experimenters', label: '实验员配置' },
  { key: '/seq-types', label: '测序类型配置' },
  { key: '/users', label: '用户管理' },
  { key: '/roles', label: '角色管理' }
];

export const PERMISSION_OPTIONS = [
  { code: 'booking:create', label: '创建预约' },
  { code: 'booking:read', label: '查看预约' },
  { code: 'booking:update', label: '编辑预约' },
  { code: 'booking:delete', label: '删除预约' },
  { code: 'booking:assign', label: '分配实验员' },
  { code: 'booking:export', label: '导出预约' },
  { code: 'analytics:read', label: '查看统计' },
  { code: 'experimenter:read', label: '查看实验员' },
  { code: 'experimenter:manage', label: '管理实验员' },
  { code: 'seq-type:manage', label: '管理测序类型' },
  { code: 'user:manage', label: '管理用户' },
  { code: 'role:manage', label: '管理角色' }
];

export const INTERFACE_PERMISSION_MAP = [
  { method: 'GET', path: '/api/bookings', permission: 'booking:read' },
  { method: 'POST', path: '/api/bookings', permission: 'booking:create' },
  { method: 'PUT', path: '/api/bookings/:id', permission: 'booking:update' },
  { method: 'PUT', path: '/api/bookings/:id (assign experimenter)', permission: 'booking:assign' },
  { method: 'POST', path: '/api/bookings/reassign-experimenter', permission: 'booking:assign' },
  { method: 'DELETE', path: '/api/bookings/:id', permission: 'booking:delete' },
  { method: 'GET', path: '/api/export/bookings.xlsx', permission: 'booking:export' },
  { method: 'GET', path: '/api/analytics', permission: 'analytics:read' },
  { method: 'GET', path: '/api/experimenters', permission: 'experimenter:read' },
  { method: 'POST', path: '/api/experimenters', permission: 'experimenter:manage' },
  { method: 'PUT', path: '/api/experimenters/:id', permission: 'experimenter:manage' },
  { method: 'DELETE', path: '/api/experimenters/:id', permission: 'experimenter:manage' },
  { method: 'GET', path: '/api/users', permission: 'user:manage' },
  { method: 'POST', path: '/api/users', permission: 'user:manage' },
  { method: 'PUT', path: '/api/users/:id', permission: 'user:manage' },
  { method: 'PUT', path: '/api/users/:id/reset-password', permission: 'user:manage' },
  { method: 'DELETE', path: '/api/users/:id', permission: 'user:manage' },
  { method: 'GET', path: '/api/roles/meta', permission: 'role:manage' },
  { method: 'GET', path: '/api/roles', permission: 'role:manage' },
  { method: 'POST', path: '/api/roles', permission: 'role:manage' },
  { method: 'PUT', path: '/api/roles/:id', permission: 'role:manage' },
  { method: 'DELETE', path: '/api/roles/:id', permission: 'role:manage' },
  { method: 'GET', path: '/api/calendar/summary', permission: 'booking:read' },
  { method: 'GET', path: '/api/calendar/day', permission: 'booking:read' },
  { method: 'GET', path: '/api/seq-types', permission: 'booking:read' },
  { method: 'POST', path: '/api/seq-types', permission: 'seq-type:manage' },
  { method: 'DELETE', path: '/api/seq-types/:id', permission: 'seq-type:manage' }
];

const LEGACY_ROLE_ACCESS = {
  admin: {
    permissions: ['*'],
    menus: MENU_OPTIONS.map((m) => m.key)
  },
  user: {
    permissions: [
      'booking:create',
      'booking:update',
      'booking:read',
      'booking:export',
      'analytics:read',
      'experimenter:read'
    ],
    menus: ['/new', '/records', '/dashboard', '/analytics']
  }
};

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getLegacyAccess(role) {
  return LEGACY_ROLE_ACCESS[role] || LEGACY_ROLE_ACCESS.user;
}
