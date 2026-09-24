export interface AdminExamListItem {
  id: string;
  title: string;
  level: string;
  year: number | null;
  month: number | null;
  published: boolean;
  question_count: number;
  available_count: number;
  pending_review_count: number;
  vocabulary_count: number;
  grammar_count: number;
  reading_count: number;
  listening_count: number;
}

export interface AdminExamsResponse {
  items: AdminExamListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminExamListParams {
  keyword?: string;
  level?: string;
  year?: number;
  month?: number;
  published?: boolean;
  has_issues?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
