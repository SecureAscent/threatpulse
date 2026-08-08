import axios, { AxiosRequestConfig } from 'axios';

/** Shared axios instance with sane defaults for feed collection. */
export const http = axios.create({
  timeout: 30_000,
  maxContentLength: 100 * 1024 * 1024, // 100 MB (KEV/NVD payloads can be large)
  maxRedirects: 5,
  headers: {
    'User-Agent':
      'ThreatPulse-Collector/1.0 (+https://github.com/SecureAscent/threatpulse)',
    Accept: 'application/json, application/xml, text/xml, */*',
  },
});

/** GET with a small retry/backoff for transient failures and rate limits. */
export async function getWithRetry<T = unknown>(
  url: string,
  config: AxiosRequestConfig = {},
  retries = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await http.get<T>(url, config);
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      // Log the response body for non-transient errors to aid debugging.
      if (axios.isAxiosError(err) && err.response) {
        const body = typeof err.response.data === 'string'
          ? err.response.data.slice(0, 500)
          : JSON.stringify(err.response.data)?.slice(0, 500);
        console.error(
          `[http] ${err.config?.method?.toUpperCase() || 'GET'} ${err.config?.url} → ${status}: ${body || '(empty body)'}`,
        );
      }

      // Back off harder on rate limiting.
      const wait = status === 429 ? 5000 * (attempt + 1) : 1500 * (attempt + 1);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}