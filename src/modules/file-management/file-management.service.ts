import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";

import { FileEntity } from "./entities/file.entity";
import { CreateFileDto } from "./dto/create-file.dto";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";
import { FileStorageService } from "../../common/file-storage/file-storage.service";

@Injectable()
export class FileManagementService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async create(dto: CreateFileDto, uploadedBy: string): Promise<FileEntity> {
    const file = this.fileRepository.create({ ...dto, uploadedBy });
    return this.fileRepository.save(file);
  }

  async findAll(uploadedBy?: string): Promise<FileEntity[]> {
    const where = uploadedBy ? { uploadedBy } : {};
    return this.fileRepository.find({ where, order: { createdAt: "DESC" } });
  }

  async findOne(id: string): Promise<FileEntity> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
    }
    return file;
  }

  async remove(id: string): Promise<void> {
    const file = await this.findOne(id);
    await this.fileStorageService.delete(file.storageKey);
    await this.fileRepository.remove(file);
  }

  generateStorageKey(originalName: string): string {
    const ext = originalName.split(".").pop() || "";
    const date = new Date().toISOString().split("T")[0];
    return `uploads/${date}/${randomUUID()}.${ext}`;
  }
}
