# RBAC 权限系统设计文档

> 适用项目：`nest-backend`（NestJS 11 + TypeORM + PostgreSQL + Redis + JWT）
> 阅读对象：前后端开发，以及**第一次接触权限系统的新人**
> 目标：读完这一篇，你能独立完成一个「接口权限 + 菜单权限」双轨的 RBAC 系统。

---

## 0. 先搞懂一件事：权限系统到底在管什么

想象一下公司的门禁系统：

- 你（**人**）入职，会发给你一张**工牌**（账号 + 密码登录）→ 这叫 **认证（Authentication）**：你是谁？
- 但光有工牌进不了所有门。HR 会把你分到「研发部」→ 这叫 **角色（Role）**
- 「研发部」的人能进机房、能开服务器柜子 → 这叫 **权限（Permission）**
- 公司大厅墙上挂着楼层指引牌，告诉你「3 楼是研发区」→ 这叫 **菜单（Menu）**

所以一个权限系统其实管两件事：

| 中文 | 英文 | 一句话 | 例子 |
|---|---|---|---|
| 认证 | Authentication | 你是谁？ | 输入账号密码，拿到 token |
| 授权 | Authorization | 你能干嘛？ | 你能不能点这个按钮、进这个页面 |

**本项目现状**：认证已经做得很好（JWT 双 token），但授权几乎没有——只是在用户表里写死了一个 `role` 字段（admin/user 两个值）。本方案要做的，就是把「授权」这一块补成完整的 RBAC。

---

## 1. 四个核心概念（记住这四个词就够了）

```
┌──────────┐  拥有   ┌──────────┐  拥有   ┌──────────────┐
│   用户    │ ──────▶ │   角色    │ ──────▶ │   权限/菜单   │
│  User    │         │  Role    │         │ Perm / Menu  │
└──────────┘         └──────────┘         └──────────────┘
   张三                 项目经理              创建项目、删除项目
```

| 概念 | 通俗解释 | 例子 |
|---|---|---|
| **用户 User** | 一个真实的人、一个账号 | 张三（zhangsan@xx.com） |
| **角色 Role** | 一类身份，是「权限的打包」 | 项目经理、普通成员、游客 |
| **权限 Permission** | 一个具体的「能不能做某件事」，对应一个后端接口 | `project:create`（创建项目） |
| **菜单 Menu** | 页面上看到的导航项 + 页面内的按钮 | 「项目管理」菜单、「删除」按钮 |

**为什么要角色这一层？** 因为直接给 100 个用户一个个配权限太累了。给「项目经理」这个角色配好权限，然后让 30 个人都当「项目经理」即可。**角色就是权限的模板，用户套用模板。**

> 一个用户可以有多个角色（比如张三既是「项目经理」又是「审核员」），他的权限是这些角色权限的**并集**。

---

## 2. 整体架构

### 2.1 两种权限，各管各的

```
┌─────────────────────────────────────────────────────────────┐
│                        RBAC 权限系统                          │
├─────────────────────────┬───────────────────────────────────┤
│    接口权限 (API Perm)   │         菜单权限 (Menu)            │
│   管的是「后端接口」      │      管的是「前端页面」             │
│                         │                                   │
│   project:create        │   目录: 系统管理                    │
│   project:delete        │     └ 菜单: 用户管理 (/system/user) │
│   user:read             │         ├ 按钮: 新增 (user:create) │
│                         │         └ 按钮: 删除 (user:delete) │
│   → 后端 Guard 拦截       │   → 前端渲染路由/侧边栏/按钮        │
└─────────────────────────┴───────────────────────────────────┘
```

- **接口权限**：用户调 `POST /project` 时，后端的 `PermissionsGuard` 检查他有没有 `project:create` 权限。**这是最后一道防线，前端再怎么绕，后端都拦得住。**
- **菜单权限**：决定前端「能看到哪些菜单、能进哪些页面、按钮显不显示」。**只是体验优化**——把没权限的东西藏起来，让用户界面清爽。

> ⚠️ 重要原则：**前端菜单权限是「锦上添花」，后端接口权限才是「真防线」。** 因为前端代码在用户浏览器里，可以被篡改；后端是服务器，用户改不了。所以哪怕前端漏放了按钮，后端拦住了，数据也是安全的。

### 2.2 一次请求的全过程

```
用户点击「删除项目」按钮
      │
      ▼
┌─ 前端 ──────────────────────────────────┐
│ 1. 按钮上挂着 v-permission="'project:delete'"│
│    查本地存的 permissions，没有就根本不显示    │
│ 2. 有的话，发请求 DELETE /project/123        │
│    Header 带 Authorization: Bearer <token>   │
└──────────────────────────────────────┘
      │
      ▼
┌─ 后端 ──────────────────────────────────┐
│ 3. JwtAuthGuard：验证 token 合法性 → 注入 userId│
│ 4. PermissionsGuard：                      │
│    - 先查 Redis 缓存（user:perms:<userId>）   │
│    - 没缓存就查库：用户→角色→权限，去重         │
│    - 把权限列表挂到 request.user.permissions  │
│ 5. Controller 方法上的 @RequirePermissions    │
│    ('project:delete') 检查是否包含            │
│    - 不包含 → 抛 403                          │
│    - 包含 → 执行删除逻辑                       │
└──────────────────────────────────────┘
```

---

## 3. 数据库设计（共 7 张表）

### 3.0 总览图

```
                         ┌───────────┐
                         │   users   │  ← 已存在，去掉 role 字段
                         └─────┬─────┘
                               │ 多对多
                          ┌────┴─────┐
                          │user_roles│  ← 关联表
                          └────┬─────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
        ┌─────────┐      ┌───────────┐      ┌───────────┐
        │  roles  │      │role_perms │      │role_menus │  ← 关联表
        └────┬─────┘      └─────┬─────┘      └─────┬─────┘
             │                  │                  │
             │ 多对多           │ 多对多           │ 多对多
             │                  ▼                  ▼
             │            ┌──────────────┐   ┌────────┐
             │            │ permissions  │   │ menus  │  ← 树形(自引用)
             │            └──────────────┘   └────────┘
             │
        ┌────┴────┐
        │parent_id│  (角色可选继承，进阶功能)
        └─────────┘
```

