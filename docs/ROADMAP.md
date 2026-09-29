# Development Roadmap

Version: 0.2  
Date: 2026-09-28

## Roadmap principle

Build the simulator from the inside out.

Do not begin with a full arcade, progression, NPC crowds, or a large prize catalogue.

Each phase has an exit gate. Do not proceed merely because code exists; proceed when behavior is convincing and regression-tested.

---

# M00 — Repository & simulation harness

## Goal

Create a minimal development environment capable of running deterministic/repeatable physics test scenes.

## Deliverables

- project bootstrap
- fixed-step physics loop
- basic 3D scene
- debug controls
- physics debug overlay foundation
- test-scene loader
- seeded scene initialization
- CI/lint/test baseline

## Exit criteria

- app launches locally
- fixed physics timestep is independent of render FPS
- one dynamic cube falls and settles reproducibly within tolerance
- a test scene can be selected by ID/URL/debug menu

## Completion record — 2026-09-28

**Status: COMPLETE**

Implemented technical baseline:

- TypeScript 6 + Vite 8
- Three.js WebGL rendering bootstrap
- Rapier 3D via `@dimforge/rapier3d-compat`
- Vitest regression tests
- ESLint flat-config baseline
- GitHub Actions CI on `main` and pull requests
- committed `package-lock.json` for reproducible `npm ci`

Simulation harness:

- physics runs at a fixed 120 Hz (`1 / 120 s`)
- rendering remains variable-rate and independent from physics stepping
- accumulator loop limits catch-up to 8 physics steps per render frame
- frame delta is clamped to 0.25 s and excess backlog is dropped rather than allowing a spiral-of-death
- Rapier integration `dt` is explicitly set to the same fixed timestep
- initial deterministic scene is `?scene=falling-cube`
- optional deterministic seed is selected with `?seed=<value>`
- unknown scene IDs safely fall back to `falling-cube`
- debug overlay reports FPS, physics ticks, simulation time, active scene, seed, dynamic body count, and dropped catch-up time

Verified behavior:

- Rapier initializes in automated tests
- the M00 dynamic cube falls from 3 m and settles/sleeps on the static floor
- seeded RNG repeatability is tested
- fixed-step accumulation/catch-up protection is tested
- scene parsing/fallback is tested
- CI passes `npm ci`, `npm run lint`, `npm run test`, and `npm run build`
- production `dist/index.html` is checked for the required `/Claw-Chaos/assets/` base path
- `npm run preview` is started in CI and the project-subpath page plus generated JavaScript asset are fetched successfully
- a lightweight headless-Chrome smoke test confirms Rapier/WebGL initialization reaches the first rendered frame

Known M00 limitations:

- only the `falling-cube` development scene exists; no claw, prize gameplay, cabinet, economy, NPC, or backend systems were introduced
- render interpolation between physics snapshots is not yet used; the renderer currently displays the latest fixed-tick transform
- the debug overlay is intentionally minimal and does not yet draw colliders, contacts, COM, or joints
- CI browser smoke validates startup/first render but is not a visual pixel-regression test
- GitHub Pages deployment itself is intentionally not enabled in M00; the build, subpath, and preview are verified and ready for the deployment procedure in `docs/DEPLOYMENT.md`

**Exact next milestone:** M01 — Claw Physics Laboratory.

**Recommended first M01 task:** add a deterministic `?scene=claw-lab` laboratory scene containing only the gray test floor, a rigid claw hub, and three independently constrained finger rigid bodies/revolute joints with configurable open/close motor target and torque. Add joint/collider diagnostics, then use the centered-ball experiment as the first prize-contact acceptance case. Do not add prize attachment or cabinet gameplay.

---

# M01 — Claw Physics Laboratory

## Goal

Prove a physically driven 3-prong claw before building a cabinet.

## Scene

Gray room containing:
- claw hub,
- 3 independent fingers,
- floor,
- box,
- ball,
- simple compound teddy.

