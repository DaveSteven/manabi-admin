#!/usr/bin/env node
// Real-API acceptance check for stage 1.
//
// Credentials are never stored in the repo. Two ways to supply them:
//   1) MANABI_PROVISION_LOCAL=1  -> create one-time admin/normal accounts in the
//      local backend database (via the `manabi-db-1` docker container), run the
//      checks, then delete the accounts and their tokens.
//   2) MANABI_ADMIN_USERNAME / MANABI_ADMIN_PASSWORD (+ optional normal user envs)
//      -> use existing accounts.
//
// Optional browser flow: MANABI_BROWSER=1 with MANABI_PLAYWRIGHT_PATH=<module path>.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const API_BASE = process.env.MANABI_API_BASE_URL ?? 'http://127.0.0.1:8001/api/v1';
const WEB_BASE = process.env.MANABI_WEB_BASE_URL ?? 'http://localhost:5174';
const DB_CONTAINER = process.env.MANABI_DB_CONTAINER ?? 'manabi-db-1';
const PROVISION = process.env.MANABI_PROVISION_LOCAL === '1';
const RUN_BROWSER = process.env.MANABI_BROWSER === '1';
const PLAYWRIGHT_PATH = process.env.MANABI_PLAYWRIGHT_PATH;

const results = [];
const record = (name, ok, detail = '') => results.push({ name, ok, detail });

function psql(statement) {
  return execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'manabi', '-d', 'manabi', '-v', 'ON_ERROR_STOP=1', '-tAc', statement],
    { encoding: 'utf8' },
  ).trim();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$600000$${salt}$${hash}`;
}

function createAccount(username, password, isAdmin, level) {
  psql(`INSERT INTO users (id, username, password_hash, is_admin, level, created_at) VALUES `
    + `('${crypto.randomUUID()}', '${username}', '${hashPassword(password)}', ${isAdmin}, '${level}', now())`);
}

function deleteAccounts() {
  psql("DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'a06%')");
  psql("DELETE FROM users WHERE username LIKE 'a06%'");
}

async function request(path, options) {
  const response = await fetch(API_BASE + path, options);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function apiChecks(admin, normal) {
  const health = await request('/health');
  record('health', health.status === 200, String(health.status));

  const unauth = await request('/me');
  record('unauthenticated /me -> 401', unauth.status === 401, String(unauth.status));

  const login = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(admin),
  });
  record('admin login', login.status === 200 && login.body?.user?.is_admin === true, String(login.status));
  const adminToken = login.body?.access_token;
  if (!adminToken) return;

  const me = await request('/me', { headers: { Authorization: `Bearer ${adminToken}` } });
  record('admin /me restore', me.status === 200 && me.body?.username === admin.username, String(me.status));

  const logout = await request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
  record('admin logout', logout.status === 204, String(logout.status));

  const after = await request('/me', { headers: { Authorization: `Bearer ${adminToken}` } });
  record('admin /me after logout -> 401', after.status === 401, String(after.status));

  if (!normal?.username || !normal?.password) return;
  const normalLogin = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normal),
  });
  record('normal login (is_admin=false)', normalLogin.status === 200 && normalLogin.body?.user?.is_admin === false, String(normalLogin.status));
  const normalToken = normalLogin.body?.access_token;
  if (!normalToken) return;
  await request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${normalToken}` } });
  const normalAfter = await request('/me', { headers: { Authorization: `Bearer ${normalToken}` } });
  record('normal token revoked -> 401', normalAfter.status === 401, String(normalAfter.status));
}

