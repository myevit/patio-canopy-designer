# Local-First Patio Canopy Designer Scaffold Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Establish a tested, local-first TypeScript monorepo for a patio-canopy calculator and interactive 3D designer.

**Architecture:** A static React/Vite application consumes pure calculation and parametric-geometry packages. All project data remains in the browser and can be exported/imported as versioned JSON. There is no backend, telemetry, authentication, cloud SDK, or deployment infrastructure.

**Tech Stack:** npm workspaces, TypeScript strict mode, React, Vite, React Three Fiber/Three.js, Zod, Vitest, React Testing Library, Playwright, ESLint, Prettier, vite-plugin-pwa.

---

## Architectural rules

1. `packages/shared` owns versioned design schemas, SI-unit types, and validation.
2. `packages/calculations` owns deterministic pure calculations and may depend only on `shared`.
3. `packages/geometry` converts validated designs into renderer-independent scene primitives and may depend only on `shared` and `calculations`.
4. `apps/web` owns UI, browser persistence, PWA behavior, and Three.js rendering.
5. Domain packages must not import React, Three.js, browser globals, AWS SDKs, analytics, or network clients.
6. Normal application use must make no network calls after assets are loaded.
7. Structural output must be labelled preliminary planning information, not professional engineering approval.
8. Calculations use SI internally; display-unit conversion occurs at system boundaries.
9. Every behavior is developed test-first using RED-GREEN-REFACTOR.
10. Do not add deployment infrastructure in this phase.

## Task 1: Establish repository governance and workspace

**Objective:** Create shared agent guidance and a minimal npm-workspace skeleton.

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.nvmrc`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: workspace package manifests under `apps/web` and `packages/*`

**Verification:**
- `npm install`
- `npm run typecheck`

## Task 2: Add the versioned project schema using TDD

**Objective:** Define a minimal design document with metadata, unit system, site reference elevation, patio outline, and canopy member collections.

**Files:**
- Create: `packages/shared/src/design-schema.ts`
- Create: `packages/shared/src/design-schema.test.ts`
- Create: `packages/shared/src/index.ts`

**TDD sequence:**
1. Write a failing test for accepting a minimal valid design.
2. Run the focused test and verify the expected failure.
3. Implement the smallest schema that passes.
4. Write a failing test rejecting non-finite or negative dimensions.
5. Implement the validation.
6. Run focused and workspace tests.

## Task 3: Add unit conversion primitives using TDD

**Objective:** Provide explicit metre/millimetre/foot/inch conversion functions while keeping internal values in metres.

**Files:**
- Create: `packages/shared/src/units.ts`
- Create: `packages/shared/src/units.test.ts`

**Verification:** focused Vitest RED/GREEN cycles followed by `npm test`.

## Task 4: Add renderer-independent geometry using TDD

**Objective:** Convert a validated design containing posts and beams into plain scene primitives with positions, dimensions, and orientation.

**Files:**
- Create: `packages/geometry/src/build-scene.ts`
- Create: `packages/geometry/src/build-scene.test.ts`
- Create: `packages/geometry/src/index.ts`

**Constraint:** Do not import Three.js in this package.

## Task 5: Create the local-first web shell

**Objective:** Render the application shell, preliminary-engineering notice, design summary, and a basic Three.js scene from the domain geometry.

**Files:**
- Create: `apps/web/src/*`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Test: `apps/web/src/App.test.tsx`

**Verification:**
- Focused failing UI test, minimal implementation, passing test.
- `npm run build`
- Browser smoke test of the production build.

## Task 6: Add offline/local persistence boundary

**Objective:** Export and import versioned project JSON and provide an IndexedDB repository interface without any network access.

**Files:**
- Create: `apps/web/src/storage/*`
- Test: `apps/web/src/storage/*.test.ts`

**Verification:** invalid documents are rejected by the shared schema; valid documents round-trip without loss.

## Task 7: Add quality gates

**Objective:** Make local and GitHub validation reproducible.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: Playwright configuration and one smoke test
- Update: root scripts and README

**Required commands:**
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`

## Acceptance criteria

- Fresh clone installs with one documented command.
- All required quality commands pass.
- Production output is static.
- App loads locally and displays a basic parametric canopy scene.
- App contains no AWS dependency, backend endpoint, telemetry, or required account.
- Browser project documents are versioned and validated.
- Git working tree is clean after the verified scaffold commit.
