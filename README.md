# SafeZone

SafeZone helps people document safety concerns, review practical next steps, access emergency options, and browse coarse community report summaries. Assessments support user judgment; they do not verify events or guarantee safety.

## Product capabilities

- Text reports and editable browser speech transcripts.
- LOW / MEDIUM / CRITICAL assessment with observable signals, recommended actions, and optional evidence guidance.
- A deterministic local safety assessment when Nebius is unavailable or local assessment is explicitly selected.
- Private browser-stored incident timelines and user-controlled resolution.
- User-triggered emergency options, a 999 dialer link, emergency resource listing, route preview, and a confirmation-based trusted-contact alert preview.
- Community reports grouped by approximate area, category, and time window.

## Architecture and safety

```text
Next.js UI
  -> POST /api/analyze + Zod request validation
  -> Nebius Token Factory / NVIDIA Nemotron
       -> deterministic local assessment if remote AI is unavailable
  -> response schema validation
  -> deterministic safety policy
  -> user-controlled actions and private incident record
  -> separate coarse community report aggregates
```

`lib/schemas.ts` defines the data contracts. `lib/ai/` contains the Nebius provider, response parser, and local assessment rules. `lib/safety-policy.ts` applies explicit emergency overrides and controls risk guidance after provider output is validated. Emergency Mode does not depend on AI, location, voice transcription, or a network request. No call or notification is triggered automatically.

The community report data is a fixed sample aggregate and is not populated from personal incident records. Emergency resources are fictional local sample points, not verified police stations or safe places. When the user explicitly provides coordinates, the app calculates and sorts distances to those sample points locally; this does not verify that any real resource exists there. Route output remains illustrative, is not calculated from coordinates, and live navigation is not connected. Trusted-contact alerts require a confirmation screen and are validated by a server endpoint, but no messaging provider is currently configured, so the app only shows a clearly labeled preview and sends nothing. The 999 link opens the device dialer only after the user taps it; the device and carrier handle any call.

## Community Intelligence Privacy Model

`lib/community/` defines a synthetic contribution contract and a pure aggregation engine for future use. A contribution contains only a coarse area ID, category, severity, and coarse ISO week bucket. It excludes exact coordinates, addresses, incident/user IDs, contact details, report text, AI output, and evidence. Contributions require an already-derived coarse area and time bucket; this code does not geocode or derive either value from current user incidents.

Aggregates below the centrally configured `MIN_COMMUNITY_COUNT` are omitted. If any category or severity subgroup is below that policy value, both breakdowns are suppressed to avoid revealing a small subgroup by subtraction. This is a configurable privacy policy, not a legal or scientific guarantee of anonymity. The engine uses synthetic fixtures only: current community UI values remain illustrative sample data, real multi-user aggregation and persistence are not implemented, coordinate-to-area mapping is not implemented, and server-owned timestamps are not implemented. Client-generated timestamps must not be treated as authoritative when this is connected to a backend.

## Trusted-contact alert architecture

`POST /api/alerts/trusted-contact` validates the incident identifier, severity, category, and phone destination, then builds a short message on the server. The `NotificationProvider` interface isolates delivery from the application layer. This repository currently uses `UnconfiguredNotificationProvider`; no SMS, email, WhatsApp, or other notification provider or provider credentials are present. The UI checks `/api/alerts/trusted-contact/status` and presents the message as **Preview — not delivered** when no provider is configured. It does not show an alert as sent. If a provider is added later, the UI must still require the user to press **Send alert**, and provider acceptance must not be presented as confirmed delivery.

Location is excluded by default. Coordinates are included in the request only when the user selects **Share my location with trusted contact** and the incident already has valid attached coordinates; the alert flow does not request GPS. The message contains only SafeZone alert wording, incident category, severity, time, and an optional map link. It excludes the report text, evidence, AI output, and application metadata. Provider credentials, if introduced, must be read only by server-side provider code and must never use `NEXT_PUBLIC_*` variables or browser storage. There are no alert-provider environment variables to configure in this version.

