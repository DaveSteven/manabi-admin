import { describe, expect, it } from 'vitest';
import { AdminAccessRequiredError, apiErrorCode, apiErrorMessage, apiErrorStatus } from './errors';

function axiosError(status: number, detail: unknown) {
  return { isAxiosError: true, response: { status, data: { detail } } };
}

describe('apiErrorMessage', () => {
  it('无响应时返回网络错误中文提示', () => {
    expect(apiErrorMessage({ isAxiosError: true })).toBe('无法连接服务器，请检查 API 服务是否已启动。');
  });

  it('429 字符串英文 detail 映射为中文限流提示', () => {
    expect(apiErrorMessage(axiosError(429, 'Too Many Requests'))).toBe('请求过于频繁，请稍后再试。');
  });

  it('未在映射内的 5xx 使用中文服务兜底', () => {
    expect(apiErrorMessage(axiosError(599, 'Custom Server Failure'))).toBe('服务器暂时不可用，请稍后重试。');
  });

  it('未知状态和未知英文 code/message 使用中文兜底', () => {
    expect(apiErrorMessage(axiosError(418, { code: 'TEAPOT', message: 'I am a teapot' }))).toBe('操作失败，请稍后重试。');
  });

  it('优先使用调用方提供的稳定错误代码映射', () => {
    const message = apiErrorMessage(
      axiosError(409, { code: 'DRAFT_VERSION_CONFLICT', message: 'Conflict' }),
      { code: { DRAFT_VERSION_CONFLICT: '内容已被其他管理员修改。' } },
    );
    expect(message).toBe('内容已被其他管理员修改。');
  });

  it('调用方提供的状态映射优先于默认映射', () => {
    expect(apiErrorMessage(axiosError(401, 'Invalid username or password'), {
      status: { 401: '账号或密码错误。' },
    })).toBe('账号或密码错误。');
  });

  it('非 axios 错误返回中文兜底', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('操作失败，请稍后重试。');
  });
});

describe('apiError helpers', () => {
  it('读取状态码和稳定错误代码', () => {
    const error = axiosError(409, { code: 'DRAFT_VERSION_CONFLICT', message: 'Conflict' });
    expect(apiErrorStatus(error)).toBe(409);
    expect(apiErrorCode(error)).toBe('DRAFT_VERSION_CONFLICT');
  });

  it('AdminAccessRequiredError 携带撤销失败标记', () => {
    expect(new AdminAccessRequiredError().revokeFailed).toBe(false);
    expect(new AdminAccessRequiredError(true).revokeFailed).toBe(true);
  });
});
