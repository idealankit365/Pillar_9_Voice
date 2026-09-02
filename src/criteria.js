const NUMBER_WORDS = new Map([['one',1],['two',2],['three',3],['four',4],['five',5],['six',6],['seven',7],['eight',8],['nine',9],['ten',10]]);
const AMOUNT_WORDS = new Map([['zero',0],...NUMBER_WORDS,['eleven',11],['twelve',12],['thirteen',13],['fourteen',14],['fifteen',15],['sixteen',16],['seventeen',17],['eighteen',18],['nineteen',19],['twenty',20],['thirty',30],['forty',40],['fifty',50],['sixty',60],['seventy',70],['eighty',80],['ninety',90]]);
const TYPES = { detached:['detached','single family','single-family','house'], townhouse:['townhouse','townhome','row house'], apartment:['apartment','condo apartment','condominium','condo'], duplex:['duplex','semi-detached','semi detached'] };
const FEATURES = { 'double garage':['double garage','two car garage','2 car garage'], garage:['garage'], 'finished basement':['finished basement','developed basement'], basement:['basement'], 'home office':['home office','office','work from home space'], 'fenced yard':['fenced yard','fenced backyard'], yard:['yard','backyard'], 'walkout basement':['walkout','walk-out'], 'near transit':['near transit','close to transit','near ctrain','near c-train'], 'underground parking':['underground parking'], 'central air conditioning':['central air','air conditioning','a/c'], fireplace:['fireplace'], 'step-free main entrance':['step-free','wheelchair accessible entrance','no-step entrance'], 'near park':['near a park','close to a park'] };
const AREAS = [['NW Calgary',['nw calgary','northwest calgary','north west calgary']],['NE Calgary',['ne calgary','northeast calgary','north east calgary']],['SW Calgary',['sw calgary','southwest calgary','south west calgary']],['SE Calgary',['se calgary','southeast calgary','south east calgary']],['Calgary',['calgary']],['Airdrie',['airdrie']],['Cochrane',['cochrane']],['Okotoks',['okotoks']],['Chestermere',['chestermere']]];
const unique = (items) => [...new Set(items.filter(Boolean))];
const esc = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, phrase) => new RegExp(`\\b${esc(phrase)}\\b`, 'i').test(text);
function remove(items, value) { for (let i=items.length-1;i>=0;i-=1) if (items[i]===value) items.splice(i,1); }
function wordsToAmount(value) {
  let total=0,current=0,seen=false;
  for (const token of String(value).toLowerCase().replaceAll('-',' ').split(/\s+/).filter((x)=>x&&x!=='and'&&x!=='dollars')) {
    if (AMOUNT_WORDS.has(token)) { current+=AMOUNT_WORDS.get(token); seen=true; }
    else if (token==='hundred') { current=Math.max(current,1)*100; seen=true; }
    else if (token==='thousand') { total+=Math.max(current,1)*1000; current=0; seen=true; }
    else if (token==='million') { total+=Math.max(current,1)*1000000; current=0; seen=true; }
    else return undefined;
  }
  return seen ? total+current : undefined;
}
function replaceWordAmounts(text) {
  const words=[...AMOUNT_WORDS.keys()].join('|');
  const expression=new RegExp(`\\b(?:(?:${words}|hundred|and)[ -]+)*(?:${words}|hundred)[ -]+(?:thousand|million)(?:[ -]+dollars)?\\b`,'gi');
  return text.replace(/\b(\d+(?:\.\d+)?)\s+(thousand|million)\b/gi,(_m,v,s)=>String(Number(v)*(s.toLowerCase()==='million'?1000000:1000))).replace(expression,(m)=>String(wordsToAmount(m)??m));
}
function amount(value) {
  if (typeof value==='number') return Math.round(value);
  const raw=String(value??'').toLowerCase().replace(/[$,\s]/g,''); const match=raw.match(/(\d+(?:\.\d+)?)(k|m)?/);
  if (!match) return wordsToAmount(value); const n=Number(match[1]); return Math.round(n*(match[2]==='m'?1000000:match[2]==='k'?1000:1));
}
function parseBudget(text) {
  const range=text.match(/(?:between|from)\s+\$?(\d+(?:[,.]\d+)*\s*[km]?)\s+(?:and|to)\s+\$?(\d+(?:[,.]\d+)*\s*[km]?)/i); if(range)return{priceMin:amount(range[1]),priceMax:amount(range[2])};
  const max=text.match(/(?:under|below|less than|up to|max(?:imum)?|budget(?: is| of)?|not more than)\s+\$?(\d+(?:[,.]\d+)*\s*[km]?)/i); if(max)return{priceMax:amount(max[1])};
  const around=text.match(/(?:around|about|roughly)\s+\$?(\d+(?:[,.]\d+)*\s*[km]?)/i); if(around){const n=amount(around[1]);return{priceMin:Math.round(n*.9),priceMax:Math.round(n*1.1),priceTarget:n};} return{};
}
function arrays(value){return Array.isArray(value)?unique(value.map(String)):typeof value==='string'?unique(value.split(/,|\bor\b/i).map((x)=>x.trim())):[];}
function numberNear(text, pattern){const m=text.match(pattern);if(!m)return undefined;return NUMBER_WORDS.get(m[1].toLowerCase())??Number(m[1]);}

