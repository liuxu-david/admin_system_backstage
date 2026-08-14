import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";

/**
 * 通用「分配 id 列表」入参，用于：
 * - PUT /rbac/roles/:id/permissions  （给角色分配接口权限）
 * - PUT /rbac/roles/:id/menus        （给角色分配菜单）
 * - PUT /rbac/users/:id/roles        （给用户分配角色）
 * 传空数组表示清空。
 */
export class AssignIdsDto {
  @ApiProperty({ description: "id 列表（清空传空数组）", example: ["uuid-1", "uuid-2"] })
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  ids!: string[];
}
