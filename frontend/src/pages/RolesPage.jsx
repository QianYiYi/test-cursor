import React, { useEffect, useState } from 'react';
import { Button, Card, Collapse, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message } from 'antd';
import { api } from '../api';

export function RolesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ permissionOptions: [], menuOptions: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [roles, m] = await Promise.all([api.listRoles(), api.roleMeta()]);
      setItems(roles.items || []);
      setMeta(m || { permissionOptions: [], menuOptions: [] });
    } catch (e) {
      message.error(e?.message || '加载角色失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">角色管理</Typography.Title>
      <Card style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ isActive: true, permissions: [], menus: [] });
            setOpen(true);
          }}
        >
          新增角色
        </Button>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Table
          rowKey="id"
          dataSource={items}
          loading={loading}
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name', width: 140 },
            { title: '编码', dataIndex: 'code', width: 140 },
            { title: '描述', dataIndex: 'description', width: 220 },
            { title: '权限码', dataIndex: 'permissions', render: (v) => (Array.isArray(v) ? v.join(', ') : '') },
            { title: '菜单', dataIndex: 'menus', render: (v) => (Array.isArray(v) ? v.join(', ') : '') },
            { title: '启用', dataIndex: 'isActive', width: 80, render: (v) => (v ? '是' : '否') },
            {
              title: '操作',
              width: 170,
              render: (_, r) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(r);
                      form.setFieldsValue({ ...r, permissions: r.permissions || [], menus: r.menus || [] });
                      setOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除该角色？"
                    onConfirm={async () => {
                      try {
                        await api.deleteRole(r.id);
                        message.success('已删除');
                        await load();
                      } catch (e) {
                        message.error(e?.message || '删除失败');
                      }
                    }}
                  >
                    <Button danger size="small">删除</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Collapse
        style={{ marginBottom: 12 }}
        defaultActiveKey={[]}
        items={[
          {
            key: 'interface-permission-map',
            label: '接口权限映射清单',
            children: (
              <Table
                rowKey={(r) => `${r.method}-${r.path}`}
                dataSource={meta.interfacePermissionMap || []}
                pagination={false}
                size="small"
                columns={[
                  { title: 'Method', dataIndex: 'method', width: 100 },
                  { title: '接口路径', dataIndex: 'path' },
                  { title: '权限码', dataIndex: 'permission', width: 220 }
                ]}
              />
            )
          }
        ]}
      />
      <Modal
        title={editing ? '编辑角色' : '新增角色'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              if (editing?.id) await api.updateRole(editing.id, values);
              else await api.createRole(values);
              message.success(editing?.id ? '已更新' : '已创建');
              setOpen(false);
              await load();
            } catch (e) {
              message.error(e?.message || '保存失败');
            }
          }}
        >
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '必填' }]}><Input /></Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: '必填' }]}><Input placeholder="如 operator" disabled={Boolean(editing)} /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="permissions" label="接口权限">
            <Select mode="multiple" options={(meta.permissionOptions || []).map((i) => ({ value: i.code, label: `${i.code} (${i.label})` }))} />
          </Form.Item>
          <Form.Item name="menus" label="菜单权限">
            <Select mode="multiple" options={(meta.menuOptions || []).map((i) => ({ value: i.key, label: `${i.key} (${i.label})` }))} />
          </Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
