import { ArrowLeftOutlined, CheckCircleOutlined, EditOutlined, KeyOutlined, LogoutOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Card, Descriptions, Form, Input, Modal, Space, Statistic, Table, Button, type TableProps } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { useConfirm } from '../providers/ConfirmProvider';
import { apiErrorCode, apiErrorStatus, apiErrorMessage } from '../lib/errors';
import { usersService } from '../services/users';
import type { AdminUserDetail, AdminUserStatsLevel, AdminUserUpdateInput } from '../types/users';

interface EditFormValues {
  username: string;
  display_name?: string;
}

interface DisableFormValues {
  reason: string;
}

interface ResetFormValues {
  password: string;
  confirm: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

function formatAccuracy(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function passwordStrength(password: string): { label: string; tone: 'error' | 'warning' | 'success' } {
  let score = 0;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length < 8) return { label: '密码强度：弱', tone: 'error' };
  if (score >= 4) return { label: '密码强度：强', tone: 'success' };
  if (score >= 2) return { label: '密码强度：中', tone: 'warning' };
  return { label: '密码强度：弱', tone: 'error' };
}

function adminActionMessage(error: unknown): string {
  const code = apiErrorCode(error);
  if (code === 'CANNOT_DISABLE_SELF') return '不能禁用当前登录账号。';
  if (code === 'LAST_ADMIN_PROTECTED') return '不能禁用最后一个管理员。';
  if (code === 'USER_DELETED') return '该用户已删除，无法执行该操作。';
  return apiErrorMessage(error);
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string>();
  const [disableOpen, setDisableOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string>();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string>();
  const [revoking, setRevoking] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editForm] = Form.useForm<EditFormValues>();
  const [disableForm] = Form.useForm<DisableFormValues>();
  const [resetForm] = Form.useForm<ResetFormValues>();
  const watchedPassword = Form.useWatch('password', resetForm);

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

  const applyUpdated = (updated: AdminUserDetail) => {
    queryClient.setQueryData(['admin', 'users', userId], updated);
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'users'],
      predicate: (query) => query.queryKey.length === 3 && typeof query.queryKey[2] === 'object',
    });
  };

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
      applyUpdated(updated);
      setEditOpen(false);
      setNotice('用户资料已更新');
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'EDIT_CONFLICT') setEditError('该用户资料已被其他管理员修改，请刷新后重试。');
      else if (code === 'USERNAME_TAKEN') setEditError('该用户名已存在，请更换。');
      else setEditError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openDisable = () => {
    setDisableError(undefined);
    disableForm.resetFields();
    setDisableOpen(true);
  };

  const closeDisable = () => {
    if (disabling) return;
    setDisableOpen(false);
    setDisableError(undefined);
  };

  const submitDisable = async () => {
    if (disabling || !userId) return;
    let values: DisableFormValues;
    try {
      values = await disableForm.validateFields();
    } catch {
      return;
    }
    setDisabling(true);
    setDisableError(undefined);
    try {
      const updated = await usersService.disable(userId, { reason: values.reason.trim() });
      applyUpdated(updated);
      setDisableOpen(false);
      setNotice('用户已禁用');
    } catch (error) {
      setDisableError(adminActionMessage(error));
    } finally {
      setDisabling(false);
    }
  };

  const enableUser = async () => {
    if (!detail || !userId) return;
    const ok = await confirm({
      title: '启用用户',
      content: `确定要启用「${detail.username ?? detail.id}」吗？该用户可以重新登录。`,
      okText: '启用',
    });
    if (!ok) return;
    setActionError(undefined);
    try {
      const updated = await usersService.enable(userId);
      applyUpdated(updated);
      setNotice('用户已启用');
    } catch (error) {
      setActionError(adminActionMessage(error));
    }
  };

  const openReset = () => {
    setResetError(undefined);
    resetForm.resetFields();
    setResetOpen(true);
  };

  const closeReset = () => {
    if (resetting) return;
    setResetOpen(false);
    setResetError(undefined);
  };

  const submitReset = async () => {
    if (resetting || !userId) return;
    let values: ResetFormValues;
    try {
      values = await resetForm.validateFields();
    } catch {
      return;
    }
    setResetting(true);
    setResetError(undefined);
    try {
      await usersService.resetPassword(userId, { password: values.password });
      setResetOpen(false);
      setNotice('密码已重置，该用户的登录会话已全部失效');
    } catch (error) {
      setResetError(adminActionMessage(error));
    } finally {
      setResetting(false);
    }
  };

  const revokeSessions = async () => {
    if (!detail || !userId) return;
    const ok = await confirm({
      title: '撤销全部会话',
      content: `确定要撤销「${detail.username ?? detail.id}」的全部登录会话吗？`,
      okText: '撤销',
      danger: true,
    });
    if (!ok) return;
    setActionError(undefined);
    setRevoking(true);
    try {
      await usersService.revokeTokens(userId);
      setNotice('已撤销该用户的全部登录会话');
    } catch (error) {
      setActionError(adminActionMessage(error));
    } finally {
      setRevoking(false);
    }
  };

  const strength = watchedPassword ? passwordStrength(watchedPassword) : undefined;

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
          <Space wrap>
            <Button type="primary" icon={<EditOutlined />} disabled={!detail || detail.status === 'deleted'} onClick={openEdit}>编辑资料</Button>
            {detail?.status === 'active' && (
              <Button danger icon={<StopOutlined />} onClick={openDisable}>禁用用户</Button>
            )}
            {detail?.status === 'disabled' && (
              <Button icon={<CheckCircleOutlined />} onClick={() => void enableUser()}>启用用户</Button>
            )}
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

      {notice && (
        <Alert
          className="users-page__notice"
          type="success"
          showIcon
          closable
          message={notice}
          onClose={() => setNotice(undefined)}
        />
      )}
      {actionError && (
        <Alert
          className="users-page__notice"
          type="error"
          showIcon
          closable
          message={actionError}
          onClose={() => setActionError(undefined)}
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

      <Card className="user-detail-card" title="账号安全" loading={detailQuery.isLoading}>
        {detail && (
          <>
            <Space wrap>
              <Button icon={<KeyOutlined />} disabled={detail.status === 'deleted'} onClick={openReset}>重置密码</Button>
              <Button
                danger
                icon={<LogoutOutlined />}
                disabled={detail.status === 'deleted'}
                loading={revoking}
                onClick={() => void revokeSessions()}
              >
                撤销全部会话
              </Button>
            </Space>
            <p className="users-create-form__hint">重置密码会同时撤销该用户全部登录会话；撤销会话不会修改密码。旧密码不会被显示。</p>
          </>
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

      <Modal
        title="禁用用户"
        open={disableOpen}
        okText="确认禁用"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={disabling}
        maskClosable={!disabling}
        onOk={() => void submitDisable()}
        onCancel={closeDisable}
      >
        {disableError && <Alert className="users-page__notice" type="error" showIcon message={disableError} />}
        <p className="users-create-form__hint">禁用后该用户将无法登录，且其全部登录会话会被立即撤销。</p>
        <Form form={disableForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="禁用原因"
            name="reason"
            rules={[
              { required: true, message: '请输入禁用原因' },
              { max: 500, message: '禁用原因最多 500 个字符' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} placeholder="请说明禁用原因（用于后续审计）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={resetOpen}
        okText="确认重置"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={resetting}
        maskClosable={!resetting}
        onOk={() => void submitReset()}
        onCancel={closeReset}
      >
        {resetError && <Alert className="users-page__notice" type="error" showIcon message={resetError} />}
        <p className="users-create-form__hint">重置后该用户的全部登录会话将立即失效，需要使用新密码重新登录。旧密码不会被显示。</p>
        <Form form={resetForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位' },
              { max: 128, message: '密码最多 128 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="至少 8 位" />
          </Form.Item>
          {strength && (
            <p className={`user-detail-strength user-detail-strength--${strength.tone}`}>{strength.label}</p>
          )}
          <Form.Item
            label="确认新密码"
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
