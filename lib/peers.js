const text=value=>value==null||value===''?null:String(value);
const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);

export function peerAddressParts(value){
  const address=text(value);if(!address)return {address:null,ip:null,port:null};
  const ipv6=address.match(/^\[([^\]]+)]:(\d+)$/);if(ipv6)return {address,ip:ipv6[1],port:Number(ipv6[2])};
  const ipv4=address.match(/^([^:]+):(\d+)$/);return ipv4?{address,ip:ipv4[1],port:Number(ipv4[2])}:{address,ip:address,port:null};
}

export function normalizePeer(row,now=Date.now()){
  const raw=row.raw&&typeof row.raw==='object'?row.raw:{};const endpoint=peerAddressParts(row.p2p_address||raw.address||raw.remoteAddress);
  const connectedAt=text(raw.connectedAt||raw.connected_at);const uptimeSeconds=number(raw.uptimeSeconds||raw.uptime_seconds)||(connectedAt?Math.max(0,Math.floor((now-Date.parse(connectedAt))/1000)):null);
  return {nodeId:text(row.node_id),name:text(row.name),online:Boolean(row.online),address:endpoint.address,ip:endpoint.ip,port:endpoint.port,
    country:text(raw.country||raw.countryCode),version:text(row.version||raw.version),protocolVersion:text(raw.protocolVersion||raw.protocol_version),height:number(row.height??raw.height),
    peerCount:number(row.peer_count??raw.connections),direction:text(raw.direction),latencyMs:number(raw.latencyMs||raw.latency_ms),connectedAt,uptimeSeconds,
    sourceNodeId:text(row.source_node_id),lastSeenAt:text(row.last_seen_at),walletAddress:text(raw.walletAddress||raw.wallet_address),walletVerified:Boolean(raw.walletVerified||raw.wallet_verified),
    balance:text(raw.balance),agent:text(raw.agent),capabilities:Array.isArray(raw.capabilities)?raw.capabilities:[],connectedPeers:Array.isArray(raw.peers)?raw.peers:[]};
}

export function peerSummary(items){
  return {uniquePeers:new Set(items.map(item=>item.nodeId).filter(Boolean)).size,onlinePeers:items.filter(item=>item.online).length,
    totalConnections:items.reduce((sum,item)=>sum+(item.peerCount||0),0),versions:[...new Set(items.map(item=>item.version).filter(Boolean))].sort()};
}
