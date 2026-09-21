import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../providers/AuthProvider';
import { authService } from '../services/auth';
import { tokenStorage } from '../lib/storage';
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

function renderLogin(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/login']) {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/users" element={<div>用户管理页面</div>} />
            <Route path="/" element={<div>工作台页面</div>} />
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

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
});

describe('管理员登录', () => {
  it('管理员登录成功后保存 token 并跳回原目标页面', async () => {
    loginMock.mockResolvedValue(loginResponse('admin-token', ADMIN_USER));

    renderLogin([{ pathname: '/login', state: { from: { pathname: '/users' } } }]);
    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(await screen.findByText('用户管理页面')).toBeInTheDocument();
    expect(tokenStorage.get()).toBe('admin-token');
  });

  it('普通用户被拒绝，提示中文并撤销本次 token', async () => {
    loginMock.mockResolvedValue(loginResponse('normal-token', NORMAL_USER));

    renderLogin();
    const user = await fillCredentials('learner');
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(await screen.findByText('此账号没有管理权限。')).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(tokenStorage.get()).toBeNull());
  });

  it('密码错误时显示中文提示，不展示后端英文错误', async () => {
    loginMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: 'Invalid username or password' } },
    });

    renderLogin();
    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(await screen.findByText('账号或密码错误。')).toBeInTheDocument();
    expect(screen.queryByText('Invalid username or password')).not.toBeInTheDocument();
  });

  it('无法连接服务器时显示网络提示', async () => {
    loginMock.mockRejectedValue({ isAxiosError: true });

    renderLogin();
    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: /登录/ }));

    expect(await screen.findByText('无法连接服务器，请检查 API 服务是否已启动。')).toBeInTheDocument();
  });

  it('提交期间按钮不可重复点击', async () => {
    let release: (value: LoginResponse) => void = () => undefined;
    loginMock.mockReturnValue(new Promise<LoginResponse>((resolve) => { release = resolve; }));

    renderLogin();
    const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: /登录/ }));

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
    const user = await fillCredentials('admin', 'password123');
    await user.click(screen.getByRole('button', { name: /登录/ }));
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
