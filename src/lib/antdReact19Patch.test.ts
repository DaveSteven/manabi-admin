import { describe, expect, it, vi } from 'vitest';

const { setRender } = vi.hoisted(() => ({ setRender: vi.fn() }));

vi.mock('antd', () => ({
  unstableSetRender: (render: unknown) => {
    setRender(render);
    return render;
  },
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })),
}));

import { patchAntdForReact19 } from './antdReact19Patch';

describe('patchAntdForReact19', () => {
  it('向 antd 注入 React 19 兼容渲染器并返回卸载函数', async () => {
    patchAntdForReact19();

    expect(setRender).toHaveBeenCalledTimes(1);
    const render = setRender.mock.calls[0][0] as (node: unknown, container: Element) => () => Promise<void>;
    const container = document.createElement('div');
    const unmount = render(null, container);

    expect(typeof unmount).toBe('function');
    expect(await unmount()).toBeUndefined();
  });
});
