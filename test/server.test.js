import test from 'node:test';import assert from 'node:assert/strict';
process.env.IEUM_MANAGER_CONFIG=new URL('../config.example.json',import.meta.url).pathname;
process.env.IEUM_MANAGER_PORT='0';
const {hexToBigInt,formatUnits}=await import('../server.js');
test('hex quantity parser',()=>assert.equal(hexToBigInt('0x2a'),42n));
test('unit formatter',()=>assert.equal(formatUnits(1234500000000000000n,18),'1.2345'));
