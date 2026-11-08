// Frankfurter publishes reference rates for working days. Never silently
// substitute a made-up rate when the provider cannot be reached.
const RATE_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD";
const CACHE_MS = 12 * 60 * 60 * 1000;
const MAX_RATE_AGE_MS = 5 * 24 * 60 * 60 * 1000;
let cached = null;
let inFlight = null;

export const getUsdToAudRate = async () => {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  if (!inFlight) {
    inFlight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(RATE_URL, { signal: controller.signal });
        if (!response.ok) throw new Error("Exchange-rate service unavailable");
        const data = await response.json();
        const rate = Number(data?.rates?.AUD);
        const date = String(data?.date || "");
        const publishedAt = Date.parse(`${date}T00:00:00Z`);
        if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(publishedAt) ||
            publishedAt > Date.now() || Date.now() - publishedAt > MAX_RATE_AGE_MS) {
          throw new Error("Exchange-rate data is invalid or stale");
        }
        cached = { rate, date, source: "Frankfurter", fetchedAt: Date.now() };
        return cached;
      } finally { clearTimeout(timeout); }
    })().finally(() => { inFlight = null; });
  }
  try { return await inFlight; }
  catch (error) {
    if (cached && Date.now() - Date.parse(`${cached.date}T00:00:00Z`) < MAX_RATE_AGE_MS) return cached;
    throw error;
  }
};