| # | 表名 | 类型 | 作用 |
|---|---|---|---|
| 1 | `users` | 已有 | 用户，**需移除 `role` enum 字段** |
| 2 | `roles` | 新建 | 角色 |
| 3 | `permissions` | 新建 | 接口权限点（`module:action`） |
| 4 | `menus` | 新建 | 菜单/目录/按钮（树形） |
| 5 | `user_roles` | 新建 | 用户 ↔ 角色（多对多） |
| 6 | `role_permissions` | 新建 | 角色 ↔ 接口权限（多对多） |
| 7 | `role_menus` | 新建 | 角色 ↔ 菜单（多对多） |

> 其中 5、6、7 是「关联表」，TypeORM 里用 `@ManyToMany + @JoinTable` 会自动建，**不用手写 entity**。

---

### 3.1 表：`roles`（角色）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 主键（继承 BaseEntity） |
| code | varchar(50) | 唯一、非空 | 角色编码，如 `super_admin` / `project_manager` |
| name | varchar(100) | 非空 | 显示名，如「超级管理员」 |
| description | varchar(255) | 可空 | 描述 |
| is_system | boolean | 默认 false | 是否内置角色（内置的不可删除，防误删把超管删了） |
| sort | int | 默认 0 | 排序 |
| created_at | timestamptz | | 创建时间 |
| updated_at | timestamptz | | 更新时间 |

**示例数据**：

| id | code | name | is_system |
|---|---|---|---|
| … | super_admin | 超级管理员 | true |
| … | project_manager | 项目经理 | false |
| … | member | 普通成员 | false |
| … | guest | 游客 | false |

---

### 3.2 表：`permissions`（接口权限）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 主键 |
| code | varchar(100) | 唯一、非空 | 权限标识，**核心**，如 `project:create` |
| name | varchar(100) | 非空 | 显示名，如「创建项目」 |
| module | varchar(50) | 非空 | 所属模块，如 `project`、`user`、`scene` |
| action | varchar(50) | 非空 | 动作，如 `create`、`read`、`update`、`delete` |
| description | varchar(255) | 可空 | 描述 |
| created_at / updated_at | | | |

**命名规范**：`code = module + ":" + action`，例如 `project:create`、`user:delete`、`scene:publish`。

**示例数据**：

| code | name | module | action |
|---|---|---|---|
| project:create | 创建项目 | project | create |
| project:read | 查看项目 | project | read |
| project:update | 编辑项目 | project | update |
| project:delete | 删除项目 | project | delete |
| scene:publish | 发布场景 | scene | publish |
| user:read | 查看用户 | user | read |
| user:delete | 删除用户 | user | delete |

> 💡 这张表的每一行，**几乎对应后端的一个 Controller 方法**。新增接口时，记得在这里加一条，并在 Controller 上挂 `@RequirePermissions`。

---

### 3.3 表：`menus`（菜单，树形结构）⭐ 重点

这张表是最关键的，它同时承担「路由」「侧边栏」「按钮」三种用途。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 主键 |
| parent_id | uuid | 可空、外键 | 父菜单 id，**根菜单为 null**（树形靠它） |
| name | varchar(100) | 非空 | 显示名，如「项目管理」「新增」 |
| code | varchar(100) | 唯一 | 唯一编码，如 `system:user` |
| type | enum | 非空 | 三选一：`directory` / `menu` / `button` |
| path | varchar(255) | 可空 | 前端路由路径，如 `/system/user`（目录/按钮可为空） |
| component | varchar(255) | 可空 | 前端组件路径，如 `system/user/index`（目录/按钮可为空） |
| redirect | varchar(255) | 可空 | 目录点击后跳转的第一个子菜单 |
| icon | varchar(100) | 可空 | 图标名，如 `Setting`、`el-icon-user` |
| permission | varchar(100) | 可空 | 关联的权限 code（**按钮专用**），如 `user:delete` |
| sort | int | 默认 0 | 同级排序，数字越小越靠前 |
| visible | boolean | 默认 true | 是否在侧边栏显示（有些页面想藏起来） |
| status | enum | 默认 enabled | `enabled` / `disabled` |
| created_at / updated_at | | | |

**type 的三种类型（务必理解）**：

| type | 通俗理解 | 例子 | 必填字段 |
|---|---|---|---|
| `directory` 目录 | 侧边栏里一个「可展开的分组」，不含页面 | 「系统管理」（点开下面有用户、角色） | name, code, icon |
| `menu` 菜单 | 一个真实页面，对应一个路由 | 「用户管理」(`/system/user`) | name, code, path, component |
| `button` 按钮 | 页面里的某个操作按钮，不显示在侧边栏 | 「删除」按钮 | name, code, **permission** |

**示例数据（一棵树）**：

```
系统管理 (directory, /system, icon: Setting)
├── 用户管理 (menu, /system/user, component: system/user/index)
│   ├── 新增用户 (button, permission: user:create)
│   ├── 删除用户 (button, permission: user:delete)
│   └── 重置密码 (button, permission: user:reset-password)
├── 角色管理 (menu, /system/role, component: system/role/index)
│   └── 分配权限 (button, permission: role:assign)
│
项目管理 (directory, /project, icon: Folder)
└── 项目列表 (menu, /project/list, component: project/list/index)
    ├── 创建项目 (button, permission: project:create)
    └── 删除项目 (button, permission: project:delete)
```

> 💡 **按钮型菜单的 `permission` 字段**是连接「菜单权限」和「接口权限」的桥梁：前端看到这个按钮关联了 `user:delete`，就去查用户有没有这个接口权限，有才显示按钮。

---

### 3.4 表：`user_roles`（用户-角色）

| 字段 | 类型 | 约束 |
|---|---|---|
| user_id | uuid | 联合主键、外键 → users |
| role_id | uuid | 联合主键、外键 → roles |

> 一个用户可有多行，一个角色也可被多用户拥有 = 多对多。

---

### 3.5 表：`role_permissions`（角色-接口权限）

| 字段 | 类型 | 约束 |
|---|---|---|
| role_id | uuid | 联合主键、外键 → roles |
| permission_id | uuid | 联合主键、外键 → permissions |

---

### 3.6 表：`role_menus`（角色-菜单）

