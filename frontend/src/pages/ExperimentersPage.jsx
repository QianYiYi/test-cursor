import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message } from 'antd';
import { api } from '../api';

const notifyOptions = ['微信', '邮件', '手机号码', 'Teams', '其他'].map((v) => ({ label: v, value: v }));

function normalizePayload(values) {
  return {
    name: values.name,
    notifyMethods: values.notifyMethods || [],
    email: values.email || null,
    phone: values.phone || null,
    teamsId: values.teamsId || null,
    wechatId: values.wechatId || null,
    otherContact: values.otherContact || null,
    isActive: values.isActive !== false
  };
}

export function ExperimentersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.listExperimenters();
      setItems(r.items || []);
    } catch (e) {
      message.error(e?.message || '加载实验员失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">实验员配置</Typography.Title>

      <Card style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ isActive: true, notifyMethods: ['邮件', '手机号码'] });
            setOpen(true);
          }}
        >
          新增实验员
        </Button>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          loading={loading}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 120 },
            { title: '通知方式', dataIndex: 'notifyMethods', width: 220, render: (v) => (Array.isArray(v) ? v.join(', ') : '') },
            { title: '邮箱', dataIndex: 'email', width: 180 },
            { title: '手机号码', dataIndex: 'phone', width: 140 },
            { title: 'Teams', dataIndex: 'teamsId', width: 160 },
            { title: '微信', dataIndex: 'wechatId', width: 140 },
            { title: '其他', dataIndex: 'otherContact', width: 180 },
            { title: '启用', dataIndex: 'isActive', width: 80, render: (v) => (v ? '是' : '否') },
            {
              title: '操作',
              key: 'actions',
              fixed: 'right',
              width: 170,
              render: (_, r) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(r);
                      form.setFieldsValue({
                        ...r,
                        notifyMethods: Array.isArray(r.notifyMethods) ? r.notifyMethods : []
                      });
                      setOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除该实验员？"
                    onConfirm={async () => {
                      try {
                        await api.deleteExperimenter(r.id);
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
          scroll={{ x: 1500 }}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? '编辑实验员' : '新增实验员'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const payload = normalizePayload(values);
            try {
              if (editing?.id) await api.updateExperimenter(editing.id, payload);
              else await api.createExperimenter(payload);
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
          <Form.Item name="notifyMethods" label="默认通知方式">
            <Select mode="multiple" allowClear options={notifyOptions} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号码">
            <Input />
          </Form.Item>
          <Form.Item name="teamsId" label="Teams">
            <Input />
          </Form.Item>
          <Form.Item name="wechatId" label="微信">
            <Input />
          </Form.Item>
          <Form.Item name="otherContact" label="其他联系方式">
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
