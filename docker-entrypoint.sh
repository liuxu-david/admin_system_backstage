#!/bin/sh
set -e

# RUN_MIGRATIONS=true 时（测试/预发/生产容器），启动前先跑数据库迁移
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] running migrations..."
  node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
fi

echo "[entrypoint] starting app..."
exec node dist/main
