import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { newId, normalizePhone } from './security.js';

const json = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const now = () => new Date().toISOString();

export class Repository {
  constructor(filename = ':memory:') {
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, licence_number TEXT NOT NULL,
        brokerage TEXT NOT NULL, transfer_phone TEXT NOT NULL, mortgage_transfer_phone TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL,
        last_name TEXT, email TEXT, timezone TEXT NOT NULL, birthday TEXT,
        represented_by_other INTEGER NOT NULL DEFAULT 0, relationship_notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS consents (
        id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, channel TEXT NOT NULL,
        purpose TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL,
        evidence TEXT, captured_at TEXT NOT NULL, expires_at TEXT,
        FOREIGN KEY(contact_id) REFERENCES contacts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_consents_lookup ON consents(contact_id, channel, purpose, captured_at DESC);
      CREATE TABLE IF NOT EXISTS do_not_contact (
        contact_id TEXT PRIMARY KEY, reason TEXT NOT NULL, source TEXT NOT NULL,
        created_at TEXT NOT NULL, FOREIGN KEY(contact_id) REFERENCES contacts(id)
      );
      CREATE TABLE IF NOT EXISTS criteria (
        id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, data TEXT NOT NULL,
        confirmed INTEGER NOT NULL, source_utterance TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(contact_id) REFERENCES contacts(id)
      );
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY, matrix_id TEXT UNIQUE NOT NULL, status TEXT NOT NULL,
        list_price INTEGER NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL,
        province TEXT NOT NULL, property_type TEXT NOT NULL, bedrooms REAL,
        bathrooms REAL, features TEXT, public_remarks TEXT, public_url TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_catalog_sources (
        dataset_id TEXT PRIMARY KEY, name TEXT NOT NULL, source_url TEXT NOT NULL,
        licence TEXT NOT NULL, retrieved_at TEXT NOT NULL, record_count INTEGER NOT NULL,
        sha256 TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_street_catalog (
        street_key TEXT PRIMARY KEY, street_name TEXT NOT NULL, street_type TEXT,
        street_quadrant TEXT, address_count INTEGER NOT NULL DEFAULT 0,
        source_dataset_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_community_catalog (
        community_code TEXT PRIMARY KEY, name TEXT NOT NULL, class TEXT NOT NULL,
        sector TEXT, growth_status TEXT, community_structure TEXT,
        source_dataset_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_major_road_catalog (
        road_key TEXT PRIMARY KEY, full_name TEXT NOT NULL,
        segment_count INTEGER NOT NULL DEFAULT 0, source_dataset_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synthetic_listing_streets (
        matrix_id TEXT NOT NULL, street_key TEXT NOT NULL, role TEXT NOT NULL,
        PRIMARY KEY(matrix_id, street_key, role),
        FOREIGN KEY(matrix_id) REFERENCES listings(matrix_id) ON DELETE CASCADE,
        FOREIGN KEY(street_key) REFERENCES synthetic_street_catalog(street_key)
      );
      CREATE INDEX IF NOT EXISTS idx_synthetic_listing_streets_key ON synthetic_listing_streets(street_key);
      CREATE TABLE IF NOT EXISTS synthetic_listing_roads (
        matrix_id TEXT NOT NULL, road_key TEXT NOT NULL, role TEXT NOT NULL,
        PRIMARY KEY(matrix_id, road_key, role),
        FOREIGN KEY(matrix_id) REFERENCES listings(matrix_id) ON DELETE CASCADE,
        FOREIGN KEY(road_key) REFERENCES synthetic_major_road_catalog(road_key)
      );
      CREATE INDEX IF NOT EXISTS idx_synthetic_listing_roads_key ON synthetic_listing_roads(road_key);
      CREATE TABLE IF NOT EXISTS market_stats (
        id TEXT PRIMARY KEY, area TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL,
        unit TEXT NOT NULL, period TEXT NOT NULL, source TEXT NOT NULL, as_of TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY, contact_id TEXT, direction TEXT NOT NULL, mode TEXT,
        provider_call_id TEXT, disposition TEXT, summary TEXT, metadata TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, agent_id TEXT NOT NULL,
        start_time TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
        notes TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, channel TEXT NOT NULL,
        template_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL,
        provider_id TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS escalations (
        id TEXT PRIMARY KEY, contact_id TEXT, reason TEXT NOT NULL, destination TEXT NOT NULL,
        urgency TEXT NOT NULL, context TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS whatsapp_threads (
        contact_id TEXT PRIMARY KEY, wa_id TEXT UNIQUE NOT NULL, locale TEXT NOT NULL,
        last_user_message_at TEXT, previous_response_id TEXT, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(contact_id) REFERENCES contacts(id)
      );
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY, provider_message_id TEXT UNIQUE, contact_id TEXT NOT NULL,
        direction TEXT NOT NULL, message_type TEXT NOT NULL, body TEXT,
        template_name TEXT, status TEXT NOT NULL, metadata TEXT NOT NULL,
        created_at TEXT NOT NULL, FOREIGN KEY(contact_id) REFERENCES contacts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS whatsapp_events (
        event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL
      );
    `);
    const columns = this.db.prepare('PRAGMA table_info(listings)').all();
    const ensureColumn=(name,definition)=>{if(!columns.some((column)=>column.name===name))this.db.exec(`ALTER TABLE listings ADD COLUMN ${name} ${definition}`);};
    ensureColumn('public_url','TEXT');
    ensureColumn('community','TEXT');
    ensureColumn('quadrant','TEXT');
    ensureColumn('living_area_sqft','INTEGER');
    ensureColumn('year_built','INTEGER');
    ensureColumn('garage_spaces','REAL');
    ensureColumn('condo_fee_monthly','REAL');
    ensureColumn('latitude','REAL');
    ensureColumn('longitude','REAL');
    ensureColumn('synthetic','INTEGER NOT NULL DEFAULT 0');
    ensureColumn('training_split','TEXT');
    ensureColumn('street_reference_key','TEXT');
    ensureColumn('details','TEXT NOT NULL DEFAULT \'{}\'');
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_listings_status_price ON listings(status, list_price);
      CREATE INDEX IF NOT EXISTS idx_listings_community ON listings(community);
      CREATE INDEX IF NOT EXISTS idx_listings_quadrant ON listings(quadrant);
      CREATE INDEX IF NOT EXISTS idx_listings_type_beds ON listings(property_type, bedrooms);
      CREATE INDEX IF NOT EXISTS idx_listings_training_split ON listings(training_split);
    `);
  }

  close() { this.db.close(); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }

  upsertAgent(agent) {
    const at = now();
    this.db.prepare(`INSERT INTO agents(id,name,licence_number,brokerage,transfer_phone,mortgage_transfer_phone,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,licence_number=excluded.licence_number,
      brokerage=excluded.brokerage,transfer_phone=excluded.transfer_phone,mortgage_transfer_phone=excluded.mortgage_transfer_phone,updated_at=excluded.updated_at`)
      .run(agent.id, agent.name, agent.licenceNumber, agent.brokerage, normalizePhone(agent.transferPhone), agent.mortgageTransferPhone ? normalizePhone(agent.mortgageTransferPhone) : null, at, at);
    return this.getAgent(agent.id);
  }
  getAgent(id) { const row=this.db.prepare('SELECT * FROM agents WHERE id=?').get(id); return row ? { id:row.id,name:row.name,licenceNumber:row.licence_number,brokerage:row.brokerage,transferPhone:row.transfer_phone,mortgageTransferPhone:row.mortgage_transfer_phone } : null; }

  upsertContact(contact) {
    const at=now(); const phone=normalizePhone(contact.phone);
    this.db.prepare(`INSERT INTO contacts(id,phone,first_name,last_name,email,timezone,birthday,represented_by_other,relationship_notes,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET phone=excluded.phone,first_name=excluded.first_name,last_name=excluded.last_name,
      email=excluded.email,timezone=excluded.timezone,birthday=excluded.birthday,represented_by_other=excluded.represented_by_other,
      relationship_notes=excluded.relationship_notes,updated_at=excluded.updated_at`)
      .run(contact.id,phone,contact.firstName,contact.lastName||null,contact.email||null,contact.timezone||'America/Edmonton',contact.birthday||null,contact.representedByOther?1:0,contact.relationshipNotes||null,at,at);
    return this.getContact(contact.id);
  }
  rowContact(row){return row?{id:row.id,phone:row.phone,firstName:row.first_name,lastName:row.last_name,email:row.email,timezone:row.timezone,birthday:row.birthday,representedByOther:Boolean(row.represented_by_other),relationshipNotes:row.relationship_notes}:null;}
  getContact(id){return this.rowContact(this.db.prepare('SELECT * FROM contacts WHERE id=?').get(id));}
  findContactByPhone(phone){return this.rowContact(this.db.prepare('SELECT * FROM contacts WHERE phone=?').get(normalizePhone(phone)));}
  listContacts(){return this.db.prepare('SELECT * FROM contacts ORDER BY first_name').all().map((row)=>this.rowContact(row));}
  updateRelationship(contactId, notes){this.db.prepare('UPDATE contacts SET relationship_notes=?,updated_at=? WHERE id=?').run(notes,now(),contactId);return this.getContact(contactId);}

  recordConsent({contactId,channel,purpose,status='granted',source='crm',evidence=null,capturedAt=now(),expiresAt=null}) {
    const id=newId('consent'); this.db.prepare('INSERT INTO consents VALUES(?,?,?,?,?,?,?,?,?)').run(id,contactId,channel,purpose,status,source,evidence?JSON.stringify(evidence):null,capturedAt,expiresAt); return {id,contactId,channel,purpose,status,source,capturedAt,expiresAt};
  }
  latestConsent(contactId,channel,purpose){const row=this.db.prepare('SELECT * FROM consents WHERE contact_id=? AND channel=? AND purpose=? ORDER BY captured_at DESC,rowid DESC LIMIT 1').get(contactId,channel,purpose);return row?{id:row.id,status:row.status,source:row.source,evidence:json(row.evidence),capturedAt:row.captured_at,expiresAt:row.expires_at}:null;}
  revokeAllConsent(contactId,source='voice'){for(const channel of ['voice','sms','email','whatsapp'])for(const purpose of ['buyer_followup','property_match','showing_followup','seller_followup','relationship_checkin','relationship_message','mortgage_process_checkin','property_followup','service_message','appointment_reminder'])this.recordConsent({contactId,channel,purpose,status:'revoked',source});}
  addDoNotContact(contactId,reason='customer_request',source='voice'){this.db.prepare('INSERT INTO do_not_contact(contact_id,reason,source,created_at) VALUES(?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET reason=excluded.reason,source=excluded.source,created_at=excluded.created_at').run(contactId,reason,source,now());return this.getDoNotContact(contactId);}
  getDoNotContact(contactId){return this.db.prepare('SELECT * FROM do_not_contact WHERE contact_id=?').get(contactId)||null;}
  isDoNotContact(contactId){return Boolean(this.getDoNotContact(contactId));}

  saveCriteria(contactId,data,confirmed=false,sourceUtterance=null){const id=newId('criteria');this.db.prepare('INSERT INTO criteria VALUES(?,?,?,?,?,?)').run(id,contactId,JSON.stringify(data),confirmed?1:0,sourceUtterance,now());return{id,contactId,data,confirmed,sourceUtterance};}
  latestCriteria(contactId,confirmedOnly=false){const row=this.db.prepare(`SELECT * FROM criteria WHERE contact_id=? ${confirmedOnly?'AND confirmed=1':''} ORDER BY created_at DESC,rowid DESC LIMIT 1`).get(contactId);return row?{id:row.id,contactId:row.contact_id,data:json(row.data,{}),confirmed:Boolean(row.confirmed),sourceUtterance:row.source_utterance,createdAt:row.created_at}:null;}

  upsertListing(listing){
    const storedKeys=new Set(['id','matrixId','status','listPrice','address','city','province','propertyType','bedrooms','bathrooms','features','publicRemarks','publicUrl','updatedAt','community','quadrant','livingAreaSqft','yearBuilt','garageSpaces','condoFeeMonthly','latitude','longitude','synthetic','trainingSplit','streetReferenceKey']);
    const details=Object.fromEntries(Object.entries(listing).filter(([key])=>!storedKeys.has(key)));
    this.db.prepare(`INSERT INTO listings(id,matrix_id,status,list_price,address,city,province,property_type,bedrooms,bathrooms,features,public_remarks,public_url,updated_at,community,quadrant,living_area_sqft,year_built,garage_spaces,condo_fee_monthly,latitude,longitude,synthetic,training_split,street_reference_key,details)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(matrix_id) DO UPDATE SET status=excluded.status,list_price=excluded.list_price,address=excluded.address,city=excluded.city,
      province=excluded.province,property_type=excluded.property_type,bedrooms=excluded.bedrooms,bathrooms=excluded.bathrooms,features=excluded.features,
      public_remarks=excluded.public_remarks,public_url=excluded.public_url,updated_at=excluded.updated_at,community=excluded.community,quadrant=excluded.quadrant,
      living_area_sqft=excluded.living_area_sqft,year_built=excluded.year_built,garage_spaces=excluded.garage_spaces,condo_fee_monthly=excluded.condo_fee_monthly,
      latitude=excluded.latitude,longitude=excluded.longitude,synthetic=excluded.synthetic,training_split=excluded.training_split,
      street_reference_key=excluded.street_reference_key,details=excluded.details`)
      .run(listing.id||newId('listing'),listing.matrixId,listing.status,listing.listPrice,listing.address,listing.city,listing.province||'AB',listing.propertyType,listing.bedrooms,listing.bathrooms,JSON.stringify(listing.features||[]),listing.publicRemarks||'',listing.publicUrl||null,listing.updatedAt||now(),listing.community||null,listing.quadrant||null,listing.livingAreaSqft??null,listing.yearBuilt??null,listing.garageSpaces??null,listing.condoFeeMonthly??null,listing.latitude??null,listing.longitude??null,listing.synthetic?1:0,listing.trainingSplit||null,listing.streetReferenceKey||null,JSON.stringify(details));return this.getListing(listing.matrixId);
  }
  rowListing(row){return row?{...json(row.details,{}),id:row.id,matrixId:row.matrix_id,status:row.status,listPrice:row.list_price,address:row.address,city:row.city,province:row.province,propertyType:row.property_type,bedrooms:row.bedrooms,bathrooms:row.bathrooms,features:json(row.features,[]),publicRemarks:row.public_remarks,publicUrl:row.public_url,updatedAt:row.updated_at,community:row.community,quadrant:row.quadrant,livingAreaSqft:row.living_area_sqft,yearBuilt:row.year_built,garageSpaces:row.garage_spaces,condoFeeMonthly:row.condo_fee_monthly,latitude:row.latitude,longitude:row.longitude,synthetic:Boolean(row.synthetic),trainingSplit:row.training_split,streetReferenceKey:row.street_reference_key}:null;}
  getListing(id){return this.rowListing(this.db.prepare('SELECT * FROM listings WHERE matrix_id=? OR id=?').get(id,id));}
  listListings(){return this.db.prepare('SELECT * FROM listings ORDER BY list_price').all().map((row)=>this.rowListing(row));}
  countListings({synthetic}={}){if(synthetic===undefined)return Number(this.db.prepare('SELECT count(*) AS count FROM listings').get().count);return Number(this.db.prepare('SELECT count(*) AS count FROM listings WHERE synthetic=?').get(synthetic?1:0).count);}
  clearSyntheticListings(){this.db.prepare('DELETE FROM listings WHERE synthetic=1').run();}
  replaceSyntheticCatalogs({sources,streets,communities,majorRoads=[]}){return this.transaction(()=>{
    this.db.exec('DELETE FROM synthetic_listing_streets; DELETE FROM synthetic_listing_roads; DELETE FROM synthetic_street_catalog; DELETE FROM synthetic_major_road_catalog; DELETE FROM synthetic_community_catalog; DELETE FROM synthetic_catalog_sources;');
    const sourceStatement=this.db.prepare('INSERT INTO synthetic_catalog_sources VALUES(?,?,?,?,?,?,?)');
    for(const source of sources)sourceStatement.run(source.datasetId,source.name,source.sourceUrl,source.licence,source.retrievedAt,source.recordCount,source.sha256);
    const streetStatement=this.db.prepare('INSERT INTO synthetic_street_catalog VALUES(?,?,?,?,?,?)');
    for(const street of streets)streetStatement.run(street.streetKey,street.streetName,street.streetType||null,street.streetQuadrant||null,street.addressCount||0,street.sourceDatasetId);
    const communityStatement=this.db.prepare('INSERT INTO synthetic_community_catalog VALUES(?,?,?,?,?,?,?)');
    for(const community of communities)communityStatement.run(community.communityCode,community.name,community.class,community.sector||null,community.growthStatus||null,community.communityStructure||null,community.sourceDatasetId);
    const roadStatement=this.db.prepare('INSERT INTO synthetic_major_road_catalog VALUES(?,?,?,?)');
    for(const road of majorRoads)roadStatement.run(road.roadKey,road.fullName,road.segmentCount||0,road.sourceDatasetId);
    return{sources:sources.length,streets:streets.length,communities:communities.length,majorRoads:majorRoads.length};
  });}
  linkSyntheticStreet(matrixId,streetKey,role){this.db.prepare('INSERT OR IGNORE INTO synthetic_listing_streets VALUES(?,?,?)').run(matrixId,streetKey,role);}
  linkSyntheticRoad(matrixId,roadKey,role='nearby_major'){this.db.prepare('INSERT OR IGNORE INTO synthetic_listing_roads VALUES(?,?,?)').run(matrixId,roadKey,role);}
  syntheticCoverageStats(){const row=this.db.prepare(`SELECT
    (SELECT count(*) FROM synthetic_street_catalog) AS catalog_count,
    (SELECT count(DISTINCT street_key) FROM synthetic_listing_streets) AS covered_count,
    (SELECT count(*) FROM synthetic_community_catalog) AS community_count,
    (SELECT count(DISTINCT community) FROM listings WHERE synthetic=1) AS covered_communities,
    (SELECT count(*) FROM synthetic_major_road_catalog) AS major_road_count,
    (SELECT count(DISTINCT road_key) FROM synthetic_listing_roads) AS covered_major_roads,
    (SELECT count(*) FROM listings WHERE synthetic=1) AS listing_count`).get();return{streetCatalogCount:Number(row.catalog_count),coveredStreetCount:Number(row.covered_count),communityCatalogCount:Number(row.community_count),coveredCommunityCount:Number(row.covered_communities),majorRoadCatalogCount:Number(row.major_road_count),coveredMajorRoadCount:Number(row.covered_major_roads),listingCount:Number(row.listing_count)};}
  addMarketStat(stat){const id=stat.id||newId('stat');this.db.prepare('INSERT OR REPLACE INTO market_stats VALUES(?,?,?,?,?,?,?,?)').run(id,stat.area,stat.metric,stat.value,stat.unit,stat.period,stat.source,stat.asOf);return{id,...stat};}
  marketContext(area){return this.db.prepare('SELECT * FROM market_stats WHERE lower(area)=lower(?) ORDER BY as_of DESC').all(area).map((row)=>({area:row.area,metric:row.metric,value:row.value,unit:row.unit,period:row.period,source:row.source,asOf:row.as_of}));}

  addInteraction(data){const id=newId('interaction');this.db.prepare('INSERT INTO interactions VALUES(?,?,?,?,?,?,?,?,?)').run(id,data.contactId||null,data.direction,data.mode||null,data.providerCallId||null,data.disposition||null,data.summary||null,JSON.stringify(data.metadata||{}),data.createdAt||now());return{id,...data};}
  listInteractions(limit=25){return this.db.prepare('SELECT * FROM interactions ORDER BY created_at DESC,rowid DESC LIMIT ?').all(Math.min(Math.max(Number(limit)||25,1),100)).map((row)=>({id:row.id,contactId:row.contact_id,direction:row.direction,mode:row.mode,providerCallId:row.provider_call_id,disposition:row.disposition,summary:row.summary,metadata:json(row.metadata,{}),createdAt:row.created_at}));}
  addAppointment(data){const id=newId('appt');this.db.prepare('INSERT INTO appointments VALUES(?,?,?,?,?,?,?,?)').run(id,data.contactId,data.agentId,data.startTime,data.type||'callback','confirmed',data.notes||null,now());return{id,...data,status:'confirmed'};}
  addMessage(data){const id=newId('msg');this.db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?)').run(id,data.contactId,data.channel,data.templateId,data.body,data.status||'queued',data.providerId||null,now());return{id,...data};}
  addEscalation(data){const id=newId('esc');this.db.prepare('INSERT INTO escalations VALUES(?,?,?,?,?,?,?,?)').run(id,data.contactId||null,data.reason,data.destination,data.urgency||'normal',JSON.stringify(data.context||{}),data.status||'requested',now());return{id,...data};}
  claimEvent(eventId,eventType){const result=this.db.prepare('INSERT OR IGNORE INTO processed_events VALUES(?,?,?)').run(eventId,eventType,now());return result.changes===1;}
  upsertWhatsAppThread({contactId,waId,locale='en_CA',lastUserMessageAt=null,previousResponseId=null,status='active'}){const at=now();this.db.prepare(`INSERT INTO whatsapp_threads(contact_id,wa_id,locale,last_user_message_at,previous_response_id,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET wa_id=excluded.wa_id,locale=excluded.locale,
    last_user_message_at=COALESCE(excluded.last_user_message_at,whatsapp_threads.last_user_message_at),previous_response_id=COALESCE(excluded.previous_response_id,whatsapp_threads.previous_response_id),status=excluded.status,updated_at=excluded.updated_at`)
    .run(contactId,String(waId).replace(/\D/g,''),locale,lastUserMessageAt,previousResponseId,status,at,at);return this.getWhatsAppThreadByContact(contactId);}
  rowWhatsAppThread(row){return row?{contactId:row.contact_id,waId:row.wa_id,locale:row.locale,lastUserMessageAt:row.last_user_message_at,previousResponseId:row.previous_response_id,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
  getWhatsAppThreadByContact(contactId){return this.rowWhatsAppThread(this.db.prepare('SELECT * FROM whatsapp_threads WHERE contact_id=?').get(contactId));}
  getWhatsAppThreadByWaId(waId){return this.rowWhatsAppThread(this.db.prepare('SELECT * FROM whatsapp_threads WHERE wa_id=?').get(String(waId).replace(/\D/g,'')));}
  addWhatsAppMessage(data){const id=data.id||newId('wa');const result=this.db.prepare(`INSERT OR IGNORE INTO whatsapp_messages(id,provider_message_id,contact_id,direction,message_type,body,template_name,status,metadata,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,data.providerMessageId||null,data.contactId,data.direction,data.messageType||'text',data.body||null,data.templateName||null,data.status||'received',JSON.stringify(data.metadata||{}),data.createdAt||now());return result.changes?{id,...data}:null;}
  listWhatsAppMessages(contactId,limit=12){return this.db.prepare('SELECT * FROM whatsapp_messages WHERE contact_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?').all(contactId,Math.min(Math.max(Number(limit)||12,1),50)).reverse().map((row)=>({id:row.id,providerMessageId:row.provider_message_id,contactId:row.contact_id,direction:row.direction,messageType:row.message_type,body:row.body,templateName:row.template_name,status:row.status,metadata:json(row.metadata,{}),createdAt:row.created_at}));}
  updateWhatsAppStatus(providerMessageId,status){this.db.prepare('UPDATE whatsapp_messages SET status=? WHERE provider_message_id=?').run(status,providerMessageId);}
  claimWhatsAppEvent(eventId){return this.db.prepare('INSERT OR IGNORE INTO whatsapp_events VALUES(?,?)').run(eventId,now()).changes===1;}
}

export function seedRepository(repo, config, fixedDate = new Date(), {includeListings=true} = {}) {
  repo.upsertAgent(config.licensedAgent);
  repo.upsertContact({id:'contact_demo_buyer',phone:'+14035550123',firstName:'Jordan',lastName:'Lee',email:'jordan@example.test',timezone:'America/Edmonton',birthday:'1991-04-12'});
  repo.upsertContact({id:'contact_demo_birthday',phone:'+14035550124',firstName:'Maya',lastName:'Patel',email:'maya@example.test',timezone:'America/Edmonton',birthday:`1988-${String(fixedDate.getUTCMonth()+1).padStart(2,'0')}-${String(fixedDate.getUTCDate()).padStart(2,'0')}`});
  const syntheticConsentAt=new Date(fixedDate.getTime()-30*86_400_000).toISOString();
  for (const purpose of ['buyer_followup','property_match','showing_followup','relationship_checkin','mortgage_process_checkin']) repo.recordConsent({contactId:'contact_demo_buyer',channel:'voice',purpose,source:'demo_fixture',evidence:{synthetic:true},capturedAt:syntheticConsentAt});
  for (const channel of ['sms','email']) repo.recordConsent({contactId:'contact_demo_buyer',channel,purpose:'property_followup',source:'demo_fixture',evidence:{synthetic:true},capturedAt:syntheticConsentAt});
  repo.recordConsent({contactId:'contact_demo_birthday',channel:'voice',purpose:'relationship_message',source:'demo_fixture',evidence:{synthetic:true},capturedAt:syntheticConsentAt});
  if(includeListings){const listings=[
    ['A1001','ACTIVE',675000,'120 Sage Hill Way NW','Calgary','detached',3,2.5,['double garage','fenced yard']],
    ['A1002','ACTIVE',639000,'44 Evanston Drive NW','Calgary','townhouse',3,2.5,['garage','finished basement']],
    ['A1003','ACTIVE',710000,'91 Royal Oak Terrace NW','Calgary','detached',4,3,['double garage','home office']],
    ['A1004','ACTIVE',585000,'18 Redstone Avenue NE','Calgary','duplex',3,2.5,['garage','near transit']],
    ['A1005','ACTIVE',499000,'2302 77 Street SW','Calgary','apartment',2,2,['underground parking','near transit']],
    ['A1006','CONDITIONAL',660000,'10 Nolan Hill Gate NW','Calgary','detached',3,2.5,['double garage']]
  ];
  for(const [matrixId,status,listPrice,address,city,propertyType,bedrooms,bathrooms,features] of listings)repo.upsertListing({matrixId,status,listPrice,address,city,propertyType,bedrooms,bathrooms,features,publicRemarks:'Synthetic development fixture. Confirm current status with the licensed professional.',publicUrl:`https://listings.example.test/${matrixId}`,updatedAt:fixedDate.toISOString()});}
  repo.addMarketStat({id:'stat_nw_benchmark',area:'NW Calgary',metric:'benchmark_price',value:682400,unit:'CAD',period:'2026-07',source:'Synthetic demo dataset — replace with approved Pillar 9 source',asOf:'2026-08-01'});
  repo.addMarketStat({id:'stat_nw_dom',area:'NW Calgary',metric:'median_days_on_market',value:24,unit:'days',period:'2026-07',source:'Synthetic demo dataset — replace with approved Pillar 9 source',asOf:'2026-08-01'});
}
