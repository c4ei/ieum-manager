import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {jwtAdmin,jwtUser} from '../lib/admin-auth.js';

const secret='same-aah-and-ieum-jwt-secret-for-tests';
const request=token=>({headers:{cookie:`theme=dark; token=${encodeURIComponent(token)}; language=ko`}});

test('AAH admin JWT cookie authenticates without an admin token',()=>{const token=jwt.sign({userType:'A',email:'admin@example.test',username:'admin'},secret,{expiresIn:'5m'}),user=jwtAdmin(request(token),secret);assert.equal(user.email,'admin@example.test');assert.equal(user.userType,'A');});
test('JWT authentication rejects a normal user, wrong secret, expired token and malformed cookie',()=>{const normal=jwt.sign({userType:'U'},secret,{expiresIn:'5m'}),expired=jwt.sign({userType:'A'},secret,{expiresIn:-1});assert.equal(jwtAdmin(request(normal),secret),null);assert.equal(jwtAdmin(request(normal),'different-secret'),null);assert.equal(jwtAdmin(request(expired),secret),null);assert.equal(jwtAdmin(request('not-a-jwt'),secret),null);assert.equal(jwtUser(request(normal),secret).userType,'U');});
