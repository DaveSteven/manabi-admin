import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  it('按状态代码渲染中文标签', () => {
    render(<StatusTag status="ready" />);
    expect(screen.getByText('已发布')).toHaveClass('status-tag');
  });

  it('用户与草稿状态映射为中文', () => {
    render(
      <>
        <StatusTag status="disabled" />
        <StatusTag status="draft" />
      </>,
    );
    expect(screen.getByText('已禁用')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
  });

  it('显式 label 与 tone 优先于状态映射', () => {
    render(<StatusTag status="ready" label="阶段 2" tone="brand" />);
    expect(screen.getByText('阶段 2')).toBeInTheDocument();
  });

  it('未知状态回退为原始文本', () => {
    render(<StatusTag status="mystery" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});
