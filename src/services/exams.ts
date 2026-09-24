import { api } from '../lib/api';
import type { AdminExamListParams, AdminExamsResponse } from '../types/exams';

export const examsService = {
  list: async (params: AdminExamListParams) =>
    (await api.get<AdminExamsResponse>('/admin/exams', { params })).data,
};
