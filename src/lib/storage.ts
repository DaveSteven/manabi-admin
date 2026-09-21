const TOKEN_KEY = 'manabi_admin_token';
const PENDING_REVOCATIONS_KEY = 'manabi_admin_pending_revocations';

export const tokenStorage = {
  get: () => window.localStorage.getItem(TOKEN_KEY),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

function readPendingRevocations(): string[] {
  try {
    const raw = window.localStorage.getItem(PENDING_REVOCATIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writePendingRevocations(tokens: string[]): void {
  if (tokens.length === 0) window.localStorage.removeItem(PENDING_REVOCATIONS_KEY);
  else window.localStorage.setItem(PENDING_REVOCATIONS_KEY, JSON.stringify(tokens));
}

export const pendingRevocationStorage = {
  list: (): string[] => readPendingRevocations(),
  add: (token: string): void => {
    if (!token) return;
    writePendingRevocations([...readPendingRevocations().filter((item) => item !== token), token]);
  },
  remove: (token: string): void => {
    writePendingRevocations(readPendingRevocations().filter((item) => item !== token));
  },
  clear: (): void => window.localStorage.removeItem(PENDING_REVOCATIONS_KEY),
};
