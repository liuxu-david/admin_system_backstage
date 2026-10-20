import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PERMISSIONS_KEY, ROLES_KEY } from "../decorators/require-permissions.decorator";
import { PermissionService } from "../../modules/rbac/permission.service";
import { BusinessException } from "../exceptions/business-exception";
import { ErrorCode } from "../errors/error-codes";

/**
 * 接口权限守卫。必须排在 JwtAuthGuard 之后（依赖 request.user.sub）。
 * 用法：@UseGuards(JwtAuthGuard, PermissionsGuard) + @RequirePermissions("xxx:yyy")
 *
 * - 没标 @RequirePermissions / @RequireRoles → 放行（只受登录保护）
 * - 超级管理员 → 短路放行，不查库
 * - 否则查用户权限/角色码，满足任一所需即放行，否则抛 RBAC_PERMISSION_DENIED(403)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasPermReq = !!required && required.length > 0;
    const hasRoleReq = !!requiredRoles && requiredRoles.length > 0;
    if (!hasPermReq && !hasRoleReq) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub?: string } | undefined;
    if (!user?.sub) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }
    const userId = user.sub;

    // 超管短路：拥有一切权限
    if (await this.permissionService.isSuperAdmin(userId)) return true;

    if (hasPermReq) {
      const userPerms = await this.permissionService.getUserPermissions(userId);
      const ok = required.some((code: string) => userPerms.includes(code));
      if (!ok) throw new BusinessException(ErrorCode.RBAC_PERMISSION_DENIED);
    }

    if (hasRoleReq) {
      const userRoles = await this.permissionService.getUserRoleCodes(userId);
      const ok = requiredRoles.some((code: string) => userRoles.includes(code));
      if (!ok) throw new BusinessException(ErrorCode.RBAC_PERMISSION_DENIED);
    }

    return true;
  }
}
