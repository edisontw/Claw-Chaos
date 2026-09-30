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

**Phase status: CLOSED — 2026-09-29**

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
- COM visualization — COMPLETE via reusable Rapier mass-properties debug renderer
- collision/contact debug view — COMPLETE

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

### PT-005 record — 2026-09-29

**Automated status: PASS**

Implemented:
- isolated `?experiment=pt005` scene path
- one static rigid cuboid blocker on finger 0 (+X side)
- same motor command and motor-force parameters applied to all three independent joints
- angular travel measured from each finger rigid body's open-pose quaternion
- debug telemetry shows all three actual finger travels
- no per-finger target override, teleport, collision bypass or forced shared final angle

Calibrated baseline:
- blocked finger travel about 0.000 rad
- free finger travels about 0.314 / 0.314 rad
- acceptance: free >= 0.25 rad, blocked <= 0.22 rad, free-minus-blocked >= 0.06 rad

Verification:
- 25 automated tests PASS
- PT-001 PASS
- PT-002 PASS
- PT-003 PASS
- PT-004 PASS
- PT-005 integration regression PASS
- lint/build/base-path/headless browser smoke PASS

### M01-E06 oversized-object close record — 2026-09-29

**Automated status: PASS**

Implemented:
- isolated `?experiment=oversized` scene path
- centered dynamic oversized box with explicit size, mass, friction and restitution
- matched control-vs-prize integration regression
- open-pose equivalence gate so the prize may block closing but must not invalidate the initial open state
- close-travel comparison based on actual rigid-body quaternions
- no angle clamp, transform override, kinematic prize state, attachment or collision bypass

Calibrated baseline:
- prize size 0.14 × 0.08 × 0.14 m
- mass 1.20 kg
- friction 0.90
- control open travel about 0.083 / 0.083 / 0.083 rad
- oversized open travel about 0.070 / 0.070 / 0.070 rad
- control close travel about 0.241 / 0.240 / 0.240 rad
- oversized close travel about 0.052 / 0.001 / 0.001 rad
- prize X/Z drift remains below 0.1 mm in the calibrated run

Verification:
- 26 automated tests PASS
- all six required M01 physics experiments PASS
- lint/build/base-path/headless browser smoke PASS

M01 required experiments:
1. centered ball grip — PASS
2. low-friction/retaining-force slip — PASS
3. off-center box rotation — PASS
4. Teddy limb hook — PASS
5. one-finger contact — PASS
6. object too large for full close — PASS

### M01 final closure record — 2026-09-29

**Status: CLOSED**

Generic COM/origin debug:
- shared renderer under `src/debug/`
- `M` toggles mass-properties visualization
- actual Rapier `worldCom()` is shown in yellow
- rigid-body origin is shown by a magenta wireframe marker
- a connector appears when origin and COM differ
- `localCom()` / `worldCom()` are read only; debug rendering does not modify physics
- ball, PT-003 box, compound Teddy and oversized prize register through the same scene-level debug-target contract
- prize-specific PT-003/PT-004 COM marker code removed

Exit-criteria audit:
- fingers stop physically when blocked — PASS (PT-005)
- prize is never attached to claw — PASS (PT-001/002/003/004/oversized invariants)
- weak-retaining/low-support prize can visibly slip out — PASS (PT-002)
- off-center prize rotates naturally — PASS (PT-003)
- hook can succeed through geometry alone — PASS (PT-004)
- oversized object prevents full close through collision — PASS (M01-E06)
- no major solver explosion/jitter — PASS; contact-heavy oversized regression now checks finite/bounded rigid-body state throughout the run
- reusable COM visualization exists — PASS
- contact/collider debug remains available — PASS

Final verification:
- 29 automated tests PASS
- lint PASS
- build PASS
- GitHub Pages base-path PASS
- headless browser smoke PASS
- GitHub Pages deploy PASS after squash merge

**Documented next phase: M02 — Gantry & Suspended Claw.**

---

# M02 — Gantry & Suspended Claw

**Phase status: CLOSED — verified 2026-09-30**

## Goal

Create the mechanical motion of a real cabinet.

## Deliverables

- X/Z carriage
- speed/acceleration/braking limits
- suspension constraint — PASS
- configurable suspension length/damping — PASS for current reel-anchor model
- vertical reel control — PASS
- lift/return mechanics — PASS

