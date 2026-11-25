import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';

export function isPrivateOrReservedIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

export async function validatePublicHttpUrl(rawUrl: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    net.isIP(host) !== 0
  ) {
    return null;
  }
  try {
    const resolved = await dns.lookup(host, { all: true });
    if (!resolved.length || resolved.some((r) => isPrivateOrReservedIp(r.address))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extractHtmlSeoMeta(html: string): {
  title: string;
  metaDescription: string;
  h1Count: number;
  hasCanonical: boolean;
  hasJsonLd: boolean;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const h1Matches = html.match(/<h1\b[^>]*>/gi);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);

  return {
    title: (titleMatch?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    metaDescription: (descMatch?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    h1Count: h1Matches ? h1Matches.length : 0,
    hasCanonical,
    hasJsonLd,
  };
}

export async function fetchGoogleSuggestKeywords(
  query: string,
  countryCode?: string,
  state?: string
): Promise<string[]> {
  const firstState = state
    ?.split(',')
    .map((s) => s.trim())
    .find((s) => s.length > 0 && s !== 'All States / National');
  const prefixes = ['', 'how to ', 'best ', 'for '];
  const queryVariations = prefixes.map((prefix) => `${prefix}${query}`.trim());
  if (firstState) {
    queryVariations.push(`${query.trim()} ${firstState}`);
  }

  const glParam =
    countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim())
      ? `&gl=${encodeURIComponent(countryCode.trim().toLowerCase())}`
      : '';

  const results = new Set<string>();
  await Promise.all(
    queryVariations.map(async (rawQ) => {
      try {
        const q = encodeURIComponent(rawQ);
        const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox${glParam}&q=${q}`, {
          signal: AbortSignal.timeout(3500),
          headers: { 'User-Agent': 'BizhubAI/1.0' },
        });
        if (!res.ok) return;
        const json = (await res.json()) as [string, string[]];
        if (Array.isArray(json?.[1])) {
          for (const s of json[1].slice(0, 5)) {
            if (typeof s === 'string' && s.trim()) results.add(s.trim());
          }
        }
      } catch {
        // Ignore single-prefix timeout
      }
    })
  );
  return Array.from(results).slice(0, 14);
}

export async function fetchWikipediaTopics(query: string): Promise<{ title: string; url: string }[]> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=5&namespace=0&format=json`,
      {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'AudiencePulseAI/1.0' },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[], string[], string[]];
    const titles = Array.isArray(data?.[1]) ? data[1] : [];
    const urls = Array.isArray(data?.[3]) ? data[3] : [];
    return titles.map((t, i) => ({ title: t, url: urls[i] || '' })).filter((item) => item.title);
  } catch {
    return [];
  }
}

export async function fetchHackerNewsDiscussions(query: string): Promise<
  { title: string; url: string; points: number; numComments: number }[]
> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: { title?: string; url?: string; objectID?: string; points?: number; num_comments?: number }[];
    };
    return (data.hits || [])
      .filter((h) => Boolean(h.title))
      .map((h) => ({
        title: String(h.title),
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID || ''}`,
        points: Number(h.points || 0),
        numComments: Number(h.num_comments || 0),
      }));
  } catch {
    return [];
  }
}

export async function fetchRedditPublicThreads(query: string): Promise<
  { subreddit: string; title: string; score: number; numComments: number; permalink: string }[]
> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(`https://www.reddit.com/search.json?q=${q}&sort=relevance&limit=6`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'web:AudiencePulseAI:v1.0 (free-public-research)' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        children?: {
          data?: {
            subreddit_name_prefixed?: string;
            title?: string;
            score?: number;
            num_comments?: number;
            permalink?: string;
          };
        }[];
      };
    };
    return (data.data?.children || [])
      .map((c) => c.data)
      .filter((d): d is NonNullable<typeof d> => Boolean(d?.title && d?.subreddit_name_prefixed))
      .map((d) => ({
        subreddit: d.subreddit_name_prefixed!,
        title: d.title!,
        score: Number(d.score || 0),
        numComments: Number(d.num_comments || 0),
        permalink: `https://www.reddit.com${d.permalink || ''}`,
      }));
  } catch {
    return [];
  }
}

export async function inspectPublicWebsite(rawDomain: string): Promise<{
  reachable: boolean;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  title: string;
  metaDescription: string;
  h1Count: number;
  hasCanonical: boolean;
  hasJsonLd: boolean;
  hasRobotsTxt: boolean;
} | null> {
  const safeUrl = await validatePublicHttpUrl(rawDomain);
  if (!safeUrl) return null;

  const started = Date.now();
  try {
    const res = await fetch(safeUrl.toString(), {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'AudiencePulseAI-SiteInspector/1.0' },
      redirect: 'manual',
    });
    const responseMs = Date.now() - started;
    const html = (await res.text()).slice(0, 250_000);
    const meta = extractHtmlSeoMeta(html);

    let hasRobotsTxt = false;
    try {
      const robotsRes = await fetch(`${safeUrl.origin}/robots.txt`, {
        signal: AbortSignal.timeout(2500),
        redirect: 'manual',
      });
      hasRobotsTxt = robotsRes.ok;
    } catch {
      hasRobotsTxt = false;
    }

    return {
      reachable: res.ok || (res.status >= 300 && res.status < 400),
      finalUrl: safeUrl.toString(),
      statusCode: res.status,
      responseMs,
      ...meta,
      hasRobotsTxt,
    };
  } catch {
    return null;
  }
}

export async function fetchPageSpeedInsights(
  rawDomain: string,
  apiKey?: string
): Promise<{
  performanceScore: number;
  seoScore: number;
  lcp: string;
  cls: string;
  fcp: string;
} | null> {
  const safeUrl = await validatePublicHttpUrl(rawDomain);
  if (!safeUrl) return null;

  try {
    const params = new URLSearchParams({
      url: safeUrl.toString(),
      strategy: 'mobile',
    });
    params.append('category', 'performance');
    params.append('category', 'seo');
    if (apiKey && apiKey.trim()) {
      params.set('key', apiKey.trim());
    }
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'AudiencePulseAI-PageSpeed/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
          seo?: { score?: number };
        };
        audits?: {
          'largest-contentful-paint'?: { displayValue?: string };
          'cumulative-layout-shift'?: { displayValue?: string };
          'first-contentful-paint'?: { displayValue?: string };
        };
      };
    };
    const perfRaw = data.lighthouseResult?.categories?.performance?.score;
    const seoRaw = data.lighthouseResult?.categories?.seo?.score;
    if (typeof perfRaw !== 'number' && typeof seoRaw !== 'number') return null;

    return {
      performanceScore: Math.round((perfRaw ?? 0) * 100),
      seoScore: Math.round((seoRaw ?? 0) * 100),
      lcp: data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
      cls: data.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
      fcp: data.lighthouseResult?.audits?.['first-contentful-paint']?.displayValue || 'N/A',
    };
  } catch {
    return null;
  }
}

export async function fetchYouTubeSearchResults(
  query: string,
  apiKey?: string,
  countryCode?: string
): Promise<
  { title: string; channelTitle: string; kind: 'channel' | 'video'; id: string; url: string; description: string }[]
