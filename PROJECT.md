# PROJECT.md — Beulah Foods

## What this is

Beulah Foods is a food-products e-commerce website. It has two clearly
separated areas:

1. **Storefront** (`/storefront`) — where customers browse, buy, and track
   their orders.
2. **Admin dashboard** (`/admin`) — where staff manage products, orders,
   payments, customers, promo codes, announcements, and testimonials.

This is a **separate project from BFIS** (the internal Beulah Foods
inventory system). Nothing here should assume or depend on BFIS.

## Why the project is built this way

Development on this project happens across many different tools — Claude,
Replit, OpenCode, Kilo Code, VS Code, and mobile editors like Acode. Some
of those tools don't run a build step well, and switching between them is
much easier if the project is just plain files that any editor can open
and any static file server can run — no compiling, no bundling, no
"works on my machine" surprises.

That's why the project is intentionally kept simple: normal HTML pages,
normal CSS, vanilla JavaScript, and Supabase as the backend. See
`ARCHITECTURE.md` for the full technical reasoning.

## Read these before building anything

| File | What it covers |
|---|---|
| `ARCHITECTURE.md` | The locked tech stack and how the pieces fit together |
| `DEVELOPMENT.md` | How to work on a feature, step by step, and how to run the project locally |
| `DESIGN.md` | Visual direction for storefront and admin |
| `FEATURES.md` | The full feature list for storefront and admin, with status |
| `RULES.md` | Hard rules that must never be broken |
| `AGENTS.md` | Rules specifically for AI coding agents working in this repo |

## Current status

The project has just been (re)started. Only documentation and the base
folder structure exist so far — no application features have been built
yet. See the "First Task" report delivered alongside these docs for exactly
what was created and what's still an open decision.
