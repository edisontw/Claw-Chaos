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

**Status: CLOSED — 2026-10-01**

## Goal

Complete the first authentic claw-machine play cycle.

## Deliverables

- machine state machine — PASS
- DROP — PASS
- DESCENDING — PASS
- player-triggered EARLY CLOSE ("收爪") — PASS
- automatic floor/travel close — PASS for configured travel threshold
- CLOSE torque phase — PASS with M01 contact profile
- PICKUP torque phase — PASS
- RETAINING torque phase — PASS with physical delayed-slip regression
- optional HOLD BOOST — PASS
- physical top-completion → return — PASS for the pre-cabinet home target
- motor-driven release → READY — PASS

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

## Slice 3 — HOLD BOOST / RETURN / RELEASE

Implemented:
- hold `Shift` requests HOLD BOOST only during RETAINING/RETURNING
- base RETAINING torque remains 0.003 N·m
- calibrated BOOST torque = 0.010 N·m
- BOOST budget = 0.80 s maximum actual use per play cycle
- BOOST changes only the motor torque; it never attaches or parents the prize
- reel-top detection enters RETURNING
- RETURNING uses the existing braking-aware physical gantry controller
- home position/velocity tolerance enters RELEASING
- RELEASING opens through the normal 1.6 rad/s motor command
- READY is unavailable until release physically completes

Measured HOLD BOOST response:
- no BOOST at RETAINING +0.4 s: sphere lift ≈ -0.064 mm
- BOOST at the same instant: sphere lift ≈ 19.26 mm
- after the 0.80 s BOOST budget expires: lift ≈ -2.07 mm and the prize continues to fall physically
- PICKUP → RETAINING speed continuity: ≈ 0.1982 → 0.1944 m/s
- no state transition zeroes prize motion

Measured return/release lifecycle:
- reel-top → RETURNING at tick 63
- home/release point reached at tick 149
- home error ≈ 1.834 mm
- release opening = 58 ticks ≈ 0.483 s
- READY at tick 206
- final reel payout = 0.000 m
- full suite: **54 tests PASS**

Scope note:
- full carried-prize RETURN to a modeled chute, chute-edge interaction, and chute sensing remain later prize/cabinet acceptance work; M04 closes the mechanical play-cycle substrate.

## Exit criteria

Current status:
- pressing action during descent closes early — **PASS**
- closing takes time — **PASS**
- closing can be physically blocked — **PASS via preserved M01 contact/blocking baseline**
- strong close + weak retaining force can produce delayed slip — **PASS**
- hold boost changes force, not attachment — **PASS**
- player can deliberately allow release by withholding boost — **PASS**
- state transitions do not zero prize motion — **PASS**

**M04 CLOSED. Next phase:** M05 — Prize Physics Library v1.
---

# M05 — Prize Physics Library v1

**Status: CLOSED — 2026-10-01**

## Goal

Create reusable prize content.

## Deliverables

Implemented:
- cube — PASS
- box — PASS
- tall box — PASS
- flat box — PASS
- sphere — PASS
- ellipsoid — PASS with stable three-sphere collision approximation
- cylinder — PASS
- capsule — PASS
- pillow — PASS with rounded compound profile
- simple Teddy — PASS with compound sphere/capsule profile
- simple animal — PASS with compound sphere/capsule profile
- material profiles — PASS, 5 starter profiles
- mass profiles — PASS, light / standard / heavy
- COM profiles — PASS, 5 starter profiles
- PrizeFactory — PASS
- 8 colors — PASS
- matte / gloss finish variants — PASS
- deterministic variant enumeration — PASS

## Final closure record

PrizeFactory:
- 11 data-driven prize definitions
- no prize-specific grab/success code
- explicit Rapier total mass / local COM / principal inertia
- zero-density collision primitives prevent collider topology from silently changing authored mass
- primitive and compound colliders share the same spawn path
- isolated `?scene=prize-lab` remains available for visual/collider/COM inspection

Content target:
- 11 definitions × 8 colors × 2 finishes = **176 unique valid visible variants**
- explicit enumeration/uniqueness regression PASS

Behavioral differentiation:
- PT-021 material friction:
  - plastic box travel ≈ 124.20 mm
  - rubber box travel ≈ 92.23 mm
  - measurable separation ≈ 31.97 mm