> {
  if (!apiKey || !apiKey.trim()) return [];
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'channel,video',
      maxResults: '5',
      q: query.trim(),
      key: apiKey.trim(),
    });
    if (countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim())) {
      params.set('regionCode', countryCode.trim().toUpperCase());
    }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        id?: { kind?: string; channelId?: string; videoId?: string };
        snippet?: { title?: string; channelTitle?: string; description?: string };
      }[];
    };
    return (data.items || [])
      .map((item) => {
        const isChannel = item.id?.kind === 'youtube#channel' || Boolean(item.id?.channelId);
        const id = item.id?.channelId || item.id?.videoId || '';
        const title = item.snippet?.title || '';
        if (!id || !title) return null;
        return {
          title,
          channelTitle: item.snippet?.channelTitle || title,
          kind: (isChannel ? 'channel' : 'video') as 'channel' | 'video',
          id,
          url: isChannel ? `https://www.youtube.com/channel/${id}` : `https://www.youtube.com/watch?v=${id}`,
          description: (item.snippet?.description || '').slice(0, 140),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  } catch {
    return [];
  }
}

export async function fetchSearxngResults(
  query: string,
  instanceUrl?: string
): Promise<{ title: string; url: string; content: string; engine: string }[]> {
  if (!instanceUrl || !instanceUrl.trim()) return [];
  const safeBase = await validatePublicHttpUrl(instanceUrl.trim());
  if (!safeBase) return [];

  try {
    const searchUrl = `${safeBase.origin}/search?q=${encodeURIComponent(query.trim())}&format=json`;
    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(4500),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AudiencePulseAI-SearXNG/1.0',
      },
      redirect: 'manual',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string; engine?: string }[];
    };
    return (data.results || [])
      .filter((r) => Boolean(r.title && r.url))
      .slice(0, 8)
      .map((r) => ({
        title: String(r.title),
        url: String(r.url),
        content: String(r.content || '').slice(0, 160),
        engine: String(r.engine || 'searxng'),
      }));
  } catch {
    return [];
  }
}

export async function fetchDuckDuckGoSuggestKeywords(query: string): Promise<string[]> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(`https://duckduckgo.com/ac/?q=${q}&type=list`, {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'BizhubAI/1.0' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return (data[1] as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 10);
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchCategorizedKeywordIdeas(
  query: string,
  countryCode?: string,
  langCode?: string,
  state?: string
): Promise<{
  autocomplete: string[];
  questions: string[];
  prepositions: string[];
  comparisons: string[];
}> {
  const cleanQ = query.trim();
  const firstState = state
    ?.split(',')
    .map((s) => s.trim())
    .find((s) => s.length > 0 && s !== 'All States / National');
  const glParam =
    countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim())
      ? `&gl=${encodeURIComponent(countryCode.trim().toLowerCase())}`
      : '';
  const hlParam =
    langCode && /^[a-zA-Z]{2}$/.test(langCode.trim())
      ? `&hl=${encodeURIComponent(langCode.trim().toLowerCase())}`
      : '';

  const querySuggest = async (term: string): Promise<string[]> => {
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox${glParam}${hlParam}&q=${encodeURIComponent(term)}`,
        {
          signal: AbortSignal.timeout(3500),
          headers: { 'User-Agent': 'BizhubAI/1.0' },
        }
      );
      if (!res.ok) return [];
      const json = (await res.json()) as [string, string[]];
      return Array.isArray(json?.[1])
        ? json[1].filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
        : [];
    } catch {
      return [];
    }
  };

  const localizedSeed = firstState ? `${cleanQ} ${firstState}` : cleanQ;
  const [baseGoogle, baseDdg, howS, whatS, whyS, forS, nearS, withS, vsS, altS] = await Promise.all([
    querySuggest(localizedSeed),
    fetchDuckDuckGoSuggestKeywords(localizedSeed),
    querySuggest(`how ${cleanQ}`),
    querySuggest(`what ${cleanQ}`),
    querySuggest(`why ${cleanQ}`),
    querySuggest(`${cleanQ} for`),
    querySuggest(`${cleanQ} near`),
    querySuggest(`${cleanQ} with`),
    querySuggest(`${cleanQ} vs`),
    querySuggest(`${cleanQ} alternative`),
  ]);

  const dedupe = (items: string[]) => Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));

  return {
    autocomplete: dedupe([...baseGoogle, ...baseDdg]).slice(0, 12),
    questions: dedupe([...howS, ...whatS, ...whyS]).slice(0, 12),
    prepositions: dedupe([...forS, ...nearS, ...withS]).slice(0, 12),
    comparisons: dedupe([...vsS, ...altS]).slice(0, 12),
  };
}

export async function fetchOpenPageRankScores(
  domains: string[],
  apiKey?: string
): Promise<Record<string, { authority: number; globalRank: string }>> {
  if (!apiKey || !apiKey.trim() || domains.length === 0) return {};
  try {
    const cleanDomains = Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))).slice(0, 10);
    const params = new URLSearchParams();
    for (const d of cleanDomains) {
      params.append('domains[]', d);
    }
    const res = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?${params.toString()}`, {
      signal: AbortSignal.timeout(4500),
      headers: { 'API-OPR': apiKey.trim() },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      response?: { domain?: string; page_rank_decimal?: number; rank?: string | null }[];
    };
    const out: Record<string, { authority: number; globalRank: string }> = {};
    for (const item of data.response || []) {
      if (item.domain && typeof item.page_rank_decimal === 'number') {
        out[item.domain.toLowerCase()] = {
          authority: Math.min(100, Math.max(1, Math.round(item.page_rank_decimal * 10))),
          globalRank: String(item.rank || 'N/A'),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchTrancoDomainRanks(
  domains: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const cleanDomains = Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))).slice(0, 5);
  await Promise.all(
    cleanDomains.map(async (domain) => {
      try {
        const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ranks?: { rank?: number }[] };
        const rank = json.ranks?.[0]?.rank;
        if (typeof rank === 'number' && rank > 0) {
          const authority = Math.max(15, Math.min(99, Math.round(100 - Math.log10(rank) * 12)));
          out[domain] = authority;
        }
      } catch {
        // Ignore single-domain Tranco miss
      }
    })
  );
  return out;
}

export async function fetchBraveSearchResults(
  query: string,
  apiKey?: string,
  countryCode?: string
): Promise<{ title: string; url: string; description: string }[]> {
  if (!apiKey || !apiKey.trim()) return [];
  try {
    const params = new URLSearchParams({
      q: query.trim(),
      count: '10',
    });
    if (countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim())) {
      params.set('country', countryCode.trim().toUpperCase());
    }
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey.trim(),
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    return (data.web?.results || [])
      .filter((r) => Boolean(r.title && r.url))
      .slice(0, 10)
      .map((r) => ({
        title: String(r.title),
        url: String(r.url),
        description: String(r.description || '').slice(0, 180),
      }));
  } catch {
    return [];
  }
}

export async function fetchSerperResults(
  query: string,
  apiKey?: string,
  countryCode?: string,
  langCode?: string
): Promise<{
  organic: { title: string; link: string; snippet: string; position: number }[];
  answerBox?: string;
  peopleAlsoAsk: string[];
}> {
  if (!apiKey || !apiKey.trim()) {
    return { organic: [], peopleAlsoAsk: [] };
  }
  try {
    const body: Record<string, unknown> = {
      q: query.trim(),
      num: 10,
    };
    if (countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim())) {
      body.gl = countryCode.trim().toLowerCase();
    }
    if (langCode && /^[a-zA-Z]{2}$/.test(langCode.trim())) {
      body.hl = langCode.trim().toLowerCase();
    }
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      signal: AbortSignal.timeout(5500),
      headers: {
        'X-API-KEY': apiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { organic: [], peopleAlsoAsk: [] };
    const data = (await res.json()) as {
      organic?: { title?: string; link?: string; snippet?: string; position?: number }[];
      answerBox?: { snippet?: string; answer?: string };
      peopleAlsoAsk?: { question?: string }[];
    };
    return {
      organic: (data.organic || [])
        .filter((o) => Boolean(o.title && o.link))
        .map((o, idx) => ({
          title: String(o.title),
          link: String(o.link),
          snippet: String(o.snippet || '').slice(0, 180),
          position: Number(o.position || idx + 1),
        })),
      answerBox: data.answerBox?.answer || data.answerBox?.snippet,
      peopleAlsoAsk: (data.peopleAlsoAsk || []).map((p) => String(p.question || '')).filter(Boolean),
    };
  } catch {
    return { organic: [], peopleAlsoAsk: [] };
  }
}

export async function fetchFirecrawlScrape(
  targetUrl: string,
  instanceUrl?: string
): Promise<{ title: string; markdownSnippet: string } | null> {
  if (!instanceUrl || !instanceUrl.trim()) return null;
  const safeBase = await validatePublicHttpUrl(instanceUrl.trim());
  const safeTarget = await validatePublicHttpUrl(targetUrl.trim());
  if (!safeBase || !safeTarget) return null;

  try {
    const res = await fetch(`${safeBase.origin}/v1/scrape`, {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: safeTarget.toString(), formats: ['markdown'] }),
      redirect: 'manual',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { metadata?: { title?: string }; markdown?: string };
    };
    return {
      title: String(json.data?.metadata?.title || safeTarget.hostname),
      markdownSnippet: String(json.data?.markdown || '').slice(0, 320),
    };
  } catch {
    return null;
  }
}

