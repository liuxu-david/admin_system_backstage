/**
 * RBAC 种子数据：首次启动初始化。
 * 幂等：已存在的记录（按 code/email）会跳过。
 *
 * 运行：pnpm seed
 *
 * 产物：
 *  1. 角色 super_admin(内置) / member / guest
 *  2. 权限点（与 Controller 上的 @RequirePermissions 对应）
 *  3. 完整菜单树（页面/按钮节点挂权限码——角色勾了节点即拥有其权限）
 *  4. super_admin 拥有全部菜单（权限随菜单派生）
 *  5. 初始账号 admin@admin.com / Admin@123456（挂 super_admin）
 */
import dataSource from "../data-source";
import { hashPassword } from "../../foundation/utils/hash";
import { Role } from "../../modules/rbac/entities/role.entity";
import { Permission } from "../../modules/rbac/entities/permission.entity";
import { Menu, MenuType, MenuStatus } from "../../modules/rbac/entities/menu.entity";
import { User } from "../../modules/user/entities/user.entity";
import { UserStatus } from "../../foundation/enums";

const ADMIN_EMAIL = "admin";
const ADMIN_PASSWORD = "qwer123456";

const ROLES = [
  { code: "super_admin", name: "超级管理员", description: "拥有全部权限", isSystem: true, sort: 0 },
  { code: "member", name: "普通成员", description: "项目只读", isSystem: false, sort: 10 },
  { code: "guest", name: "游客", description: "仅仪表盘", isSystem: false, sort: 20 },
];

const PERMISSIONS = [
  // project
  { code: "project:create", name: "创建项目", module: "project", action: "create" },
  { code: "project:read", name: "查看项目", module: "project", action: "read" },
  { code: "project:update", name: "编辑项目", module: "project", action: "update" },
  { code: "project:delete", name: "删除项目", module: "project", action: "delete" },
  // user
  { code: "user:create", name: "创建用户", module: "user", action: "create" },
  { code: "user:read", name: "查看用户", module: "user", action: "read" },
  { code: "user:update", name: "编辑用户", module: "user", action: "update" },
  { code: "user:delete", name: "删除用户", module: "user", action: "delete" },
  { code: "user:assign-role", name: "分配角色", module: "user", action: "assign-role" },
  // role
  { code: "role:create", name: "创建角色", module: "role", action: "create" },
  { code: "role:read", name: "查看角色", module: "role", action: "read" },
  { code: "role:update", name: "编辑角色", module: "role", action: "update" },
  { code: "role:delete", name: "删除角色", module: "role", action: "delete" },
  { code: "role:assign", name: "分配权限/菜单", module: "role", action: "assign" },
  // menu
  { code: "menu:create", name: "创建菜单", module: "menu", action: "create" },
  { code: "menu:read", name: "查看菜单", module: "menu", action: "read" },
  { code: "menu:update", name: "编辑菜单", module: "menu", action: "update" },
  { code: "menu:delete", name: "删除菜单", module: "menu", action: "delete" },
];

type MenuSeed = {
  name: string;
  code: string;
  type: MenuType;
  path?: string;
  component?: string;
  redirect?: string;
  icon?: string;
  permission?: string;
  sort?: number;
  children?: MenuSeed[];
};

const MENU_TREE: MenuSeed[] = [
  // 首页不在菜单表里：它是前端静态路由，所有登录用户都有（若依/大厂通行做法）
  {
    name: "系统管理",
    code: "system",
    type: MenuType.DIRECTORY,
    path: "/system",
    icon: "Setting",
    redirect: "/system/user",
    sort: 2,
    children: [
      {
        name: "用户管理",
        code: "system:user",
        type: MenuType.MENU,
        path: "/system/user",
        component: "system/user/index",
        icon: "User",
        permission: "user:read",
        sort: 1,
        children: [
          {
            name: "新增",
            code: "system:user:create",
            type: MenuType.BUTTON,
            permission: "user:create",
            sort: 1,
          },
          {
            name: "编辑",
            code: "system:user:update",
            type: MenuType.BUTTON,
            permission: "user:update",
            sort: 2,
          },
          {
            name: "删除",
            code: "system:user:delete",
            type: MenuType.BUTTON,
            permission: "user:delete",
            sort: 3,
          },
          {
            name: "分配角色",
            code: "system:user:assign",
            type: MenuType.BUTTON,
            permission: "user:assign-role",
            sort: 4,
          },
        ],
      },
      {
        name: "角色管理",
        code: "system:role",
        type: MenuType.MENU,
        path: "/system/role",
        component: "system/role/index",
        icon: "UserFilled",
        permission: "role:read",
        sort: 2,
        children: [
          {
            name: "新增",
            code: "system:role:create",
            type: MenuType.BUTTON,
            permission: "role:create",
            sort: 1,
          },
          {
            name: "编辑",
            code: "system:role:update",
            type: MenuType.BUTTON,
            permission: "role:update",
            sort: 2,
          },
          {
            name: "删除",
            code: "system:role:delete",
            type: MenuType.BUTTON,
            permission: "role:delete",
            sort: 3,
          },
          {
            name: "分配权限",
            code: "system:role:assign",
            type: MenuType.BUTTON,
            permission: "role:assign",
            sort: 4,
          },
        ],
      },
      {
        name: "菜单管理",
        code: "system:menu",
        type: MenuType.MENU,
        path: "/system/menu",
        component: "system/menu/index",
        icon: "Menu",
        permission: "menu:read",
        sort: 3,
        children: [
          {
            name: "新增",
            code: "system:menu:create",
            type: MenuType.BUTTON,
            permission: "menu:create",
            sort: 1,
          },
          {
            name: "编辑",
            code: "system:menu:update",
            type: MenuType.BUTTON,
            permission: "menu:update",
            sort: 2,
          },
          {
            name: "删除",
            code: "system:menu:delete",
            type: MenuType.BUTTON,
            permission: "menu:delete",
            sort: 3,
          },
        ],
      },
    ],
  },
  {
    name: "项目管理",
    code: "project",
    type: MenuType.DIRECTORY,
    path: "/project",
    icon: "Folder",
    redirect: "/project/list",
    sort: 3,
    children: [
      {
        name: "项目列表",
        code: "project:list",
        type: MenuType.MENU,
        path: "/project/list",
        component: "project/list/index",
        icon: "Document",
        permission: "project:read",
        sort: 1,
        children: [
          {
            name: "创建",
            code: "project:list:create",
            type: MenuType.BUTTON,
            permission: "project:create",
            sort: 1,
          },
          {
            name: "编辑",
            code: "project:list:update",
            type: MenuType.BUTTON,
            permission: "project:update",
            sort: 2,
          },
          {
            name: "删除",
            code: "project:list:delete",
            type: MenuType.BUTTON,
            permission: "project:delete",
            sort: 3,
          },
        ],
      },
    ],
  },
];

