#!/usr/bin/env bash
set -euo pipefail

control_dir="${IEUM_RECOVERY_CONTROL_HOST_DIR:-/var/lib/ieum-manager-control}"
archive_dir="$control_dir/processed"
log_dir="${IEUM_RECOVERY_LOG_DIR:-/var/log/ieum-recovery}"
token="${IEUM_RECOVERY_CONTROL_TOKEN:?IEUM_RECOVERY_CONTROL_TOKEN is required}"
nodes=(ieum-node1 ieum-node2 ieum-node3 ieum-node4)
mkdir -p "$archive_dir" "$log_dir"

shopt -s nullglob
for request in "$control_dir"/*.json; do
  action="$(python3 - "$request" "$token" <<'PY'
import json,sys
from datetime import datetime, timezone
path, expected = sys.argv[1:]
with open(path, encoding='utf-8') as stream:
    item=json.load(stream)
if item.get('token') != expected or item.get('action') != 'restart-ieum-nodes':
    raise SystemExit(2)
stamp=datetime.fromisoformat(item['requestedAt'].replace('Z','+00:00'))
if abs((datetime.now(timezone.utc)-stamp).total_seconds()) > 300:
    raise SystemExit(3)
print(item['action'])
PY
)" || { mv -- "$request" "$archive_dir/rejected-$(basename "$request")"; continue; }
  [[ "$action" == restart-ieum-nodes ]] || continue
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  for node in "${nodes[@]}"; do docker logs --tail 300 "$node" >"$log_dir/$stamp-$node.log" 2>&1 || true; done
  docker restart --timeout 30 "${nodes[@]}"
  mv -- "$request" "$archive_dir/completed-$(basename "$request")"
done
