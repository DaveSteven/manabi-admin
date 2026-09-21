import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { LoginPage } from '../pages/LoginPage';
import { api } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import type { AdminUser, LoginResponse } from '../types/auth';
import { ProtectedRoute } from './ProtectedRoute';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const ADMIN_USER: AdminUser = { id: 'u1', username: 'admin', level: 'N1', is_guest: false, is_admin: true };

function ok(config: InternalAxiosRequestConfig, status: number, data: unknown = null) {
  return { data, status, statusText: 'OK', headers: {}, config };
}

function httpError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, {
    data: { detail: 'error' },
    status,
    statusText: 'Error',
    headers: {},
    config,
  });
}

function bearerOf(config: InternalAxiosRequestConfig | undefined): string | undefined {
  const headers = config?.headers;
  const normalized = typeof headers?.get === 'function' ? headers.get('Authorization') : undefined;
  const raw = normalized ?? headers?.Authorization;
  return typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : undefined;
}

function loginResponse(token: string): LoginResponse {
  return { access_token: token, token_type: 'bearer', expires_at: '2099-01-01T00:00:00Z', user: ADMIN_USER };
}

function UsersPage() {
  const { logout } = useAuth();
  return (
    <div>
      <span>用户管理页面</span>
      <button onClick={() => void logout()}>触发退出</button>
    </div>
  );
}

function renderApp(initialEntries: string[]) {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/" element={<div>工作台页面</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('会话恢复和自动退出', () => {
  it('刷新受保护页面会显示全屏加载并恢复管理员会话', async () => {
    tokenStorage.set('valid-token');
    let resolveMe: (() => void) | undefined;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      new Promise((resolve) => {
        resolveMe = () => resolve(ok(config, 200, ADMIN_USER));
      })) as AxiosAdapter;

    renderApp(['/users']);

    await waitFor(() => expect(resolveMe).toBeDefined());
    expect(document.querySelector('.app-loading')).toBeInTheDocument();

    await act(async () => {
      resolveMe?.();
    });

    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('valid-token');
  });

  it('失效 token 会清理本地会话并跳转到登录页', async () => {
    tokenStorage.set('expired-token');
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(httpError(config, 401))) as AxiosAdapter;

    renderApp(['/users']);

    expect(await screen.findByText('登录管理后台')).toBeInTheDocument();
    expect(screen.queryByText('用户管理页面')).not.toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  it('退出会调用 logout 接口、清理会话并使受保护页面不可访问', async () => {
    tokenStorage.set('valid-token');
    let logoutConfig: InternalAxiosRequestConfig | undefined;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      if (config.url?.endsWith('/auth/logout')) {
        logoutConfig = config;
        return Promise.resolve(ok(config, 204));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    renderApp(['/users']);
    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '触发退出' }));

    expect(await screen.findByText('登录管理后台')).toBeInTheDocument();
    expect(screen.queryByText('用户管理页面')).not.toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
    expect(logoutConfig?.url).toBe('/auth/logout');
    expect(bearerOf(logoutConfig)).toBe('valid-token');
  });

  it('登录成功后会跳回登录前访问的受保护页面', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/auth/login')) {
        return Promise.resolve(ok(config, 200, loginResponse('admin-token')));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    renderApp(['/users']);
    expect(await screen.findByText('登录管理后台')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('管理员账号'), 'admin');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('退出失败时会跳转登录页并显示待撤销重试提示', async () => {
    tokenStorage.set('valid-token');
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      if (config.url?.endsWith('/auth/logout')) return Promise.reject(httpError(config, 503));
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    renderApp(['/users']);
    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '触发退出' }));

    expect(await screen.findByText('登录管理后台')).toBeInTheDocument();
    expect(await screen.findByText('会话撤销未完成')).toBeInTheDocument();
    expect(screen.queryByText('用户管理页面')).not.toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });
});