export function parseGoogleTrendsRssXml(
  xml: string,
  countryLabel = 'Global'
): { title: string; approxTraffic: string; country: string; relatedNewsTitle?: string; url?: string }[] {
  const items: { title: string; approxTraffic: string; country: string; relatedNewsTitle?: string; url?: string }[] = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const cleanTag = (block: string, tag: string): string => {
    const escaped = tag.replace(':', '\\:');
    const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (!match?.[1]) return '';
    return match[1]
      .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  for (const block of itemMatches.slice(0, 12)) {
    const title = cleanTag(block, 'title');
    if (!title) continue;
    const approxTraffic = cleanTag(block, 'ht:approx_traffic') || 'Rising';
    const relatedNewsTitle = cleanTag(block, 'ht:news_item_title') || undefined;
    const rawUrl = cleanTag(block, 'ht:news_item_url') || cleanTag(block, 'link');
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;
    items.push({
      title: title.slice(0, 100),
      approxTraffic: approxTraffic.slice(0, 32),
      country: countryLabel,
      relatedNewsTitle: relatedNewsTitle?.slice(0, 140),
      url,
    });
  }
  return items;
}

export async function fetchGoogleTrendsRss(
  countryCode?: string,
  countryLabel = 'Global'
): Promise<{ title: string; approxTraffic: string; country: string; relatedNewsTitle?: string; url?: string }[]> {
  const geo = countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim()) ? countryCode.trim().toUpperCase() : 'US';
  try {
    const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'BizhubAI-TrendsRSS/1.0' },
    });
    if (!res.ok) return [];
    const xml = (await res.text()).slice(0, 300_000);
    return parseGoogleTrendsRssXml(xml, countryLabel);
  } catch {
    return [];
  }
}

export async function fetchWikimediaPageviews(
  topic: string
): Promise<{ articleTitle: string; totalViews: number; months: { month: string; views: number }[] } | null> {
  try {
    const wikiTopics = await fetchWikipediaTopics(topic);
    const title = wikiTopics[0]?.title;
    if (!title) return null;

    const end = new Date();
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 7);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}01`;
    const encodedTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
    const apiUrl = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodedTitle}/monthly/${fmt(start)}/${fmt(end)}`;
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'BizhubAI/1.0 (seo-research-platform)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { timestamp?: string; views?: number }[] };
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const items = (data.items || [])
      .filter((x) => typeof x.views === 'number' && typeof x.timestamp === 'string' && x.timestamp.length >= 6)
      .slice(-6)
      .map((x) => {
        const mIdx = Math.max(0, Math.min(11, Number(x.timestamp!.slice(4, 6)) - 1));
        return {
          month: monthNames[mIdx] || x.timestamp!.slice(4, 6),
          views: Number(x.views || 0),
        };
      });
    if (items.length === 0) return null;
    const totalViews = items.reduce((sum, item) => sum + item.views, 0);
    return { articleTitle: title, totalViews, months: items };
  } catch {
    return null;
  }
}

