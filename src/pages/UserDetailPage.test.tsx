import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { UserDetailPage } from './UserDetailPage';
import { ConfirmProvider } from '../providers/ConfirmProvider';
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
  updated_at: '2026-02-03T04:05:06Z',
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

function isPatch(config: InternalAxiosRequestConfig) {
  return (config.method ?? 'get').toLowerCase() === 'patch';
}

function isDisable(config: InternalAxiosRequestConfig) {
  return (config.url ?? '').endsWith('/disable');
}

function isEnable(config: InternalAxiosRequestConfig) {
  return (config.url ?? '').endsWith('/enable');
}

function isReset(config: InternalAxiosRequestConfig) {
  return (config.url ?? '').endsWith('/reset-password');
}

function isRevoke(config: InternalAxiosRequestConfig) {
  return (config.url ?? '').endsWith('/revoke-tokens');
}

function isDelete(config: InternalAxiosRequestConfig) {
  return (config.method ?? 'get').toLowerCase() === 'delete';
}

function renderPage(path = '/users/u1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/users/:userId" element={<UserDetailPage />} />
              <Route path="/users" element={<div>USERS_LIST</div>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
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

describe('B06 编辑用户', () => {
  it('保存成功后更新页面并使用 updated_at 并发版本', async () => {
    const patches: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isPatch(config)) {
        patches.push(JSON.parse(String(config.data)) as Record<string, unknown>);
        return Promise.resolve(ok(config, { ...DETAIL, username: 'alice2', display_name: '新名字', updated_at: '2026-02-04T00:00:00Z' }));
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /编辑资料/ }));
    const dialog = await screen.findByRole('dialog');
    const displayInput = within(dialog).getByLabelText('显示名称');
    await user.clear(displayInput);
    await user.type(displayInput, '新名字');
    await user.click(within(dialog).getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('用户资料已更新')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'alice2' })).toBeInTheDocument();
    expect(patches[0]).toMatchObject({ display_name: '新名字', updated_at: DETAIL.updated_at });
    expect(patches[0]).not.toHaveProperty('level');
    expect(patches[0]).not.toHaveProperty('is_admin');
  }, 15_000);

  it('用户名冲突时显示明确提示且保持弹窗', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isPatch(config)) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 409, data: { detail: { code: 'USERNAME_TAKEN', message: 'Username already exists' } } } });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /编辑资料/ }));
    const dialog = await screen.findByRole('dialog');
    const usernameInput = within(dialog).getByLabelText('用户名');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'taken');
    await user.click(within(dialog).getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('该用户名已存在，请更换。')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }, 15_000);

  it('并发冲突时提示刷新重试', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isPatch(config)) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 409, data: { detail: { code: 'EDIT_CONFLICT', message: 'User was modified' } } } });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /编辑资料/ }));
    const dialog = await screen.findByRole('dialog');
    const displayInput = within(dialog).getByLabelText('显示名称');
    await user.clear(displayInput);
    await user.type(displayInput, '冲突');
    await user.click(within(dialog).getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('该用户资料已被其他管理员修改，请刷新后重试。')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }, 15_000);

  it('未修改任何字段时提示无需保存', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /编辑资料/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('没有需要保存的修改。')).toBeInTheDocument();
  }, 15_000);
});

describe('B07 禁用与启用', () => {
  it('禁用用户需填写原因，成功后刷新状态', async () => {
    const posts: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isDisable(config)) {
        posts.push(JSON.parse(String(config.data)) as Record<string, unknown>);
        return Promise.resolve(ok(config, { ...DETAIL, status: 'disabled', updated_at: '2026-02-05T00:00:00Z' }));
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /禁用用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('禁用原因'), '违反使用条款');
    await user.click(within(dialog).getByRole('button', { name: /确认禁用/ }));

    expect(await screen.findByText('用户已禁用')).toBeInTheDocument();
    expect(await screen.findByText('已禁用')).toBeInTheDocument();
    expect(posts[0]).toEqual({ reason: '违反使用条款' });
  }, 15_000);

  it('启用用户经二次确认后恢复为正常', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isEnable(config)) return Promise.resolve(ok(config, { ...DETAIL, status: 'active' }));
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, { ...DETAIL, status: 'disabled' }));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /启用用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /启\s*用/ }));

    expect(await screen.findByText('用户已启用')).toBeInTheDocument();
    expect(await screen.findByText('正常')).toBeInTheDocument();
  }, 15_000);

  it('禁用自己时显示服务端中文提示', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isDisable(config)) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 409, data: { detail: { code: 'CANNOT_DISABLE_SELF', message: 'Cannot disable your own account' } } } });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /禁用用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('禁用原因'), '测试');
    await user.click(within(dialog).getByRole('button', { name: /确认禁用/ }));

    expect(await screen.findByText('不能禁用当前登录账号。')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }, 15_000);

  it('保护最后一个管理员时显示中文提示', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isDisable(config)) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 409, data: { detail: { code: 'LAST_ADMIN_PROTECTED', message: 'Cannot disable the last active administrator' } } } });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /禁用用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('禁用原因'), '测试');
    await user.click(within(dialog).getByRole('button', { name: /确认禁用/ }));

    expect(await screen.findByText('不能禁用最后一个管理员。')).toBeInTheDocument();
  }, 15_000);
});