## Deliverables

- hub rigid body
- 3 hinge/revolute finger joints
- open/close motor target
- configurable close torque
- configurable material friction
- COM visualization
- collision/contact debug view

## Required experiments

1. centered ball grip
2. low-friction ball slip
3. off-center box pinch/rotation
4. teddy limb hook
5. one-finger contact
6. object too large for full close

## Exit criteria

- fingers stop physically when blocked
- prize is never attached to claw
- low-friction prize can visibly slide out
- off-center prize rotates naturally
- hook can succeed through geometry alone
- no major solver explosion/jitter

## Implementation record — 2026-09-28

**Status: IN PROGRESS — first mechanical slice complete**

Implemented:
- `claw-lab` deterministic laboratory scene and M01 default entry
- fixed rigid hub
- three independent dynamic finger bodies
- three Rapier revolute joints with per-joint limits
- fixed-tick open/close command ramp rather than animation snapping
- configurable motor stiffness/damping/max torque and finger material parameters
- `C` close, `O` open, `Space` toggle
- Rapier collider debug lines toggled with `D`
- visible hinge pivot/axis diagnostics
- automated regression for motor command ramp and independent revolute movement

Verified after first mechanical slice:
- 11 tests PASS
- lint PASS
- TypeScript/Vite production build PASS
- GitHub Pages base-path check PASS
- headless Rapier/WebGL startup smoke PASS

### Geometry refinement record — 2026-09-28

Implemented before prize-contact tuning:
- cylindrical claw-head visual proportions instead of a rectangular block
- lower collar/pivot ring
- three-segment finger path with outward sweep and inward hook tip
- one rigid body + three capsule colliders per finger
- render centerline aligned to the same segmented collider path
- centralized provisional geometry and material parameters
- `docs/CLAW_GEOMETRY_BASELINE.md` records dimensions, assumptions and calibration policy
- geometry regression tests for path length, open/closed span and rod profile

The geometry values are provisional engineering approximations from visual references and must not be described as measured manufacturer specifications.

### Open-angle calibration record — 2026-09-28

Visual review showed the default open pose remained too narrow compared with common commercial 3-prong claws.

Changed only:
- open target: +0.22 → +0.35 rad
- approximate open angle: 12.6° → 20.1°
- command-space tip span: about 0.296 → 0.348 m

Unchanged:
- closed target -0.42 rad
- finger path/rod geometry
- friction/density/restitution
- motor speed/stiffness/damping/max torque
- PT-001 ball parameters

Gate: PT-001 must remain PASS after this geometry calibration.

Current verification target is 15 automated tests plus the existing lint/build/base-path/browser smoke suite.

### PT-001 record — 2026-09-28

**Automated status: PASS**

Implemented:
- one centered dynamic sphere with explicit radius/mass/friction/restitution
- one narrow static pedestal
- lab-only kinematic vertical hub motion to test pickup without starting M02
- `P` test cycle: close → settle → lift → hold → PASS/FAIL
- debug reports ball Y, lift delta, lab lift amount and PT-001 phase/result
- collider debug defaults OFF but remains available with `D`
- prize remains dynamic and is never parented, welded or joined to the claw

PT-001 baseline:
- sphere radius: 0.055 m
- mass: 0.080 kg
- friction: 0.90
- lift command: 0.18 m at 0.12 m/s
- automated pass threshold: sphere rises at least 0.08 m

Verification:
- 15 automated tests PASS
- PT-001 physics integration regression PASS
- lint PASS
- TypeScript/Vite production build PASS
- GitHub Pages base-path check PASS
- headless `claw-lab` browser smoke PASS

### PT-002 record — 2026-09-28

**Automated status: PASS**

