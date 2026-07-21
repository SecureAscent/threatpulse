/**
 * Security news / advisory RSS feeds.
 *
 * Articles are ingested as type "NEWS". A deterministic `threatId` is derived
 * from the item link/guid so re-collection updates rather than duplicates.
 * Severity is inferred from keywords in the title/summary (best effort).
 */
import { createHash } from 'crypto';
import Parser from 'rss-parser';
import { ThreatRecord } from '../db';
import { createLogger } from '../logger';

const log = createLogger('rss');

const parser = new Parser({
  timeout: 30_000,
  headers: {
    'User-Agent':
      'ThreatPulse-Collector/1.0 (+https://github.com/SecureAscent/threatpulse)',
  },
});

export interface RssFeed {
  name: string;
  url: string;
}

// Feeds requested for the collector (task spec) + a couple of reliable extras.
export const RSS_FEEDS: RssFeed[] = [
  { name: 'US-CERT / CISA', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
  { name: 'CISA Alerts', url: 'https://www.cisa.gov/news.xml' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'SANS ISC', url: 'https://isc.sans.edu/rssfeed_full.xml' },
  { name: 'Threatpost', url: 'https://threatpost.com/feed/' },
  { name: 'SecurityWeek', url: 'https://www.securityweek.com/feed/' },
  { name: 'Recorded Future', url: 'https://www.recordedfuture.com/feed' },
  { name: 'Unit42', url: 'https://unit42.paloaltonetworks.com/feed/' },
  { name: 'Talos Intelligence', url: 'https://blog.talosintelligence.com/rss/' },
];

// How many items to keep per feed per run.
const PER_FEED_LIMIT = Number(process.env.RSS_PER_FEED_LIMIT || 25);

const CRITICAL_WORDS = ['zero-day', 'zero day', 'actively exploited', 'critical', 'ransomware', 'wormable'];
const HIGH_WORDS = ['exploit', 'rce', 'remote code execution', 'breach', 'vulnerability', 'backdoor', 'malware', 'patch'];

function inferSeverity(text: string): string {
  const t = text.toLowerCase();
  if (CRITICAL_WORDS.some((w) => t.includes(w))) return 'CRITICAL';
  if (HIGH_WORDS.some((w) => t.includes(w))) return 'HIGH';
  return 'MEDIUM';
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeThreatId(feedName: string, item: Parser.Item): string {
  const seed = item.guid || item.link || `${feedName}:${item.title || ''}`;
  const hash = createHash('sha1').update(seed).digest('hex').slice(0, 16);
  return `NEWS-${hash}`;
}

async function collectFeed(feed: RssFeed): Promise<ThreatRecord[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = (parsed.items || []).slice(0, PER_FEED_LIMIT);
    const records: ThreatRecord[] = items
      .filter((it) => it.title)
      .map((it) => {
        const summary = stripHtml(it.contentSnippet || it.content || it.summary || '');
        const title = (it.title || '').trim();
        return {
          threatId: makeThreatId(feed.name, it),
          title,
          type: 'NEWS',
          severity: inferSeverity(`${title} ${summary}`),
          description: summary ? summary.slice(0, 1000) : null,
          affectedAssets: null,
          source: feed.name,
          indicators: it.link || null,
          mitreTactic: null,
          mitreTechnique: null,
          cvssScore: null,
        };
      });
    log.info(`${feed.name}: ${records.length} items.`);
    return records;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to fetch "${feed.name}" (${feed.url}): ${msg}`);
    return [];
  }
}

export async function collectRss(): Promise<ThreatRecord[]> {
  log.info(`Fetching ${RSS_FEEDS.length} RSS feeds...`);
  const results = await Promise.all(RSS_FEEDS.map((f) => collectFeed(f)));
  const flat = results.flat();
  log.info(`Prepared ${flat.length} RSS records across all feeds.`);
  return flat;
}