describe('B08 重置密码和撤销会话', () => {
  it('重置密码成功后提示会话失效并提交新密码', async () => {
    const posts: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isReset(config)) {
        posts.push(JSON.parse(String(config.data)) as Record<string, unknown>);
        return Promise.resolve(ok(config, DETAIL));
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重置密码/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('新密码'), 'StrongPass1!');
    await user.type(within(dialog).getByLabelText('确认新密码'), 'StrongPass1!');
    await user.click(within(dialog).getByRole('button', { name: /确认重置/ }));

    expect(await screen.findByText('密码已重置，该用户的登录会话已全部失效')).toBeInTheDocument();
    expect(posts[0]).toEqual({ password: 'StrongPass1!' });
  }, 15_000);

  it('密码强度提示随输入变化', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重置密码/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('新密码'), 'abcd');
    expect(await screen.findByText('密码强度：弱')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('新密码'), 'Strong-Pass1!');
    expect(await screen.findByText('密码强度：强')).toBeInTheDocument();
  }, 15_000);

  it('两次密码不一致时阻止提交', async () => {
    let resetCalls = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isReset(config)) {
        resetCalls += 1;
        return Promise.resolve(ok(config, DETAIL));
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重置密码/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('新密码'), 'StrongPass1!');
    await user.type(within(dialog).getByLabelText('确认新密码'), 'StrongPass2!');
    await user.click(within(dialog).getByRole('button', { name: /确认重置/ }));

    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(resetCalls).toBe(0);
  }, 15_000);

  it('撤销全部会话经二次确认后提示成功', async () => {
    let revokeCalls = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isRevoke(config)) {
        revokeCalls += 1;
        return Promise.resolve(ok(config, DETAIL));
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /撤销全部会话/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /撤\s*销/ }));

    expect(await screen.findByText('已撤销该用户的全部登录会话')).toBeInTheDocument();
    expect(revokeCalls).toBe(1);
  }, 15_000);
});

describe('B09 安全删除用户', () => {
  it('删除成功后返回列表并发出 DELETE 请求', async () => {
    const deletes: string[] = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isDelete(config)) {
        deletes.push(config.url ?? '');
        return Promise.resolve({ data: null, status: 204, statusText: 'No Content', headers: {}, config });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /删除用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /删\s*除/ }));

    expect(await screen.findByText('USERS_LIST')).toBeInTheDocument();
    expect(deletes[0]).toContain('/admin/users/u1');
  }, 15_000);

  it('存在学习数据时提示改用禁用', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isDelete(config)) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 409, data: { detail: { code: 'HAS_PRACTICE_DATA', message: 'User has practice data' } } } });
      }
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, DETAIL));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /删除用户/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /删\s*除/ }));

    expect(await screen.findByText('该用户存在练习或错题数据，无法删除，请改用禁用。')).toBeInTheDocument();
    expect(screen.queryByText('USERS_LIST')).not.toBeInTheDocument();
  }, 15_000);

  it('管理员账号不可删除', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (isStats(config)) return Promise.resolve(ok(config, STATS));
      return Promise.resolve(ok(config, { ...DETAIL, is_admin: true }));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByRole('heading', { name: 'alice' });

    expect(screen.getByRole('button', { name: /删除用户/ })).toBeDisabled();
    expect(screen.getByText('管理员账号不能通过该接口删除。')).toBeInTheDocument();
  }, 15_000);
});
