# Beulah Foods — Testing & Verification Plan

## Purpose

This document records the seven-phase testing plan for Beulah Foods. The goal is to verify that the implementation follows the project's documented architecture, business rules, and feature contracts.

The testing workflow follows the project's existing development principle:

`PLAN → IMPLEMENT → CONNECT REAL DATA/SERVICE → TEST → FIX → VERIFY`

## Seven phases

| Phase | Scope | Status |
|---|---|---|
| 1 | GitHub Actions foundation and repository baseline checks | 🟨 In progress |
| 2 | Project checks: dependencies/scripts, linting, formatting, and static validation | ⬜ Not started |
| 3 | Unit and integration tests for application/business logic | ⬜ Not started |
| 4 | Supabase/database tests: schema, RLS, RPCs, constraints, and business rules | ⬜ Not started |
| 5 | Cloudflare Worker and API tests, including payment/email boundaries | ⬜ Not started |
| 6 | Browser end-to-end tests with real project workflows | ⬜ Not started |
| 7 | Unified `test:all` verification and CI quality gate | ⬜ Not started |

## Phase 1 — GitHub Actions foundation

### Objective

Create an independent CI check that runs on pushes and pull requests and establishes a clean baseline before deeper test tooling is introduced.

### Initial checks

- Repository checkout succeeds.
- Required project documentation exists.
- Locked application areas exist.
- JavaScript files pass Node syntax checking.
- Obvious forbidden framework/build-tool references in application source are detected.
- A service-role secret is not present in browser-facing source.

### Exit criteria

Phase 1 is complete when:

1. `.github/workflows/test.yml` exists and runs successfully on GitHub Actions.
2. The baseline checks pass on the current repository.
3. The seven-phase plan is committed and tracked in this file.
4. Any baseline failure is fixed or explicitly documented before Phase 2 begins.

## Rules for progressing phases

- Complete the current phase before starting the next.
- Do not add tests that contradict `PROJECT.md`, `ARCHITECTURE.md`, `RULES.md`, `FEATURES.md`, or `AGENTS.md`.
- Prefer tests of documented behavior and business contracts over implementation details.
- Do not introduce a framework or build tool merely to make testing easier.
- Real Supabase-backed behavior must be used for integration/E2E verification where the documentation requires real data.
- A phase is not complete merely because its tooling is installed; its exit criteria must be satisfied.

## Phase completion record

### Phase 1

- Started: 2026-09-13
- CI workflow: `.github/workflows/test.yml`
- Current state: In progress
- Completion commit: pending first successful CI run

### Phase 2

- Completion commit: pending

### Phase 3

- Completion commit: pending

### Phase 4

- Completion commit: pending

### Phase 5

- Completion commit: pending

### Phase 6

- Completion commit: pending

### Phase 7

- Completion commit: pending
