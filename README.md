# PestLaunch Call Intelligence

A private call-review V1 for the PestLaunch paid engineering test. The user requested full implementation in a separate Codex chat with GPT-6.1 Sol, medium thinking.

## Current state

The project has been created with its implementation prompt, product specification, execution plan, source register, and synthetic design reference. Application implementation and cloud provisioning begin in the implementation chat; no working app or deployment is claimed here.

## Read first

1. `AGENTS.md` — workspace, privacy, authorization and evidence rules.
2. `IMPLEMENTATION_PROMPT.md` — complete implementation instruction.
3. `docs/specs/product-design.md` — product behavior, screen flow and scoring policies.
4. `docs/plans/implementation-plan.md` — ordered work, tests and release evidence.
5. `docs/context/source-register.md` — original materials and known gaps.

## Selected stack

Next.js + TypeScript; Tailwind + shadcn/ui + Lucide; Supabase Auth, Postgres and private Storage; Groq hosted transcription and structured analysis; Vercel Workflows and Vercel deployment. Validation uses Zod, Vitest, Playwright and axe. Dependency versions are verified and pinned during scaffolding.

Groq is the sole hosted AI provider. The app's code computes totals and grades. Cloud storage, authentication and workflow services are separate infrastructure components.

## Private source material

The provided recordings contain real customer information. Any retained customer-derived review notes are in ignored `.private/context/` and must be deleted after the test. Full raw recordings and transcripts from the initial review were already deleted. Source recordings can be fetched again into private ignored storage when necessary, after account/privacy checks.

The synthetic UI reference in `docs/reference/` is a design aid, not an implementation. Its upload, playback and AI results are fictional simulations. Build and validate the actual workflow independently.

## Before hosted integration

Select a dedicated Supabase organization/project, verify Groq key and Zero Data Retention, use an authorized Vercel commercial plan, and provision private reviewer access without sending unauthorized invitations. Account access alone is not evidence that any of these resources is configured.

No new paid subscription or API spending has been approved. Use available/free resources and complete local work while resolving specific external prerequisites. The test window remains unconfirmed; do not send the recruiter START message from this project.

