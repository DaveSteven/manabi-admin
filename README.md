# Manabi Admin

Manabi 学习平台的 React 管理后台。当前为阶段 1：管理员登录闭环、会话恢复与自动退出、后台布局与导航、统一设计系统与模块入口。后续阶段在此基础上接入用户管理、真题管理、审核与发布等功能。

## 技术栈

- React 19 + TypeScript + Vite
- Ant Design 5（Design Token 主题）+ Sass
- React Router、TanStack Query、Axios
- Vitest + Testing Library（jsdom）

## 环境要求

- Node.js 20.19+ 或 22.13+（部分 ESLint 依赖要求）
- 运行中的 `manabi_api`（默认 `http://127.0.0.1:8001`）
- 一个 `is_admin = true` 的管理员账号

管理后台不提供公开注册。初始管理员由后端通过服务器权限安全设置：

```bash
# 在 manabi_api 目录执行（交互式输入密码）
python -m scripts.set_admin <username>
```

## 本地运行

```bash
npm install
cp .env.example .env   # 按需修改 API 地址
npm run dev            # http://localhost:5174
```

开发环境默认通过 Vite 代理访问 `/api`，避免跨域。只有 `is_admin=true` 的账号可以进入后台；普通账号登录后会被拒绝，并立即撤销本次签发的 token。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | 浏览器请求的 API 前缀 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8001` | 仅开发环境：Vite 将 `/api` 代理到的后端地址 |

详见 `.env.example`。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（端口 5174） |
| `npm run build` | 类型检查并产出生产构建到 `dist/` |
| `npm run lint` | ESLint 检查 |
| `npm test` | 运行全部测试（Vitest，单次） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run preview` | 本地预览生产构建 |

阶段完成标准要求 `npm run build`、`npm run lint`、`npm test` 均通过。

## 已实现范围（阶段 1）

- 管理员登录：对接 `POST /api/v1/auth/login`，校验 `user.is_admin`，中文错误提示，防重复提交，登录后跳回原目标页。
- 会话恢复：启动时调用 `GET /api/v1/me`，全屏加载；401 清理会话并跳转登录。
- 自动退出与主动退出：`POST /api/v1/auth/logout`；退出失败使用待撤销机制保留 token 并可重试。
- 后台布局：侧栏导航、折叠、顶部管理员信息与退出菜单；手机端使用覆盖式抽屉导航。
- 路由：`/login`、`/`（工作台）、`/users`、`/exams`、`/reviews`、`/assets`、`/audit-logs`，未知路径显示 404。
- 设计系统：Ant Design Token + Sass token（`src/styles/_tokens.scss`）、状态标签、空/错误状态、全屏加载、确认弹窗、日文排版规则。

未实现模块统一显示明确空状态，**不展示任何模拟或虚假数据**。

## 真实 API 联调检查（阶段 1）

仓库不保存任何凭据。推荐在本地用一次性账号自动完成联调：脚本会在本地后端数据库创建管理员与普通账号，验证后立即删除账号及其 token。

```bash
# 先确保 manabi_api（Docker）与前端 dev server 正在运行
MANABI_PROVISION_LOCAL=1 MANABI_BROWSER=1 \
MANABI_PLAYWRIGHT_PATH=<playwright 模块路径> \
npm run check:integration
```

- `MANABI_PROVISION_LOCAL=1`：通过本地 `manabi-db-1` 容器创建并清理一次性账号（可用 `MANABI_DB_CONTAINER` 覆盖容器名）。
- `MANABI_BROWSER=1` + `MANABI_PLAYWRIGHT_PATH`：同时执行真实浏览器全流程；省略则只做 API 检查。
- 也可改为注入已有账号（不写入仓库）：`MANABI_ADMIN_USERNAME`/`MANABI_ADMIN_PASSWORD`、`MANABI_NORMAL_USERNAME`/`MANABI_NORMAL_PASSWORD`。

检查项：未认证 `GET /me` 401；管理员登录且 `is_admin=true`、`GET /me` 恢复；退出后同一 token `/me` 401；普通用户登出后 token 401；浏览器登录、刷新恢复、全部路由与空状态、404、退出清 token、受保护路由跳转、普通用户拒绝且服务端 token 撤销。任一失败脚本以非零退出。

## 目录结构（节选）

```text
src/
├─ components/       通用组件（PageHeader、Brand、common/、feedback/）
├─ layout/           AdminLayout
├─ lib/              api、errors、storage、designTokens、confirm 相关
├─ pages/            各路由页面
├─ providers/        AuthProvider、ConfirmProvider
├─ services/         接口封装
├─ styles/           token、mixins、utilities、main.scss
├─ test/             测试环境初始化
└─ theme.ts          Ant Design 主题
```

## 说明

- 所有权限以后端校验为准，前端菜单隐藏不作为权限控制。
- 密码与 token 不写入日志；失效 token 的清理按会话身份隔离处理。
