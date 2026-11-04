const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Categorize errors before retrying. A 401 PoW challenge is not assumed to be
 * a transient network failure: callers should validate/re-authenticate instead.
 */
export function classifyUpstreamError(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const message = String(error?.message ?? error ?? "");
  if (status === 401 && /pow|challenge|invalid token/i.test(message)) {
    return { kind: "auth_challenge", retryable: false, action: "reauthenticate" };
  }
  if (status === 401 || status === 403) {
    return { kind: "authentication", retryable: false, action: "check_credentials" };
  }
  if (status === 429) {
    const retryAfter = Number(error?.retryAfterSeconds);
    return {
      kind: "rate_limit",
      retryable: true,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0
        ? clamp(retryAfter * 1000, 250, 3_600_000) : 30_000,
      action: "cooldown_account"
    };
  }
  if (status === 408 || status === 504 || /timeout|timed out/i.test(message)) {
    return { kind: "timeout", retryable: true, action: "bounded_retry" };
  }
  if (status >= 500 && status <= 599) {
    return { kind: "upstream_server", retryable: true, action: "bounded_retry" };
  }
  if (!status) return { kind: "network", retryable: true, action: "bounded_retry" };
  return { kind: "request_or_provider_error", retryable: false, action: "surface_error" };
}

/** Small in-memory circuit breaker; persistence and routing policy are layered above. */
export class CircuitBreaker {
  #failures = 0;
  #openedAt = 0;
  constructor({ threshold = 3, cooldownMs = 30_000, now = Date.now } = {}) {
    this.threshold = Math.max(1, threshold);
    this.cooldownMs = Math.max(0, cooldownMs);
    this.now = now;
  }
  get state() {
    if (!this.#openedAt) return "closed";
    if (this.now() - this.#openedAt >= this.cooldownMs) return "half-open";
    return "open";
  }
  canRequest() { return this.state !== "open"; }
  success() { this.#failures = 0; this.#openedAt = 0; }
  failure() {
    this.#failures += 1;
    if (this.#failures >= this.threshold && !this.#openedAt) this.#openedAt = this.now();
  }
  snapshot() { return { state: this.state, failures: this.#failures }; }
}

/** Fair FIFO concurrency gate. Releasing is idempotent. */
export class ConcurrencyGate {
  #active = 0;
  #queue = [];
  constructor(limit = 4) {
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError("limit must be a positive integer");
    this.limit = limit;
  }
  get stats() { return { active: this.#active, queued: this.#queue.length, limit: this.limit }; }
  async acquire({ signal } = {}) {
    if (signal?.aborted) throw signal.reason ?? new Error("Aborted");
    if (this.#active < this.limit && this.#queue.length === 0) {
      this.#active++;
      return this.#releaseOnce();
    }
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, signal, onAbort: null };
      entry.onAbort = () => {
        this.#queue = this.#queue.filter(item => item !== entry);
        reject(signal.reason ?? new Error("Aborted"));
      };
      signal?.addEventListener("abort", entry.onAbort, { once: true });
      this.#queue.push(entry);
    });
  }
  #releaseOnce() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#active--;
      while (this.#queue.length) {
        const next = this.#queue.shift();
        next.signal?.removeEventListener("abort", next.onAbort);
        if (next.signal?.aborted) { next.reject(next.signal.reason ?? new Error("Aborted")); continue; }
        this.#active++;
        next.resolve(this.#releaseOnce());
        break;
      }
    };
  }
}
