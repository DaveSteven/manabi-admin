import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { StateBlock } from './StateBlock';

describe('StateBlock', () => {
  it('渲染标题、描述与操作', () => {
    render(
      <StateBlock
        title="模块框架已准备"
        description="真实数据接口将在阶段 2 接入。"
        action={<Button>返回工作台</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: '模块框架已准备' })).toBeInTheDocument();
    expect(screen.getByText('真实数据接口将在阶段 2 接入。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeInTheDocument();
  });

  it('错误态使用 error 修饰类与警告图标', () => {
    const { container } = render(<StateBlock tone="error" title="加载失败" />);
    expect(container.querySelector('.state-block--error')).toBeInTheDocument();
    expect(container.querySelector('.anticon-warning')).toBeInTheDocument();
  });
});
