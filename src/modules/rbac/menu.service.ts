import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { REDIS_KEYS } from "../../foundation/constants/redis-keys";
import { Menu, MenuStatus } from "./entities/menu.entity";

/** 返回给前端的菜单树节点 */
export interface MenuTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  type: string;
  path: string | null;
  component: string | null;
  redirect: string | null;
  icon: string | null;
  permission: string | null;
  sort: number;
  visible: boolean;
  children: MenuTreeNode[];
}

const CACHE_TTL_SECONDS = 1800;

/**
 * 菜单服务：把扁平的菜单表（靠 parentId 关联）组装成树。
 */
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu) private readonly menuRepo: Repository<Menu>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** 用户可见菜单树（取其角色拥有的、enabled 的菜单，去重后建树，带 Redis 缓存） */
  async getUserMenuTree(userId: string, roleIds: string[]): Promise<MenuTreeNode[]> {
    const cacheKey = REDIS_KEYS.USER_MENUS(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as MenuTreeNode[];
      } catch {
        // 缓存损坏，忽略，继续查库
      }
    }

    let list: Menu[] = [];
    if (roleIds.length) {
      // 通过 roles 关系过滤：菜单的某个角色 ∈ 用户的角色
      list = await this.menuRepo.find({
        where: { status: MenuStatus.ENABLED, roles: { id: In(roleIds) } },
        order: { sort: "ASC", createdAt: "ASC" },
      });
    }

    // 一个菜单可能被多个角色拥有，去重
    const dedup = new Map<string, Menu>();
    for (const m of list) dedup.set(m.id, m);

    const tree = this.buildTree([...dedup.values()]);
    await this.redis.set(cacheKey, JSON.stringify(tree), "EX", CACHE_TTL_SECONDS);
    return tree;
  }

  /** 完整菜单列表（扁平，管理端用；前端自行用 tree-props 渲染） */
  async findAllFlat(): Promise<Menu[]> {
    return this.menuRepo.find({ order: { sort: "ASC", createdAt: "ASC" } });
  }

  /** 扁平菜单转树（通用工具） */
  buildTree(menus: Menu[], parentId: string | null = null): MenuTreeNode[] {
    return menus
      .filter((m) => (m.parentId ?? null) === parentId)
      .map((m) => ({
        id: m.id,
        parentId: m.parentId,
        name: m.name,
        code: m.code,
        type: m.type,
        path: m.path,
        component: m.component,
        redirect: m.redirect,
        icon: m.icon,
        permission: m.permission,
        sort: m.sort,
        visible: m.visible,
        children: this.buildTree(menus, m.id),
      }))
      .sort((a, b) => a.sort - b.sort);
  }
}
