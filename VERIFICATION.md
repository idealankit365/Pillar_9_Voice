# Verification record

Verified on 2026-08-30 with Node.js 24.19.0. Re-verified on 2026-08-30 with Node.js 26.4.0 after the
Retell AI provider was added (`VOICE_PROVIDER=retell` is now the default; the Bland path is retained).

- JavaScript syntax check: passed for every file in `src/`, `scripts/`, and `test/`.
- Dataset JSON parse: passed.
- Knowledge build: passed; 74 FAQ/objection/conversation records rendered.
- Bland bootstrap dry run: passed; 13 redacted custom-tool definitions and inbound preview rendered.
- Bland Agent Testing bootstrap dry run: passed; 20 assertion-backed scenarios rendered.
- End-to-end synthetic smoke flow: passed (speech criteria → draft → confirmation → Matrix fixture match → disclosure-first call payload).
- Calgary fixture build: **5,000 properties**, **119 required fields**, **8,784/8,784 named street references**, **380/380 major-road names**, **223/223 residential communities**, four quadrants, and zero validation errors.
- SQLite `PRAGMA integrity_check`: `ok`; SQLite and JSONL property counts both equal 5,000.
- Property-level splits: 3,996 train, 493 development, 511 locked holdout.
- Fixture dataset hash: `5320136aa4ad7aa6c49a7ad734250767c0eb0ee0b84b320d2ec2296561dc7cf8`.
- Packaged SQLite SHA-256: `c79881a40de0d07aefb5ee7eef585b8d9d430c61f22da809c94951b234118e98`.
- JSONL SHA-256: `b468571ec74478f92d0b7a60495249271213bc14e144c4104d8570c3c396376e`.
- OpenAI Responses request-shape test: passed against a local mock (`gpt-5.6-luna`, `store:false`, hashed safety identifier).
- Meta WhatsApp Cloud API request-shape, webhook challenge, raw-body HMAC, criteria/search, STOP, birthday, template, and handoff tests: passed without a provider call.
- One-page demo panel, browser security headers, limited demo-key API, consent refusal and activity route tests: passed.
- Node test suite: **108 passed, 0 failed** (80 original + 28 provider/international/timezone additions).
- Timezone is derived from the normalized E.164 number, so `4035550777` resolves via `+1`/`403`, never via country code `40`; `+91…` is not confused with NANP area code `917`; `normalizePhone` rejects a leading-zero country code; and a number already held by a CRM contact reuses that record instead of breaching the `contacts.phone` UNIQUE constraint.
- Contact-timezone derivation: NANP area codes (nine provincial cases), international country codes, longest-prefix precedence (`+971` over `+97`, `+880` over `+88`), default fallback, explicit override, and per-recipient window gating verified live across India, Alberta, British Columbia and Ontario numbers at one instant.
- Retell provider: outbound `create-phone-call` payload shape, dynamic-variable disclosure, live-dispatch isolation from Bland, compliance-gate blocking before dispatch, agent-id precondition, 13 custom tools + `end_call` + 2 `transfer_call`, inbound agent binding, and provider reporting: passed.
- Retell webhook: `X-Retell-Signature` (`v={ms},d={hex}`, HMAC-SHA256 over raw body + timestamp, keyed by the API key), wrong-key rejection, 5-minute replay rejection, malformed-header rejection, and per-`call+event` idempotency: passed.
- International E.164 destinations accepted (`normalizePhone`); NANP normalization and the short-number rejection are unchanged.
- Retell bootstrap dry run: passed; LLM + agent preview rendered with `x-p9-tool-key` redacted, no provider call made.
- Calgary fixture rebuilt after the change: dataset hash unchanged at `5320136aa4ad7aa6c49a7ad734250767c0eb0ee0b84b320d2ec2296561dc7cf8`.
- No Retell account was called during verification; `RETELL_DRY_RUN=true` throughout.

No external Bland, Meta WhatsApp, OpenAI, Matrix, OneRLS, compliance/DNCL, CRM, SMS/email, calendar, or telephony account was called during verification. Bland and WhatsApp remained in dry-run/local-mock mode. Live acceptance requires the real adapters, credentials, Canadian-capable numbers, Meta-approved templates, OpenAI project/budget, voice selection/rights, specifically consented test contacts, and documented owner sign-off in `DEPLOYMENT_CHECKLIST.md`.
