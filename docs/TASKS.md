# Manabi Admin 垂直任务清单

# 里程碑 A：阶段 1 基础框架收尾

## A01：检查并修复当前前端工程

**状态：验收通过**

### Review

- 验收日期：2026-09-21
- 验收提交：`8eb1753`
- 结论：符合 A01 验收标准，可继续 A02。
- 实际验证：`npm install`、`npm run build`、`npm run lint` 均通过；TypeScript 和 Sass 编译正常；开发服务 `/login` 返回 200；代理及直连 `/api/v1/me` 均返回未认证 401；环境变量示例与代码默认值一致。
- 非阻断建议：`eslint.config.js:16` 为 `useAuth` 添加白名单仅消除 lint 警告，未解决组件与 Hook 混合导出的 Fast Refresh 边界问题，建议后续拆分文件。
- 非阻断警告：Node 22.12.0 不满足 `eslint-visitor-keys@5.0.1` 的版本要求，安装出现 `EBADENGINE`；本次构建和 lint 通过。主 JS 包约 890 kB，触发体积警告，可后续按路由拆包。
- 验收边界：未验收真实账号登录、会话恢复和退出业务，分别在后续任务中验证。

### 目标

确保现有 `manabi_admin` 可以安装、构建和启动。

### 范围

- 检查现有 `package.json`
- 安装依赖
- 修复 TypeScript 错误
- 修复 ESLint 错误
- 修复 Sass 编译问题
- 检查环境变量
- 检查 Vite API 代理
- 不增加新业务功能

### 验收

```text
npm install
npm run build
npm run lint
```

全部通过。

---

## A02：管理员登录完整闭环

**状态：验收通过**

最新验收结论：Review 3 验收通过；历史 Review、Bug 记录及用户澄清保留，历史问题状态不代表当前结论。

### Review

- 验收日期：2026-09-21
- 验收提交：`4050e41`
- 结论：暂不通过；正常登录流程已有测试覆盖，以下两项问题需修复后复验。
- 实际验证：原有 6 个测试通过，`npm run build`、`npm run lint` 通过；两项临时复现测试确认下述异常行为，临时测试已清理。
- 验收边界：现有测试 mock 了 `authService`，未使用真实账号验证服务端 token 撤销，不能以 mock 调用成功证明真实 token 已失效。

#### R1 / P1：普通用户 token 撤销失败被静默忽略（未解决）

- 位置：`src/providers/AuthProvider.tsx:65-70`，尤其第 68 行。
- 触发：普通用户登录成功后，`POST /auth/logout` 因网络故障或服务端错误失败；复现使用 503 拒绝响应。
- 当前行为：`.catch(() => undefined)` 吞掉错误，清除本地 token，仅提示没有管理权限。
- 影响：服务端 token 可能仍有效，不满足“普通用户本次 token 必须撤销”；本地清除不等于服务端撤销。
- 修改要求：明确处理撤销失败并提供可重试的清理流程，始终拒绝普通用户进入后台；不得将未确认的撤销视为成功，不能只吞掉错误后丢弃重试所需信息。避免将待撤销 token 当作有效管理员会话。
- 复验要求：补充撤销成功、网络或 5xx 失败、失败后重试成功的测试；验证 logout 使用本次普通用户 token；验证失败期间无法进入受保护页面且不泄漏 token。真实 API 验证应确认撤销后该 token 访问 `/me` 返回 401；如未实测须明确记录。

#### R2 / P2：部分服务端错误仍直接显示英文（未解决）

- 位置：`src/lib/errors.ts:35-37`；调用处 `src/pages/LoginPage.tsx`。
- 触发：登录返回未映射的 HTTP 状态，且 `detail` 或 `detail.message` 是英文；已复现 429 + `Too Many Requests`。
- 当前行为：直接显示后端英文原文。
- 影响：不满足 A02 的中文错误提示要求。
- 修改要求：按稳定错误代码或 HTTP 状态映射中文提示；未知错误使用中文兜底，不依赖英文错误文本做业务判断。
- 复验要求：覆盖 429、5xx、未知错误代码以及字符串和对象形式的英文 detail，确认页面不显示原始英文；保留现有 401、403、422 和网络错误测试。

### 补充 Bug 记录

#### R3 / P2：登录后头部右侧元素高度超出父元素（待修复、待复现）

- 记录日期：2026-09-21。
- 来源：用户反馈；本条为 Bug 登记，尚未进行浏览器复现或正式复验，不改变已有 Review 结论。
- 位置：`src/layout/AdminLayout.tsx` 中的 `.admin-header__right`；相关样式位于 `src/styles/main.scss` 的 `.admin-header` 与 `.admin-header__right`。
- 触发：管理员登录后进入后台页面。
- 用户观察：`admin-header__right` 元素高度超出父元素，导致头部样式显示异常。
- 影响：登录后的后台头部布局显示不正确。
- 修改要求：由 Coding Worker 先复现并定位高度溢出的原因，修正头部及右侧内容的尺寸和对齐；保证内容完整可见、操作正常，不以裁剪内容掩盖问题。
- 允许修改：`src/layout/AdminLayout.tsx`、`src/styles/main.scss`；必要时补充直接相关的布局测试。该问题纳入 A02 修复范围，不扩大为 A04 整体布局重构。
- 复验要求：在浏览器登录后检查右侧元素未超出父元素，文字和控件无裁剪、重叠；验证桌面与小屏幕、侧栏展开与折叠时布局正常，右侧操作仍可用；执行 `npm run build`、`npm run lint`，记录实际验证结果及未验证范围。

### Review 2

- Date: 2026-09-21
- 验收对象：A02 工作区修复，包括 R1、R2、R3 及相关新增测试。
- Revision: `4050e41c8011d724deaf250700f09bc5fe2642a2` + 当前未提交工作区（包含未跟踪的 `src/lib/errors.test.ts`）。
- Result: **待修改**。

Validation:

- `npm test`：PASS，2 个测试文件、22 项测试通过。
- `npm run build`：PASS；仍有约 892 kB 主 JS 包体积警告，非本轮阻断项。
- `npm run lint`：FAIL，`src/components/PageHeader.tsx:3:46` 的 `description` 未使用。
- Chrome 无头浏览器 + Playwright，使用受控 API 响应加载真实前端：1440×900 和 390×900、侧栏展开与折叠四种组合中，头部高 76px、右侧元素高 46px，垂直范围 14.5–60.5px，未超出父元素；小屏幕退出菜单可展开。
- 同一浏览器流程复现旧 token 撤销 401 清除新管理员会话；390px 宽度下头像字母的计算样式为 `display: none`，尺寸为 0×0。
- 浏览器复验脚本：`/private/tmp/a02-review.cjs`（本机临时验证材料，使用测试凭据和受控响应，不包含真实账号凭据）。

Not Verified:

- 未使用真实账号、真实后端验证登录及 token 撤销；不能据此宣称服务端 token 已失效。
- 未进行 Safari、Firefox 或真实移动设备验证。
- 现有撤销测试使用 `authService` mock；未覆盖真实 Axios 拦截器的会话隔离，亦未单独覆盖撤销网络失败路径。

Resolved / Remaining:

- 历史 R1：503 失败提示、保留待撤销 token、手动重试成功和拒绝普通用户进入的已有测试通过；新增并发流程仍存在会话隔离缺陷，见 R2-1。
- 历史 R2：PASS。429、5xx、未知状态及错误代码、字符串/对象英文 detail 均使用中文映射或兜底，现有 401、403、422 和登录网络错误测试通过。
- 历史 R3：原高度溢出已通过浏览器尺寸复验；小屏幕头像内容仍被误隐藏，见 R2-3。

#### R2-1 / P1：旧 token 撤销响应会清除新管理员会话

- Location: `src/lib/api.ts:19-21`；关联 `src/providers/AuthProvider.tsx:46-54`、`src/pages/LoginPage.tsx:57-63`。
- Trigger: 登录页有待撤销 token；点击“重试”并延迟该请求响应；此时登录管理员成功；旧 token 的撤销请求随后返回 401（例如 token 已失效）。
- Actual: 全局响应拦截器无条件清除当前 token 并发送 `manabi:unauthorized`；浏览器确认新管理员 token 被删除，页面回到 `/login`。
- Impact: 待撤销会话的正常清理结果影响无关的新会话，管理员成功登录后被错误退出。
- Required Change: 将待撤销 token 请求与当前管理员会话的 401 处理隔离；仅与当前会话相关的认证失败才允许清理该会话。保留当前会话真正失效时的自动退出行为。不得通过忽略所有 401 或删除全局认证保护解决。
- Revalidation: 使用真实 Axios 请求/响应拦截器和受控 adapter 或浏览器响应，覆盖“旧 token 重试 → 新管理员登录 → 旧请求 401”仍保持管理员会话；确认待撤销记录清理、Authorization 使用旧 token；覆盖当前管理员 token 自身 401 仍退出，以及撤销网络失败、503、再次重试成功。

