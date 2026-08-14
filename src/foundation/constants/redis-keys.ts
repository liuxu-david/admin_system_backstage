/** Redis key builders - use template functions to avoid collisions */
export const REDIS_KEYS = {
  /** User access token: user:token:<userId> */
  USER_TOKEN: (userId: string) => `user:token:${userId}`,
  /** User refresh token: user:refresh:<userId> */
  USER_REFRESH_TOKEN: (userId: string) => `user:refresh:${userId}`,
  /** Rate limit: rate-limit:<ip>:<path> */
  RATE_LIMIT: (ip: string, route: string) => `rate-limit:${ip}:${route}`,
  /** Verification code: verify:<type>:<target> */
  VERIFY_CODE: (type: string, target: string) => `verify:${type}:${target}`,
  /** Cache prefix: cache:<module>:<key> */
  CACHE: (module: string, key: string) => `cache:${module}:${key}`,
  /** 用户接口权限集合: user:perms:<userId> */
  USER_PERMISSIONS: (userId: string) => `user:perms:${userId}`,
  /** 用户菜单树 JSON: user:menus:<userId> */
  USER_MENUS: (userId: string) => `user:menus:${userId}`,
} as const;
