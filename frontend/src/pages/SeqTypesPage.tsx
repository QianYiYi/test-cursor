import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Popconfirm, Space, Table, Typography, message } from 'antd';
import { api } from '../api';

export function SeqTypesPage() {
  const [seqCustom, setSeqCustom] = useState<Array<{ id: number; name: string }>>([]);
  const [seqLoading, setSeqLoading] = useState(false);
  const [newSeqName, setNewSeqName] = useState('');

  const loadSeqTypes = async () => {
    setSeqLoading(true);
    try {
      const r = await api.listSeqTypes();
      setSeqCustom(Array.isArray(r.custom) ? r.custom : []);
    } catch (e) {
      message.error(e?.message || '加载测序类型失败');
      setSeqCustom([]);
    } finally {
      setSeqLoading(false);
    }
  };

  useEffect(() => {
    loadSeqTypes();
  }, []);

  return (
    <div>
      <Typography.Title level={3} className="pageTitle">测序类型配置</Typography.Title>

      <Card loading={seqLoading}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            placeholder="新测序类型名称"
            value={newSeqName}
            onChange={(e) => setNewSeqName(e.target.value)}
            style={{ width: 260 }}
            onPressEnter={async () => {
              const name = newSeqName.trim();
              if (!name) return;
              try {
                await api.createSeqType({ name });
                message.success('已添加');
                setNewSeqName('');
                await loadSeqTypes();
              } catch (e) {
                message.error(e?.message || '添加失败');
              }
            }}
          />
          <Button
            type="primary"
            onClick={async () => {
              const name = newSeqName.trim();
              if (!name) {
                message.warning('请输入名称');
                return;
              }
              try {
                await api.createSeqType({ name });
                message.success('已添加');
                setNewSeqName('');
                await loadSeqTypes();
              } catch (e) {
                message.error(e?.message || '添加失败');
              }
            }}
          >
            添加
          </Button>
        </Space>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={seqCustom}
          columns={[
            { title: '名称', dataIndex: 'name' },
            {
              title: '操作',
              key: 'act',
              width: 100,
              render: (_, r) => (
                <Popconfirm
                  title="确定删除该测序类型？"
                  onConfirm={async () => {
                    try {
                      await api.deleteSeqType(r.id);
                      message.success('已删除');
                      await loadSeqTypes();
                    } catch (e) {
                      message.error(e?.message || '删除失败');
                    }
                  }}
                >
                  <Button danger size="small" type="link">
                    删除
                  </Button>
                </Popconfirm>
              )
            }
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          内置测序类型不可在此删除；删除自定义类型后，已存在订单中的名称仍保留，新单需选择有效类型。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