| 字段 | 类型 | 约束 |
|---|---|---|
| role_id | uuid | 联合主键、外键 → roles |
| menu_id | uuid | 联合主键、外键 → menus |

---

### 3.7 对 `users` 表的改造

**删除**现有的 `role` 字段（[user.entity.ts:19-20](../src/modules/user/entities/user.entity.ts#L19)），**新增**与角色的多对多关系：

```ts
// 改造前
@Column({ type: "enum", enum: UserRole, default: UserRole.USER })
role!: UserRole;

// 改造后：删掉上面那行，改为
@ManyToMany(() => Role, (role) => role.users)
@JoinTable({ name: "user_roles" })   // 自动生成 user_roles 关联表
roles!: Role[];
```

> 同时可以删掉 [foundation/enums/user.enum.ts](../src/foundation/enums/user.enum.ts) 里的 `UserRole`（`UserStatus` 保留）。

---

## 4. 后端要做的事

### 4.1 模块结构（沿用项目现有约定）

```
src/modules/rbac/
├── entities/
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   └── menu.entity.ts
├── dto/
│   ├── create-role.dto.ts
│   ├── create-menu.dto.ts
│   └── assign-permissions.dto.ts   # 给角色分配权限的入参
├── permission.service.ts           # 核心：加载/缓存用户权限
├── menu.service.ts                 # 核心：构建菜单树
├── rbac.service.ts                 # 角色/权限/菜单的 CRUD
├── rbac.controller.ts              # 管理接口
└── rbac.module.ts
```

`PermissionsGuard`、`@RequirePermissions` 装饰器放 `src/foundation/`（横切关注点，和 `JwtAuthGuard` 同级）。

---

### 4.2 Entity 代码示例（贴合现有 BaseEntity 风格）

```ts
// src/modules/rbac/entities/role.entity.ts
import { Column, Entity, Index, ManyToMany } from "typeorm";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { Permission } from "./permission.entity";
import { Menu } from "./menu.entity";
import { User } from "../../user/entities/user.entity";

@Entity("roles")
export class Role extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 50 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string;

  @Column({ type: "boolean", name: "is_system", default: false })
  isSystem!: boolean;

  @Column({ type: "int", default: 0 })
  sort!: number;

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[];

  @ManyToMany(() => Permission, (p) => p.roles)
  @JoinTable({ name: "role_permissions" })
  permissions!: Permission[];

  @ManyToMany(() => Menu, (m) => m.roles)
  @JoinTable({ name: "role_menus" })
  menus!: Menu[];
}
```

```ts
// src/modules/rbac/entities/permission.entity.ts
@Entity("permissions")
export class Permission extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 50 })
  module!: string;

  @Column({ type: "varchar", length: 50 })
  action!: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[];
}
```

```ts
// src/modules/rbac/entities/menu.entity.ts
export enum MenuType {
  DIRECTORY = "directory",
  MENU = "menu",
  BUTTON = "button",
}

@Entity("menus")
export class Menu extends BaseEntity {
  @Column({ type: "uuid", name: "parent_id", nullable: true })
  parentId!: string | null;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "enum", enum: MenuType })
  type!: MenuType;

  @Column({ type: "varchar", length: 255, nullable: true })
  path!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  component!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  redirect!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  icon!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  permission!: string;   // 按钮专用，关联 permissions.code

  @Column({ type: "int", default: 0 })
  sort!: number;

  @Column({ type: "boolean", default: true })
  visible!: boolean;

  @Column({ type: "enum", enum: ["enabled", "disabled"], default: "enabled" })
  status!: "enabled" | "disabled";

  @ManyToMany(() => Role, (role) => role.menus)
  roles!: Role[];
}
```

> 关联表 `user_roles` / `role_permissions` / `role_menus` 由 `@JoinTable` 自动生成，**无需手写**。

---

### 4.3 装饰器：声明「这个接口需要什么权限」

```ts
// src/foundation/decorators/require-permissions.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/**
 * 用法：
 *   @RequirePermissions("project:create")
 *   @RequirePermissions("project:update", "project:delete")  // 满足任一即可
 */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

// 同理可做一个 @RequireRoles("admin")
export const ROLES_KEY = "roles";
export const RequireRoles = (...codes: string[]) =>
  SetMetadata(ROLES_KEY, codes);
```

在 Controller 上使用：

```ts
@RequirePermissions("project:create")     // ← 加这一行
@Post()
create(@Body() dto: CreateProjectDto) {
  return this.projectService.create(dto);
}
```

---

### 4.4 守卫：执行权限校验

```ts
// src/foundation/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector,
              private readonly permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没标 @RequirePermissions 的接口，说明不需要特殊权限，放行
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;   // JwtAuthGuard 已经注入

    // 超管短路：超级管理员拥有一切权限，不查库
    if (await this.permissionService.isSuperAdmin(user.userId)) {
      return true;
    }

    // 拿到当前用户的全部权限码（带 Redis 缓存）
    const userPerms = await this.permissionService.getUserPermissions(user.userId);

    // 满足任意一个所需权限即可（也可改成全部满足 && ）
    const ok = required.some((code) => userPerms.includes(code));
    if (!ok) {
      throw new BusinessException(ErrorCode.RBAC_PERMISSION_DENIED);
    }
    return true;
  }
}
```

**使用方式**（守卫有顺序，先认证后授权）：

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)   // 先验证身份，再验证权限
@Controller("project")
export class ProjectController { ... }
```

---

### 4.5 权限缓存服务（核心性能优化）

权限是「**读多写极少**」（每个请求都查，但管理员很少改），必须上缓存。项目已有 Redis。

```ts
// src/modules/rbac/permission.service.ts
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRedis() private redis: Redis,   // 项目已封装的 redis
  ) {}

  /** 获取用户全部权限码（带缓存） */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = REDIS_KEYS.USER_PERMISSIONS(userId);
    const cached = await this.redis.smembers(cacheKey);
    if (cached.length) return cached;

    // 查库：用户 → 角色（enabled 的）→ 权限码，去重
    const role = await this.roleRepo
      .createQueryBuilder("role")
      .leftJoin("role.users", "user", "user.id = :userId", { userId })
      .leftJoinAndSelect("role.permissions", "perm")
      .getMany();

    const codes = new Set<string>();
    role.forEach((r) => r.permissions.forEach((p) => codes.add(p.code)));
    const list = [...codes];

    if (list.length) await this.redis.sadd(cacheKey, ...list);
    await this.redis.expire(cacheKey, 1800);   // 30 分钟
    return list;
  }

  /** 权限变更后，清掉该用户的缓存（必须调用，否则权限收回不生效） */
  async invalidateUser(userId: string) {
    await this.redis.del(REDIS_KEYS.USER_PERMISSIONS(userId));
    await this.redis.del(REDIS_KEYS.USER_MENUS(userId));
  }

  async isSuperAdmin(userId: string): Promise<boolean> { /* 查是否含 super_admin 角色 */ }
}
```

**新增 Redis key**（[redis-keys.ts](../src/foundation/constants/redis-keys.ts)）：

```ts
/** 用户接口权限集合: user:perms:<userId> */
USER_PERMISSIONS: (userId: string) => `user:perms:${userId}`,
/** 用户菜单树 JSON: user:menus:<userId> */
USER_MENUS: (userId: string) => `user:menus:${userId}`,
```

---

### 4.6 菜单服务：把扁平数据组装成树

数据库里菜单是**扁平**的（靠 `parent_id` 关联），返回给前端要组装成**树**。

```ts
// src/modules/rbac/menu.service.ts
async getUserMenuTree(userId: string): Promise<MenuTreeNode[]> {
  // 1. 查用户所有角色能访问的菜单（去重），过滤掉 disabled
  const menus = await this.menuRepo.createQueryBuilder("menu")
    .leftJoin("menu.roles", "role")
    .leftJoin("role.users", "user", "user.id = :userId", { userId })
    .where("menu.status = :status", { status: "enabled" })
    .orderBy("menu.sort", "ASC")
    .getMany();

  // 2. 扁平转树
  return this.buildTree(menus);
}