Implemented:
- explicit `?experiment=pt002` mode while PT-001 remains the default
- same sphere geometry/mass/friction/restitution as PT-001
- same claw geometry and close/pickup torque
- lab force phase changes from 2.5 N·m pickup torque to 0.003 N·m retaining torque after 0.06 m of lift
- debug telemetry reports experiment, phase, peak lift, slip loss, active force phase and active torque
- no hidden release, prize parenting, weld, joint or kinematic prize state

Calibration findings:
- friction-only sweeps did not produce a useful gradual-slip interval with the current centered sphere geometry
- retaining torque applied from the start also produced a sharp no-lift/stable-capture threshold
- a physical pickup→retaining transition produced the intended delayed loss of support
- calibrated run reaches about 0.048 m peak lift and returns near the pedestal
- regression thresholds: peak >= 0.03 m, slip loss >= 0.04 m, final lift <= 0.03 m

Verification target after this slice:
- 18 automated tests PASS
- PT-001 remains PASS
- PT-002 force-phase slip regression PASS
- lint/build/base-path/headless browser smoke PASS

### PT-003 record — 2026-09-29

**Automated status: PASS**

Implemented:
- isolated `?experiment=pt003` scene path
- dynamic rectangular box with explicit dimensions, mass and friction
- geometric-center COM with visible yellow COM marker
- 0.04 m grip-center-to-COM offset
- narrow support centered under COM so passive state remains stable
- box orientation marker for manual visual verification
- rotation derived only from rigid-body quaternion/contact response
- no scripted rotation, parenting, weld, or prize joint

Calibration:
- support 0.024 m wide: unstable, near-180° tumble
- support 0.040 m wide: almost no rotation
- support 0.030 m wide: stable at rest, about 0.122 rad (~7°) peak rotation after claw interaction
- acceptance threshold: >= 0.10 rad while remaining supported

Verification:
- 21 automated tests PASS
- PT-001 PASS
- PT-002 PASS
- PT-003 integration regression PASS
- lint/build/base-path/headless browser smoke PASS

### PT-004 record — 2026-09-29

**Automated status: PASS**

Implemented:
- isolated `?experiment=pt004` scene path
- Tier A compound Teddy: one dynamic rigid body, multiple primitive colliders
- head, torso, upper/forearms, paws and legs all participate in collision
- lying starting pose with physical settling
- right paw/forearm geometry used as the hook target
- visible hook-region and COM/origin markers
- same collider definition shared by scene and regression test
- no hook flag, parenting, weld, prize joint or scripted angular/lift motion

Calibrated baseline:
- mass 0.090 kg
- friction 0.75
- Teddy center offset -0.055 m
- hook target -0.40 rad
- close lead 0.16 s
- peak lift about 0.045 m
- sustained hanging time above 0.035 m: about 0.492 s
- peak rotation about 0.478 rad (~27.4°)
- final state naturally settles back near the support after contact loss

Verification:
- 23 automated tests PASS
- PT-001 PASS
- PT-002 PASS
- PT-003 PASS
- PT-004 integration regression PASS
- lint/build/base-path/headless browser smoke PASS

Not yet complete:
- generic COM visualization tooling
- PT-005 blocked-finger acceptance
- oversized-object close acceptance
- M01 exit criteria as a whole

**Next slice:** PT-005 blocked finger.

---

# M02 — Gantry & Suspended Claw

## Goal

Create the mechanical motion of a real cabinet.

## Deliverables

- X/Z carriage
- speed/acceleration/braking limits
- suspension constraint
- configurable suspension length/damping
- vertical reel control
- lift/return mechanics

## Exit criteria

- claw lags under acceleration
- hard stop produces a readable swing
- no rigid-lock effect under the carriage
- claw returns toward center through damping/gravity
- motion is stable at target fixed timestep

---

# M03 — Swing Techniques

## Goal

Make "甩爪" a real, learnable interaction.

## Deliverables

- preserved horizontal momentum
- lateral swing
- front/back swing
- diagonal swing
- phase-building through reversals
- descent while swinging

## Exit criteria

