import { api } from '../lib/api';
import type { AdminUserListParams, AdminUsersResponse } from '../types/users';

export const usersService = {
  list: async (params: AdminUserListParams) =>
    (await api.get<AdminUsersResponse>('/admin/users', { params })).data,
};