## Exit criteria

- claw lags under acceleration — PASS in PT-006 slice
- hard stop produces a readable swing — PASS in PT-006 slice
- no rigid-lock effect under the carriage — PASS in PT-006 slice
- claw returns toward center through damping/gravity — PASS through PT-006 residual-offset gate
- motion is stable at target fixed timestep — PASS through PT-006 and PT-008

### Slice 1 implementation record — 2026-09-30

Implemented:
- fixed-step two-axis X/Z gantry controller
- max speed 0.45 m/s
- acceleration 1.35 m/s²
- braking 3.5 m/s²
- X rails ±0.30 m; Z rails ±0.24 m
- kinematic carriage + dynamic claw hub
- fixed 0.31 m spherical-joint suspension
- stiff/damped horizontal suspension: 55 N/m spring, 8.5 N·s/m damping, 4 N corrective-force clamp
- angular damping 3.0 and linear damping 0.12
- closed M01 finger bodies/joints reused on suspended hub
- default `gantry-lab` scene with Arrow-key controls
- automated `P` PT-006 sequence
- current-phase headless browser smoke now targets `gantry-lab`

PT-006 regression:
- lag ≈ 0.0035 m
- post-brake forward swing ≈ 0.011 m
- peak swing ≈ 0.036 rad
- suspension distance remains ≈ 0.310 m
- finite/bounded at 120 Hz

Verification after the stiff-suspension refinement: **36 tests PASS**, lint/build/base-path/headless smoke PASS.

### Slice 2 implementation record — 2026-09-30

Implemented:
- collider-free kinematic reel anchor
- payout range 0.00–0.28 m
- reel max speed 0.28 m/s
- reel acceleration 0.9 m/s²
- reel braking 1.4 m/s²
- limit-aware deceleration before reel endpoints
- manual `Space` DROP/LIFT
- automated `T` PT-008 sequence
- dynamic claw remains on the Rapier spherical suspension while reel anchor moves vertically
- horizontal momentum is never explicitly zeroed during descent
- full bottom-to-top physical lift regression

PT-008 regression:
- descent ≈ 0.2802 m
- max horizontal offset while descending ≈ 0.0102 m
- DROP-start horizontal speed ≈ 0.00581 m/s
- first DROP-tick horizontal speed ≈ 0.01195 m/s
- bottom payout = 0.280 m
- lift back to top ≈ 0.2800 m
- final suspension distance ≈ 0.3100 m
- finite/bounded at 120 Hz

### Open-finger transport rigidity refinement — 2026-09-30

The M01 finger motors are intentionally compliant enough for physical contact to stop one finger. Reusing that same profile while the claw was simply moving made all three open fingers look too soft.

M02 transport-only profile:
- stiffness 2400
- damping 160
- max torque 20.0 N·m
- finger angular damping 8.0
- M01 contact profile is unchanged

Measured peak relative finger flex during gantry acceleration + hard braking:
- finger 1 ≈ 0.0348 rad (~1.99°)
- finger 2 ≈ 0.0189 rad (~1.08°)
- finger 3 ≈ 0.0191 rad (~1.10°)
- acceptance ceiling = 0.035 rad per finger

PT-006 and PT-008 regressions remain unchanged.

Verification: **41 tests PASS**, lint/build/base-path/headless smoke PASS.

### Slice 3 implementation record — 2026-09-30

Implemented:
- reel-top completion gate before return
- `RETURNING_HOME` state
- braking-aware fixed-step X/Z target return controller
- provisional home X=0 / Z=0
- 3 mm position and 0.02 m/s velocity completion tolerances
- automatic home return after manual LIFT reaches the top
- `H` manual home-return trigger when reel is already at top
- conflicting DROP/test controls locked during automatic return
- residual dynamic hub/suspension motion preserved throughout return

Closure regression:
- start distance from home ≈ 0.3167 m
- physical return distance ≈ 0.3677 m
- return-start residual hub offset ≈ 0.00333 m
- max hub/carriage relative offset during return ≈ 0.01074 m
- max diagonal carriage step ≈ 0.00530 m at 120 Hz
- return duration = 125 ticks (~1.04 s)
- final home error ≈ 0.00176 m
- final X/Z velocity ≈ 0.0065 / 0.0139 m/s
- reel payout remains 0
- suspension distance remains ≈ 0.3100 m
- finite/bounded PASS

