# Retell AI setup

The service supports two voice providers behind one interface. `VOICE_PROVIDER=retell` is the
default; `VOICE_PROVIDER=bland` keeps the original Bland path working unchanged. Everything else —
the consent gate, DNC precedence, calling windows, Relink/Zeus criteria confirmation, the Matrix
adapter boundary, and the thirteen tools — is provider-agnostic and is not duplicated.

## What differs from Bland

| Concern | Bland | Retell |
|---|---|---|
| Prompt delivery | `task` string sent per call | persistent **Agent** + **Response Engine (LLM)**; per-call `retell_llm_dynamic_variables` |
| Dispatch | `POST /v1/calls` | `POST /v2/create-phone-call` |
| Auth | raw key in `authorization` | `Authorization: Bearer <key>` |
| Inbound binding | `POST /v1/inbound/{number}` | `PATCH /update-phone-number/{number}` with `inbound_agents` / `outbound_agents` |
| Webhook signature | HMAC-SHA256 of raw body, separate secret | `X-Retell-Signature: v={ms},d={hex}`, HMAC-SHA256 of `rawBody + timestamp`, keyed by the **designated webhook key**, 5-minute freshness window |
| Tools | `input_schema` + `{{input.x}}` body map | `type:"custom"` with `parameters` and `payload_args_only` |
| Number purchase | API-supported | dashboard only (`NUMBER_PURCHASE_UNSUPPORTED`) |

Because Retell holds one persistent prompt, the mandatory automation disclosure lives in the agent's
`begin_message` as a variable template, and per-call context arrives as dynamic variables:

```
Hi {{first_name}}, this is {{assistant_name}}, an automated {{service_name}} representative
calling on behalf of {{agent_name}} at {{brokerage_name}}. I’m calling {{reason}}. Is now an okay time?
```

## API keys and the webhook key

Retell keys live at **Settings → API Keys** (<https://dashboard.retellai.com/settings/api-keys>).
Retell automatically designates **one** workspace key as the *Webhook Key*, and that designated key —
not necessarily the key you call the API with — signs every webhook. Set both when they differ:

- `RETELL_API_KEY` — authenticates outbound REST calls (`Authorization: Bearer`).
- `RETELL_WEBHOOK_KEY` — verifies `X-Retell-Signature`. Leave blank to fall back to `RETELL_API_KEY`,
  which is correct only when the same key carries the Webhook Key designation.

If webhooks return `INVALID_RETELL_SIGNATURE` while API calls succeed, these two have diverged.
Keys support scoped permissions; this service needs **Agent: Edit**, **Call: Edit**, and **Phone: Edit**
to bootstrap and dial, plus **History: Read** if you use call history.

## Environment

```
VOICE_PROVIDER=retell
RETELL_API_KEY=            # Settings -> API Keys
RETELL_WEBHOOK_KEY=        # the key marked "Webhook Key"; blank = same as RETELL_API_KEY
RETELL_DRY_RUN=true        # false only after review; live calls are billable
RETELL_AGENT_ID=           # written by scripts/bootstrap-retell.js --apply
RETELL_LLM_ID=             # written by scripts/bootstrap-retell.js --apply
RETELL_VOICE_ID=retell-Cimo
RETELL_FROM_NUMBER=+12365009709
RETELL_INBOUND_NUMBER=+12365009709
```

## Bootstrap

```bash
npm run bootstrap:retell          # dry run; writes generated/retell-bootstrap-preview.json, calls nothing
npm run bootstrap:retell:apply    # creates/updates the LLM + Agent and binds the number
```

The dry run redacts `x-p9-tool-key` from the preview file. `--apply` prints the `RETELL_LLM_ID` and
`RETELL_AGENT_ID` to copy into `.env`; re-running with those set updates in place rather than
creating duplicates.

## Public reachability

Retell calls the thirteen tool URLs and the webhook from its own infrastructure, so
`PUBLIC_BASE_URL` must be a public HTTPS origin — a tunnel (`cloudflared tunnel --url
http://localhost:8787`) is enough for a demo. Without it the call still connects and the agent still
talks, but every tool call and the post-call webhook fail, so the agent cannot look up listings,
apply do-not-call, or record the outcome. Re-run `bootstrap:retell:apply` after the URL changes,
because the tool URLs are baked into the agent.

## Calling window

The gate uses the **contact's** timezone: 09:00–20:00 on weekdays, 10:00–18:00 on weekends. This is
a CRTC-style control and should not be widened for production use.

Since the demo console asks only for a name and a number, the server derives that timezone from the
number itself in `src/phone-timezone.js` — NANP area code first (`403` → `America/Edmonton`,
`416` → `America/Toronto`), then country calling code (`+91` → `Asia/Kolkata`), longest prefix
first so `+971` is not read as `+97`. Unknown prefixes fall back to `DEFAULT_TIMEZONE`, and any
caller may still pass an explicit `timezone` to override. The response reports both the timezone
used and its `timezoneSource` (`area_code`, `country_code`, `default`, or `explicit`).

Numbers port between regions and people travel, so this is a geographic hint rather than proof of
the recipient's location. It is the right default for a demo console; a production CRM should carry
a per-contact timezone captured at consent time and pass it explicitly.
