import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { UsersPage } from './UsersPage';
import { api } from '../lib/api';
import type { AdminUserListItem, AdminUsersResponse } from '../types/users';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function item(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id: 'u1',
    username: 'alice',
    display_name: 'Alice',
    level: 'N2',
    status: 'active',
    is_admin: false,
    created_at: '2026-01-02T03:04:05Z',
    last_login_at: '2026-02-03T04:05:06Z',
    ...overrides,
  };
}

function page(overrides: Partial<AdminUsersResponse> = {}): AdminUsersResponse {
  return { items: [], total: 0, limit: 20, offset: 0, ...overrides };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntries: string[] = ['/users']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <UsersPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

describe('B03 用户列表', () => {
  it('渲染真实接口返回的用户字段与状态标签', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page({
      items: [
        item({ id: 'u1', username: 'alice', display_name: 'Alice', status: 'active' }),
        item({ id: 'u2', username: 'bob', display_name: null, status: 'disabled', is_admin: true }),
      ],
      total: 2,
    })))) as AxiosAdapter;

    renderPage();

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('正常')).toBeInTheDocument();
    expect(screen.getByText('已禁用')).toBeInTheDocument();
    expect(screen.getByText('普通用户')).toBeInTheDocument();
  });

  it('关键词搜索会更新 URL 参数并重新请求', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByText('alice');

    const input = screen.getByPlaceholderText('搜索用户名或显示名称');
    const user = userEvent.setup();
    await user.type(input, 'alice');
    await user.click(screen.getByRole('button', { name: /搜\s*索/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('keyword=alice');
    });
    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ keyword: 'alice', offset: 0 });
    });
  });

  it('从 URL 恢复等级、状态和角色筛选', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage(['/users?level=N1&status=disabled&is_admin=true&offset=20&limit=10']);

    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ level: 'N1', status: 'disabled', is_admin: true, offset: 20, limit: 10 });
    });
  });

  it('无数据时显示空状态', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page()))) as AxiosAdapter;

    renderPage(['/users']);
    expect(await screen.findByText('暂无用户')).toBeInTheDocument();
  });

  it('筛选无结果时提供清除入口', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page()))) as AxiosAdapter;

    renderPage(['/users?keyword=zzz']);
    expect(await screen.findByText('没有符合条件的用户')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '清除筛选' }).length).toBeGreaterThan(0);
  });

  it('请求失败显示错误状态并可重试成功', async () => {
    let attempt = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      attempt += 1;
      if (attempt === 1) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 500, data: {} } });
      }
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage();
    expect(await screen.findByText('用户列表加载失败')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重试/ }));

    expect(await screen.findByText('alice')).toBeInTheDocument();
  });
});