private buildTree(menus: Menu[], parentId: string | null = null): MenuTreeNode[] {
  return menus
    .filter((m) => (m.parentId ?? null) === parentId)
    .map((m) => ({
      id: m.id,
      parentId: m.parentId,
      name: m.name,
      type: m.type,
      path: m.path,
      component: m.component,
      redirect: m.redirect,
      icon: m.icon,
      permission: m.permission,
      sort: m.sort,
      visible: m.visible,
      children: this.buildTree(menus, m.id),   // 递归
    }));
}
```

---

### 4.7 接口设计

#### 4.7.1 用户信息接口（前端登录后第一个调的接口）⭐

这是前端拿菜单和权限的入口。建议挂在 `/api/user/info` 或 `/api/auth/me`。

```ts
@UseGuards(JwtAuthGuard)
@Controller("user")
export class UserController {
  @Get("info")
  async getMyInfo(@CurrentUser("sub") userId: string) {
    return this.rbacService.getUserAuthInfo(userId);
  }
}
```

**返回结构**（见第 5 章详解）：

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid-...",
      "email": "zhangsan@xx.com",
      "nickname": "张三",
      "avatarUrl": "https://..."
    },
    "roles": ["project_manager"],
    "permissions": ["project:create", "project:read", "project:update", "scene:publish"],
    "menus": [
      {
        "id": "m-project",
        "parentId": null,
        "name": "项目管理",
        "type": "directory",
        "path": "/project",
        "icon": "Folder",
        "children": [
          {
            "id": "m-project-list",
            "parentId": "m-project",
            "name": "项目列表",
            "type": "menu",
            "path": "/project/list",
            "component": "project/list/index",
            "children": [
              {
                "id": "b-project-create",
                "parentId": "m-project-list",
                "name": "创建项目",
                "type": "button",
                "permission": "project:create"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### 4.7.2 管理（CRUD）接口

| 接口 | 方法 | 路径 | 说明 | 所需权限 |
|---|---|---|---|---|
| 角色列表 | GET | `/rbac/roles` | 分页查角色 | `role:read` |
| 新建角色 | POST | `/rbac/roles` | | `role:create` |
| 更新角色 | PATCH | `/rbac/roles/:id` | | `role:update` |
| 删除角色 | DELETE | `/rbac/roles/:id` | 内置角色禁止删 | `role:delete` |
| 给角色分配权限 | PUT | `/rbac/roles/:id/permissions` | body: `{permissionIds:[]}` | `role:assign` |
| 给角色分配菜单 | PUT | `/rbac/roles/:id/menus` | body: `{menuIds:[]}` | `role:assign` |
| 给用户分配角色 | PUT | `/rbac/users/:id/roles` | body: `{roleIds:[]}` | `user:assign-role` |
| 菜单树 | GET | `/rbac/menus` | 返回完整菜单树（管理端用） | `menu:read` |
| 新建菜单 | POST | `/rbac/menus` | | `menu:create` |
| 权限列表 | GET | `/rbac/permissions` | | `permission:read` |

> ⚠️ 所有「分配」类接口执行后，必须调用 `permissionService.invalidateUser(受影响用户id)` 清缓存。

---

### 4.8 JWT payload 调整

**去掉 role**（[jwt-access.strategy.ts:108](../src/modules/auth/auth.service.ts#L108)），token 只负责「你是谁」，不负责「你能干嘛」。

```ts
// 改造前
{ sub: userId, email, role, type: "access" }

