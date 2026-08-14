import { PartialType } from "@nestjs/mapped-types";
import { CreateRoleDto } from "./create-role.dto";

/**
 * 更新角色：PartialType 让所有字段可选。
 * 注意：code 不在更新入参里被使用（service 忽略它），保证角色编码不可改。
 */
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
