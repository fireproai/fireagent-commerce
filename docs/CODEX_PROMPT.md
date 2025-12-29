# Codex Standing Instructions — fireagent-enterprise

## 1. Project context

- Repository: `fireagent-enterprise`
- Stack: Next.js (canary), App Router
- PIM: **Plytix is the single source of truth**
- Catalog structure must be **data-driven**, never hardcoded

## 2. Non-negotiable rules

- Navigation **always** comes from `/api/nav`
- Do **not** hardcode brands, categories, Gent logic, or product families
- A 3rd navigation tier exists **only if** `nav_group_1` has data
- Do **not** change `/api/nav` response shape unless explicitly instructed
- Do **not** store live Plytix JSON in the repo (samples only)

## 3. Data contracts (critical)

`/api/nav` returns:

- `tree` → **array shape**, not object
- `slug_map.lookup.rootBySlug`
- `slug_map.lookup.groupBySlug`
- `slug_map.lookup.group1BySlug` (may be empty)

Rules:

- Slugs are derived **only** via shared `slug.ts`
- Pages must resolve **slug → label → tree**
- Do not re-slugify labels blindly inside pages

## 4. Routing rules

Valid routes:

- `/products`
- `/products/[root]`
- `/products/[root]/[group]`
- `/products/[root]/[group]/[group1]`

Rules:

- `notFound()` must only be called when a slug is truly invalid
- Absence of `group1` data must **not** trigger `notFound()`

## 5. Change discipline

- Codex must list all files changed (with paths)
- Codex must explain **why** each change was made
- Codex must include a clear test plan
- Prefer **small, isolated refactors** over sweeping rewrites
- Do not refactor unrelated code
