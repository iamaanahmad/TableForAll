# TableForAll

Plan one group dinner without starting another group chat.

Guests reply by email. OpenAI extracts their constraints. Firecrawl researches venue sites. Convex keeps the shortlist and vote live. AgentMail verifies the plan inbox.

## Live demo

[Open TableForAll](https://aware-shark-108.convex.site/)

Convex serves the app and stores its live state. It checks AgentMail access without sending email. Firecrawl refreshes three public restaurant sources. OpenAI uses structured outputs when the configured account has quota.

## Local preview

```bash
npm install
npm run dev
```

The app opens in a marked interactive preview when Convex is not configured.
Click **Sync guest reply** to add a safety constraint and update the shortlist.
The preview never claims to call sponsor services.

## Connected setup

1. Copy `.env.example` to `.env.local`.
2. Run `npx convex dev` and select a deployment.
3. Put the generated `VITE_CONVEX_URL` in `.env.local`.
4. Add the sponsor keys to the Convex deployment environment.
5. Restart `npm run dev`.

The connected path stores plans, constraints, research, votes, and events in Convex.
It uses OpenAI structured outputs for reply extraction.
It uses Firecrawl v2 for venue research.
It uses AgentMail for scoped account checks and optional inbox polling.

Required Convex environment values:

```text
OPENAI_API_KEY
OPENAI_MODEL
FIRECRAWL_API_KEY
AGENTMAIL_API_KEY
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Live integrations

Never treat extracted menu details as an allergy guarantee. The interface keeps source links visible and requires venue confirmation.

The marked demo path never emails an outside recipient. If OpenAI returns a quota error, the interface labels it and uses a narrow local fallback for the marked safety reply.
