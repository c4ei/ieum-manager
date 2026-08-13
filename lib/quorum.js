export function selectIndexingQuorum(observations, minimumPeers = 2) {
  const groups = new Map();
  for (const item of observations.filter(value => value.online)) {
    const key = [item.identity.chainId,item.identity.genesisHash?.toLowerCase(),item.finalized.height,item.finalized.hash?.toLowerCase()].join(':');
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  const candidates = [...groups.values()].filter(group => group.length >= minimumPeers)
    .sort((a,b) => b[0].finalized.height-a[0].finalized.height || b.length-a.length);
  if (!candidates.length) throw new Error(`동일한 확정 상태를 보고한 독립 RPC ${minimumPeers}개가 없습니다.`);
  return candidates[0];
}
