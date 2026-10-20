# AGENTS.md — 后端 admin_system_backstage

> AI 助手开工前先读完本文件（~1 分钟）。只写项目特有的约定，通用知识不赘述。
> 配套前端是**独立仓库** `admin_system_front`（Vue3 + Element Plus）。
> 最后治理：2026-08-17 · 治理规则见文末

## 项目一句话

NestJS 11 中后台后端：RBAC 权限（用户↔角色↔菜单，权限码从勾选的菜单节点派生）+ 项目/场景/文件管理。PostgreSQL 16 + Redis 7 + TypeORM + JWT 双 token。pnpm + Node ≥20.11（见 .nvmrc）。

## 常用命令

| 场景 | 命令 |
|---|---|
| 起 PG/Redis（Docker，一次性） | `docker-compose up -d postgres redis` |
| 启动开发服务 | `pnpm start:dev` → http://localhost:3000，Swagger `/api/docs` |
| 单元测试（无需数据库） | `pnpm test` |
| 类型检查 | `pnpm exec tsc --noEmit -p tsconfig.json` |
| 灌种子数据（幂等，可重复跑） | `pnpm seed` |
| 生成迁移 | `APP_ENV=dev DB_NAME=nest_migrated pnpm migration:generate src/database/migrations/<名称>` |

## 目录速览

```
src/
├─ foundation/   横切关注点：guards(认证/权限)、filters、interceptors、错误码、自定义装饰器
├─ common/       外部服务适配：redis、email、sms、file-storage、logger
├─ modules/      业务模块：auth / user / rbac / project / scene / file-management / health
├─ config/       配置注册（configuration.ts 是所有 env 的唯一入口）
└─ database/     data-source + migrations + seeds
```

新业务 = `modules/` 下照抄现有模块结构（module / controller / service / dto / entities）。

## 硬约束（每条都带原因）

1. **表结构**：dev 用 synchronize 自动同步；**test/预发/生产只走 migration**（容器启动由 entrypoint 自动 `migration:run`）。改实体后必须补迁移文件，否则部署环境表不会变。生成迁移要对 `nest_migrated` 对照库（先 `APP_ENV=dev DB_NAME=nest_migrated pnpm migration:run` 让它跟上版本），别对 dev 库生成——dev 库被 synchronize 管着，实体和它永远一致，diff 不出东西。
2. **鉴权写法**：Controller 上 `@UseGuards(JwtAuthGuard, PermissionsGuard)`（**顺序不能反**，权限守卫依赖认证守卫注入的 `request.user`），方法上 `@RequirePermissions("module:action")`。权限码 = `模块:动作`（如 `project:create`），新接口要在 seed 的 `PERMISSIONS` 数组同步登记，两处不一致 = 按钮隐藏或接口 403。
3. **权限/菜单变更必须清缓存**：所有"分配"类操作后调 `permissionService.invalidateUser(userId)`（改角色权限要遍历该角色下用户清缓存）。不清的话 Redis 里旧权限/旧菜单最多 30 分钟内仍生效——这是设计（读多写少上缓存），不是 bug。
4. **响应格式**：成功 `{code:0,data,meta}`（秒级时间戳）、错误 `{code:20xxx,...}`（毫秒，故意不同）。全局拦截器/过滤器已处理，**Controller 直接返回业务数据**，别自己包一层。
5. **错误码**：新错误先在 `foundation/errors/error-codes.ts` 的**三张表**（enum / ERROR_MESSAGES / ERROR_HTTP_STATUS）里登记，再抛 `BusinessException`。RBAC 用 205xx 段。
6. **环境变量**：一律走 `src/config/configuration.ts` 注册（带默认值），业务代码禁止散落 `process.env.XXX`。仓库里的 `.env.*` 是模板；真实密钥只存在于服务器的 `.env`（见 docs/ci-cd.md）。
7. **JWT 里不放权限**：token 只有 `{sub, email, type}`。权限实时查 Redis/DB——放进 token 的话，撤销权限后旧 token 仍带旧权限，收回不生效。

## 何时读哪篇文档（按需加载，别全读）

| 要做的事 | 读 |
|---|---|
| 动权限 / 角色 / 菜单任何东西 | `docs/rbac.md` |
| 要用缓存 / 清缓存 / 动 redis-keys | `docs/redis.md` + `docs/rbac.md` |
| 新增接口、模块、DTO | `docs/conventions.md` |
| 理解架构 / 排查请求问题 | `docs/architecture.md` |
| PG / Redis 是什么、怎么连怎么运维 | `docs/infra.md` |
| 配环境变量 / 部署 / CI | `docs/env.md` + `docs/ci-cd.md` |

## 治理约定

- 本文件 ≤130 行；`docs/` 每篇 ≤150 行。超了就精简或拆分，**不追加**。
- 大改动合入后核对：命令、目录、硬约束是否仍然真实。
- 新陷阱 → 记到对应 docs 的"陷阱"小节；AGENTS.md 不堆细节。
