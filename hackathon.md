# TableForAll build log

## The idea

TableForAll is an email-native group dinner planner. A host starts one plan. Guests reply without installing another app. The shortlist updates as dates, budgets, locations, and food needs arrive.

## Why this should exist

Group dinners fail in the group chat. The organizer repeats questions, compares restaurants, and chases people for votes. TableForAll turns unstructured replies into one live decision.

## Sponsor stack

- **Convex:** plans, guests, constraints, venue research, votes, integration events, and reactive updates.
- **OpenAI:** extracts structured constraints from natural email replies and explains venue fit.
- **Firecrawl:** reads restaurant websites, menus, hours, locations, and public source pages.
- **AgentMail:** verifies scoped inbox access and supports guest reply polling. The public demo sends no email.

## Current build

The app has two honest modes.
The public preview shows the full decision loop with local sample data.
The connected mode stores the same loop in Convex.
It extracts replies with OpenAI, researches with Firecrawl, and verifies AgentMail access.

Convex, Firecrawl, and AgentMail passed live calls on August 28, 2026.
OpenAI authentication passed, but generation returned `429 insufficient_quota`.
The public demo shows that limit and uses a narrow fallback for its marked test reply.

## Safety

Restaurant sites can be incomplete or stale. TableForAll always shows sources. It tells hosts to confirm allergies directly with the venue.

## MVP boundary

Dinner only. One city. Three venues. Email replies. One live vote. No booking, payments, calendars, or group chat.

## Build log

- 2026-08-27: Chose the concept after comparing three everyday-app ideas.
- 2026-08-27: Built the responsive interactive preview and connected Convex schema.
- 2026-08-27: Added OpenAI structured reply extraction.
- 2026-08-27: Added Firecrawl v2 venue research with cited sources.
- 2026-08-27: Added AgentMail inbox polling and a public no-send plan path.
- 2026-08-27: Passed lint, type checks, three tests, and the production build.
- 2026-08-28: Deployed the Convex backend and verified three Firecrawl sources.
- 2026-08-28: Verified AgentMail scoped access without sending an email.
