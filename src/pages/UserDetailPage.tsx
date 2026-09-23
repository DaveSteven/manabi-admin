import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Card, Descriptions, Space, Statistic, Table, Button, type TableProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { apiErrorStatus, apiErrorMessage } from '../lib/errors';
import { usersService } from '../services/users';
import type { AdminUserStatsLevel } from '../types/users';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

function formatAccuracy(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => usersService.get(userId as string),
    enabled: Boolean(userId),
  });
  const statsQuery = useQuery({
    queryKey: ['admin', 'users', userId, 'stats'],
    queryFn: () => usersService.stats(userId as string),
    enabled: Boolean(userId),
  });

  const columns: TableProps<AdminUserStatsLevel>['columns'] = [
    { title: '等级', dataIndex: 'level', key: 'level' },
    { title: '练习次数', dataIndex: 'practices', key: 'practices' },
    { title: '已答题目', dataIndex: 'answered', key: 'answered' },
    { title: '答对', dataIndex: 'correct', key: 'correct' },
    { title: '正确率', dataIndex: 'accuracy', key: 'accuracy', render: formatAccuracy },
    { title: '错题数量', dataIndex: 'wrong_questions', key: 'wrong_questions' },
  ];

  if (detailQuery.isError) {
    const notFound = apiErrorStatus(detailQuery.error) === 404;
    return (
      <div className="page user-detail-page">
        <PageHeader eyebrow="PEOPLE" title="用户详情" action={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>返回列表</Button>} />
        <StateBlock
          tone={notFound ? 'empty' : 'error'}
          title={notFound ? '用户不存在' : '用户详情加载失败'}
          description={notFound ? '该用户可能已被删除，请返回列表重新选择。' : apiErrorMessage(detailQuery.error)}
          action={<Button type="primary" onClick={() => navigate('/users')}>返回用户列表</Button>}
        />
      </div>
    );
  }

  const detail = detailQuery.data;
  const stats = statsQuery.data;

  return (
    <div className="page user-detail-page">
      <PageHeader
        eyebrow="PEOPLE"
        title={detail?.username ?? '用户详情'}
        description={detail?.display_name ? `显示名称：${detail.display_name}` : undefined}
        action={(
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>返回列表</Button>
            <Button
              icon={<ReloadOutlined />}
              loading={detailQuery.isFetching || statsQuery.isFetching}
              onClick={() => { void detailQuery.refetch(); void statsQuery.refetch(); }}
            >
              刷新
            </Button>
          </Space>
        )}
      />

      <Card className="user-detail-card" title="用户资料" loading={detailQuery.isLoading}>
        {detail && (
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} colon={false}>
            <Descriptions.Item label="用户名">{detail.username ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{detail.display_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="JLPT 等级">{detail.level}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag status={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="角色">
              <StatusTag tone={detail.is_admin ? 'brand' : 'default'} label={detail.is_admin ? '管理员' : '普通用户'} />
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">{formatDateTime(detail.created_at)}</Descriptions.Item>
            <Descriptions.Item label="最近登录">{formatDateTime(detail.last_login_at)}</Descriptions.Item>
            <Descriptions.Item label="用户 ID">{detail.id}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card className="user-detail-card" title="学习摘要" loading={statsQuery.isLoading}>
        {statsQuery.isError ? (
          <StateBlock
            tone="error"
            title="学习摘要加载失败"
            description={apiErrorMessage(statsQuery.error)}
            action={<Button type="primary" onClick={() => void statsQuery.refetch()}>重试</Button>}
          />
        ) : stats && (
          <>
            <div className="user-detail-stats">
              <Statistic title="练习次数" value={stats.practices} />
              <Statistic title="已答题目" value={stats.answered} />
              <Statistic title="正确率" value={stats.accuracy * 100} precision={1} suffix="%" />
              <Statistic title="错题数量" value={stats.wrong_questions} />
            </div>
            {stats.levels.length === 0 ? (
              <StateBlock title="暂无学习数据" description="该用户还没有完成任何练习。" />
            ) : (
              <Table<AdminUserStatsLevel>
                className="user-detail-levels"
                rowKey="level"
                columns={columns}
                dataSource={stats.levels}
                pagination={false}
                scroll={{ x: 640 }}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
