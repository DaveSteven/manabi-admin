export interface AdminUserListItem {
  id: string;
  username: string | null;
  display_name: string | null;
  level: string;
  status: string;
  is_admin: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

export interface AdminUsersResponse {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserListParams {
  keyword?: string;
  level?: string;
  status?: string;
  is_admin?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
