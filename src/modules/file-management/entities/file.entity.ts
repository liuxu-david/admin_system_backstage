import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../foundation/entities/base.entity";
import { FileCategory, StorageDriver } from "../../../foundation/enums";
import { User } from "../../user/entities/user.entity";

@Entity("files")
export class FileEntity extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 255, name: "original_name" })
  originalName!: string;

  @Column({ type: "varchar", length: 500, name: "storage_key" })
  storageKey!: string;

  @Column({ type: "varchar", length: 500, name: "url" })
  url!: string;

  @Column({ type: "bigint" })
  size!: number;

  @Column({ type: "varchar", length: 100, name: "mime_type" })
  mimeType!: string;

  @Column({
    type: "enum",
    enum: FileCategory,
    default: FileCategory.OTHER,
  })
  category!: FileCategory;

  @Column({
    type: "enum",
    enum: StorageDriver,
    default: StorageDriver.LOCAL,
  })
  storageDriver!: StorageDriver;

  @Column({ name: "uploaded_by", type: "uuid" })
  uploadedBy!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  uploader!: User;
}
