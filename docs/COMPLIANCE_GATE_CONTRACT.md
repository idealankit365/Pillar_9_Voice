# External outbound compliance gate contract

Production refuses to start without `COMPLIANCE_MODE=http`, an HTTPS endpoint, and credentials. This adapter lets Pillar 9’s accountable compliance system make the current legal/operational decision instead of hard-coding an assumed DNCL exemption in a language-model prompt.

## `POST /v1/outbound/check`

The voice service sends:

```json
{
  "contactId": "crm_123",
  "phone": "+14035550123",
  "timezone": "America/Edmonton",
  "mode": "buyer_followup",
  "consent": {
    "id": "consent_123",
    "source": "web_inquiry_checkbox_v2",
    "capturedAt": "2026-08-01T14:00:00Z",
    "expiresAt": "2027-08-01T14:00:00Z"
  }
}
```

Required response:

```json
{
  "allowed": true,
  "decisionId": "decision_456",
  "checkedAt": "2026-08-29T17:00:00Z",
  "code": "APPROVED",
  "reason": "Current policy decision"
}
```

The compliance service owns applicable National DNCL screening, internal/cross-system suppression, consent/legal-basis policy, jurisdiction, exemption analysis, campaign/registrant/subscriber rules, and auditable decision retention. A timeout, malformed response, or `allowed:false` fails closed before Bland receives the call.

Use mutual TLS or equivalent service controls in addition to the bearer credential where available. Never return sensitive legal notes to the voice model; return only the decision fields above.