- mass profile:
  - light 0.090 kg + same impulse → ≈ 0.3333 m/s
  - heavy 0.162 kg + same impulse → ≈ 0.1852 m/s
- PT-022 COM:
  - centered COM under center impulse → 0 rad rotation
  - left-offset COM X ≈ -18.90 mm
  - same impulse → ≈ 0.40385 rad rotation
  - peak angular speed ≈ 1.6154 rad/s

PT-015 pile stability:
- 12 PrizeFactory bodies
- reaches all-sleep state in ≈ 2.3167 s
- remains simulated for another 60 s
- maximum post-settle drift = 0
- maximum post-settle speed = 0
- final sleeping = 12/12
- finite/bounded PASS

## Exit criteria

- prize creation is data-driven — **PASS**
- same shape can behave differently by material — **PASS**
- same shape can behave differently by mass — **PASS**
- same shape can behave differently by COM — **PASS**
- no prize-specific grab code — **PASS**
- 10–15 object pile can settle and remain stable — **PASS**
- 50–100+ generated visible variants — **PASS, 176**

Final verification:
- **62 automated tests PASS**
- lint/build/base-path/browser smoke PASS

**M05 CLOSED. Next phase:** M06 — Cabinet & Chute.

---

# M06 — Cabinet & Chute

**Status: CLOSED — final closure verified 2026-10-02**

## Goal

Move the working simulation into a real cabinet.

## Delivered

- physical gray-box cabinet frame, raised play deck, walls, ceiling and transparent front/side glass — PASS
- real chute opening/channel/catch geometry — PASS
- collider-free one-shot chute sensor — PASS
- gray-box control panel and cabinet lighting — PASS
- closed M02–M04 gantry/claw/play-cycle integrated into `cabinet-lab` — PASS
- normal play RETURN target over physical chute while legacy M02 home remains unchanged — PASS
- physically carried prize RETURN → motor RELEASE → chute sensor — PASS
- explicit result/inventory handoff with duplicate-delivery idempotence — PASS
- cabinet/glass gray-box readability gate — PASS
- closed M01–M05 force/suspension/reel/torque/BOOST calibration preserved — PASS

## Final physical baseline

- cabinet interior X ±0.46 m / Z ±0.36 m
- play-area height = 1.30 m
- raised play deck Y = 0.265 m
- chute opening = 0.18 × 0.15 m at X/Z = 0.28 / 0.20 m
- sensor remains a pure observation volume over prize world COM; no collider, impulse, attraction or support
- PT-017 partial-lip prize remains a no-win
- PT-018 physical chute entry remains exactly one sensor event
- successful carried-prize fixture:
  - PICKUP → RETAINING tick 46
  - RETURNING tick 56
  - RELEASING tick 117
  - chute sensor tick 149
  - READY tick 174
  - horizontal prize travel during RETURN ≈ 83.35 mm
  - hub/carriage lag peak ≈ 16.21 mm
  - maximum prize fixed-tick displacement ≈ 18.33 mm
  - HOLD BOOST use ≈ 0.592 s / 0.800 s budget
  - final prize Y ≈ -0.24801 m
- legitimate longer-carry slip failures remain possible under the same fixed physical model

## Result/inventory closure

- `CabinetResultInventoryState` consumes `ChuteWinEvent`
- the same event delivered twice is accepted once
- the same physical prize re-delivered under a different sequence is still not awarded twice
- production `cabinet-lab` exposes sensor count, result count, inventory count and last result prize
- result state does not modify prize transforms, velocities, forces or sensor geometry

## Glass/readability audit

- glass collision remains the same physical cabinet boundary
- render pane opacity = 0.10 to reduce aiming obstruction
- visible glass edge outlines keep panel boundaries readable
- no camera/FOV workaround was introduced
- first-person side inspection, yaw/pitch limits and anti-clipping are deliberately M07 scope

## Exit audit

- cabinet geometry and machine limits — PASS
- play deck and chute geometry — PASS
- chute edge no-win — PASS
- physical chute win exactly once — PASS
- result/inventory update exactly once — PASS
- carried-prize physical return/release — PASS
- READY/home-state ordering — PASS
- glass does not require opaque visual blocking — PASS by gray-box render policy
- no prize parenting, magnet, teleport, velocity reset or hidden success logic — PASS
- M01–M05 locked physics unchanged — PASS
- **28 test files / 69 tests PASS**
- lint/build/GitHub Pages base-path PASS
- browser smoke PASS for both `gantry-lab` and `cabinet-lab`

