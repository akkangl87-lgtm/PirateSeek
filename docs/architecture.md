# Architecture Research and Decisions

Status: initial synthesis, not a source-code audit. Re-check upstream repositories at implementation milestones.

## Reference projects

- [ForgetMeAI/FreeDeepseekAPI](https://github.com/ForgetMeAI/FreeDeepseekAPI)
- [dekrezz/FreeDeepseekAPI](https://github.com/dekrezz/FreeDeepseekAPI)

Useful patterns include compatible API surfaces, login/session lifecycle, account selection, cooldowns, failover, diagnostics, and session affinity. Review current implementations and licenses before reuse. PirateSeek starts with independently written primitives.

## Adopt

1. **Provider isolation:** adapters own wire details and normalize errors.
2. **Session affinity:** retain a preferred route while healthy; record transitions.
3. **Account scheduling:** select only eligible accounts under concurrency/cooldown limits.
4. **Cause-aware cooldowns:** auth challenge needs operator remediation; 429 needs bounded cooldown; transient errors may get bounded retries.
5. **Inspectable diagnostics:** redact credentials, cookies, prompts and sensitive headers.
6. **Compatibility contracts:** fixture tests for requests, responses, errors, and streams.

## Avoid

- Treating every 401 as expired credentials.
- Retrying PoW challenges indefinitely.
- Claiming upstream session continuity after moving accounts.
- Pooling accounts to bypass provider limits or terms.
- Exposing an unauthenticated management interface.
- Persisting raw prompts or secrets for convenience.

## Modules

| Module | Responsibility |
|---|---|
| CLI | parsing, config validation, diagnostics |
| Gateway | local HTTP lifecycle, auth, validation |
| Router | policy and provider selection |
| Reliability | deadlines, concurrency, circuits, retry budget |
| Session manager | local identity, affinity, recovery metadata |
| Adapters | upstream protocol and error translation |
| Telemetry | redacted events and aggregate metrics |

## Request lifecycle

1. Validate payload size, model/policy, and caller auth.
2. Allocate request ID; enforce global and per-provider limits.
3. Resolve session affinity and eligible routes.
4. Execute with deadline and cancellation.
5. Classify errors; retry only when safe and within budget.
6. Fail over only when replay is safe and policy permits.
7. Emit redacted telemetry and update provider health.

Streaming is special: once downstream bytes are committed, transparent restart can corrupt the result. Explicitly terminate with a useful error rather than stitch generations.

## Identity boundaries

Keep distinct caller session ID, route affinity, provider account reference, and upstream conversation ID. Upstream IDs may be account-bound. Failover can mean starting a fresh upstream conversation and replaying allowed transcript content. Define retention, deletion, caps and redaction first.

## Security baseline

- Loopback by default; explicit API authentication for non-loopback.
- Never log auth headers, cookies, auth dumps, prompts, or challenge tokens.
- Secret files outside repository with restrictive permissions.
- Bound body size, queue, deadlines, retries, and session retention.
- No automatic login or challenge solving.
- Follow service rules and entitlements; no quota-bypass design.

## Initial error policy

| Condition | Default |
|---|---|
| 401 with PoW/challenge hints | stop; report re-auth/check needed |
| 401/403 | mark route unhealthy; operator action |
| 429 | cap Retry-After and apply cooldown |
| timeout/network | bounded retry if safe |
| 5xx | bounded retry subject to budget |
| validation 4xx | surface immediately |

The current reliability module is only a foundation, not a finished routing policy.

## Research tasks

- Inspect authentication/session renewal in both references.
- Verify license and attribution requirements before adapting code.
- Record decisions for secrets, retries, and session retention.
