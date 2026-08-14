import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { User } from "../../user/entities/user.entity";

@Entity("refresh_tokens")
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 500 })
  token!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ default: true })
  isActive!: boolean;
}
