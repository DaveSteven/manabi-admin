import { api } from '../lib/api';
import type { AdminExamListParams, AdminExamOverview, AdminExamsResponse } from '../types/exams';

export const examsService = {
  list: async (params: AdminExamListParams) =>
    (await api.get<AdminExamsResponse>('/admin/exams', { params })).data,
  get: async (id: string) =>
    (await api.get<AdminExamOverview>(`/admin/exams/${encodeURIComponent(id)}`)).data,
};
