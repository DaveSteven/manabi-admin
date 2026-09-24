import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { ExamsPage } from './ExamsPage';
import { api } from '../lib/api';
import type { AdminExamListItem, AdminExamsResponse } from '../types/exams';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function item(overrides: Partial<AdminExamListItem> = {}): AdminExamListItem {
  return {
    id: 'e1',
    title: '2025年7月 N2',
    level: 'N2',
    year: 2025,
    month: 7,
    published: true,
    question_count: 5,
    available_count: 5,
    pending_review_count: 3,
    vocabulary_count: 2,
    grammar_count: 1,
    reading_count: 1,
    listening_count: 1,
    ...overrides,
  };
}

function page(overrides: Partial<AdminExamsResponse> = {}): AdminExamsResponse {
  return { items: [], total: 0, limit: 20, offset: 0, ...overrides };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntries: string[] = ['/exams']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <ExamsPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

describe('C01 试卷列表', () => {
  it('渲染真实接口返回的试卷统计与发布状态', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page({
      items: [
        item({ id: 'e1', title: '2025年7月 N2', published: true, pending_review_count: 3 }),
        item({ id: 'e2', title: '2024年12月 N3', level: 'N3', year: 2024, month: 12, published: false, pending_review_count: 0 }),
      ],
      total: 2,
    })))) as AxiosAdapter;

    renderPage();

    expect(await screen.findByText('2025年7月 N2')).toBeInTheDocument();
    expect(screen.getByText('2024年12月 N3')).toBeInTheDocument();
    expect(screen.getByText('2025 年 7 月')).toBeInTheDocument();
    expect(screen.getAllByText('N2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已发布').length).toBeGreaterThan(0);
    expect(screen.getByText('未发布')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('关键词搜索会更新 URL 参数并重新请求', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByText('2025年7月 N2');

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('搜索试卷标题'), '2025');
    await user.click(screen.getByRole('button', { name: /搜\s*索/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('keyword=2025');
    });
    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ keyword: '2025', offset: 0 });
    });
  });

  it('从 URL 恢复等级、年份、月份与质量控制筛选', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage(['/exams?level=N2&year=2025&month=7&published=true&has_issues=false&offset=20&limit=10']);

    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({
        level: 'N2', year: 2025, month: 7, published: true, has_issues: false, offset: 20, limit: 10,
      });
    });
  });

  it('无数据时显示空状态', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page()))) as AxiosAdapter;

    renderPage();
    expect(await screen.findByText('暂无试卷')).toBeInTheDocument();
  });

  it('筛选无结果时提供清除入口', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, page()))) as AxiosAdapter;

    renderPage(['/exams?keyword=zzz']);
    expect(await screen.findByText('没有符合条件的试卷')).toBeInTheDocument();
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
    expect(await screen.findByText('试卷列表加载失败')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重试/ }));

    expect(await screen.findByText('2025年7月 N2')).toBeInTheDocument();
  });

  it('点击“年月”表头在降序与升序之间切换排序', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 1 })));
    }) as AxiosAdapter;

    renderPage();
    await screen.findByText('2025年7月 N2');
    expect(requests.at(-1)).toMatchObject({ sort: 'year', order: 'desc' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('columnheader', { name: '年月' }));
    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ sort: 'year', order: 'asc' });
    });

    await user.click(screen.getByRole('columnheader', { name: '年月' }));
    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ sort: 'year', order: 'desc' });
    });
  });

  it('切换分页时保留当前排序参数', async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push((config.params ?? {}) as Record<string, unknown>);
      return Promise.resolve(ok(config, page({ items: [item()], total: 40 })));
    }) as AxiosAdapter;

    renderPage(['/exams?sort=year&order=asc&limit=20&offset=0']);
    await screen.findByText('2025年7月 N2');

    const user = userEvent.setup();
    const nextButton = document.querySelector('.ant-pagination-next button');
    expect(nextButton).not.toBeNull();
    await user.click(nextButton as HTMLElement);

    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ sort: 'year', order: 'asc', offset: 20 });
    });
  });
});
