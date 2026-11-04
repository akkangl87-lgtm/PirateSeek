#!/usr/bin/env node
import { CircuitBreaker, classifyUpstreamError, ConcurrencyGate } from "./reliability.js";

const [command = "help", ...args] = process.argv.slice(2);
const version = "0.1.0";

function help() {
  console.log(`PirateSeek ${version} — reliability-first AI gateway (early development)

Usage:
  npm start -- help
  npm start -- version
  npm start -- doctor

Commands:
  help      Show command summary
  version   Print version
  doctor    Check local runtime configuration

Current stage: CLI foundation. Gateway/provider transport is not wired yet.`);
}

if (command === "help" || command === "--help" || command === "-h") help();
else if (command === "version" || command === "--version") console.log(version);
else if (command === "doctor") {
  const host = process.env.PIRATESEEK_HOST ?? "127.0.0.1";
  const port = Number(process.env.PIRATESEEK_PORT ?? 9766);
  const maxConcurrent = Number(process.env.PIRATESEEK_MAX_CONCURRENT ?? 4);
  const issues = [];
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push("PIRATESEEK_PORT must be 1..65535");
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 256) issues.push("PIRATESEEK_MAX_CONCURRENT must be 1..256");
  if (host !== "127.0.0.1" && host !== "::1" && !process.env.PIRATESEEK_API_KEY) {
    issues.push("Non-loopback bind requires PIRATESEEK_API_KEY before server implementation.");
  }
  // Smoke-check foundational components so doctor catches broken runtime installs.
  const gate = new ConcurrencyGate(Math.max(1, Number.isInteger(maxConcurrent) ? maxConcurrent : 1));
  const breaker = new CircuitBreaker();
  const sample = classifyUpstreamError({status:401,message:"PoW challenge"});
  console.log("PirateSeek doctor");
  console.log(`Node: ${process.version} (required >=20)`);
  console.log(`Bind: ${host}:${Number.isFinite(port) ? port : "invalid"}`);
  console.log(`Concurrency cap: ${gate.stats.limit}`);
  console.log(`Circuit breaker: ${breaker.state}`);
  console.log(`PoW challenge classification: ${sample.kind} (retryable=${sample.retryable})`);
  if (issues.length) { console.error("\nIssues:\n- " + issues.join("\n- ")); process.exitCode = 1; }
  else console.log("\nConfiguration checks passed. Gateway transport is not implemented yet.");
} else {
  console.error(`Unknown command: ${args[0] ?? command}\n`);
  help(); process.exitCode = 2;
}
