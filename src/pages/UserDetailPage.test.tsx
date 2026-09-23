import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { UserDetailPage } from './UserDetailPage';
import { api } from '../lib/api';
import type { AdminUserDetail, AdminUserStats } from '../types/users';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

const DETAIL: AdminUserDetail = {
  id: 'u1',
  username: 'alice',
  display_name: 'Alice',
  level: 'N2',
  status: 'active',
  is_admin: false,
  created_at: '2026-01-02T03:04:05Z',
  last_login_at: '2026-02-03T04:05:06Z',
};

const STATS: AdminUserStats = {
  practices: 4,
  answered: 4,
  correct: 3,
  accuracy: 0.75,
  wrong_questions: 1,
  levels: [{ level: 'N2', practices: 4, answered: 4, correct: 3, accuracy: 0.75, wrong_questions: 1 }],
};

function isStats(config: InternalAxiosRequestConfig) {
  return (config.url ?? '').endsWith('/stats');
}

function renderPage(path = '/users/u1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/users/:userId" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

describe('B05 用户详情', () => {
  it('渲染用户资料、学习摘要与各等级数据', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();

    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('正常')).toBeInTheDocument();
    expect(screen.getByText('普通用户')).toBeInTheDocument();
    expect(screen.getAllByText('练习次数').length).toBeGreaterThan(0);
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getAllByText('错题数量').length).toBeGreaterThan(0);
  });

  it('无练习数据时展示零值和空状态', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) {
        return Promise.resolve(ok(config, { practices: 0, answered: 0, correct: 0, accuracy: 0, wrong_questions: 0, levels: [] }));
      }
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();

    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument();
    expect(await screen.findByText('暂无学习数据')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('用户不存在时展示 404 状态并可返回列表', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.reject({ isAxiosError: true, config, response: { status: 404, data: { detail: 'User not found' } } });
    }) as AxiosAdapter;

    renderPage('/users/missing');

    expect(await screen.findByText('用户不存在')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回用户列表/ })).toBeInTheDocument();
  });

  it('学习摘要加载失败时可重试成功', async () => {
    let statsAttempts = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) {
        statsAttempts += 1;
        if (statsAttempts === 1) {
          return Promise.reject({ isAxiosError: true, config, response: { status: 500, data: {} } });
        }
        return Promise.resolve(ok(config, STATS));
      }
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    expect(await screen.findByText('学习摘要加载失败')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重\s*试/ }));

    expect(await screen.findByText('75.0%')).toBeInTheDocument();
  }, 15_000);
});