#### R2-2 / P2：页面描述被范围外删除，并导致 lint 失败

- Location: `src/components/PageHeader.tsx:3`、`:13`。
- Trigger: 渲染传入 `description` 的工作台或模块页面；执行 `npm run lint`。
- Actual: 原有描述段落被删除，页面说明不再显示；解构参数仍保留，触发 `@typescript-eslint/no-unused-vars`。
- Impact: 与头部右侧高度修复无关的页面内容回退，且不满足前端统一完成标准。
- Required Change: 恢复原有 description 渲染；不要仅删除参数、关闭 lint 规则或扩大页面重构范围。保留其他既有工作区修改。
- Revalidation: `npm run lint` 与 `npm run build` 均通过；确认工作台与模块页面的描述正常显示。

#### R2-3 / P2：小屏幕选择器误隐藏头像内部内容

- Location: `src/styles/main.scss:74`。
- Trigger: 视口宽度不超过 720px，登录后显示管理员头像。
- Actual: `.profile-button span:last-child` 同时命中 Ant Design Avatar 内部的 `.ant-avatar-string`；390px 实测字母 A 为 `display: none`，只剩空头像。侧栏展开和折叠均可复现。
- Impact: R3 要求的内容完整可见尚未满足，登录后的账号入口信息显示不完整。
- Required Change: 使用明确的用户名容器类名或限于直接子元素的选择器，只隐藏预期的用户名文本，不影响 Avatar 内部内容；保持现有头部高度修复。
- Revalidation: 桌面和小屏幕、侧栏展开和折叠时头像字母可见，头部右侧未溢出，退出菜单仍可操作。

连续两轮未通过后的分析与下一步：

- 当前认证方案无需重新设计；问题在于新增撤销重试请求复用了全局 401 清理逻辑，而 mock 服务测试未覆盖这一层。
- R3 的原修复方向（纠正继承行高）有效，剩余问题是选择器范围；PageHeader 描述删除属于应恢复的范围外改动。
- 决定继续 A02，以本 Review 的三项要求作为一个明确返工任务交给 Coding Worker，不进入 A03，不开展认证或布局架构重构。
- 允许修改 `src/lib/api.ts`、`src/providers/AuthProvider.tsx`、`src/services/auth.ts`、`src/pages/LoginPage.tsx` 及直接相关测试以修复 R2-1；允许恢复 `src/components/PageHeader.tsx`；允许调整 `src/styles/main.scss` 和必要的 `src/layout/AdminLayout.tsx` 类名以修复 R2-3。
- Worker 应逐项报告 Revision、Files Changed、Resolved、实际验证及 Remaining；不得修改历史 Review 或自行设置验收通过。完成后再次复验。

### Review 2 补充：用户澄清 R2-2（2026-09-21）

- 来源：用户明确说明 PageHeader 描述由其人工删除，产品不再需要显示描述。
- 更正：撤回 R2-2 中“范围外删除”“页面内容回退”的判断，以及恢复 description 渲染的要求；上述历史文字仅保留为记录，不再作为返工依据。本补充同时替代 Review 2 下一步中“允许恢复 PageHeader”的要求。
- R2-2 / P2 当前范围：仅修复未使用的 `description` 解构参数导致的 lint 失败。由 Coding Worker 移除该未使用的解构绑定即可，可保留可选 prop 类型以兼容现有调用方，不必扩大为调用方清理；不得恢复描述渲染或关闭 lint 规则。
- 复验：`npm run lint`、`npm run build` 通过，PageHeader 继续不显示描述。
- 状态：A02 仍为待修改；本次为需求澄清，未重新运行验证。R2-1 会话隔离与 R2-3 小屏幕头像问题的修复要求不变。

### Review 3

- Date: 2026-09-21
- 验收对象：A02 最新工作区，复验 Review 2 的 R2-1、R2-2（按用户澄清）、R2-3，并回归历史 R1、R2、R3。
- Revision: `4050e41c8011d724deaf250700f09bc5fe2642a2` + 当前未提交工作区；包含未跟踪的 `src/lib/api.test.ts`、`src/lib/errors.test.ts`、`src/providers/AuthProvider.test.tsx`。验收仅适用于本轮检查的工作区内容，不代表 HEAD 本身已包含修复。
- Result: **验收通过**。

Validation:

- `npm test`：PASS，4 个测试文件、30 项测试通过。
- `npm run build`：PASS。
- `npm run lint`：PASS，无错误或警告。
- `git diff --check`：PASS。
- 新增测试通过真实 Axios 拦截器与受控 adapter，验证显式旧 token 不被当前 token 覆盖、旧请求 401 不清除新会话、当前会话 401 清理并派发退出事件、网络失败及 503 后重试；AuthProvider 测试验证待撤销记录清理且管理员会话保留。
- Chrome 无头浏览器 + Playwright，受控 API 响应下运行真实前端：先重试旧 token 撤销，延迟响应，再登录管理员，最后返回旧请求 401；确认撤销请求使用旧 token、待撤销记录清空、新管理员 token 和后台页面保留。随后由真实 Axios 发出当前会话 `/me` 请求并返回 401，确认会话清除且跳回登录页。
- 浏览器验证 1440×900、390×900，侧栏展开和折叠四种组合：头部高 76px，右侧高 46px、垂直范围 14.5–60.5px，无高度溢出；头像字母均可见，约 11.66×28.28px；小屏幕退出菜单可以展开。
- 浏览器确认 PageHeader 不渲染描述段落，与用户澄清一致。
- 本机临时浏览器复验脚本：`/private/tmp/a02-review.cjs`；上轮复现脚本保留为 `/private/tmp/a02-review2.cjs`。均使用测试凭据与受控响应。

Resolved:

- R2-1 / P1：PASS。401 清理仅作用于请求 token 与当前会话 token 相同的情况；旧 token 清理不会错误退出新会话。
- R2-2 / P2：PASS。仅移除未使用的 description 解构绑定，保留不显示描述的产品行为，lint 通过。
- R2-3 / P2：PASS。使用 `.profile-button__text` 限定用户名容器样式，不再隐藏 Avatar 内部内容。
- 历史 R1：撤销失败提示、待撤销记录、重试及权限拒绝路径的现有测试通过，相关会话隔离缺陷已修复。
- 历史 R2：中文错误映射及兜底测试继续通过。
- 历史 R3：头部高度与头像内容通过本轮浏览器复验。

Findings:

- 本轮未发现阻断 A02 验收的遗留问题。
- 构建仍提示主 JS 包约 892.61 kB，属于已有非阻断体积警告，后续可按路由拆包。

Not Verified:

- 本轮未使用真实账号或真实后端验证服务端 token 撤销，不能以受控响应宣称真实 token 已失效；真实 API 登录、撤销后 `/me` 返回 401 等联调保留在 A06 集成验收中完成。
- 未验证 Safari、Firefox、真实移动设备及完整阶段 1 响应式布局；本轮布局复验限定为 A02 登记的头部问题。

Next:

- A02 无需继续返工，可按计划进入 A03；A03 与 A06 必须按各自范围独立验收，不因 A02 通过而自动视为完成。
- 提交修复时须包含本轮新增测试文件；后续代码变更需按影响范围重新验证。

### 目标

管理员可以安全登录后台。

### 范围

- 对接 `POST /api/v1/auth/login`
- 登录成功后保存 token
- 检查 `user.is_admin`
- 普通用户登录后拒绝进入
- 普通用户本次 token 必须撤销
- 显示中文错误
- 登录按钮防止重复提交
- 登录成功跳回原目标页面

### 页面

```text
/login
```

### 验收

- 正确管理员账号可以进入后台
- 错误密码显示提示
- 普通用户显示“没有管理权限”
- 密码和 token 不进入日志
- 登录提交期间按钮不可重复点击

---

## A03：会话恢复和自动退出

**状态：验收通过**

最新验收结论：Review 2 验收通过；Review 1 保留为历史记录。

### Review 1

