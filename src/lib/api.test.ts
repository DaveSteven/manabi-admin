import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api } from './api';
import { authService } from '../services/auth';
import { tokenStorage } from './storage';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function httpError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, {
    data: { detail: 'error' },
    status,
    statusText: 'Error',
    headers: {},
    config,
  });
}

function ok(config: InternalAxiosRequestConfig, status = 204, data: unknown = null) {
  return { data, status, statusText: 'OK', headers: {}, config };
}

function bearerOf(config: InternalAxiosRequestConfig): string | undefined {
  const headers = config.headers;
  const normalized = typeof headers?.get === 'function' ? headers.get('Authorization') : undefined;
  const raw = normalized ?? headers?.Authorization;
  return typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : undefined;
}

describe('api 401 会话隔离', () => {
  it('待撤销旧 token 的 401 不会清除当前管理员会话', async () => {
    let sentToken: string | undefined;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      sentToken = bearerOf(config);
      return Promise.reject(httpError(config, 401));
    }) as AxiosAdapter;
    tokenStorage.set('admin-token');

    await expect(authService.logout('old-token')).rejects.toBeTruthy();

    expect(sentToken).toBe('old-token');
    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('撤销请求即使存在会话也使用传入的旧 token', async () => {
    let sentToken: string | undefined;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      sentToken = bearerOf(config);
      return Promise.resolve(ok(config));
    }) as AxiosAdapter;
    tokenStorage.set('admin-token');

    await authService.logout('old-token');

    expect(sentToken).toBe('old-token');
    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('旧请求飞行期间管理员已登录，其 401 不影响新会话', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      tokenStorage.set('fresh-admin-token');
      return Promise.reject(httpError(config, 401));
    }) as AxiosAdapter;
    tokenStorage.set('old-token');

    await expect(authService.logout('old-token')).rejects.toBeTruthy();

    expect(tokenStorage.get()).toBe('fresh-admin-token');
  });

  it('当前会话 token 自身 401 仍会清除会话并派发退出事件', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(httpError(config, 401))) as AxiosAdapter;
    tokenStorage.set('admin-token');
    let dispatched = 0;
    const handler = () => { dispatched += 1; };
    window.addEventListener('manabi:unauthorized', handler);

    await expect(authService.me()).rejects.toBeTruthy();

    window.removeEventListener('manabi:unauthorized', handler);
    expect(tokenStorage.get()).toBeNull();
    expect(dispatched).toBe(1);
  });

  it('多个并发 401 只清除会话并派发一次退出事件', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(httpError(config, 401))) as AxiosAdapter;
    tokenStorage.set('admin-token');
    let dispatched = 0;
    const handler = () => { dispatched += 1; };
    window.addEventListener('manabi:unauthorized', handler);

    await Promise.allSettled([authService.me(), authService.me(), authService.me()]);

    window.removeEventListener('manabi:unauthorized', handler);
    expect(tokenStorage.get()).toBeNull();
    expect(dispatched).toBe(1);
  });

  it('网络错误不清除当前会话', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))) as AxiosAdapter;
    tokenStorage.set('admin-token');

    await expect(authService.me()).rejects.toBeTruthy();

    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('撤销请求网络失败时不影响当前会话', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))) as AxiosAdapter;
    tokenStorage.set('admin-token');

    await expect(authService.logout('old-token')).rejects.toBeTruthy();

    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('撤销 503 失败后再次重试成功且不影响当前会话', async () => {
    let calls = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      calls += 1;
      if (calls === 1) return Promise.reject(httpError(config, 503));
      return Promise.resolve(ok(config));
    }) as AxiosAdapter;
    tokenStorage.set('admin-token');

    await expect(authService.logout('old-token')).rejects.toBeTruthy();
    await expect(authService.logout('old-token')).resolves.toBeUndefined();

    expect(calls).toBe(2);
    expect(tokenStorage.get()).toBe('admin-token');
  });
});
