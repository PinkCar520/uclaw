# UClaw 多端会话架构：Local-First 同步演进需求计划

## 背景与目标
目前 Web 端完全依赖 IndexedDB 存储包含 Base64 格式附件的庞大聊天记录，而服务端 Prisma Schema 中的 `Session` 表尚处于闲置状态。
本计划旨在将其平滑演进为 **“Local-First (本地优先) + 最终一致性”** 的成熟架构，根治存储性能隐患，并打通多端（Web、CLI、IM）数据无缝漫游能力。

## 需求阶段拆分

### Phase 1: 告别 Base64 灾难（精简期）
**目标**：将所有新上传的附件从 Base64 编码转为静态文件直传托管，确保写入本地和后端的 JSON 数据极度轻量化。
- [ ] **1.1 后端文件上传 API (NestJS Gateway)**:
  - 实现 `POST /api/upload` 接口，接收客户端文件（`multipart/form-data`），存储到 Gateway 服务的本地 `public/uploads` 目录中。
  - 在 Gateway 服务中配置静态资源路由，允许前端直接访问 `public/uploads` 下的资源，返回对应的 URL 地址。
- [ ] **1.2 前端直传替换 Base64 (`apps/web`)**:
  - 重构 `App.tsx`（或独立的上传组件）中的文件处理逻辑，用户选择文件后即刻调用 `POST /api/upload` 上传，获取返回的永久 URL。
  - 发送给模型的 `messages` 中的 `attachments` 结构从 Data URL（Base64）精简为纯网络 URL。

### Phase 2: 后端会话数据接口建设（云端 SSOT 阶段）
**目标**：全面激活后端 Prisma `Session` 模型，建立支持多端共享与身份隔离的增删改查（CRUD）REST API。
- [ ] **2.1 会话模块建立 (`SessionModule`)**:
  - 新建 `SessionController` 和 `SessionService`。
  - 接入鉴权 Guard，确保通过影子用户的 `dbId` 操作属于自己的 `Session` 表记录。
- [ ] **2.2 会话 CRUD 接口实现**:
  - `GET /api/session`: 会话列表摘要接口（屏蔽巨大的 `history` 内容），只回传 `id`, `title`, `updatedAt`, `channel` 等元信息用于客户端时间戳比对。
  - `GET /api/session/:id`: 单个会话详情接口，回传完整的 `history` 数组，用于 Web 端漫游拉取全量数据。
  - `PUT /api/session/:id`: UPSERT 接口，接收端侧发来的全量 `history` 或增量进行覆盖合并，记录来源 `channel`。
  - `DELETE /api/session/:id`: 会话硬删除接口。

### Phase 3: 前端多级缓存同步实现（端云同步阶段）
**目标**：重塑前端的状态管理，坚持 IndexedDB 作为毫秒级响应的高性能缓存，同时以后端接口为“最终权威”。
- [ ] **3.1 服务层接口对接**:
  - 在 `apps/web/src/` 下创建独立的 `SessionSync` 服务类或 Hooks，封装对 Phase 2 接口的网络请求。
- [ ] **3.2 上报数据流 (Push)**:
  - 改造原先只写 IndexedDB 的 `syncToIdb` 流程。
  - 对话流式生成期间只写 IndexedDB，在对话生成结束（如 `onFinish` 回调）后，批量将该 Session 完整的 `messages` 上报（`PUT /api/session/:id`）。
  - 处理新建会话、清空会话、删除会话等交互操作的向后同步。
- [ ] **3.3 下拉同步流 (Pull)**:
  - 用户登录并首次加载页面时，并发进行两项操作：1. 从 IndexedDB 秒开 UI，2. 后台请求 `GET /api/session` 拉取后端列表。
  - 比对两端会话的 `updatedAt` 时间戳：若服务端有更新且本地较旧，发起详情请求覆盖本地 IndexedDB，并响应式刷新 React UI。

### Phase 4: 测试与体验优化（收尾护航）
**目标**：保障在复杂网络和多终端竞态下的产品鲁棒性。
- [ ] **4.1 弱网与重试机制**:
  - 模拟断网场景，确认在 `Sync Service` 请求失败时，应用平滑降级为“单机 IndexedDB 模式”，且不阻塞用户新发消息。
- [ ] **4.2 冲突防抖处理**:
  - 对于短时间内连续对话和并发切换标签页等行为增加合理的 debounce/throttle 限制，避免不必要的 PUT 请求。