**M06 CLOSED. Next phase:** M07 — First-Person Player View.

---

# M07 — First-Person Player View

**Status: CLOSED — deployed desktop/mobile manual acceptance verified 2026-10-03**

## Goal

Make play feel like standing directly in front of a real cabinet, without free walking around the machine.

## Deliverables

- head look ≥ ±90° yaw — PASS, exactly ±90°
- limited vertical look — PASS, −70° / +25°
- small forward/back adjustment — PASS
- small left/right adjustment — PASS
- side lean control — REMOVED after playtest; no Q/E lean
- no side walk / no walking around cabinet corners — PASS
- no free-fly or vertical movement — PASS
- fixed realistic FOV — PASS, 50°
- control-panel interaction — PASS
- chute look-down framing — PASS
- final subjective deployed-build play/readability confirmation — PASS

## Current front-player envelope

- fixed eye height = 0.98 m
- X = −0.28…+0.28 m
- Z ≈ 0.534…0.78 m
- front glass outer face ≈ Z 0.384 m
- player remains entirely in front of the cabinet
- no connected side standing zones
- yaw = ±90°
- pitch = −70° / +25°
- no lean/roll control
- FOV = 50°
- desktop: pointer-lock mouse look
- mobile: direct touch-drag look
- WASD only makes small standing-position adjustments

## Interaction

- center reticle + gaze focus remain for visual inspection
- `F` is now a direct primary action and no longer requires the reticle to be over the control-panel button
- `Space`, `F`, and the mobile `DROP / CLOSE` button all invoke the same existing M04 primary action
- chute is inspection-only
- both control panel and chute remain reachable from the front-only legal zone

## Mobile-first control slice

Phone/coarse-pointer play is treated as a primary control path:
- direct touch-drag on the WebGL canvas controls head look
- left virtual analog joystick controls gantry X/Z input continuously in [-1, 1]
- right large `DROP / CLOSE` button invokes the same physical primary action as desktop Space/F
- touch input is routed through `SimulationScene.setManualGantryInput()` into the same gantry motion controller; no synthetic keyboard events
- safe-area insets support notched phones
- debug overlay hides on touch layouts to preserve play space
- browser smoke asserts that mobile controls initialize on both explicit `cabinet-lab` and the root/default scene

## Default play framing / desktop drag correction

Deployed desktop feedback showed two remaining view issues:
- desktop pointer-lock movement still used FPS-style direction while touch already used content-drag direction
- the initial horizontal view required manual camera adjustment before the player could comfortably judge the claw against the prize field

Current correction:
- desktop mouse movement uses the same **content-drag semantics** as touch
- desktop initial Z = **0.84 m**, max Z = **0.84 m**
- initial yaw = 0°
- initial pitch = **−23°**
- default eye height = **1.04 m**; bounded player-height range = **0.98–1.10 m** in 0.02 m steps
- desktop `PageUp/PageDown` and mobile `VIEW + / VIEW −` adjust only this bounded eye height
- desktop FOV remains **50°**
- mobile inherits the same −23° initial pitch while retaining Z 0.84 / max 0.90 and 58° FOV
- automated framing regression verifies representative upper-claw and front-prize-top points are both inside the untouched desktop 50° vertical FOV at startup
- no camera teleport, laser, aim guide or physics change

## Mobile calibration pass

Calibrated phone/coarse-pointer defaults:
- virtual joystick dead zone = **14%** radius
- input outside the dead zone is remapped to the full analog range, preserving full gantry speed at the outer ring
- touch-look sensitivity = **0.0030 rad/pixel**
- desktop mouse sensitivity remains **0.0022 rad/pixel**
- touch direction uses content-drag semantics rather than FPS mouse-look semantics
- mobile camera initial Z = **0.84 m**, max Z = **0.90 m**
- mobile FOV = **58°**; desktop remains **50°**
- framing regression requires representative upper-claw and prize-deck points to fit within the mobile vertical FOV
- accepted `DROP / CLOSE` taps use a **140 ms** debounce to suppress accidental double taps
- action visual feedback auto-clears after 180 ms
- portrait and landscape use separate control sizes/positions
- overscroll is suppressed; safe-area insets remain active

