import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, setAuthToken } from '../api';
import { setCurrentUser } from '../auth';

export function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto mt-10 max-w-md">
      <Typography.Title level={3} className="text-white">
        登录
      </Typography.Title>
      <Card>
        <Form
          layout="vertical"
          onFinish={async (values: { email: string; password: string }) => {
            try {
              setLoading(true);
              const r = await api.login(values);
              setAuthToken(r.token);
              setCurrentUser(r.user);
              message.success('登录成功');
              nav('/records');
            } catch (e) {
              message.error(e instanceof Error ? e.message : '登录失败');
            } finally {
              setLoading(false);
            }
          }}
          initialValues={{ email: 'admin@example.com', password: 'admin1234' }}
        >
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '必填' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
