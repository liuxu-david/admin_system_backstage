# Admin System 后端

NestJS 11 中后台后端：RBAC 权限（用户↔角色↔菜单，权限码挂菜单节点读时派生）+ 项目/场景/文件管理。PostgreSQL + Redis + TypeORM + JWT 双 token。配套前端为独立仓库 `admin_system_front`。

## 快速开始

```bash
docker-compose up -d postgres redis   # 起 PG(5432)/Redis(6379)，账号 postgres/postgres
pnpm install
pnpm seed                             # 自动建表 + 角色/权限/菜单 + 账号 admin / qwer123456
pnpm start:dev                        # → http://localhost:3000 ，Swagger: /api/docs
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm start:dev` | 开发服务（热重载） |
| `pnpm test` | 单元测试（无需数据库） |
| `pnpm seed` | 灌种子数据（幂等） |
| `pnpm migration:generate / run` | 迁移管理（生成方式见 docs/conventions.md） |

## 文档

- **给 AI 助手 / 新人**：先读 [AGENTS.md](AGENTS.md)（项目约定 + 硬约束 + 文档索引）
- 架构与排障 → [docs/architecture.md](docs/architecture.md)
- 权限系统 → [docs/rbac.md](docs/rbac.md)
- 开发约定 → [docs/conventions.md](docs/conventions.md)
- 环境变量 → [docs/env.md](docs/env.md)
- 部署 CI/CD → [docs/ci-cd.md](docs/ci-cd.md)

## 环境要求

Node ≥ 20.11（见 .nvmrc；Node 18 需 main.ts 的 crypto 兜底）· pnpm · Docker（PG/Redis）