A tester can intentionally reproduce:
- left/right swing,
- front/back swing,
- diagonal swing,
- larger swing through timed reversal,
- off-axis descent caused by momentum.

No special swing button is used.

---

# M04 — Drop, Early Close, Force Phases

## Goal

Complete the first authentic claw-machine play cycle.

## Deliverables

- machine state machine
- DROP
- DESCENDING
- player-triggered EARLY CLOSE ("收爪")
- automatic floor/travel close
- CLOSE torque phase
- PICKUP torque phase
- RETAINING torque phase
- optional HOLD BOOST
- return
- release

## Exit criteria

- pressing action during descent closes early
- closing takes time and can be physically blocked
- strong close + weak retaining force can produce delayed slip
- hold boost changes force, not attachment
- player can deliberately allow release by withholding boost
- state transitions do not zero prize motion

---

# M05 — Prize Physics Library v1

## Goal

Create reusable prize content.

## Deliverables

At least:
- cube
- box
- tall box
- flat box
- sphere
- ellipsoid
- cylinder/capsule
- pillow
- simple teddy
- simple animal

Plus:
- material profiles
- mass profiles
- COM profiles
- PrizeFactory
- 6–12 colors
- basic pattern/material variants

## Target

50–100+ generated visible variants.

## Exit criteria

- prize creation is data-driven
- same shape can behave differently by material/mass/COM
- no prize-specific grab code
- 10–15 object pile can settle and remain stable

---

# M06 — Cabinet & Chute

## Goal

Move the working simulation into a real cabinet.

## Deliverables

- cabinet frame
- glass collision/rendering
- play-area walls
- chute geometry
- chute sensor
- control panel
- basic cabinet lighting
- machine limits

## Exit criteria

- prizes cannot escape through cabinet
- chute accepts a prize only after physical entry
- prize touching chute lip does not auto-win
- claw cannot travel outside legal play area
- glass remains readable enough for gameplay

---

# M07 — First-Person Player View

## Goal

Make play feel like standing at the cabinet.

## Deliverables

- head look ≥ ±90° yaw
- preferred ±100–110° tuning
- limited vertical look
- small forward/back movement
- small left/right movement
- lean
- control-panel interaction
- front/side visual inspection

## Exit criteria

Player can:
- aim from front,
- move sideways,
- judge depth through side glass,
- look down at controls,
- look at chute,
without free-fly or clipping through cabinet.

---

# M08 — Visual & Audio Realism Pass 1

## Goal

Make the single cabinet believable without overbuilding content.

## Deliverables

- PBR cabinet materials
- controlled glass reflections
- rails/cable/winch detail
- LEDs
- mechanical audio
- prize contact audio
- simple arcade ambience
- optional controller haptics

## Exit criteria

- machine movement has identifiable mechanical sound
- cardboard/plastic/plush contacts differ
- glass reflections do not obscure aiming
- no major visual mismatch between collision and mesh

---

# M09 — Layout Gameplay

## Goal

Expand beyond loose piles.

## Deliverables

- loose pile
- dense pile
- showcase
- bridge
- edge
- ring/loop
- chute-adjacent arrangement
- deterministic layout seed
- physics settle pipeline

## Exit criteria

- bridge can be solved by repeated physical rotation/translation
- ring can be hooked through actual geometry
- layout reset does not force identical final poses unless using a fixed seed

---

# M10 — Staff & Restocking

## Goal

Simulate cabinet maintenance and prize depletion.

## Deliverables

- inventory count
- restock threshold
- CALL STAFF interaction
- staff policy
- service state
- short staff approach/open/reposition/close sequence
- restock placement + physics settle

## Exit criteria

- player cannot arbitrarily request an ideal winning placement
- depleted machine can be restocked
- post-restock pile is physically stable and non-identical across seeds
- machine pauses safely during service

---

# M11 — Second Machine Family

## Preferred order

Add a 2-prong UFO-style machine.

## Deliverables

