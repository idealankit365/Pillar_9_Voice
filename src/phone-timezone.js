// Maps an E.164 number to the contact's likely IANA timezone so the calling-window
// gate runs in the recipient's local time rather than the operator's.
// This is a best-effort geographic hint, not a guarantee: numbers port between regions
// and mobile users travel. Unknown prefixes fall back to the configured default, and
// the caller can always pass an explicit timezone to override.

// Canadian area codes, complete as of 2026. NANP area codes are three digits after "1".
const CANADA = {
  'America/St_Johns': ['709'],
  'America/Halifax': ['902', '782', '506'],
  'America/Toronto': ['416', '647', '437', '905', '289', '365', '742', '519', '226', '548', '613', '343', '753', '705', '249', '683', '807', '369',
                      '514', '438', '263', '450', '579', '354', '418', '581', '367', '819', '873', '468'],
  'America/Winnipeg': ['204', '431', '584'],
  'America/Regina': ['306', '639', '474'],
  'America/Edmonton': ['403', '587', '780', '825', '368', '867'],
  'America/Vancouver': ['236', '250', '604', '672', '778', '257']
};
// A pragmatic subset of US area codes; unlisted NANP codes fall back to the default.
const UNITED_STATES = {
  'America/New_York': ['212', '646', '332', '917', '718', '347', '929', '516', '631', '914', '845', '203', '475', '860', '959', '215', '267', '445', '484', '610', '724', '412', '878', '202', '301', '240', '410', '443', '667', '703', '571', '804', '757', '617', '857', '781', '339', '508', '774', '978', '351', '413', '401', '305', '786', '954', '754', '561', '407', '321', '813', '727', '904', '850', '386', '941', '239', '404', '470', '678', '770', '706', '762', '919', '984', '704', '980', '336', '743', '252', '910', '828', '803', '839', '843', '854', '864', '614', '380', '216', '440', '330', '234', '513', '283', '937', '326', '412'],
  'America/Chicago': ['312', '773', '872', '224', '847', '630', '331', '708', '464', '815', '779', '217', '447', '309', '618', '214', '469', '972', '945', '817', '682', '713', '281', '832', '346', '210', '726', '512', '737', '361', '956', '903', '430', '940', '254', '979', '409', '936', '806', '325', '432', '615', '629', '901', '731', '423', '865', '731', '314', '557', '636', '816', '975', '573', '417', '660', '612', '651', '763', '952', '218', '507', '320', '414', '262', '920', '715', '534', '608', '504', '985', '318', '337', '225', '501', '479', '870', '405', '572', '918', '539', '580', '316', '620', '785', '913', '402', '531', '308', '515', '319', '563', '641', '712', '605', '701'],
  'America/Denver': ['303', '720', '983', '970', '719', '505', '575', '801', '385', '435', '406', '307', '208', '986'],
  'America/Phoenix': ['602', '480', '623', '520', '928'],
  'America/Los_Angeles': ['213', '323', '310', '424', '818', '747', '626', '661', '805', '820', '714', '657', '949', '442', '760', '619', '858', '935', '951', '909', '840', '415', '628', '650', '669', '408', '510', '341', '341', '925', '707', '369', '916', '279', '530', '209', '350', '559', '661', '702', '725', '775', '503', '971', '458', '541', '206', '564', '253', '360', '425', '509'],
  'America/Anchorage': ['907'],
  'Pacific/Honolulu': ['808']
};
const NANP_AREA_CODES = new Map();
for (const [zone, codes] of Object.entries({ ...CANADA, ...UNITED_STATES })) {
  for (const code of codes) if (!NANP_AREA_CODES.has(code)) NANP_AREA_CODES.set(code, zone);
}

// Country calling code -> representative timezone. Countries spanning several zones use
// their most populous one, which is why this stays a hint rather than an authority.
const COUNTRY_CODES = {
  '91': 'Asia/Kolkata', '44': 'Europe/London', '353': 'Europe/Dublin', '61': 'Australia/Sydney', '64': 'Pacific/Auckland',
  '971': 'Asia/Dubai', '966': 'Asia/Riyadh', '974': 'Asia/Qatar', '973': 'Asia/Bahrain', '965': 'Asia/Kuwait', '968': 'Asia/Muscat',
  '65': 'Asia/Singapore', '60': 'Asia/Kuala_Lumpur', '62': 'Asia/Jakarta', '63': 'Asia/Manila', '66': 'Asia/Bangkok',
  '84': 'Asia/Ho_Chi_Minh', '81': 'Asia/Tokyo', '82': 'Asia/Seoul', '86': 'Asia/Shanghai', '852': 'Asia/Hong_Kong', '886': 'Asia/Taipei',
  '92': 'Asia/Karachi', '880': 'Asia/Dhaka', '94': 'Asia/Colombo', '977': 'Asia/Kathmandu', '93': 'Asia/Kabul',
  '49': 'Europe/Berlin', '33': 'Europe/Paris', '34': 'Europe/Madrid', '39': 'Europe/Rome', '31': 'Europe/Amsterdam',
  '32': 'Europe/Brussels', '41': 'Europe/Zurich', '43': 'Europe/Vienna', '46': 'Europe/Stockholm', '47': 'Europe/Oslo',
  '45': 'Europe/Copenhagen', '358': 'Europe/Helsinki', '351': 'Europe/Lisbon', '48': 'Europe/Warsaw', '420': 'Europe/Prague',
  '36': 'Europe/Budapest', '30': 'Europe/Athens', '40': 'Europe/Bucharest', '380': 'Europe/Kyiv', '7': 'Europe/Moscow',
  '90': 'Europe/Istanbul', '972': 'Asia/Jerusalem', '20': 'Africa/Cairo', '27': 'Africa/Johannesburg',
  '234': 'Africa/Lagos', '254': 'Africa/Nairobi', '212': 'Africa/Casablanca', '233': 'Africa/Accra',
  '52': 'America/Mexico_City', '55': 'America/Sao_Paulo', '54': 'America/Argentina/Buenos_Aires', '56': 'America/Santiago',
  '57': 'America/Bogota', '51': 'America/Lima', '58': 'America/Caracas'
};

export function deriveTimezone(phone, fallback = 'America/Edmonton') {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return { timezone: fallback, source: 'default' };
  if (digits.length === 11 && digits.startsWith('1')) {
    const zone = NANP_AREA_CODES.get(digits.slice(1, 4));
    return zone ? { timezone: zone, source: 'area_code', matched: digits.slice(1, 4) }
                : { timezone: fallback, source: 'default', matched: digits.slice(1, 4) };
  }
  // Country codes are one to three digits; prefer the longest match.
  for (const length of [3, 2, 1]) {
    const prefix = digits.slice(0, length);
    if (COUNTRY_CODES[prefix]) return { timezone: COUNTRY_CODES[prefix], source: 'country_code', matched: prefix };
  }
  return { timezone: fallback, source: 'default' };
}
