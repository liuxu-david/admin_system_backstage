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
- 部署 CI/CD → [docs/ci-cd.md](docs/ci-cd.md)；亲手部署教程 → [deploy/README.md](deploy/README.md)
- Redis 缓存（哪些用/不用/怎么用）→ [docs/redis.md](docs/redis.md)

## 环境要求

Node `24.19.0`（见 `.nvmrc`）· pnpm `11.20.0` · Docker（本地 PG/Redis）

## 测试发布

GitHub Actions 使用托管 Runner 检查、构建并推送 GHCR；服务器不做构建。PR 不发布；push main 默认只推镜像；首次人工 bootstrap、seed、改密后，才手动 `workflow_dispatch deploy=true`。仓库变量 `AUTO_DEPLOY_TEST=true` 可显式开启后续 main 自动部署。

统一配置来源为 `deploy/`，服务器固定 `/opt/admin-system-test/`，仅部署 Summary 输出的完整后端／前端 digest。SSH 隧道访问 `http://127.0.0.1:18080`，不要求域名。开发用 `pnpm seed` 不能照搬到服务器，应运行手册中的 `manage.py seed`。

本地实现尚不等于云端启用；当前工作分支待用户审核、提交、推送、PR。双端 Docker 镜像构建受 Docker Hub 认证网络超时阻塞，GitHub／GHCR／真实服务器发布未执行；具体本地验证结果见部署手册。