// 改造后
{ sub: userId, email, type: "access" }   // 只留身份信息
```

原因：JWT 签发后不可变，若把权限塞进 token，管理员撤销权限后旧 token 仍带旧权限，**收回不生效**。权限实时查 Redis/DB。

---

### 4.9 错误码补充（[error-codes.ts](../src/foundation/errors/error-codes.ts)）

新增 `205xx` 段：

```ts
// RBAC errors 205xx
ROLE_NOT_FOUND = 20501,
ROLE_CODE_TAKEN = 20502,        // 角色编码已存在
ROLE_IS_SYSTEM = 20503,         // 内置角色，不可删除/修改编码
PERMISSION_NOT_FOUND = 20504,
MENU_NOT_FOUND = 20505,
MENU_PARENT_INVALID = 20506,    // 父菜单不存在或形成环
RBAC_PERMISSION_DENIED = 20507, // 权限不足
```

---

### 4.10 种子数据（首次启动初始化）

写一个 seed 脚本，初始化：
1. 超级管理员角色（`is_system = true`）
2. 所有权限点（遍历代码里所有 `@RequirePermissions` 自动生成，或手写清单）
3. 完整菜单树
4. 给超级管理员分配**全部**权限和菜单
5. 建一个初始超管账号（如 `admin@xx.com / ChangeMe123!`）

---

## 5. 菜单权限专题 ⭐（你这次的重点）

### 5.1 后端返回给前端什么？

登录成功后，前端用 token 调一次 `GET /user/info`，**一次性拿全三样东西**：

| 字段 | 类型 | 前端用途 |
|---|---|---|
| `user` | 对象 | 展示用户名、头像 |
| `roles` | string[] | 特殊角色判断（如某些页面只有 admin 能看） |
| `permissions` | string[] | **按钮显隐**的核心依据 |
| `menus` | 树形数组 | **动态路由 + 侧边栏**的核心依据 |

### 5.2 为什么菜单要返回树、权限要返回扁平数组？

- **菜单是树**：侧边栏要分层级显示（目录 → 菜单），天然是树形，后端组装好前端直接渲染。
- **权限是扁平数组**：按钮判断只需要「有没有这个 code」，`Array.includes` 即可，不需要层级。

### 5.3 前端三步走

```
拿到 menus 和 permissions
        │
        ├──▶ ① menus  →  动态生成路由  →  能访问哪些页面
        │              →  渲染侧边栏    →  看到哪些菜单
        │
        └──▶ ② permissions  →  按钮指令/组件  →  按钮/操作显隐
                              →  路由守卫兜底   →  防止手动输 URL
```

### 5.4 按钮权限：从存储到前端完整闭环 ⭐⭐

按钮权限是整个系统里**最常被用到、也最容易没想清楚**的一环。本节把一个按钮的「一生」完整走一遍。

> 下面的内容是 6.5 节的**详解版**。6.5 是速查，本节讲透原理。

#### 5.4.1 一个按钮的「一生」（完整链路）

以「项目列表页的删除按钮」为例，它从被定义到最终显示，经过 5 步：

```
① 后端管理员在「菜单管理」里建一条按钮记录
   menus 表: { name:"删除项目", type:"button", permission:"project:delete", parentId: 项目列表菜单id }

② 管理员给「项目经理」角色勾选这个按钮菜单 + 勾选 project:delete 接口权限
   role_menus: (项目经理, 删除按钮)
   role_permissions: (项目经理, project:delete)

③ 张三(项目经理)登录 → 调 GET /user/info
   后端返回:
     permissions: [..., "project:delete", ...]   ← 按钮靠这个判断
     menus: [ ...{ type:"button", permission:"project:delete" }... ]  ← (可选,见5.4.2)

④ 前端把 permissions 存进 store

⑤ 项目列表页的删除按钮上挂 v-permission="'project:delete'"
   渲染时查 store.permissions → 包含 → 显示按钮 ✅
   没权限的用户 → 不在 permissions 里 → 按钮被移除 ❌
```

#### 5.4.2 先做选择：按钮放哪儿？（两种实现路线）

这是最关键的设计决策，**两种都能跑通，但适用场景不同**：

| | 路线 A：按钮进菜单树 | 路线 B：按钮只靠权限码 |
|---|---|---|
| **按钮定义在哪** | `menus` 表里建 `type=button` 的节点 | 不建菜单记录，前端代码里写死按钮 |
| **后端能做什么** | 管理员在后台**可视化勾选/配置**按钮 | 只能配接口权限，按钮位置前端定死 |
| **前端代码** | `<button v-permission="'project:delete'">` | 一样，没区别 |
| **改按钮文案/位置** | 后台改菜单记录即可，不用发版 | 改前端代码 + 重新发版 |
| **适用场景** | 中后台、需要动态管理按钮 | 按钮固定不变的小系统 |
| **代表框架** | 若依(ruoyi)、vue-element-admin | 简化方案 |

> 💡 **本项目推荐路线 A**（与第 3.3 节 menus 表的 `button` 类型一致）。代价是 menus 表多几条 button 记录，收益是按钮可后台管理、和接口权限天然联动。

下面默认按**路线 A**讲解（路线 B 只是不建 button 菜单记录，前端代码完全一样）。

#### 5.4.3 后端约定：按钮的 `permission` 字段怎么填

`menus` 表里按钮型节点有一个 `permission` 字段（[3.3 节](#33-表menus菜单树形结构-重点)），**它的值必须等于 `permissions` 表里某个 `code`**。这是把「菜单权限」和「接口权限」绑定的关键约定：

```
menus 表:  { name:"删除项目", type:"button", permission:"project:delete" }  ─┐
                                                                            │ 值相同
permissions 表: { code:"project:delete", name:"删除项目" }  ─────────────────┘
```

这样约定后，给角色分配时**两处都要勾**（分配菜单勾上按钮 + 分配权限勾上接口），二者联动：
- 勾了菜单按钮没勾接口权限 → 按钮能看到，但点了 403（前端露出，后端拦住，安全）
- 勾了接口权限没勾菜单按钮 → 按钮看不到，但后端能调（一般不会这样配）

> ⚠️ **一致性提醒**：分配接口的 admin 接口执行后，最好用一段校验逻辑保证「角色拥有的 button 菜单，其 permission 都在该角色的接口权限集合内」，避免配置不一致。

#### 5.4.4 前端实现一：`v-permission` 指令（推荐，最简洁）

**完整代码（支持单权限、多权限、any/all 三种模式）：**

```ts
// src/directives/permission.ts
import type { Directive, DirectiveBinding } from "vue";
import { useUserStore } from "@/stores/user";

type Value = string | string[] | { value: string | string[]; mode?: "any" | "all" };

/** 核心判断函数：有没有权限 */
export function checkPermission(
  value: string | string[],
  mode: "any" | "all" = "any",
): boolean {
  const { permissions } = useUserStore();
  const required = Array.isArray(value) ? value : [value];
  if (required.length === 0) return true;          // 没要求 = 放行
  return mode === "all"
    ? required.every((c) => permissions.includes(c))
    : required.some((c) => permissions.includes(c));
}

