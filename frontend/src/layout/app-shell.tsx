import React from 'react';
import type { MenuProps } from 'antd';
import { Button, Layout, Menu, Typography } from 'antd';

const { Header, Content, Sider } = Layout;

export interface AppShellProps {
  authed: boolean;
  menuItems: MenuProps['items'];
  selectedMenuKey: string;
  onMenuClick: NonNullable<MenuProps['onClick']>;
  userName: string;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppShell({
  authed,
  menuItems,
  selectedMenuKey,
  onMenuClick,
  userName,
  onLogout,
  children
}: AppShellProps) {
  return (
    <Layout className="appShell">
      <Sider width={220} theme="dark" collapsed={!authed} collapsedWidth={0}>
        <div className="flex h-16 items-center px-4">
          <Typography.Title level={5} className="!mb-0 !leading-[64px] text-white">
            单细胞预约系统
          </Typography.Title>
        </div>
        <Menu theme="dark" mode="inline" items={menuItems} selectedKeys={[selectedMenuKey]} onClick={onMenuClick} />
      </Sider>
      <Layout>
        <Header className="border-b border-white/10 bg-white/[0.06] px-4 leading-[64px]">
          <div className="flex h-full items-center justify-between">
            <div />
            {authed ? (
              <div className="flex items-center gap-2.5">
                <Typography.Text className="text-black">登录名称：{userName}</Typography.Text>
                <Button size="small" onClick={onLogout}>
                  退出
                </Button>
              </div>
            ) : null}
          </div>
        </Header>
        <Content className="contentWrap">{children}</Content>
      </Layout>
    </Layout>
  );
}
