import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SEARCH_ENGINES,
  ALL_STATES_LABEL,
  COUNTRIES,
  formatGeoLabel,
  formatSelectedStates,
  getCountryIsoCode,
  getStatesForCountry,
  GLOBAL_COUNTRY_LABEL,
  parseSelectedStates,
} from './geoAndEngines';
import { generateAudienceProfile, generateSeoToolData } from './intelligence';

test('COUNTRIES includes Global plus 190+ countries worldwide with ISO codes', () => {
  assert.equal(COUNTRIES[0].name, GLOBAL_COUNTRY_LABEL);
  assert.ok(COUNTRIES.length >= 195);
  assert.equal(getCountryIsoCode(GLOBAL_COUNTRY_LABEL), '');
  assert.equal(getCountryIsoCode('United States'), 'US');
  assert.equal(getCountryIsoCode('Nigeria'), 'NG');
  assert.equal(getCountryIsoCode('United Kingdom'), 'GB');
  assert.equal(getCountryIsoCode('Japan'), 'JP');
});

test('STATES_BY_COUNTRY and state helpers handle country presets and multi-state choices', () => {
  const usStates = getStatesForCountry('United States');
  assert.equal(usStates.length, 51);
  assert.ok(usStates.includes('California'));
  assert.ok(usStates.includes('Texas'));

  const ngStates = getStatesForCountry('Nigeria');
  assert.equal(ngStates.length, 37);
  assert.ok(ngStates.includes('Lagos'));
  assert.ok(ngStates.includes('FCT (Abuja)'));

  assert.deepEqual(parseSelectedStates(ALL_STATES_LABEL), []);
  assert.deepEqual(parseSelectedStates('California, Texas, California'), ['California', 'Texas']);
  assert.equal(formatSelectedStates([]), ALL_STATES_LABEL);
  assert.equal(formatSelectedStates(['Lagos', 'Rivers']), 'Lagos, Rivers');
  assert.equal(formatGeoLabel('Nigeria', 'Lagos, Rivers'), 'Nigeria · Lagos, Rivers');
});

test('ALL_SEARCH_ENGINES includes traditional, social, marketplace, and AI search engines', () => {
  for (const required of [
    'Google',
    'Bing',
    'DuckDuckGo',
    'Brave Search',
    'Baidu',
    'Yandex',
    'YouTube',
    'TikTok',
    'Amazon',
    'ChatGPT Search',
    'Perplexity',
    'Gemini',
    'Claude',
  ]) {
    assert.ok(ALL_SEARCH_ENGINES.includes(required), `Missing search engine: ${required}`);
  }
});

test('generateAudienceProfile and generateSeoToolData respect state and expanded search engines', () => {
  const seo = generateSeoToolData('keyword-explorer', 'saas crm', 'Nigeria', 'DuckDuckGo', 'Lagos, Abuja');
  assert.equal(seo.country, 'Nigeria');
  assert.equal(seo.state, 'Lagos, Abuja');
  assert.equal(seo.searchEngine, 'DuckDuckGo');
  assert.ok(seo.rows.some((r) => String(r.Keyword).toLowerCase().includes('lagos')));

  const intel = generateAudienceProfile('Ecommerce Founders', 'Nigeria', 'English', 'E-Commerce', 'Lagos, Rivers', 'TikTok');
  assert.equal(intel.country, 'Nigeria');
  assert.equal(intel.state, 'Lagos, Rivers');
  assert.equal(intel.searchEngine, 'TikTok');
  assert.ok(intel.demographics.some((d) => d.category === 'state' && d.label.includes('Lagos')));

  const globalIntel = generateAudienceProfile('AI SaaS', GLOBAL_COUNTRY_LABEL, 'English', 'SaaS', ALL_STATES_LABEL, 'All Engines');
  assert.equal(globalIntel.country, GLOBAL_COUNTRY_LABEL);
  assert.ok(globalIntel.demographics.some((d) => d.category === 'country' && d.label === 'United States'));
  assert.ok(globalIntel.demographics.some((d) => d.category === 'country' && d.label === 'Nigeria & Africa'));
});