export function normalizeListingCriteria(input={}) {
  const provided=input.criteria&&typeof input.criteria==='object'?input.criteria:input; const utterance=String(input.utterance||provided.utterance||'').trim(); const text=utterance.toLowerCase(); const criteria={}; const confidence={};
  const direct={priceMin:amount(provided.priceMin??provided.price_min),priceMax:amount(provided.priceMax??provided.price_max),priceTarget:amount(provided.priceTarget??provided.price_target),bedroomsMin:Number(provided.bedroomsMin??provided.bedrooms_min)||undefined,bathroomsMin:Number(provided.bathroomsMin??provided.bathrooms_min)||undefined,livingAreaMin:Number(provided.livingAreaMin??provided.living_area_min)||undefined,yearBuiltMin:Number(provided.yearBuiltMin??provided.year_built_min)||undefined,garageSpacesMin:Number(provided.garageSpacesMin??provided.garage_spaces_min)||undefined,condoFeeMax:Number(provided.condoFeeMax??provided.condo_fee_max),targetMoveDate:provided.targetMoveDate??provided.target_move_date,occupancy:provided.occupancy,conditionPreference:provided.conditionPreference??provided.condition_preference};
  if(!Number.isFinite(direct.condoFeeMax))direct.condoFeeMax=undefined;
  for(const[k,v]of Object.entries(direct))if(v!==undefined&&v!==''){criteria[k]=v;confidence[k]=.98;}
  for(const[k,v]of Object.entries(parseBudget(replaceWordAmounts(text))))if(v&&criteria[k]===undefined){criteria[k]=v;confidence[k]=.9;}
  const choice=text.match(/(one|two|three|four|five|six|seven|eight|\d+)\s+or\s+(one|two|three|four|five|six|seven|eight|\d+)[\s-]*(?:bed|bedroom)/i);
  const beds=choice?Math.min(NUMBER_WORDS.get(choice[1])??Number(choice[1]),NUMBER_WORDS.get(choice[2])??Number(choice[2])):numberNear(text,/(?:at least|min(?:imum)?\s+)?(one|two|three|four|five|six|seven|eight|\d+(?:\.5)?)[\s-]*(?:bed|bedroom)/i); if(beds&&!criteria.bedroomsMin){criteria.bedroomsMin=beds;confidence.bedroomsMin=.92;}
  const baths=numberNear(text,/(?:at least|min(?:imum)?\s+)?(one|two|three|four|five|\d+(?:\.5)?)[\s-]*(?:bath|bathroom)/i);if(baths&&!criteria.bathroomsMin){criteria.bathroomsMin=baths;confidence.bathroomsMin=.92;}
  const squareFeet=text.match(/(?:at least|min(?:imum)?\s+)?(\d{3,4})\s*(?:square feet|sq\.?\s*ft\.?|sqft)/i);if(squareFeet&&!criteria.livingAreaMin){criteria.livingAreaMin=Number(squareFeet[1]);confidence.livingAreaMin=.9;}
  const garageSpaces=numberNear(text,/(?:at least|min(?:imum)?\s+)?(one|two|three|four|\d+)[\s-]*(?:car|vehicle)?\s*garage/i);if(garageSpaces&&!criteria.garageSpacesMin){criteria.garageSpacesMin=garageSpaces;confidence.garageSpacesMin=.9;}
  const built=text.match(/(?:built (?:after|since)|newer than)\s*(\d{4})/i);if(built&&!criteria.yearBuiltMin){criteria.yearBuiltMin=Number(built[1]);confidence.yearBuiltMin=.88;}
  const condoFee=text.match(/(?:condo fees?|fees?)\s*(?:under|below|less than|max(?:imum)?(?: of)?)\s*\$?(\d{2,4})/i);if(condoFee&&criteria.condoFeeMax===undefined){criteria.condoFeeMax=Number(condoFee[1]);confidence.condoFeeMax=.9;}
  const areas=arrays(provided.areas??provided.area);for(const[canonical,variants]of AREAS)if(variants.some((v)=>has(text,v)))areas.push(canonical);
  for(const[canonical,re]of [['NW Calgary',/\b(?:nw|northwest|north west)\b.{0,30}\bcalgary\b/i],['NE Calgary',/\b(?:ne|northeast|north east)\b.{0,30}\bcalgary\b/i],['SW Calgary',/\b(?:sw|southwest|south west)\b.{0,30}\bcalgary\b/i],['SE Calgary',/\b(?:se|southeast|south east)\b.{0,30}\bcalgary\b/i]])if(re.test(text))areas.push(canonical);
  if(areas.some((a)=>/^(?:NW|NE|SW|SE) Calgary$/.test(a)))remove(areas,'Calgary');if(areas.length){criteria.areas=unique(areas);confidence.areas=.87;}
  const types=arrays(provided.propertyTypes??provided.property_types).map((x)=>x.toLowerCase());for(const[canonical,variants]of Object.entries(TYPES)){const matched=variants.some((v)=>has(text,v));const condoFeeOnly=canonical==='apartment'&&/\bno condo fees?\b/i.test(text)&&!/\b(?:a|an)\s+condo\b|\bcondo\s+(?:apartment|unit|home)\b/i.test(text);const semiDetached=canonical==='detached'&&/\bsemi[- ]detached\b/i.test(text);if(matched&&!condoFeeOnly&&!semiDetached)types.push(canonical);}if(types.length){criteria.propertyTypes=unique(types);confidence.propertyTypes=.9;}
  const must=arrays(provided.mustHave??provided.must_have),nice=arrays(provided.niceToHave??provided.nice_to_have),exclude=arrays(provided.exclude??provided.exclusions);
  for(const[canonical,variants]of Object.entries(FEATURES))if(variants.some((v)=>has(text,v))){const p=variants.map(esc).join('|');const before=new RegExp(`(?:must|need|required|essential|non[- ]?negotiable).{0,25}(?:${p})`,'i').test(utterance);const after=new RegExp(`(?:${p}).{0,20}(?:is\\s+)?(?:a\\s+)?(?:must|required|essential|non[- ]?negotiable)`,'i').test(utterance);const out=new RegExp(`(?:no|without|exclude|not\\s+with)\\s+(?:(?:a|an|the)\\s+)?(?:${p})`,'i').test(utterance);(out?exclude:before||after?must:nice).push(canonical);}
  const selected=[...must,...nice,...exclude];if(selected.includes('double garage')){remove(must,'garage');remove(nice,'garage');remove(exclude,'garage');}if(selected.includes('finished basement')||selected.includes('walkout basement')){remove(must,'basement');remove(nice,'basement');remove(exclude,'basement');}if(selected.includes('fenced yard')){remove(must,'yard');remove(nice,'yard');remove(exclude,'yard');}
  if(/no condo fees?|without condo fees?/i.test(utterance))exclude.push('condo fee');if(/no major renovations?|move[- ]in ready/i.test(utterance))criteria.conditionPreference='move-in ready';if(must.length)criteria.mustHave=unique(must);if(nice.length)criteria.niceToHave=unique(nice.filter((x)=>!must.includes(x)));if(exclude.length)criteria.exclude=unique(exclude);
  const move=utterance.match(/(?:move|moving|possession)(?:\s+by|\s+before|\s+in)?\s+([A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:weeks?|months?))/i);if(move&&!criteria.targetMoveDate)criteria.targetMoveDate=move[1];
  const conflicts=[];if(criteria.priceMin&&criteria.priceMax&&criteria.priceMin>criteria.priceMax)conflicts.push('price_min_exceeds_price_max');if(criteria.mustHave?.some((x)=>criteria.exclude?.includes(x)))conflicts.push('same_feature_required_and_excluded');
  const missing=[];if(!criteria.priceMax)missing.push('price_max');if(!criteria.areas?.length)missing.push('areas');if(!criteria.bedroomsMin)missing.push('bedrooms_min');
  const nextBestQuestion=conflicts.length?'I heard two details that conflict. Which one should I use?':missing[0]==='price_max'?'What is the highest purchase price you want included?':missing[0]==='areas'?'Which communities or cities should I include?':missing[0]==='bedrooms_min'?'What is the minimum number of bedrooms you need?':'Which one feature matters most if we need to compare close matches?';
  return{criteria,confidence,missing,conflicts,nextBestQuestion,sourceUtterance:utterance||null};
}
