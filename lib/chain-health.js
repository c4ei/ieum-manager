export function diagnoseNodes(nodes, previous = new Map(), now = Date.now(), stuckMs = 20_000) {
  const next = new Map();
  const online = nodes.filter(node => node.online);
  const assessments = nodes.map(node => {
    if (!node.online) return {...node, health:'critical', reason:'RPC 응답 없음'};
    const height = Number(node.status?.height);
    const pending = Number(node.txpool?.pending || 0);
    const prior = previous.get(node.id);
    const unchangedSince = prior && prior.height === height ? prior.unchangedSince : now;
    next.set(node.id, {height, unchangedSince});
    const stalledForMs = Math.max(0, now - unchangedSince);
    if (pending > 0 && stalledForMs >= stuckMs) {
      return {...node, health:'critical', reason:`대기 거래 ${pending}건이 있으나 ${Math.floor(stalledForMs / 1000)}초 동안 높이 ${height} 고정`, stalledForMs};
    }
    if (node.status?.syncing) return {...node, health:'warning', reason:'동기화 진행 중', stalledForMs};
    return {...node, health:'ok', reason:pending > 0 ? `거래 ${pending}건 확정 대기` : '정상', stalledForMs};
  });
  const heights = online.map(node => Number(node.status?.height)).filter(Number.isFinite);
  const identities = new Set(online.map(node => `${node.identity?.chainId}:${node.identity?.genesisHash}`));
  const pendingTotal = online.reduce((sum, node) => sum + Number(node.txpool?.pending || 0), 0);
  const critical = assessments.some(node => node.health === 'critical') || identities.size > 1;
  return {
    next,
    diagnostics: {
      generatedAt: new Date(now).toISOString(),
      status: critical ? 'critical' : assessments.some(node => node.health === 'warning') ? 'warning' : 'ok',
      onlineNodes: online.length,
      totalNodes: nodes.length,
      pendingTotal,
      sameIdentity: identities.size <= 1,
      sameHeight: heights.length > 0 && new Set(heights).size === 1,
      height: heights.length ? Math.max(...heights) : null,
      nodes: assessments.map(node => ({
        id: node.id, name: node.name, online: node.online, version: node.status?.version ?? null,
        height: node.status?.height ?? null, peers: node.status?.peers ?? null,
        pending: node.txpool?.pending ?? null, health: node.health, reason: node.reason,
        stalledForMs: node.stalledForMs ?? 0
      }))
    }
  };
}
