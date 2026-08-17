# 架构速览

> 排查请求问题 / 新人理解全局时读。≤150 行。

## 请求生命周期

```
HTTP → RequestId 中间件（注入 x-request-id）
      → RequestLogger 中间件（winston 访问日志）
      → 全局 ValidationPipe（whitelist + forbidNonWhitelisted + 隐式类型转换）
      → Controller 前：JwtAuthGuard（验 token → request.user = {sub, email}）
                      → PermissionsGuard（查 Redis/DB 权限 → 不满足抛 20507/403）
      → 业务 Service
      → 全局 ResponseInterceptor（包成 {code:0, data, meta:{秒级timestamp, requestId}}）
      → 异常时：全局 HttpExceptionFilter（包成 {code:20xxx, message, meta:{毫秒timestamp, requestId, path}}）
```

全局前缀 `/api`（health 除外，走 `/health`）。Swagger：`/api/docs`。

## 模块地图

| 模块 | 路由前缀 | 职责 | 备注 |
|---|---|---|---|
| auth | `/api/auth` | 登录/注册/refresh/logout | JWT 双 token；refresh 仅凭 refreshToken 续期（不依赖 access 有效） |
| user | `/api/users` | 用户 CRUD + **`GET /users/info`**（前端登录后第一调，返回 user+roles+permissions+menus） | CRUD 挂权限码；**info / me 仅需登录**（所有用户的核心接口，别加权限码） |
| rbac | `/api/rbac` | 角色/权限/菜单 CRUD + 各类分配 | 写接口全挂权限码；`@Global` 模块 |
| project | `/api/projects` | 项目 CRUD | 权限守卫示范模块 |
| scene / file-management | `/api/scenes` `/api/files` | 场景 / 文件 | 尚未挂权限码 |
| health | `/health` | 探活 | 部署健康检查用 |

## foundation/ 关键件

| 文件 | 作用 |
|---|---|
| `guards/auth.guard.ts` | JwtAuthGuard（passport-jwt，失效抛 20103/401） |
| `guards/permissions.guard.ts` | PermissionsGuard：无 `@RequirePermissions` 元数据→放行；超管短路；否则查权限码集合 |
| `decorators/require-permissions.decorator.ts` | `@RequirePermissions(...codes)`（任一满足）+ `@RequireRoles(...codes)` |
| `decorators/current-user.decorator.ts` | `@CurrentUser()` 取 `{sub, email}` |
| `errors/error-codes.ts` | 错误码三张表（enum/消息/HTTP 状态）。段位：通用 10xxx，用户 20xxx，auth 201xx，project 202xx，scene 203xx，file 204xx，**rbac 205xx** |
| `interceptors/response.interceptor.ts` | 成功响应统一包装 |
| `filters/http-exception.filter.ts` | 错误响应统一包装（BusinessException → 对应 HTTP 状态） |
| `constants/redis-keys.ts` | Redis key 模板：`user:perms:<id>`、`user:menus:<id>` |

## common/ 外部服务

- **redis**：`REDIS_CLIENT` token（`@Inject(REDIS_CLIENT)` + `Redis` 类型），`@Global` 可随处注入。`lazyConnect` + 重试上限。
- email / sms / file-storage：Provider 接口模式，可换实现（SMTP / mock / local / s3）。
- logger：winston，`app.useLogger(WINSTON_MODULE_NEST_PROVIDER)`。

## 数据层

- TypeORM + PostgreSQL。所有实体继承 `BaseEntity`（uuid 主键 + created_at/updated_at timestamptz）。
- 开发库 `nest_backend_dev`（docker-compose 起），synchronize=true（仅 APP_ENV=dev）。
- 迁移：`src/database/migrations/`，容器部署时自动跑；种子：`pnpm seed`（幂等）。

## 陷阱

| 现象 | 原因 / 解法 |
|---|---|
| Node 18 启动报 `crypto is not defined` | TypeORM 用了全局 crypto（Node 19+ 才有）。main.ts 顶部已加兜底 polyfill；根治是升 Node 20 |
| 改了权限数据库里也改了，界面不生效 | Redis 缓存 `user:perms:<id>` / `user:menus:<id>`，30 分钟 TTL。走管理接口改会自动清；直接改库要手动 `DEL` 或 `docker exec admin-redis redis-cli FLUSHDB` |
| tsc 全屏 `Cannot find module` 但 IDE 正常 | node_modules 半残（pnpm 安装被中断），`pnpm install` 重装 |
| bcrypt 报找不到 binding | `pnpm rebuild bcrypt` |
| 部署迁移报 `uuid_generate_v4 does not exist` | 基线迁移已带 `CREATE EXTENSION "uuid-ossp"`；老基线重新生成 |
| vite 代理下 `/api/health` 404 | `/health` 本来就不带 `/api` 前缀。dev 探活直接打 `:3000/health`；生产 nginx 已配 `location = /health` 直转发，不受影响 |
| 改用户密码不生效 | dto.password 是明文入参，实体列是 password_hash——必须 `hashPassword()` 后赋给 `passwordHash`，别 `Object.assign(user, dto)`（踩过：返回成功但库里没变） |
