import test from 'node:test';
import assert from 'node:assert/strict';
import {callRpc} from '../src/server/database.ts';

test('successful empty RPC responses do not turn a completed password change into an error',async(t)=>{
 process.env.SUPABASE_URL='http://localhost:55434';process.env.SUPABASE_SECRET_KEY='synthetic-key';
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:204}));
 assert.equal(await callRpc<void>('change_account_password',{}),undefined);
 assert.equal(await callRpc<void>('revoke_account_session',{}),undefined);
});