- Date: 2026-09-21
- 验收对象：A03 会话恢复、自动退出、主动退出与登录前目标地址恢复。
- Revision: `42bcd1018a649d538cd27370b074f8f43347f574` + 当前未提交工作区：`src/providers/AuthProvider.tsx`、`src/lib/api.test.ts`，以及未跟踪的 `src/components/ProtectedRoute.test.tsx`。
- Result: **待修改**。

Validation:

- `npm test`：PASS，5 个测试文件、35 项测试通过。
- `npm run build`：PASS；主 JS 包约 892.70 kB，仍有已有非阻断体积警告。
- `npm run lint`：PASS。
- `git diff --check`：PASS。
- Chrome 无头浏览器 + Playwright，使用受控 API 响应运行真实前端及 Axios 拦截器：访问 `/users?level=N1#details`，登录后完整恢复 pathname、query、hash；刷新等待 `/me` 期间只显示加载界面，成功后恢复后台。
- 浏览器同时触发三个当前 token 请求的 401，只派发一次退出事件，清除 token 并返回登录页。
- 正常退出使用当前 token 请求 `/auth/logout`，清除本地会话；随后直接访问 `/users` 被拒绝并返回登录页。
- 浏览器异常路径复现：退出返回 503 后没有错误提示、没有待撤销记录；会话失效后迟到的 `/me` 200 会重新显示受保护页面，此时本地 token 为 null。
- 临时复验脚本：`/private/tmp/a03-review.cjs`，使用测试凭据与受控响应，不含真实账号凭据。

Not Verified:

- 未使用真实账号验证后端 token 撤销及撤销后 `/me` 返回 401；本轮不能证明真实服务端会话已失效，真实联调仍需在 A06 执行。
- 未验证 Safari、Firefox、真实移动设备及跨标签页会话同步。

Findings:

#### R1 / P1：迟到的会话恢复响应重新放行已失效会话

- Location: `src/providers/AuthProvider.tsx:35-57`，尤其 `:43-52`；`src/components/ProtectedRoute.tsx` 根据 user 是否存在放行。
- Trigger: 刷新后台，延迟启动阶段 `/me` 的管理员成功响应；在其返回前，让另一个携带当前 token 的请求返回 401，确认已清除 token 并跳回登录页；随后释放之前 `/me` 的 200 响应。
- Actual: 恢复 effect 的 `cancelled` 仅在 effect 清理时改变，会话清除并不触发该清理；迟到响应仍执行 `setUser(profile)`。浏览器实测重新进入 `/users`，但 `manabi_admin_token` 为 null。
- Impact: 不满足失效后退出及受保护页面不可访问要求；这是前端会话状态回退，并不等于绕过服务端权限。
- Required Change: 会话恢复结果必须绑定发起时的会话身份或代次；退出、401 清除或新登录后，旧恢复请求的成功、失败和 finally 均不得修改当前会话或加载状态。不能只保护成功分支，也不能通过移除 401 处理解决。
- Revalidation: 增加可控制完成顺序的测试，覆盖恢复中清除会话后旧 `/me` 成功不恢复页面；新会话建立后旧 `/me` 成功或失败均不覆盖/清除新会话；正常恢复和 StrictMode 下的恢复仍可用。使用真实拦截器验证，而非仅 mock 最终用户状态。

#### R2 / P2：主动退出失败被吞掉，缺少错误提示和清理重试

- Location: `src/providers/AuthProvider.tsx:83-86`。
- Trigger: 管理员点击退出登录，`POST /auth/logout` 返回 503 或发生网络错误。
- Actual: 本地会话先清空，然后 `.catch(() => undefined)` 丢弃失败信息；浏览器实测登录页没有 Alert，待撤销存储为空，无法重试本次 token 的撤销。
- Impact: 服务端管理员 token 可能仍有效，用户无法知道撤销失败或重试；不符合统一完成标准中的错误状态和异常处理要求。清除本地会话不代表服务端撤销成功。
- Required Change: 保留立即退出本地后台的行为；失败时使用既有待撤销机制保留本次 token，显示中文提示并允许重试，不恢复为有效会话，不泄露 token。401 可视为该 token 已失效；没有 token 时不应发送可能被新会话 token 填充的匿名退出请求。
- Revalidation: 覆盖正常退出、401、503、网络失败和失败后重试成功；失败期间后台不可访问；重试仍使用原 token；重试与新管理员登录并发时不清除新会话，保留 A02 的会话隔离回归测试。

Next:

- 继续 A03，交给 Coding Worker 按 R1、R2 完成一个明确的修复任务，暂不进入 A04。
- Allowed Files: `src/providers/AuthProvider.tsx`、`src/providers/AuthProvider.test.tsx`、`src/components/ProtectedRoute.test.tsx`；如错误提示接入需要，可修改 `src/pages/LoginPage.tsx` 及其测试；必要时调整 `src/lib/api.ts`、`src/lib/api.test.ts`、`src/lib/storage.ts`、`src/services/auth.ts`。
- 不修改后端、公共 API、依赖或无关布局；保留用户明确要求的不显示页面描述行为，不覆盖 A02 历史 Review。
- Worker 逐项报告 Revision、Files Changed、Resolved、实际测试/构建/lint 结果及未验证范围，再提交复验。

### Review 2

- Date: 2026-09-21
- 验收对象：A03 修复后的工作区，复验 Review 1 的 R1、R2 并回归 A03 正常流程。
- Revision: `42bcd1018a649d538cd27370b074f8f43347f574` + 当前未提交工作区：`src/providers/AuthProvider.tsx`、`src/providers/AuthProvider.test.tsx`、`src/lib/api.test.ts` 及未跟踪的 `src/components/ProtectedRoute.test.tsx`。结论适用于本次检查的工作区，不代表 HEAD 本身已包含修复。
- Result: **验收通过**。

Validation:

- `npm test`：PASS，5 个测试文件、44 项测试通过，包含 A02 回归测试。
- `npm run build`：PASS。
- `npm run lint`：PASS。
- `git diff --check`：PASS。
- 通过真实 Axios 拦截器与受控 adapter 的新增测试：会话清除后迟到的恢复成功响应不恢复 user；新登录后旧恢复成功或失败不覆盖/清除新会话；StrictMode 恢复正常；退出 401 视为已失效；503 和网络失败保留待撤销 token；重试使用原 token；无 token 时不发出退出请求。
- Chrome 无头浏览器 + Playwright，受控 API 响应下验证真实前端：`/users?level=N1#details` 登录后完整恢复；刷新显示加载界面并恢复管理员；三个并发 401 仅派发一次退出事件并清理会话；正常退出请求使用原 token，退出后直接访问受保护页面被拒绝。
- 浏览器复验 R1：延迟启动 `/me`，先由另一当前 token 请求的 401 清除会话，再释放 `/me` 的成功响应；页面保持 `/login`，后台不可见，本地 token 为 null。
- 浏览器复验 R2：退出返回 503 后后台不可访问、登录页显示“会话撤销未完成”、保留待撤销记录；点击重试后确认请求携带原 token，成功时待撤销记录清除。
- 浏览器脚本：`/private/tmp/a03-review.cjs`；上轮复现脚本保留为 `/private/tmp/a03-review1.cjs`，均为使用测试凭据和受控响应的本机临时材料。

Resolved:

- Review 1 / R1 / P1：PASS。恢复请求检查会话代次和 token，成功、失败及 finally 分支均拒绝过期结果；清除会话与新登录更新代次。
- Review 1 / R2 / P2：PASS。保留立即清除本地会话的行为；撤销失败进入既有待撤销机制，提供中文提示和重试；没有 token 时不发请求。A02 会话隔离回归测试通过。

Findings:

- 本轮未发现阻断 A03 验收的遗留问题。
- 主 JS 包约 892.85 kB，构建仍有已有非阻断体积警告。

Not Verified:

- 未使用真实账号和真实后端验证 token 撤销、撤销后 `/me` 返回 401；受控响应不证明服务端实际撤销，真实联调仍需 A06 完成。
- 未验证 Safari、Firefox、真实移动设备或跨标签页同步；本次结论限定于 A03 定义的功能范围。

Next:

- A03 无需继续返工，可进入 A04；A04 和 A06 仍需独立验收。
- 提交实现时应包含未跟踪的 `src/components/ProtectedRoute.test.tsx`；后续变更按影响范围重新验证。

### 目标

页面刷新后恢复管理员会话，token 失效时自动退出。

### 范围

- 启动时调用 `GET /api/v1/me`
- 显示全屏加载状态
- 401 时清理 token
- 跳转到登录页
- 退出时调用 `POST /api/v1/auth/logout`
- 防止多个 401 重复跳转或重复提示

