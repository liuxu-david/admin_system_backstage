import { Column, Entity, Index, JoinTable, ManyToMany } from "typeorm";

import { BaseEntity } from "../../../foundation/entities/base.entity";
import { Menu } from "./menu.entity";
import { User } from "../../user/entities/user.entity";

/**
 * 角色 —— 权限的「模板」，用户通过角色套用权限。
 * 权限码不落关联表：从勾选的菜单节点（role_menus）上的 permission 字段读时派生。
 * is_system=true 的内置角色不可删除（防误删超管）。
 */
@Entity("roles")
export class Role extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 50 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @Column({ type: "boolean", name: "is_system", default: false })
  isSystem!: boolean;

  @Column({ type: "int", default: 0 })
  sort!: number;

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[];

  @ManyToMany(() => Menu, (menu) => menu.roles)
  @JoinTable({
    name: "role_menus",
    joinColumn: { name: "role_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "menu_id", referencedColumnName: "id" },
  })
  menus!: Menu[];
}
