export default () => ({
  app: {
    env: process.env.APP_ENV || "dev",
    name: process.env.APP_NAME || "nest-backend",
    port: parseInt(process.env.APP_PORT || "3000", 10),
    prefix: process.env.APP_PREFIX || "api",
    // 逗号分隔，如 https://staging.example.com,https://admin.example.com
    corsOrigins: (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "nest_backend",
    logging: process.env.DB_LOGGING === "true",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "jwt-access-secret-change-in-production",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "jwt-refresh-secret-change-in-production",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  mail: {
    host: process.env.MAIL_HOST || "localhost",
    port: parseInt(process.env.MAIL_PORT || "587", 10),
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASS || "",
    from: process.env.MAIL_FROM || "noreply@example.com",
    secure: process.env.MAIL_SECURE === "true",
  },
  sms: {
    provider: process.env.SMS_PROVIDER || "mock",
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || "",
  },
  fileStorage: {
    driver: (process.env.FILE_STORAGE_DRIVER || "local") as "local" | "s3",
    localUploadDir: process.env.FILE_STORAGE_LOCAL_DIR || "./uploads",
    s3Bucket: process.env.FILE_STORAGE_S3_BUCKET || "",
    s3Region: process.env.FILE_STORAGE_S3_REGION || "",
    s3AccessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY_ID || "",
    s3SecretAccessKey: process.env.FILE_STORAGE_S3_SECRET_ACCESS_KEY || "",
  },
});
