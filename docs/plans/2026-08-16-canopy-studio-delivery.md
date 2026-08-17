# Canopy Studio Delivery Plan

> **For Hermes:** Execute task-by-task with delegated implementation, specification review, quality review, and independent browser/build verification.

**Goal:** Deliver a working local-first web application for drawing an attached freeform timber pergola, visualizing it in synchronized plan/3D views, generating fan/saddle member fields, and producing traceable BOM/cut/blueprint output with safely scoped component analysis.

**Architecture:** One canonical versioned design document drives all derived outputs. React/Three.js is the interactive renderer only. Analytic geometry owns planes, member frames, lengths, intersections, and planar cuts. Complex solid booleans are isolated behind an asynchronous kernel interface and are not required for the first release. Structural load generation, mechanics, and design checks are separate modules and fail closed outside validated scope.

**Tech Stack:** Node 24 LTS, npm workspaces, React, TypeScript strict, Vite, React Three Fiber/Three.js, Zod, Dexie/IndexedDB, Vitest, React Testing Library, Playwright, SVG/print output.

## Non-negotiable invariants

1. Canonical length unit is millimetres; angles are radians internally. Units are explicit at boundaries.
2. The canonical document contains semantic objects and stable IDs, never Three.js meshes, triangle indices, WASM handles, or display coordinates.
3. 2D and 3D consume the same document revision and object IDs.
4. Every user edit is an explicit command supporting undo/redo.
5. Derived geometry, BOM, cuts, and reports never mutate authoring geometry.
6. Every physical member appears exactly once in member/BOM output.
7. Unsupported or incomplete geometry blocks final export; nothing is silently omitted.
8. Structural calculations consume a frozen immutable snapshot and never modify geometry.
9. No single global `safe` flag. Track geometry, load, analysis, member, connection, foundation/attachment, permit, and professional-review status separately.
10. Do not copy copyrighted CSA standards tables/equations into the open-source bundle without appropriate rights.
11. The actual attached irregular saddle structure remains engineer-review-required even when component screening passes.
12. No backend, login, telemetry, cloud SDK, AWS dependency, or deployment infrastructure.

## Canonical model

```text
ProjectDocument
  schemaVersion
  revision
  metadata
  displayUnits
  site
    houseOutlines[]
    roofPlanes[]
    gutters[]
    patioOutlines[]
  anchors[]
  sections[]
  materials[]
  posts[]
  members[]
  fanFields[]
  joints[]
  analysisInputs
  reportSettings
```

Key semantic types:

```text
Anchor: id, kind, positionMm, source reference
Member: id, role, startAnchorId, endAnchorId, sectionId, materialId, rollRad, features[]
Feature: PlaneTrim | EndCut | Notch | Bore | CustomCutter
FanField: id, sourceAnchorId, target, count/spacing, elevation rule, member template
Joint: id, connectedMemberIds, crossing behavior, geometric parameters, engineering status
RoofPlane: pointMm, normal, bounded outline, pitch metadata
```

## Milestone 0 — Executable UX contract

**Artifact:** Navigable Studio shell with bundled immutable sample project.

Scope:
- Toolbar: Select, House, Post, Beam, Fan, Joint.
- Plan / Split / 3D views.
- Toolbar, inspector, status/help region, BOM/Cuts/Blueprints drawer.
- Render one sample attached freeform canopy in both projections.
- Selecting an object in either view highlights the same ID everywhere.
- Interaction states: idle, selecting, drawing, placing, dragging, invalid.
- Visible preliminary-planning/engineer-review disclaimer.
- No authoring or calculations.

Acceptance:
- `npm run typecheck`, `npm test`, `npm run build` pass.
- Playwright opens the production build, switches views, and selects the same sample member in plan and 3D.
- Escape returns to Select mode.
- Production build has no runtime network dependency.

## Milestone 1 — House and roof context

**Artifact:** Local project with editable house outline and roof plane.

Scope:
- Create/new/open project.
- Draw and edit house outline in plan.
- Enter eave/reference elevation, roof pitch/direction, and gutter geometry.
- Simple 3D wall/roof representation.
- Undo/redo, autosave, JSON import/export.
- Reject invalid/self-intersecting/zero-area outlines.

Acceptance:
- Moving a vertex updates plan and 3D from one revision.
- Export/import is semantically lossless.
- Reload restores the project.
- 2.69 m reference can be represented exactly as 2690 mm.

## Milestone 2 — Posts and anchor-connected beams

**Artifact:** User can place supports and draw the primary frame.

Scope:
- Place/edit/move/delete posts with section and height.
- Stable top/base anchors.
- House attachment anchors.
- Beam flow: choose start anchor, preview, choose end anchor, commit.
- Beam section/orientation editing.
- Reference-aware movement and deliberate deletion policy.

Acceptance:
- One click creates one post at previewed location.
- A beam references anchors rather than copied coordinates.
- Moving either endpoint updates the same member in both views.
- A user can make an irregular perimeter without manual JSON.

## Milestone 3 — Fan fields and saddle geometry

**Artifact:** Two editable fan fields can form a freeform saddle lattice.

