let rpcId = 0;

export function hexToBigInt(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('invalid hex quantity');
  return BigInt(value);
}

export async function rpc(url, method, params = [], timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, {method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,
      body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params})});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || `RPC ${body.error.code}`);
    return {result:body.result,latencyMs:Math.round(performance.now()-started)};
  } finally { clearTimeout(timer); }
}

export const toNumber = value => Number(hexToBigInt(value));
