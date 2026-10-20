import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { MenuType, MenuStatus } from "../entities/menu.entity";

export class CreateMenuDto {
  @ApiPropertyOptional({ description: "父菜单 id（根菜单为 null）", example: "uuid" })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({ description: "显示名", example: "用户管理" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: "唯一编码", example: "system:user" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ description: "类型", enum: MenuType, example: MenuType.MENU })
  @IsEnum(MenuType)
  type!: MenuType;

  @ApiPropertyOptional({ description: "前端路由路径", example: "/system/user" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  path?: string;

  @ApiPropertyOptional({
    description: "前端组件路径（对应 views 目录）",
    example: "system/user/index",
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  component?: string;

  @ApiPropertyOptional({ description: "目录点击后跳转", example: "/system/user" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  redirect?: string;

  @ApiPropertyOptional({ description: "图标名", example: "Setting" })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ description: "按钮专用：关联的权限 code", example: "user:delete" })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  permission?: string;

  @ApiPropertyOptional({ description: "排序", example: 0, default: 0 })
  @IsInt()
  @IsOptional()
  sort?: number;

  @ApiPropertyOptional({ description: "是否在侧边栏显示", example: true, default: true })
  @IsBoolean()
  @IsOptional()
  visible?: boolean;

  @ApiPropertyOptional({ description: "状态", enum: MenuStatus, example: MenuStatus.ENABLED })
  @IsEnum(MenuStatus)
  @IsOptional()
  status?: MenuStatus;
}
