import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { ProjectStatus, ProjectVisibility } from "../../../foundation/enums";
import { User } from "../../user/entities/user.entity";

@Entity("projects")
export class Project extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({
    type: "enum",
    enum: ProjectStatus,
    default: ProjectStatus.ACTIVE,
  })
  status!: ProjectStatus;

  @Column({
    type: "enum",
    enum: ProjectVisibility,
    default: ProjectVisibility.PRIVATE,
  })
  visibility!: ProjectVisibility;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  owner!: User;
}
