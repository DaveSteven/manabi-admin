import axios from 'axios';

const NETWORK_MESSAGE = '无法连接服务器，请检查 API 服务是否已启动。';
const DEFAULT_MESSAGE = '操作失败，请稍后重试。';

export class AdminAccessRequiredError extends Error {
  constructor() {
    super('ADMIN_REQUIRED');
    this.name = 'AdminAccessRequiredError';
  }
}

export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function apiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const detail = error.response?.data?.detail;
  if (detail && typeof detail === 'object' && typeof detail.code === 'string') return detail.code;
  return undefined;
}

export function apiErrorMessage(
  error: unknown,
  statusMessages: Record<number, string> = {},
  fallback: string = DEFAULT_MESSAGE,
): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return NETWORK_MESSAGE;

  const mapped = statusMessages[error.response.status];
  if (mapped) return mapped;

  const detail = error.response.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message;
  return fallback;
}
