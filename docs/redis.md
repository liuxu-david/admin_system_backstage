# Redis 使用手册：哪些用、哪些不用、怎么用

> 一句话总览：**本项目 Redis 只做"缓存"，不做"主存储"**。全部业务数据都在 PG，Redis 里的东西丢了能自动重建。
> 当前真正落地的只有 **2 个缓存**：用户权限码集合、用户菜单树（各 30 分钟过期）。登录 Token、验证码、限流**都没有**用 Redis。

## 0. 一分钟理解：判断"该不该用 Redis"

| 判断 | 结论 |
|---|---|
| 数据丢了能不能接受（下次请求从 PG 重建） | ✅ 能 → 可以放 Redis |
| 读得极频繁、写得极少（如权限：每个请求都查） | ✅ 是 → 值得缓存 |
| 必须不丢、要持久化、要复杂查询 | ❌ → 放 PG |
| 普通 CRUD、低频查询（如项目列表） | ❌ → 直查 PG 就够，加缓存是自找麻烦 |

**本项目的原则：默认不用缓存。** 只有"每个请求都要查、且结果很少变"的数据才值得缓存——目前只有权限和菜单满足。

## 1. ✅ 用了 Redis 的操作（全项目仅 2 处）

| 缓存 | key | Redis 结构 | TTL | 读它的接口 | 代码位置 |
|---|---|---|---|---|---|
| 用户权限码集合 | `user:perms:<userId>` | Set（`SMEMBERS`/`SADD`） | 30 分钟 | 所有带 `@RequirePermissions` 的接口 + 登录后拉授权信息 | `permission.service.ts:30` |
| 用户菜单树 | `user:menus:<userId>` | String（整棵树 JSON） | 30 分钟 | 登录后拉授权信息（前端动态路由数据源） | `menu.service.ts:40` |

### 1.1 权限码缓存流程

```
请求 → PermissionsGuard 调 getUserPermissions(userId)
  ├─ SMEMBERS user:perms:<id> 命中 → 直接返回（绝大多数请求走这条，不查库）
  └─ 未命中 → 查 PG（user → roles → menus，收集菜单上的 permission 字段去重）
              → SADD ... + EXPIRE 1800 → 返回
```

- 权限码不落表，是"角色勾选的菜单节点的 permission 字段"读时派生，缓存的就是这个派生结果。
- ⚠️ 边界：**零权限用户不会被缓存**（`SADD` 空集合写不进去），每请求都查库。此类用户极少，暂不处理。

### 1.2 菜单树缓存流程

```
登录后前端拉授权信息 → getUserMenuTree(userId, roleIds)
  ├─ GET user:menus:<id> 命中 → JSON.parse 返回（parse 失败则忽略缓存查库）
  └─ 未命中 → 查 PG（enabled 且角色匹配，去重建树）→ SET <JSON> EX 1800 → 返回
```

- 与权限缓存相反：**空树也写缓存**（`SET "[]"`），菜单为空的用户不会穿透。
- 管理端扁平菜单列表 `findAllFlat()` 不走缓存，直查库（低频，没必要）。

## 2. ❌ 没用 Redis 的操作（别误以为有缓存）

| 操作 | 现状 | 说明 |
|---|---|---|
| **登录 access token** | 纯无状态 JWT，验签名即过 | 代价：15 分钟内无法服务端吊销（见 §6） |
| **Refresh token** | 存 **PG**（7 天，轮换时旧的置无效） | 要持久化可审计，放 PG 是对的 |
| 登录/注册查邮箱、用户 CRUD、角色列表、权限字典 | 直查 PG | 低频，无缓存意义 |
| 角色编码/超管判断（`getUserRoleCodes`/`isSuperAdmin`） | 每请求直查 PG | 未来有性能压力时的下一个缓存候选 |
| 项目 / 场景 / 文件管理、所有分页列表 | 直查 PG | 普通业务 CRUD，分页参数组合多缓存命中率低 |
| 验证码、接口限流 | **功能本身不存在**（email/sms 只是发送门面） | `redis-keys.ts` 已预留 key，实现时优先用（见 §4） |
| 健康检查 | 只回进程状态，不 ping Redis | — |

## 3. 缓存失效：什么操作会自动清缓存

**规则：凡是改了"角色↔菜单"或"用户↔角色"关系，必须清受影响用户的两个缓存**（`invalidateUser`/`invalidateUsers`），否则收回权限最长 30 分钟不生效。已实现：

