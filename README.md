# PirateSeek

**A reliability-first, local AI gateway with a CLI-first workflow.**

PirateSeek routes requests across configured AI providers while making failures observable and recoverable. Initial development prioritizes a predictable CLI, safe defaults, bounded concurrency, explicit error classification, and testable reliability primitives.

> **Status: early foundation.** CLI and reliability primitives exist. HTTP gateway, provider adapters, durable sessions, and account routing are not implemented yet.

## Requirements and quick start

- Node.js 20+
- No third-party runtime dependencies in the current foundation

```sh
npm test
npm start -- help
npm start -- doctor
npm start -- version
```

## Principles

- **Diagnose before retrying.** Authentication and PoW challenges are not blindly retried.
- **Bound load.** Concurrency, queueing, retry counts, and delays must be finite.
- **Keep secrets local.** Never commit provider cookies, auth dumps, tokens, or sensitive logs.
- **Make routing explicit.** Policies and endpoint names should be inspectable.
- **Preserve truthful session semantics.** Failover may require a new upstream session and transcript replay; seamless continuity is not assumed.
- **Provider boundaries.** Normalize errors without hiding upstream causes.
- **Compatibility by tests.** Target OpenAI-compatible API behavior first.

## Roadmap

1. **Foundation (current):** CLI, doctor, error taxonomy, concurrency gate, circuit breaker.
2. **Gateway core:** loopback HTTP listener, authentication, request IDs and redacted logs.
3. **Provider contract:** adapter interface and first configured upstream.
4. **Routing:** endpoint policies, provider health, account selection, cooldowns and bounded failover.
5. **Session durability:** local state, affinity, replay policy, cancellation and crash-safe writes.
6. **Compatibility:** OpenAI-compatible chat, streaming, CLI diagnostics and conformance tests.
7. **Hardening:** security review, load tests, docs and release automation.

## Planned CLI

- `doctor` — configuration/runtime checks
- `serve` — start local gateway
- `providers list|check` — inspect providers
- `routes list` — inspect routing policies
- `sessions list|inspect` — inspect local session metadata
- `status` — health, queue and circuit states

Not all commands are implemented.

## Configuration and security

See [`.env.example`](.env.example). Default bind is loopback. Remote binding must require explicit authentication and security guidance.

Supply provider credentials using a supported secret mechanism, not committed config. Use only provider access you are authorized to use and respect service terms, quotas, and anti-abuse controls. Diagnostics must redact tokens, cookies, prompts, and sensitive headers.

## Architecture

```text
CLI
 ├─ Config & secret references
 ├─ Local gateway (future)
 │   ├─ Auth / request limits
 │   ├─ Session manager
 │   └─ Router
 │       ├─ Health & circuit policy
 │       ├─ Concurrency / cooldowns
 │       └─ Provider adapters
 └─ Doctor / diagnostics
```

See [docs/architecture.md](docs/architecture.md) for reference-project synthesis and design decisions.

## Development

```sh
npm run check
```

Use deterministic tests with fake upstreams and injectable clocks, not live provider credentials.

## Security reports

Do not publish credentials, cookies, PoW material, or unredacted request transcripts in issues.

## License

MIT. See [LICENSE](LICENSE).
