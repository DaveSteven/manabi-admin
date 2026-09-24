import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Input, Select, Space, Table, type TableProps } from 'antd';
import type { SorterResult, TablePaginationConfig } from 'antd/es/table/interface';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { apiErrorMessage } from '../lib/errors';
import { examsService } from '../services/exams';
import type { AdminExamListItem, AdminExamListParams } from '../types/exams';

const DEFAULT_LIMIT = 20;
const DEFAULT_SORT = 'year';
const DEFAULT_ORDER: 'asc' | 'desc' = 'desc';
const SORTABLE_FIELDS = new Set(['title', 'level', 'year', 'month', 'published']);
const SORT_DIRECTIONS: ('ascend' | 'descend')[] = ['descend', 'ascend'];

const LEVEL_OPTIONS = ['N1', 'N2', 'N3', 'N4', 'N5'].map((value) => ({ value, label: value }));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 25 }, (_, index) => CURRENT_YEAR - index).map((value) => ({ value, label: `${value} 年` }));
const PUBLISHED_OPTIONS = [
  { value: 'true', label: '已发布' },
  { value: 'false', label: '未发布' },
];
const ISSUE_OPTIONS = [
  { value: 'true', label: '有质量问题' },
  { value: 'false', label: '无质量问题' },
];

function parseBoolean(value: string | null): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function parseParams(searchParams: URLSearchParams): AdminExamListParams {
  const limit = Number(searchParams.get('limit'));
  const offset = Number(searchParams.get('offset'));
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const sort = searchParams.get('sort');
  const order = searchParams.get('order');
  return {
    keyword: searchParams.get('keyword') ?? undefined,
    level: searchParams.get('level') ?? undefined,
    year: Number.isInteger(year) && year > 0 ? year : undefined,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined,
    published: parseBoolean(searchParams.get('published')),
    has_issues: parseBoolean(searchParams.get('has_issues')),
    sort: sort && SORTABLE_FIELDS.has(sort) ? sort : DEFAULT_SORT,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_ORDER,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}

function formatYearMonth(year: number | null, month: number | null): string {
  if (year == null) return '—';
  return month == null ? `${year} 年` : `${year} 年 ${month} 月`;
}

export function ExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  const [keyword, setKeyword] = useState(params.keyword ?? '');

  useEffect(() => {
    setKeyword(params.keyword ?? '');
  }, [params.keyword]);

  const query = useQuery({
    queryKey: ['admin', 'exams', params],
    queryFn: () => examsService.list(params),
    placeholderData: keepPreviousData,
  });

  const updateParams = (changes: Record<string, string | number | boolean | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };

  const submitKeyword = () => updateParams({ keyword: keyword.trim() || undefined, offset: 0 });

  const hasFilters = Boolean(
    params.keyword || params.level || params.year !== undefined || params.month !== undefined
      || params.published !== undefined || params.has_issues !== undefined,
  );

  const clearFilters = () => {
    setKeyword('');
    updateParams({
      keyword: undefined, level: undefined, year: undefined, month: undefined,
      published: undefined, has_issues: undefined, offset: 0, sort: undefined, order: undefined,
    });
  };

  const sortOrderFor = (field: string) => (
    params.sort === field ? (params.order === 'asc' ? 'ascend' : 'descend') : null
  );

  const columns: TableProps<AdminExamListItem>['columns'] = [
    { title: '试卷标题', dataIndex: 'title', key: 'title', sorter: true, sortDirections: SORT_DIRECTIONS, sortOrder: sortOrderFor('title') },
    { title: '等级', dataIndex: 'level', key: 'level', sorter: true, sortDirections: SORT_DIRECTIONS, sortOrder: sortOrderFor('level') },
    {
      title: '年月', dataIndex: 'year', key: 'year', sorter: true, sortDirections: SORT_DIRECTIONS, sortOrder: sortOrderFor('year'),
      render: (_value, record) => formatYearMonth(record.year, record.month),
    },
    { title: '词汇', dataIndex: 'vocabulary_count', key: 'vocabulary_count' },
    { title: '语法', dataIndex: 'grammar_count', key: 'grammar_count' },
    { title: '阅读', dataIndex: 'reading_count', key: 'reading_count' },
    { title: '听力', dataIndex: 'listening_count', key: 'listening_count' },
    { title: '总题数', dataIndex: 'question_count', key: 'question_count' },
    {
      title: '待复核', dataIndex: 'pending_review_count', key: 'pending_review_count',
      render: (value: number) => (value > 0 ? <StatusTag tone="warning" label={String(value)} /> : value),
    },
    {
      title: '发布状态', dataIndex: 'published', key: 'published',
      sorter: true, sortDirections: SORT_DIRECTIONS, sortOrder: sortOrderFor('published'),
      render: (value: boolean) => <StatusTag tone={value ? 'success' : 'default'} label={value ? '已发布' : '未发布'} />,
    },
  ];

  const pagination: TablePaginationConfig = {
    current: Math.floor(params.offset! / params.limit!) + 1,
    pageSize: params.limit,
    total: query.data?.total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (total) => `共 ${total} 套试卷`,
  };

  const handleTableChange: TableProps<AdminExamListItem>['onChange'] = (nextPagination, _filters, sorter, extra) => {
    const changes: Record<string, string | number | undefined> = {
      limit: nextPagination.pageSize ?? params.limit,
      offset: ((nextPagination.current ?? 1) - 1) * (nextPagination.pageSize ?? params.limit!),
    };
    if (extra.action === 'sort') {
      const active = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<AdminExamListItem> | undefined;
      const field = active?.field ? String(active.field) : active?.columnKey ? String(active.columnKey) : undefined;
      if (field && active?.order && SORTABLE_FIELDS.has(field)) {
        changes.sort = field;
        changes.order = active.order === 'ascend' ? 'asc' : 'desc';
      } else {
        changes.sort = undefined;
        changes.order = undefined;
      }
    }
    updateParams(changes);
  };

  return (
    <div className="page exams-page">
      <PageHeader
        eyebrow="JLPT LIBRARY"
        title="真题管理"
        action={<Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>}
      />
      <div className="exams-filter-card">
        <Space wrap size={12}>
          <Input
            className="exams-filter-card__keyword"
            value={keyword}
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索试卷标题"
            onChange={(event) => {
              const value = event.target.value;
              setKeyword(value);
              if (value === '' && params.keyword) updateParams({ keyword: undefined, offset: 0 });
            }}
            onPressEnter={submitKeyword}
          />
          <Button type="primary" onClick={submitKeyword}>搜索</Button>
          <Select allowClear placeholder="全部等级" options={LEVEL_OPTIONS} value={params.level} className="exams-filter-card__select"
            onChange={(value) => updateParams({ level: value, offset: 0 })} />
          <Select allowClear placeholder="全部年份" options={YEAR_OPTIONS} value={params.year} className="exams-filter-card__select"
            onChange={(value) => updateParams({ year: value, offset: 0 })} />
          <Select allowClear placeholder="全部月份" options={MONTH_OPTIONS} value={params.month} className="exams-filter-card__select"
            onChange={(value) => updateParams({ month: value, offset: 0 })} />
          <Select allowClear placeholder="全部状态" options={PUBLISHED_OPTIONS}
            value={params.published === undefined ? undefined : String(params.published)} className="exams-filter-card__select"
            onChange={(value) => updateParams({ published: value, offset: 0 })} />
          <Select allowClear placeholder="质量问题" options={ISSUE_OPTIONS}
            value={params.has_issues === undefined ? undefined : String(params.has_issues)} className="exams-filter-card__select"
            onChange={(value) => updateParams({ has_issues: value, offset: 0 })} />
          {hasFilters && <Button type="link" onClick={clearFilters}>清除筛选</Button>}
        </Space>
      </div>

      {query.isError ? (
        <StateBlock
          tone="error"
          title="试卷列表加载失败"
          description={apiErrorMessage(query.error)}
          action={<Button type="primary" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : !query.isLoading && query.data && query.data.total === 0 ? (
        <StateBlock
          title={hasFilters ? '没有符合条件的试卷' : '暂无试卷'}
          description={hasFilters ? '请调整筛选条件后重试。' : '题库中还没有试卷数据。'}
          action={hasFilters ? <Button onClick={clearFilters}>清除筛选</Button> : undefined}
        />
      ) : (
        <Table<AdminExamListItem>
          className="exams-table"
          rowKey="id"
          columns={columns}
          dataSource={query.data?.items ?? []}
          loading={query.isLoading || query.isFetching}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 960 }}
        />
      )}
    </div>
  );
}
