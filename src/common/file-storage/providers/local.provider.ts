import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import {
  FileUploadResult,
  IFileStorageProvider,
  UploadFileOptions,
} from "../interfaces/file-storage-provider.interface";

@Injectable()
export class LocalFileStorageProvider implements IFileStorageProvider {
  private readonly logger = new Logger(LocalFileStorageProvider.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.resolve(
      configService.get<string>("fileStorage.localUploadDir", "./uploads"),
    );
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  upload(options: UploadFileOptions): Promise<FileUploadResult> {
    const filePath = path.join(this.uploadDir, options.key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, options.buffer);

    this.logger.log(`[Local] Uploaded file: ${options.key} (${options.buffer.length} bytes)`);

    return Promise.resolve({
      key: options.key,
      url: this.getUrl(options.key),
      size: options.buffer.length,
    });
  }

  delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return Promise.resolve();
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  exists(key: string): Promise<boolean> {
    return Promise.resolve(fs.existsSync(path.join(this.uploadDir, key)));
  }
}
