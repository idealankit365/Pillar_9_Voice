import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from '../src/config.js';
import { Repository, seedRepository } from '../src/db.js';
import { buildSyntheticSchemaDocument, catalogSourceMetadata, COMMUNITY_DATASET_ID, generateSyntheticCalgaryDataset, MAJOR_ROAD_DATASET_ID, seedSyntheticCalgary, STREET_DATASET_ID } from '../src/synthetic-calgary.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const datasetDirectory=path.join(root,'datasets','synthetic-calgary');
const fixtureDirectory=path.join(root,'fixtures');
const streetSnapshotPath=path.join(datasetDirectory,'calgary-street-catalog.snapshot.json');
const communitySnapshotPath=path.join(datasetDirectory,'calgary-residential-communities.snapshot.json');
const majorRoadSnapshotPath=path.join(datasetDirectory,'calgary-major-roads.snapshot.json');
const jsonlPath=path.join(datasetDirectory,'properties.jsonl');
const schemaPath=path.join(datasetDirectory,'property-schema.json');
const manifestPath=path.join(datasetDirectory,'manifest.json');
const databasePath=path.join(fixtureDirectory,'calgary-synthetic-5000.sqlite');

function argument(name,fallback){const prefix=`--${name}=`;const value=process.argv.find((item)=>item.startsWith(prefix));return value?value.slice(prefix.length):fallback;}
const refresh=process.argv.includes('--refresh-catalogs');
const count=Number(argument('count','5000'));
const seed=argument('seed','pillar9-calgary-5000-v1');
const generatedAt=new Date(argument('generated-at','2026-08-30T00:00:00.000Z')).toISOString();

async function getJson(url){const response=await fetch(url,{headers:{accept:'application/json','user-agent':'Pillar9-Synthetic-Fixture-Builder/1.0'}});if(!response.ok)throw new Error(`Catalog request failed with HTTP ${response.status}: ${url}`);return response.json();}
async function refreshCatalogs(){
  const streetUrl=new URL(`https://data.calgary.ca/resource/${STREET_DATASET_ID}.json`);streetUrl.searchParams.set('$select','street_name,street_type,street_quad,address_count');streetUrl.searchParams.set('$limit','50000');streetUrl.searchParams.set('$order','street_name,street_type,street_quad');
  const communityUrl=new URL(`https://data.calgary.ca/resource/${COMMUNITY_DATASET_ID}.json`);communityUrl.searchParams.set('$select','class,comm_code,name,sector,srg,comm_structure');communityUrl.searchParams.set('$where',"class='Residential'");communityUrl.searchParams.set('$limit','5000');communityUrl.searchParams.set('$order','name');
  const majorRoadUrl=new URL(`https://data.calgary.ca/resource/${MAJOR_ROAD_DATASET_ID}.json`);majorRoadUrl.searchParams.set('$select','full_name,count(*) as segments');majorRoadUrl.searchParams.set('$where',"municipality='CALGARY' AND obsolete_code='No' AND full_name IS NOT NULL");majorRoadUrl.searchParams.set('$group','full_name');majorRoadUrl.searchParams.set('$order','full_name');majorRoadUrl.searchParams.set('$limit','50000');
  const [streetRows,communityRows,majorRoadRows]=await Promise.all([getJson(streetUrl),getJson(communityUrl),getJson(majorRoadUrl)]);const retrievedAt=new Date().toISOString();
  fs.mkdirSync(datasetDirectory,{recursive:true});fs.writeFileSync(streetSnapshotPath,`${JSON.stringify({datasetId:STREET_DATASET_ID,retrievedAt,rows:streetRows},null,2)}\n`);fs.writeFileSync(communitySnapshotPath,`${JSON.stringify({datasetId:COMMUNITY_DATASET_ID,retrievedAt,rows:communityRows},null,2)}\n`);fs.writeFileSync(majorRoadSnapshotPath,`${JSON.stringify({datasetId:MAJOR_ROAD_DATASET_ID,retrievedAt,rows:majorRoadRows},null,2)}\n`);return{streetRows,communityRows,majorRoadRows,retrievedAt};
}
function readCatalogs(){const street=JSON.parse(fs.readFileSync(streetSnapshotPath,'utf8'));const community=JSON.parse(fs.readFileSync(communitySnapshotPath,'utf8'));const majorRoad=JSON.parse(fs.readFileSync(majorRoadSnapshotPath,'utf8'));return{streetRows:street.rows,communityRows:community.rows,majorRoadRows:majorRoad.rows,retrievedAt:[street.retrievedAt,community.retrievedAt,majorRoad.retrievedAt].sort().at(-1)};}

if(!Number.isInteger(count)||count<1||count>20000)throw new Error('--count must be an integer from 1 through 20000.');
fs.mkdirSync(datasetDirectory,{recursive:true});fs.mkdirSync(fixtureDirectory,{recursive:true});
const catalogs=refresh||!fs.existsSync(streetSnapshotPath)||!fs.existsSync(communitySnapshotPath)||!fs.existsSync(majorRoadSnapshotPath)?await refreshCatalogs():readCatalogs();
const dataset=generateSyntheticCalgaryDataset({count,streets:catalogs.streetRows,communities:catalogs.communityRows,majorRoads:catalogs.majorRoadRows,seed,generatedAt});
const sources=catalogSourceMetadata({streetRows:catalogs.streetRows,communityRows:catalogs.communityRows,majorRoadRows:catalogs.majorRoadRows,retrievedAt:catalogs.retrievedAt});dataset.manifest.sources=sources;
fs.writeFileSync(jsonlPath,`${dataset.properties.map((property)=>JSON.stringify(property)).join('\n')}\n`);fs.writeFileSync(schemaPath,`${JSON.stringify(buildSyntheticSchemaDocument(),null,2)}\n`);fs.writeFileSync(manifestPath,`${JSON.stringify(dataset.manifest,null,2)}\n`);
if(fs.existsSync(databasePath))fs.rmSync(databasePath);const config=buildConfig({...process.env,NODE_ENV:'development',DATABASE_PATH:databasePath,AUTO_SEED:'false'});const repo=new Repository(databasePath);try{seedRepository(repo,config,new Date(generatedAt),{includeListings:false});const seeded=seedSyntheticCalgary(repo,dataset,sources);if(seeded.listingCount!==count||seeded.coveredStreetCount!==seeded.streetCatalogCount||seeded.coveredMajorRoadCount!==seeded.majorRoadCatalogCount)throw new Error('Seeded database coverage check failed.');}finally{repo.close();}
console.log(JSON.stringify({ok:true,properties:dataset.properties.length,schemaFields:dataset.manifest.schemaFieldCount,streetCatalog:dataset.manifest.streetCatalogCount,coveredStreets:dataset.manifest.coveredStreetCount,majorRoadCatalog:dataset.manifest.majorRoadCatalogCount,coveredMajorRoads:dataset.manifest.coveredMajorRoadCount,communities:dataset.manifest.communityCatalogCount,coveredCommunities:dataset.manifest.coveredCommunityCount,databasePath,jsonlPath,schemaPath,manifestPath,validation:dataset.manifest.validation,datasetSha256:dataset.manifest.datasetSha256},null,2));