### 验收

- 刷新后台页面不会丢失登录
- 失效 token 自动跳转
- 退出后受保护页面不可访问
- 登录前目标地址可以恢复

---

## A04：后台布局和导航

**状态：验收通过**

最新验收结论：Review 3 验收通过；历史 Review 保留，历史问题状态不代表当前结论。

### Review 1

- Date: 2026-09-21
- 验收对象：A04 布局、导航、折叠、管理员菜单、404 及小屏幕适配。
- Revision: `ef12a80faf324780b2922968ca76435af2ceda67` + 当前未提交工作区：`src/App.tsx`、`src/layout/AdminLayout.tsx`，以及未跟踪的 `src/App.test.tsx`、`src/pages/NotFoundPage.tsx`。
- Result: **待修改**。

Validation:

- `npm test`：PASS，6 个测试文件、50 项测试通过。
- `npm run build`：PASS；主 JS 包约 893.46 kB，仍有已有非阻断体积警告。
- `npm run lint`：PASS。
- `git diff --check`：PASS。
- Chrome 无头浏览器 + Playwright，使用受控认证响应运行真实前端：六个菜单入口均可导航，逐个刷新后正确高亮；五个未实现模块显示明确占位说明；未知地址显示 404，返回工作台按钮可用；点击管理员菜单退出后清除 token 并跳回登录页；本流程无 pageerror。
- 1440px、768px、390px、320px 四种宽度下，检查工作台、用户管理占位页、404 页面及侧栏两种状态。1440px 和 768px 均未检测到页面横向溢出；390px 和 320px 自动折叠状态下未检测到页面横向溢出，但手动展开后明显挤压内容并产生溢出。
- 390px 工作台展开后：内容 `.page` 仅宽 108px，文档 scrollWidth 为 439px；320px 工作台展开后 `.page` 仅宽 38px，scrollWidth 为 439px。320px 的用户管理与 404 展开后 scrollWidth 为 368px。
- 实际查看 390px 展开截图：主卡片标题、文字与按钮被裁剪，列表说明逐字换行，底部状态标签超出卡片。
- 浏览器脚本：`/private/tmp/a04-review.cjs`；390px 工作台截图：`/private/tmp/a04-mobile-0.png`（折叠）、`/private/tmp/a04-mobile-1.png`（展开）。均为本机临时验收材料。

Not Verified:

- 未使用真实账号或真实后端验证退出后的服务端 token 失效，留待 A06 联调。
- 未验证 Safari、Firefox、真实移动设备及完整键盘/读屏操作；未执行完整无障碍审计。

Findings:

#### R1 / P2：小屏幕手动展开导航导致内容严重挤压、裁剪和溢出

- Location: `src/layout/AdminLayout.tsx:42-49`、`:57-62`；相关布局样式 `src/styles/main.scss`。
- Trigger: 390px 或 320px 视口进入后台，点击“展开导航”，查看工作台或模块页面。
- Actual: breakpoint 只负责自动折叠；手动展开仍使用占据文档流的 250px 侧栏，挤压剩余内容。实测尺寸与截图见 Validation。
- Impact: 不满足 A04“小屏幕不会严重溢出”的验收条件；工作台内容和按钮被截断，320px 下模块和 404 页面也出现横向溢出。
- Required Change: 为手机宽度定义独立导航行为，建议使用 Ant Design Drawer 或等效覆盖式导航，打开导航时不压缩正文；保持可关闭、菜单可访问，选中菜单后收起。桌面保留现有侧栏折叠行为。不允许仅设置 overflow hidden 掩盖被裁剪的内容。
- Revalidation: 在真实浏览器检查至少 320px、390px、768px、1440px；覆盖导航打开/关闭、菜单跳转、工作台、模块占位页、404 和退出入口。正文与按钮可读可操作，窄屏无页面横向溢出；关闭导航后布局恢复正常。
- Test Gap: 当前窄屏测试只 mock matchMedia 并断言 collapsed 类名；jsdom 不计算实际布局，不能证明无溢出。补充窄屏导航交互测试，并记录浏览器尺寸/视觉验证结果。

#### R2 / P3：相似前缀的未知地址误高亮菜单（非阻断建议）

- Location: `src/layout/AdminLayout.tsx:36`。
- Trigger: 访问 `/users-unknown`。
- Actual: 页面显示 404，但“用户管理”仍高亮；浏览器已复现。原因是仅用 startsWith 匹配 `/users`。
- Suggested Change: 按完整路径或路径段边界匹配，避免相似前缀误命中；如采用路由元信息确定选中项，确保未知路由不误选。
- Revalidation: `/users` 保持高亮，`/users-unknown` 显示 404 且不高亮用户管理；为匹配边界补充测试。

Next:

- A04 因 R1 暂不通过；由 Coding Worker 完成一个明确的窄屏导航修复任务，R2 为可选改进，不单独阻断验收。
- Allowed Files: `src/layout/AdminLayout.tsx`、`src/styles/main.scss`、`src/App.test.tsx`；必要时新增直接相关的导航组件及测试。使用已有 Ant Design 能力，不新增依赖或修改认证、后端及业务 API。
- 保留 A02/A03 已验收行为和用户明确要求的不显示 PageHeader 描述；不扩展为 A05 整体设计系统重构。
- Worker 报告 Revision、Files Changed、Resolved、测试/构建/lint 实际结果和浏览器验证情况；完成后复验。

### Review 2

- Date: 2026-09-21
- 验收对象：A04 窄屏抽屉导航、路径匹配修复及新增测试。
- Revision: `ef12a80faf324780b2922968ca76435af2ceda67` + 当前未提交工作区：`src/App.tsx`、`src/layout/AdminLayout.tsx`、`src/styles/main.scss`、未跟踪的 `src/App.test.tsx` 和 `src/pages/NotFoundPage.tsx`。
- Result: **待修改**。功能复验通过，剩余新增自动化测试不稳定。

Validation:

- 首次 `npm test`：FAIL，51 项通过、1 项失败（共 52 项）；失败位置 `src/App.test.tsx:151`，手机导航选择菜单后仍查询到 menuitem。
- 单项复跑 `npm test -- src/App.test.tsx -t '手机宽度' --reporter=dot`：PASS，1 项通过、其余 7 项因名称筛选未运行。
- 第二次全量 `npm test`：PASS，6 个文件、52 项通过。两次全量结果不一致，不能将首次失败隐藏为“全部稳定通过”。
- `npm run build`：PASS；主 JS 包约 908.42 kB，仍有非阻断体积警告。
- `npm run lint`：PASS；`git diff --check`：PASS。
- 测试输出存在 jsdom 对带伪元素参数的 getComputedStyle 未实现提示；尚未证明该提示是本次失败的直接原因。
- Chrome 无头浏览器 + Playwright，真实前端、受控认证响应：六个桌面菜单入口导航及刷新高亮正常，模块占位说明正常；`/does-not-exist`、`/users-unknown` 均显示 404 且没有错误选中项；返回工作台可用。
- 320px、390px、768px、1440px，工作台、用户管理占位页和 404，导航打开/关闭两种状态均无页面横向溢出，检查的正文和按钮没有越出视口。手机正文宽度分别保持 288px、358px，抽屉打开不改变正文宽度；已查看 390px 打开与关闭截图。
- 320px 和 390px 下逐个验证六个菜单：可跳转、选择后抽屉关闭、刷新后打开导航仍正确高亮、Escape 可关闭。关闭按钮和手机退出入口可用，退出后 token 清除并跳回登录页；浏览器流程无 pageerror。
- 临时材料：`/private/tmp/a04-review.cjs`、`/private/tmp/a04-review2-mobile-0.png`、`/private/tmp/a04-review2-mobile-1.png`、`/private/tmp/a04-focused-test.log`、`/private/tmp/a04-review2-full-test.log`；上轮脚本保留为 `/private/tmp/a04-review1.cjs`。

Resolved:

- Review 1 / R1 / P2：功能 PASS。手机采用覆盖式 Drawer，打开时不再压缩正文；桌面保留侧栏折叠。
- Review 1 / R2 / P3：PASS。路径段边界匹配避免 `/users-unknown` 误高亮。

Findings:

#### R2-1 / P2：新增手机导航测试存在间歇性失败

