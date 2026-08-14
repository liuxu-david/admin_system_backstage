import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import { LocalFileStorageProvider } from "./providers/local.provider";
import { FileStorageService } from "./file-storage.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PROVIDER_TOKENS.FILE_STORAGE_PROVIDER,
      useClass: LocalFileStorageProvider,
    },
    FileStorageService,
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}
