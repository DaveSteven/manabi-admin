import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../providers/AuthProvider';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { authService } from '../services/auth';
import { pendingRevocationStorage, tokenStorage } from '../lib/storage';
import type { AdminUser, LoginResponse } from '../types/auth';
import { LoginPage } from './LoginPage';

vi.mock('../services/auth', () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

const loginMock = vi.mocked(authService.login);
const logoutMock = vi.mocked(authService.logout);

const ADMIN_USER: AdminUser = { id: 'u1', username: 'admin', level: 'N1', is_guest: false, is_admin: true };
const NORMAL_USER: AdminUser = { id: 'u2', username: 'learner', level: 'N3', is_guest: false, is_admin: false };

function loginResponse(token: string, user: AdminUser): LoginResponse {
  return { access_token: token, token_type: 'bearer', expires_at: '2099-01-01T00:00:00Z', user };
}

function axiosError(status: number, detail: unknown) {
  return { isAxiosError: true, response: { status, data: { detail } } };
}

function renderLogin(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/login']) {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/users" element={<div>用户管理页面</div>} />
              <Route path="/" element={<div>工作台页面</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ConfigProvider>,
  );
}

async function fillCredentials(username = 'admin', password = 'password123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('管理员账号'), username);
  await user.type(screen.getByLabelText('密码'), password);
  return user;
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /登录/ }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
});

describe('管理员登录', () => {
  it('管理员登录成功后保存 token 并跳回原目标页面', async () => {
    loginMock.mockResolvedValue(loginResponse('admin-token', ADMIN_USER));

    renderLogin([{ pathname: '/login', state: { from: { pathname: '/users' } } }]);
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('普通用户被拒绝，撤销成功时提示中文且不显示重试', async () => {
    loginMock.mockResolvedValue(loginResponse('normal-token', NORMAL_USER));

    renderLogin();
    await fillCredentials('learner');
    await submitLogin();

    expect(await screen.findByText('此账号没有管理权限。')).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith('normal-token');
    expect(screen.queryByText('会话撤销未完成')).not.toBeInTheDocument();
    expect(pendingRevocationStorage.list()).toEqual([]);
    expect(tokenStorage.get()).toBeNull();
  });

  it('撤销失败时不视为成功：保留待撤销 token、提示重试且无法进入受保护页面', async () => {
    loginMock.mockResolvedValue(loginResponse('normal-token', NORMAL_USER));
    logoutMock.mockRejectedValue(axiosError(503, 'Service Unavailable'));

    renderLogin();
    await fillCredentials('learner');
    await submitLogin();

    expect(await screen.findByText('此账号没有管理权限，且会话撤销失败。')).toBeInTheDocument();
    expect(await screen.findByText('会话撤销未完成')).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalledWith('normal-token');
    expect(pendingRevocationStorage.list()).toEqual(['normal-token']);
    expect(tokenStorage.get()).toBeNull();
    expect(screen.queryByText('用户管理页面')).not.toBeInTheDocument();
    expect(screen.queryByText('normal-token')).not.toBeInTheDocument();
  });

  it('撤销失败后再次重试成功会清空待撤销 token', async () => {
    loginMock.mockResolvedValue(loginResponse('normal-token', NORMAL_USER));
    logoutMock.mockRejectedValueOnce(axiosError(503, 'Service Unavailable')).mockResolvedValue(undefined);

    renderLogin();
    await fillCredentials('learner');
    await submitLogin();
    expect(await screen.findByText('会话撤销未完成')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重\s*试/ }));

    await waitFor(() => expect(screen.queryByText('会话撤销未完成')).not.toBeInTheDocument());
    expect(pendingRevocationStorage.list()).toEqual([]);
    expect(logoutMock).toHaveBeenCalledTimes(2);
  });

  it('密码错误时显示中文提示，不展示后端英文错误', async () => {
    loginMock.mockRejectedValue(axiosError(401, 'Invalid username or password'));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('账号或密码错误。')).toBeInTheDocument();
    expect(screen.queryByText('Invalid username or password')).not.toBeInTheDocument();
  });

  it('403 显示没有管理权限的中文提示', async () => {
    loginMock.mockRejectedValue(axiosError(403, 'Administrator access required'));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('此账号没有管理权限。')).toBeInTheDocument();
    expect(screen.queryByText('Administrator access required')).not.toBeInTheDocument();
  });

  it('422 显示格式错误的中文提示', async () => {
    loginMock.mockRejectedValue(axiosError(422, [{ msg: 'String should have at least 8 characters' }]));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('账号或密码格式不正确。')).toBeInTheDocument();
    expect(screen.queryByText(/at least 8 characters/)).not.toBeInTheDocument();
  });

  it('429 英文 detail 映射为中文限流提示', async () => {
    loginMock.mockRejectedValue(axiosError(429, 'Too Many Requests'));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('请求过于频繁，请稍后再试。')).toBeInTheDocument();
    expect(screen.queryByText('Too Many Requests')).not.toBeInTheDocument();
  });

  it('5xx 对象英文 detail 映射为中文服务提示', async () => {
    loginMock.mockRejectedValue(axiosError(503, { code: 'SERVICE_UNAVAILABLE', message: 'Service Unavailable' }));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('服务器暂时不可用，请稍后重试。')).toBeInTheDocument();
    expect(screen.queryByText('Service Unavailable')).not.toBeInTheDocument();
  });

  it('未知状态和未知错误代码使用中文兜底', async () => {
    loginMock.mockRejectedValue(axiosError(418, { code: 'TEAPOT', message: 'I am a teapot' }));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('操作失败，请稍后重试。')).toBeInTheDocument();
    expect(screen.queryByText('I am a teapot')).not.toBeInTheDocument();
  });

  it('无法连接服务器时显示网络提示', async () => {
    loginMock.mockRejectedValue({ isAxiosError: true });

    renderLogin();
    await fillCredentials();
    await submitLogin();

    expect(await screen.findByText('无法连接服务器，请检查 API 服务是否已启动。')).toBeInTheDocument();
  });

  it('提交期间按钮不可重复点击', async () => {
    let release: (value: LoginResponse) => void = () => undefined;
    loginMock.mockReturnValue(new Promise<LoginResponse>((resolve) => { release = resolve; }));

    renderLogin();
    await fillCredentials();
    await submitLogin();

    const button = screen.getByRole('button', { name: /登录/ });
    expect(button).toBeDisabled();
    expect(loginMock).toHaveBeenCalledTimes(1);

    release(loginResponse('admin-token', ADMIN_USER));
    expect(await screen.findByText('工作台页面')).toBeInTheDocument();
  });

  it('日志中不记录密码或 token', async () => {
    loginMock.mockResolvedValue(loginResponse('secret-token', ADMIN_USER));
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const)
      .map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));

    renderLogin();
    await fillCredentials('admin', 'password123');
    await submitLogin();
    expect(await screen.findByText('工作台页面')).toBeInTheDocument();

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        const output = JSON.stringify(call);
        expect(output).not.toContain('password123');
        expect(output).not.toContain('secret-token');
      }
    }
  });
});