This endpoint does not authenticate the requester, and alert request data is supplied by the browser rather than loaded from a server-owned incident store. No provider is enabled, so this build cannot deliver alerts. Before connecting a live provider, add appropriate requester authorization or abuse controls and operational safeguards; do not treat the current preview as a production alert channel.

## Nebius and NVIDIA Nemotron

The server calls Nebius Token Factory's OpenAI-compatible chat completions endpoint with an NVIDIA Nemotron model. `NEBIUS_MODEL` handles the first pass. If confidence is low or the response is ambiguous, the optional `NEBIUS_STRONG_MODEL` handles a second pass. Requests have a configurable timeout; response content is parsed and validated against the assessment schema.

If credentials are missing, the request fails, or the response is invalid, the server uses the deterministic local safety assessment and returns a notice identifying the source. If both provider paths fail, `/api/analyze` returns a recoverable 503. API keys remain server-side.

## Environment variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `nebius` (default) or `local` |
| `NEBIUS_API_KEY` | Server-only Token Factory key |
| `NEBIUS_BASE_URL` | Token Factory API base URL |
| `NEBIUS_MODEL` | First-pass Nemotron model ID |
| `NEBIUS_STRONG_MODEL` | Optional model for ambiguous reports |
| `NEBIUS_TIMEOUT_MS` | Remote request timeout in milliseconds |

With `AI_PROVIDER=nebius`, a missing key or unavailable service activates local assessment automatically. Set `AI_PROVIDER=local` to use local rules without making a remote request. Never commit `.env.local` or an API key.

## Emergency and location behavior

Emergency Mode offers the 999 dialer, distance-sorted fictional resource points, an illustrative route preview, and a trusted-contact alert preview. Users initiate each action. Browser geolocation is requested only after the user chooses a location action. Coordinates remain in browser storage and can be attached to an incident; they are used only to calculate distances to the fictional sample points, not to discover verified resources or calculate routes. Removing location from an incident also clears the standalone saved location while preserving other incident details. Location is not included in AI requests or community aggregates. For trusted-contact alerts, attached coordinates remain excluded unless the user explicitly enables location sharing for that alert. Denial does not block reports or emergency options.

Voice transcription uses speech recognition provided by the browser or platform. Depending on that service, audio may be processed by the browser/platform speech service before you submit the reviewed transcript to SafeZone for analysis.

## Privacy and security

- Reports, incident records, preferences, and private evidence notes are stored in browser local storage for this version. This is not suitable for sensitive production records.
- The community map receives only sample aggregate records; private reports, exact coordinates, evidence, contact details, and identity are not published to it.
- User report text is rendered as text and is never interpreted as HTML. API input and model output are schema validated.
- No camera/audio evidence is uploaded, no background audio capture, automatic calls, or automatic notifications are implemented. Trusted-contact details remain in browser storage; alert requesters are not authenticated by this version.
- The classifier is not a validated risk model and cannot confirm a person's safety or identify a suspect.

## Run and validate

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Run the automated checks with:

```bash
npm run test
npm run lint
npm run build
```

The tests cover deterministic risk scenarios, emergency policy overrides, incident lifecycle, location failure behavior, community privacy boundaries, and trusted-contact payload validation, consent, provider states, message minimization, and API method handling.

## Known limitations

There is no authentication, durable backend, live police/resource lookup or verified location-based resource discovery, navigation provider, location-based route calculation, configured trusted-contact messaging service, live community feed, media evidence storage, or server-side voice transcription. Community reports, resources, and routes are samples and should not be treated as current or verified information. Browser speech recognition availability and audio handling vary by browser/platform. Production use would need authenticated encrypted storage, retention controls, independently reviewed emergency resources, safety evaluations, abuse controls for alert sending, and operational monitoring.