// 规范化指令入参
function normalize(raw: Value) {
  if (typeof raw === "string") return { value: [raw], mode: "any" as const };
  if (Array.isArray(raw)) return { value: raw, mode: "any" as const };
  return { value: Array.isArray(raw.value) ? raw.value : [raw.value], mode: raw.mode ?? "any" };
}

export const vPermission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<Value>) {
    const { value, mode } = normalize(binding.value);
    if (!checkPermission(value, mode)) {
      el.parentNode?.removeChild(el);   // 没权限 → 从 DOM 移除
    }
  },
};
```

**全局注册**（`main.ts`）：

```ts
import { vPermission } from "@/directives/permission";
app.directive("permission", vPermission);
```

**使用**（三种写法）：

```vue
<!-- 1. 单个权限：有 project:delete 才显示 -->
<el-button v-permission="'project:delete'" type="danger">删除</el-button>

<!-- 2. 多个权限(默认 any)：有 删除 或 编辑 任意一个就显示 -->
<el-button v-permission="['project:delete', 'project:update']">操作</el-button>

<!-- 3. 多个权限(all)：必须同时有 导入 和 导出 才显示 -->
<el-button v-permission="{ value: ['data:import', 'data:export'], mode: 'all' }">
  数据同步
</el-button>
```

#### 5.4.5 前端实现二：`<HasPermission>` 组件（支持「置灰禁用」）

指令是「直接移除」按钮，但有时你想要「没权限的按钮**变灰不可点**」而不是消失（提示用户「有这个功能但你没权限」）。这时用组件：

```vue
<!-- src/components/HasPermission.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useUserStore } from "@/stores/user";

const props = defineProps<{
  code: string | string[];
  mode?: "any" | "all";
  /** true=不满足时置灰禁用而非隐藏 */
  disabled?: boolean;
}>();

const userStore = useUserStore();
const ok = computed(() => {
  const required = Array.isArray(props.code) ? props.code : [props.code];
  const m = props.mode ?? "any";
  return m === "all"
    ? required.every((c) => userStore.permissions.includes(c))
    : required.some((c) => userStore.permissions.includes(c));
});
</script>

<template>
  <!-- 有权限：正常渲染 -->
  <slot v-if="ok" />
  <!-- 没权限但想置灰：渲染带 disabled 样式的兜底内容 -->
  <slot v-else-if="disabled" name="disabled" />
  <!-- 没权限且不置灰：什么都不渲染 -->
</template>
```

**使用**：

```vue
<!-- 隐藏模式（默认，等同指令） -->
<HasPermission code="project:delete">
  <el-button type="danger">删除</el-button>
</HasPermission>

<!-- 置灰模式：没权限也能看到按钮，但灰掉 -->
<HasPermission code="project:delete" disabled>
  <el-button type="danger">删除</el-button>
  <template #disabled>
    <el-button type="danger" disabled>删除</el-button>
  </template>
</HasPermission>
```

#### 5.4.6 前端实现三：`usePermission()` 函数（JS 逻辑里判断）

指令和组件只能控制模板渲染。当代码逻辑里需要判断（如「没权限就跳转」「禁用某个流程」），用 composable：

```ts
// src/composables/usePermission.ts
import { useUserStore } from "@/stores/user";

export function usePermission() {
  const { permissions } = useUserStore();

  const has = (code: string | string[], mode: "any" | "all" = "any") => {
    const required = Array.isArray(code) ? code : [code];
    return mode === "all"
      ? required.every((c) => permissions.includes(c))
      : required.some((c) => permissions.includes(c));
  };

  // 判断角色：某些场景按角色而非权限码
  const hasRole = (role: string | string[]) => {
    const { roles } = useUserStore();
    const required = Array.isArray(role) ? role : [role];
    return required.some((r) => roles.includes(r));
  };

  return { has, hasRole };
}
```

**使用**：

```ts
const { has } = usePermission();

function handleClick() {
  if (!has("project:delete")) {
    ElMessage.warning("您没有删除权限");
    return;
  }
  // 执行删除...
}
```

#### 5.4.7 高频场景：表格行内操作按钮

列表页每一行都有「编辑/删除」，这是最常见的按钮权限场景。直接在 `v-for` / 插槽里用 `v-permission` 即可——指令在**每个按钮挂载时独立判断**，互不影响：

```vue
<el-table :data="list">
  <el-table-column label="操作" width="200">
    <template #default="{ row }">
      <el-button v-permission="'project:update'" @click="edit(row)">编辑</el-button>
      <el-button v-permission="'project:delete'" type="danger" @click="del(row)">删除</el-button>
      <!-- 没权限的用户：整列操作按钮都不显示，这一列可能变空 -->
    </template>
  </el-table-column>
</el-table>
```

> 💡 没权限用户会让「操作」列变空。如果想优雅处理，可在列上加 `v-if`：当用户对该页所有按钮都没权限时，整列不渲染。

#### 5.4.8 易错点提醒

| 坑 | 说明 | 解法 |
|---|---|---|
| **权限码拼写不一致** | 后端 `project:delete`，前端写成 `project:del` → 按钮永远不显示 | 把权限码抽成常量文件，前后端共享（或前端从 `/user/info` 返回的 menus 自动绑定） |
| **首屏闪烁** | 页面先渲染出按钮，权限数据还没拉到，又突然消失 | 路由守卫里**等 `/user/info` 拉完再进页面**（6.3 节已保证），主应用用 `v-if="permissions.length"` 包裹 |
| **指令不响应权限变化** | `v-permission` 只在 `mounted` 判断一次，运行中权限变了不会自动更新 | 一般无需处理（权限变更要重新拉 `/user/info` → 整页刷新）。若需响应式，改用组件方案（依赖响应式 store） |
| **路由跳转按钮被遗留** | SPA 切换页面时指令的 DOM 复用 | `removeChild` 后该元素已不在树中，Vue diff 会正确处理，一般无问题 |
| **disabled 模式的可访问性** | 置灰按钮用 `pointer-events:none` 时键盘仍可触发 | 同时设 `disabled` 属性 + `aria-disabled` |

---

## 6. 前端要做的事（以 Vue3 + TS + Vue Router + Pinia 为主）

> React 同学看 6.6 节，思路完全一致，只是 API 换成 react-router + zustand。

### 6.1 登录后存数据

```ts
// stores/user.ts (Pinia)
export const useUserStore = defineStore("user", () => {
  const token = ref(localStorage.getItem("token") || "");
  const roles = ref<string[]>([]);
  const permissions = ref<string[]>([]);
  const menus = ref<MenuTreeNode[]>([]);

  async function login(account, password) {
    const { data } = await api.post("/auth/login", { account, password });
    token.value = data.accessToken;
    localStorage.setItem("token", data.accessToken);
    await fetchUserInfo();          // 登录后立刻拉用户信息
  }

  async function fetchUserInfo() {
    const { data } = await api.get("/user/info");
    roles.value = data.roles;
    permissions.value = data.permissions;
    menus.value = data.menus;
    generateRoutes(data.menus);     // ★ 动态生成路由（见 6.2）
  }

  return { token, roles, permissions, menus, login, fetchUserInfo };
});
```

### 6.2 动态路由生成（核心）

后端返回的 `component` 是字符串（如 `"project/list/index"`），前端要把它映射到真实的 Vue 组件。

```ts
// router/dynamic.ts
import type { RouteRecordRaw } from "vue-router";

