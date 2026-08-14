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
import { RbacService } from "../rbac/rbac.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly rbacService: RbacService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all users" })
  findAll() {
    return this.userService.findAll();
  }

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
  @ApiOperation({ summary: "Get user by ID" })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user" })
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user" })
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.userService.remove(id);
  }
}
