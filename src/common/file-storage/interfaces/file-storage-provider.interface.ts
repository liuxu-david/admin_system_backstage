export interface UploadFileOptions {
  key: string;
  buffer: Buffer;
  mimeType: string;
}

export interface FileUploadResult {
  key: string;
  url: string;
  size: number;
}

export interface IFileStorageProvider {
  upload(options: UploadFileOptions): Promise<FileUploadResult>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  exists(key: string): Promise<boolean>;
}
