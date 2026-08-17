import { HttpStatus } from "@nestjs/common";

export enum ErrorCode {
  SUCCESS = 0,
  UNKNOWN = 10000,
  VALIDATION = 10001,
  UNAUTHORIZED = 10401,
  FORBIDDEN = 10403,
  NOT_FOUND = 10404,
  INTERNAL_ERROR = 10500,

  // User errors 20xxx
  USER_NOT_FOUND = 20001,
  USER_EMAIL_TAKEN = 20002,
  USER_PASSWORD_INCORRECT = 20003,
  USER_DISABLED = 20004,

  // Auth errors 201xx
  AUTH_INVALID_CREDENTIALS = 20101,
  AUTH_TOKEN_EXPIRED = 20102,
  AUTH_TOKEN_INVALID = 20103,
  AUTH_REFRESH_TOKEN_INVALID = 20104,

  // Project errors 202xx
  PROJECT_NOT_FOUND = 20201,
  PROJECT_NAME_TAKEN = 20202,

  // Scene errors 203xx
  SCENE_NOT_FOUND = 20301,

  // File errors 204xx
  FILE_NOT_FOUND = 20401,
  FILE_TOO_LARGE = 20402,
  FILE_TYPE_NOT_ALLOWED = 20403,

  // RBAC errors 205xx
  ROLE_NOT_FOUND = 20501,
  ROLE_CODE_TAKEN = 20502,
  ROLE_IS_SYSTEM = 20503,
  MENU_NOT_FOUND = 20505,
  MENU_PARENT_INVALID = 20506,
  RBAC_PERMISSION_DENIED = 20507,
  MENU_CODE_TAKEN = 20508,
  MENU_PERMISSION_INVALID = 20509,
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: "Success",
  [ErrorCode.UNKNOWN]: "Unknown error",
  [ErrorCode.VALIDATION]: "Validation failed",
  [ErrorCode.UNAUTHORIZED]: "Unauthorized",
  [ErrorCode.FORBIDDEN]: "Forbidden",
  [ErrorCode.NOT_FOUND]: "Resource not found",
  [ErrorCode.INTERNAL_ERROR]: "Internal server error",

  [ErrorCode.USER_NOT_FOUND]: "User not found",
  [ErrorCode.USER_EMAIL_TAKEN]: "User email already taken",
  [ErrorCode.USER_PASSWORD_INCORRECT]: "Incorrect password",
  [ErrorCode.USER_DISABLED]: "User account is disabled",

  [ErrorCode.AUTH_INVALID_CREDENTIALS]: "Invalid credentials",
  [ErrorCode.AUTH_TOKEN_EXPIRED]: "Access token has expired",
  [ErrorCode.AUTH_TOKEN_INVALID]: "Invalid access token",
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: "Invalid refresh token",

  [ErrorCode.PROJECT_NOT_FOUND]: "Project not found",
  [ErrorCode.PROJECT_NAME_TAKEN]: "Project name already taken",

  [ErrorCode.SCENE_NOT_FOUND]: "Scene not found",

  [ErrorCode.FILE_NOT_FOUND]: "File not found",
  [ErrorCode.FILE_TOO_LARGE]: "File is too large",
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: "File type is not allowed",

  [ErrorCode.ROLE_NOT_FOUND]: "Role not found",
  [ErrorCode.ROLE_CODE_TAKEN]: "Role code already taken",
  [ErrorCode.ROLE_IS_SYSTEM]: "Built-in role cannot be modified or deleted",
  [ErrorCode.MENU_NOT_FOUND]: "Menu not found",
  [ErrorCode.MENU_PARENT_INVALID]: "Menu parent is invalid or creates a cycle",
  [ErrorCode.RBAC_PERMISSION_DENIED]: "Permission denied",
  [ErrorCode.MENU_CODE_TAKEN]: "Menu code already taken",
  [ErrorCode.MENU_PERMISSION_INVALID]: "Menu permission code does not exist",
};

export const ERROR_HTTP_STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  [ErrorCode.SUCCESS]: HttpStatus.OK,
  [ErrorCode.VALIDATION]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,

  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.USER_EMAIL_TAKEN]: HttpStatus.CONFLICT,
  [ErrorCode.USER_PASSWORD_INCORRECT]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.USER_DISABLED]: HttpStatus.FORBIDDEN,

  [ErrorCode.AUTH_INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.AUTH_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,

  [ErrorCode.PROJECT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.PROJECT_NAME_TAKEN]: HttpStatus.CONFLICT,

  [ErrorCode.SCENE_NOT_FOUND]: HttpStatus.NOT_FOUND,

  [ErrorCode.FILE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.FILE_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,

  [ErrorCode.ROLE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.ROLE_CODE_TAKEN]: HttpStatus.CONFLICT,
  [ErrorCode.ROLE_IS_SYSTEM]: HttpStatus.FORBIDDEN,
  [ErrorCode.MENU_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.MENU_PARENT_INVALID]: HttpStatus.BAD_REQUEST,
  [ErrorCode.RBAC_PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [ErrorCode.MENU_CODE_TAKEN]: HttpStatus.CONFLICT,
  [ErrorCode.MENU_PERMISSION_INVALID]: HttpStatus.BAD_REQUEST,
};
