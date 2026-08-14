import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../../foundation/guards/auth.guard";
import { PermissionsGuard } from "../../foundation/guards/permissions.guard";
import { RequirePermissions } from "../../foundation/decorators/require-permissions.decorator";
import { RbacService } from "./rbac.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { CreateMenuDto } from "./dto/create-menu.dto";
import { UpdateMenuDto } from "./dto/update-menu.dto";
import { AssignIdsDto } from "./dto/assign-ids.dto";
import { UserStatus } from "../../foundation/enums";

@ApiTags("RBAC")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("rbac")
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ─── 权限 ───────────────────────────────────────────────
  @Get("permissions")
  @RequirePermissions("permission:read")
  @ApiOperation({ summary: "权限点列表" })
  findAllPermissions() {
    return this.rbacService.findAllPermissions();
  }

  // ─── 角色 ───────────────────────────────────────────────
  @Get("roles")
  @RequirePermissions("role:read")
  @ApiOperation({ summary: "角色列表" })
  findRoles() {
    return this.rbacService.findRoles();
  }

  @Get("roles/:id")
  @RequirePermissions("role:read")
  @ApiOperation({ summary: "角色详情（含已分配权限/菜单）" })
  findRoleDetail(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.rbacService.findRoleDetail(id);
  }

  @Post("roles")
  @RequirePermissions("role:create")
  @ApiOperation({ summary: "新建角色" })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Patch("roles/:id")
  @RequirePermissions("role:update")
  @ApiOperation({ summary: "更新角色" })
  updateRole(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete("roles/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("role:delete")
  @ApiOperation({ summary: "删除角色（内置角色禁删）" })
  async deleteRole(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.rbacService.deleteRole(id);
    return null;
  }

  @Put("roles/:id/permissions")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("role:assign")
  @ApiOperation({ summary: "给角色分配接口权限" })
  async assignRolePermissions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AssignIdsDto,
  ) {
    await this.rbacService.assignRolePermissions(id, dto.ids);
    return null;
  }

  @Put("roles/:id/menus")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("role:assign")
  @ApiOperation({ summary: "给角色分配菜单" })
  async assignRoleMenus(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AssignIdsDto) {
    await this.rbacService.assignRoleMenus(id, dto.ids);
    return null;
  }

  // ─── 菜单 ───────────────────────────────────────────────
  @Get("menus/tree")
  @RequirePermissions("menu:read")
  @ApiOperation({ summary: "完整菜单树（管理端用）" })
  findMenuTree() {
    return this.rbacService.findMenuTree();
  }

  @Get("menus")
  @RequirePermissions("menu:read")
  @ApiOperation({ summary: "菜单扁平列表" })
  findAllMenus() {
    return this.rbacService.findAllMenusFlat();
  }

  @Post("menus")
  @RequirePermissions("menu:create")
  @ApiOperation({ summary: "新建菜单" })
  createMenu(@Body() dto: CreateMenuDto) {
    return this.rbacService.createMenu(dto);
  }

  @Patch("menus/:id")
  @RequirePermissions("menu:update")
  @ApiOperation({ summary: "更新菜单" })
  updateMenu(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateMenuDto) {
    return this.rbacService.updateMenu(id, dto);
  }

  @Delete("menus/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("menu:delete")
  @ApiOperation({ summary: "删除菜单（子菜单挂到父级）" })
  async deleteMenu(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.rbacService.deleteMenu(id);
    return null;
  }

  // ─── 用户（角色分配 / 状态） ─────────────────────────────
  @Get("users")
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "用户列表（带角色，管理端用）" })
  findUsers() {
    return this.rbacService.findUsersWithRoles();
  }

  @Put("users/:id/roles")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("user:assign-role")
  @ApiOperation({ summary: "给用户分配角色" })
  async assignUserRoles(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AssignIdsDto) {
    await this.rbacService.assignUserRoles(id, dto.ids);
    return null;
  }

  @Patch("users/:id/status")
  @RequirePermissions("user:update")
  @ApiOperation({ summary: "更新用户状态" })
  async updateUserStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: { status: UserStatus },
  ) {
    await this.rbacService.setUserStatus(id, body.status);
    return null;
  }
}