async function browserFlow(admin, normal) {
  const require = createRequire(import.meta.url);
  const { chromium } = require(PLAYWRIGHT_PATH);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let normalToken;

  try {
    page.on('response', async (response) => {
      if (response.url().endsWith('/auth/login')) {
        try {
          const body = await response.json();
          if (body.user && body.user.is_admin === false) normalToken = body.access_token;
        } catch { /* ignore */ }
      }
    });

    await page.goto(`${WEB_BASE}/login`);
    await page.locator('.login-card').waitFor();
    await page.getByLabel('管理员账号').fill(admin.username);
    await page.getByLabel('密码').fill(admin.password);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.getByRole('heading', { name: new RegExp(`你好，${admin.username}`) }).waitFor();
    record('browser admin login', true, 'dashboard');

    await page.reload();
    await page.getByRole('heading', { name: new RegExp(`你好，${admin.username}`) }).waitFor();
    record('browser refresh restore', true, 'real /me');

    for (const [path, heading] of [['/users', '用户管理'], ['/exams', '真题管理'], ['/reviews', '内容审核'], ['/assets', '媒体资源'], ['/audit-logs', '操作记录']]) {
      await page.goto(WEB_BASE + path);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await page.getByText('不会展示模拟数据').waitFor();
    }
    record('browser routes + empty state', true, '5 routes');

    await page.goto(`${WEB_BASE}/does-not-exist`);
    await page.getByRole('heading', { name: '页面不存在', exact: true }).waitFor();
    record('browser 404', true, '/does-not-exist');

    await page.goto(`${WEB_BASE}/`);
    await page.getByRole('heading', { name: new RegExp(`你好，${admin.username}`) }).waitFor();
    await page.locator('.profile-button').click();
    await page.getByText('退出登录', { exact: true }).click();
    await page.waitForURL('**/login');
    record('browser logout clears token', (await page.evaluate(() => localStorage.getItem('manabi_admin_token'))) === null, '');
    await page.goto(`${WEB_BASE}/users`);
    await page.waitForURL('**/login');
    record('browser protected redirect', true, '/users -> /login');

    if (normal?.username && normal?.password) {
      await page.goto(`${WEB_BASE}/login`);
      await page.locator('.login-card').waitFor();
      await page.getByLabel('管理员账号').fill(normal.username);
      await page.getByLabel('密码').fill(normal.password);
      await page.getByRole('button', { name: /登\s*录/ }).click();
      await page.getByText('此账号没有管理权限。').waitFor();
      record('browser normal rejected', true, '');
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (normalToken) {
        const me = await page.request.get(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${normalToken}` } });
        record('browser normal token revoked', me.status() === 401, String(me.status()));
      } else {
        record('browser normal token revoked', false, 'token not captured');
      }
    }

    record('browser page errors', errors.length === 0, errors.join('; '));
  } finally {
    await browser.close();
  }
}

async function main() {
  let admin;
  let normal;
  let provisioned = false;

  if (PROVISION) {
    const suffix = crypto.randomBytes(4).toString('hex');
    admin = { username: `a06admin_${suffix}`, password: crypto.randomBytes(16).toString('hex') };
    normal = { username: `a06user_${suffix}`, password: crypto.randomBytes(16).toString('hex') };
    createAccount(admin.username, admin.password, 'true', 'N1');
    createAccount(normal.username, normal.password, 'false', 'N3');
    provisioned = true;
  } else {
    admin = { username: process.env.MANABI_ADMIN_USERNAME, password: process.env.MANABI_ADMIN_PASSWORD };
    normal = { username: process.env.MANABI_NORMAL_USERNAME, password: process.env.MANABI_NORMAL_PASSWORD };
  }

  try {
    if (!admin.username || !admin.password) {
      console.error('No credentials. Run with MANABI_PROVISION_LOCAL=1 (local docker DB) or inject MANABI_ADMIN_USERNAME/PASSWORD.');
      process.exitCode = 2;
      return;
    }
    await apiChecks(admin, normal);
    if (RUN_BROWSER && PLAYWRIGHT_PATH) await browserFlow(admin, normal);
    else record('browser flow', false, 'skipped: set MANABI_BROWSER=1 and MANABI_PLAYWRIGHT_PATH');
  } finally {
    if (provisioned) deleteAccounts();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ failed: failed.length, results }, null, 0));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exit(1);
});
