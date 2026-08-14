import { Column, Entity, Index, JoinTable, ManyToMany } from "typeorm";
import { Exclude } from "class-transformer";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { UserStatus } from "../../../foundation/enums";
import { Role } from "../../rbac/entities/role.entity";

@Entity("users")
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  nickname!: string;

  @Exclude()
  @Column({ type: "varchar", length: 255, name: "password_hash" })
  passwordHash!: string;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: "varchar", length: 255, nullable: true, name: "avatar_url" })
  avatarUrl!: string;

  /** 用户 ↔ 角色（多对多），关联表 user_roles 由 @JoinTable 自动生成 */
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: "user_roles",
    joinColumn: { name: "user_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "role_id", referencedColumnName: "id" },
  })
  roles!: Role[];
}
