# Copilot Instructions — FireAgent Enterprise / Commerce

## Purpose
This file exists ONLY to stop GitHub Copilot from hallucinating or making unsafe assumptions.
Accuracy and minimal change are more important than cleverness.

If something is not explicitly visible in the repository, say “not confirmed”.

---

## Absolute Rules (must follow)

- Do NOT invent versions, features, integrations, or tooling.
- Do NOT assume framework versions (Next.js, React, Tailwind, etc).
- Do NOT refactor architecture unless explicitly asked.
- Always reference the exact file path when suggesting changes.
- Prefer small, incremental diffs over large rewrites.
- When providing code, give **complete, ready-to-paste blocks**.
- If unsure, ask or point to the file that must be checked.

This repo is part of a production FireAgent / PIM / ecommerce pipeline.
Correctness > speed > cleverness.

---

## Project Overview (verified by repo only)

This project is a **Next.js App Router storefront** derived from the Vercel Commerce pattern
and integrated with **Shopify via the Storefront GraphQL API**.

Details such as framework versions, build tools, and package managers
MUST be read from the repo itself (e.g. `package.json`, lockfiles, config files).

---

## Stack (repo-verified only)

Only state facts that can be proven from files in this repository.

- Frameworks: see `package.json`
- Package manager: determined by existing lockfile  
  (`pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`)
- Styling: verify via `tailwind.config.*` and dependencies
- Build tooling: verify via `next.config.*` and npm scripts
- Shopify integration: verify via `lib/shopify/*` and environment variables referenced in code

Never guess versions or “canary” features.

---

## Architecture (pattern-based, not version-based)

- **Server Components**  
  Located in `app/` — responsible for data fetching and rendering

- **Client Components**  
  Marked with `'use client'` — handle interactivity only

- **Server Actions**  
  Located in `.ts` files — perform mutations (e.g. cart actions) and trigger revalidation

- **Shopify API Layer**  
  Centralised under `lib/shopify/`  
  Queries, mutations, fragments, and type transformations live here

---

## Caching & Revalidation

- Cache tags and constants are defined in `lib/constants.ts`
- Any mutation that affects UI state must trigger revalidation
- Do not assume specific Next.js cache APIs — follow existing patterns in the repo

---

## Conventions

### File organisation
- `app/` → routes, layouts, pages (server-first)
- `components/` → reusable UI components
- `components/cart/` → cart context, actions, optimistic UI
- `lib/` → Shopify, constants, helpers

### Types
- Use existing TypeScript types from `lib/shopify/types.ts`
- Do not introduce `any` unless already used in the repo
- If a type mismatch exists, document it instead of guessing a fix

### Cart behaviour
- Client cart state is **optimistic UI only**
- Source of truth is Shopify cart
- Cart ID is typically cookie-based and may be ephemeral

---

## Development Workflow

Do NOT invent commands.

- Use scripts exactly as defined in `package.json`
- Do not assume `pnpm`, `yarn`, or `npm`
- Do not assume Turbopack or experimental flags

If a command is needed, first confirm it exists in the repo.

---

## What NOT to do

- ❌ Do not upgrade dependencies implicitly
- ❌ Do not change folder structure
- ❌ Do not add CMS, auth, or webhook logic unless asked
- ❌ Do not “modernise” code for the sake of it
- ❌ Do not assume this is a demo or template — it is production-bound

---

## When in doubt

Say one of the following:
- “Not confirmed — check `<file path>`”
- “This repo does not show evidence of that feature”
- “Please confirm before proceeding”

Silence is better than hallucination.