- Location: `src/App.test.tsx:135-155`，失败断言位于 `:151`。
- Trigger: 首次全量运行 `npm test`，菜单选择后等待 `queryByRole('menuitem')` 查询不到该项。
- Actual: 首次失败，单项与第二次全量通过；真实浏览器中抽屉正常关闭。现阶段证据表明自动化验证不稳定，不能据此认定产品关闭逻辑失败。
- Analysis: Drawer 默认关闭后可保留 DOM，通过动画和样式隐藏；测试依赖角色查询对隐藏状态的判断，需排查动画结束、样式注入、计时器及测试隔离。具体导致间歇失败的原因尚未确定。
- Required Change: 修正测试同步或隔离方式，稳定验证“打开 → 选中菜单 → 路由变化 → 抽屉关闭 → 可再次打开”的行为。可以在测试中明确控制动画或等待可靠的关闭信号；不得删除/跳过该测试、吞掉失败、仅延长超时碰运气，或只为满足 DOM 不存在断言改变已经正常的产品行为。
- Revalidation: 单项及完整测试套件均通过；修复后至少连续两次完整 `npm test` 验证本次间歇问题，并执行 build、lint。若调整实际 Drawer 行为，重新验证手机打开/关闭、跳转和无溢出。

Not Verified:

- 未实测真实后端 token 撤销，留待 A06；未验证其他浏览器、真实移动设备或完整无障碍行为。

连续两轮未通过后的分析与下一步：

- 原窄屏设计问题已解决，无需重新设计导航或扩大布局修改。此次阻断集中在新增测试与抽屉关闭状态的同步/隔离。
- 下一任务收敛为“稳定 A04 手机抽屉交互测试”，优先交给 Coding Worker；允许修改 `src/App.test.tsx`，必要时调整直接相关测试配置或 `src/test/setup.ts`，但必须保留已有测试隔离与覆盖，不增加依赖。
- 不重写认证、导航架构或样式，不恢复用户已删除的页面描述。Worker 报告根因、修复说明及实际验证后复验。

### Review 3

- Date: 2026-09-21
- 验收对象：A04 手机抽屉交互测试稳定性修复，复验 Review 2 / R2-1。
- Revision: `ef12a80faf324780b2922968ca76435af2ceda67` + 当前未提交 A04 工作区，包含未跟踪的 `src/App.test.tsx`、`src/pages/NotFoundPage.tsx`。本结论适用于本次检查的工作区，不代表 HEAD 已包含实现。
- Result: **验收通过**。

Validation:

- 手机导航单项测试：PASS，使用 `npm test -- src/App.test.tsx -t '手机宽度' --reporter=dot`，1 项通过，其他 7 项因名称筛选未运行。
- 第一轮完整 `npm test`：PASS，6 个文件、52 项测试通过，无跳过。
- 第二轮完整 `npm test`：PASS，6 个文件、52 项测试通过，无跳过。两轮日志分别为 `/private/tmp/a04-review3-test1.log`、`/private/tmp/a04-review3-test2.log`。
- `npm run build`：PASS；`npm run lint`：PASS；`git diff --check`：PASS。
- 检查测试代码：保留无侧栏断言，以 Drawer 的 `ant-drawer-open` 状态同步验证“打开 → 点击用户管理 → 页面跳转 → 关闭 → 再次打开”；使用 within 限定抽屉内查询，没有删除测试、跳过全量用例、吞掉失败或增加超时。
- 相比 Review 2，本次返工仅调整测试；产品路由、Drawer、404 及样式实现保持一致，产物 JS/CSS 文件名亦与上轮一致。本轮未重复浏览器验收，沿用 Review 2 已执行的 320px、390px、768px、1440px 布局、导航、刷新高亮、404 和退出验证结果。

Resolved:

- Review 2 / R2-1 / P2：PASS。测试不再依赖关闭后菜单项能否被角色查询找到，改为等待明确的 Drawer 打开状态，且补充再次打开验证；达到本次要求的连续两轮全量通过标准。
- Review 1 / R1 / P2：维持 PASS。手机覆盖式导航不挤压正文，无横向溢出；桌面折叠正常。
- Review 1 / R2 / P3：维持 PASS。相似前缀未知地址不再错误高亮菜单。

Findings:

- 本轮未发现阻断 A04 验收的遗留问题。
- jsdom 仍输出伪元素 getComputedStyle 未实现提示；测试通过且上轮浏览器无 pageerror，本轮作为非阻断测试环境提示记录。
- 构建主 JS 包约 908.42 kB，仍有已有非阻断体积警告。

Not Verified:

- 两次通过是本次稳定性复验的证据，不代表已进行长期压力或所有运行环境验证。
- 本轮未重新运行浏览器；未验证 Safari、Firefox、真实移动设备或完整无障碍行为。
- 真实后端 token 撤销仍需 A06 联调，不能以受控响应验证替代。

Next:

- A04 无需继续返工，可进入 A05；后续任务仍需独立验收。
- 提交时须包含新增测试与 404 页面；后续实现变化需按影响范围重新验证。

### 目标

完成稳定的后台主框架。

### 范围

- 左侧导航
- 导航折叠
- 顶部管理员信息
- 退出菜单
- 页面标题组件
- 当前导航高亮
- 404 页面
- 小屏幕适配

### 菜单

```text
工作台
用户管理
真题管理
内容审核
媒体资源
操作记录
```

### 验收

- 所有入口均可导航
- 刷新子页面后菜单仍正确高亮
- 小屏幕不会严重溢出
- 未实现模块显示明确空状态

---

## A05：统一设计系统

**状态：验收通过**

### Review 1

- Date: 2026-09-21
- 验收对象：A05 主题与 Sass 变量、状态组件、全屏加载、确认弹窗及日文排版。
- Revision: `72322866183300b3d4e3a6a8cf731fdcb082ff20` + 当前未提交工作区，包含新增的 `src/components/common/`、`src/components/feedback/`、`src/lib/confirm.ts` 及测试、`src/lib/designTokens.ts`、Sass 分文件等。
- Result: **待修改**。

Validation:

- `npm test`：PASS，10 个测试文件、63 项测试通过。
- `npm run build`：PASS；主 JS 包约 906.12 kB，仍有已有非阻断体积警告。
- `npm run lint`：PASS；`git diff --check`：PASS。
- 代码检查：主要颜色已集中到 TS/Sass token，Ant Design 使用公共 palette/radius/font；新增状态标签、空/错误状态组件和全屏加载组件；既有 PageHeader 保持不显示描述的用户需求；日文内容增加 lang 标记及字体、行高规则。
- Chrome + Playwright，受控认证响应下回归 A04：六个菜单、刷新高亮、404、手机抽屉关闭与 Escape、退出均通过；320px、390px、768px、1440px，工作台/模块占位页/404 在导航打开与关闭时均未发现页面横向溢出。回归流程无 pageerror。
- 浏览器查看登录页及全屏加载截图；实际调用 `confirmAction({ title: '确认操作', content: '中文说明 日本語 English 123' })` 时，首次等待弹窗 30 秒超时，第二次复现等待 5 秒后 `.ant-modal-content` 数量仍为 0，Promise 状态仍为 pending；控制台输出静态 Modal 上下文警告与 React 19 兼容性警告。
- 临时材料：`/private/tmp/a05-review.cjs`、`/private/tmp/a05-login.png`、`/private/tmp/a05-loading.png`、`/private/tmp/a05-confirm-failed.png`；布局回归使用 `/private/tmp/a04-review.cjs`。

Findings:

#### R1 / P2：确认弹窗在当前运行环境中无法显示，且未接入项目主题上下文

- Location: `src/lib/confirm.ts:19-29`；测试 `src/lib/confirm.test.ts`。
- Trigger: 在当前 React 19 + Ant Design 5 前端中调用真实 `confirmAction`，不 mock Modal。
- Actual: 静态 `Modal.confirm` 未渲染弹窗，用户不能确认或取消，返回 Promise 一直等待。控制台提示静态方法无法消费动态主题上下文，并提示当前静态渲染路径的 React 19 兼容问题。
- Evidence: 两次浏览器调用均未显示弹窗；本地 `antd/es/config-provider/UnstableContext.js` 和 `rc-util/es/React/render.js` 对应静态渲染路径含兼容检测及旧 render 调用，当前入口未提供该路径的兼容处理。不能以通过 mock 的单元测试证明真实弹窗可用。
- Impact: A05 范围内的确认弹窗尚不能使用，也无法满足统一主题要求；当前尚未接入业务调用方，因此作为 P2 阻断 A05，而非宣称已有业务操作被执行或越权。
- Required Change: 优先使用挂载在现有 ConfigProvider 内的 `Modal.useModal` / contextHolder 或 Ant Design App 上下文 modal 实例，提供可复用的确认入口；允许为此调整前端 provider/入口及 helper 形式，保持中文按钮、danger 语义和确认/取消结果。不得仅 suppress 警告或继续只 mock 静态 Modal；不增加依赖、不为展示弹窗添加真实危险业务操作。
- Revalidation: 在真实主题上下文中渲染并点击确认/取消，验证返回 true/false；验证自定义按钮文案、danger、重复调用、主题主色/圆角/字体一致，无静态上下文或兼容性警告。增加不 mock 整个 Modal 实现的集成测试，并完成浏览器复验、完整测试、build 和 lint。

