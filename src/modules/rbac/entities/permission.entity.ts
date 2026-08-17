import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "../../../foundation/entities/base.entity";

/**
 * 权限码字典（module:action），给菜单节点挂载时做校验和下拉选择用。
 * 不参与任何关联表——角色的权限 = 勾选的菜单节点上的 permission 字段读时派生。
 */
@Entity("permissions")
export class Permission extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 50 })
  module!: string;

  @Column({ type: "varchar", length: 50 })
  action!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;
}
