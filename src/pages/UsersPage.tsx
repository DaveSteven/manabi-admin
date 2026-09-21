import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Modal, Select, Space, Table, type TableProps } from 'antd';
import type { SorterResult, TablePaginationConfig } from 'antd/es/table/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';
import { StatusTag } from '../components/common/StatusTag';
import { apiErrorMessage } from '../lib/errors';
import { usersService } from '../services/users';
import type { AdminUserCreateInput, AdminUserListItem } from '../types/users';

const DEFAULT_LIMIT = 20;
const DEFAULT_SORT = 'created_at';
const DEFAULT_ORDER: 'asc' | 'desc' = 'desc';
const SORTABLE_FIELDS = new Set(['username', 'level', 'status', 'created_at', 'last_login_at']);

const LEVEL_OPTIONS = ['N1', 'N2', 'N3', 'N4', 'N5'].map((value) => ({ value, label: value }));
const STATUS_OPTIONS = [
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已禁用' },
  { value: 'deleted', label: '已删除' },
];
const ROLE_OPTIONS = [
  { value: 'true', label: '管理员' },
  { value: 'false', label: '普通用户' },
];

interface UserListQuery {
  keyword?: string;
  level?: string;
  status?: string;
  is_admin?: boolean;
  sort: string;
  order: 'asc' | 'desc';
  limit: number;
  offset: number;
}