// 用 Vite 的 import.meta.glob 把所有页面组件收集起来
const modules = import.meta.glob("@/views/**/*.vue");

export function generateRoutes(menus: MenuTreeNode[]) {
  const routes: RouteRecordRaw[] = [];
  for (const menu of menus) {
    const route = menuToRoute(menu);
    if (route) routes.push(route);
  }
  // 挂到根路由下（布局页的 children）
  routes.forEach((r) => router.addRoute("layout", r));   // ★ 动态注入
}

function menuToRoute(menu: MenuTreeNode): RouteRecordRaw | null {
  // 按钮不生成路由
  if (menu.type === "button") return null;

  // component 字符串 → 真实组件
  // 后端存 "project/list/index" → 前端找 /src/views/project/list/index.vue
  const componentPath = `/src/views/${menu.component}.vue`;
  const component = modules[componentPath];

  const route: RouteRecordRaw = {
    path: menu.path,
    name: menu.code,
    component: menu.type === "directory" ? Layout : component,
    redirect: menu.redirect,
    meta: { title: menu.name, icon: menu.icon },
    children: [],
  };

  // 递归子菜单
  const childRoutes = (menu.children ?? [])
    .map(menuToRoute)
    .filter(Boolean) as RouteRecordRaw[];
  if (childRoutes.length) route.children = childRoutes;

  return route;
}
```

> ⚠️ 前端**必须**有一个约定：`views` 目录结构要和后端 `component` 字段对应。比如菜单存 `project/list/index`，那么文件就在 `src/views/project/list/index.vue`。

### 6.3 路由守卫（防止直接输 URL 进没权限的页面）

```ts
// router/index.ts
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();

  // 没登录 → 去登录页
  if (!userStore.token) return next("/login");

  // 已登录但还没拉用户信息（刷新页面后 store 丢了）
  if (userStore.menus.length === 0) {
    await userStore.fetchUserInfo();   // 重新拉，重新生成路由
    return next({ ...to, replace: true });  // 重新进入，确保动态路由已注册
  }

  next();
});
```

### 6.4 侧边栏渲染（递归组件）

```vue
<!-- components/SidebarItem.vue -->
<template>
  <template v-if="item.children?.length">
    <el-sub-menu :index="item.path">
      <template #title><el-icon><component :is="item.icon" /></el-icon>{{ item.name }}</template>
      <SidebarItem v-for="child in item.children" :key="child.id" :item="child" />
    </el-sub-menu>
  </template>
  <el-menu-item v-else :index="item.path">{{ item.name }}</el-menu-item>
</template>
```

> 渲染时**只渲染 `type !== 'button'` 且 `visible === true` 的节点**（按钮不该出现在侧边栏）。

### 6.5 按钮级权限（三种方式任选）

> 🔎 本节是速查。完整原理、两种实现路线对比、完整可用代码、表格行内按钮场景，见 **[5.4 按钮权限：从存储到前端完整闭环](#54-按钮权限从存储到前端完整闭环-)**。

**方式 A：自定义指令**（最简洁，推荐）

```ts
// directives/permission.ts
export const vPermission = {
  mounted(el: HTMLElement, binding) {
    const userStore = useUserStore();
    const code = binding.value;                          // 'project:delete'
    if (!userStore.permissions.includes(code)) {
      el.parentNode?.removeChild(el);                    // 没权限直接从 DOM 移除
    }
  },
};

// 使用
<button v-permission="'project:delete'">删除</button>
```

**方式 B：组件包裹**

```vue
<HasPermission code="project:delete">
  <button>删除</button>
</HasPermission>
```

**方式 C：工具函数**（适合在 JS 逻辑里判断）

```ts
const { permissions } = useUserStore();
if (permissions.includes("project:delete")) {
  // 执行删除...
}
```

> 💡 三种方式都基于同一个数据源：`userStore.permissions` 数组。

### 6.6 React 版要点

| Vue3 | React 对应 |
|---|---|
| Pinia store | Zustand / Redux Toolkit / Context |
| `router.addRoute` | 用 `useRoutes(dynamicRoutes)` 动态渲染，或 react-router 6 的 `useRouter` |
| `import.meta.glob` | `require.context` (webpack) 或 Vite 的 glob |
| `v-permission` 指令 | 高阶组件 `<HasPermission>` 或自定义 hook `usePermission()` |
| 递归侧边栏组件 | 同样写递归组件 |

### 6.7 退出登录

清空 store + localStorage + 重置路由，跳转登录页：

```ts
function logout() {
  token.value = "";
  permissions.value = [];
  menus.value = [];
  localStorage.removeItem("token");
  router.removeRoute; // 重置动态路由
  location.reload();  // 最简单可靠：刷新清空一切
}
```

---

## 7. 完整链路：从登录到点按钮

以「张三（项目经理）登录后删除一个项目」为例：

```
1. 张三在登录页输入账号密码 → POST /auth/login
   后端：验证密码 → 签发 token（只含 userId）→ 返回 token

