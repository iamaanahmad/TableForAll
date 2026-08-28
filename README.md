# TableForAll 🍽️

Plan one group dinner without starting another group chat. 

Guests reply by email. OpenAI extracts their constraints. Firecrawl researches venue sites. Convex keeps the shortlist and vote live. AgentMail handles the inbox.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open_App-blue?style=for-the-badge)](https://aware-shark-108.convex.site/)
[![VibeApps Submission](https://img.shields.io/badge/Hackathon-Submission-orange?style=for-the-badge)](https://vibeapps.dev/s/tableforall)

---

## 💡 The Problem
Group dinners fail in the group chat. The organizer is constantly repeating questions, trying to compare restaurants, cross-referencing allergies, and chasing people down for their votes. It quickly becomes overwhelming. 

**TableForAll** solves this by turning unstructured email replies into one live, actionable decision.

## ⚙️ How It Works
A host starts a single dinner plan. Instead of forcing guests to download yet another app or join a new group chat, guests simply reply to an email. 
- **AgentMail** securely polls for guest replies.
- **OpenAI** extracts structured constraints from their natural language responses (dates, budgets, locations, dietary needs).
- **Firecrawl (v2)** uses these constraints to automatically research and evaluate venue sites, scraping menus and hours.
- **Convex** aggregates this data and keeps a live, real-time shortlist and vote tally updated for everyone.

## ✨ Features
- **Zero-Friction Guest Experience:** Guests reply natively via email. No apps to download.
- **AI Constraint Extraction:** Accurate parsing of messy emails into strict constraints.
- **Automated Venue Research:** Actively scrapes restaurant websites for up-to-date data with cited sources to ensure allergy safety.
- **Real-Time Polling:** Powered by Convex, app state updates instantly across all connected clients.

---

## 💻 Local preview

```bash
npm install
npm run dev
```

The app opens in a marked interactive preview when Convex is not configured.
Click **Prepare final plan** to update the shortlist.
The preview never claims to call sponsor services.

## 🔌 Connected setup

1. Copy `.env.example` to `.env.local`.
2. Run `npx convex dev` and select a deployment.
3. Put the generated `VITE_CONVEX_URL` in `.env.local`.
4. Add the sponsor keys to the Convex deployment environment.
5. Restart `npm run dev`.

The connected path stores plans, constraints, research, votes, and events in Convex.

Required Convex environment values:

```text
OPENAI_API_KEY
OPENAI_MODEL
FIRECRAWL_API_KEY
AGENTMAIL_API_KEY
```

## ✅ Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 🛡️ Safety & Live Integrations

Never treat extracted menu details as an allergy guarantee. The interface keeps source links visible and requires venue confirmation.
The marked demo path never emails an outside recipient.
