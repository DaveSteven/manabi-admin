import { Tag } from 'antd';
import { palette } from '../../lib/designTokens';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'brand' | 'default';

interface StatusDescriptor {
  label: string;
  tone: StatusTone;
}

const STATUS_MAP: Record<string, StatusDescriptor> = {
  ready: { label: '已发布', tone: 'success' },
  review: { label: '待复核', tone: 'warning' },
  hidden: { label: '已隐藏', tone: 'default' },
  retired: { label: '已退役', tone: 'default' },
  active: { label: '正常', tone: 'success' },
  disabled: { label: '已禁用', tone: 'error' },
  deleted: { label: '已删除', tone: 'default' },
  draft: { label: '草稿', tone: 'default' },
  in_review: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  unpublished: { label: '已下架', tone: 'default' },
  archived: { label: '已归档', tone: 'default' },
  editing: { label: '编辑中', tone: 'info' },
  submitted: { label: '待审核', tone: 'warning' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已退回', tone: 'error' },
};

const TONE_COLORS: Record<StatusTone, string> = {
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.primary,
  brand: palette.primary,
  default: palette.textSecondary,
};

export interface StatusTagProps {
  status?: string;
  label?: string;
  tone?: StatusTone;
}

export function StatusTag({ status, label, tone }: StatusTagProps) {
  const descriptor = status ? STATUS_MAP[status] : undefined;
  const text = label ?? descriptor?.label ?? status ?? '';
  const color = TONE_COLORS[tone ?? descriptor?.tone ?? 'default'];
  return <Tag color={color} className="status-tag">{text}</Tag>;
}