2. 前端拿到 token → GET /user/info
   后端：
     - 查张三的角色 → [project_manager]
     - 查角色的权限 → [project:create, read, update, delete, scene:publish]
     - 查角色的菜单 → 组装成树
     - 缓存到 Redis（user:perms:张三id, user:menus:张三id）
     - 返回 { user, roles, permissions, menus }

3. 前端：
     - 存 permissions 到 store
     - menus 动态生成路由、渲染侧边栏
     - 张三看到「项目管理」菜单和「删除项目」按钮（因为有 project:delete）

4. 张三点「删除」→ DELETE /project/123，Header 带 token
   后端：
     - JwtAuthGuard 验证 token → 注入 userId
     - PermissionsGuard：
         · 查 Redis 缓存 → 命中 [project:..., scene:publish]
         · 接口要求 project:delete → 包含 → 放行 ✅
     - 执行删除

--- 假设此时管理员撤销了张三的删除权限 ---
5. 管理员在后台操作 → PUT /rbac/roles/:id/permissions（移除 project:delete）
   后端：更新 role_permissions 表 → 调用 invalidateUser(张三id) 清 Redis 缓存

6. 张三再次点「删除」
   - 后端 PermissionsGuard：Redis 缓存已清 → 查库 → 没有 project:delete → 403 ❌
   - 前端收到 403，提示「权限不足」

7. 张三下次刷新页面 → 重新调 /user/info
   - 返回的 permissions 不含 project:delete
   - 侧边栏还在，但「删除」按钮消失（v-permission 判断失败）
```

> 这就是「权限变更即时生效」的完整机制：**后端靠清缓存保证接口安全，前端靠重新拉取刷新 UI。**

---

## 8. 实施步骤（建议分 4 个阶段，每阶段可独立验证）

### 阶段一：数据库 + 基础设施（后端，1~2 天）
- [ ] 建 4 张表 entity（role / permission / menu）+ 改 user
- [ ] `pnpm migration:generate src/database/migrations/CreateRbac` 生成迁移
- [ ] `pnpm migration:run` 执行
- [ ] 写 seed 脚本初始化超管角色、权限点、菜单树
- [ ] 补错误码、Redis key

**验证**：数据库里能看到表和数据。

### 阶段二：守卫 + 装饰器 + 权限服务（后端，2 天）
- [ ] `@RequirePermissions` / `@RequireRoles` 装饰器
- [ ] `PermissionService`（带 Redis 缓存 + invalidate）
- [ ] `PermissionsGuard`
- [ ] 改 JWT payload（去掉 role）
- [ ] 在 1~2 个现有 Controller（如 project）上挂 `@RequirePermissions` 试跑

**验证**：用不同角色账号调接口，无权限返回 403。

### 阶段三：管理接口（后端，2~3 天）
- [ ] 角色 / 权限 / 菜单 CRUD
- [ ] 分配权限 / 分配菜单 / 分配角色接口
- [ ] `/user/info` 接口（返回 user+roles+permissions+menus）

**验证**：Postman 调 `/user/info`，返回完整 JSON。

### 阶段四：前端联调（前端，3~5 天）
- [ ] 登录后拉 `/user/info`，存 store
- [ ] 动态路由生成 + 路由守卫
- [ ] 侧边栏递归渲染
- [ ] `v-permission` 指令 + 按钮控制
- [ ] 退出登录清理

**验证**：不同角色登录，看到的菜单和按钮不同；手动输没权限的 URL 被拦截。

---

## 9. 常见问题 & 进阶

**Q1：权限改了，为什么旧用户还能用？**
A：99% 是没清 Redis 缓存。所有「分配权限/菜单/角色」的操作都要调用 `invalidateUser(受影响用户id)`。批量改角色权限时，要遍历该角色下所有用户清缓存。

**Q2：超级管理员怎么处理？**
A：`roles` 表里建一个 `is_system=true` 的 `super_admin` 角色，`PermissionsGuard` 开头判断「是否超管 → 直接放行」，不查库不查缓存，保证性能和「拥有全部权限」语义。

**Q3：要不要角色继承（子角色继承父角色权限）？**
A：中小型系统不需要，会让权限计算复杂。如果组织层级深（集团→分公司→部门），可在 `roles` 表加 `parent_id`，权限计算时递归合并父角色权限。

**Q4：数据权限怎么办？（比如「只能看自己创建的项目」）**
A：这是**另一个维度**，不要塞进 RBAC。RBAC 管「能不能调这个接口」，数据权限管「调了之后返回哪些行」。后者在 Service 层用查询条件实现：`where: { ownerId: userId }`。

**Q5：前端能不能完全不写权限判断，全靠后端？**
A：能用，但体验差——用户看到一堆点了就报错的按钮。最佳实践是前后端都做：前端藏按钮（体验），后端拦接口（安全）。

**Q6：token 过期了怎么办？**
A：本项目已有 refresh token 机制（[auth.service.ts](../src/modules/auth/auth.service.ts)），access token 过期用 refresh 换新的，用户无感。权限信息不存 token，所以 token 续期不影响权限实时性。

**Q7：菜单和接口权限会不会重复维护？**
A：会有点关联但不重复。接口权限（`permissions` 表）是后端防线的源头；菜单（`menus` 表）里的按钮型节点通过 `permission` 字段**引用**接口权限码。维护时：加新接口 → `permissions` 表加一条 → Controller 挂 `@RequirePermissions` → 菜单树加对应按钮节点（可选）。

---

## 附录：字段速查表

| 表 | 核心字段 | 用途 |
|---|---|---|
| roles | code, name, is_system | 角色定义 |
| permissions | code(module:action), module, action | 接口权限点 |
| menus | parent_id, type, path, component, permission | 菜单/目录/按钮 |
| user_roles | user_id, role_id | 用户↔角色 |
| role_permissions | role_id, permission_id | 角色↔接口权限 |
| role_menus | role_id, menu_id | 角色↔菜单 |

**权限码命名**：`模块:动作`，如 `project:create`、`user:delete`、`scene:publish`。

**菜单类型**：`directory`（目录）/ `menu`（页面）/ `button`（按钮）。

**一句话总结**：
> 用户绑定角色，角色绑定「接口权限」和「菜单」；后端用 `PermissionsGuard` 拦接口，前端用菜单树渲染路由/侧边栏、用权限码控制按钮。
