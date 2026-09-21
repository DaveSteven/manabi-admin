import { api } from '../lib/api';
import type { AdminUser } from '../types/auth';
import type { AdminUserCreateInput, AdminUserListParams, AdminUsersResponse } from '../types/users';

export const usersService = {
  list: async (params: AdminUserListParams) =>
    (await api.get<AdminUsersResponse>('/admin/users', { params })).data,
  create: async (input: AdminUserCreateInput) =>
    (await api.post<AdminUser>('/admin/users', input)).data,
};
