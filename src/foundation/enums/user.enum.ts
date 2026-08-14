// 注：旧的 UserRole（admin/user）已移除，授权改为 RBAC 的 roles 多对多关系。

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BANNED = "banned",
}
