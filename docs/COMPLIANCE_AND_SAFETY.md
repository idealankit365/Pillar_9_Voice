# Canadian compliance and safety controls

This is an engineering control summary, not legal advice. Pillar 9 and each participating brokerage must obtain current Canadian federal/provincial and contractual review before live calls.

## Identity and role

- The first sentence says the caller is automated, names Pillar 9, names the licensed professional and brokerage, states the exact purpose, and asks whether it is a good time.
- If challenged, the caller plainly repeats that it is automated.
- The assistant never claims to be a human, REALTOR, broker, appraiser, mortgage professional, inspector, lawyer, or customer’s friend.
- Pillar 9 is not presented as the brokerage. Licensed activity is transferred to the configured verified professional.

## Calling permission

- Maintain evidence of exact-purpose, channel-specific consent and its source, capture time, expiry, and revocation.
- Screen the internal DNC list immediately before every outbound call. Synchronize any required National DNCL process outside this reference implementation.
- A wrong-number or opt-out statement triggers the DNC tool immediately, revokes known outreach consent, confirms once, and ends.
- Use contact-local hours. Defaults are deliberately conservative: weekdays 09:00–20:00 and weekends 10:00–18:00.
- Do not infer marketing consent from an inbound call, a property inquiry, or consent on a different channel/purpose.
- Birthday calls need relationship-message consent, the exact contact-local date, and no proactive sales transition.

## SMS and email

- Separate SMS/email consent is checked for the exact template purpose.
- Only approved templates can be sent. SMS includes STOP. Commercial email includes the configured HTTPS unsubscribe URL.
- Listing links come only from current Matrix listing IDs and an HTTPS hostname allowlist.
- Messaging-provider delivery receipts and inbound STOP processing must update the central suppression record.

## WhatsApp

- WhatsApp is a separate channel with separate purpose consent. A customer-initiated message permits a bounded service reply; it does not create birthday, relationship, listing-update, or marketing consent.
- Proactive WhatsApp messages always use a configured Meta-approved template. The 24-hour customer-service window never overrides suppression, exact-purpose consent, or Canadian legal requirements.
- STOP, UNSUBSCRIBE, END, CANCEL, QUIT, do-not-contact, and wrong-number language applies global suppression before any model call.
- Every first reply and proactive template identifies the automation, Pillar 9, the licensed professional, and brokerage. Do not disguise the bot as a person.

## Recording and privacy

- Recording is off by default. Unknown inbound calls remain unrecorded in this reference.
- Enabling outbound recording still requires a separate active `voice/call_recording` consent record and an approved notice process.
- Store minimum CRM context. Never collect card/bank credentials, passwords, government ID, detailed mortgage application data, access codes, protected-trait inferences, or private Matrix remarks.
- Webhooks are checked against an HMAC signature over the exact raw body and processed idempotently.
- Logs redact phone numbers and email addresses; production observability needs a formal retention/access policy.
- OpenAI receives only bounded, redacted WhatsApp history and approved public fixture/listing context. Requests use `store:false` and a hashed safety identifier. Do not add CRM notes, private Matrix fields, identity/financial documents, or raw provider payloads to prompts.

## Advice boundaries

The assistant may state verified public listing facts, compare factual fields, show sourced dated historical statistics, and calculate an educational Canadian principal-and-interest scenario from customer-provided assumptions.

It may not provide:

- a property valuation or pricing opinion;
- offer amount, negotiation strategy, commission or contract/agency interpretation;
- a prediction or guarantee of appreciation;
- lender/product/rate recommendation or qualification decision;
- legal, tax, financial, investment, inspection, or safety advice;
- discriminatory steering or community characterization based on protected or subjective traits.

Use the human escalation tool when the line is crossed or information cannot be verified.

## Approval evidence before launch

- Current [CRTC telemarketing rules](https://crtc.gc.ca/eng/phone/telemarketing/reg.htm) and [unwanted-call guidance](https://crtc.gc.ca/eng/phone/telemarketing/) review.
- Current [CASL guidance](https://www.fightspam.gc.ca/eic/site/030.nsf/eng/00012.html) for texts/emails and any other covered messages.
- Applicable provincial regulator review, including [RECA’s regulated-industry scope](https://www.reca.ca/which-industry/) for Alberta workflows.
- Brokerage policies, Pillar 9/Matrix licensing/display terms, privacy impact assessment, incident plan, and named accountable owners.

Rules and interpretations can change. Record the reviewer, date, jurisdiction, conclusion, and any exemptions; do not encode an assumed exemption in the model prompt.
