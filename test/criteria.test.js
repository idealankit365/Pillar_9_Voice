import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeListingCriteria } from '../src/criteria.js';

const cases=JSON.parse(fs.readFileSync(new URL('../datasets/criteria-examples.json',import.meta.url)));
for(const sample of cases.slice(0,18))test(`criteria ${sample.id}`,()=>{const result=normalizeListingCriteria({utterance:sample.utterance});if(sample.expectedConflict)return assert.ok(result.conflicts.includes(sample.expectedConflict));for(const [key,value] of Object.entries(sample.expected||{})){if(key==='mustOrNiceFeature'){assert.ok([...(result.criteria.mustHave||[]),...(result.criteria.niceToHave||[])].includes(value));continue;}if(Array.isArray(value))assert.deepEqual([...(result.criteria[key]||[])].sort(),[...value].sort(),`${key}: ${JSON.stringify(result)}`);else assert.deepEqual(result.criteria[key],value,`${key}: ${JSON.stringify(result)}`);}});
test('criteria does not broaden NW Calgary to all Calgary',()=>{assert.deepEqual(normalizeListingCriteria({utterance:'NW Calgary'}).criteria.areas,['NW Calgary']);});
test('criteria detects inverted range',()=>{const result=normalizeListingCriteria({criteria:{priceMin:800000,priceMax:700000}});assert.ok(result.conflicts.includes('price_min_exceeds_price_max'));});
test('criteria asks for missing maximum first',()=>{assert.match(normalizeListingCriteria({utterance:'three beds in Airdrie'}).nextBestQuestion,/highest purchase price/i);});
