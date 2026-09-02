// Loads the 5,000-property synthetic Calgary fixture into the RUNNING service database,
// so the agent searches the full set instead of the six seeded demo listings.
// The dataset is regenerated deterministically from the same snapshots and seed the
// packaged fixture uses, so the rows are identical to fixtures/calgary-synthetic-5000.sqlite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from '../src/config.js';
import { Repository } from '../src/db.js';
import { catalogSourceMetadata, generateSyntheticCalgaryDataset, seedSyntheticCalgary } from '../src/synthetic-calgary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'datasets', 'synthetic-calgary');
const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

const arg = (name, fallback) => { const p = `--${name}=`; const v = process.argv.find((x) => x.startsWith(p)); return v ? v.slice(p.length) : fallback; };
const count = Number(arg('count', '5000'));
const seed = arg('seed', 'pillar9-calgary-5000-v1');
const generatedAt = new Date(arg('generated-at', '2026-08-30T00:00:00.000Z')).toISOString();

const config = buildConfig();
const street = read('calgary-street-catalog.snapshot.json');
const community = read('calgary-residential-communities.snapshot.json');
const majorRoad = read('calgary-major-roads.snapshot.json');
const retrievedAt = [street.retrievedAt, community.retrievedAt, majorRoad.retrievedAt].sort().at(-1);

const dataset = generateSyntheticCalgaryDataset({ count, seed, generatedAt, streets: street.rows, communities: community.rows, majorRoads: majorRoad.rows });
if (!dataset.manifest.validation.ok) { console.error(JSON.stringify({ ok: false, errors: dataset.manifest.validation.errors.slice(0, 5) })); process.exit(1); }

// catalogSourceMetadata hashes the RAW snapshot rows, matching the packaged fixture's provenance.
const sources = catalogSourceMetadata({ streetRows: street.rows, communityRows: community.rows, majorRoadRows: majorRoad.rows, retrievedAt });
dataset.manifest.sources = sources;
const repo = new Repository(config.databasePath);
try {
  const before = repo.countListings();
  const stats = seedSyntheticCalgary(repo, dataset, sources);
  console.log(JSON.stringify({
    ok: true, databasePath: config.databasePath,
    listingsBefore: before, listingsAfter: repo.countListings(),
    syntheticListings: stats.listingCount,
    streetsCovered: `${stats.coveredStreetCount}/${stats.streetCatalogCount}`,
    majorRoadsCovered: `${stats.coveredMajorRoadCount}/${stats.majorRoadCatalogCount}`,
    communitiesCovered: `${stats.coveredCommunityCount}/${stats.communityCatalogCount}`,
    datasetSha256: dataset.manifest.datasetSha256
  }, null, 2));
} finally { repo.close(); }
