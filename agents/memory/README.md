# Agent Memory Layer (LTM)

## Architecture Overview

The Memory Layer provides long-term persistence for the Ocean agent, enabling it to remember past bug fixes, project contexts, and user preferences across separate chat sessions.

### 1. Vector Memory (RAG)
- **Engine**: ChromaDB or Milvus (Local for Intranet).
- **Purpose**: Semantic search of project documentation, historical bug resolutions, and internal coding standards (.AIGUIDE.md).

### 2. Session Context (Short-term Cache)
- **Engine**: Redis.
- **Purpose**: Tracking current step progress in mult-stage skills (e.g., waiting for `git_add` before `git_commit`).

### 3. Experience Memory (Self-Evolving)
- **Purpose**: After a successful `fix-bug` workflow, the agent summarizes the "lesson learned" and stores it as a project-specific insight to avoid making similar mistakes in the future.

---

## Roadmap

- [ ] Implement `memory.service.ts` in Gateway.
- [ ] Connect to a local Vector index in `/agent/memory/index/`.
- [ ] Implement "Reflection Step" in `SkillOrchestrator` to update memory after task completion.
