# Port Packet #02 — BleepingComputer Ingestion via Gemini API

Source-of-truth spec for porting the BleepingComputer feed ingestion fix from the
ThreatPulse SaaS builder into the self-hosted Docker stack.

## Problem

BleepingComputer.com is behind Cloudflare, which blocks all datacenter IPs with
403/520 errors. Every approach tried from the SaaS backend failed:

| Approach | Result |
|----------|--------|
| Direct BC RSS (`bleepingcomputer.com/feed/`) | Cloudflare 403 |
| Google News RSS (`news.google.com/rss/search?q=site:bleepingcomputer.com`) | Google 503 (datacenter IP block) |
| allorigins.win proxy | 520 (Cloudflare on allorigins blocks datacenter) |
| corsproxy.io / codetabs / thingproxy | Blocked, down, or domain expired |
| Chrome User-Agent spoofing | Doesn't help — blocks are IP-based, not UA-based |

## Solution

Use an LLM with web search to fetch recent BleepingComputer article metadata.
The LLM's web search runs on Google's infrastructure (residential IPs), bypassing
Cloudflare's datacenter IP blocks.

- **SaaS implementation**: `base44.asServiceRole.integrations.Core.InvokeLLM()` with
  `model: 'gemini_3_flash'` and `add_context_from_internet: true`.
- **Docker stack equivalent**: Direct Gemini API call with `google_search` grounding tool.
  Same prompt, same JSON schema — just a different HTTP client.

## Required Environment Variable

```
GEMINI_API_KEY=<your Google AI Studio API key>
```

Get a free key at https://aistudio.google.com/apikey — the free tier supports
Google Search grounding on `gemini-2.0-flash`.

## Backend Implementation (Docker stack)

Drop this function into your ingestion service (e.g. `src/services/feedIngestion.ts`
or wherever `ingestFeeds` lives in the Docker stack). It replaces the SaaS version
that uses `base44.asServiceRole.integrations.Core.InvokeLLM`.

```typescript
/**
 * Fetches recent BleepingComputer articles via Gemini API with Google Search
 * grounding. BleepingComputer is behind Cloudflare which blocks datacenter IPs,
 * so direct RSS fetching fails. The LLM's web search runs on Google's infra and
 * bypasses the block.
 *
 * Docker-stack equivalent of the SaaS `fetchBleepingComputerViaLLM` function
 * which uses `base44.asServiceRole.integrations.Core.InvokeLLM`.
 */
export async function fetchBleepingComputerViaGemini(
  limit: number = 5
): Promise<ThreatCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const prompt = `List the ${limit} most recent news articles published on BleepingComputer.com. For each article provide the exact title, a concise 1-2 sentence summary, the full article URL (https://www.bleepingcomputer.com/...), and the publication date. Return only real current articles — do not fabricate content.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string" },
                  },
                },
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  // Structured JSON output is in the first text part of the response.
  // Grounding metadata (search results) is in data.candidates[0].groundingMetadata — ignored.
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text);
  const articles = Array.isArray(parsed?.articles) ? parsed.articles : [];

  // Map to the same ThreatCandidate shape used by the rest of the ingestion pipeline.
  return articles.map((a: any) => {
    const combined = `${a.title || ""} ${a.description || ""}`;
    return {
      title: (a.title || "Bleeping Computer update")
        .replace(/\s*-\s*BleepingComputer\s*$/i, "")
        .trim(),
      description: (a.description || "").slice(0, 500),
      severity: newsSeverity(combined),
      type: newsType(combined),
      cve_id: extractCve(combined),
      cvss_score: null,
      source: "Bleeping Computer",
      source_url: a.url || "https://www.bleepingcomputer.com/",
      status: "New",
    };
  });
}
```

## Integration Point

Call `fetchBleepingComputerViaGemini` in your ingestion service **after** the
standard RSS feed loop and **before** EPSS enrichment — the same placement as
the SaaS version:

```typescript
// ... after RSS feeds loop ...

// Bleeping Computer is behind Cloudflare — fetch via Gemini web search
if (source === "rss" || source === "all") {
  try {
    const bcItems = await fetchBleepingComputerViaGemini(limit);
    candidates.push(...bcItems);
    feedResults.push({
      name: "Bleeping Computer",
      url: "https://www.bleepingcomputer.com/",
      fetched: bcItems.length,
      error: null,
    });
  } catch (e) {
    feedResults.push({
      name: "Bleeping Computer",
      url: "https://www.bleepingcomputer.com/",
      fetched: 0,
      error: e.message,
    });
  }
}

// ... EPSS enrichment follows ...
```

## Prerequisites (already ported)

These helper functions are used by `fetchBleepingComputerViaGemini` and should
already exist in your Docker stack from prior ports:

- `newsSeverity(text)` — keyword-based severity classification
- `newsType(text)` — keyword-based threat type classification
- `extractCve(text)` — extracts `CVE-YYYY-NNNN` patterns

If not yet ported, copy them directly from `base44/functions/ingestFeeds/entry.ts`
in the SaaS builder.

## Cost Considerations

- Gemini 2.0 Flash with Google Search: ~$0.10 per 1K requests (free tier: 1,500 req/day)
- Scheduled ingestion every 2 hours = 12 calls/day = negligible cost
- No additional infrastructure needed (no headless browser, no proxy service)

## Docker Compose

Add the env var to your `docker-compose.yml` or `.env`:

```yaml
services:
  ingestion:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

## Verification

After deploying, trigger ingestion and check that BleepingComputer appears with
`fetched > 0` and `error: null` in the feed results response.
