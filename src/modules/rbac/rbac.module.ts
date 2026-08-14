import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Role } from "./entities/role.entity";
import { Permission } from "./entities/permission.entity";
import { Menu } from "./entities/menu.entity";
import { User } from "../user/entities/user.entity";
import { PermissionService } from "./permission.service";
import { MenuService } from "./menu.service";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";

/**
 * RBAC 模块。声明为 @Global，导出 PermissionService/MenuService/RbacService：
 * - PermissionsGuard（在 foundation）注入 PermissionService 需要全局可见
 * - UserController 注入 RbacService 提供 GET /users/info
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, Menu, User])],
  controllers: [RbacController],
  providers: [PermissionService, MenuService, RbacService],
  exports: [PermissionService, MenuService, RbacService],
})
export class RbacModule {}