#### R2 / P3：全屏加载图标与提示文字相隔过远（非阻断建议）

- Location: `src/components/feedback/FullPageLoading.tsx`、`src/styles/main.scss` 的 `.app-loading`。
- Trigger: 高 900px 的视口等待会话恢复。
- Actual: 图标和文字是全高 Grid 中两个自动行的独立子元素；截图中分别位于约 y=225 与 y=685，视觉上没有形成一个加载提示组。
- Suggested Change: 将两者作为整体居中，使用内层容器或合适的 Grid 内容对齐，使间距接近设计 token。保持全屏加载、role=status 和提示文案。
- Revalidation: 桌面与手机加载时图标和提示相邻且整体居中；该建议不单独阻断 A05。

Not Verified:

- 确认弹窗未显示，无法验收其确认/取消真实交互及主题效果；confirm 单元测试只验证 mock 回调。
- 未进行完整字体平台矩阵、Ruby/阅读表格或未来内容编辑器的排版验证；本轮检查限于已有页面与新增排版规则。
- 未实测真实后端 token 撤销，仍留待 A06；未验证 Safari、Firefox 和真实移动设备。

Next:

- 由 Coding Worker 完成“将确认弹窗接入 React/主题上下文并补真实交互验证”这一明确任务；R2 为可选改进。
- Allowed Files: `src/lib/confirm.ts`、`src/lib/confirm.test.ts`（必要时改为 tsx）、`src/main.tsx`、新增直接相关的 provider/hook/测试；若处理 R2，可修改 FullPageLoading、其测试及相关 Sass。允许读取现有 App/provider 以保持挂载层级正确。
- 不改变认证和业务 API，不新增依赖，不重构无关布局；保留 A02–A04 验收行为和用户不显示 PageHeader 描述的要求。完成后报告实际验证结果再复验。

### Review 2

- Date: 2026-09-21
- 验收对象：A05 确认弹窗主题上下文修复、React 19 兼容处理及加载状态调整。
- Revision: 当前未提交工作区；包含 `src/providers/ConfirmProvider.tsx`、`src/providers/ConfirmProvider.test.tsx`、`src/lib/antdReact19Patch.ts`、`src/lib/antdReact19Patch.test.ts`、`src/main.tsx` 以及 A05 设计系统文件和测试。验收结论适用于本次检查的工作区内容。
- Result: **验收通过**。

Validation:

- `npm test`：PASS，11 个测试文件、65 项测试通过。
- `npm run build`：PASS；主 JS 包约 934.74 kB，仍有非阻断体积警告。
- `npm run lint`：PASS；`git diff --check`：PASS。
- 真实浏览器 + Playwright：在现有主题上下文中挂载 `ConfirmProvider`，调用确认入口并点击真实按钮；确认弹窗显示，danger 按钮具备 `ant-btn-dangerous`，中日英混排内容可见，日文节点保留 `lang="ja"`，确认返回 `true`、取消返回 `false`，连续第二次调用返回 `false`。
- 同一浏览器流程未出现此前的静态 Modal 上下文警告或 React 19 兼容警告；控制台未发现相关 warning/error。
- `FullPageLoading` 已使用内层容器，图标和“正在恢复会话…”提示作为整体居中并保持合理间距。
- A04 响应式导航回归仍通过：320px、390px、768px、1440px 无横向溢出，抽屉打开/关闭、菜单跳转、404、退出流程正常；本轮沿用已验收的浏览器回归结果。
- 浏览器复验脚本：`/private/tmp/a05-review2.cjs`；上一轮失败脚本和截图保留为历史材料。

Resolved:

- Review 1 / R1 / P2：PASS。由 `ConfirmProvider` 使用 `Modal.useModal` 与上下文 holder 提供确认入口，并通过 `unstableSetRender` 的 React 19 兼容渲染器处理 antd 静态渲染路径；真实浏览器确认/取消可用，无相关警告。测试覆盖危险按钮、自定义文案、重复调用和主题上下文。
- Review 1 / R2 / P3：PASS。加载图标与提示文字包在 `.app-loading__inner` 中，整体居中，保留 `role="status"`、`aria-live` 和默认/自定义提示。

Findings:

- 本轮未发现阻断 A05 验收的遗留问题。
- jsdom 测试仍输出 `getComputedStyle` 伪元素未实现提示，属于测试环境提示；测试、构建和浏览器流程均通过。
- 主 JS 包约 934.74 kB，体积警告为非阻断后续优化项。

Not Verified:

- 未进行完整字体平台矩阵、Ruby/阅读表格或未来内容编辑器的排版验证；本轮验证覆盖已有页面、公共组件和中日英混排示例。
- 未验证 Safari、Firefox、真实移动设备及完整无障碍审计。
- 未实测真实后端 token 撤销，仍留待 A06。

Next:

- A05 无需继续返工，可进入 A06 阶段 1 集成验收。
- 提交时须包含新增 provider、React 19 兼容 patch、设计 token、公共状态组件及对应测试；后续变更需按影响范围重新验证。

### 目标

建立 Quizlet 风格的可复用视觉规范。

### 范围

- Ant Design Theme Token
- Sass 颜色和间距变量
- 页面标题
- 卡片
- 主按钮
- 状态标签
- 加载状态
- 空状态
- 错误状态
- 确认弹窗
- 日文排版样式

### 验收

- 页面不使用散落的重复颜色值
- 不大量深层覆盖 Ant Design DOM
- 组件视觉统一
- 中文、日文和英文混排正常

---

## A06：阶段 1 集成验收

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

确认阶段 1 可以作为后续功能的稳定基础。

### 范围

- 使用真实 Manabi API 验证登录
- 验证管理员与普通用户
- 验证刷新恢复
- 验证退出
- 验证所有路由
- 完善 README
- 完善 `.env.example`

### 验收

- 阶段 1 全流程可运行
- 构建和 lint 通过
- README 可以指导新开发者运行项目
- 不展示虚假用户或试卷数据

---

# 里程碑 B：用户管理

## B01：用户状态数据库迁移

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

为用户禁用和后续管理建立数据库基础。

### 数据字段

建议增加：

```text
status
display_name
updated_at
last_login_at
disabled_at
```

### 范围

- 创建 Alembic migration
- 现有用户默认迁移为 `active`
- 更新 SQLAlchemy 模型
- 更新必要 schema
- 不改变现有登录成功逻辑之外的功能

### 验收

- 空数据库可完整升级
- 现有数据库可升级
- migration 不修改历史文件
- 原有测试通过

---

## B02：禁用用户认证保护

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

被禁用的用户不能继续访问系统。

### 范围

- 登录时检查用户状态
- `current_user` 检查用户状态
- 禁用账号的旧 token 失效
- 返回稳定错误代码
- 增加测试

### 验收

- 禁用用户不能登录
- 已登录用户被禁用后，下次请求返回 401 或明确的 403
- 正常用户行为不变
- 管理员不能意外禁用最后一个超级管理员

---

## B03：用户列表垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以查看和筛选真实用户。

### 后端

```text
GET /api/v1/admin/users
```

支持：

- 关键词
- JLPT 等级
- 状态
- 管理员类型
- 分页
- 排序

### 前端

```text
/users
```

显示：

- 用户名
- 显示名称
- 等级
- 状态
- 管理员标记
- 注册时间
- 最近登录

### 验收

- 使用真实数据库
- 空数据有空状态
- 请求失败有重试入口
- 筛选会更新 URL 参数
- 排序字段使用后端白名单
- 不返回密码摘要

---

## B04：创建用户垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以创建普通用户。

### 后端

沿用或扩展：

```text
POST /api/v1/admin/users
```

字段：

```text
username
display_name
password
level
```

### 前端

- 创建用户弹窗或独立页
- 表单校验
- 创建成功刷新列表
- 用户名重复显示明确提示

### 验收

- 不能通过接口创建管理员
- 密码至少 8 位
- 用户名规则和登录接口一致
- 创建操作写入操作日志

---

## B05：用户详情垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以查看用户基础信息和学习摘要。

