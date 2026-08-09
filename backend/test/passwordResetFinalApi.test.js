'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const test=require('node:test');
const {createApp}=require('../src/server');
const {User}=require('../src/models/User');
const {Session}=require('../src/models/Session');
const {PasswordResetChallenge}=require('../src/models/PasswordResetChallenge');
const authService=require('../src/services/authService');
const resetService=require('../src/services/passwordResetService');
const auditService=require('../src/services/auditService');

function Q(v){const p=Promise.resolve(v);p.select=async()=>v;return p;}
function R(server,body){return new Promise((resolve,reject)=>{const req=http.request({method:'POST',hostname:'127.0.0.1',port:server.address().port,path:'/api/v1/auth/password/reset',headers:{Accept:'application/json','Content-Type':'application/json'}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(raw)}));});req.on('error',reject);req.write(JSON.stringify(body));req.end();});}
async function S(t){const app=createApp({allowedOrigins:['*'],production:false});const server=await new Promise(r=>{const x=app.listen(0,()=>r(x));});t.after(()=>new Promise(r=>server.close(r)));return server;}

test('final reset rejects administratively locked account',async t=>{
  const challenge={challengeId:'PRC-20260809-0001',userId:'MU-0001',status:'VERIFIED'};
  const user={userId:'MU-0001',organisationId:'ORG-TEST',accountStatus:'LOCKED',lockedUntil:null};
  t.mock.method(PasswordResetChallenge,'findOne',()=>Q(challenge));
  t.mock.method(resetService,'verifyPasswordResetToken',()=>true);
  t.mock.method(User,'findOne',()=>Q(user));
  const server=await S(t);
  const r=await R(server,{organisationId:'ORG-TEST',challengeId:challenge.challengeId,resetToken:'token',newPassword:'NewSecurePass1!'});
  assert.equal(r.status,400);
  assert.equal(r.body.error.code,'PASSWORD_RESET_INVALID');
});

test('final reset consumes challenge, updates credentials, revokes sessions and audits',async t=>{
  const oldHash=await authService.hashPassword('CurrentPass1!');
  const challenge={challengeId:'PRC-20260809-0002',userId:'MU-0001',status:'VERIFIED'};
  const user={userId:'MU-0001',organisationId:'ORG-TEST',accountStatus:'ACTIVE',lockedUntil:null,failedLoginAttempts:3,mustChangePassword:true,passwordHash:oldHash,sessionVersion:2,save:async()=>user};
  let consumeFilter=null,revokeArgs=null,auditPayload=null,invalidation=null;
  const session={revoke:async args=>{revokeArgs=args;return session;}};
  t.mock.method(PasswordResetChallenge,'findOne',()=>Q(challenge));
  t.mock.method(resetService,'verifyPasswordResetToken',()=>true);
  t.mock.method(User,'findOne',()=>Q(user));
  t.mock.method(PasswordResetChallenge,'findOneAndUpdate',async filter=>{consumeFilter=filter;return {...challenge,status:'CONSUMED'};});
  t.mock.method(PasswordResetChallenge,'updateMany',async (filter,update)=>{invalidation={filter,update};return {modifiedCount:0};});
  t.mock.method(Session,'find',()=>({select:async()=>[session]}));
  t.mock.method(auditService,'recordAuditEvent',async payload=>{auditPayload=payload;return {};});
  const server=await S(t);
  const r=await R(server,{organisationId:'org-test',challengeId:challenge.challengeId.toLowerCase(),resetToken:'token',newPassword:'NewSecurePass1!'});
  assert.equal(r.status,200);
  assert.equal(r.body.data.requiresLogin,true);
  assert.equal(r.body.data.revokedSessionCount,1);
  assert.deepEqual(consumeFilter,{organisationId:'ORG-TEST',challengeId:challenge.challengeId,status:'VERIFIED'});
  assert.equal(await authService.verifyPassword('NewSecurePass1!',user.passwordHash),true);
  assert.equal(user.mustChangePassword,false);
  assert.ok(user.passwordChangedAt instanceof Date);
  assert.ok(user.lastPasswordResetAt instanceof Date);
  assert.equal(user.failedLoginAttempts,0);
  assert.equal(user.lockedUntil,null);
  assert.equal(user.sessionVersion,3);
  assert.equal(user.updatedBy,'SYSTEM');
  assert.equal(revokeArgs.reason,'PASSWORD_RESET');
  assert.equal(revokeArgs.revokedBy,'SYSTEM');
  assert.equal(auditPayload.actorRole,'SYSTEM');
  assert.equal(auditPayload.action,'PASSWORD_RESET');
  assert.equal(JSON.stringify(auditPayload).includes('token'),false);
  assert.equal(invalidation.filter.userId,user.userId);
});
