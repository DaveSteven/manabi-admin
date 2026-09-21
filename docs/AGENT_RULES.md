# Manabi Admin 垂直任务清单

## 一、角色定义

本文件同时供以下两类角色读取：

* **Codex Reviewer**：负责任务设计、技术决策、验收、Review 和状态维护。
* **Coding Worker**：负责按照既定任务和 Review 要求实现代码。当前默认 Coding Worker 为 DeepSeek / OpenCode。

两个角色必须严格遵守各自职责，不得越权。

---

## 二、Codex Reviewer 职责

Codex Reviewer 负责：

1. 阅读需求和现有代码，确定实现方案。
2. 将功能拆分为边界明确、可独立验证的小任务。
3. 为每个任务定义：

   * Goal
   * Context
   * Scope
   * Allowed Files
   * Forbidden Changes
   * Implementation Requirements
   * Acceptance Criteria
   * Validation Commands
4. 判断是否允许修改现有架构、公共 API、数据库结构或依赖。
5. 对 Coding Worker 的实现结果进行验收。
6. 检查：

   * 功能正确性
   * 架构一致性
   * 安全性
   * 数据完整性
   * 异常处理
   * 测试覆盖
   * 构建结果
   * 是否存在任务范围外修改
7. 维护任务状态和 Review 历史。
8. 决定任务是否：

   * 验收通过
   * 需要修改
   * 需要重新设计
   * 需要拆分为新的任务
9. 只有 Codex Reviewer 可以将任务状态改为 **验收通过**。

Codex Reviewer 原则上不直接承担普通实现工作。

只有以下情况可以直接修改代码：

* Coding Worker 连续两轮无法正确解决问题。
* 问题涉及架构级修改。
* 问题涉及复杂并发、数据一致性、安全问题或跨模块缺陷。
* 用户明确要求 Codex 直接实现。

---

## 三、Coding Worker 职责

Coding Worker 只负责实现当前明确指定的一个任务。

Coding Worker 必须：

1. 阅读当前任务要求。
2. 阅读与任务直接相关的现有代码。
3. 阅读当前任务已有 Review（如有）。
4. 按既定设计实现代码。
5. 补充必要测试。
6. 执行任务要求的验证命令。
7. 修复由本次修改导致的构建、测试或 lint 问题。
8. 最后报告实际执行结果。

Coding Worker 不得：

* 修改任务状态。
* 宣布任务“验收通过”。
* 修改已有 Review 结论。
* 删除 Review 历史。
* 自行扩大任务范围。
* 自行重新设计已经批准的架构。
* 自行修改公共 API，除非任务明确允许。
* 自行增加第三方依赖，除非任务明确允许。
* 顺手重构无关代码。
* 覆盖用户已有但与本任务无关的修改。
* 用假数据、硬编码或临时 workaround 伪装功能已经完成。

---

## 四、统一执行规则

每次只给 Coding Worker 一个明确任务。

执行任务时必须遵守：

1. 先阅读相关现有代码。
2. 只修改当前任务所需文件。
3. 保留现有 iOS API 行为，除非任务明确要求变更。
4. 不覆盖用户已有修改。
5. 数据库结构变更必须新增 Alembic migration，不得直接修改已有 migration。
6. 后端管理接口必须验证管理员权限。
7. 不使用虚假数据模拟已完成业务。
8. 补充与任务对应的测试。
9. 运行任务要求的相关测试、构建和 lint。
10. 不得因为测试困难而删除、跳过或弱化已有测试。
11. 不得通过扩大权限、关闭校验或删除错误处理来让测试通过。
12. 若发现任务要求与现有架构明显冲突，应停止扩大修改范围，并报告冲突。
13. 完成后只报告事实，不自行判定验收结果。

---

## 五、统一完成标准

### 后端

必须满足：

* 相关 pytest 通过。
* 新增测试覆盖本任务核心行为。
* 数据库 migration 可以正常执行。
* migration 可以正常 rollback（如项目要求）。
* OpenAPI schema 正常生成。
* 请求参数和响应结构与任务定义一致。
* 异常路径有明确错误处理。
* 不泄露内部敏感信息。

### 前端