### 后端

```text
GET /api/v1/admin/users/{user_id}
GET /api/v1/admin/users/{user_id}/stats
```

### 前端

```text
/users/{user_id}
```

展示：

- 用户资料
- 状态
- 注册时间
- 最近登录
- 练习次数
- 正确率
- 错题数量
- 各等级学习数据

### 验收

- 用户不存在返回 404
- 统计为空时正常展示
- 不返回练习答案中的敏感内部字段

---

## B06：编辑用户垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以修改普通用户资料。

### 后端

```text
PATCH /api/v1/admin/users/{user_id}
```

允许：

- 显示名称
- 用户名
- JLPT 等级

### 前端

- 编辑表单
- 保存状态
- 用户名冲突提示
- 成功后更新详情和列表缓存

### 验收

- 不能通过该接口提升管理员权限
- 使用字段白名单
- 修改前后写入操作日志
- 并发冲突返回 409

---

## B07：禁用与启用用户

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以控制用户访问权限。

### 后端

```text
POST /api/v1/admin/users/{user_id}/disable
POST /api/v1/admin/users/{user_id}/enable
```

### 前端

- 状态标签
- 二次确认
- 禁用原因输入
- 成功后刷新状态

### 验收

- 禁用时撤销该用户全部 token
- 不能禁用自己
- 不能禁用最后一个超级管理员
- 操作写入日志

---

## B08：重置密码和撤销会话

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

管理员可以安全重置用户登录凭证。

### 后端

```text
POST /api/v1/admin/users/{user_id}/reset-password
POST /api/v1/admin/users/{user_id}/revoke-tokens
```

### 前端

- 新密码输入与确认
- 密码强度提示
- 二次确认
- 不回显旧密码

### 验收

- 重置密码后旧 token 全部失效
- 日志不保存密码
- 响应不返回密码摘要
- 操作有审计日志

---

## B09：安全删除用户

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

仅删除没有业务数据的普通用户。

### 后端

```text
DELETE /api/v1/admin/users/{user_id}
```

### 规则

- 有练习记录时返回 409
- 有错题记录时返回 409
- 管理员不能删除自己
- 管理员账号不能通过普通删除接口删除

### 前端

- 危险操作确认
- 明确告知禁用与删除的区别
- 删除失败时建议改用禁用

### 验收

- 不破坏外键
- 删除后列表更新
- 操作有审计日志

---

# 里程碑 C：真题只读管理

## C01：试卷列表垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/exams
```

支持：

- N1–N5
- 年份
- 月份
- 发布状态
- 质量问题
- 关键词
- 分页
- 排序

### 前端

```text
/exams
```

显示：

- 标题
- 等级
- 年月
- 各分类题数
- 总题数
- 待复核数量
- 发布状态

### 验收

- 数据来自真实数据库
- 历史和退役数据不会误计为可用题目
- 筛选和分页正确
- 查询性能有合理索引

---

## C02：试卷概览垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/exams/{exam_id}
```

返回：

- 基础信息
- 分类统计
- 题型统计
- 内容状态统计
- 质量问题统计

### 前端

```text
/exams/{exam_id}
```

先完成只读概览。

### 验收

- 不存在返回 404
- 页面可从列表进入
- 统计与数据库一致

---

## C03：试卷目录垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

按原卷顺序展示科目、题型和题组。

### 后端

```text
GET /api/v1/admin/exams/{exam_id}/outline
```

### 前端

- 左侧目录树
- 分类
- 题型
- 题组
- 题目范围
- 状态和问题数量

### 验收

- 排序和现有 App 一致
- 共享材料的题目保持同组
- 不根据题干猜测题组

---

## C04：题组详情垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/exams/{exam_id}/groups/{group_id}
```

返回：

- 大题说明
- 题型
- 材料
- 题目
- 选项
- 正确答案
- 解析
- 来源信息
- 质量问题

### 前端

- 阅读或听力材料区域
- 题目卡片列表
- 正确答案仅在管理员视图显示
- 上一个/下一个题组

### 验收

- 无题干但有材料的听力题正确显示
- 阅读表格和 Ruby 正确渲染
- 不执行不安全 HTML

---

## C05：媒体预览垂直切片

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

后台可预览图片和音频。

### 范围

- 图片查看
- 音频播放
- Range 请求保持兼容
- 加载失败状态
- 资源元数据
- 文件大小显示

### 验收

- 不暴露磁盘绝对路径
- 不存在资源显示明确错误
- 后台预览不影响 App 接口

---

## C06：字幕只读预览

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

按时间展示听力字幕。

### 前端

- 字幕列表
- 开始时间
- 结束时间
- 当前播放字幕高亮
- 点击字幕跳转音频位置

### 验收

- 毫秒转换正确
- 无效字幕显示质量警告
- 无字幕时有清晰空状态

---

## C07：质量问题详情

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/exams/{exam_id}/quality-issues
GET /api/v1/admin/occurrences/{occurrence_id}/quality-issues
```

### 前端

- 问题严重程度
- 问题代码
- 中文说明
- 来源详情
- 跳转对应题目

### 验收

- `error`、`warning`、`info` 样式明确
- 当前问题与历史问题区分
- 不把历史已解决问题误判为当前阻断项

---

# 里程碑 D：草稿、版本和审计

## D01：操作日志基础设施

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 范围

- 创建 `audit_logs`
- 创建记录服务
- 添加查询索引
- 接入用户创建、编辑、禁用等已有管理操作

### 验收

- 日志不可从普通 API 修改
- 不记录密码或 token
- 测试覆盖关键操作

---

## D02：操作日志页面

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/audit-logs
```

### 前端

```text
/audit-logs
```

支持：

- 操作人
- 动作
- 实体类型
- 日期
- 分页
- 查看摘要

### 验收

- 默认按时间倒序
- 不泄露敏感数据
- 可以从日志跳转相关实体

---

## D03：草稿数据库基础

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 范围

- 创建 `content_drafts`
- 草稿状态
- 创建人和更新人
- 基础版本
- 乐观锁版本号
- 时间字段
- Alembic migration

### 验收

- migration 可升级
- 状态约束有效
- 同一目标不会产生不受控的活动草稿

---

## D04：创建和读取试卷草稿

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/exams/{exam_id}/drafts
GET  /api/v1/admin/drafts/{draft_id}
```

### 前端

- “开始编辑”按钮
- 已有草稿时继续编辑
- 显示草稿所有者和更新时间

### 验收

- 不修改正式内容
- 重复点击不会创建多个主草稿
- 无权限用户返回 403

---

## D05：草稿自动保存

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
PATCH /api/v1/admin/drafts/{draft_id}
```

### 前端

- 防抖自动保存
- 保存中
- 已保存
- 保存失败
- 重试
- 离开未保存提醒

### 验收

- 提交草稿版本号
- 版本冲突返回 409
- 冲突时不覆盖他人内容
- 网络失败不会显示“已保存”

---

## D06：版本历史基础

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 范围

- 创建 `content_revisions`
- 发布版本只读
- 版本号
- 修改摘要
- 前一个版本
- 发布人和发布时间

### 验收

- 历史版本不可修改
- 版本顺序稳定
- 支持查询实体版本列表

---

## D07：版本历史页面

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/exams/{exam_id}/revisions
GET /api/v1/admin/revisions/{revision_id}
```

### 前端

- 版本时间线
- 发布人
- 修改说明
- 版本详情

### 验收

- 历史版本可以只读查看
- 不允许从前端直接修改 revision

---