### M02 closure audit

- X/Z carriage and rail limits — PASS
- acceleration/braking limits — PASS
- suspended dynamic claw without rigid lock — PASS
- small hard-stop swing and damping return — PASS
- OPEN finger transport rigidity — PASS
- vertical reel DROP/LIFT — PASS
- horizontal momentum during descent — PASS
- reel limit stability — PASS
- lift-completion state — PASS
- physical carriage return/home — PASS
- residual swing preserved during return — PASS
- 120 Hz numerical stability — PASS

Final verification: **43 tests PASS**, lint/build/base-path/headless smoke PASS.

PT-007 swing amplification belongs to M03 and is intentionally not required to close M02. Full carried-prize return/release/chute lifecycle is also deferred to the later gameplay/cabinet phases that introduce those systems.

**Next phase:** M03 — Swing Techniques.

---

# M03 — Swing Techniques

**Status: CLOSED — 2026-10-01**

## Goal

Make "甩爪" a real, learnable interaction.

## Deliverables

- preserved horizontal momentum
- lateral swing
- front/back swing
- diagonal swing
- phase-building through reversals
- descent while swinging

## Slice 1 — PT-007 lateral swing amplification

Implemented and verified:
- repeated X-axis carriage reversals only; no swing button
- all swing energy enters through the same fixed-step gantry acceleration/braking path used by M02
- suspension recalibrated to 170 N/m horizontal stiffness, 1.0 N·s/m damping, 4 N corrective-force clamp
- OPEN/transport finger hold strengthened independently to stiffness 6000, damping 340, max torque 50 so the claw fingers remain mechanically rigid while the suspension is more responsive
- PT-006 hard-brake gate remains PASS under the new calibration
- PT-008 DROP/LIFT momentum gate remains PASS
- M02 physical home-return regression remains PASS

PT-007 measured timing response:
- 0.30 s half-period: 11.86 mm early peak → 8.41 mm late peak (off-cadence decay)
- 0.38 s half-period: 20.02 mm → 20.40 mm
- 0.40 s half-period: 20.86 mm → 24.17 mm (**+15.9% amplification**)
- 0.42 s half-period: 20.32 mm → 22.53 mm
- 0.46 s half-period: 15.99 mm → 15.28 mm (off-cadence decay)
- 0.40 s peak angle: about 0.078 rad (~4.5°)
- finite/bounded stability PASS at 120 Hz

This establishes a learnable timing window: correct reversal timing builds swing while clearly wrong cadence loses amplitude.

## Exit criteria

## Slice 2 — front/back + diagonal swing reproduction

Implemented and verified:
- Z-axis front/back pumping uses the same normal gantry acceleration/braking path as PT-007
- synchronized X/Z reversals generate diagonal swing through the same suspension model
- no production physics constants or M01 grasp/contact semantics changed
- no hidden swing force, angle/velocity injection, scripted oscillation, or transform parenting

Measured response:
- Z 0.40 s: 20.86 mm early peak → 24.17 mm late peak (+15.9%)
- Z off-cadence 0.30 s: 11.86 mm → 8.41 mm (decays)
- diagonal 0.40 s: late X/Z peaks ≈ 24.08 / 24.08 mm
- diagonal late resultant ≈ 34.05 mm; peak angle ≈ 0.110 rad (~6.3°)
- maximum suspension-length error ≈ 0.003 mm
- finite/bounded stability PASS at 120 Hz
- full suite after this slice: **46 automated tests PASS**

## Slice 3 — amplified swing through physical descent

Implemented and verified:
- builds the existing synchronized X/Z 0.40 s swing without changing calibration
- DROP is triggered only after the physical swing has both meaningful offset and relative horizontal velocity
- direction input is released; carriage braking and reel payout continue through the normal fixed-step controllers
- horizontal state is never cleared when descent starts
- no direct angle/velocity write, hidden swing force, transform parenting, or descent-time reset

