# PirateSeek

**A reliability-first, local AI gateway with a CLI-first workflow.**

## Ask DeepSeek from the CLI

PirateSeek uses your local FreeDeepseekAPI as the primary provider and the official DeepSeek API as an optional backup.

1. Start your own FreeDeepseekAPI service and make sure its health endpoint responds at `http://127.0.0.1:9655/health`.
2. Install Node.js 20+.
3. Set optional proxy auth and official backup key in environment (never commit secrets).
4. Ask:

```sh
npm start -- ask "Привет! Объясни, как работает Python"
```

The result prints which provider answered. To enable fallback, set `DEEPSEEK_API_KEY`; official API usage may incur charges. See [DeepSeek API docs](https://api-docs.deepseek.com/api_samples/chat_curl/).

Configuration variables are listed in [`.env.example`](.env.example). Node does not load `.env` automatically in this version: export variables in your shell or use Node's supported env-file option, for example `node --env-file=.env src/cli.js ask "Hi"`.

## Provider behavior

- Primary: local FreeDeepseekAPI `POST /v1/chat/completions` (default model alias `deepseek-chat`).
- Backup: official `https://api.deepseek.com/v1/chat/completions`, only when `DEEPSEEK_API_KEY` is configured.
- Fallback happens for network errors, timeouts, HTTP 408/429, or HTTP 5xx. Authentication and request errors are surfaced, not retried or redirected.
- Requests are non-streaming and stateless from PirateSeek's point of view. Conversation/session management and streaming are not implemented.
- Fallback may send the same prompt to a different provider. Do not use this for sensitive prompts unless you accept that data flow.

FreeDeepseekAPI is an experimental proxy over DeepSeek Web's undocumented interface. It can break when upstream changes. Review its documentation and applicable service terms before use. Do not expose the local proxy to the public internet without authentication.

## Requirements and checks

- Node.js 20+
- No third-party runtime dependencies

```sh
npm run check
npm start -- help
npm start -- doctor
npm start -- version
```

## Project stage

Implemented: CLI `help/version/doctor/ask`, FreeDeepseekAPI adapter, optional official API fallback, reliability primitives, CI workflow.

Not yet implemented: local HTTP gateway, provider routing policies, durable sessions, streaming, cancellation, conformance/live-provider tests.

## Principles

- Diagnose before retrying. Authentication and challenge errors are not blindly retried.
- Bound concurrency, queueing, retry counts, and delays.
- Keep secrets local. Never commit cookies, auth dumps, tokens, or sensitive logs.
- Preserve truthful session semantics: seamless upstream continuity is not assumed.
- Respect provider terms, quotas, and anti-abuse controls.

## Architecture

```text
CLI ask
  └─ FreeDeepseekAPI adapter (local OpenAI-compatible endpoint)
       └─ optional fallback: official DeepSeek API
```

See [docs/architecture.md](docs/architecture.md).

## License

MIT. See [LICENSE](LICENSE).
