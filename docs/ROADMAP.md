# FireAgent — Product Roadmap (Non-Binding)

This document captures ideas, milestones, and future improvements discussed during development.
Nothing in this file is implemented unless explicitly requested in a task prompt.

Purpose:

- Prevent scope creep during active development
- Park ideas safely for later
- Provide strategic continuity across sessions

---

## 🟢 Current Focus (Active / In Progress)

- Simpro-style Quick Cart experience
  - Tabbed UI: Cart | Quote | Quotes
  - “Add from catalogue” picker (nav-driven)
  - Search-first workflow
- Quote lifecycle (anonymous / trade-first)
  - Quote creation (DB + email)
  - Quote history view (gated)
- Tokenised quote PDF access
  - Secure public link
  - Expiry-based access
- Phase-2 data readiness
  - PIM-driven PDP baseline
  - No hardcoded catalogue logic
  - SEO scaffolding without data invention

---

## 🔵 Short-Term (Next Iterations)

- Quote status lifecycle
  - Draft
  - Sent
  - Accepted
  - Expired
- Quote validity period display
- Quote reference / customer notes field
- Improved quote PDF layout
  - Footer block
  - Spacing / alignment
  - Clear quote numbering
- “Save draft quote” behaviour
- Better quote list UX (sorting, recent first)
- Downloads tab: collect datasheets / manuals / certificates for selected SKUs and download as ZIP (email required, verified account).

---

## 🟡 Medium-Term

- Logged-in account features
  - Persistent quote history
  - Saved carts
- Quote → Order conversion
- Trade-only gating
  - Approval / invite model
- Product list UX improvements
  - Sidebar filters that remember state
  - Better catalogue browsing performance
- Homepage as a brochure-style trade landing page

---

## ⚪ Long-Term / Strategic Ideas

- Project-based baskets (multiple quotes per job)
- Multi-user / team quoting
- API-first quoting endpoints
- Training & documentation integration
- Contextual FireProAi assistance
  - Product help
  - Spec lookup
  - Compatibility guidance
- Digital Product Passport (DPP) surfaced from PIM data
- Internationalisation (markets / regions)

---

## 🚫 Explicitly Out of Scope (For Now)

- Supplier-side ERP functions
  - Cost pricing, margin, markup
  - Purchase orders to manufacturers
  - Stock valuation and forecasting
- Accounting integrations
- Warehouse / logistics management
- Offline-first workflows

Note:
FireAgent intentionally supports ERP-like buyer workflows (quotes, projects, repeat ordering),
but does not act as a seller ERP or back-office system.

---

## Product Positioning (Intent)

FireAgent is intentionally designed to feel closer to an ERP buying workspace
than a traditional ecommerce brochure site.

Principles:

- Data-first, not marketing-first
- Optimised for repeat professional buyers
- Fast search and add-to-quote workflows
- Minimal visual noise
- Familiar ERP-style interactions (e.g. Simpro)

The goal is to reduce friction for experienced trade users,
not to persuade casual consumers.

---

_Last updated: 2026-01-06_
