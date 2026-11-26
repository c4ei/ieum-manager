#!/usr/bin/env bash
# Manager가 control 폴더에 남긴 요청만 처리하는 제한된 호스트 에이전트입니다.
# - restart-ieum-nodes: 노드 로그 보관 후 4노드 재시작
# - chain-event: 사고 대응 이벤트(동결·복구·해제)를 4노드 config/events.json에 같은 내용으로 추가
#   노드(1.0.17.0+)가 5초 안에 파일을 다시 읽으므로 재시작하지 않습니다.
set -euo pipefail

control_dir="${IEUM_RECOVERY_CONTROL_HOST_DIR:-/var/lib/ieum-manager-control}"
archive_dir="$control_dir/processed"
log_dir="${IEUM_RECOVERY_LOG_DIR:-/var/log/ieum-recovery}"
token="${IEUM_RECOVERY_CONTROL_TOKEN:?IEUM_RECOVERY_CONTROL_TOKEN is required}"
node_dirs="${IEUM_NODE_DIRS:-/opt/ieum-node1 /opt/ieum-node2 /opt/ieum-node3 /opt/ieum-node4}"
nodes=(ieum-node1 ieum-node2 ieum-node3 ieum-node4)
mkdir -p "$archive_dir" "$log_dir"

# 결과 파일: 원 요청에 result를 붙여 processed/<completed|rejected>-<id>.json으로 옮깁니다(토큰은 지움).
finish() {
  python3 - "$1" "$archive_dir/$2-$(basename "$1")" "$3" <<'PY'
import json,os,sys
src,dst,result=sys.argv[1:]
try: item=json.load(open(src,encoding='utf-8'))
except Exception: item={}
item.pop('token',None); item['result']=result
json.dump(item,open(dst,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
os.remove(src)
PY
}

shopt -s nullglob
for request in "$control_dir"/*.json; do
  action="$(python3 - "$request" "$token" <<'PY'
import json,sys
from datetime import datetime, timezone
path, expected = sys.argv[1:]
with open(path, encoding='utf-8') as stream:
    item=json.load(stream)
if item.get('token') != expected or item.get('action') not in ('restart-ieum-nodes','chain-event'):
    raise SystemExit(2)
stamp=datetime.fromisoformat(item['requestedAt'].replace('Z','+00:00'))
if abs((datetime.now(timezone.utc)-stamp).total_seconds()) > 300:
    raise SystemExit(3)
print(item['action'])
PY
)" || { finish "$request" rejected "토큰 불일치, 지원하지 않는 요청 또는 5분이 지난 요청"; continue; }

  if [[ "$action" == restart-ieum-nodes ]]; then
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    for node in "${nodes[@]}"; do docker logs --tail 300 "$node" >"$log_dir/$stamp-$node.log" 2>&1 || true; done
    docker restart --timeout 30 "${nodes[@]}"
    finish "$request" completed "4노드 재시작"
    continue
  fi

  # chain-event: 형식을 다시 검사하고 네 노드에 같은 이벤트를 넣습니다. 하나라도 실패하면 전부 되돌립니다.
  if result="$(python3 - "$request" $node_dirs 2>&1 <<'PY'
import json,os,re,shutil,sys,time
path,dirs=sys.argv[1],sys.argv[2:]
event=json.load(open(path,encoding='utf-8'))['event']
addr=re.compile(r'^0x[0-9a-f]{40}$'); case=re.compile(r'^[A-Za-z0-9_-]{1,64}$')
a=event.get('action',{}); kind=a.get('type')
def bad(msg): raise SystemExit(msg)
if set(event)!={'id','execute_at','action'} or not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}',str(event['id'])): bad('이벤트 형식 오류')
if not isinstance(event['execute_at'],int) or abs(event['execute_at']-time.time())>600: bad('실행 시각 오류')
if not case.fullmatch(str(a.get('case_id',''))): bad('사건 ID 오류')
if kind in ('account_freeze','account_unfreeze'):
    allowed={'type','case_id','addresses','reason'} if kind=='account_freeze' else {'type','case_id','addresses'}
    if set(a)!=allowed or not a['addresses'] or len(a['addresses'])>32 or not all(addr.fullmatch(x) for x in a['addresses']): bad('주소 목록 오류')
    if kind=='account_freeze' and not (0<len(a['reason'])<=200): bad('사유 오류')
elif kind=='account_recovery':
    if set(a)!={'type','case_id','from','payments','release'} or not addr.fullmatch(a['from']): bad('복구 형식 오류')
    if not a['payments'] or len(a['payments'])>32: bad('수령자 수 오류')
    for p in a['payments']:
        if set(p)!={'address','amount'} or not addr.fullmatch(p['address']) or p['address']==a['from'] or not re.fullmatch(r'[1-9][0-9]{0,40}',p['amount']): bad('수령자 오류')
else: bad('지원하지 않는 이벤트')
stamp=time.strftime('%Y%m%d-%H%M%S'); done=[]
try:
    for d in dirs:
        f=os.path.join(d,'config','events.json'); ref=f if os.path.exists(f) else os.path.join(d,'config','upgrades.json')
        data=json.load(open(f)) if os.path.exists(f) else {'events':[]}
        if any(e.get('id')==event['id'] for e in data.get('events',[])): bad('이미 들어간 이벤트')
        if os.path.exists(f): shutil.copy2(f,f+'.'+stamp)
        data.setdefault('events',[]).append(event)
        tmp=f+'.tmp'; json.dump(data,open(tmp,'w'),indent=2,ensure_ascii=False); open(tmp,'a').write('\n')
        st=os.stat(ref); shutil.copystat(ref,tmp); os.chown(tmp,st.st_uid,st.st_gid); os.replace(tmp,f); done.append(f)
except BaseException as error:
    for f in done:
        backup=f+'.'+stamp
        if os.path.exists(backup): shutil.copy2(backup,f)
        else: os.remove(f)
    raise SystemExit(f'적용 실패, 되돌림: {error}')
print(f"{kind} {a['case_id']} → {len(dirs)}노드 events.json 반영(백업 .{stamp})")
PY
)"; then
    finish "$request" completed "$result"
  else
    finish "$request" rejected "${result:-이벤트 적용 실패}"
  fi
done
