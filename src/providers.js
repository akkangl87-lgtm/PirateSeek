const timeoutMs = 90_000;

async function postChat({baseUrl, apiKey, model, message}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? {authorization: `Bearer ${apiKey}`} : {})
      },
      body: JSON.stringify({
        model,
        messages: [{role: "user", content: message}],
        stream: false
      }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || body?.message || `Upstream returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const answer = body?.choices?.[0]?.message?.content;
    if (typeof answer !== "string") throw new Error("Upstream returned no choices[0].message.content");
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Local FreeDeepseekAPI first; official DeepSeek is a configured backup.
 * Only availability/rate/server failures trigger fallback; auth and request
 * errors surface without sending the prompt to another provider.
 */
export async function ask(message, env = process.env) {
  const localBase = env.PIRATESEEK_FREEDEEPSEEK_BASE_URL || "http://127.0.0.1:9655";
  const localKey = env.PIRATESEEK_FREEDEEPSEEK_API_KEY || "";
  const localModel = env.PIRATESEEK_FREEDEEPSEEK_MODEL || "deepseek-chat";
  try {
    const answer = await postChat({baseUrl:localBase, apiKey:localKey, model:localModel, message});
    return {answer, provider:"freedeepseek"};
  } catch (error) {
    const status = Number(error?.status);
    const shouldFallback = !status || status === 408 || status === 429 || status >= 500;
    if (!shouldFallback) throw error;
    const backupKey = env.DEEPSEEK_API_KEY;
    if (!backupKey) {
      const hint = new Error(`FreeDeepseekAPI unavailable (${error.message}). Set DEEPSEEK_API_KEY to enable official fallback.`);
      hint.cause = error;
      throw hint;
    }
    try {
      const answer = await postChat({
        baseUrl: env.PIRATESEEK_OFFICIAL_BASE_URL || "https://api.deepseek.com",
        apiKey: backupKey,
        model: env.PIRATESEEK_OFFICIAL_MODEL || "deepseek-chat",
        message
      });
      return {answer, provider:"deepseek-official"};
    } catch (backupError) {
      backupError.message = `FreeDeepseekAPI failed (${error.message}); official fallback failed (${backupError.message})`;
      throw backupError;
    }
  }
}