async function main() {
  await dataSource.initialize();
  // 仅本地开发（pnpm seed 时 SEED_SYNCHRONIZE=true）允许自动建表；
  // 服务器上灌数据必须走 migration，绝不能 synchronize 改共享库的表结构。
  if (process.env.SEED_SYNCHRONIZE === "true") {
    await dataSource.synchronize();
  }
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);
  const menuRepo = dataSource.getRepository(Menu);
  const userRepo = dataSource.getRepository(User);

  console.log("→ 角色");
  const roleByCode = new Map<string, Role>();
  for (const r of ROLES) {
    let role = await roleRepo.findOne({ where: { code: r.code } });
    if (!role) {
      role = roleRepo.create({
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        sort: r.sort,
      });
      await roleRepo.save(role);
    }
    roleByCode.set(r.code, role);
  }

  console.log("→ 权限点");
  for (const p of PERMISSIONS) {
    const exists = await permRepo.findOne({ where: { code: p.code } });
    if (!exists) await permRepo.save(permRepo.create(p));
  }

  console.log("→ 菜单树");
  const insertMenu = async (m: MenuSeed, parentId: string | null): Promise<Menu> => {
    let entity = await menuRepo.findOne({ where: { code: m.code } });
    if (!entity) {
      entity = menuRepo.create({
        parentId,
        name: m.name,
        code: m.code,
        type: m.type,
        path: m.path ?? null,
        component: m.component ?? null,
        redirect: m.redirect ?? null,
        icon: m.icon ?? null,
        permission: m.permission ?? null,
        sort: m.sort ?? 0,
        visible: true,
        status: MenuStatus.ENABLED,
      });
      await menuRepo.save(entity);
    }
    for (const child of m.children ?? []) await insertMenu(child, entity.id);
    return entity;
  };
  for (const m of MENU_TREE) await insertMenu(m, null);

  // 老库回填：页面菜单节点补挂 read 权限码（新库 insertMenu 已带）
  // 勾了页面 = 能调它的查询接口，这是权限派生的前提
  const READ_PERM_BY_MENU_CODE: Record<string, string> = {
    "system:user": "user:read",
    "system:role": "role:read",
    "system:menu": "menu:read",
    "project:list": "project:read",
  };
  for (const [menuCode, permCode] of Object.entries(READ_PERM_BY_MENU_CODE)) {
    await menuRepo
      .createQueryBuilder()
      .update(Menu)
      .set({ permission: permCode })
      .where("code = :code AND (permission IS NULL OR permission = '')", { code: menuCode })
      .execute();
  }

  const allMenus = await menuRepo.find();

  console.log("→ 给 super_admin 分配全部菜单（权限随菜单派生）");
  const superAdmin = roleByCode.get("super_admin")!;
  superAdmin.menus = allMenus;
  await roleRepo.save(superAdmin);

  console.log("→ member：项目菜单（project:list 带 project:read）");
  const member = roleByCode.get("member")!;
  member.menus = allMenus.filter((m: Menu) => m.code === "project" || m.code === "project:list");
  await roleRepo.save(member);

  console.log("→ guest：无业务菜单（仅前端静态首页）");
  const guest = roleByCode.get("guest")!;
  guest.menus = [];
  await roleRepo.save(guest);

  console.log("→ 初始管理员账号");
  let admin = await userRepo.findOne({ where: { email: ADMIN_EMAIL }, relations: { roles: true } });
  if (!admin) {
    admin = userRepo.create({
      email: ADMIN_EMAIL,
      nickname: "Super Admin",
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      status: UserStatus.ACTIVE,
      roles: [superAdmin],
    });
    await userRepo.save(admin);
    console.log(`   已创建：${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    // 已存在：确保仍挂着超管角色（关联表可能被清空重建过）
    admin.roles = [superAdmin];
    await userRepo.save(admin);
    console.log("   管理员账号已存在，已确保挂载超管角色");
  }

  console.log("✅ RBAC 种子完成");
  await dataSource.destroy();
}

main().catch((err) => {
  console.error("❌ 种子失败：", err);
  process.exit(1);
});
