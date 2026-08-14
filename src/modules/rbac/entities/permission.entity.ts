import { Column, Entity, Index, ManyToMany } from "typeorm";

import { BaseEntity } from "../../../foundation/entities/base.entity";
import { Role } from "./role.entity";

/**
 * 接口权限点。code = module + ":" + action，几乎对应后端一个 Controller 方法。
 * 例：project:create、user:delete、scene:publish。
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

  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[];
}