- 2-prong claw definition
- appropriate finger geometry
- box-focused layouts
- bridge-focused tuning

## Exit criteria

- shares core physics architecture
- does not duplicate entire simulator logic
- feels mechanically distinct from 3-prong machine

---

# M12 — Commercial & Guaranteed-Prize Rulesets

## Goal

Separate pure physics from commercial operation.

## Deliverables

- Pure Simulation ruleset
- Commercial Simulation configuration
- accumulated-spend state
- Taiwan-style guaranteed-prize ruleset data model
- operator-configurable pickup/retaining behavior
- debug disclosure of active parameters

## Exit criteria

- Pure Simulation has fixed physical parameters
- commercial behavior adjusts explicit machine parameters rather than forcing win/lose outcomes
- guaranteed-prize state is separate from hold force

---

# M13 — Arcade Room

## Goal

Build a believable small arcade around proven gameplay.

## Deliverables

- 4–8 machine slots
- neighboring cabinet visuals
- ambient audio field
- staff route
- limited NPC presence
- machine selection/approach

## Exit criteria

- only active/near cabinet receives highest physics fidelity
- neighboring machines do not degrade active-cabinet simulation
- moving between cabinets feels natural

---

# M14 — Public Demo

## Target content

- 1 arcade room
- 3-prong machine
- 2-prong machine or clearly distinct second setup
- 8+ base prize geometries
- 100+ visual variants
- multiple materials/COM profiles
- swing
- early close
- close/pickup/retaining phases
- hold boost where configured
- loose/bridge/ring or edge layouts
- staff call/restock
- challenge mode
- stable save/config version

## Demo acceptance

The build must be fun in gray-box skill terms before content polish is judged.

---

# M15+ — Expansion

Possible directions:
- mini cranes
- premium cranes
- overhead-camera cabinets
- more plush articulation
- additional store themes
- operator mode
- maintenance/calibration gameplay
- analytics
- challenge editor
- Steam build
- WebGPU/desktop rendering upgrade
- VR experimentation
- optional advanced soft-body experiments

---

# Work-order rule for coding agents

Each development pass should:
1. read `docs/PROJECT_CONTEXT.md`,
2. read only the relevant spec sections,
3. implement one coherent milestone slice,
4. add/update regression tests,
5. update roadmap status,
6. avoid unrelated refactors,
7. preserve physics-first constraints.

If a feature is too complex:
- implement the closest stable approximation,
- document the approximation,
- leave an upgrade path,
- do not fake the result with hidden attachment/success logic.

# Cross-cutting gates added after design review

These gates apply across milestones.

## Web delivery gate

Before M00 is considered complete:
- Vite production build must succeed,
- repository-relative asset paths must work under `/Claw-Chaos/`,
- production build must run with `npm run preview`,
- GitHub Pages deployment workflow may be enabled once the app scaffold exists,
- no asset URL may assume deployment at domain root unless intentionally configured.

See `docs/DEPLOYMENT.md`.

## Calibration gate

Before declaring M04/M06 "realistic":
- create at least one reference-machine calibration record,
- record measured or inferred carriage timing,
- record swing period/damping,
- record claw dimensions/open span,
- record descent/lift timing,
- document uncertainty.

See `docs/CALIBRATION_PLAN.md`.

## Replay/debug gate

Before extensive gameplay tuning:
- fixed-tick input recording exists,
- layout seeds are logged,
- active machine force phases are inspectable,
- a physics bug can be reproduced by a test scene or replay/checkpoint.

## Content/legal gate

Before public demo:
- maintain asset manifest,
- verify licenses,
- use generic/original prize art unless specific rights are available,
- avoid manufacturer trade dress/logo copying.

## Current execution order

The immediate order is:

```text
M00 repository + Vite/Web/physics harness
→ M01 claw physics laboratory
→ M02 gantry/suspension
→ M03 swing
→ M04 drop/early-close/force phases
```

Do not start the full arcade environment before these gates pass.
