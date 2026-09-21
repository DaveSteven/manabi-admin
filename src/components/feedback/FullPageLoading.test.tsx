import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FullPageLoading } from './FullPageLoading';

describe('FullPageLoading', () => {
  it('以无障碍状态角色显示全屏加载与提示', () => {
    render(<FullPageLoading tip="正在加载内容…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('app-loading');
    expect(screen.getByText('正在加载内容…')).toBeInTheDocument();
  });

  it('图标与提示包裹在同一居中容器内', () => {
    const { container } = render(<FullPageLoading />);
    const inner = container.querySelector('.app-loading__inner');
    expect(inner).toBeInTheDocument();
    expect(inner?.querySelector('.ant-spin')).toBeInTheDocument();
    expect(inner?.querySelector('.app-loading__tip')).toBeInTheDocument();
    expect(screen.getByText('正在恢复会话…')).toBeInTheDocument();
  });
});
