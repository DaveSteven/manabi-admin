import type { ReactNode } from 'react';
import { InboxOutlined, WarningOutlined } from '@ant-design/icons';

export type StateBlockTone = 'empty' | 'error';

export interface StateBlockProps {
  tone?: StateBlockTone;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function StateBlock({ tone = 'empty', icon, title, description, action }: StateBlockProps) {
  const fallbackIcon = tone === 'error' ? <WarningOutlined /> : <InboxOutlined />;
  return (
    <div className={`state-block state-block--${tone}`}>
      <div className="state-block__icon">{icon ?? fallbackIcon}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="state-block__action">{action}</div>}
    </div>
  );
}
