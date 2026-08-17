import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser, JwtPayload } from "../../foundation/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../foundation/guards/auth.guard";
import { PermissionsGuard } from "../../foundation/guards/permissions.guard";
import { RequirePermissions } from "../../foundation/decorators/require-permissions.decorator";
import { RbacService } from "../rbac/rbac.service";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly rbacService: RbacService,
  ) {}

  @Post()
  @RequirePermissions("user:create")
  @ApiOperation({ summary: "Create a new user" })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "List all users" })
  findAll() {
    return this.userService.findAll();
  }

  // info / me 是所有登录用户的核心接口，不挂权限码（仅需登录）

  @Get("info")
  @ApiOperation({ summary: "当前用户授权信息（user + roles + permissions + menus）" })
  getMyInfo(@CurrentUser() user: JwtPayload) {
    return this.rbacService.getUserAuthInfo(user.sub);
  }

  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findOne(user.sub);
  }

  @Get(":id")
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "Get user by ID" })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissions("user:update")
  @ApiOperation({ summary: "Update user" })
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("user:delete")
  @ApiOperation({ summary: "Delete user" })
  remove(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtPayload) {
    // 自删拦截：删掉自己会当场锁死系统（哪怕是超管手滑）
    if (user.sub === id) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "不能删除当前登录账号");
    }
    return this.userService.remove(id);
  }
}