必须满足：

* `npm run build` 通过。
* `npm run lint` 通过。
* 相关测试通过。
* 加载状态完整。
* 空数据状态完整。
* 错误状态完整。
* 禁用状态和重复提交场景得到处理。
* 不产生明显 console error / warning。

### iOS

必须满足：

* 相关 target 正常 build。
* Swift 编译无新增错误。
* 不破坏现有公开 API，除非任务明确允许。
* Swift Concurrency 使用符合现有项目规范。
* View / ViewModel / Service 职责不越界。
* 新增逻辑具备必要测试或可验证路径。

### 安全

必须满足：

* 普通用户不能调用管理员接口。
* 服务端不能只依赖前端隐藏按钮作为权限控制。
* 不返回密码、token、secret、内部磁盘绝对路径等敏感信息。
* 高风险操作必须有明确确认机制。
* 需要审计的操作必须写入操作日志。
* 删除、批量修改等操作必须验证目标和权限。

---

## 六、任务状态

任务状态只允许使用以下四种：

### 待验收

表示：

* Coding Worker 已完成实现并提交验证结果。
* 尚未经过 Codex Reviewer 正式验收。
* 不代表任务一定正确。

### 验收中

表示：

* Codex Reviewer 正在检查代码、测试、构建结果和任务要求。

### 待修改

表示：

* Codex Reviewer 已完成验收。
* 当前实现存在必须修复的问题。
* Coding Worker 应根据最新 Review 修改。

### 验收通过

表示：

* Codex Reviewer 已确认任务满足 Acceptance Criteria。
* 必要验证已完成。
* 当前任务可以视为完成。

只有 Codex Reviewer 可以设置此状态。

---

## 七、标准状态流转

正常任务：

```text
开发完成
↓
待验收
↓
验收中
↓
验收通过
```

验收失败：

```text
开发完成
↓
待验收
↓
验收中
↓
待修改
↓
Coding Worker 修改
↓
待验收
↓
验收中
↓
验收通过
```

如果发现方案本身存在问题：

```text
验收中
↓
停止当前实现
↓
Codex Reviewer 重新设计
↓
原任务标记为 Superseded / 在 Review 中注明废弃
↓
生成新的子任务
```

不得让 Coding Worker在架构已经被判定错误后继续自由修补旧方案。

---

## 八、Review 维护规则

每次正式验收后，Codex Reviewer 必须更新本文件对应任务。

不能只在聊天中给出 Review。

每条 Review 必须至少包含：

* Review 编号
* 日期
* 验收对象
* commit / revision
* 验收结论
* 实际执行的验证
* 未验证范围
* 发现的问题
* 下一步要求

示例：

```markdown
### Review 1

Date: 2026-09-21
Revision: abc1234
Result: 待修改

Validation:
- pytest tests/admin/test_users.py: PASS
- npm run build: PASS
- npm run lint: PASS

Not Verified:
- 大数据量分页性能

Findings:

#### P1 - 管理员权限检查缺失
Location:
backend/api/admin/users.py:42

Trigger:
普通登录用户直接调用 DELETE /admin/users/{id}

Impact:
普通用户可以执行管理员操作。

Required Change:
必须在服务端增加管理员权限验证。

Revalidation:
使用普通用户 token 请求接口必须返回 403。
```

---

## 九、问题优先级

Review 问题统一使用以下级别：

### P0 — Blocker

严重安全、数据损坏或系统不可用问题。

任务不得通过验收。

### P1 — Critical

核心功能错误、权限问题、明显数据一致性问题。

任务不得通过验收。

### P2 — Required

需求未完整实现、重要边界条件缺失、测试不足等。

原则上必须修复后才能通过。

### P3 — Optional

代码可读性、轻微优化或非必要改进。

不一定阻止任务通过。

Codex Reviewer 不得因为纯风格偏好制造大量 P2 问题。

---

## 十、验收失败后的修改规则

当状态为 `待修改` 时，Coding Worker必须：

1. 阅读最新 Review。
2. 只修改 Review 中要求修复的问题。
3. 不重新设计已经批准的方案。
4. 不修改已经确认正确的无关代码。
5. 完成后重新运行相关验证。
6. 报告每一条 Review 问题是否已经处理。
7. 不得自行删除 Review 内容。
8. 不得自行把状态改为“验收通过”。

