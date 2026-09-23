import { ArrowLeftOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Card, Descriptions, Form, Input, Modal, Space, Statistic, Table, Button, type TableProps } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { apiErrorCode, apiErrorStatus, apiErrorMessage } from '../lib/errors';
import { usersService } from '../services/users';
import type { AdminUserStatsLevel, AdminUserUpdateInput } from '../types/users';

interface EditFormValues {
  username: string;
  display_name?: string;
}

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
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [editForm] = Form.useForm<EditFormValues>();

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

  const detail = detailQuery.data;
  const stats = statsQuery.data;

  const openEdit = () => {
    if (!detail) return;
    setEditError(undefined);
    editForm.setFieldsValue({ username: detail.username ?? '', display_name: detail.display_name ?? '' });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditError(undefined);
  };

  const submitEdit = async () => {
    if (saving || !detail || !userId) return;
    let values: EditFormValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const payload: AdminUserUpdateInput = { updated_at: detail.updated_at ?? '' };
    const username = values.username.trim();
    const displayName = values.display_name?.trim() ?? '';
    if (username !== (detail.username ?? '')) payload.username = username;
    if (displayName !== (detail.display_name ?? '')) payload.display_name = displayName || null;
    if (payload.username === undefined && payload.display_name === undefined) {
      setEditError('没有需要保存的修改。');
      return;
    }
    setSaving(true);
    setEditError(undefined);
    try {
      const updated = await usersService.update(userId, payload);
      queryClient.setQueryData(['admin', 'users', userId], updated);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'users'],
        predicate: (query) => query.queryKey.length === 3 && typeof query.queryKey[2] === 'object',
      });
      setEditOpen(false);
      setSaved(true);
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'EDIT_CONFLICT') setEditError('该用户资料已被其他管理员修改，请刷新后重试。');
      else if (code === 'USERNAME_TAKEN') setEditError('该用户名已存在，请更换。');
      else setEditError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="page user-detail-page">
      <PageHeader
        eyebrow="PEOPLE"
        title={detail?.username ?? '用户详情'}
        description={detail?.display_name ? `显示名称：${detail.display_name}` : undefined}
        action={(
          <Space>
            <Button type="primary" icon={<EditOutlined />} disabled={!detail} onClick={openEdit}>编辑资料</Button>
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

      {saved && (
        <Alert
          className="users-page__notice"
          type="success"
          showIcon
          closable
          message="用户资料已更新"
          onClose={() => setSaved(false)}
        />
      )}

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

      <Modal
        title="编辑用户资料"
        open={editOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        maskClosable={!saving}
        onOk={() => void submitEdit()}
        onCancel={closeEdit}
      >
        {editError && <Alert className="users-page__notice" type="error" showIcon message={editError} />}
        <Form form={editForm} layout="vertical" requiredMark={false} className="user-detail-edit-form">
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 位' },
              { max: 64, message: '用户名最多 64 位' },
              { pattern: /^[a-zA-Z0-9_.-]+$/, message: '用户名只能包含字母、数字、下划线、点和连字符' },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name" rules={[{ max: 64, message: '显示名称最多 64 个字符' }]}>
            <Input autoComplete="off" placeholder="留空表示清除显示名称" />
          </Form.Item>
          <p className="users-create-form__hint">用户名和显示名称可修改；等级、状态和权限不在后台编辑。</p>
        </Form>
      </Modal>
    </div>
  );
}
