import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