Coding Worker 的返工报告格式：

```text
Revision:
<commit hash / working tree>

Resolved:
- Review 1 / P1: 已处理
- Review 1 / P2: 已处理

Files Changed:
- xxx.py
- xxx.tsx

Validation:
- pytest ...: PASS
- npm run build: PASS
- npm run lint: PASS

Remaining:
- 无 / 具体说明
```

---

## 十一、多轮验收规则

复验不得覆盖旧 Review。

必须追加新的 Review：

```markdown
### Review 1
Result: 待修改

...

### Review 2
Result: 待修改

Resolved:
- Review 1 / P1: PASS

Remaining:
- Review 1 / P2: FAIL

...

### Review 3
Result: 验收通过
```

任务状态只反映**最近一次正式验收结果**。

历史 Review 必须保留，除非用户明确要求整理归档。

---

## 十二、连续失败处理

同一个任务连续两次正式验收仍然不通过时：

Coding Worker 不应继续无方向地尝试修改。

Codex Reviewer必须先重新分析：

1. Worker 是否误解任务。
2. Acceptance Criteria 是否模糊。
3. Review 修改要求是否不够具体。
4. 当前架构是否存在问题。
5. 是否需要进一步拆分任务。
6. 是否应该由 Codex 直接解决关键问题。

分析完成后，再决定：

* 继续原任务
* 重写任务规格
* 拆分新任务
* 废弃原方案
* Codex 直接介入

---

## 十三、Reviewer Only 区域

以下标记之间的内容仅允许 Codex Reviewer 修改：

```text
<!-- REVIEWER_ONLY_START -->

任务状态
Review 历史
验收结论
问题优先级
复验结果

<!-- REVIEWER_ONLY_END -->
```

Coding Worker 可以读取这些内容，但不得编辑、删除、覆盖或重新解释其中的验收结论。

如果 Review 内容与任务旧描述存在冲突：

**以最新 Review 为准，但涉及架构变更时必须交由 Codex Reviewer重新定义任务，不允许 Coding Worker自行决定。**

---

## 十四、任务模板

每个任务统一使用以下格式：

````markdown
# TASK-XXX：任务名称

<!-- REVIEWER_ONLY_START -->

Status: 待验收

Latest Review:
尚未验收，无 Review 结论。

<!-- REVIEWER_ONLY_END -->

## Goal

说明这个任务最终要实现什么。

## Context

说明相关背景以及为什么需要这个任务。

## Scope

本任务允许实现的范围。

## Allowed Files

- path/to/file
- path/to/file

必要时允许 Coding Worker读取其他相关文件，但不得随意修改。

## Forbidden Changes

- 不修改 xxx
- 不改变 xxx API
- 不增加新的依赖
- 不调整数据库结构

## Implementation Requirements

1. ...
2. ...
3. ...

## Acceptance Criteria

- [ ] ...
- [ ] ...
- [ ] ...

## Validation

```bash
pytest ...
npm run build
npm run lint
````

## Worker Result

由 Coding Worker报告：

* Revision
* Files Changed
* Implementation Summary
* Validation Result
* Remaining Issues

<!-- REVIEWER_ONLY_START -->

## Review History

尚未验收，无 Review 结论。

<!-- REVIEWER_ONLY_END -->

```

---

## 十五、最终原则

### Codex Reviewer

负责：

> 定义什么是正确的。

### Coding Worker

负责：

> 按已经确定的标准实现正确结果。

### Git / Tests / Build

负责：

> 提供实际发生了什么的客观证据。

聊天内容不能替代：

- TASKS.md
- git diff
- commit
- test result
- build result
- Review 记录

任何关键决策、验收结果或修改要求，都应落到仓库中的正式文档或代码状态中。

这一版可以直接放进仓库。我特别建议保留 `REVIEWER_ONLY_START / END`，这样以后你给 DeepSeek 固定系统提示时，只需要再加一句“禁止修改 Reviewer Only 区域”，角色混淆会少很多。
```
