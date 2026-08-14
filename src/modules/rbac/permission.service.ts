import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { REDIS_KEYS } from "../../foundation/constants/redis-keys";
import { User } from "../user/entities/user.entity";

/** 超级管理员角色编码（拥有全部权限，守卫短路放行） */
const SUPER_ADMIN_CODE = "super_admin";
/** 权限/菜单缓存有效期（秒） */
const CACHE_TTL_SECONDS = 1800;

/**
 * 权限加载/缓存服务。
 * 权限是「读多写极少」（每个请求都查），用 Redis 缓存 30 分钟。
 * 任何「分配/收回」操作后必须调用 invalidateUser，否则收回不生效。
 */
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** 获取用户全部权限码（带 Redis 缓存，集合去重） */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = REDIS_KEYS.USER_PERMISSIONS(userId);
    const cached = await this.redis.smembers(cacheKey);
    if (cached.length) return cached;

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: { permissions: true } },
    });
    if (!user) return [];

    const codes = new Set<string>();
    for (const role of user.roles ?? []) {
      for (const perm of role.permissions ?? []) codes.add(perm.code);
    }
    const list = [...codes];
    if (list.length) await this.redis.sadd(cacheKey, ...list);
    await this.redis.expire(cacheKey, CACHE_TTL_SECONDS);
    return list;
  }

  /** 获取用户的角色编码列表（用于 @RequireRoles 与超管判断） */
  async getUserRoleCodes(userId: string): Promise<string[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    return (user?.roles ?? []).map((r) => r.code);
  }

  async getUserRoleIds(userId: string): Promise<string[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    return (user?.roles ?? []).map((r) => r.id);
  }

  /** 是否超级管理员（不查权限集合，直接看角色编码） */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const roles = await this.getUserRoleCodes(userId);
    return roles.includes(SUPER_ADMIN_CODE);
  }

  /** 清掉单个用户的权限/菜单缓存（权限收回后必须调用） */
  async invalidateUser(userId: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.USER_PERMISSIONS(userId));
    await this.redis.del(REDIS_KEYS.USER_MENUS(userId));
  }

  /** 批量清缓存（改角色权限时遍历该角色下所有用户） */
  async invalidateUsers(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((id) => this.invalidateUser(id)));
  }
}
