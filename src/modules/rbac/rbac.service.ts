import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import { Role } from "./entities/role.entity";
import { Permission } from "./entities/permission.entity";
import { Menu, MenuStatus } from "./entities/menu.entity";
import { User } from "../user/entities/user.entity";
import { UserStatus } from "../../foundation/enums";
import { PermissionService } from "./permission.service";
import { MenuService, MenuTreeNode } from "./menu.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { CreateMenuDto } from "./dto/create-menu.dto";
import { UpdateMenuDto } from "./dto/update-menu.dto";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";

/** 登录后返回给前端的用户授权信息 */
export interface UserAuthInfo {
  user: { id: string; email: string; nickname: string; avatarUrl: string | null };
  roles: string[];
  permissions: string[];
  menus: MenuTreeNode[];
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permRepo: Repository<Permission>,
    @InjectRepository(Menu) private readonly menuRepo: Repository<Menu>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly permissionService: PermissionService,
    private readonly menuService: MenuService,
  ) {}

  // ─── 用户授权信息（前端登录后第一个调）──────────────────────────
  async getUserAuthInfo(userId: string): Promise<UserAuthInfo> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    if (!user) throw new BusinessException(ErrorCode.USER_NOT_FOUND);

    const roles = user.roles ?? [];
    const roleIds = roles.map((r) => r.id);

    const [permissions, menus] = await Promise.all([
      this.permissionService.getUserPermissions(userId),
      this.menuService.getUserMenuTree(userId, roleIds),
    ]);

    return {
      user: { id: user.id, email: user.email, nickname: user.nickname, avatarUrl: user.avatarUrl },
      roles: roles.map((r) => r.code),
      permissions,
      menus,
    };
  }

  // ─── 用户列表（带角色，管理端用）───────────────────────────────
  async findUsersWithRoles(): Promise<User[]> {
    return this.userRepo.find({
      relations: { roles: true },
      order: { createdAt: "DESC" },
    });
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    await this.userRepo.update({ id: userId }, { status });
  }

  // ─── 角色 CRUD ─────────────────────────────────────────────────
  async findRoles(): Promise<Role[]> {
    return this.roleRepo.find({ order: { sort: "ASC", createdAt: "ASC" } });
  }

  /** 角色详情：带已分配的 permissions / menus（供分配弹窗回显） */
  async findRoleDetail(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: { permissions: true, menus: true },
    });
    if (!role) throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
    return role;
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.roleRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new BusinessException(ErrorCode.ROLE_CODE_TAKEN);
    const role = this.roleRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      sort: dto.sort ?? 0,
    });
    return this.roleRepo.save(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findRoleEntity(id);
    Object.assign(role, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.sort !== undefined && { sort: dto.sort }),
    });
    return this.roleRepo.save(role);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.findRoleEntity(id);
    if (role.isSystem) throw new BusinessException(ErrorCode.ROLE_IS_SYSTEM);
    // 删除前先拿到受影响用户，清缓存
    const userIds = await this.getUserIdsOfRole(id);
    await this.roleRepo.remove(role);
    await this.permissionService.invalidateUsers(userIds);
  }

  // ─── 角色 ↔ 权限 / 菜单 分配 ───────────────────────────────────
  async assignRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const role = await this.findRoleEntity(roleId);
    const perms = permissionIds.length
      ? await this.permRepo.find({ where: { id: In(permissionIds) } })
      : [];
    role.permissions = perms;
    await this.roleRepo.save(role);
    await this.permissionService.invalidateUsers(await this.getUserIdsOfRole(roleId));
  }

  async assignRoleMenus(roleId: string, menuIds: string[]): Promise<void> {
    const role = await this.findRoleEntity(roleId);
    const menus = menuIds.length ? await this.menuRepo.find({ where: { id: In(menuIds) } }) : [];
    role.menus = menus;
    await this.roleRepo.save(role);
    await this.permissionService.invalidateUsers(await this.getUserIdsOfRole(roleId));
  }

  // ─── 用户 ↔ 角色 分配 ──────────────────────────────────────────
  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    if (!user) throw new BusinessException(ErrorCode.USER_NOT_FOUND);
    const roles = roleIds.length ? await this.roleRepo.find({ where: { id: In(roleIds) } }) : [];
    user.roles = roles;
    await this.userRepo.save(user);
    await this.permissionService.invalidateUser(userId);
  }

  // ─── 权限列表 ──────────────────────────────────────────────────
  async findAllPermissions(): Promise<Permission[]> {
    return this.permRepo.find({ order: { module: "ASC", action: "ASC" } });
  }

  // ─── 菜单 CRUD ─────────────────────────────────────────────────
  async findMenuTree(): Promise<MenuTreeNode[]> {
    const flat = await this.menuService.findAllFlat();
    return this.menuService.buildTree(flat);
  }

  async findAllMenusFlat(): Promise<Menu[]> {
    return this.menuService.findAllFlat();
  }

  async createMenu(dto: CreateMenuDto): Promise<Menu> {
    await this.assertParentValid(dto.parentId ?? null);
    const exists = await this.menuRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new BusinessException(ErrorCode.MENU_CODE_TAKEN);

    const menu = this.menuRepo.create({
      parentId: dto.parentId ?? null,
      name: dto.name,
      code: dto.code,
      type: dto.type,
      path: dto.path ?? null,
      component: dto.component ?? null,
      redirect: dto.redirect ?? null,
      icon: dto.icon ?? null,
      permission: dto.permission ?? null,
      sort: dto.sort ?? 0,
      visible: dto.visible ?? true,
      status: dto.status ?? MenuStatus.ENABLED,
    });
    return this.menuRepo.save(menu);
  }

  async updateMenu(id: string, dto: UpdateMenuDto): Promise<Menu> {
    const menu = await this.findMenuEntity(id);
    if (dto.parentId !== undefined) {
      // 不允许把菜单挂到自己或自己的后代下（形成环）
      await this.assertParentValid(dto.parentId ?? null, id);
    }
    Object.assign(menu, dto);
    const saved = await this.menuRepo.save(menu);
    // 菜单改动影响所有能看到它的用户，简化处理：清全部相关用户缓存
    await this.invalidateMenuViewers();
    return saved;
  }

  async deleteMenu(id: string): Promise<void> {
    const menu = await this.findMenuEntity(id);
    await this.menuRepo.manager.transaction(async (manager) => {
      // 子菜单挂到被删菜单的父级
      await manager
        .createQueryBuilder()
        .update(Menu)
        .set({ parentId: menu.parentId })
        .where("parentId = :id", { id })
        .execute();
      // 清理 role_menus 关联（Menu 是反向侧，@JoinTable 在 Role 上）
      await manager.query("DELETE FROM role_menus WHERE menu_id = $1", [id]);
      await manager.delete(Menu, { id });
    });
    await this.invalidateMenuViewers();
  }

  // ─── 内部工具 ──────────────────────────────────────────────────
  private async findRoleEntity(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
    return role;
  }

  private async findMenuEntity(id: string): Promise<Menu> {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new BusinessException(ErrorCode.MENU_NOT_FOUND);
    return menu;
  }

  /** 某角色下的所有用户 id（用于改角色权限后批量清缓存） */
  private async getUserIdsOfRole(roleId: string): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { id: roleId }, relations: { users: true } });
    return (role?.users ?? []).map((u) => u.id);
  }

  /** 校验父菜单存在；若指定 selfId，确保不挂到自身或后代下（防环） */
  private async assertParentValid(parentId: string | null, selfId?: string): Promise<void> {
    if (!parentId) return;
    if (selfId && parentId === selfId) {
      throw new BusinessException(ErrorCode.MENU_PARENT_INVALID);
    }
    // 防环：parentId 不能是 selfId 的后代
    if (selfId) {
      const all = await this.menuRepo.find();
      const childrenOfSelf = this.collectDescendants(all, selfId);
      if (childrenOfSelf.has(parentId)) {
        throw new BusinessException(ErrorCode.MENU_PARENT_INVALID);
      }
    }
  }

  private collectDescendants(all: Menu[], rootId: string): Set<string> {
    const result = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const current = stack.pop()!;
      for (const m of all) {
        if (m.parentId === current && !result.has(m.id)) {
          result.add(m.id);
          stack.push(m.id);
        }
      }
    }
    return result;
  }

  /** 菜单树改动后，清所有用户的菜单缓存（简化：遍历用户表） */
  private async invalidateMenuViewers(): Promise<void> {
    const users = await this.userRepo.find({ select: { id: true } });
    await this.permissionService.invalidateUsers(users.map((u) => u.id));
  }
}
