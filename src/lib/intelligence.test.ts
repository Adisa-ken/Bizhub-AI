import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlanUsage,
  formatExportCsv,
  generateAudienceProfile,
  generateCompetitorComparison,
  generateSeoToolData,
  normalizeDomain,
  validateSafeUrl,
} from './intelligence';
import type { PlanConfig } from '../types';

test('generateAudienceProfile produces all 9 interconnected modules deterministically', () => {
  const first = generateAudienceProfile('B2B SaaS Founders', 'United States', 'English', 'SaaS');
  const second = generateAudienceProfile('B2B SaaS Founders', 'United States', 'English', 'SaaS');

  assert.equal(first.socialNetworks.length, 10);
  assert.equal(first.socialNetworks[0].audiencePct, second.socialNetworks[0].audiencePct);
  assert.ok(first.demographics.length >= 10);
  assert.equal(first.searchAndAi.length, 6);
  assert.ok(first.websiteVisitation.length >= 6);
  assert.ok(first.keywords.length >= 6);
  assert.ok(first.mediaConsumption.length >= 5);
  assert.ok(first.redditCommunities.length >= 4);
  assert.ok(first.socialAccounts.length >= 4);
  assert.ok(first.topicsOfInterest.length >= 4);
  assert.ok(first.socialAccounts.some((acc) => acc.observationKind === 'Observed Public Profile'));
});

test('generateCompetitorComparison caps at 5 unique normalized domains', () => {
  const competitors = generateCompetitorComparison(
    ['https://www.ahrefs.com/blog', 'semrush.com', 'AHREFS.COM', 'sparktoro.com', 'similarweb.com', 'moz.com', 'ubersuggest.com'],
    'SEO Software'
  );
  assert.equal(competitors.length, 5);
  assert.equal(competitors[0].domain, 'ahrefs.com');
  assert.equal(competitors[1].domain, 'semrush.com');
});

test('generateSeoToolData returns structured columns and rows for all 12 tools', () => {
  const tools = [
    'keyword-explorer',
    'serp-analyzer',
    'website-explorer',
    'backlink-explorer',
    'competitor-research',
    'keyword-gap',
    'rank-tracker',
    'technical-audit',
    'content-explorer',
    'content-gap',
    'search-intent',
    'ai-visibility',
  ] as const;

  for (const toolId of tools) {
    const result = generateSeoToolData(toolId, 'audiencepulse.ai', 'United States', 'Google');
    assert.equal(result.toolId, toolId);
    assert.ok(result.columns.length >= 4);
    assert.ok(result.rows.length >= 3);
    assert.ok(result.summaryMetrics.length >= 3);
  }
});

test('computePlanUsage accurately calculates credit thresholds', () => {
  const freePlan: PlanConfig = {
    id: 'free',
    name: 'Free',
    audienceTag: 'For individuals exploring audience research',
    monthlyPriceUsd: 0,
    monthlyCredits: 25,
    maxCompetitors: 2,
    maxWorkspaces: 1,
    aiMessagesPerMonth: 15,
    whiteLabelReports: false,
    highlights: [],
  };

  const near = computePlanUsage(21, freePlan);
  assert.equal(near.remaining, 4);
  assert.equal(near.pctUsed, 84);
  assert.equal(near.isNearLimit, true);
  assert.equal(near.isExhausted, false);

  const over = computePlanUsage(25, freePlan);
  assert.equal(over.isExhausted, true);
});

test('formatExportCsv escapes commas and quotes safely and validateSafeUrl blocks javascript:', () => {
  const csv = formatExportCsv(['Keyword', 'Note'], [{ Keyword: 'b2b, saas', Note: 'Say "hello"' }]);
  assert.equal(csv, 'Keyword,Note\n"b2b, saas","Say ""hello"""');
  assert.equal(validateSafeUrl('https://audiencepulse.ai/report'), 'https://audiencepulse.ai/report');
  assert.equal(validateSafeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeDomain('https://www.Example.COM/pricing'), 'example.com');
});
