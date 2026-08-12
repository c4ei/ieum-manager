import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pool,query} from './lib/db.js';
import {rpc,hexToBigInt,toNumber} from './lib/rpc.js';

const root = new URL('.', import.meta.url).pathname;
const config = JSON.parse(await readFile(process.env.IEUM_MANAGER_CONFIG || join(root,'config.json'),'utf8'));
const interval = Number(process.env.INDEX_INTERVAL_MS || 3000);
const confirmations = Number(process.env.INDEX_CONFIRMATIONS || 0);
let stopping = false;

async function primaryRpc() {
  for (const node of config.nodes) { try { await rpc(node.rpcUrl,'eth_blockNumber'); return node.rpcUrl; } catch {} }
  throw new Error('사용 가능한 IEUM RPC 노드가 없습니다.');
}

async function indexBlock(url, height) {
  const block = (await rpc(url,'eth_getBlockByNumber',[`0x${height.toString(16)}`,true],10000)).result;
  if (!block) throw new Error(`block ${height} not found`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO blocks(height,hash,parent_hash,producer,timestamp,tx_count,size_bytes,raw)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(height) DO UPDATE SET hash=EXCLUDED.hash,parent_hash=EXCLUDED.parent_hash,
      producer=EXCLUDED.producer,timestamp=EXCLUDED.timestamp,tx_count=EXCLUDED.tx_count,size_bytes=EXCLUDED.size_bytes,raw=EXCLUDED.raw,indexed_at=now()`,
      [height,block.hash,block.parentHash,block.miner,toNumber(block.timestamp),block.transactions.length,toNumber(block.size||'0x0'),block]);
    for (const [i,tx] of block.transactions.entries()) {
      await client.query(`INSERT INTO transactions(hash,block_height,tx_index,sender,recipient,value,fee,nonce,raw)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(hash) DO NOTHING`,
        [tx.hash,height,i,tx.from,tx.to,hexToBigInt(tx.value||'0x0').toString(),hexToBigInt(tx.gasPrice||'0x0').toString(),toNumber(tx.nonce||'0x0'),tx]);
      for (const address of [tx.from,tx.to]) await client.query(`INSERT INTO address_balances(address,balance,tx_count,first_seen_height,last_seen_height)
        VALUES($1,0,1,$2,$2) ON CONFLICT(address) DO UPDATE SET tx_count=address_balances.tx_count+1,last_seen_height=$2`,[address,height]);
    }
    await client.query(`INSERT INTO explorer_state(key,value) VALUES('last_height',$1) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=now()`,[String(height)]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function refreshBalances(url) {
  let offset=0; const limit=1000;
  while (true) {
    const page=(await rpc(url,'ieum_addressBalances',[offset,limit],15000)).result;
    for (const item of page.accounts||[]) await query(`INSERT INTO address_balances(address,balance,locked,updated_at) VALUES($1,$2,$3,now())
      ON CONFLICT(address) DO UPDATE SET balance=EXCLUDED.balance,locked=EXCLUDED.locked,updated_at=now()`,[item.address,String(item.balance),Boolean(item.locked)]);
    offset += (page.accounts||[]).length;
    if (!page.accounts?.length || offset>=Number(page.total)) break;
  }
}

async function cycle() {
  const url=await primaryRpc(); const tip=toNumber((await rpc(url,'eth_blockNumber')).result)-confirmations;
  for (const node of config.nodes) {
    try {
      const status=(await rpc(node.rpcUrl,'ieum_nodeStatus')).result;
      await query(`INSERT INTO discovered_nodes(node_id,name,rpc_url,version,height,peer_count,online,raw,last_seen_at)
        VALUES($1,$2,$3,$4,$5,$6,true,$7,now()) ON CONFLICT(node_id) DO UPDATE SET name=EXCLUDED.name,rpc_url=EXCLUDED.rpc_url,
        version=EXCLUDED.version,height=EXCLUDED.height,peer_count=EXCLUDED.peer_count,online=true,raw=EXCLUDED.raw,last_seen_at=now()`,
        [node.id,node.name,node.rpcUrl,status.version,status.height,status.peers,status]);
      try {
        const peers=(await rpc(node.rpcUrl,'ieum_peerInfo')).result;
        for (const peer of peers||[]) await query(`INSERT INTO discovered_nodes(node_id,name,p2p_address,version,height,peer_count,online,source_node_id,raw,last_seen_at)
          VALUES($1,$2,$3,$4,$5,$6,true,$7,$8,now()) ON CONFLICT(node_id) DO UPDATE SET p2p_address=EXCLUDED.p2p_address,version=EXCLUDED.version,
          height=EXCLUDED.height,peer_count=EXCLUDED.peer_count,online=true,source_node_id=EXCLUDED.source_node_id,raw=EXCLUDED.raw,last_seen_at=now()`,
          [peer.nodeId,peer.name||peer.nodeId,peer.address,peer.version,peer.height,peer.peerCount,node.id,peer]);
      } catch {}
    } catch { await query('UPDATE discovered_nodes SET online=false WHERE node_id=$1',[node.id]); }
  }
  const state=await query("SELECT value FROM explorer_state WHERE key='last_height'");
  let next=state.rows.length?Number(state.rows[0].value)+1:0;
  while (next<=tip && !stopping) { await indexBlock(url,next++); }
  await refreshBalances(url);
}

process.on('SIGTERM',()=>{stopping=true}); process.on('SIGINT',()=>{stopping=true});
while (!stopping) { try { await cycle(); } catch (error) { console.error(new Date().toISOString(),error.message); }
  await new Promise(resolve=>setTimeout(resolve,interval)); }
await pool.end();
