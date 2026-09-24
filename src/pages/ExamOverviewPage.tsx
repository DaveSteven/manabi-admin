import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Space, Statistic, Table, type TableProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { apiErrorMessage, apiErrorStatus } from '../lib/errors';
import { examsService } from '../services/exams';
import type { AdminExamCategoryCount, AdminExamQualityCount, AdminExamStatusCount, AdminExamTypeCount } from '../types/exams';

const CATEGORY_LABELS: Record<string, string> = {
  vocabulary: '文字词汇',
  grammar: '语法',
  reading: '阅读',
  listening: '听力',
};

interface StatusSeverityLabel {
  label: string;
  tone: 'error' | 'warning' | 'info';
}

const SEVERITY_LABELS: Record<string, StatusSeverityLabel> = {
  error: { label: '阻断错误', tone: 'error' },
  warning: { label: '警告', tone: 'warning' },
  info: { label: '提示', tone: 'info' },
};

const FIRST_COLUMN_WIDTH = 240;

function formatYearMonth(year: number | null, month: number | null): string {
  if (year == null) return '—';
  return month == null ? `${year} 年` : `${year} 年 ${month} 月`;
}

export function ExamOverviewPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['admin', 'exams', examId],
    queryFn: () => examsService.get(examId as string),
    enabled: Boolean(examId),
  });

  const overview = query.data;
  const notFound = apiErrorStatus(query.error) === 404;

  const categoryColumns: TableProps<AdminExamCategoryCount>['columns'] = [
    { title: '分类', dataIndex: 'category', key: 'category', width: FIRST_COLUMN_WIDTH, render: (value: string) => CATEGORY_LABELS[value] ?? value },
    { title: '题目数', dataIndex: 'question_count', key: 'question_count' },
    { title: '可用', dataIndex: 'available_count', key: 'available_count' },
    { title: '待复核', dataIndex: 'pending_review_count', key: 'pending_review_count' },
  ];

  const typeColumns: TableProps<AdminExamTypeCount>['columns'] = [
    {
      title: '题型', key: 'type', width: FIRST_COLUMN_WIDTH,
      render: (_value, record) => (
        <div>
          <div>{record.name_zh ?? record.type_id ?? '未知题型'}</div>
          {record.name_ja && <small className="exam-overview-subtle">{record.name_ja}</small>}
        </div>
      ),
    },
    { title: '分类', dataIndex: 'category', key: 'category', render: (value: string | null) => (value ? CATEGORY_LABELS[value] ?? value : '—') },
    { title: '题目数', dataIndex: 'question_count', key: 'question_count' },
    { title: '可用', dataIndex: 'available_count', key: 'available_count' },
    { title: '待复核', dataIndex: 'pending_review_count', key: 'pending_review_count' },
  ];

  const statusColumns: TableProps<AdminExamStatusCount>['columns'] = [
    { title: '内容状态', dataIndex: 'status', key: 'status', width: FIRST_COLUMN_WIDTH, render: (value: string) => <StatusTag status={value} /> },
    { title: '数量', dataIndex: 'count', key: 'count' },
  ];

  const qualityColumns: TableProps<AdminExamQualityCount>['columns'] = [
    {
      title: '严重程度', dataIndex: 'severity', key: 'severity', width: FIRST_COLUMN_WIDTH,
      render: (value: string) => {
        const descriptor = SEVERITY_LABELS[value];
        return <StatusTag tone={descriptor?.tone ?? 'default'} label={descriptor?.label ?? value} />;
      },
    },
    { title: '数量', dataIndex: 'count', key: 'count' },
  ];

  if (query.isError) {
    return (
      <div className="page exam-overview-page">
        <PageHeader
          eyebrow="JLPT LIBRARY"
          title="试卷概览"
          action={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/exams')}>返回列表</Button>}
        />
        <StateBlock
          tone={notFound ? 'empty' : 'error'}
          title={notFound ? '试卷不存在' : '试卷概览加载失败'}
          description={notFound ? '该试卷可能已被删除，请返回列表重新选择。' : apiErrorMessage(query.error)}
          action={notFound
            ? <Button type="primary" onClick={() => navigate('/exams')}>返回试卷列表</Button>
            : <Button type="primary" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page exam-overview-page">
      <PageHeader
        eyebrow="JLPT LIBRARY"
        title={overview?.title ?? '试卷概览'}
        action={(
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/exams')}>返回列表</Button>
            <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>
          </Space>
        )}
      />

      <Card className="exam-overview-card" title="基础信息" loading={query.isLoading}>
        {overview && (
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} colon={false}>
            <Descriptions.Item label="JLPT 等级">{overview.level}</Descriptions.Item>
            <Descriptions.Item label="年月">{formatYearMonth(overview.year, overview.month)}</Descriptions.Item>
            <Descriptions.Item label="发布状态">
              <StatusTag tone={overview.published ? 'success' : 'default'} label={overview.published ? '已发布' : '未发布'} />
            </Descriptions.Item>
            <Descriptions.Item label="来源 ID">{overview.source_id}</Descriptions.Item>
            <Descriptions.Item label="试卷 ID">{overview.id}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card className="exam-overview-card" title="题目统计" loading={query.isLoading}>
        {overview && (
          <>
            <div className="exam-overview-stats">
              <Statistic title="当前题数" value={overview.question_count} />
              <Statistic title="可用题目" value={overview.available_count} />
              <Statistic title="待复核" value={overview.pending_review_count} />
              <Statistic title="已退役" value={overview.retired_count} />
            </div>
            <Table<AdminExamCategoryCount>
              className="exam-overview-table"
              rowKey="category"
              columns={categoryColumns}
              dataSource={overview.categories}
              pagination={false}
              scroll={{ x: 640 }}
            />
          </>
        )}
      </Card>

      <Card className="exam-overview-card" title="题型分布" loading={query.isLoading}>
        {overview && (
          overview.types.length === 0 ? (
            <StateBlock title="暂无题型数据" description="该试卷还没有当前有效的题目。" />
          ) : (
            <Table<AdminExamTypeCount>
              className="exam-overview-table"
              rowKey={(record) => record.type_id ?? 'unknown'}
              columns={typeColumns}
              dataSource={overview.types}
              pagination={false}
              scroll={{ x: 720 }}
            />
          )
        )}
      </Card>

      <Card className="exam-overview-card" title="内容状态" loading={query.isLoading}>
        {overview && (
          <Table<AdminExamStatusCount>
            className="exam-overview-table"
            rowKey="status"
            columns={statusColumns}
            dataSource={overview.statuses}
            pagination={false}
            scroll={{ x: 480 }}
          />
        )}
      </Card>

      <Card className="exam-overview-card" title="质量问题" loading={query.isLoading}>
        {overview && (
          <>
            <Table<AdminExamQualityCount>
              className="exam-overview-table"
              rowKey="severity"
              columns={qualityColumns}
              dataSource={overview.qualities}
              pagination={false}
              scroll={{ x: 480 }}
            />
            <p className="users-create-form__hint">当前批次质量问题共 {overview.quality_issue_count} 条，仅统计未退役题目。</p>
          </>
        )}
      </Card>
    </div>
  );
}
