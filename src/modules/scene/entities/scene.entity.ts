import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { SceneStatus } from "../../../foundation/enums";
import { Project } from "../../project/entities/project.entity";

@Entity("scenes")
export class Scene extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({
    type: "enum",
    enum: SceneStatus,
    default: SceneStatus.DRAFT,
  })
  status!: SceneStatus;

  @Column({ type: "jsonb", nullable: true })
  payload!: Record<string, any>;

  @Column({ name: "project_id", type: "uuid" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  project!: Project;
}
