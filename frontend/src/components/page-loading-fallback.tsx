import React from 'react';
import { Spin } from 'antd';

export function PageLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center p-12">
      <Spin size="large" />
    </div>
  );
}
