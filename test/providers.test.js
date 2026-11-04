import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ask } from "../src/providers.js";

async function mockApi(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const {port} = server.address();
  return {url:`http://127.0.0.1:${port}`, close:()=>new Promise(resolve=>server.close(resolve))};
}
function ok(res, text) {
  res.writeHead(200, {"content-type":"application/json"});
  res.end(JSON.stringify({choices:[{message:{content:text}}]}));
}

test("asks the local FreeDeepseekAPI first", async t => {
  let captured;
  const local = await mockApi(async (req,res) => {
    captured = {url:req.url, auth:req.headers.authorization, body:JSON.parse(await new Promise(resolve=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>resolve(s));}))};
    ok(res,"Привет из локального прокси");
  });
  t.after(local.close);
  const result = await ask("Привет",{PIRATESEEK_FREEDEEPSEEK_BASE_URL:local.url,PIRATESEEK_FREEDEEPSEEK_API_KEY:"local-secret"});
  assert.equal(result.provider,"freedeepseek");
  assert.equal(result.answer,"Привет из локального прокси");
  assert.equal(captured.url,"/v1/chat/completions");
  assert.equal(captured.auth,"Bearer local-secret");
  assert.equal(captured.body.messages[0].content,"Привет");
});

test("falls back to official endpoint on primary server failure", async t => {
  const local = await mockApi((_req,res)=>{res.writeHead(503);res.end("unavailable");});
  const official = await mockApi((_req,res)=>ok(res,"Official backup"));
  t.after(local.close); t.after(official.close);
  const result = await ask("Question",{
    PIRATESEEK_FREEDEEPSEEK_BASE_URL:local.url,
    DEEPSEEK_API_KEY:"official-secret",
    PIRATESEEK_OFFICIAL_BASE_URL:official.url
  });
  assert.equal(result.provider,"deepseek-official");
  assert.equal(result.answer,"Official backup");
});

test("does not fallback on primary auth failure", async t => {
  const local = await mockApi((_req,res)=>{res.writeHead(401,{"content-type":"application/json"});res.end(JSON.stringify({error:{message:"unauthorized"}}));});
  t.after(local.close);
  await assert.rejects(ask("Question",{PIRATESEEK_FREEDEEPSEEK_BASE_URL:local.url,DEEPSEEK_API_KEY:"backup"}),/unauthorized/);
});
