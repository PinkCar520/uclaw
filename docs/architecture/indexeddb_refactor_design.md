# UClaw 本地存储 (IndexedDB) 重构设计方案

## 1. 背景与痛点 (Background & Problems)
目前 UClaw 在 `App.tsx` 中的 IndexedDB 实现采用了“单 Key 存全量 JSON”的模式，将所有的对话和对应的全量历史消息序列化后，存储在 `uclaw_chats` 这个单一的 Key 下。

这种实现方式随着用户使用深度的增加，暴露出了严重的性能和维护问题：
1. **I/O 与序列化性能瓶颈**：每次发送一条新消息，都需要将几 MB 甚至更大的包含所有聊天记录的数组重新序列化，并全量覆盖写入 IndexedDB。这会导致主线程阻塞（卡顿）。
2. **内存消耗过高**：应用启动时，必须将所有历史记录一次性加载到内存中，即使大部分未被查看的对话也占用了内存。
3. **缺乏结构化查询与索引**：无法快速进行排序、过滤和分页，所有的逻辑（如侧边栏按时间排序）都被迫在内存中通过数组遍历来完成。
4. **多 Tab 页同步问题**：如果是两个页面同时操作，极易产生数据相互覆盖的问题（Race Condition）。

为了解决上述问题，并参考了 ChatGPT、DeepSeek、Claude 等业界标杆应用的设计，我们急需对本地存储层进行结构化（Normalization）重构。

---

## 2. 目标与范围 (Goal & Scope)
- **目标**：重构 IndexedDB 存储方案，实现**按需加载**、**局部更新**、**极致响应**。
- **范围**：
  1. 引入轻量级 IndexedDB 封装库 `dexie` 以及配套的 React 响应式 Hook `dexie-react-hooks`。
  2. 重新设计数据库 Schema，将大聚合对象拆分为关系型表结构：`conversations` (对话元数据表) 和 `messages` (消息明细表)。
  3. 提供平滑的数据迁移方案（Data Migration），确保老用户的旧数据自动迁移到新结构。
  4. 替换现有 `App.tsx` 及其他组件中直连 IndexedDB 和状态管理的相关逻辑。

---

## 3. 数据库结构设计 (Database Schema Design)

我们将采用关系型设计的思想，将大块数据拆分成多个专门的 Object Store。

### 3.1 实体模型 (Entity Models)

#### 1. `conversations` (对话列表元数据)
用于极速渲染左侧会话列表页。此表中**绝不包含**聊天历史的具体内容。
*   `id` (主键, string, UUID) - 会话唯一标识
*   `title` (string) - 会话标题
*   `model` (string) - 当前会话使用的模型（如 "deepseek-chat"）
*   `createdAt` (number) - 创建时间戳
*   `updatedAt` (number) - 最后活跃时间戳（**索引字段**：用于侧边栏按最新活跃排序）
*   `systemPrompt` (string, optional) - 对话特定的系统提示词配置

#### 2. `messages` (消息明细表)
用于进入具体会话时，渲染主聊天窗口。
*   `id` (主键, string, UUID) - 消息唯一标识
*   `conversationId` (string) - 外键关联对话（**索引字段**：用于通过 `where('conversationId')` 快速查出某会话的所有消息）
*   `role` (enum: 'user' | 'assistant' | 'system') - 消息发送方
*   `content` (string) - 消息长文本内容
*   `createdAt` (number) - 消息生成时间戳（**索引字段**：用于消息按时间先后排序）
*   `status` (enum: 'sending' | 'success' | 'error', optional) - 消息状态
*   `tokens` (number, optional) - 该条消息消耗的 Token 数

### 3.2 索引设计 (Indexes)
使用 Dexie 的声明式语法，只对需要排序和过滤的字段建立索引：
```typescript
db.version(1).stores({
  conversations: 'id, updatedAt', // id为主键，对 updatedAt 建索引用于倒序排列
  messages: 'id, conversationId, createdAt' // id为主键，根据 conversationId 过滤，根据 createdAt 排序
});
```

---

## 4. 核心数据流与业务场景 (Data Flow & Scopes)

