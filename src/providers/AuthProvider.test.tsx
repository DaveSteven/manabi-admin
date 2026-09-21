import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { AuthProvider, useAuth } from './AuthProvider';
import { AdminAccessRequiredError } from '../lib/errors';
import { api } from '../lib/api';
import { pendingRevocationStorage, tokenStorage } from '../lib/storage';
import type { AdminUser, LoginResponse } from '../types/auth';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const ADMIN_USER: AdminUser = { id: 'u1', username: 'admin', level: 'N1', is_guest: false, is_admin: true };
const NORMAL_USER: AdminUser = { id: 'u2', username: 'learner', level: 'N3', is_guest: false, is_admin: false };

function ok(config: InternalAxiosRequestConfig, status: number, data: unknown) {
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
