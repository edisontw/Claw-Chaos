# Claw Chaos — Playable Build Quality Pass

Snapshot date: 2026-10-22 (Asia/Taipei)  
Baseline: `main` at `6ba0e900ec85721fa51aa369a817ca72aaa2b445` (2026-10-09).  
Status: planning/verification document only. **No gameplay or visual changes are claimed by this document.**

## Verified repository baseline

- The default/root experience is the first-person `cabinet-lab` claw machine. The project has progressed beyond the README's old “M06 IN PROGRESS” heading.
- M00–M06: repository, physical claw, gantry, swing, play cycle, prize factory, cabinet/chute foundations completed in prior milestones.
- M07–M09: player controls and front-view camera, mobile input, production grip, showcase and Ring/Bridge/Edge layouts implemented. The M09 roadmap still records deployed **manual Bridge play confirmation** as an outstanding closure gate; do not silently call that manual gate complete.
- M10: staff service/restock milestone **CLOSED** (roadmap records 2026-10-05 automated and deployed manual PASS). CALL STAFF, physical service door, seeded restock, settling, and safe reopening are present.
- Theme A / Modern Japanese Arcade visual uplift and prize/room enhancements were merged (PR #70 and later main changes). The default stocked layout, more detailed box/can/teddy models, full-stock layout, real glass/finger collision fixes and grip improvements are present.
- Graphics quality selector `AUTO/HIGH/MEDIUM/LOW`, adaptive downgrades and ChuteSensor-authoritative win/clear visual/audio feedback are implemented in the roadmap. Treat these as **verification/polish** targets, not unimplemented greenfield work.
- M11 2-prong topology is an **architecture candidate**, not an accepted production-ready second machine. M12 commercial rulesets, M13 full arcade and M14 public demo remain roadmap goals.
- Latest checked `main` CI and GitHub Pages workflow runs on 2026-10-09 completed successfully for the same commit. This is a historical CI observation, **not a new local test run**.
- Open PRs #60, #61 and #62 concern earlier Ring-retention experiments; they are not part of this docs-only quality pass and must not be merged by assumption.

## Quality priorities and acceptance

| Order | Focus | Smallest valuable slice | Acceptance and non-regression |
| --- | --- | --- | --- |
| P0 | Playability baseline | Review latest default/root desktop and mobile portrait/landscape: initial cabinet framing, visible claw/prizes, move/drop/early close, feedback, staff service, and restart. Log concrete reproducible defects before changing mechanics. | Screenshots or reproducible steps; no unverified PASS; record device/browser, seed/layout and active quality profile. |
| P1 | First-minute UX | Add a compact, dismissible, device-appropriate hint for movement, DROP/CLOSE, camera look and CALL STAFF; avoid permanent view obstruction. | New player can find primary controls; hint does not block prize field, input or safe-area on mobile; keyboard/touch smoke. |
| P1 | Responsive interface | Correct control crowding, labels, hit targets, landscape/portrait overlays and visual contrast without shrinking the play field unnecessarily. | Primary button and joystick remain usable in both orientations; no clipped text or horizontal scrolling; screenshots/manual review. |
| P1 | Result clarity | Verify `PRIZE GET!`, `MACHINE CLEARED!`, inventory count and Web Audio unlocking on actual mobile/laptop speakers; refine only if defective. | No false win/clear; exactly one reward per accepted ChuteSensor award; reduced-motion/Low mode remain lightweight. |
| P1 | Staff readability | Inspect approach path, depth/occlusion, photo-cutout edges, cabinet/service door timing and neighboring-machine clearance. | No pop-through, front-camera blockage or implausible emergence; physical service sequence and restock tests unchanged. |
| P2 | Prize/scene fidelity | Improve one prize family or one coherent display group at a time; prioritize original plush/packaged-prize appearance over generic primitives. | Real visual/physical envelope match; preserve colliders, mass, COM and friction unless a separate approved physics slice; no branded third-party asset without rights. |
| P2 | Performance | Capture startup transfer size, frame-time/FPS, draw calls and quality transitions on representative desktop and low-end mobile; optimize the measured bottleneck. | `AUTO` downgrade remains stable; unchanged fixed-tick physics and ChuteSensor behavior; document before/after measurements, not guessed gains. |
| P3 | Replay value | Prototype challenge goals, seeded layouts or alternative machine presentation only after P0/P1 defects are understood. | Config-driven, replayable, no hidden success odds or forced outcomes; new modes do not replace accepted default. |
| Later | Second machine | Resume M11 two-prong geometry, box layouts and distinct physics tuning as a separately reviewed milestone. | Shared gantry architecture, meaningful mechanical difference, complete regression and owner play acceptance. |

## Hourly development handoff

1. Re-read fresh `main` SHA, recent commits, open PRs/issues, CI and Pages status. Do not assume this snapshot remains current.
2. Read relevant sections of `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, `docs/GAME_DESIGN.md` and the actual source/tests. The older roadmap and README contain historical milestone text, not necessarily current priorities.
3. Choose **one** bounded P0/P1/P2 slice. Reuse an appropriate open PR if it exists; otherwise use a dedicated branch and **Draft PR**. Avoid modifying unrelated Ring experiment PRs.
4. Make the change, add focused regression coverage, run available `npm test`, `npm run lint`, `npm run build`, browser smoke, and inspect PR CI. Report any gate not run as **NOT RUN**, never PASS.
5. Do not merge `main`, publish releases, modify secrets or assert GitHub Pages deployment from a draft PR. Hold subjective visuals and major physics changes for owner review.
6. Report: start/end `main` SHA, actual changed files/commit/PR, tests and CI, deployment status, any owner-manual gate, and one concrete next slice. Continue from the latest PR on the next hourly run rather than recreating work.

### Non-negotiable simulation contract

Physics-first Rapier contact remains authoritative: no hidden win roll, magnetic grab, parenting/weld, scripted carry, prize teleport during play, fake finger close, or disabled glass collisions. `ChuteSensor` alone awards wins. Protect the accepted M01–M10 behavior, M09 Ring/Bridge, safe staff service/restock, mobile input and 120 Hz fixed-step loop. Visual/performance changes must not silently change claw or prize physics.

## Immediate next slice

**First-minute UX inspection and low-risk onboarding hint**, starting with a desktop/mobile UI audit of the actual current controls. Only implement a hint after confirming the existing app has no equivalent instruction already; if the instruction exists, fix the highest-impact observed responsive defect instead. Capture screenshot/manual gates separately from automated test results.
