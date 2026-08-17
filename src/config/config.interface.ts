export interface AppConfig {
  env: string;
  name: string;
  port: number;
  prefix: string;
  /** CORS 允许的来源列表；为空数组时开发/测试环境放开、生产关闭 */
  corsOrigins: string[];
}

export interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export interface SmsConfig {
  provider: string;
  accessKeyId: string;
  accessKeySecret: string;
}

export interface FileStorageConfig {
  driver: "local" | "s3";
  localUploadDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
}

export interface AllConfig {
  app: AppConfig;
  db: DbConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  mail: MailConfig;
  sms: SmsConfig;
  fileStorage: FileStorageConfig;
}
