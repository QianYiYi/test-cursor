import React, { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message } from 'antd';
import { api } from '../api';

export function UsersPage() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [experimenters, setExperimenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUser, setTransferUser] = useState(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const openTransferModal = (user) => {
    setTransferUser(user);
    transferForm.resetFields();
    setTransferOpen(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [users, roleResp, expResp] = await Promise.all([api.listUsers(), api.listRoles(), api.listExperimenters()]);
      setItems(users.items || []);
      setRoles((roleResp.items || []).filter((r) => r.isActive));
      setExperimenters((expResp.items || []).filter((e) => e.isActive));
    } catch (e) {
      message.error(e?.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedRoleId = Form.useWatch('roleId', form);
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isTechnicianRole = selectedRole?.code === 'technician';

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">用户管理</Typography.Title>
      <Card style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ isActive: true });
            setOpen(true);
          }}
        >
          新增用户
        </Button>
      </Card>
      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          loading={loading}
          pagination={false}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 120 },
            { title: '邮箱', dataIndex: 'email', width: 200 },
            { title: '角色', dataIndex: 'roleName', width: 140, render: (_, r) => r.roleName || r.roleCode || r.role },
            {
              title: '状态',
              width: 110,
              render: (_, r) => (r.isDeleted ? '已删除' : (r.isActive ? '启用' : '禁用'))
            },
            {
              title: '操作',
              width: 420,
              render: (_, r) => (
                <Space>
                  {!r.isDeleted && r.isActive ? (
                    <Popconfirm
                      title="确定禁用该用户？"
                      onConfirm={async () => {
                        try {
                          await api.updateUser(r.id, { isActive: false });
                          message.success('已禁用');
                          await load();
                        } catch (e) {
                          message.error(e?.message || '禁用失败');
                        }
                      }}
                    >
                      <Button size="small">禁用</Button>
                    </Popconfirm>
                  ) : null}
                  {!r.isDeleted && !r.isActive ? (
                    <Popconfirm
                      title="确定恢复该用户？"
                      onConfirm={async () => {
                        try {
                          await api.updateUser(r.id, { isActive: true });
                          message.success('已恢复');
                          await load();
                        } catch (e) {
                          message.error(e?.message || '恢复失败');
                        }
                      }}
                    >
                      <Button size="small" type="primary" ghost>恢复</Button>
                    </Popconfirm>
                  ) : null}
                  {r.isDeleted ? (
                    <Popconfirm
                      title="确定恢复已删除账号？"
                      onConfirm={async () => {
                        try {
                          await api.restoreUser(r.id);
                          message.success('账号已恢复');
                          await load();
                        } catch (e) {
                          message.error(e?.message || '恢复失败');
                        }
                      }}
                    >
                      <Button size="small" type="primary">恢复账号</Button>
                    </Popconfirm>
                  ) : null}
                  <Button
                    size="small"
                    disabled={r.isDeleted}
                    onClick={() => {
                      setEditing(r);
                      form.setFieldsValue({ ...r, roleId: r.roleId, experimenterId: r.experimenterId ?? undefined, isActive: !!r.isActive });
                      setOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    disabled={r.isDeleted}
                    onClick={() => {
                      setPwdUser(r);
                      pwdForm.resetFields();
                      setPwdOpen(true);
                    }}
                  >
                    重置密码
                  </Button>
                  {r.roleCode === 'technician' && !r.isDeleted ? (
                    <Button
                      size="small"
                      onClick={() => openTransferModal(r)}
                    >
                      转移订单
                    </Button>
                  ) : null}
                  <Popconfirm
                    title="确定删除该用户？"
                    disabled={r.isDeleted}
                    onConfirm={async () => {
                      try {
                        await api.deleteUser(r.id);
                        message.success('已删除');
                        await load();
                      } catch (e) {
                        if (e?.data?.code === 'USER_HAS_ACTIVE_ORDERS') {
                          if (r.roleCode === 'technician') {
                            Modal.confirm({
                              title: '该技术员存在进行中业务',
                              content: '是否现在转移该技术员名下订单？转移后可继续删除/禁用。',
                              okText: '去转移订单',
                              cancelText: '取消',
                              onOk: async () => {
                                openTransferModal(r);
                              }
                            });
                          } else {
                            message.error('该用户存在进行中业务，无法删除，请先处理订单');
                          }
                        } else {
                          message.error(e?.message || '删除失败');
                        }
                      }
                    }}
                  >
                    <Button danger size="small" disabled={r.isDeleted}>删除</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              if (editing?.id) {
                await api.updateUser(editing.id, {
                  name: values.name,
                  email: values.email,
                  roleId: values.roleId,
                  experimenterId: values.experimenterId ?? null,
                  isActive: values.isActive
                });
              } else {
                await api.createUser(values);
              }
              message.success(editing?.id ? '已更新' : '已创建');
              setOpen(false);
              await load();
            } catch (e) {
              message.error(e?.message || '保存失败');
            }
          }}
        >
          {isTechnicianRole ? (
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '必填' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择实验员姓名"
                options={experimenters.map((e) => ({ value: e.name, label: e.name, email: e.email, id: e.id }))}
                onChange={(name) => {
                  const exp = experimenters.find((e) => e.name === name);
                  form.setFieldsValue({
                    experimenterId: exp?.id,
                    email: exp?.email || undefined
                  });
                }}
              />
            </Form.Item>
          ) : (
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '必填' }]}><Input /></Form.Item>
          )}
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '必填' }]} extra={isTechnicianRole ? '技术员账号邮箱与实验员档案一致，不可在此修改。' : undefined}>
            <Input disabled={isTechnicianRole} />
          </Form.Item>
          {!editing ? (
            <Form.Item name="password" label="初始密码" rules={[{ required: true, message: '必填' }, { min: 6, message: '至少6位' }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '必填' }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))} />
          </Form.Item>
          <Form.Item name="experimenterId" hidden><Input /></Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${pwdUser?.name || ''}`}
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={() => pwdForm.submit()}
      >
        <Form
          form={pwdForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await api.resetUserPassword(pwdUser.id, values.newPassword);
              message.success('密码已重置');
              setPwdOpen(false);
            } catch (e) {
              message.error(e?.message || '重置失败');
            }
          }}
        >
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '必填' }, { min: 6, message: '至少6位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`批量转移订单 - ${transferUser?.name || ''}`}
        open={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={() => transferForm.submit()}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await api.reassignExperimenter({
                fromExperimenter: transferUser?.experimenterName || transferUser?.name,
                toExperimenter: values.toExperimenter,
                includeDone: !!values.includeDone
              });
              message.success('订单转移完成');
              setTransferOpen(false);
            } catch (e) {
              message.error(e?.message || '转移失败');
            }
          }}
        >
          <Form.Item label="原实验员">
            <Input disabled value={transferUser?.experimenterName || transferUser?.name || ''} />
          </Form.Item>
          <Form.Item name="toExperimenter" label="目标实验员" rules={[{ required: true, message: '请选择目标实验员' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={experimenters
                .filter((e) => e.name !== (transferUser?.experimenterName || transferUser?.name))
                .map((e) => ({ value: e.name, label: e.name }))}
            />
          </Form.Item>
          <Form.Item name="includeDone" valuePropName="checked">
            <Checkbox>包含已完成订单（默认仅转移待完成/进行中）</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
