# ARCHITECTURE.md — Beulah Foods

## Tech stack — locked

Use only:

- HTML5
- Normal CSS (with CSS variables and reusable classes)
- Vanilla JavaScript (ES modules are allowed)
- Supabase (auth, database, storage — the backend source of truth)

Do **not** introduce React, Next.js, Vue, Angular, Tailwind, Bootstrap,
Vite, Webpack, unnecessary npm packages, SPA routing, or hash routing.

ES modules (`import`/`export` in the browser) are fine to use — that's a
browser feature, not a build tool. It does not mean adding npm or a
bundler.

## Why this stack

The project needs to be editable from many different tools (see
`PROJECT.md`), and none of those environments can be relied on to run a
consistent build pipeline. Plain static files sidestep that problem
entirely — any of them can open an HTML file and run a script.

## How the pieces fit together

```
beulah-foods/
├── storefront/     ← customer-facing site (physically separate from admin)
├── admin/          ← staff dashboard (physically separate from storefront)
└── supabase/       ← notes and (later) SQL for the Supabase project
```

- **Storefront and admin are physically separate.** Different folders,
  different HTML pages, their own CSS and JS. They are not two views of
  one app — someone should be able to delete one folder and the other
  still works.
- **Normal page navigation.** Every screen is its own `.html` file.
  Clicking a link loads a new page the normal way. No client-side router,
  no single-page app.
- **JavaScript is organized by responsibility**, inside each area:
  - `js/lib/` — low-level setup (e.g. the Supabase client)
  - `js/services/` — talks to Supabase (fetching products, placing
    orders, etc.) — this is the only layer that should call Supabase
    directly
  - `js/components/` — small reusable UI pieces (navbar, footer, product
    card)
  - `js/pages/` — the logic for one specific page, wires services and
    components together
  - `js/utils/` — small stateless helpers (currency formatting, form
    validation, etc.)

This mirrors the same shape in `/storefront` and `/admin` on purpose —
once you understand one, you understand the other. It is **not** shared
code between them; each area has its own copy of this structure.

## Supabase's role

Supabase is the backend. It is the source of truth for:

- Authentication (customer accounts and admin accounts)
- The database (products, orders, categories, promo codes, etc.)
- File storage (product images)

### The two Supabase keys — and why this matters

Supabase gives you two different keys:

- **Anon / public key** — safe to put in browser code. Supabase's
  Row Level Security (database rules) is what actually keeps data safe,
  not hiding this key.
- **Service role key** — this bypasses all security rules. It must
  **never** appear in any file inside `/storefront` or `/admin`, and
  never be committed to the repo. If a feature seems to need it in the
  browser, that's a sign the feature needs a server-side piece instead
  (see below) — stop and flag it rather than exposing the key.

### Where privileged logic runs

Some things must never be decided by the browser alone — for example,
the final checkout total, and whether a payment actually succeeded. Since
this stack has no separate Node/Express-style backend server, that
server-side logic needs to live in **Supabase Edge Functions** (or
database-level logic such as Postgres functions/RLS policies), not in
client-side JavaScript.

This is an architectural decision made to satisfy the "must not rely
solely on client-side JavaScript" rule in `RULES.md` without introducing
a separate backend framework, which is not allowed. It still needs a
human decision on exactly which Edge Functions are needed and how they're
deployed — flagged in the First Task report.

## What NOT to do

- Don't add an abstraction layer "for later." Build what the current
  feature needs.
- Don't let storefront and admin import each other's page logic.
- Don't reach for a new dependency before checking if plain HTML/CSS/JS
  can do it.
