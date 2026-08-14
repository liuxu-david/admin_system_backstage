import { Inject, Injectable } from "@nestjs/common";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import {
  FileUploadResult,
  IFileStorageProvider,
  UploadFileOptions,
} from "./interfaces/file-storage-provider.interface";

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(PROVIDER_TOKENS.FILE_STORAGE_PROVIDER)
    private readonly storageProvider: IFileStorageProvider,
  ) {}

  async upload(options: UploadFileOptions): Promise<FileUploadResult> {
    return this.storageProvider.upload(options);
  }

  async delete(key: string): Promise<void> {
    return this.storageProvider.delete(key);
  }

  getUrl(key: string): string {
    return this.storageProvider.getUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storageProvider.exists(key);
  }
}