Mobile render budget:
- mobile/coarse pointer: device-pixel-ratio cap = **1.5**, shadow map cap = **512**
- desktop: device-pixel-ratio cap = **2.0**, shadow map = **1024**
- fixed physics timestep, gantry motion, claw torque, grip and prize physics are unchanged

## Cabinet grip correction tied to deployed play feedback

The earlier grip calibration used a small pedestal under the ball and did not represent a prize resting on the broad cabinet deck.

Current physical regression instead uses:
- actual `prize/sphere_ball` mass = 0.075 kg
- actual rubber dynamic friction = 0.82
- actual radius = 0.0525 m
- full physical flat play-deck collider
- existing 3-finger Rapier contact model

Cabinet-only play tuning:
- finger friction = **1.94**
- CLOSE/PICKUP torque = **10.0 N·m**
- RETAINING torque remains **0.014 N·m**
- cabinet HOLD BOOST remains **0.018 N·m**
- strong PICKUP lift distance remains **0.18 m** before RETAINING
- closed angle = **−0.63 rad**
- lower-finger physical/visual contact radius = **10 mm**
- standalone locked M04 lab keeps 0.60 / 2.5 / 0.003 N·m, HOLD BOOST 0.010 N·m, −0.42 rad close angle and the original 0.06 m pickup distance

Measured plush-capable result with 1.3 s top-hold observation:
- centered Rubber Ball: final ≈ **0.2529 m** — SUCCESS
- centered rounded Foam Cube: final ≈ **0.2419 m** — SUCCESS
- centered Small Pillow: final ≈ **0.2464 m** — SUCCESS
- centered Simple Animal: final ≈ **0.2092 m** — SUCCESS
- Simple Teddy at reachable torso-offset grab (+0.02 m X / −0.03 m Z): final ≈ **0.1124 m** — SUCCESS
- centered Teddy remains alignment-sensitive rather than being converted into a guaranteed win
- the former 150 g rejection gate is intentionally retired after deployed feedback requested a stronger claw; high-friction dense spheres can also be physically clamped
- no magnet, prize parenting, weld, scripted carry, kinematic prize conversion or velocity reset

## Depth/readability and starter-prize pass

A laser or projected drop marker is deliberately rejected because it would add information a real cabinet does not provide. The screen build instead restores natural cues that are weakened by the lack of binocular vision:
- low-contrast woven play-deck texture with perspective scaling
- fixed cabinet-top point light with real-time prize/claw shadows
- occlusion and the existing small front-player lateral motion
- no camera/FOV widening and no projected aim line

Starter cube behavior:
- the former ideal 95 mm sharp plastic cuboid was physically confirmed to be a poor 3-prong center-grip target; torque, friction, closed-angle, tip-radius and drop-depth sweeps did not make it realistically grabbable
- `prize/cube_small` is now a 75 g soft **Foam Cube** with `box/rounded_v1` physical corners (~14 mm radius)
- rounded Foam Cube: ≈22.7 mm planar displacement + 10.4 mm peak lift
- legacy sharp cuboid comparison: ≈2.5 mm planar displacement + 2.1 mm peak lift
- hard box prizes remain sharp/high-difficulty rather than being globally softened

## Automated acceptance

- PT-025 ±90° yaw / bounded pitch — PASS
- PT-025 front-only translation with no lean control — PASS
- PT-025 control-panel/chute look-down reachability — PASS
- PT-026 cannot cross front glass — PASS
- PT-026 cannot reach either side standing zone — PASS
- no free-fly/overhead teleport path — PASS by controller design
- real flat-deck rubber-ball full retention — PASS
- real flat-deck Foam Cube full retention — PASS
- centered Pillow full retention — PASS
- centered Animal full retention — PASS
- reachable offset Teddy full retention — PASS
- closed M01–M06 physics remain unchanged outside cabinet-only tuning

Verification:
- **32 test files / 89 tests PASS**
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- `gantry-lab`, explicit `cabinet-lab`, and root-default cabinet browser smokes PASS

