# RBAC 权限系统（技术事实版）

> 动权限/角色/菜单前读。完整教学版设计文档已被本篇替代（信息无损，删了口语化讲解）。

## 模型（单一事实源：菜单树）

```
User ──多对多──> Role ──多对多──> Menu（目录/页面/按钮，节点挂权限码）
                                     └─ 权限码 = 读时从勾选节点派生，不落关联表
```

关联表：`user_roles(user_id, role_id)`、`role_menus(role_id, menu_id)`。`role_permissions` 表**已彻底移除**（实体关系、迁移建表、库里的表都清掉了）。

**核心规则**：角色勾了哪个菜单/按钮节点，就拥有该节点 `permission` 字段挂的权限码。页面级权限（如 `user:read`）挂在 menu 节点上——勾了页面 = 能调它的查询接口；操作级权限（如 `user:delete`）挂在 button 节点上。管理员只见一棵树，不存在两处勾选。

## 实体（src/modules/rbac/entities/）

| 实体 | 关键字段 |
|---|---|
| Role | code（唯一，不可改）/ name / description / isSystem（内置角色禁删禁改码）/ sort |
| Permission | code（唯一，`module:action`）/ name / module / action —— 权限码字典，供菜单挂载校验与下拉选择 |
| Menu | parentId（树形自引用）/ name / code（唯一）/ type（directory\|menu\|button）/ path / component / redirect / icon / permission（**menu/button 均可挂**，值 = 某 Permission.code，保存时校验存在）/ sort / visible / status |

三种菜单类型：`directory`（侧边栏分组，无页面）/ `menu`（真实页面，path+component，可挂 read 类权限）/ `button`（页面内操作，挂操作类权限）。

## 服务层

| 文件 | 职责 |
|---|---|
| permission.service.ts | `getUserPermissions(userId)`：User→Roles→Menus 收集非空 `permission` 去重（Redis `user:perms:<id>` 缓存 30min）；`getUserRoleCodes`；`isSuperAdmin`；`invalidateUser`（**清缓存，收回即时生效的关键**） |
| menu.service.ts | `getUserMenuTree(userId, roleIds)`（Redis `user:menus:<id>` 缓存）；`findAllFlat`；`buildTree`（扁平转树） |
| rbac.service.ts | 角色/菜单 CRUD；`assignRoleMenus` / `assignUserRoles`（**每次分配后自动 invalidate**）；菜单保存时校验权限码存在（20509）；`getUserAuthInfo`（聚合 user+roles+permissions+menus，供 `/users/info`）；删菜单时子菜单挂到父级 + 清 role_menus 残留 + 全员清缓存 |

守卫：`PermissionsGuard`（foundation/guards/）——超管短路放行，否则 `required.some(code => userPerms.includes(code))`。

## 种子数据（pnpm seed，幂等）

- 角色：super_admin（内置）/ member（project:read 只读）/ guest（无业务菜单，只有静态首页）
- 权限点清单在 seed 的 `PERMISSIONS` 数组——**新接口挂了 @RequirePermissions 必须同步登记**
- 菜单树：系统管理(用户/角色/菜单) + 项目管理(列表)；页面节点挂 read 权限码，按钮节点挂操作权限码。**首页不在菜单表**——它是前端静态路由，所有登录用户都有、不可配不可删（若依/大厂做法）
- 初始账号：`admin` / `qwer123456`（email 字段存 "admin"，登录 DTO 已放宽为"账号或邮箱"）。**预发/生产部署后立即改强密码**
- seed 的 synchronize 仅在 `SEED_SYNCHRONIZE=true`（本地 pnpm seed 脚本内置）时执行；服务器灌数据不动表结构

## 关键流程

**登录→看到页面**：`POST /auth/login` → 前端存 token → `GET /users/info` → 前端 generateRoutes(菜单树)+permissions 控制按钮 → 渲染。

**权限收回即时生效**：管理接口改分配 → invalidateUser 清 Redis → 用户下次请求被 PermissionsGuard 按新权限拦截（403/20507）；前端刷新后按钮消失。

## 新增一个受权限保护的接口（checklist）

1. seed `PERMISSIONS` 加 `{code:"模块:动作", ...}` → 跑 `pnpm seed`
2. Controller：`@UseGuards(JwtAuthGuard, PermissionsGuard)` + 方法上 `@RequirePermissions("模块:动作")`
3. menus 表加节点挂该 code：页面查询类 → 挂在对应 menu 节点的 permission；页面内操作 → 加 button 子节点。前端 `v-permission="'模块:动作'"`
4. 已在线角色要拿到新权限：角色管理勾选对应节点（会自动清缓存）

## 陷阱

| 坑 | 说明 |
|---|---|
| 直接改库不生效 | 权限/菜单都缓存在 Redis 30 分钟；要么走管理接口（自动清），要么手动清 |
| 权限码两处不一致 | seed 的 PERMISSIONS 与 Controller 的 @RequirePermissions 必须一字不差，否则按钮永远不显示或永远 403 |
| 菜单挂错权限码 | 保存菜单时会校验权限码存在（20509 拦截）；绕过校验直改库 = 勾了节点也拿不到权限 |
| 分配弹窗回显越勾越多 | 历史问题已修：树用 check-strictly（父子解耦）精确回显，提交时自动补父级目录。别改回级联模式，否则勾选父节点会级联勾上全部子孙 |
| 内置角色删除 | isSystem=true 的角色后端拒绝（20503）；别绕过 |
| 数据权限 ≠ RBAC | "只能看自己创建的项目"属于数据权限，在 Service 层加 `where ownerId`，别塞进这套 |
