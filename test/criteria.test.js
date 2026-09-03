import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeListingCriteria } from '../src/criteria.js';

const cases=JSON.parse(fs.readFileSync(new URL('../datasets/criteria-examples.json',import.meta.url)));
for(const sample of cases.slice(0,18))test(`criteria ${sample.id}`,()=>{const result=normalizeListingCriteria({utterance:sample.utterance});if(sample.expectedConflict)return assert.ok(result.conflicts.includes(sample.expectedConflict));for(const [key,value] of Object.entries(sample.expected||{})){if(key==='mustOrNiceFeature'){assert.ok([...(result.criteria.mustHave||[]),...(result.criteria.niceToHave||[])].includes(value));continue;}if(Array.isArray(value))assert.deepEqual([...(result.criteria[key]||[])].sort(),[...value].sort(),`${key}: ${JSON.stringify(result)}`);else assert.deepEqual(result.criteria[key],value,`${key}: ${JSON.stringify(result)}`);}});
test('criteria does not broaden NW Calgary to all Calgary',()=>{assert.deepEqual(normalizeListingCriteria({utterance:'NW Calgary'}).criteria.areas,['NW Calgary']);});
test('criteria canonicalizes natural quadrant names supplied by the voice model',()=>{assert.deepEqual(normalizeListingCriteria({criteria:{areas:['Southwest Calgary']}}).criteria.areas,['SW Calgary']);});
test('criteria detects inverted range',()=>{const result=normalizeListingCriteria({criteria:{priceMin:800000,priceMax:700000}});assert.ok(result.conflicts.includes('price_min_exceeds_price_max'));});
test('criteria asks for missing maximum first',()=>{assert.match(normalizeListingCriteria({utterance:'three beds in Airdrie'}).nextBestQuestion,/highest purchase price/i);});

test('an implausible spoken budget is rejected rather than searched', () => {
  // Real call: "five thousand million dollars" parsed to $5,000,000,000, was confirmed,
  // and searched — guaranteeing zero results and a dead-end conversation.
  const result = normalizeListingCriteria({ utterance: 'I want a home in southwest Calgary with two bedrooms, my budget is about five thousand million dollars' });
  assert.equal(result.criteria.priceMax, undefined, 'a billion-dollar budget must not survive');
  assert.equal(result.criteria.priceMin, undefined);
  assert.equal(result.criteria.priceTarget, undefined);
  assert.ok(result.conflicts.includes('price_out_of_expected_range'));
  assert.match(result.nextBestQuestion, /did not.*hear your budget correctly|do not think I heard your budget/i);
  // the rest of the utterance must still be captured
  assert.equal(result.criteria.bedroomsMin, 2);
  assert.deepEqual(result.criteria.areas, ['SW Calgary']);
});

test('realistic budgets are untouched by the plausibility bounds', () => {
  assert.equal(normalizeListingCriteria({ utterance: 'under seven hundred thousand' }).criteria.priceMax, 700000);
  assert.equal(normalizeListingCriteria({ utterance: 'budget around five hundred thousand dollars' }).criteria.priceTarget, 500000);
  assert.equal(normalizeListingCriteria({ utterance: 'up to two million dollars' }).criteria.priceMax, 2000000);
  assert.deepEqual(normalizeListingCriteria({ utterance: 'my budget is twelve dollars' }).conflicts, [], 'too small to be a price at all, so no price is parsed');
});
