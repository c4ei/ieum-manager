#!/bin/sh
set -eu

# Docker named volume은 최초 마운트 시 root 소유가 될 수 있습니다.
# 시작할 때 쓰기 디렉터리만 최소 범위로 교정한 뒤 비권한 사용자로 실행합니다.
mkdir -p /app/data /app/logs
chown -R ieum:ieum /app/data /app/logs
exec su-exec ieum "$@"
