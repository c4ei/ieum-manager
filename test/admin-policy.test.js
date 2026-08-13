import test from 'node:test';import assert from 'node:assert/strict';import {applyPolicy} from '../lib/admin-policy.js';
test('admin policy blocks and prioritizes Manager RPC sources',()=>{const nodes=applyPolicy([{id:'a'},{id:'b'}],{nodes:{a:{blocked:true,priority:10},b:{priority:90}}});assert.equal(nodes[0].id,'b');assert.equal(nodes[1].admin.blocked,true);});
test('admin priority is clamped',()=>{const [node]=applyPolicy([{id:'a'}],{nodes:{a:{priority:999}}});assert.equal(node.admin.priority,100);});
