# Relink/Zeus and Matrix boundary

## Non-negotiable separation

Within this customer-calling service, Relink/Zeus performs only speech/text → normalized listing-search attributes. It returns a draft, confidence, missing fields, conflicts, and the next clarification question. The customer hears a complete read-back and explicitly confirms before the criteria record becomes searchable. The broader Pillar 9 phone-first listing-creation/maintenance Zeus microservice remains a separate workstream described in `PROJECT_CONTEXT.md`.

The voice model must never:

- construct Matrix queries;
- receive Matrix credentials;
- retrieve private remarks, showing instructions, access codes, occupant data, agent-only fields, or full raw records;
- invent public URLs;
- silently broaden a specific area such as NW Calgary to all Calgary.

## Required adapter endpoints

All endpoints use server-to-server authentication. The voice service sends `Authorization: Bearer $MATRIX_API_KEY` and JSON.

### `POST /v1/listings/search`

Request:

```json
{
  "criteria": {
    "priceMin": 600000,
    "priceMax": 700000,
    "bedroomsMin": 3,
    "bathroomsMin": 2,
    "areas": ["NW Calgary"],
    "propertyTypes": ["detached"],
    "mustHave": ["double garage"],
    "niceToHave": ["finished basement"],
    "exclude": ["condo fee"],
    "targetMoveDate": "three months"
  },
  "limit": 5
}
```

Response:

```json
{
  "listings": [
    {
      "matrixId": "A1234567",
      "status": "ACTIVE",
      "listPrice": 675000,
      "address": "Public display address",
      "city": "Calgary",
      "province": "AB",
      "propertyType": "detached",
      "bedrooms": 3,
      "bathrooms": 2.5,
      "features": ["double garage"],
      "publicRemarks": "Approved public remarks only",
      "publicUrl": "https://approved-listing-host.example/A1234567",
      "updatedAt": "2026-08-29T10:00:00Z"
    }
  ],
  "count": 1,
  "source": "Matrix",
  "asOf": "2026-08-29T10:00:01Z",
  "statusNotice": "Confirm current status with the licensed professional."
}
```

### `GET /v1/listings/{matrixId}`

Returns one listing with the exact public-field allowlist above, source, and update time. Return 404/410 for non-public, expired, deleted, or inaccessible records. Never return a raw provider record.

### `POST /v1/market/context`

Request: `{ "area": "NW Calgary" }`.

Response statistics need `metric`, numeric `value`, `unit`, `period`, `source`, and `asOf`. They must be approved for customer presentation and clearly historical. No forecast or model-generated valuation belongs in this endpoint.

## Operational rules

- Allow at most five search results and three comparisons per tool call.
- Enforce field allowlists after provider mapping, not only before.
- Require TLS, short timeouts, service authentication, audit IDs, rate limits, and no credentials in logs.
- Validate `publicUrl` against `APPROVED_LISTING_HOSTS`; the messaging service resolves links from Matrix IDs server-side.
- Provide a data-use agreement and confirm Matrix display/licensing rules before production.
- Confirm the Pillar 9/Matrix/OneRLS ownership and routing boundary; this service must not bypass the designated adapter.
- Use the fixture adapter only for development. Production config refuses `MATRIX_MODE=fixture`.

## Packaged Calgary fixture

`fixtures/calgary-synthetic-5000.sqlite` exercises this boundary with 5,000 complete, public-field-only records. It is not a Matrix export and does not establish Matrix field names or data rights. Search responses identify the source as `Pillar 9 synthetic Calgary fixture (not Matrix)`, every property carries a synthetic warning, and internal fixture fields such as record hashes and split labels are removed from customer-facing results.

The fixture adds searchable community, quadrant, living-area, year-built, garage-space, condo-fee, must-have, exclusion, and nice-to-have ranking fields while retaining the five-result cap. See `SYNTHETIC_CALGARY_DATASET.md` for exact catalog coverage and limitations.
