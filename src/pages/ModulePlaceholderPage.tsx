import type { ReactNode } from 'react';
import { Button } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';

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
      <StateBlock
        icon={icon}
        title="模块框架已准备"
        description={`真实数据接口将在${phase}接入。当前页面不会展示模拟数据。`}
        action={<StatusTag tone="brand" label={phase} />}
      />
    </div>
  );
}