export async function fetchCommonCrawlDomainFootprint(
  rawDomain: string
): Promise<{ indexedCount: number; samples: { url: string; status: string; mime: string }[] }> {
  const safeUrl = await validatePublicHttpUrl(rawDomain);
  if (!safeUrl) return { indexedCount: 0, samples: [] };
  const cleanHost = safeUrl.hostname.replace(/^www\./, '');
  try {
    const res = await fetch(
      `https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=${encodeURIComponent(`*.${cleanHost}/*`)}&output=json&limit=10`,
      {
        signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'BizhubAI-CommonCrawl/1.0' },
      }
    );
    if (!res.ok) return { indexedCount: 0, samples: [] };
    const text = (await res.text()).slice(0, 120_000);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
    const samples: { url: string; status: string; mime: string }[] = [];
    for (const line of lines.slice(0, 8)) {
      try {
        const parsed = JSON.parse(line) as { url?: string; status?: string; mime?: string };
        if (parsed.url && /^https?:\/\//i.test(parsed.url)) {
          samples.push({
            url: parsed.url.slice(0, 180),
            status: String(parsed.status || '200'),
            mime: String(parsed.mime || 'text/html'),
          });
        }
      } catch {
        // Ignore malformed NDJSON row
      }
    }
    return { indexedCount: lines.length, samples };
  } catch {
    return { indexedCount: 0, samples: [] };
  }
}

export async function fetchOpenAlexCitations(
  query: string
): Promise<{ title: string; url: string; citedByCount: number; publicationYear?: number }[]> {
  try {
    const res = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}&per-page=5&sort=cited_by_count:desc`,
      {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'BizhubAI/1.0 (mailto:research@bizhub.local)' },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        title?: string;
        id?: string;
        doi?: string;
        cited_by_count?: number;
        publication_year?: number;
      }[];
    };
    return (data.results || [])
      .filter((w) => Boolean(w.title && (w.doi || w.id)))
      .map((w) => ({
        title: String(w.title).slice(0, 140),
        url: String(w.doi || w.id),
        citedByCount: Number(w.cited_by_count || 0),
        publicationYear: w.publication_year,
      }));
  } catch {
    return [];
  }
}

export async function fetchGitHubRepositories(
  query: string
): Promise<{ name: string; fullName: string; url: string; stars: number; description: string }[]> {
  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query.trim())}&sort=stars&order=desc&per_page=5`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'BizhubAI/1.0',
        },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        name?: string;
        full_name?: string;
        html_url?: string;
        stargazers_count?: number;
        description?: string;
      }[];
    };
    return (data.items || [])
      .filter((r) => Boolean(r.full_name && r.html_url))
      .map((r) => ({
        name: String(r.name || r.full_name),
        fullName: String(r.full_name),
        url: String(r.html_url),
        stars: Number(r.stargazers_count || 0),
        description: String(r.description || '').slice(0, 140),
      }));
  } catch {
    return [];
  }
}

export function parseSitemapLocUrls(xml: string): string[] {
  const matches = xml.match(/<loc[^>]*>([\s\S]*?)<\/loc>/gi) || [];
  const out: string[] = [];
  for (const m of matches.slice(0, 20)) {
    const val = m.replace(/<\/?loc[^>]*>/gi, '').trim();
    if (/^https?:\/\//i.test(val)) {
      out.push(val);
    }
  }
  return Array.from(new Set(out));
}

export function extractInternalLinksFromHtml(html: string, origin: string): string[] {
  const matches = html.match(/<a\b[^>]+href=["']([^"'#]+)["']/gi) || [];
  const out: string[] = [];
  for (const tag of matches.slice(0, 40)) {
    const hrefMatch = tag.match(/href=["']([^"'#]+)["']/i);
    const raw = hrefMatch?.[1]?.trim();
    if (!raw || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try {
      const resolved = new URL(raw, origin);
      if (resolved.origin === origin && (resolved.protocol === 'http:' || resolved.protocol === 'https:')) {
        out.push(resolved.toString());
      }
    } catch {
      // Ignore malformed relative href
    }
  }
  return Array.from(new Set(out)).slice(0, 10);
}

export async function inspectSiteSitemapAndLinks(rawDomain: string): Promise<{
  sitemapFound: boolean;
  sitemapUrlCount: number;
  auditedPagesCount: number;
  healthyLinksCount: number;
  brokenLinks: { url: string; status: number }[];
  sampleUrls: { url: string; status: number; title: string }[];
} | null> {
  const safeBase = await validatePublicHttpUrl(rawDomain);
  if (!safeBase) return null;

  let sitemapUrlCandidate = `${safeBase.origin}/sitemap.xml`;
  let sitemapFound = false;
  let sitemapUrls: string[] = [];

  try {
    const robotsRes = await fetch(`${safeBase.origin}/robots.txt`, {
      signal: AbortSignal.timeout(2500),
      redirect: 'manual',
      headers: { 'User-Agent': 'BizhubAI-Crawler/1.0' },
    });
    if (robotsRes.ok) {
      const robotsTxt = (await robotsRes.text()).slice(0, 40_000);
      const sitemapDirective = robotsTxt.match(/^Sitemap:\s*(https?:\/\/\S+)/im);
      if (sitemapDirective?.[1]) {
        const checkedSitemap = await validatePublicHttpUrl(sitemapDirective[1].trim());
        if (checkedSitemap) {
          sitemapUrlCandidate = checkedSitemap.toString();
        }
      }
    }
  } catch {
    // Fallback to /sitemap.xml
  }

  try {
    const smRes = await fetch(sitemapUrlCandidate, {
      signal: AbortSignal.timeout(3000),
      redirect: 'manual',
      headers: { 'User-Agent': 'BizhubAI-Crawler/1.0' },
    });
    if (smRes.ok) {
      const smText = (await smRes.text()).slice(0, 180_000);
      sitemapUrls = parseSitemapLocUrls(smText);
      sitemapFound = sitemapUrls.length > 0 || /<(urlset|sitemapindex)\b/i.test(smText);
    }
  } catch {
    sitemapFound = false;
  }

  let internalLinks: string[] = [];
  try {
    const homeRes = await fetch(safeBase.toString(), {
      signal: AbortSignal.timeout(3500),
      redirect: 'manual',
      headers: { 'User-Agent': 'BizhubAI-Crawler/1.0' },
    });
    if (homeRes.ok) {
      const homeHtml = (await homeRes.text()).slice(0, 180_000);
      internalLinks = extractInternalLinksFromHtml(homeHtml, safeBase.origin);
    }
  } catch {
    internalLinks = [];
  }

  const candidateQueue = Array.from(new Set([...sitemapUrls, ...internalLinks])).slice(0, 5);
  const brokenLinks: { url: string; status: number }[] = [];
  const sampleUrls: { url: string; status: number; title: string }[] = [];
  let healthyLinksCount = 0;

  await Promise.all(
    candidateQueue.map(async (rawTarget) => {
      const safeTarget = await validatePublicHttpUrl(rawTarget);
      if (!safeTarget) return;
      try {
        const pageRes = await fetch(safeTarget.toString(), {
          signal: AbortSignal.timeout(2500),
          redirect: 'manual',
          headers: { 'User-Agent': 'BizhubAI-Crawler/1.0' },
        });
        const html = pageRes.ok ? (await pageRes.text()).slice(0, 60_000) : '';
        const meta = extractHtmlSeoMeta(html);
        if (pageRes.status >= 400) {
          brokenLinks.push({ url: safeTarget.toString(), status: pageRes.status });
        } else {
          healthyLinksCount += 1;
        }
        sampleUrls.push({
          url: safeTarget.toString(),
          status: pageRes.status,
          title: meta.title || safeTarget.pathname,
        });
      } catch {
        brokenLinks.push({ url: safeTarget.toString(), status: 0 });
      }
    })
  );

  return {
    sitemapFound,
    sitemapUrlCount: sitemapUrls.length,
    auditedPagesCount: sampleUrls.length + brokenLinks.length,
    healthyLinksCount,
    brokenLinks,
    sampleUrls,
  };
}

export function parseCrtShCertificates(
  rows: { name_value?: string; issuer_name?: string }[],
  baseDomain: string
): { subdomains: string[]; issuers: string[]; certCount: number } {
  const cleanBase = baseDomain.toLowerCase().replace(/^www\./, '');
  const subs = new Set<string>();
  const issuers = new Set<string>();
  for (const row of rows.slice(0, 120)) {
    const names = String(row.name_value || '')
      .split(/\r?\n/)
      .map((s) => s.trim().toLowerCase().replace(/^\*\./, ''))
      .filter(Boolean);
    for (const name of names) {
      if (name === cleanBase || name.endsWith(`.${cleanBase}`)) {
        subs.add(name);
      }
    }
    const issuerRaw = String(row.issuer_name || '');
    const oMatch = issuerRaw.match(/O=([^,]+)/i) || issuerRaw.match(/CN=([^,]+)/i);
    if (oMatch?.[1]) {
      issuers.add(oMatch[1].trim().slice(0, 64));
    }
  }
  return {
    subdomains: Array.from(subs).slice(0, 15),
    issuers: Array.from(issuers).slice(0, 4),
    certCount: rows.length,
  };
}

export async function inspectSslAndSubdomains(rawDomain: string): Promise<{
  domain: string;
  sslValid: boolean;
  sslExpiryDays: number;
  sslIssuer: string;
  tlsProtocol: string;
  subdomainsCount: number;
  sampleSubdomains: string[];
  certCount: number;
} | null> {
  const safeUrl = await validatePublicHttpUrl(rawDomain);
  if (!safeUrl) return null;
  const cleanHost = safeUrl.hostname.replace(/^www\./, '');

  const checkTls = (): Promise<{
    valid: boolean;
    expiryDays: number;
    issuer: string;
    protocol: string;
  }> =>
    new Promise((resolve) => {
      let settled = false;
      const done = (val: { valid: boolean; expiryDays: number; issuer: string; protocol: string }) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };
      const socket = tls.connect(
        {
          host: cleanHost,
          port: 443,
          servername: cleanHost,
          rejectUnauthorized: false,
          timeout: 3200,
        },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            const protocol = socket.getProtocol() || 'TLS';
            const authorized = socket.authorized;
            const validTo = cert?.valid_to ? Date.parse(cert.valid_to) : NaN;
            const expiryDays = Number.isFinite(validTo)
              ? Math.max(0, Math.round((validTo - Date.now()) / 86_400_000))
              : 0;
            const issuer = String(cert?.issuer?.O || cert?.issuer?.CN || 'Public CA').slice(0, 64);
            socket.end();
            done({ valid: authorized && expiryDays > 0, expiryDays, issuer, protocol });
          } catch {
            socket.destroy();
            done({ valid: false, expiryDays: 0, issuer: 'Unknown', protocol: 'Unknown' });
          }
        }
      );
      socket.setTimeout(3200, () => {
        socket.destroy();
        done({ valid: false, expiryDays: 0, issuer: 'Timeout', protocol: 'Unknown' });
      });
      socket.on('error', () => {
        done({ valid: false, expiryDays: 0, issuer: 'Unreachable', protocol: 'Unknown' });
      });
    });

  const fetchCrtSh = async (): Promise<{ subdomains: string[]; issuers: string[]; certCount: number }> => {
    try {
      const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%.${cleanHost}`)}&output=json`, {
        signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'BizhubAI-CertInspector/1.0' },
      });
      if (!res.ok) return { subdomains: [], issuers: [], certCount: 0 };
      const text = (await res.text()).slice(0, 260_000);
      const parsed = JSON.parse(text) as { name_value?: string; issuer_name?: string }[];
      if (!Array.isArray(parsed)) return { subdomains: [], issuers: [], certCount: 0 };
      return parseCrtShCertificates(parsed, cleanHost);
    } catch {
      return { subdomains: [], issuers: [], certCount: 0 };
    }
  };

  const [tlsResult, crtResult] = await Promise.all([checkTls(), fetchCrtSh()]);
  return {
    domain: cleanHost,
    sslValid: tlsResult.valid,
    sslExpiryDays: tlsResult.expiryDays,
    sslIssuer: tlsResult.issuer || crtResult.issuers[0] || 'Public CA',
    tlsProtocol: tlsResult.protocol,
    subdomainsCount: crtResult.subdomains.length,
    sampleSubdomains: crtResult.subdomains.slice(0, 8),
    certCount: crtResult.certCount,
  };
}

export function parseWikidataSparqlBindings(
  bindings: Record<string, { value?: string }>[]
): {
  qid: string;
  label: string;
  description: string;
  officialWebsite?: string;
  industry?: string;
  inception?: string;
  wikidataUrl: string;
}[] {
  const seen = new Set<string>();
  const out: {
    qid: string;
    label: string;
    description: string;
    officialWebsite?: string;
    industry?: string;
    inception?: string;
    wikidataUrl: string;
  }[] = [];

  for (const b of bindings) {
    const itemUri = String(b.item?.value || '');
    const qidMatch = itemUri.match(/\/(Q\d+)$/i);
    const qid = qidMatch?.[1] || '';
    const label = String(b.itemLabel?.value || '').trim();
    if (!qid || !label || seen.has(qid)) continue;
    seen.add(qid);

    const rawSite = String(b.officialWebsite?.value || '').trim();
    const officialWebsite = /^https?:\/\//i.test(rawSite) ? rawSite : undefined;
    const rawInception = String(b.inception?.value || '').trim();
    const inceptionYear = rawInception.match(/^(\d{4})/)?.[1];

    out.push({
      qid,
      label: label.slice(0, 90),
      description: String(b.itemDescription?.value || 'Knowledge Graph Entity').slice(0, 150),
      officialWebsite,
      industry: b.industryLabel?.value ? String(b.industryLabel.value).slice(0, 64) : undefined,
      inception: inceptionYear,
      wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
    });
  }
  return out;
}

export async function fetchWikidataEntityGraph(query: string): Promise<
  {
    qid: string;
    label: string;
    description: string;
    officialWebsite?: string;
    industry?: string;
    inception?: string;
    wikidataUrl: string;
  }[]
> {
  const clean = query.trim();
  if (!clean) return [];
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(clean)}&language=en&limit=4&format=json`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'BizhubAI/1.0 (wikidata-entity-graph)' },
    });
    if (!searchRes.ok) return [];
    const searchJson = (await searchRes.json()) as {
      search?: { id?: string; label?: string; description?: string }[];
    };
    const qids = (searchJson.search || [])
      .map((s) => String(s.id || ''))
      .filter((id) => /^Q\d+$/.test(id))
      .slice(0, 4);
    if (qids.length === 0) return [];

    const valuesClause = qids.map((id) => `wd:${id}`).join(' ');
    const sparql = `SELECT ?item ?itemLabel ?itemDescription ?officialWebsite ?industryLabel ?inception WHERE {
      VALUES ?item { ${valuesClause} }
      OPTIONAL { ?item wdt:P856 ?officialWebsite . }
      OPTIONAL { ?item wdt:P452 ?industry . }
      OPTIONAL { ?item wdt:P571 ?inception . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 8`;

    const sparqlRes = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
      {
        signal: AbortSignal.timeout(4500),
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'BizhubAI/1.0 (https://github.com/bizhub-ai)',
        },
      }
    );
    if (!sparqlRes.ok) {
      return (searchJson.search || [])
        .filter((s) => Boolean(s.id && s.label))
        .map((s) => ({
          qid: String(s.id),
          label: String(s.label).slice(0, 90),
          description: String(s.description || 'Wikidata Entity').slice(0, 150),
          wikidataUrl: `https://www.wikidata.org/wiki/${s.id}`,
        }));
    }
    const sparqlJson = (await sparqlRes.json()) as {
      results?: { bindings?: Record<string, { value?: string }>[] };
    };
    const parsed = parseWikidataSparqlBindings(sparqlJson.results?.bindings || []);
    return parsed.length > 0
      ? parsed
      : (searchJson.search || [])
          .filter((s) => Boolean(s.id && s.label))
          .map((s) => ({
            qid: String(s.id),
            label: String(s.label).slice(0, 90),
            description: String(s.description || 'Wikidata Entity').slice(0, 150),
            wikidataUrl: `https://www.wikidata.org/wiki/${s.id}`,
          }));
  } catch {
    return [];
  }
}

export function parseRssOrAtomFeedXml(
  xml: string,
  fallbackSource = 'RSS Feed'
): { title: string; url: string; source: string; publishedAt?: string }[] {
  const decodeEntities = (raw: string): string =>
    raw
      .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

  const extractTag = (block: string, tag: string): string => {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1] ? decodeEntities(match[1]) : '';
  };

  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const items: { title: string; url: string; source: string; publishedAt?: string }[] = [];

  for (const block of blocks.slice(0, 10)) {
    const title = extractTag(block, 'title');
    if (!title) continue;

    let link = extractTag(block, 'link');
    if (!link) {
      const atomHref = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = atomHref?.[1]?.trim() || '';
    }
    if (!/^https?:\/\//i.test(link)) continue;

    const source = extractTag(block, 'source') || fallbackSource;
    const pubRaw = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    items.push({
      title: title.slice(0, 140),
      url: link.slice(0, 260),
      source: source.slice(0, 60),
      publishedAt: pubRaw ? pubRaw.slice(0, 32) : undefined,
    });
  }
  return items;
}

export async function fetchIndustryNewsRss(
  query: string,
  customFeedUrl?: string,
  countryCode?: string,
  langCode?: string
): Promise<{ title: string; url: string; source: string; publishedAt?: string }[]> {
  const geo = countryCode && /^[a-zA-Z]{2}$/.test(countryCode.trim()) ? countryCode.trim().toUpperCase() : 'US';
  const hl = langCode && /^[a-zA-Z]{2}$/.test(langCode.trim()) ? langCode.trim().toLowerCase() : 'en';

  const fetchFeed = async (targetUrl: string, label: string) => {
    try {
      const res = await fetch(targetUrl, {
        signal: AbortSignal.timeout(4000),
        redirect: 'manual',
        headers: { 'User-Agent': 'BizhubAI-RSSMonitor/1.0' },
      });
      if (!res.ok) return [];
      const xml = (await res.text()).slice(0, 300_000);
      return parseRssOrAtomFeedXml(xml, label);
    } catch {
      return [];
    }
  };

  const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query.trim())}&hl=${hl}-${geo}&gl=${geo}&ceid=${geo}:${hl}`;
  const tasks: Promise<{ title: string; url: string; source: string; publishedAt?: string }[]>[] = [
    fetchFeed(googleNewsUrl, 'Google News RSS'),
  ];

  if (customFeedUrl && customFeedUrl.trim()) {
    const safeCustom = await validatePublicHttpUrl(customFeedUrl.trim());
    if (safeCustom) {
      tasks.push(fetchFeed(safeCustom.toString(), safeCustom.hostname));
    }
  }

  const results = await Promise.all(tasks);
  const merged = results.flat();
  const seen = new Set<string>();
  return merged
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function parseOssAnalyticsConfig(credential?: string): {
  kind: 'umami' | 'posthog';
  baseUrl: string;
  siteOrProjectId: string;
  token: string;
} | null {
  const raw = String(credential || '').trim();
  if (!raw) return null;
  const parts = raw.split('|').map((s) => s.trim());
  if (parts.length < 4) return null;
  const kindRaw = parts[0].toLowerCase();
  if (kindRaw !== 'umami' && kindRaw !== 'posthog') return null;
  const [, baseUrl, siteOrProjectId, token] = parts;
  if (!baseUrl || !siteOrProjectId || !token) return null;
  return { kind: kindRaw, baseUrl, siteOrProjectId, token };
}

export async function fetchOssVisitorAnalytics(credential?: string): Promise<{
  configured: boolean;
  providerName?: 'Umami' | 'PostHog';
  visitors30d?: number;
  pageviews30d?: number;
  bounces30d?: number;
  topReferrers?: { domain: string; visitors: number }[];
  message: string;
}> {
  const cfg = parseOssAnalyticsConfig(credential);
  if (!cfg) {
    return {
      configured: false,
      message: 'Save config in Settings using format: umami|https://host|websiteId|apiToken or posthog|https://us.posthog.com|projectId|apiKey',
    };
  }
  const safeBase = await validatePublicHttpUrl(cfg.baseUrl);
  if (!safeBase) {
    return {
      configured: false,
      message: 'Analytics host URL was blocked because it is private, internal, or invalid.',
    };
  }

  const endAt = Date.now();
  const startAt = endAt - 30 * 86_400_000;

  if (cfg.kind === 'umami') {
    try {
      const [statsRes, refRes] = await Promise.all([
        fetch(
          `${safeBase.origin}/api/websites/${encodeURIComponent(cfg.siteOrProjectId)}/stats?startAt=${startAt}&endAt=${endAt}`,
          {
            signal: AbortSignal.timeout(4500),
            redirect: 'manual',
            headers: { Authorization: `Bearer ${cfg.token}` },
          }
        ),
        fetch(
          `${safeBase.origin}/api/websites/${encodeURIComponent(cfg.siteOrProjectId)}/metrics?startAt=${startAt}&endAt=${endAt}&type=referrer`,
          {
            signal: AbortSignal.timeout(4500),
            redirect: 'manual',
            headers: { Authorization: `Bearer ${cfg.token}` },
          }
        ),
      ]);
      if (!statsRes.ok) {
        return {
          configured: true,
          providerName: 'Umami',
          message: `Umami returned HTTP ${statsRes.status}. Verify websiteId and bearer token.`,
        };
      }
      const stats = (await statsRes.json()) as {
        pageviews?: { value?: number } | number;
        visitors?: { value?: number } | number;
        bounces?: { value?: number } | number;
      };
      const pv = typeof stats.pageviews === 'number' ? stats.pageviews : Number(stats.pageviews?.value || 0);
      const vis = typeof stats.visitors === 'number' ? stats.visitors : Number(stats.visitors?.value || 0);
      const bounces = typeof stats.bounces === 'number' ? stats.bounces : Number(stats.bounces?.value || 0);
      let topReferrers: { domain: string; visitors: number }[] = [];
      if (refRes.ok) {
        const refs = (await refRes.json()) as { x?: string; y?: number }[];
        if (Array.isArray(refs)) {
          topReferrers = refs
            .filter((r) => Boolean(r.x))
            .slice(0, 6)
            .map((r) => ({ domain: String(r.x), visitors: Number(r.y || 0) }));
        }
      }
      return {
        configured: true,
        providerName: 'Umami',
        visitors30d: vis,
        pageviews30d: pv,
        bounces30d: bounces,
        topReferrers,
        message: `Umami live (${vis.toLocaleString()} visitors, ${pv.toLocaleString()} pageviews in 30d).`,
      };
    } catch {
      return {
        configured: true,
        providerName: 'Umami',
        message: 'Unable to reach Umami analytics endpoint.',
      };
    }
  }

  try {
    const res = await fetch(
      `${safeBase.origin}/api/projects/${encodeURIComponent(cfg.siteOrProjectId)}/query/`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        redirect: 'manual',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query:
              "SELECT count() AS pageviews, uniq(distinct_id) AS visitors FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY",
          },
        }),
      }
    );
    if (!res.ok) {
      return {
        configured: true,
        providerName: 'PostHog',
        message: `PostHog returned HTTP ${res.status}. Verify projectId and personal API key.`,
      };
    }
    const json = (await res.json()) as { results?: [number, number][] };
    const row = json.results?.[0] || [0, 0];
    const pv = Number(row[0] || 0);
    const vis = Number(row[1] || 0);
    return {
      configured: true,
      providerName: 'PostHog',
      visitors30d: vis,
      pageviews30d: pv,
      topReferrers: [],
      message: `PostHog live (${vis.toLocaleString()} visitors, ${pv.toLocaleString()} pageviews in 30d).`,
    };
  } catch {
    return {
      configured: true,
      providerName: 'PostHog',
      message: 'Unable to reach PostHog API endpoint.',
    };
  }
}

export async function testFreeProviderConnection(
  providerId: string,
  customCredential?: string,
  gscAccessToken?: string
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  switch (providerId) {
    case 'google-suggest-free': {
      const kws = await fetchGoogleSuggestKeywords('audience research');
      return {
        ok: kws.length > 0,
        latencyMs: Date.now() - start,
        message: kws.length > 0
          ? `Live free endpoint responded with ${kws.length} real keyword suggestions.`
          : 'Google Suggest endpoint did not return items (network restricted).',
      };
    }
    case 'ddg-ac-free': {
      const kws = await fetchDuckDuckGoSuggestKeywords('marketing analytics');
      return {
        ok: kws.length > 0,
        latencyMs: Date.now() - start,
        message: kws.length > 0
          ? `DuckDuckGo Autocomplete returned ${kws.length} live suggestions at $0 cost.`
          : 'DuckDuckGo Autocomplete endpoint unreachable from current network.',
      };
    }
    case 'wikipedia-free': {
      const topics = await fetchWikipediaTopics('marketing analytics');
      return {
        ok: topics.length > 0,
        latencyMs: Date.now() - start,
        message: topics.length > 0
          ? `Wikipedia OpenSearch returned ${topics.length} verified topic entities.`
          : 'Wikipedia API unreachable from current network.',
      };
    }
    case 'wikimedia-pageviews-free': {
      const pv = await fetchWikimediaPageviews('Search engine optimization');
      return {
        ok: Boolean(pv),
        latencyMs: Date.now() - start,
        message: pv
          ? `Wikimedia Pageviews API live (${pv.articleTitle}: ${pv.totalViews.toLocaleString()} views over 6 months).`
          : 'Wikimedia Pageviews endpoint unreachable.',
      };
    }
    case 'google-trends-rss-free': {
      const trends = await fetchGoogleTrendsRss('US', 'United States');
      return {
        ok: trends.length > 0,
        latencyMs: Date.now() - start,
        message: trends.length > 0
          ? `Google Trends RSS feed live (${trends.length} trending searches in US).`
          : 'Google Trends RSS unreachable or throttled.',
      };
    }
    case 'commoncrawl-free': {
      const cc = await fetchCommonCrawlDomainFootprint('wikipedia.org');
      return {
        ok: cc.indexedCount > 0,
        latencyMs: Date.now() - start,
        message: cc.indexedCount > 0
          ? `Common Crawl CDX Index live (${cc.indexedCount} sampled URLs for wikipedia.org).`
          : 'Common Crawl CDX endpoint unreachable or timed out.',
      };
    }
    case 'openalex-free': {
      const works = await fetchOpenAlexCitations('search engine optimization');
      return {
        ok: works.length > 0,
        latencyMs: Date.now() - start,
        message: works.length > 0
          ? `OpenAlex Research API live (${works.length} peer-reviewed works returned).`
          : 'OpenAlex API unreachable.',
      };
    }
    case 'github-search-free': {
      const repos = await fetchGitHubRepositories('seo audit');
      return {
        ok: repos.length > 0,
        latencyMs: Date.now() - start,
        message: repos.length > 0
          ? `GitHub Search API live (${repos[0]?.fullName} · ${repos[0]?.stars.toLocaleString()} stars).`
          : 'GitHub public search rate-limited or unreachable.',
      };
    }
    case 'hn-algolia-free': {
      const hits = await fetchHackerNewsDiscussions('seo analytics');
      return {
        ok: hits.length > 0,
        latencyMs: Date.now() - start,
        message: hits.length > 0
          ? `Hacker News Algolia returned ${hits.length} live community discussions.`
          : 'HN Algolia API unreachable.',
      };
    }
    case 'reddit-free': {
      const threads = await fetchRedditPublicThreads('saas marketing');
      return {
        ok: threads.length > 0,
        latencyMs: Date.now() - start,
        message: threads.length > 0
          ? `Reddit public JSON returned ${threads.length} live threads.`
          : 'Reddit public endpoint rate-limited or unreachable—graceful fallback active.',
      };
    }
    case 'duckduckgo-free': {
      try {
        const res = await fetch('https://api.duckduckgo.com/?q=search+engine+optimization&format=json&no_html=1', {
          signal: AbortSignal.timeout(3500),
        });
        return {
          ok: res.ok,
          latencyMs: Date.now() - start,
          message: res.ok ? 'DuckDuckGo Instant Answer API reachable (0 cost).' : `HTTP ${res.status}`,
        };
      } catch {
        return { ok: false, latencyMs: Date.now() - start, message: 'DuckDuckGo endpoint unreachable.' };
      }
    }
    case 'site-inspector-free': {
      const check = await inspectPublicWebsite('example.com');
      return {
        ok: Boolean(check?.reachable),
        latencyMs: Date.now() - start,
        message: check?.reachable
          ? `Built-in SSRF-safe inspector live (${check.responseMs}ms, title="${check.title}").`
          : 'Built-in inspector active in offline fallback mode.',
      };
    }
    case 'librecrawl-free': {
      const crawl = await inspectSiteSitemapAndLinks('iana.org');
      return {
        ok: Boolean(crawl),
        latencyMs: Date.now() - start,
        message: crawl
          ? `Built-in Sitemap & Link Crawler live (${crawl.auditedPagesCount} pages audited, ${crawl.brokenLinks.length} broken).`
          : 'Built-in Sitemap & Link Crawler ready.',
      };
    }
    case 'openpagerank-free': {
      if (!customCredential) {
        const tranco = await fetchTrancoDomainRanks(['wikipedia.org']);
        return {
          ok: true,
          latencyMs: Date.now() - start,
          message: tranco['wikipedia.org']
            ? `No-key Tranco Domain Rank fallback live (wikipedia.org score ${tranco['wikipedia.org']}/100). Add a free Open PageRank key (10K req/hr free) for full 10M+ domain authority.`
            : 'Open PageRank ready. Register a free API key at openpagerank.com (10,000 req/hr free) for live Domain Authority.',
        };
      }
      const scores = await fetchOpenPageRankScores(['google.com', 'wikipedia.org'], customCredential);
      const count = Object.keys(scores).length;
      return {
        ok: count > 0,
        latencyMs: Date.now() - start,
        message: count > 0
          ? `Open PageRank API verified live (wikipedia.org Authority ${scores['wikipedia.org']?.authority ?? 'N/A'}/100).`
          : 'Open PageRank API key rejected or unreachable.',
      };
    }
    case 'brave-search-free': {
      if (!customCredential) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Brave Search Free Data tier ready (2,000 free queries/mo). Save a Brave Search token to enrich live SERP results.',
        };
      }
      const hits = await fetchBraveSearchResults('seo keyword research', customCredential);
      return {
        ok: hits.length > 0,
        latencyMs: Date.now() - start,
        message: hits.length > 0
          ? `Live Brave Search API verified (${hits.length} live SERP URLs returned).`
          : 'Brave Search API returned 0 results or rejected token.',
      };
    }
    case 'serper-free': {
      if (!customCredential) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Serper.dev Free Starter ready (2,500 free Google SERP queries). Add your Serper API key for live Google SERPs & PAA.',
        };
      }
      const serper = await fetchSerperResults('seo keyword research', customCredential);
      return {
        ok: serper.organic.length > 0,
        latencyMs: Date.now() - start,
        message: serper.organic.length > 0
          ? `Live Serper.dev Google SERP verified (${serper.organic.length} organic results, ${serper.peopleAlsoAsk.length} PAA questions).`
          : 'Serper.dev returned 0 results or rejected API key.',
      };
    }
    case 'pagespeed-free': {
      const psi = await fetchPageSpeedInsights('example.com', customCredential);
      return {
        ok: Boolean(psi),
        latencyMs: Date.now() - start,
        message: psi
          ? `Live PageSpeed v5 responded: Performance ${psi.performanceScore}/100, SEO ${psi.seoScore}/100 (LCP ${psi.lcp}).`
          : 'PageSpeed v5 public quota reached or timed out—save an optional free Google API key for higher quota.',
      };
    }
    case 'youtube-free': {
      if (!customCredential) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Free YouTube adapter ready in demo mode. Paste a free Google Cloud YouTube API v3 key (10K units/day free) to enable live channel searches.',
        };
      }
      const yt = await fetchYouTubeSearchResults('marketing analytics', customCredential);
      return {
        ok: yt.length > 0,
        latencyMs: Date.now() - start,
        message: yt.length > 0
          ? `Live YouTube Data API v3 verified (${yt.length} channels/videos returned).`
          : 'YouTube Data API v3 returned no items or rejected the API key. Check YouTube Data API v3 is enabled in Google Cloud.',
      };
    }
    case 'gsc-free': {
      if (!gscAccessToken) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Click "Sign in with Google" in the Google Search Console panel to grant read-only access to your verified sites.',
        };
      }
      try {
        const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          signal: AbortSignal.timeout(4500),
          headers: { Authorization: `Bearer ${gscAccessToken}` },
        });
        if (!res.ok) {
          return {
            ok: false,
            latencyMs: Date.now() - start,
            message: `Google Search Console API returned HTTP ${res.status}. Ensure Search Console API is enabled on your Google account.`,
          };
        }
        const json = (await res.json()) as { siteEntry?: { siteUrl: string }[] };
        const count = json.siteEntry?.length ?? 0;
        return {
          ok: true,
          latencyMs: Date.now() - start,
          message: `Google Search Console OAuth live (${count} verified site property/properties accessible).`,
        };
      } catch {
        return { ok: false, latencyMs: Date.now() - start, message: 'Unable to reach Google Search Console API.' };
      }
    }
    case 'searxng-free': {
      if (!customCredential) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Free self-hosted adapter ready. Enter your SearXNG instance URL to query live metasearch.',
        };
      }
      const safe = await validatePublicHttpUrl(customCredential);
      if (!safe) {
        return { ok: false, latencyMs: 0, message: 'Invalid or private/internal URL blocked for safety.' };
      }
      const hits = await fetchSearxngResults('audience research', customCredential);
      return {
        ok: hits.length > 0,
        latencyMs: Date.now() - start,
        message: hits.length > 0
          ? `Live SearXNG JSON endpoint verified (${hits.length} results from ${safe.origin}).`
          : `Validated public host ${safe.origin}, but /search?format=json returned no JSON results (ensure JSON format is enabled in SearXNG settings.yml).`,
      };
    }
    case 'firecrawl-oss': {
      if (!customCredential) {
        return {
          ok: true,
          latencyMs: 0,
          message: 'Self-hosted Firecrawl / Crawl4AI adapter ready. Enter your public self-hosted crawler URL for live markdown extraction.',
        };
      }
      const safe = await validatePublicHttpUrl(customCredential);
      if (!safe) {
        return { ok: false, latencyMs: 0, message: 'Invalid or private/internal URL blocked for safety.' };
      }
      const scraped = await fetchFirecrawlScrape('https://example.com', customCredential);
      return {
        ok: Boolean(scraped),
        latencyMs: Date.now() - start,
        message: scraped
          ? `Self-hosted Firecrawl instance verified at ${safe.origin}.`
          : `Validated host ${safe.origin}, waiting for /v1/scrape JSON response.`,
      };
    }
    case 'ssl-crtsh-free': {
      const ssl = await inspectSslAndSubdomains('wikipedia.org');
      return {
        ok: Boolean(ssl?.sslValid),
        latencyMs: Date.now() - start,
        message: ssl
          ? `TLS ${ssl.tlsProtocol} (${ssl.sslValid ? 'Valid' : 'Issue'}, expires in ${ssl.sslExpiryDays}d, ${ssl.subdomainsCount} crt.sh subdomains).`
          : 'Unable to verify TLS / crt.sh endpoint.',
      };
    }
    case 'wikidata-sparql-free': {
      const entities = await fetchWikidataEntityGraph('OpenAI');
      return {
        ok: entities.length > 0,
        latencyMs: Date.now() - start,
        message: entities.length > 0
          ? `Wikidata SPARQL live (${entities[0]?.qid}: ${entities[0]?.label}${entities[0]?.officialWebsite ? ` · ${entities[0].officialWebsite}` : ''}).`
          : 'Wikidata SPARQL endpoint unreachable.',
      };
    }
    case 'rss-news-free': {
      const news = await fetchIndustryNewsRss('search engine optimization', customCredential, 'US', 'en');
      return {
        ok: news.length > 0,
        latencyMs: Date.now() - start,
        message: news.length > 0
          ? `Live RSS Aggregator verified (${news.length} industry headlines parsed).`
          : 'Unable to fetch RSS/Atom news feed.',
      };
    }
    case 'oss-analytics-free': {
      const analytics = await fetchOssVisitorAnalytics(customCredential);
      return {
        ok: analytics.configured && (analytics.visitors30d !== undefined || analytics.pageviews30d !== undefined),
        latencyMs: Date.now() - start,
        message: analytics.message,
      };
    }
    default:
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: customCredential
          ? 'Free credential saved on server. Adapter ready for live requests.'
          : 'Free adapter active in zero-cost demonstration mode. Add optional free key/URL anytime.',
      };
  }
}
