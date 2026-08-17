# AGENTS.md

Guidance for any agent (human or AI) working in this repository.

## What this project is

A local-first, static TypeScript monorepo for a patio-canopy calculator and
interactive 3D designer. There is no backend, no authentication, no cloud
SDK, no telemetry, and no deployment infrastructure. All project data lives
in the browser and is exported/imported as versioned JSON.

The authoritative delivery plan lives in
`docs/plans/2026-08-16-canopy-studio-delivery.md`. Read the current plan before
starting work and implement only the task you were assigned.

## Architecture boundaries

- `packages/shared` owns versioned design schemas, SI-unit types, and
  validation.
- `packages/calculations` owns deterministic pure calculations and may
  depend only on `shared`.
- `packages/geometry` converts validated designs into renderer-independent
  scene primitives and may depend only on `shared` and `calculations`.
- `apps/web` owns UI, browser persistence, PWA behavior, and Three.js
  rendering.
- Domain packages (`shared`, `calculations`, `geometry`) must never import
  React, Three.js, browser globals, AWS/cloud SDKs, analytics, or network
  clients.
- Normal application use must make no network calls after initial assets are
  loaded.
- Structural output is preliminary planning information, not professional
  engineering approval — this must stay visible in the UI copy.
- Canonical geometry uses explicit SI millimetres and internal angles use
  radians; display-unit conversion happens only at system boundaries.
- The canonical document stores semantic objects and stable IDs, never
  Three.js meshes, triangle indices, display coordinates, or WASM handles.
- Geometry validity, structural analysis, code checks, professional review,
  and permit status are separate states. Never collapse them into a global
  `safe`, `approved`, or `permit ready` result.

## No-cloud / no-secret rules

- Do not add AWS or any other cloud provider SDK, backend endpoint,
  authentication, or telemetry/analytics dependency.
- Do not commit secrets, API keys, tokens, or `.env` files. There should be
  nothing in this repo that requires an account or network credential to
  run.
- Do not add deployment infrastructure (CI deploy steps, IaC, hosting
  config) unless a task explicitly calls for it.

## Test-first development

Every behavior is implemented RED-GREEN-REFACTOR:

1. Write a failing test for the smallest next behavior.
2. Run the focused test and confirm it fails for the expected reason.
3. Write the minimal implementation to make it pass.
4. Run the focused test again, then the full suite, before moving on.
5. Refactor only with passing tests as a safety net.

Do not write implementation code before its failing test exists.

## Verification commands

Run from the repo root:

- `npm install` — install workspace dependencies.
- `npm run typecheck` — type-check every workspace.

Later tasks add and wire up `npm test`, `npm run lint`, `npm run
format:check`, `npm run build`, and `npm run test:e2e`. Once a command
exists, it must pass before a task is considered complete.

## Workspace layout

```
apps/web              static React/Vite application (UI, persistence, 3D)
packages/shared        design schema, SI-unit types, validation
packages/calculations   pure calculations (depends on shared)
packages/geometry       scene-primitive builder (depends on shared, calculations)
```

Keep changes scoped to the task at hand. Do not add dependencies, files, or
abstractions beyond what the current task requires.
