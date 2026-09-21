import { Spin } from 'antd';

export function FullPageLoading({ tip = '正在恢复会话…' }: { tip?: string }) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="app-loading__inner">
        <Spin size="large" />
        <span className="app-loading__tip">{tip}</span>
      </div>
    </div>
  );
}
