import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHtmlSeoMeta,
  extractInternalLinksFromHtml,
  fetchBraveSearchResults,
  fetchCommonCrawlDomainFootprint,
  fetchFirecrawlScrape,
  fetchOpenPageRankScores,
  fetchOssVisitorAnalytics,
  fetchSearxngResults,
  fetchSerperResults,
  fetchYouTubeSearchResults,
  inspectSiteSitemapAndLinks,
  inspectSslAndSubdomains,
  isPrivateOrReservedIp,
  parseCrtShCertificates,
  parseGoogleTrendsRssXml,
  parseOssAnalyticsConfig,
  parseRssOrAtomFeedXml,
  parseSitemapLocUrls,
  parseWikidataSparqlBindings,
  testFreeProviderConnection,
  validatePublicHttpUrl,
} from './freeProviders';

test('isPrivateOrReservedIp blocks loopback, link-local, and RFC1918 private addresses', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
  assert.equal(isPrivateOrReservedIp('172.16.4.2'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
});

test('validatePublicHttpUrl rejects localhost, internal domains, and raw IP literals', async () => {
  assert.equal(await validatePublicHttpUrl('http://localhost:3000'), null);
  assert.equal(await validatePublicHttpUrl('http://127.0.0.1/admin'), null);
  assert.equal(await validatePublicHttpUrl('http://169.254.169.254/latest/meta-data'), null);
  assert.equal(await validatePublicHttpUrl('file:///etc/passwd'), null);
  assert.equal(await validatePublicHttpUrl('http://printer.local'), null);
});

test('extractHtmlSeoMeta parses title, meta description, h1 count, canonical, and JSON-LD', () => {
  const html = `<!doctype html><html><head>
    <title>AudiencePulse AI — Marketing Intelligence</title>
    <meta name="description" content="Free audience and SEO intelligence tools." />
    <link rel="canonical" href="https://example.com/" />
    <script type="application/ld+json">{"@type":"WebSite"}</script>
  </head><body><h1>Headline</h1></body></html>`;

  const parsed = extractHtmlSeoMeta(html);
  assert.equal(parsed.title, 'AudiencePulse AI — Marketing Intelligence');
  assert.equal(parsed.metaDescription, 'Free audience and SEO intelligence tools.');
  assert.equal(parsed.h1Count, 1);
  assert.equal(parsed.hasCanonical, true);
  assert.equal(parsed.hasJsonLd, true);
});

test('fetchSearxngResults and fetchFirecrawlScrape block private hosts and key-based adapters guard missing keys', async () => {
  const blocked = await fetchSearxngResults('seo', 'http://127.0.0.1:8080');
  assert.deepEqual(blocked, []);
  const blockedFirecrawl = await fetchFirecrawlScrape('https://example.com', 'http://127.0.0.1:3002');
  assert.equal(blockedFirecrawl, null);
  const noYt = await fetchYouTubeSearchResults('seo', '');
  assert.deepEqual(noYt, []);
  assert.deepEqual(await fetchBraveSearchResults('seo', ''), []);
  assert.deepEqual(await fetchSerperResults('seo', ''), { organic: [], peopleAlsoAsk: [] });
  assert.deepEqual(await fetchOpenPageRankScores(['example.com'], ''), {});
});

test('parseGoogleTrendsRssXml extracts localized trending searches cleanly', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss><channel>
    <item>
      <title><![CDATA[AI Search Optimization &amp; SEO]]></title>
      <ht:approx_traffic>50,000+</ht:approx_traffic>
      <ht:news_item_title>Search engines expand AI answers</ht:news_item_title>
      <ht:news_item_url>https://example.com/news/ai-search</ht:news_item_url>
    </item>
    <item>
      <title>Local Plumber Near Me</title>
      <ht:approx_traffic>10,000+</ht:approx_traffic>
      <link>javascript:alert(1)</link>
    </item>
  </channel></rss>`;

  const parsed = parseGoogleTrendsRssXml(sampleXml, 'United States');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'AI Search Optimization & SEO');
  assert.equal(parsed[0].approxTraffic, '50,000+');
  assert.equal(parsed[0].url, 'https://example.com/news/ai-search');
  assert.equal(parsed[1].url, undefined);
});

test('parseSitemapLocUrls and extractInternalLinksFromHtml parse safe public HTTP URLs only', () => {
  const xml = `
    <urlset>
      <url><loc>https://example.com/pricing</loc></url>
      <url><loc>https://example.com/blog/seo</loc></url>
      <url><loc>https://example.com/pricing</loc></url>
      <url><loc>file:///etc/passwd</loc></url>
    </urlset>
  `;
  const locs = parseSitemapLocUrls(xml);
  assert.deepEqual(locs, ['https://example.com/pricing', 'https://example.com/blog/seo']);

  const html = `
    <a href="/features">Features</a>
    <a href="https://example.com/docs">Docs</a>
    <a href="https://external.org/out">External</a>
    <a href="javascript:void(0)">JS</a>
    <a href="mailto:hi@example.com">Mail</a>
  `;
  const internal = extractInternalLinksFromHtml(html, 'https://example.com');
  assert.deepEqual(internal, ['https://example.com/features', 'https://example.com/docs']);
});

test('fetchCommonCrawlDomainFootprint and inspectSiteSitemapAndLinks block private/internal targets', async () => {
  const ccBlocked = await fetchCommonCrawlDomainFootprint('http://127.0.0.1:8080');
  assert.deepEqual(ccBlocked, { indexedCount: 0, samples: [] });

  const crawlBlocked = await inspectSiteSitemapAndLinks('http://169.254.169.254/latest/meta-data');
  assert.equal(crawlBlocked, null);

  const ytDefault = await testFreeProviderConnection('youtube-free');
  assert.equal(ytDefault.ok, true);
  assert.ok(ytDefault.message.includes('YouTube'));
});

test('parseCrtShCertificates extracts unique matching subdomains and issuers', () => {
  const result = parseCrtShCertificates(
    [
      { name_value: '*.example.com\napi.example.com\nunrelated.org', issuer_name: 'C=US, O=Let\'s Encrypt, CN=R3' },
      { name_value: 'app.example.com\napi.example.com', issuer_name: 'C=US, O=DigiCert Inc, CN=DigiCert' },
    ],
    'example.com'
  );
  assert.equal(result.certCount, 2);
  assert.deepEqual(result.subdomains, ['example.com', 'api.example.com', 'app.example.com']);
  assert.deepEqual(result.issuers, ["Let's Encrypt", 'DigiCert Inc']);
});

test('parseWikidataSparqlBindings maps entity QIDs, official sites, industries, and founding years', () => {
  const entities = parseWikidataSparqlBindings([
    {
      item: { value: 'http://www.wikidata.org/entity/Q3884' },
      itemLabel: { value: 'Amazon' },
      itemDescription: { value: 'American multinational technology company' },
      officialWebsite: { value: 'https://www.amazon.com' },
      industryLabel: { value: 'e-commerce' },
      inception: { value: '1994-07-05T00:00:00Z' },
    },
    {
      item: { value: 'http://www.wikidata.org/entity/Q3884' },
      itemLabel: { value: 'Amazon' },
    },
  ]);
  assert.equal(entities.length, 1);
  assert.equal(entities[0].qid, 'Q3884');
  assert.equal(entities[0].officialWebsite, 'https://www.amazon.com');
  assert.equal(entities[0].industry, 'e-commerce');
  assert.equal(entities[0].inception, '1994');
  assert.equal(entities[0].wikidataUrl, 'https://www.wikidata.org/wiki/Q3884');
});

test('parseRssOrAtomFeedXml handles both RSS 2.0 items and Atom entries safely', () => {
  const feedXml = `<?xml version="1.0"?>
  <feed>
    <item>
      <title><![CDATA[<b>AI SEO</b> Update]]></title>
      <link>https://news.example.com/ai-seo</link>
      <source>Search Journal</source>
      <pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate>
    </item>
    <entry>
      <title>Technical Crawl Guide</title>
      <link rel="alternate" href="https://blog.example.org/crawl" />
      <published>2026-11-23T08:30:00Z</published>
    </entry>
    <item>
      <title>Unsafe Script</title>
      <link>javascript:alert(1)</link>
    </item>
  </feed>`;
  const parsed = parseRssOrAtomFeedXml(feedXml, 'Custom Feed');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'AI SEO Update');
  assert.equal(parsed[0].source, 'Search Journal');
  assert.equal(parsed[1].url, 'https://blog.example.org/crawl');
  assert.equal(parsed[1].source, 'Custom Feed');
});

test('parseOssAnalyticsConfig and security checks block private hosts for SSL and OSS analytics', async () => {
  assert.equal(parseOssAnalyticsConfig(''), null);
  const umami = parseOssAnalyticsConfig('umami|https://analytics.example.com|site-1|tok-123');
  assert.deepEqual(umami, {
    kind: 'umami',
    baseUrl: 'https://analytics.example.com',
    siteOrProjectId: 'site-1',
    token: 'tok-123',
  });

  const sslBlocked = await inspectSslAndSubdomains('http://127.0.0.1:8443');
  assert.equal(sslBlocked, null);

  const ossBlocked = await fetchOssVisitorAnalytics('posthog|http://169.254.169.254|1|phx_test');
  assert.equal(ossBlocked.configured, false);
  assert.ok(ossBlocked.message.includes('blocked'));

  const ossProbe = await testFreeProviderConnection('oss-analytics-free', '');
  assert.equal(ossProbe.ok, false);
});

