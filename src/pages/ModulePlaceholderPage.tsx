import type { ReactNode } from 'react';
import { Button, Empty } from 'antd';
import { PageHeader } from '../components/PageHeader';

export function ModulePlaceholderPage({ eyebrow, title, description, icon, phase }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  phase: string;
}) {
  return (
    <div className="page">
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={<Button disabled>新建</Button>} />
      <div className="module-placeholder">
        <div className="module-placeholder__icon">{icon}</div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
        <h2>模块框架已准备</h2>
        <p>真实数据接口将在{phase}接入。当前页面不会展示模拟数据。</p>
        <span>{phase}</span>
      </div>
    </div>
  );
}