### 4.1 初始加载与侧边栏渲染
*   **重构前**：挂载时加载 `uclaw_chats` 下所有的庞大数据。
*   **重构后**：
    利用 `useLiveQuery` 监听 `conversations` 表：
    ```typescript
    const conversationList = useLiveQuery(
      () => db.conversations.orderBy('updatedAt').reverse().toArray()
    );
    ```
    仅仅加载列表标题等轻量元数据，速度提升至 O(1) 级别。

### 4.2 切换对话详情 (按需加载)
当用户在侧边栏点击某个具体的会话（`currentId` 改变时）：
*   **重构后**：
    ```typescript
    const activeMessages = useLiveQuery(
      () => db.messages.where({ conversationId: currentId }).sortBy('createdAt'),
      [currentId]
    );
    ```
    只从数据库中读取当前会话的消息，内存消耗极低。

### 4.3 发送/接收新消息
*   **重构前**：将新消息 push 进数组，然后序列化整个大数组并覆盖写入 IndexedDB（耗时操作）。
*   **重构后**：
    采用 Dexie 的事务（Transaction）进行局部原子更新：
    ```typescript
    await db.transaction('rw', db.conversations, db.messages, async () => {
      // 1. 新增一条消息记录（耗时极低）
      await db.messages.add({
        id: newMessageId,
        conversationId: activeConversationId,
        role: 'user',
        content: userInput,
        createdAt: Date.now()
      });

      // 2. 更新对应对话的最后活跃时间（侧边栏会自动监听该变化并将此会话置顶）
      await db.conversations.update(activeConversationId, {
        updatedAt: Date.now(),
        // 可选：如果标题为空，可取消息前几个字作为标题
      });
    });
    ```

---

## 5. 迁移策略 (Migration Strategy)

由于不能丢弃老用户的已有历史记录，我们需要在初始化 DB 时提供向后兼容的数据迁移逻辑：

1. **检测老数据**：在应用启动时，使用原生 indexedDB API 或旧版逻辑检测 `uclaw_db` 中是否存在旧的 `uclaw_chats` Key。
2. **数据转换**：
    *   读取出旧的 JSON 数组结构。
    *   遍历数组，将每个对象拆解：把对象的元信息映射并插入到新的 `conversations` 表；把对象内的 `messages` 数组遍历打散，逐条插入到 `messages` 表，并补齐 `conversationId` 和 `id` (若原消息无 ID，则生成 UUID)。
3. **清理老数据**：迁移成功后，删除旧的 `uclaw_chats` Key 以释放空间。
4. **标记迁移完成**：可以在 `localStorage` 中记录一个标记，防止每次启动都重复执行检测逻辑。

---

## 6. 技术选型与依赖

- **包管理**：`pnpm add dexie dexie-react-hooks`
- **Dexie.js**：
  - 极简的 Promise API
  - 支持强大的 Query 语法
  - 对 Typescript 支持良好
  - `useLiveQuery` 完美契合 React，数据库一变动，UI 自动按需渲染。

---

## 7. 实施步骤 (Implementation Steps)

1. **Step 1: 建立基础架构**
   * 安装依赖：`pnpm add dexie dexie-react-hooks uuid`。
   * 创建 `src/db/database.ts`，定义好 Dexie 的 class、Schema 和 Typescript 类型。
   
2. **Step 2: 编写迁移脚本**
   * 在应用入口 (`App.tsx` 或专门的 Provider 中) 编写一次性的数据清洗与迁移逻辑。保证不丢失旧数据。

3. **Step 3: 重构会话列表逻辑 (Sidebar)**
   * 替换原有的全量状态数组，改为从 `useLiveQuery` 订阅 `db.conversations`。

4. **Step 4: 重构消息区域逻辑 (ChatArea)**
   * 替换原有的全量消息遍历，改为监听 `db.messages.where(...)`。
   * 修改发送消息的逻辑，不再执行整个大数组的替换，而是直接调用 `db.messages.add()`。

5. **Step 5: 善后与清理**
   * 移除 `App.tsx` 中旧的防抖写入和冗余的状态同步代码。
   * 补充多 Tab 测试验证。

---
`Document End`