Scope:
- Source anchor plus target edge/beam/region.
- Count or spacing rule, direction, elevation rule, member template.
- Full preview before commit.
- Parent intent object with deterministic derived members.
- Two overlapping fields with stable derived identities.
- Reversed/inverted/zero-length/degenerate cases fail recoverably.

Acceptance:
- Editing source/target regenerates members deterministically.
- Undo treats field creation/regeneration as one action.
- Save/import reproduces geometry within tolerance.

## Milestone 4 — Intersections and joints

**Artifact:** Every meaningful connection/crossing is explicit and inspectable.

Scope:
- Intersection candidate detection.
- Crossing behavior: A above B, B above A, structural joint, half-lap intent, no contact, unresolved.
- Joint-focused 3D inspection.
- Adjacency/topology validation.
- Detect orphans, duplicates, overlaps, and near-zero members.

Acceptance:
- Every connected endpoint resolves to anchor/joint.
- Selecting joint highlights connected members.
- Geometry changes regenerate or invalidate joints deliberately.

### Geometry UX proof gate

Do not begin structural logic until Milestones 0–4 pass automated journeys and user usability review. Packages may expose empty interfaces only.

## Milestone 5 — Geometric BOM and planar cuts

**Artifact:** Traceable procurement and initial fabrication package.

Scope:
- Member schedule grouped by section/material/finished length.
- Every line traces to stable model IDs.
- Stock allowance is explicit and separate from exact geometry.
- CSV export and printable BOM.
- Analytic member-local frames.
- Square, miter, bevel, compound miter/bevel, and plane trims.
- Roof-plane end cuts with long/short points and sign conventions.
- Per-member cut card and SVG detail.

Acceptance:
- No member omitted or duplicated.
- Rigid translation/rotation does not change physical lengths/cut angles.
- Reversing endpoints swaps end labels while preserving physical geometry.
- Physical/reference cut fixtures match generated dimensions.

## Milestone 6 — Blueprints

**Artifact:** Deterministic printable plan/elevation/detail package.

Scope:
- Plan, elevations, sections, member marks, joint callouts.
- Dimensions sourced only from model semantics/analytic measurements.
- Sheet preview and browser print/PDF.
- Revision metadata and unresolved-item schedule.

Acceptance:
- Every callout resolves to a live object.
- No critical content is clipped.
- Reopening/regenerating produces deterministic sheets.

## Milestone 7 — Safely scoped component analysis

**Artifact:** Transparent component screening, not autonomous structural approval.

Layers:
1. Load inputs/provenance and load-generation interface.
2. Closed-form calculators for explicitly supported cases only.
3. Component design/check interface with versioned jurisdiction/provider metadata.

Initial supported checks:
- Simply supported or cantilever member under explicit uniform/point loads.
- Basic reactions/bearing demand.
- Deflection envelope.
- Post axial load plus prescribed moment and unbraced length.
- Connection demand reporting (shear/uplift/axial/moment), not connector approval.
- Preliminary footing bearing/uplift using user-supplied capacities.

Must refuse:
- Global saddle/gridshell stability.
- Arbitrary skew/non-coplanar load sharing.
- Unknown/semi-rigid/eccentric joints.
- Moment frames, unknown ledger stiffness, snow drift, complex wind, uplift redistribution, and unsupported notches/connectors.

Output states:
- Calculated within stated assumptions.
- Input requires verification.
- Check not implemented.
- Outside validated scope.
- Engineer review required.

Acceptance:
- Every calculator has a failing test first, closed-form benchmarks, equilibrium checks, unit invariance, and adversarial unsupported cases.
- No result uses `safe`, `approved`, `certified`, or `permit ready`.

## Later kernel boundary

Day one:
- Three.js renderer.
- Analytic geometry and oriented boxes.
- `three-mesh-bvh` only when scene scale warrants it.

Later complex solids:
- `Manifold` WASM in a dedicated worker as the single production Boolean finalizer.
- Lazy load; deterministic feature order; return typed mesh packets and validation metadata.
- Explicit WASM lifecycle/disposal and worker memory soak tests.

Only if proven necessary:
- RepliCAD/OpenCascade for STEP exchange, analytic B-rep, curved machining, robust hidden-line removal, or CAD interoperability.

## Test fixtures

Maintain versioned golden projects:
- empty-project
- simple-house-roof
- two-post-one-beam
- irregular-perimeter
- dual-fan-saddle
- compound-roof-cut
- intentionally-invalid-topology
- attached-edmonton-concept

Test layers:
- Domain command RED/GREEN tests.
- Geometry contract/invariance/property tests.
- React interaction/accessibility tests.
- Playwright end-to-end journeys using stable canvas-to-world helpers.
- Fixed visual baselines for high-value states.
- Persistence/migration/golden JSON tests.
- Physical cut verification before fabrication claims.

## Delivery workflow

For each milestone:
1. TARS freezes exact scope and acceptance criteria.
2. Claude Code implements in an isolated branch/worktree using TDD.
3. Separate specification review.
4. Separate quality/security review.
5. TARS independently runs tests, production build, and browser workflow.
6. User reviews the working artifact at UX gates.
7. Commit/push only after gates pass.
