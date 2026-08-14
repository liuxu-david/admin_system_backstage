import { Column, Entity, Index, ManyToMany } from "typeorm";

import { BaseEntity } from "../../../foundation/entities/base.entity";
import { Role } from "./role.entity";

/** 菜单类型：directory 目录 / menu 页面 / button 按钮 */
export enum MenuType {
  DIRECTORY = "directory",
  MENU = "menu",
  BUTTON = "button",
}

/** 菜单状态 */
export enum MenuStatus {
  ENABLED = "enabled",
  DISABLED = "disabled",
}

/**
 * 菜单（树形，自引用 parentId）。
 * 同时承担「路由 / 侧边栏 / 按钮」三种用途：
 * - directory：侧边栏可展开分组，不含页面
 * - menu：真实页面，对应一个路由 + component
 * - button：页面内操作按钮，靠 permission 字段关联接口权限码
 */
@Entity("menus")
export class Menu extends BaseEntity {
  @Column({ type: "uuid", name: "parent_id", nullable: true })
  parentId!: string | null;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "enum", enum: MenuType })
  type!: MenuType;

  @Column({ type: "varchar", length: 255, nullable: true })
  path!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  component!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  redirect!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  icon!: string | null;

  /** 按钮专用：关联 permissions.code，是菜单权限与接口权限的桥梁 */
  @Column({ type: "varchar", length: 100, nullable: true })
  permission!: string | null;

  @Column({ type: "int", default: 0 })
  sort!: number;

  @Column({ type: "boolean", default: true })
  visible!: boolean;

  @Column({ type: "enum", enum: MenuStatus, default: MenuStatus.ENABLED })
  status!: MenuStatus;

  @ManyToMany(() => Role, (role) => role.menus)
  roles!: Role[];
}