| 管理操作 | 清理范围 | 代码位置 |
|---|---|---|
| 给用户分配角色 `assignUserRoles` | 该用户 | `rbac.service.ts:139` |
| 给角色分配菜单 `assignRoleMenus` | 该角色下所有用户 | `rbac.service.ts:126` |
| 删除角色 `deleteRole` | 该角色下所有用户（删前取好名单） | `rbac.service.ts:117` |
| 更新/删除菜单 `updateMenu`/`deleteMenu` | **全部**用户（遍历用户表） | `rbac.service.ts:192,210` |

不需要清的：`createMenu`（新菜单没分给角色，不影响任何人的树）、`updateRole`（只改名/排序，不影响权限内容）。

**已知缺口**：① 直接改数据库不清缓存，等 30 分钟或手动 `FLUSHDB`（见 docs/infra.md）；② user.service 更新/删除用户没清 key，会残留到 TTL 过期（无害）；③ 菜单改动是全表扫用户逐个 DEL，用户量大时有隐患（简化实现）。

## 4. Key 清单（`src/foundation/constants/redis-keys.ts`）

**新加缓存必须在这里定义 key 模板**，禁止业务代码手写字符串拼接（防撞名）。

| key 模板 | 格式 | 状态 |
|---|---|---|
| `USER_PERMISSIONS` | `user:perms:<userId>` | ✅ 使用中 |
| `USER_MENUS` | `user:menus:<userId>` | ✅ 使用中 |
| `USER_TOKEN` / `USER_REFRESH_TOKEN` | `user:token|refresh:<userId>` | 🔲 预留（token 吊销/强制下线用） |
| `RATE_LIMIT` | `rate-limit:<ip>:<route>` | 🔲 预留（限流用） |
| `VERIFY_CODE` | `verify:<type>:<target>` | 🔲 预留（验证码用） |
| `CACHE` | `cache:<module>:<key>` | 🔲 通用前缀，新模块缓存可用 |

## 5. 怎么用（开发者视角）

### 5.1 注入（无封装 service，直接用 ioredis 原生客户端）

`RedisModule` 是全局模块（`src/common/redis/redis.module.ts`），任何 provider 直接注入：

```ts
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../common/redis/redis.module";

constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
```

连接读 `.env` 的 `REDIS_HOST/PORT/PASSWORD/DB`（见 docs/env.md）；重试策略都在 redis.module.ts，业务代码不用管。

### 5.2 标准代码模式（照抄 permission.service.ts）

```ts
// 1. redis-keys.ts 里定义 key 模板（函数形式）
// 2. 读 → 未命中查库 → 写（必须带过期，禁止永不过期的 key）
const cached = await this.redis.get(cacheKey);
if (cached) return JSON.parse(cached);
const data = await this.repo.findOne(/* ... */);          // 查 PG
await this.redis.set(cacheKey, JSON.stringify(data), "EX", 1800);
// 3. 提供 invalidateXxx() 失效方法，并在所有"改"操作里调用（参考 §3）
await this.redis.del(cacheKey);
```

### 5.3 新增缓存 checklist

1. 先过 §0 两问——**默认答案是"不用缓存"**。
2. key 模板加到 `redis-keys.ts`；**必须带 TTL**，禁止裸 `SET`。
3. 写操作后必须调失效方法（参考 §3），并在 service 注释里写明。
4. 想清楚空值缓不缓存（菜单空树写入 / 权限空值不写，各有理由，选了就注释）。
5. `JSON.parse` 包 try/catch，缓存损坏降级查库。

常用命令：`get/set(key, val, "EX", 秒)` · `smembers/sadd/expire` · `del(可传多 key)` · `ttl`（看剩余秒数）。

## 6. 排障速查

| 现象 | 原因 / 解法 |
|---|---|
| 管理界面改了权限/菜单，用户页面没变 | 走管理接口会自动清缓存；没生效查是否漏调 invalidate；最粗暴 `FLUSHDB` |
| 直接改库后页面不变 | 直接改库**不会**清缓存，等 30 分钟或手动清（命令见 docs/infra.md） |
| 想看某人缓存 / 剩余过期时间 | `docker exec -it nest-redis redis-cli` → `SMEMBERS user:perms:<id>` / `GET user:menus:<id>` / `TTL <key>` |
| 后端连不上 Redis / 报 NOAUTH | `docker ps` 看容器是否 healthy；NOAUTH 是 `.env` 的 REDIS_PASSWORD 和容器不一致 |
| 登出/改权限后旧 token 还能用 | **与 Redis 无关**：access token 是无状态 JWT，15 分钟内验签名就过；但权限守卫查的是已清的缓存，权限类接口会被即时拦住，纯登录态接口拦不住（已知限制） |

> 部署环境的 Redis 运维命令（清缓存、看容器、密码）统一见 docs/infra.md，本文不重复。
