import test from "node:test";
import assert from "node:assert/strict";
import { classifyUpstreamError, CircuitBreaker, ConcurrencyGate } from "../src/reliability.js";

test("distinguishes DeepSeek PoW/auth challenge from retryable faults", () => {
  assert.deepEqual(classifyUpstreamError({status:401,message:"PoW challenge invalid token"}), {
    kind:"auth_challenge", retryable:false, action:"reauthenticate"
  });
  assert.equal(classifyUpstreamError({status:401,message:"Unauthorized"}).retryable, false);
  assert.equal(classifyUpstreamError({status:503}).retryable, true);
  assert.equal(classifyUpstreamError({status:400}).retryable, false);
});

test("rate-limit delay is bounded and honors usable Retry-After", () => {
  assert.equal(classifyUpstreamError({status:429,retryAfterSeconds:2}).retryAfterMs, 2000);
  assert.equal(classifyUpstreamError({status:429,retryAfterSeconds:99999}).retryAfterMs, 3600000);
});

test("circuit breaker opens, permits probe after cooldown, and resets on success", () => {
  let now = 100;
  const cb = new CircuitBreaker({threshold:2,cooldownMs:500,now:()=>now});
  cb.failure(); assert.equal(cb.state,"closed");
  cb.failure(); assert.equal(cb.state,"open"); assert.equal(cb.canRequest(),false);
  now += 500; assert.equal(cb.state,"half-open"); assert.equal(cb.canRequest(),true);
  cb.success(); assert.equal(cb.state,"closed");
});

test("concurrency gate enforces cap and hands off FIFO slot", async () => {
  const gate = new ConcurrencyGate(1);
  const releaseA = await gate.acquire();
  let acquiredB = false;
  const b = gate.acquire().then(release => { acquiredB=true; return release; });
  await Promise.resolve();
  assert.equal(acquiredB,false);
  releaseA();
  const releaseB = await b;
  assert.equal(acquiredB,true);
  releaseB(); releaseB();
  assert.deepEqual(gate.stats,{active:0,queued:0,limit:1});
});
