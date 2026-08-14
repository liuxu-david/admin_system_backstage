import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FileEntity } from "./entities/file.entity";
import { FileManagementService } from "./file-management.service";
import { FileManagementController } from "./file-management.controller";

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  controllers: [FileManagementController],
  providers: [FileManagementService],
  exports: [FileManagementService],
})
export class FileManagementModule {}
