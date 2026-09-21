import axios from 'axios';

const NETWORK_MESSAGE = '无法连接服务器，请检查 API 服务是否已启动。';
const SERVER_MESSAGE = '服务器暂时不可用，请稍后重试。';
const DEFAULT_MESSAGE = '操作失败，请稍后重试。';

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求有误，请检查后重试。',
  401: '登录状态已失效，请重新登录。',
  403: '没有权限执行此操作。',
  404: '请求的资源不存在。',
  409: '操作冲突，请刷新后重试。',
  413: '上传内容过大，请调整后重试。',
  422: '提交的内容格式不正确。',
  429: '请求过于频繁，请稍后再试。',
  500: SERVER_MESSAGE,
  502: SERVER_MESSAGE,
  503: SERVER_MESSAGE,
  504: '服务器响应超时，请稍后重试。',
};

export interface ApiErrorMessageOptions {
  status?: Record<number, string>;
  code?: Record<string, string>;
  fallback?: string;
}

export class AdminAccessRequiredError extends Error {
  readonly revokeFailed: boolean;

  constructor(revokeFailed = false) {
    super('ADMIN_REQUIRED');
    this.name = 'AdminAccessRequiredError';
    this.revokeFailed = revokeFailed;
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

export function apiErrorMessage(error: unknown, options: ApiErrorMessageOptions = {}): string {
  const { status: statusMessages = {}, code: codeMessages = {}, fallback = DEFAULT_MESSAGE } = options;

  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return NETWORK_MESSAGE;

  const status = error.response.status;

  const code = apiErrorCode(error);
  if (code && codeMessages[code]) return codeMessages[code];

  if (statusMessages[status]) return statusMessages[status];
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return SERVER_MESSAGE;
  return fallback;
}
