import { SetMetadata } from "@nestjs/common";

/** 元数据 key：接口所需权限码 */
export const PERMISSIONS_KEY = "permissions";
/** 元数据 key：接口所需角色码 */
export const ROLES_KEY = "roles";

/**
 * 声明接口所需权限码。满足**任意一个**即放行。
 * @example
 *   @RequirePermissions("project:create")
 *   @RequirePermissions("project:update", "project:delete") // 二者有其一即可
 */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

/**
 * 声明接口所需角色码（满足任一即可）。一般配合权限码使用，用于「整页只给某角色」。
 * @example @RequireRoles("super_admin")
 */
export const RequireRoles = (...codes: string[]) => SetMetadata(ROLES_KEY, codes);
