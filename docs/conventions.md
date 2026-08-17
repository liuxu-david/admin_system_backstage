# 开发约定（新增接口 / 模块 / 迁移 checklist）

> 新功能动手前读。按 checklist 走，别即兴发挥。

## 新增业务模块

照抄 `modules/project/` 的结构：

```
modules/<name>/
├─ <name>.module.ts        # TypeOrmModule.forFeature([...实体]) + controllers + providers
├─ <name>.controller.ts    # @ApiTags + @UseGuards(JwtAuthGuard, PermissionsGuard) + @RequirePermissions
├─ <name>.service.ts       # 业务逻辑；抛错用 BusinessException(ErrorCode.XXX)
├─ dto/create-<name>.dto.ts / update-<name>.dto.ts（PartialType）
└─ entities/<name>.entity.ts  # extends BaseEntity
```

最后在 `app.module.ts` imports 里注册模块。

## DTO 规范

- class-validator 装饰器 + `@ApiProperty({description, example})`（Swagger 完整性，CI 不管但保持队形）
- Update 用 `PartialType(CreateXxxDto)`
- 密码类字段用 `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/)`

## 新增受权限保护的接口

1. seed `PERMISSIONS` 登记权限码（`docs/rbac.md` 有完整 checklist）
2. Controller 挂守卫和权限码
3. **把权限码挂到菜单节点上**（否则角色勾了菜单也拿不到权限）：页面查询类挂对应 menu 节点的 `permission`；页面内操作类加 button 子节点。前端 `v-permission="'模块:动作'"`
4. 已在线角色要生效：角色管理重新勾选节点（自动清缓存）

## 改实体（表结构）——最常出错的地方

```bash
# 1) 让对照库跟上当前版本（首次要先建库：docker exec nest-postgres createdb -U postgres nest_migrated）
APP_ENV=dev DB_NAME=nest_migrated pnpm migration:run

# 2) 对对照库生成迁移（自动 diff 出 ALTER/CREATE）
APP_ENV=dev DB_NAME=nest_migrated pnpm migration:generate src/database/migrations/<改了什么>

# 3) 检查生成的 SQL → 提交入库
```

- 为什么不对 dev 库生成：dev 库被 synchronize 实时同步，实体和它永远一致，`migration:generate` 会报 "No changes"。
- 为什么不能跳过：本地 dev 有 synchronize 兜底看不出来；**测试/预发/生产容器只跑 migration**，没有迁移文件 = 部署后表结构不变 = 线上报错。
- 生成迁移的文件名规范：`<时间戳>-<动词+对象>.ts`（工具自动加时间戳）。

## 错误处理

新错误码三张表登记（`foundation/errors/error-codes.ts`）：

```ts
// enum
XXX_NOT_FOUND = 20601,
// ERROR_MESSAGES
[ErrorCode.XXX_NOT_FOUND]: "Xxx not found",
// ERROR_HTTP_STATUS
[ErrorCode.XXX_NOT_FOUND]: HttpStatus.NOT_FOUND,
```

段位规划：rbac 205xx，下一个模块从 206xx 开始。Service 里 `throw new BusinessException(ErrorCode.XXX_NOT_FOUND)`。

## 代码风格

- prettier 已配置（双引号/分号/尾逗号/100 宽度），提交前 `pnpm format`
- eslint：0 error 才能过 CI（warning 不拦）；文件名 kebab-case
- 路径别名：`@foundation/ @common/ @modules/ @config/ @database/`

## 提交前自查

```bash
pnpm exec tsc --noEmit -p tsconfig.json   # 类型干净（spec 文件的 jest 类型噪音可忽略）
pnpm test                                  # 单测全绿
pnpm seed                                  # 改了 seed/实体后重跑（幂等）
```
