import { api } from '../lib/api';
import type { AdminUser, LoginInput, LoginResponse } from '../types/auth';

export const authService = {
  login: async (input: LoginInput) =>
    (await api.post<LoginResponse>('/auth/login', input)).data,
  me: async () => (await api.get<AdminUser>('/me')).data,
  logout: async (token?: string) => {
    await api.post('/auth/logout', null, token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined);
  },
};
