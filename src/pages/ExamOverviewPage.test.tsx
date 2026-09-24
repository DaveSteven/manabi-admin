import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { ExamOverviewPage } from './ExamOverviewPage';
import { api } from '../lib/api';
import type { AdminExamOverview } from '../types/exams';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

const OVERVIEW: AdminExamOverview = {
  id: 'e1',
  title: '2025年7月 N2',
  level: 'N2',
  year: 2025,
  month: 7,
  published: true,
  source_id: 'shared-exam',
  question_count: 5,
  available_count: 4,
  pending_review_count: 1,
  retired_count: 0,
  categories: [
    { category: 'vocabulary', question_count: 2, available_count: 2, pending_review_count: 0 },
    { category: 'grammar', question_count: 0, available_count: 0, pending_review_count: 0 },
    { category: 'reading', question_count: 2, available_count: 1, pending_review_count: 1 },
    { category: 'listening', question_count: 1, available_count: 1, pending_review_count: 0 },
  ],
  types: [
    { type_id: 'kanji_reading', name_zh: '汉字读音', name_ja: '漢字読み', category: 'vocabulary', question_count: 2, available_count: 2, pending_review_count: 0 },
    { type_id: 'short_reading', name_zh: '短篇理解', name_ja: '内容理解（短文）', category: 'reading', question_count: 2, available_count: 1, pending_review_count: 1 },
    { type_id: 'listening_task', name_zh: '课题理解', name_ja: '課題理解', category: 'listening', question_count: 1, available_count: 1, pending_review_count: 0 },
  ],
  statuses: [
    { status: 'ready', count: 4 },
    { status: 'review', count: 1 },
    { status: 'hidden', count: 0 },
    { status: 'retired', count: 0 },
  ],
  qualities: [
    { severity: 'error', count: 0 },
    { severity: 'warning', count: 2 },
    { severity: 'info', count: 1 },
  ],
  quality_issue_count: 3,
};

function renderPage(path = '/exams/e1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/exams/:examId" element={<ExamOverviewPage />} />
            <Route path="/exams" element={<div>EXAMS_LIST</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  );
}

describe('C02 试卷概览', () => {
  it('渲染真实接口返回的基础信息与各类统计', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.resolve(ok(config, OVERVIEW))) as AxiosAdapter;

    renderPage();

    expect(await screen.findByRole('heading', { name: '2025年7月 N2' })).toBeInTheDocument();
    expect(screen.getByText('shared-exam')).toBeInTheDocument();
    expect(screen.getAllByText('已发布').length).toBeGreaterThan(0);
    expect(screen.getByText('2025 年 7 月')).toBeInTheDocument();

    expect(screen.getByText('当前题数')).toBeInTheDocument();
    expect(screen.getByText('可用题目')).toBeInTheDocument();
    expect(screen.getAllByText('已退役').length).toBeGreaterThan(0);

    expect(screen.getAllByText('文字词汇').length).toBeGreaterThan(0);
    expect(screen.getAllByText('语法').length).toBeGreaterThan(0);
    expect(screen.getAllByText('阅读').length).toBeGreaterThan(0);
    expect(screen.getAllByText('听力').length).toBeGreaterThan(0);

    expect(screen.getByText('汉字读音')).toBeInTheDocument();
    expect(screen.getByText('漢字読み')).toBeInTheDocument();
    expect(screen.getByText('短篇理解')).toBeInTheDocument();
    expect(screen.getByText('课题理解')).toBeInTheDocument();

    expect(screen.getByText('阻断错误')).toBeInTheDocument();
    expect(screen.getByText('警告')).toBeInTheDocument();
    expect(screen.getByText('提示')).toBeInTheDocument();
    expect(screen.getByText('当前批次质量问题共 3 条，仅统计未退役题目。')).toBeInTheDocument();
  });

  it('试卷不存在时显示空状态并可返回列表', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => Promise.reject({
      isAxiosError: true, config, response: { status: 404, data: { detail: 'Exam not found' } },
    })) as AxiosAdapter;

    renderPage();
    expect(await screen.findByText('试卷不存在')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '返回试卷列表' }));
    expect(await screen.findByText('EXAMS_LIST')).toBeInTheDocument();
  });

  it('请求失败显示错误状态并可重试成功', async () => {
    let attempt = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      attempt += 1;
      if (attempt === 1) {
        return Promise.reject({ isAxiosError: true, config, response: { status: 500, data: {} } });
      }
      return Promise.resolve(ok(config, OVERVIEW));
    }) as AxiosAdapter;

    renderPage();
    expect(await screen.findByText('试卷概览加载失败')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重试/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '2025年7月 N2' })).toBeInTheDocument();
    });
  });
});