function parseParams(searchParams: URLSearchParams): UserListQuery {
  const limit = Number(searchParams.get('limit'));
  const offset = Number(searchParams.get('offset'));
  const sort = searchParams.get('sort');
  const order = searchParams.get('order');
  const role = searchParams.get('is_admin');
  return {
    keyword: searchParams.get('keyword') ?? undefined,
    level: searchParams.get('level') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    is_admin: role === 'true' ? true : role === 'false' ? false : undefined,
    sort: sort && SORTABLE_FIELDS.has(sort) ? sort : DEFAULT_SORT,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_ORDER,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  const [keyword, setKeyword] = useState(params.keyword ?? '');
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [createdUsername, setCreatedUsername] = useState<string>();
  const [form] = Form.useForm<AdminUserCreateInput>();
  const submittingRef = useRef(false);

  useEffect(() => {
    setKeyword(params.keyword ?? '');
  }, [params.keyword]);

  const query = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => usersService.list(params),
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

  const hasFilters = Boolean(params.keyword || params.level || params.status || params.is_admin !== undefined);

  const clearFilters = () => {
    setKeyword('');
    updateParams({ keyword: undefined, level: undefined, status: undefined, is_admin: undefined, offset: 0, sort: undefined, order: undefined });
  };

  const openCreate = () => {
    setCreateError(undefined);
    setCreatedUsername(undefined);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(undefined);
    form.resetFields();
  };

  const handleCreate = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      let values: AdminUserCreateInput;
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      setCreating(true);
      setCreateError(undefined);
      try {
        const created = await usersService.create({
          username: values.username.trim(),
          display_name: values.display_name?.trim() || undefined,
          password: values.password,
        });
        setCreateOpen(false);
        form.resetFields();
        setCreatedUsername(created.username ?? values.username.trim().toLowerCase());
        await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      } catch (error) {
        setCreateError(apiErrorMessage(error, { status: { 409: '该用户名已存在，请更换。' } }));
      } finally {
        setCreating(false);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const sortOrderFor = (field: string) => (
    params.sort === field ? (params.order === 'asc' ? 'ascend' : 'descend') : null
  );

  const columns: TableProps<AdminUserListItem>['columns'] = [
    { title: '用户名', dataIndex: 'username', key: 'username', sorter: true, sortOrder: sortOrderFor('username'), render: (value: string | null) => value ?? '—' },
    { title: '显示名称', dataIndex: 'display_name', key: 'display_name', render: (value: string | null) => value || '—' },
    { title: '等级', dataIndex: 'level', key: 'level', sorter: true, sortOrder: sortOrderFor('level') },
    { title: '状态', dataIndex: 'status', key: 'status', sorter: true, sortOrder: sortOrderFor('status'), render: (value: string) => <StatusTag status={value} /> },
    {
      title: '管理员', dataIndex: 'is_admin', key: 'is_admin',
      render: (value: boolean) => <StatusTag tone={value ? 'brand' : 'default'} label={value ? '管理员' : '普通用户'} />,
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', sorter: true, sortOrder: sortOrderFor('created_at'), render: formatDateTime },
    { title: '最近登录', dataIndex: 'last_login_at', key: 'last_login_at', sorter: true, sortOrder: sortOrderFor('last_login_at'), render: formatDateTime },
  ];

  const pagination: TablePaginationConfig = {
    current: Math.floor(params.offset / params.limit) + 1,
    pageSize: params.limit,
    total: query.data?.total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (total) => `共 ${total} 位用户`,
  };

  const handleTableChange: TableProps<AdminUserListItem>['onChange'] = (nextPagination, _filters, sorter) => {
    const active = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<AdminUserListItem> | undefined;
    const field = active?.field ? String(active.field) : undefined;
    const changes: Record<string, string | number | undefined> = {
      limit: nextPagination.pageSize ?? params.limit,
      offset: ((nextPagination.current ?? 1) - 1) * (nextPagination.pageSize ?? params.limit),
    };
    if (field && active?.order && SORTABLE_FIELDS.has(field)) {
      changes.sort = field;
      changes.order = active.order === 'ascend' ? 'asc' : 'desc';
    } else {
      changes.sort = undefined;
      changes.order = undefined;
    }
    updateParams(changes);
  };

  return (
    <div className="page users-page">
      <PageHeader
        eyebrow="PEOPLE"
        title="用户管理"
        action={(
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
            <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>
          </Space>
        )}
      />
      {createdUsername && (
        <Alert
          className="users-page__notice"
          type="success"
          showIcon
          closable
          message={`用户「${createdUsername}」已创建`}
          onClose={() => setCreatedUsername(undefined)}
        />
      )}
      <div className="users-filter-card">
        <Space wrap size={12}>
          <Input
            className="users-filter-card__keyword"
            value={keyword}
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索用户名或显示名称"
            onChange={(event) => {
              const value = event.target.value;
              setKeyword(value);
              if (value === '' && params.keyword) updateParams({ keyword: undefined, offset: 0 });
            }}
            onPressEnter={submitKeyword}
          />
          <Button type="primary" onClick={submitKeyword}>搜索</Button>
          <Select allowClear placeholder="全部等级" options={LEVEL_OPTIONS} value={params.level} className="users-filter-card__select"
            onChange={(value) => updateParams({ level: value, offset: 0 })} />
          <Select allowClear placeholder="全部状态" options={STATUS_OPTIONS} value={params.status} className="users-filter-card__select"
            onChange={(value) => updateParams({ status: value, offset: 0 })} />
          <Select allowClear placeholder="全部角色" options={ROLE_OPTIONS}
            value={params.is_admin === undefined ? undefined : String(params.is_admin)} className="users-filter-card__select"
            onChange={(value) => updateParams({ is_admin: value, offset: 0 })} />
          {hasFilters && <Button type="link" onClick={clearFilters}>清除筛选</Button>}
        </Space>
      </div>

      {query.isError ? (
        <StateBlock
          tone="error"
          title="用户列表加载失败"
          description={apiErrorMessage(query.error)}
          action={<Button type="primary" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : !query.isLoading && query.data && query.data.total === 0 ? (
        <StateBlock
          title={hasFilters ? '没有符合条件的用户' : '暂无用户'}
          description={hasFilters ? '请调整筛选条件后重试。' : '系统中还没有已注册用户。'}
          action={hasFilters ? <Button onClick={clearFilters}>清除筛选</Button> : undefined}
        />
      ) : (
        <Table<AdminUserListItem>
          className="users-table"
          rowKey="id"
          columns={columns}
          dataSource={query.data?.items ?? []}
          loading={query.isLoading || query.isFetching}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
        />
      )}

      <Modal
        title="新建用户"
        open={createOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        maskClosable={!creating}
        onOk={() => void handleCreate()}
        onCancel={closeCreate}
      >
        {createError && <Alert className="users-page__notice" type="error" showIcon message={createError} />}
        <Form form={form} layout="vertical" requiredMark={false} className="users-create-form">
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
            <Input autoComplete="off" placeholder="3–64 位字母、数字、_ . -" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name" rules={[{ max: 64, message: '显示名称最多 64 个字符' }]}>
            <Input autoComplete="off" placeholder="可选" />
          </Form.Item>
          <p className="users-create-form__hint">新用户默认 JLPT N5，可在用户详情中调整等级。</p>
          <Form.Item
            label="初始密码"
            name="password"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 8, message: '密码至少 8 位' },
              { max: 128, message: '密码最多 128 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="至少 8 位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
