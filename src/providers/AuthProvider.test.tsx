import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { AuthProvider, useAuth } from './AuthProvider';
import { AdminAccessRequiredError } from '../lib/errors';
import { authService } from '../services/auth';
import { api } from '../lib/api';
import { pendingRevocationStorage, tokenStorage } from '../lib/storage';
import type { AdminUser, LoginResponse } from '../types/auth';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const ADMIN_USER: AdminUser = { id: 'u1', username: 'admin', level: 'N1', is_guest: false, is_admin: true };
const NORMAL_USER: AdminUser = { id: 'u2', username: 'learner', level: 'N3', is_guest: false, is_admin: false };

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

function tokenResponse(user: AdminUser, token: string): LoginResponse {
  return { access_token: token, token_type: 'bearer', expires_at: '2099-01-01T00:00:00Z', user };
}

describe('AuthProvider 撤销重试与会话隔离', () => {
  it('旧 token 撤销 401 发生在管理员登录后，仍保留管理员会话', async () => {
    let loginCalls = 0;
    let logoutCalls = 0;

    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? '';
      if (url.endsWith('/auth/login')) {
        loginCalls += 1;
        return loginCalls === 1
          ? ok(config, 200, tokenResponse(NORMAL_USER, 'normal-token'))
          : ok(config, 200, tokenResponse(ADMIN_USER, 'admin-token'));
      }
      if (url.endsWith('/auth/logout')) {
        logoutCalls += 1;
        // 首次撤销失败；重试时旧 token 已失效返回 401。
        throw httpError(config, logoutCalls === 1 ? 503 : 401);
      }
      throw new Error(`unexpected request: ${url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(result.current.login({ username: 'learner', password: 'password123' }))
        .rejects.toBeInstanceOf(AdminAccessRequiredError);
    });
    expect(result.current.pendingRevocations).toBe(1);
    expect(pendingRevocationStorage.list()).toEqual(['normal-token']);
    expect(result.current.user).toBeNull();

    await act(async () => {
      await result.current.login({ username: 'admin', password: 'password123' });
    });
    expect(result.current.user?.is_admin).toBe(true);
    expect(tokenStorage.get()).toBe('admin-token');

    let allRevoked = false;
    await act(async () => {
      allRevoked = await result.current.retryPendingRevocations();
    });

    expect(allRevoked).toBe(true);
    expect(logoutCalls).toBe(2);
    expect(tokenStorage.get()).toBe('admin-token');
    expect(result.current.user?.username).toBe('admin');
    expect(result.current.pendingRevocations).toBe(0);
    expect(pendingRevocationStorage.list()).toEqual([]);
  });
});

describe('A03 会话恢复时效性', () => {
  it('恢复中会话被清除后，迟到的 /me 成功不会恢复页面', async () => {
    tokenStorage.set('old-token');
    let releaseMe: (() => void) | undefined;
    let meCalls = 0;

    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) {
        meCalls += 1;
        if (meCalls === 1) {
          return new Promise((resolve) => {
            releaseMe = () => resolve(ok(config, 200, ADMIN_USER));
          });
        }
        return Promise.reject(httpError(config, 401));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(releaseMe).toBeDefined());

    await act(async () => {
      await expect(authService.me()).rejects.toBeTruthy();
    });
    expect(tokenStorage.get()).toBeNull();
    expect(result.current.user).toBeNull();

    await act(async () => {
      releaseMe?.();
    });
    expect(result.current.user).toBeNull();
    expect(tokenStorage.get()).toBeNull();
  });

  it('新会话建立后，旧恢复请求成功不会覆盖新会话', async () => {
    tokenStorage.set('old-token');
    let releaseMe: (() => void) | undefined;
    const oldAdmin: AdminUser = { ...ADMIN_USER, id: 'old', username: 'oldadmin' };
    const newAdmin: AdminUser = { ...ADMIN_USER, id: 'new', username: 'newadmin' };

    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) {
        return new Promise((resolve) => {
          releaseMe = () => resolve(ok(config, 200, oldAdmin));
        });
      }
      if (config.url?.endsWith('/auth/login')) {
        return Promise.resolve(ok(config, 200, tokenResponse(newAdmin, 'new-token')));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(releaseMe).toBeDefined());

    await act(async () => {
      await result.current.login({ username: 'newadmin', password: 'password123' });
    });
    expect(result.current.user?.username).toBe('newadmin');
    expect(tokenStorage.get()).toBe('new-token');

    await act(async () => {
      releaseMe?.();
    });
    expect(result.current.user?.username).toBe('newadmin');
    expect(tokenStorage.get()).toBe('new-token');
  });

  it('新会话建立后，旧恢复请求失败不会清除新会话', async () => {
    tokenStorage.set('old-token');
    let failMe: (() => void) | undefined;
    const newAdmin: AdminUser = { ...ADMIN_USER, id: 'new', username: 'newadmin' };

    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) {
        return new Promise((_resolve, reject) => {
          failMe = () => reject(httpError(config, 401));
        });
      }
      if (config.url?.endsWith('/auth/login')) {
        return Promise.resolve(ok(config, 200, tokenResponse(newAdmin, 'new-token')));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(failMe).toBeDefined());

    await act(async () => {
      await result.current.login({ username: 'newadmin', password: 'password123' });
    });
    expect(tokenStorage.get()).toBe('new-token');

    await act(async () => {
      failMe?.();
    });
    expect(result.current.user?.username).toBe('newadmin');
    expect(tokenStorage.get()).toBe('new-token');
  });

  it('StrictMode 下会话恢复仍可用', async () => {
    tokenStorage.set('valid-token');
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <AuthProvider>{children}</AuthProvider>
      </StrictMode>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user?.username).toBe('admin'));
    expect(tokenStorage.get()).toBe('valid-token');
    expect(result.current.loading).toBe(false);
  });
});

describe('A03 主动退出失败处理', () => {
  it('退出 401 视为 token 已失效，不保留待撤销记录', async () => {
    tokenStorage.set('admin-token');
    let logoutCalls = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      if (config.url?.endsWith('/auth/logout')) {
        logoutCalls += 1;
        return Promise.reject(httpError(config, 401));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user?.username).toBe('admin'));

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutCalls).toBe(1);
    expect(tokenStorage.get()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.pendingRevocations).toBe(0);
    expect(pendingRevocationStorage.list()).toEqual([]);
  });

  it('退出 503 保留待撤销 token，重试成功且仍使用原 token', async () => {
    tokenStorage.set('admin-token');
    let logoutCalls = 0;
    const sentTokens: (string | undefined)[] = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      if (config.url?.endsWith('/auth/logout')) {
        logoutCalls += 1;
        sentTokens.push(bearerOf(config));
        if (logoutCalls === 1) return Promise.reject(httpError(config, 503));
        return Promise.resolve(ok(config, 204));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user?.username).toBe('admin'));

    await act(async () => {
      await result.current.logout();
    });
    expect(tokenStorage.get()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.pendingRevocations).toBe(1);
    expect(pendingRevocationStorage.list()).toEqual(['admin-token']);

    let allRevoked = false;
    await act(async () => {
      allRevoked = await result.current.retryPendingRevocations();
    });
    expect(allRevoked).toBe(true);
    expect(logoutCalls).toBe(2);
    expect(sentTokens).toEqual(['admin-token', 'admin-token']);
    expect(result.current.pendingRevocations).toBe(0);
  });

  it('退出网络失败保留待撤销 token', async () => {
    tokenStorage.set('admin-token');
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/me')) return Promise.resolve(ok(config, 200, ADMIN_USER));
      if (config.url?.endsWith('/auth/logout')) {
        return Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user?.username).toBe('admin'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.pendingRevocations).toBe(1);
    expect(pendingRevocationStorage.list()).toEqual(['admin-token']);
  });

  it('无会话时不发送匿名退出请求', async () => {
    let logoutCalls = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith('/auth/logout')) {
        logoutCalls += 1;
        return Promise.resolve(ok(config, 204));
      }
      throw new Error(`unexpected request: ${config.url}`);
    }) as AxiosAdapter;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await result.current.logout();
    });

    expect(logoutCalls).toBe(0);
    expect(result.current.pendingRevocations).toBe(0);
  });
});
