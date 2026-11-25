import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBulkKeywordAnalysis,
  buildFaqJsonLdSnippet,
  buildUbersuggestOverviewBaseline,
  categorizeKeywordIdea,
  computePaidDifficulty,
  formatCompactMonthlyVolume,
  getCurrencyForCountry,
  getIntentBadgeMeta,
  getLanguageCode,
  getSeoDifficultySignalMeta,
  parseBulkKeywordInput,
} from './ubersuggest';

test('getCurrencyForCountry resolves localized currency codes and symbols', () => {
  assert.equal(getCurrencyForCountry('Saudi Arabia').code, 'SAR');
  assert.equal(getCurrencyForCountry('Nigeria').symbol, '₦');
  assert.equal(getCurrencyForCountry('United Kingdom').symbol, '£');
  assert.equal(getCurrencyForCountry('United States').code, 'USD');
});

test('getLanguageCode maps supported language names to ISO codes', () => {
  assert.equal(getLanguageCode('Arabic'), 'ar');
  assert.equal(getLanguageCode('Spanish'), 'es');
  assert.equal(getLanguageCode('English'), 'en');
});

test('parseBulkKeywordInput splits lines/CSV, trims quotes, dedupes, and caps at 25', () => {
  const raw = `"seo tools"\n"seo tools"\nplumber near me, ai search\n a \n` +
    Array.from({ length: 30 }, (_, i) => `keyword ${i + 1}`).join('\n');
  const parsed = parseBulkKeywordInput(raw);
  assert.equal(parsed.length, 25);
  assert.equal(parsed[0], 'seo tools');
  assert.equal(parsed[1], 'plumber near me');
  assert.equal(parsed[2], 'ai search');
});

test('categorizeKeywordIdea classifies autocomplete, questions, prepositions, and comparisons', () => {
  assert.equal(categorizeKeywordIdea('how to choose plumber', 'plumber'), 'questions');
  assert.equal(categorizeKeywordIdea('plumber near Riyadh', 'plumber'), 'prepositions');
  assert.equal(categorizeKeywordIdea('plumber vs handyman', 'plumber'), 'comparisons');
  assert.equal(categorizeKeywordIdea('plumber 24 7 emergency', 'plumber'), 'autocomplete');
});

test('buildUbersuggestOverviewBaseline populates all 4 keyword idea categories, localized prompts, age brackets, and SERP results', () => {
  const overview = buildUbersuggestOverviewBaseline({
    keyword: 'plumber near me',
    country: 'Saudi Arabia',
    state: 'Riyadh',
    language: 'Arabic',
    searchEngine: 'Google',
  });

  assert.equal(overview.cpcCurrencyCode, 'SAR');
  assert.equal(overview.keywordIdeas.autocomplete.length > 0, true);
  assert.equal(overview.keywordIdeas.questions.length > 0, true);
  assert.equal(overview.keywordIdeas.prepositions.length > 0, true);
  assert.equal(overview.keywordIdeas.comparisons.length > 0, true);
  assert.ok(typeof overview.paidDifficulty === 'number' && overview.paidDifficulty >= 1);
  assert.ok(typeof overview.keywordIdeas.autocomplete[0].paidDifficulty === 'number');
  assert.equal(overview.aiPromptIdeas.length >= 5, true);
  assert.equal(overview.audienceAge.length, 6);
  assert.equal(overview.searchResults.length >= 5, true);
  assert.equal(overview.deviceSplit.desktopPct + overview.deviceSplit.mobilePct, 100);
});

test('buildBulkKeywordAnalysis returns localized currency metrics for each keyword', () => {
  const rows = buildBulkKeywordAnalysis({
    keywords: ['seo audit', 'plumber near me'],
    country: 'Nigeria',
    language: 'English',
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].currencySymbol, '₦');
  assert.ok(rows[0].volume > 0);
  assert.ok(typeof rows[0].paidDifficulty === 'number');
});

test('buildFaqJsonLdSnippet generates valid Schema.org FAQPage JSON-LD markup', () => {
  const overview = buildUbersuggestOverviewBaseline({
    keyword: 'audience intelligence',
    country: 'United States',
    state: 'California',
    language: 'English',
    searchEngine: 'Google',
  });
  assert.ok(overview.faqJsonLdSnippet);
  const raw = buildFaqJsonLdSnippet('audience intelligence', overview.keywordIdeas.questions, 'United States');
  const parsed = JSON.parse(raw) as {
    '@context': string;
    '@type': string;
    mainEntity: { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[];
  };
  assert.equal(parsed['@context'], 'https://schema.org');
  assert.equal(parsed['@type'], 'FAQPage');
  assert.ok(parsed.mainEntity.length >= 2);
  assert.equal(parsed.mainEntity[0]['@type'], 'Question');
});

test('formatCompactMonthlyVolume, computePaidDifficulty, intent badges, and SD signals format indicators cleanly', () => {
  assert.equal(formatCompactMonthlyVolume(1300), '1.3K');
  assert.equal(formatCompactMonthlyVolume(2000), '2K');
  assert.equal(formatCompactMonthlyVolume(1250000), '1.3M');
  assert.equal(formatCompactMonthlyVolume(420), '420');

  const pd = computePaidDifficulty(42, 3.5, 'Transactional');
  assert.ok(pd >= 1 && pd <= 99);

  assert.equal(getIntentBadgeMeta('Commercial').letter, 'C');
  assert.equal(getIntentBadgeMeta('Informational').letter, 'I');
  assert.equal(getIntentBadgeMeta('Transactional').letter, 'T');
  assert.equal(getIntentBadgeMeta('Navigational').letter, 'N');

  assert.equal(getSeoDifficultySignalMeta(18).fppLabel, 'High FPP');
  assert.equal(getSeoDifficultySignalMeta(23).bars, 2);
  assert.equal(getSeoDifficultySignalMeta(72).label, 'High');
});
