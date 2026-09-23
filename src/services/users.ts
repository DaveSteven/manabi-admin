import { api } from '../lib/api';
import type { AdminUser } from '../types/auth';
import type {
  AdminUserCreateInput,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserStats,
  AdminUsersResponse,
} from '../types/users';

export const usersService = {
  list: async (params: AdminUserListParams) =>
    (await api.get<AdminUsersResponse>('/admin/users', { params })).data,
  create: async (input: AdminUserCreateInput) =>
    (await api.post<AdminUser>('/admin/users', input)).data,
  get: async (id: string) =>
    (await api.get<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)).data,
  stats: async (id: string) =>
    (await api.get<AdminUserStats>(`/admin/users/${encodeURIComponent(id)}/stats`)).data,
};
