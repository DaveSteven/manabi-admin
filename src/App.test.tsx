import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { api } from './lib/api';
import { tokenStorage } from './lib/storage';
import type { AdminUser } from './types/auth';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const ADMIN_USER: AdminUser = { id: 'u1', username: 'admin', level: 'N1', is_guest: false, is_admin: true };

function ok(config: InternalAxiosRequestConfig, status: number, data: unknown = null) {
  return { data, status, statusText: 'OK', headers: {}, config };
}

function mockViewport(matchesFor: (query: string) => boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matchesFor(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

function renderAdminApp(initialEntries: string[]) {
  tokenStorage.set('valid-token');
  api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    if (url.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
    if (url.endsWith('/auth/logout')) return Promise.resolve(ok(config, 204));
    throw new Error(`unexpected request: ${url}`);
  }) as AxiosAdapter;

  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('A04 后台布局和导航', () => {
  it('侧栏所有菜单入口都能导航到对应页面', async () => {
    renderAdminApp(['/']);
    expect(await screen.findByText(/你好，admin/)).toBeInTheDocument();

    const user = userEvent.setup();
    const entries: [string, string][] = [
      ['用户管理', '用户管理'],
      ['真题管理', '真题管理'],
      ['内容审核', '内容审核'],
      ['媒体资源', '媒体资源'],
      ['操作记录', '操作记录'],
    ];
    for (const [menu, heading] of entries) {
      await user.click(screen.getByRole('menuitem', { name: new RegExp(menu) }));
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('menuitem', { name: /工作台/ }));
    expect(await screen.findByText(/你好，admin/)).toBeInTheDocument();
  });

  it('直接访问子页面时对应菜单保持高亮', async () => {
    renderAdminApp(['/exams']);

    const item = await screen.findByRole('menuitem', { name: /真题管理/ });
    expect(item).toHaveClass('ant-menu-item-selected');
  });

  it('未知路由显示 404 页面，且不误高亮工作台', async () => {
    renderAdminApp(['/does-not-exist']);

    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /工作台/ })).not.toHaveClass('ant-menu-item-selected');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '返回工作台' }));
    expect(await screen.findByText(/你好，admin/)).toBeInTheDocument();
  });

  it('导航折叠按钮可以切换侧栏折叠状态', async () => {
    renderAdminApp(['/']);
    await screen.findByText(/你好，admin/);

    const sider = document.querySelector('.ant-layout-sider');
    expect(sider).not.toHaveClass('ant-layout-sider-collapsed');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '折叠导航' }));

    expect(sider).toHaveClass('ant-layout-sider-collapsed');
    expect(screen.getByRole('button', { name: '展开导航' })).toBeInTheDocument();
  });

  it('顶部管理员菜单可以退出登录', async () => {
    renderAdminApp(['/']);
    await screen.findByText(/你好，admin/);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /admin/ }));
    await user.click(await screen.findByText('退出登录'));

    expect(await screen.findByText('登录管理后台')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  it('相似前缀的未知地址显示 404 且不高亮对应菜单', async () => {
    renderAdminApp(['/users-unknown']);

    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /用户管理/ })).not.toHaveClass('ant-menu-item-selected');
  });

  it('手机宽度使用覆盖式导航，不压缩正文，选中菜单后关闭并可再次打开', async () => {
    const restore = mockViewport((query) => query.includes('767.98'));
    try {
      renderAdminApp(['/']);
      await screen.findByText(/你好，admin/);

      expect(document.querySelector('.ant-layout-sider')).not.toBeInTheDocument();

      const user = userEvent.setup();
      const drawer = () => document.querySelector('.ant-drawer') as HTMLElement | null;

      await user.click(screen.getByRole('button', { name: '打开导航' }));
      await waitFor(() => expect(drawer()).toHaveClass('ant-drawer-open'));

      await user.click(within(drawer() as HTMLElement).getByRole('menuitem', { name: /用户管理/ }));
      expect(await screen.findByRole('heading', { name: '用户管理' })).toBeInTheDocument();

      await waitFor(() => expect(drawer()).not.toHaveClass('ant-drawer-open'));

      await user.click(screen.getByRole('button', { name: '打开导航' }));
      await waitFor(() => expect(drawer()).toHaveClass('ant-drawer-open'));
      expect(within(drawer() as HTMLElement).getByText('工作台')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('平板宽度保留侧栏并自动折叠', async () => {
    const restore = mockViewport((query) => query.includes('991.98'));
    try {
      renderAdminApp(['/']);
      await screen.findByText(/你好，admin/);
      await waitFor(() => {
        expect(document.querySelector('.ant-layout-sider')).toHaveClass('ant-layout-sider-collapsed');
      });
      expect(screen.getByRole('button', { name: '展开导航' })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
