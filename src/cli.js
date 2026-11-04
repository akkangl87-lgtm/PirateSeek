#!/usr/bin/env node
import { CircuitBreaker, classifyUpstreamError, ConcurrencyGate } from "./reliability.js";
import { ask } from "./providers.js";

const [command = "help", ...args] = process.argv.slice(2);
const version = "0.2.0";

function help() {
  console.log(`PirateSeek ${version} — reliability-first AI gateway (early development)

Usage:
  npm start -- help
  npm start -- version
  npm start -- doctor
  npm start -- ask "Your question"

Commands:
  help      Show command summary
  version   Print version
  doctor    Check local runtime configuration
  ask       Ask DeepSeek (FreeDeepseekAPI first; official API as backup)

Provider configuration is read from environment variables. See .env.example.`);
}

if (command === "help" || command === "--help" || command === "-h") help();
else if (command === "version" || command === "--version") console.log(version);
else if (command === "ask") {
  const message = args.join(" ").trim();
  if (!message) {
    console.error('Usage: npm start -- ask "Your question"');
    process.exitCode = 2;
  } else {
    try {
      const result = await ask(message);
      console.log(`[provider: ${result.provider}]\n\n${result.answer}`);
    } catch (error) {
      console.error(`PirateSeek: ${error.message}`);
      process.exitCode = 1;
    }
  }
} else if (command === "doctor") {
  const host = process.env.PIRATESEEK_HOST ?? "127.0.0.1";
  const port = Number(process.env.PIRATESEEK_PORT ?? 9766);
  const maxConcurrent = Number(process.env.PIRATESEEK_MAX_CONCURRENT ?? 4);
  const issues = [];
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push("PIRATESEEK_PORT must be 1..65535");
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 256) issues.push("PIRATESEEK_MAX_CONCURRENT must be 1..256");
  if (host !== "127.0.0.1" && host !== "::1" && !process.env.PIRATESEEK_API_KEY) {
    issues.push("Non-loopback bind requires PIRATESEEK_API_KEY before server implementation.");
  }
  const gate = new ConcurrencyGate(Math.max(1, Number.isInteger(maxConcurrent) ? maxConcurrent : 1));
  const breaker = new CircuitBreaker();
  const sample = classifyUpstreamError({status:401,message:"PoW challenge"});
  console.log("PirateSeek doctor");
  console.log(`Node: ${process.version} (required >=20)`);
  console.log(`Bind: ${host}:${Number.isFinite(port) ? port : "invalid"}`);
  console.log(`Concurrency cap: ${gate.stats.limit}`);
  console.log(`Circuit breaker: ${breaker.state}`);
  console.log(`PoW challenge classification: ${sample.kind} (retryable=${sample.retryable})`);
  console.log(`FreeDeepseekAPI: ${process.env.PIRATESEEK_FREEDEEPSEEK_BASE_URL || "http://127.0.0.1:9655"}`);
  console.log(`Official backup: ${process.env.DEEPSEEK_API_KEY ? "configured" : "not configured"}`);
  if (issues.length) { console.error("\nIssues:\n- " + issues.join("\n- ")); process.exitCode = 1; }
  else console.log("\nConfiguration checks passed.");
} else {
  console.error(`Unknown command: ${args[0] ?? command}\n`);
  help(); process.exitCode = 2;
}