M07 closure record — 2026-10-03:
- deployed phone framing/control path manually accepted
- deployed desktop startup framing manually accepted after moving the default standing position to Z = 0.84 m
- enlarged physical prize chute is visible from the untouched desktop startup view
- cabinet debug overlay is hidden by default; F2 or `?debug=1` restores diagnostics
- hidden collider/COM debug paths no longer generate per-frame render buffers
- startup now shows an immediate lightweight loading shell
- selected scene code is dynamically loaded while Rapier initializes in parallel
- production entry chunk reduced from about 4.97 MB / 1.83 MB gzip to about 566 KB / 143 KB gzip; Rapier remains a separate ~1.67 MB gzip chunk
- mobile uses the lighter PCF shadow filter while preserving the same fixed physics
- PR #42 and deployed `main` commit `8421f344ea8a21e3dc9aaf645e474bbafed0e0f9`
- 32 test files / 89 tests PASS, lint/build/base-path/browser smokes PASS, GitHub Pages deploy PASS

**M07 CLOSED. Next phase:** M08 — Visual & Audio Realism Pass 1.

---

# M08 — Visual & Audio Realism Pass 1

**Status: IN PROGRESS — mechanical audio slice 2 candidate**

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

## Visual slice 1 — cabinet / glass / gantry / LED realism

Scope is render-only; no collider, force, friction, timing, claw, gantry-motion, reel, or fixed-step parameters are changed.

Implemented candidate:
- matte cabinet frame and control-panel materials with clearcoat removed after deployed feedback
- very low-reflection physical-glass material with low opacity, high roughness, minimal transmission and faint edge definition
- brushed/stainless chute material without restoring any raised chute rim
- front corner posts and top header aligned with the existing cabinet/glass boundary
- three cool-white emissive LED strips inside the upper cabinet envelope
- moving bridge beam spanning the gantry side rails
- bridge end trolley blocks
- visible carriage winch drum, flanges and lower cable pulley
- sRGB output without cabinet-only filmic highlight processing
- mobile keeps the established lower-cost render profile

Automated visual-configuration regression checks:
- glass stays at or below 10% opacity, >=0.8 roughness, <=0.10 edge opacity, zero clearcoat and only minimal transmission
- LED strips remain inside the physical cabinet envelope
- decorative frame definitions contain no chute-border/rim part
- bridge/winch proportions remain compact and visibly distinct
- frame/control-panel clearcoat remains zero and LED emissive intensity remains <=1

## Deployed visual correction — 2026-10-03

- cabinet claw now starts at the same X/Z as the physical chute center, matching the real-machine parked position
- cabinet-only start position is passed through the generic gantry scene without changing the M02 home calibration
- normal play RETURN already targets the same chute position, so startup and post-play parking are consistent
- bright decorative/specular highlights were removed: frame, panel, rails, bridge, carriage, winch and claw metals use substantially higher roughness and lower metalness
- glass edge opacity reduced to 0.08 and glass roughness raised to 0.82
- LED emissive intensity reduced from 2.4 to 0.9
- cabinet-only ACES filmic tone mapping removed
- no collider, force, friction, claw torque, reel, movement, timestep or chute geometry change

## Mechanical audio slice 2 — machine motion / claw actions

Scope is audio-only; sound is derived from simulation telemetry and does not drive physics.

Implemented candidate:
- procedural Web Audio graph; no external audio assets or network fetches
- audio graph is created/resumed only after the first keyboard or pointer interaction to satisfy browser autoplay policies
- gantry motor tone follows the real X/Z carriage speed magnitude
- reel motor tone follows the real signed reel velocity; lifting uses a slightly higher pitch than lowering
- one-shot mechanical cues on phase entry:
  - DROP / descent start
  - claw CLOSE start
  - claw RELEASE start
  - gantry stop after meaningful motion
- cabinet/root browser smoke requires the machine-audio layer to be armed
- the audio controller is cabinet-only; laboratory scenes remain unchanged

Automated regression:
- motor loudness inputs normalize/clamp from the established 0.45 m/s gantry and 0.28 m/s reel limits
- lift and descent reel pitches remain distinguishable
- DROP/CLOSE/RELEASE sounds trigger only on phase transitions, not every frame
- stop cue requires a real moving-to-stopped transition

Still pending in later M08 slices:
- material-specific prize contact audio
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
