import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Typography, message } from 'antd';
import { api } from '../api';

export function PmOwnersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.listPmOwners();
      setItems(r.items || []);
    } catch (e) {
      message.error(e?.message || '加载 PM 负责人失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">PM配置</Typography.Title>
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
          新增PM负责人
        </Button>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          loading={loading}
          pagination={false}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 180 },
            { title: '邮箱', dataIndex: 'email', width: 260 },
            { title: '启用', dataIndex: 'isActive', width: 100, render: (v) => (v ? '是' : '否') },
            {
              title: '操作',
              width: 170,
              render: (_, r) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(r);
                      form.setFieldsValue({ ...r, isActive: !!r.isActive });
                      setOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除该PM负责人？"
                    onConfirm={async () => {
                      try {
                        await api.deletePmOwner(r.id);
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

      <Modal
        title={editing ? '编辑PM负责人' : '新增PM负责人'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const payload = {
                name: values.name,
                email: values.email || null,
                isActive: values.isActive !== false
              };
              if (editing?.id) await api.updatePmOwner(editing.id, payload);
              else await api.createPmOwner(payload);
              message.success(editing?.id ? '已更新' : '已创建');
              setOpen(false);
              await load();
            } catch (e) {
              message.error(e?.message || '保存失败');
            }
          }}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '必填' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