## D08：字段级差异比较

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
GET /api/v1/admin/drafts/{draft_id}/diff
```

### 前端

显示：

- 旧值
- 新值
- 新增
- 删除
- 修改

覆盖：

- 题干
- 选项
- 答案
- 解析
- 阅读材料
- 字幕
- 媒体引用
- 排序

### 验收

- 大文本差异可读
- 正确答案变化高亮
- 媒体变化显示资源信息

---

# 里程碑 E：真题编辑器

## E01：试卷基础信息编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 字段

- 标题
- 等级
- 年份
- 月份
- 来源信息

### 验收

- 仅修改草稿
- 年份和月份校验
- 保存失败不丢失输入

---

## E02：题目与选项编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 编辑题干
- 添加、删除、排序选项
- 设置正确答案
- 编辑解析

### 验收

- 选项数量合法
- 只能有一个正确答案
- 空选项不能提交
- 不修改正式 Question

---

## E03：安全富文本编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 段落
- 粗体
- 下划线
- Ruby 注音
- 表格
- 纯文本预览
- HTML 预览

### 验收

- 服务端清理 HTML
- 禁止脚本和事件属性
- 日文全角空格不被错误压缩
- App 支持的 HTML 标签保持兼容

---

## E04：题组结构编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 编辑大题说明
- 设置题型
- 调整题目顺序
- 移动题目
- 复制题目
- 复制题组

### 验收

- 题组内题型一致
- 排序稳定
- 不产生重复位置
- 移动操作可撤销或确认

---

## E05：阅读材料编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 原文
- 翻译
- 图片
- 实时预览
- 引用数量提示

### 验收

- 共享材料默认 Copy-on-write
- 只影响当前题组
- 未上传完成的图片不能发布

---

## E06：音频上传

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 上传
- 进度
- 失败重试
- 播放
- 元数据
- 哈希

### 验收

- 检查大小和 MIME
- 不覆盖旧资源
- 不暴露磁盘路径
- 上传失败不创建可用引用

---

## E07：字幕编辑器

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 添加和删除字幕
- 编辑开始与结束时间
- 播放同步
- 点击跳转
- 排序

### 验收

- 开始时间小于结束时间
- 时间不能为负数
- 非法字幕阻止提交
- 重叠字幕产生警告

---

## E08：图片资源编辑

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 上传
- 预览
- 替换
- 删除草稿引用
- 查看引用数量

### 验收

- 有正式引用的图片不能直接删除
- 替换生成新资源
- MIME 和文件大小校验正确

---

## E09：拖拽排序

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 题组排序
- 题目排序
- 选项排序

### 验收

- 键盘可操作
- 保存后刷新顺序不变
- 正确答案不会因选项排序错位
- 并发冲突不会静默覆盖

---

## E10：App 效果预览

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 模拟 iOS 内容区域
- 阅读题预览
- 听力题预览
- 选项预览
- 解析预览
- 图片和音频预览

### 验收

- 预览数据来自草稿
- 与当前 API 展示语义一致
- 不向普通用户发布草稿

---

# 里程碑 F：审核与发布

## F01：内容校验服务

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 范围

实现统一校验：

- 试卷
- 题组
- 题目
- 选项
- 阅读材料
- 音频
- 字幕
- 资源引用

### 接口

```text
POST /api/v1/admin/drafts/{draft_id}/validate
```

### 验收

- 返回字段位置、代码和严重程度
- `error` 阻断发布
- `warning` 可确认
- 规则有单元测试

---

## F02：校验结果界面

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 按严重程度筛选
- 点击跳转字段
- 修复后重新校验
- 显示错误数量

### 验收

- 能准确定位题目或字幕
- 不使用英文错误文本判断逻辑

---

## F03：提交审核

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/drafts/{draft_id}/submit
```

### 前端

- 修改说明
- 校验摘要
- 提交确认

### 验收

- 有阻断错误不能提交
- 提交后普通编辑不能继续改
- 状态变化写入日志

---

## F04：审核通过与退回

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/drafts/{draft_id}/approve
POST /api/v1/admin/drafts/{draft_id}/reject
```

### 前端

- 审核差异
- 审核意见
- 通过
- 退回

### 验收

- 需要审核权限
- 退回必须填写原因
- 审核人和编辑人被记录
- 状态转换严格校验

---

## F05：发布新版本

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/drafts/{draft_id}/publish
```

### 范围

- 数据库事务
- 创建不可变 Question
- 创建 Option
- 创建 Material
- 更新 Occurrence 引用
- 创建 Revision
- 创建 AuditLog

### 验收

- 任一步失败全部回滚
- 已开始练习快照不变
- 新练习使用新版本
- 重复请求不会重复发布
- 发布后草稿不可继续编辑

---

## F06：试卷下架与重新发布

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/exams/{exam_id}/unpublish
POST /api/v1/admin/exams/{exam_id}/republish
```

### 前端

- 高风险确认
- 下架原因
- 状态展示

### 验收

- 下架不删除历史
- 历史练习仍可恢复
- 新练习不能选择下架内容
- 操作有日志

---

## F07：版本回滚

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 后端

```text
POST /api/v1/admin/revisions/{revision_id}/rollback
```

### 规则

回滚不是修改历史，而是基于历史内容创建并发布新版本。

### 验收

- 历史 revision 不改变
- 生成新的 revision
- 有完整差异和操作日志
- 旧练习保持不变

---

# 里程碑 G：新增真题和批量导入

## G01：手工创建空白试卷

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 选择等级
- 年份
- 月份
- 标题
- 创建草稿

### 验收

- 创建后不直接发布
- 重复来源信息有提示
- 操作有日志

---

## G02：复制试卷结构

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

复制：

- 科目
- 题型
- 大题说明
- 题组结构

不复制：

- 题目
- 答案
- 解析
- 文章
- 音频
- 字幕

### 验收

- 新试卷为草稿
- 不引用旧试卷的内容数据
- 结构顺序正确

---

## G03：定义标准导入格式

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 目标

确定并文档化：

```text
exam.json
questions.json
assets/audio
assets/images
```

### 验收

- 提供 JSON Schema
- 提供最小示例
- 提供阅读示例
- 提供听力示例
- 定义版本号

---

## G04：导入上传和解析

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 上传 ZIP
- 检查文件结构
- 解压到安全临时目录
- 解析 JSON
- 检查资源路径

### 验收

- 防止路径穿越
- 大小限制
- 非法包不会写入正式表
- 临时文件可安全清理

---

## G05：导入校验报告

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 错误
- 警告
- 受影响试卷
- 受影响题目
- 资源缺失
- 题型冲突
- 重复来源 ID

### 验收

- 错误可定位
- 报告可以下载
- 校验不会修改正式数据

---

## G06：导入生成草稿

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

- 校验通过后生成试卷草稿
- 保留来源记录
- 保留文件摘要
- 记录导入批次

### 验收

- 不直接生成 `ready`
- 不覆盖人工版本
- 冲突内容进入待处理状态

---

## G07：人工版本与导入版本冲突

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 功能

提供选择：

```text
保留人工版本
采用导入版本
手工合并
```

### 验收

- 不自动覆盖
- 每个决定有日志
- 合并结果仍需审核和发布

---

# 里程碑 H：上线准备

## H01：权限审计

**状态：待验收**

### Review

尚未验收，无 Review 结论。

检查所有 `/api/v1/admin/*`：

- 未登录 401
- 普通用户 403
- 角色权限正确
- 高风险操作受限

---

## H02：内容安全审计

**状态：待验收**

### Review

尚未验收，无 Review 结论。

检查：

- 富文本清理
- 文件 MIME
- 文件大小
- 路径穿越
- SQL 排序白名单
- 错误信息泄漏
- 日志敏感信息

---

## H03：完整回归测试

**状态：待验收**

### Review

尚未验收，无 Review 结论。

覆盖：

- iOS App 原接口
- 登录
- 用户管理
- 真题浏览
- 草稿
- 编辑
- 审核
- 发布
- 下架
- 回滚
- 导入
- 媒体

---

## H04：备份和恢复演练

**状态：待验收**

### Review

尚未验收，无 Review 结论。

### 验收

- 可以备份 PostgreSQL
- 可以恢复到新数据库
- 媒体文件与数据库匹配
- 恢复流程有文档
- 记录实际演练结果

---

## H05：生产部署

**状态：待验收**

### Review

尚未验收，无 Review 结论。

包括：

- 前端生产构建
- API 部署
- HTTPS
- CORS
- 环境变量
- 数据库 migration
- 健康检查
- 日志
- 监控
- 回滚步骤

---

# 推荐执行顺序

```text
A01 → A02 → A03 → A04 → A05 → A06

B01 → B02 → B03 → B04 → B05
    → B06 → B07 → B08 → B09

C01 → C02 → C03 → C04 → C05 → C06 → C07

D01 → D02 → D03 → D04 → D05 → D06 → D07 → D08

E01 → E02 → E03 → E04 → E05
    → E06 → E07 → E08 → E09 → E10

F01 → F02 → F03 → F04 → F05 → F06 → F07

G01 → G02 → G03 → G04 → G05 → G06 → G07

H01 → H02 → H03 → H04 → H05
```

其中可以并行的任务：

```text
A04 与 A05
B04 与 B05（B03 完成后）
C05 与 C07（C02 完成后）
D01 与 D03
E06 与 E08
H01 与 H02
```

不建议并行：

```text
草稿模型与草稿 API
校验服务与发布服务
数据库 migration 与依赖该字段的业务代码
同一页面的多个结构性改动
```
