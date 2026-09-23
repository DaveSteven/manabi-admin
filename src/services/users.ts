import { api } from '../lib/api';
import type { AdminUser } from '../types/auth';
import type {
  AdminPasswordResetInput,
  AdminUserCreateInput,
  AdminUserDetail,
  AdminUserDisableInput,
  AdminUserListParams,
  AdminUserStats,
  AdminUserUpdateInput,
  AdminUsersResponse,
} from '../types/users';

export const usersService = {
  list: async (params: AdminUserListParams) =>
    (await api.get<AdminUsersResponse>('/admin/users', { params })).data,
  create: async (input: AdminUserCreateInput) =>
    (await api.post<AdminUser>('/admin/users', input)).data,
  get: async (id: string) =>
    (await api.get<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)).data,
  update: async (id: string, input: AdminUserUpdateInput) =>
    (await api.patch<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, input)).data,
  disable: async (id: string, input: AdminUserDisableInput = {}) =>
    (await api.post<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/disable`, input)).data,
  enable: async (id: string) =>
    (await api.post<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/enable`)).data,
  resetPassword: async (id: string, input: AdminPasswordResetInput) =>
    (await api.post<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/reset-password`, input)).data,
  revokeTokens: async (id: string) =>
    (await api.post<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/revoke-tokens`)).data,
  stats: async (id: string) =>
    (await api.get<AdminUserStats>(`/admin/users/${encodeURIComponent(id)}/stats`)).data,
};
