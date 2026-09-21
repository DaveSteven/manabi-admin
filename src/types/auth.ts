export interface AdminUser {
  id: string;
  username: string | null;
  level: string;
  is_guest: boolean;
  is_admin: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AdminUser;
}

export interface LoginInput {
  username: string;
  password: string;
}
