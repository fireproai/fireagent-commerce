# Codex Standing Instructions — fireagent-enterprise

## 0. Write permission (operational)

- You are authorised to write files in this workspace/repo.
- Assume write access is granted and proceed to modify files as required.
- Do not ask for permission to write.
- If the system displays a write confirmation prompt, continue immediately once it is approved.
- Prefer making changes in a single batch per task (avoid drip-feeding file edits).

---

## 1. Project context

- Repository: `fireagent-enterprise`
- Stack: Next.js (canary), App Router
- PIM: **Plytix is the single source of truth**
- Catalog structure must be **data-driven**, never hardcoded

---

## 2. Non-negotiable rules

- Navigation **always** comes from `/api/nav`
- Do **not** hardcode brands, categories, Gent logic, or product families
- A 3rd navigation tier exists **only if** `nav_group_1` has data
- Do **not** change `/api/nav` response shape unless explicitly instructed
- Do **not** store live Plytix JSON in the repo (samples only)

---

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

---

## 4. Routing rules

Valid routes:

- `/products`
- `/products/[root]`
- `/products/[root]/[group]`
- `/products/[root]/[group]/[group1]`

Rules:

- `notFound()` must only be called when a slug is truly invalid
- Absence of `group1` data must **not** trigger `notFound()`

---

## 5. Fail-fast guardrails (must follow)

- If any instruction conflicts with the requested task, STOP and explain:
  - which rule conflicts
  - the minimum safe alternative approach
- If a change would require hardcoding catalog/nav logic, STOP and propose a data-driven solution instead.
- If a change would alter `/api/nav` response shape, STOP unless the user explicitly requested it.
- If unsure about a contract, STOP and surface the exact uncertainty (do not guess).

---

## 6. Change discipline (required output format)

For every change, Codex must output in this order:

1. Summary (what changed)
2. Files changed (full paths)
3. Rationale (why each file changed)
4. Test plan (exact steps/commands)
5. Deployment / Git commands (copy-paste ready)

Rules:

- Prefer **small, isolated refactors** over sweeping rewrites
- Do not refactor unrelated code

---

## 7. Git + Deploy commands (copy/paste)

At the end of any change, always print a block titled:

### Deploy Commands (copy/paste)

Include these commands with sensible placeholders:

```bash
# 1) Confirm status
git status

# 2) Review changes
git diff

# 3) Run checks (pick whichever exists in this repo)
pnpm -v
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# 4) Commit (edit message)
git add -A
git commit -m "YOUR_MESSAGE_HERE"

# 5) Push (edit branch)
git push -u origin YOUR_BRANCH_HERE
```