Measured response:
- pre-DROP resultant peak ≈ 34.05 mm
- DROP start resultant offset ≈ 13.94 mm
- DROP start relative horizontal speed ≈ 0.191 m/s
- first DROP tick world horizontal-speed retention ratio ≈ 1.11
- descent ≈ 0.28029 m over 146 ticks
- max descent X/Z offsets ≈ 21.55 / 21.55 mm
- max descent resultant ≈ 30.47 mm
- horizontal hub travel during descent ≈ 61.69 mm
- maximum suspension-length error ≈ 0.003 mm
- finite/bounded stability PASS
- full suite after this slice: **47 automated tests PASS**

## Exit criteria

Final status:
- preserved horizontal momentum — **PASS**
- left/right swing — **PASS**
- larger swing through timed reversal — **PASS (PT-007)**
- front/back swing — **PASS**
- diagonal swing — **PASS**
- off-axis descent caused by deliberately built momentum — **PASS**
- no special swing button — **PASS**

**M03 CLOSED. Next phase:** M04 — Drop, Early Close, Force Phases.

---

# M04 — Drop, Early Close, Force Phases

**Status: IN PROGRESS — slice 1 verified 2026-10-01**

## Goal

Complete the first authentic claw-machine play cycle.

## Deliverables

- machine state machine — IN PROGRESS
- DROP — PASS
- DESCENDING — PASS
- player-triggered EARLY CLOSE ("收爪") — PASS
- automatic floor/travel close — PASS for configured travel threshold
- CLOSE torque phase — PASS with M01 contact profile
- PICKUP torque phase — PASS
- RETAINING torque phase — PASS with physical delayed-slip regression
- optional HOLD BOOST — pending
- return — pending M04 lifecycle integration
- release — pending

## Slice 1 — DROP / EARLY CLOSE / AUTO CLOSE

Implemented:
- READY → DESCENDING → CLOSING → CLOSED_AT_DEPTH state path
- first action starts physical reel descent
- second action during descent selects EARLY close reason
- no second action selects AUTO close at 0.275 m payout
- closing is not instantaneous: command remains limited to 1.6 rad/s at 120 Hz
- M01 contact motor parameters are reused unchanged for CLOSING
- M02 hard OPEN/transport motor remains limited to aiming/transport state
- no transform snap, finger teleport, hidden close force, or reel teleport

Measured:
- early action payout ≈ 0.10227 m
- early close duration = 58 ticks ≈ 0.4833 s
- payout at early close completion ≈ 0.23760 m
- auto-close transition payout ≈ 0.27562 m
- final auto path payout = 0.280 m
- full suite = **49 automated tests PASS**

## Slice 2 — settle / physical LIFT / PICKUP / RETAINING

Implemented:
- CLOSED_AT_DEPTH settles for 0.90 s before lift command begins
- measured discrete settle duration: 109 ticks ≈ 0.908 s
- reel reverses through the existing acceleration/braking controller; no vertical transform snap
- PICKUP is an explicit force phase
- after ≈ 0.06027 m reel recovery, state changes to RETAINING
- measured PICKUP duration: 44 ticks ≈ 0.367 s
- CLOSE/PICKUP use the existing 2.5 N·m M01 contact torque
- RETAINING uses the calibrated 0.003 N·m weak torque
- reel continues physically to payout 0

Suspended-claw prize regression:
- peak sphere lift ≈ 43.65 mm
- lift at RETAINING start ≈ 21.56 mm
- weak-retaining slip loss ≈ 44.45 mm
- final sphere height ≈ 0.80 mm below its support baseline
- final payout = 0.000 m
- max suspension error ≈ 0.056 mm
- finite/bounded PASS
- no attachment, scripted prize release, teleport, or velocity clearing
- full suite: **51 tests PASS**

## Exit criteria

Current status:
- pressing action during descent closes early — **PASS**
- closing takes time — **PASS**
- closing can be physically blocked — preserved from M01; dedicated broader M04 object-contact matrix remains later
- strong close + weak retaining force can produce delayed slip — **PASS**
- hold boost changes force, not attachment — pending slice 3
- player can deliberately allow release by withholding boost — pending
- state transitions do not zero prize motion — pending carried-prize lifecycle validation

**Next slice:** HOLD BOOST as a temporary physical torque increase, followed by top-completion → return → release lifecycle integration.
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
