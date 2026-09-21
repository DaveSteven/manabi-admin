# Manabi Admin

Manabi 的 React 管理后台。当前阶段包含 Quizlet 风格设计系统、管理员登录、会话恢复、受保护路由、后台布局和模块入口。

## 本地运行

1. 确保 `manabi_api` 在 `http://127.0.0.1:8001` 运行。
2. 安装依赖：`npm install`
3. 启动：`npm run dev`
4. 打开 `http://127.0.0.1:5174`

可复制 `.env.example` 为 `.env` 修改 API 地址。开发环境默认通过 Vite 代理访问 API，以避免跨域问题。

只有 `is_admin=true` 的账号可以进入后台。普通账号登录后会立即撤销本次 token，并显示无权限提示。
