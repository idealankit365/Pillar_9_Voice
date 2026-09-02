import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Repository } from '../src/db.js';
import { MatrixAdapter } from '../src/adapters.js';
import { SYNTHETIC_PROPERTY_FIELD_NAMES } from '../src/synthetic-calgary.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixturePath=path.join(root,'fixtures','calgary-synthetic-5000.sqlite');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'datasets','synthetic-calgary','manifest.json'),'utf8'));

test('packaged Calgary fixture contains exactly 5,000 synthetic properties and complete catalog coverage',()=>{const db=new DatabaseSync(fixturePath,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) AS count FROM listings').get().count,5000);assert.equal(db.prepare('SELECT count(*) AS count FROM listings WHERE synthetic=1').get().count,5000);const catalog=db.prepare('SELECT count(*) AS count FROM synthetic_street_catalog').get().count;const covered=db.prepare('SELECT count(DISTINCT street_key) AS count FROM synthetic_listing_streets').get().count;assert.equal(catalog,8784);assert.equal(covered,catalog);const roads=db.prepare('SELECT count(*) AS count FROM synthetic_major_road_catalog').get().count;const coveredRoads=db.prepare('SELECT count(DISTINCT road_key) AS count FROM synthetic_listing_roads').get().count;assert.equal(roads,380);assert.equal(coveredRoads,roads);assert.equal(db.prepare('SELECT count(DISTINCT community) AS count FROM listings').get().count,223);}finally{db.close();}});

test('manifest records deterministic property-level splits and successful validation',()=>{assert.equal(manifest.propertyCount,5000);assert.equal(manifest.schemaFieldCount,119);assert.equal(manifest.validation.ok,true);assert.equal(Object.values(manifest.counts.trainingSplit).reduce((sum,value)=>sum+value,0),5000);assert.equal(manifest.coveredStreetCount,manifest.streetCatalogCount);assert.equal(manifest.coveredMajorRoadCount,manifest.majorRoadCatalogCount);assert.equal(manifest.coveredCommunityCount,manifest.communityCatalogCount);});

test('a database record contains every documented field and no private Matrix fields',()=>{const repo=new Repository(fixturePath);try{const listing=repo.getListing('SYN-CGY-000001');for(const field of SYNTHETIC_PROPERTY_FIELD_NAMES)assert.ok(Object.hasOwn(listing,field),`missing ${field}`);assert.equal(listing.synthetic,true);assert.match(listing.syntheticNotice,/not a real listing/i);assert.equal(listing.privateRemarks,undefined);assert.equal(listing.showingInstructions,undefined);}finally{repo.close();}});

test('fixture recommendation search ranks active public matches and labels them synthetic',()=>{const repo=new Repository(fixturePath);try{const matrix=new MatrixAdapter({mode:'fixture'},repo);const result=matrix.fixtureSearch({areas:['Abbeydale'],priceMax:1800000,bedroomsMin:2,niceToHave:['double garage']},5);assert.ok(result.count>0);assert.ok(result.listings.length>0&&result.listings.length<=5);assert.equal(result.listings.every((listing)=>listing.status==='ACTIVE'&&listing.synthetic),true);assert.match(result.statusNotice,/synthetic training data/i);assert.equal(result.listings[0].recordHash,undefined);assert.ok(Number.isInteger(result.listings[0].matchScore));}finally{repo.close();}});
