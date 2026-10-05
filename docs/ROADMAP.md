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

- the former center reticle was removed after deployed play feedback; gaze focus remains internal for contextual text only
- `F` is a direct primary action and does not require a center aim marker
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

**Status: CLOSED — visual/audio realism pass 1 accepted**

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

## Prize contact audio slice 3 — material-specific impacts

Scope remains audio/reporting only; solver parameters and gameplay are unchanged.

Implemented candidate:
- Rapier contact-force events are enabled only for cabinet prizes that opt into contact audio
- PrizeFactory reuses each existing material profile's `audioProfileId`; there is no duplicate material-to-sound table in the cabinet scene
- an impact is emitted only when a collider pair crosses from below to above the 1.5 N reporting threshold, preventing resting contacts from repeatedly sounding
- the strongest impact per audio profile is retained until the render frame consumes it
- pre-unlock impacts are consumed silently, so initial prize settling is never replayed after the player's first interaction
- synthesized Web Audio profiles:
  - cardboard: muted papery thud
  - plastic: short, brighter click
  - rubber: lower-frequency thump
  - fabric/plush: softer filtered impact
- cue intensity follows the actual reported contact-force magnitude
- a short same-family cooldown prevents rapid chatter without changing physics
- contact-audio event capture is cabinet-only; Prize Lab and unrelated physics scenes do not opt in

Automated regression:
- catalog audio profiles map to distinct audible families
- sub-threshold resting-scale contacts do not create cues
- stronger real force produces stronger normalized cues
- plastic remains brighter/shorter than plush/fabric, while rubber remains lower-frequency
- a tagged falling body generates a contact-audio impact through Rapier's real event queue
- an untagged dynamic body remains silent
- native-WASM production build, bundle gates, base-path and gantry/cabinet/root browser smoke remain PASS

No collider shape, prize mass, friction, restitution, claw force/torque, reel, gantry, timestep, chute geometry or game-rule parameter changed.

## Arcade ambience slice 4 — subtle machine / room bed

Scope is audio-only; no simulation or rendering behavior changes.

Implemented candidate:
- no external audio assets or network requests
- ambience starts only after the existing first user interaction unlocks Web Audio
- cabinet-local electrical/fan bed:
  - 60 Hz fundamental
  - quiet 120 Hz harmonic
- distant arcade-room bed:
  - deterministic looped noise
  - high-pass at 180 Hz and low-pass at 1.65 kHz to avoid sub-bass rumble and harsh hiss
  - very slow 0.075 Hz shallow level modulation so the room bed is not unnaturally static
- total continuous ambience peak gain is constrained below 0.015 before the existing master gain, keeping it substantially quieter than foreground gantry/reel/action audio
- no background music, melody, UI beeps or conspicuous arcade effects
- browser diagnostics expose `data-arcade-ambience` and cabinet/root smoke requires the layer to be armed

Automated regression:
- ambience stays below the foreground-audio gain budget
- cabinet hum stays in a low electrical/fan-like frequency range
- room bed remains band-limited away from sub-bass and harsh highs
- modulation remains slow and shallow rather than becoming an audible pulse
- native-WASM production bundle gates and browser smoke remain required

No physics, prize behavior, camera, controls, visual materials or loading-path change.

## Controller haptics slice 5 — optional enhancement

Scope is feedback-only. Haptics never drive simulation state and are strictly feature-detected.

Implemented:
- cabinet-only lazy-loaded haptics controller
- supported gamepads receive short event-based pulses for:
  - DROP start
  - claw CLOSE
  - claw RELEASE
  - gantry stop
  - meaningful prize impacts
- dual-rumble `playEffect("dual-rumble", ...)` is used when available
- generic `pulse(value, duration)` actuator fallback is supported when exposed by the browser
- unsupported browsers/controllers remain silent with no error path
- prize-impact rumble intensity scales from the same real Rapier contact-force events used by material audio
- dispatch is separated by at least 16 ms to avoid same-frame duplicate chatter
- pulse duration is <=50 ms and magnitudes remain moderate
- the existing mobile action-button vibration remains unchanged
- browser diagnostics expose `data-controller-haptics="armed"`; physical controller hardware is not required for CI

Automated regression:
- all action pulses remain <=50 ms
- weak magnitude remains <=0.40 and strong magnitude <=0.25
- claw CLOSE is stronger than a gantry-stop cue
- prize impact haptics scale monotonically from real contact force and clamp to 1.0
- unsupported/no-controller paths are no-op by construction
- native-WASM build and cabinet/root browser smoke require the haptics integration layer to be armed

No physics, controls, camera, audio mix, rendering, startup path or game-rule parameter changed.

## Startup performance correction — 2026-10-03

Triggered by deployed-build feedback that the loading screen remained visible too long after the mechanical-audio slice.

Baseline from the deployed `493ac645...` build:
- production bootstrap/app entry: 566.36 kB raw / 142.98 kB gzip
- Rapier/PhysicsRuntime chunk: 4,338.89 kB raw / 1,670.84 kB gzip
- the app/Three entry had to load and execute before the large Rapier dynamic import was requested, creating an avoidable network/parse waterfall
- the small mechanical-audio module was also awaited before the first rendered frame

Rejected experiment:
- replacing `@dimforge/rapier3d-compat` 0.21.0 with standard `@dimforge/rapier3d` was tested in PR #46
- package-root ESM resolution first failed under Vitest; using the explicit `rapier.js` entry then produced WASM glue/runtime failures in 32 physics tests
- PR #46 was closed without merge; production remains on the verified compat engine/version

Accepted candidate in PR #47:
- `main.ts` is now a tiny bootstrap that immediately shows the loading shell
- app/Three and PhysicsRuntime/Rapier dynamic imports start at the same time instead of sequentially
- the already-started physics promise is passed into `startApp`
- the mechanical-audio chunk is no longer awaited on the first-frame critical path
- `data-startup-ms` records elapsed bootstrap-to-first-playable-frame time for deployed diagnostics
- CI enforces a <=25 kB production bootstrap entry and browser smoke requires `data-bootstrap="parallel"`

Measured candidate build:
- bootstrap entry: 2.85 kB raw, down from 566.36 kB raw (~99.5% smaller initial JS entry)
- app/Three remains a separate ~564.63 kB raw / 142.16 kB gzip chunk
- Rapier/PhysicsRuntime remains ~4,338.90 kB raw / 1,670.84 kB gzip
- total heavy payload is not claimed to have disappeared; the improvement comes from removing the startup waterfall and allowing the two major chunks to download/parse concurrently
- all 101 tests, lint, build, Pages base-path, bundle-size gate, and gantry/cabinet/root browser smoke pass
- no collider, force, friction, claw torque, reel, timestep, camera, control, chute or prize-physics behavior changed

### Native browser WASM follow-up — PR #48

The earlier PR #46 failure was isolated to using the standard Rapier package inside the Vitest worker environment. The browser path is now separated from tests instead of forcing one backend everywhere:

- both packages remain pinned to Rapier 0.21.0
- Vitest mode keeps `@dimforge/rapier3d-compat`, preserving the existing 101 physics/regression tests
- Vite browser builds alias that same import to `@dimforge/rapier3d/rapier.js`
- `PhysicsRuntime.create()` calls `init()` only when the selected backend exposes it
- browser diagnostics expose `data-physics-backend="native-wasm"`
- gantry, cabinet and default-root headless browser smoke all initialize successfully on the native-WASM production build

Measured production bundle:
- bootstrap entry: 1.76 kB raw / 0.96 kB gzip
- PhysicsRuntime JavaScript: 299.75 kB raw / 52.97 kB gzip
- Rapier WASM: 3,082.10 kB raw / 1,187.63 kB gzip
- previous compat PhysicsRuntime JavaScript: 4,338.90 kB raw / 1,670.84 kB gzip
- Rapier-related compressed transfer therefore drops by about 26%, while JavaScript parsing falls much more sharply because the 3 MB physics core is now actual WASM instead of base64 text embedded in JS
- Vite also split Three core from the app chunk during this build; this is a bundling consequence only, not a rendering or gameplay change

New CI regression gates:
- a hashed Rapier `.wasm` asset must exist and remain <=3.5 MB raw
- PhysicsRuntime JS must remain <=500 kB raw, preventing accidental return to the compat/base64 browser bundle
- gantry/cabinet/root browser smoke must report `data-physics-backend="native-wasm"`

No collider, force, friction, torque, reel, timestep, camera, control, chute, prize setup or game-rule parameter changed.

## Exit criteria

- machine movement has identifiable mechanical sound
- cardboard/plastic/plush contacts differ
- glass reflections do not obscure aiming
- no major visual mismatch between collision and mesh

## M08 closure audit — 2026-10-04

Final verification on PR #51 branch head after the haptics build fix:

- lint: PASS
- test files: 38 / 38 PASS
- automated tests: 116 / 116 PASS
- production TypeScript/Vite build: PASS
- GitHub Pages base-path check: PASS
- native Rapier WASM bundle gate: PASS
- bootstrap entry: 1,767 bytes
- PhysicsRuntime JS: 300,847 bytes
- Rapier WASM: 3,082,103 bytes
- gantry-lab browser smoke: PASS
- cabinet-lab browser smoke: PASS
- default root cabinet browser smoke: PASS

Exit-criteria disposition:
- **machine movement has identifiable mechanical sound — PASS**
  Gantry and reel audio follow simulation velocity; DROP/CLOSE/RELEASE/stop cues are phase- or motion-transition driven.
- **cardboard/plastic/plush contacts differ — PASS**
  Material audio is selected from the existing prize material profile and synthesized as distinct cardboard, plastic, rubber and soft fabric/plush families using real Rapier contact-force events.
- **glass reflections do not obscure aiming — PASS**
  The deployed visual correction uses very low-opacity, high-roughness glass with restrained edges and no cabinet ACES highlight boost; this was manually accepted during M08.
- **no major visual mismatch between collision and mesh — PASS**
  M08 did not alter collider geometry; existing prize/cabinet render bindings and established physical calibration remain intact, and full regression/browser smoke remains green.

Additional accepted M08 deliverables:
- matte cabinet / controlled glass / gantry-winch-rail details / LEDs
- procedural machine audio
- material-specific prize impacts
- low-level cabinet + arcade ambience
- optional gamepad haptics with graceful no-hardware fallback
- startup loading correction with parallel bootstrap and native browser WASM

Closure rule:
- M08 is CLOSED at this branch head, subject only to the normal merge-after-green-main verification.
- Later tuning requests may adjust mix levels or presentation, but they do not reopen M08 unless an exit criterion regresses.

---

# M09 — Layout Gameplay

**Status: IN PROGRESS — closure candidate; production-claw bridge gate automated PASS**

## Goal

Expand beyond loose piles.

## Layout foundation slice 1 — deterministic layouts + settle pipeline

Implemented candidate:
- data-driven cabinet layout IDs with URL selection via `?layout=...`
- deterministic layout generation from the existing scene `seed`
- `loose` layout:
  - preserves the familiar five-prize starter arrangement
  - adds only millimeter-scale seeded position variation and small seeded yaw variation
- `dense` layout:
  - eight prizes
  - compact seeded arrangement using existing prize definitions
  - small vertical spawn clearance so the real solver determines final contact poses
- visual variants use layout-derived seeds, keeping pose/content reproducible for a fixed seed
- generated prize centers remain bounded inside the current cabinet play envelope
- cabinet controls are temporarily gated by a physics settle pipeline:
  - linear-speed threshold: 0.025 m/s
  - angular-speed threshold: 0.30 rad/s
  - stable window: 0.30 s
  - maximum settling window: 2.50 s
  - timeout is fail-open, so controls cannot become permanently trapped
- settling happens after the first rendered frame; the loading screen is not extended
- gantry control gating is optional and supplied only by cabinet layout gameplay, so laboratory scenes retain existing behavior
- debug output reports layout ID, seed, prize count, settle state and elapsed settle time
- CI cabinet browser smoke now boots the `dense` layout with a fixed seed; default-root smoke continues to cover the normal `loose` layout

Automated regression:
- supported layout parsing and fallback
- fixed seed produces identical layout placements
- different seeds produce different physical spawn poses
- loose/dense prize-count contract
- generated placement bounds
- continuous stable-window requirement
- motion resets the settle window
- settle timeout fails open rather than trapping controls

No claw, gantry, reel, grip, collider, material, chute, camera or timestep tuning changed.

## Showcase layout slice 2 — separated material / geometry display

Implemented candidate:
- new `showcase` layout selectable with `?layout=showcase&seed=...`
- six representative prizes arranged as two separated rows:
  - Standard Box — cardboard
  - Rubber Ball — rubber
  - Prize Can — plastic
  - Simple Teddy — plush
  - Small Pillow — fabric
  - Simple Animal — plush compound geometry
- side positions use ±0.22 m spacing so the larger plush bodies begin with clear physical separation
- showcase seed variation is intentionally restrained:
  - ±3 mm X/Z jitter
  - ±0.025 rad yaw jitter
  - no added vertical drop jitter
- the same physics settle pipeline from slice 1 remains authoritative; showcase does not bypass or freeze prize physics
- active layout ID is exposed as `data-layout-id` on the app root for deployed diagnostics
- browser regression now verifies:
  - dense URL actually reports `data-layout-id="dense"`
  - showcase URL actually reports `data-layout-id="showcase"`
  - default root actually reports `data-layout-id="loose"`
- fixed-seed determinism is now asserted across loose, dense, and showcase layouts

Purpose:
- provide a clean baseline for comparing prize geometry/material behavior before introducing bridge, edge, ring, and chute-adjacent challenge layouts
- preserve physical interaction while minimizing incidental pile interference

No claw, gantry, reel, grip, collider, material, chute, camera or timestep tuning changed.

## Bridge layout slice 3 — fully dynamic supported span

Implemented candidate:
- new `bridge` layout selectable with `?layout=bridge&seed=...`
- bridge structure is made entirely from existing dynamic prize bodies:
  - two Standard Box support bodies at approximately X ±0.09 m
  - one Flat Box span centered above them
  - the span starts with a 2 mm vertical clearance and falls onto the supports through normal Rapier gravity/contact
  - Rubber Ball and Simple Teddy remain as separated filler prizes so the cabinet is still a playable mixed scene
- layout placements now carry optional semantic roles (`support`, `bridge`, `filler`) for challenge regression/debugging only; roles do not affect physics
- structural seed variation is deliberately tight:
  - ±1.5 mm X/Z
  - ±0.012 rad yaw
  - no additional vertical jitter
- no static bridge fixture, joint, weld, parenting, magnet, scripted rotation, or position lock is used
- a physics integration regression:
  - spawns the production bridge layout over a plain physical deck
  - lets all three structural bodies settle under gravity
  - verifies the Flat Box remains elevated on the two supports
  - applies three separated small off-center physical impulses to the bridge span, representing repeated nudges
  - requires both measurable translation and rotation afterward
  - calibrated regression result:
    - settled bridge-center height ≈ 107.2 mm
    - cumulative horizontal translation ≈ 12.72 mm
    - cumulative rotation ≈ 0.0957 rad (~5.5°)
- deployed browser smoke now boots the bridge layout and requires `data-layout-id="bridge"`

This slice establishes the bridge as physically destructible/manipulable substrate. The M09 exit criterion requiring the bridge to be solved through repeated real claw interactions remains a later acceptance gate; this test does not substitute an impulse for the player/claw interaction.

### First-person reticle cleanup

Deployed feedback requested removal of the small translucent center dot:
- the `.player-reticle` DOM element is no longer created
- all reticle CSS, including the mobile portrait offset, is removed
- gaze/focus logic remains available for contextual interaction text
- direct `F` / Space / mobile primary action behavior is unchanged
- browser smoke explicitly rejects any remaining `player-reticle` element

No camera, FOV, look sensitivity, movement envelope, claw control or physics parameter changed.

## Edge layout slice 4 — wall-adjacent claw challenges

Implemented candidate:
- new `edge` layout selectable with `?layout=edge&seed=...`
- edge is intentionally defined as **cabinet wall/back-wall play**, not chute-lip play; `chute-adjacent` remains a separate later layout
- two explicit `edge_target` prizes:
  - Standard Box near the right glass at approximately X = +0.38 m
  - Prize Can near the back wall at approximately Z = −0.305 m
- both target centers sit beyond the closed M02 direct carriage-center envelope:
  - X carriage maximum = +0.30 m
  - Z carriage minimum = −0.24 m
- this forces the suspended claw geometry, swing/lag, side contact or repeated physical pushing to matter instead of allowing a simple centered drop
- targets remain inside the real cabinet boundary and use the normal wall/glass colliders
- three central filler prizes preserve a normal playable scene without blocking the wall targets
- edge-specific seed variation is deliberately restrained:
  - ±1 mm X/Z
  - ±0.010 rad yaw
  - no extra vertical jitter
- edge uses wider layout-center bounds only for this layout; loose/dense/showcase/bridge retain their existing central bounds
- semantic role `edge_target` is metadata only and does not affect collision, forces, scoring or grip behavior
- physics integration regression:
  - creates the production cabinet geometry
  - lets the edge layout settle normally
  - requires the two targets to remain beyond direct carriage-center travel after settling
  - applies inward physical impulses
  - requires measurable inward travel, proving wall contact does not lock or script the prizes
  - calibrated regression result:
    - right-wall Standard Box: X ≈ 0.3797 → 0.3671 m, inward travel ≈ 12.55 mm
    - back-wall Prize Can: Z ≈ −0.3060 → −0.2978 m, inward travel ≈ 8.18 mm
- deployed browser smoke boots `layout=edge` and verifies `data-layout-id="edge"`

Purpose:
- establish a realistic “邊角貨” substrate where direct carriage alignment is insufficient
- create a later manual/automated acceptance target for using M03 swing and real finger contact to extract a prize from the wall

This slice does not add any special edge-grab force, hidden aim assist, wall release rule or success shortcut.

No claw, gantry, reel, grip, material, collider, cabinet, chute, camera or timestep tuning changed.

## Mobile control visibility correction — 2026-10-04

Deployed-play feedback identified the mobile overlay itself as obstructing the cabinet view.

Implemented candidate:
- keep the existing control mapping and gameplay callbacks unchanged
- reduce joystick visual diameter:
  - normal mobile: 96 px
  - <=520 px viewport: 88 px
  - landscape: 82 px
- reduce DROP/CLOSE diameter:
  - normal mobile: 82 px
  - <=520 px viewport: 76 px
  - landscape: 70 px
- split the action label across two lines to remain legible at the smaller size
- reduce idle joystick opacity to 0.54 and action opacity to 0.72
- joystick becomes visually stronger only while actively dragged
- DROP/CLOSE becomes visually stronger only during press/accepted feedback
- move VIEW+/− away from the lower-right action stack to the upper-right safe-area
- change VIEW+/− to a horizontal pair with low idle opacity and stronger active/focus feedback
- reduce borders, shadows and backdrop blur so controls read as overlays rather than opaque game UI
- preserve safe-area insets in portrait and landscape
- expose `data-mobile-control-style="compact-translucent"` for deployed browser diagnostics

No joystick dead zone, analog remapping, action debounce, haptics, view-height step, camera envelope, claw input, physics or gameplay parameter changed.

## Ring / loop layout slice 5 — actual hollow hook geometry

Implemented candidate:
- add a new reusable `prize/ring_loop` definition
- add `ring` as a first-class prize shape family
- ring collider is **not** a filled disc or cylinder:
  - 12 capsule segments form a closed loop in the X/Z plane
  - outer footprint ≈ 150 × 130 mm
  - tube radius = 10 mm
  - inner clear half-width ≈ 55 mm
  - inner clear half-depth ≈ 45 mm
- visual geometry is generated from the exact same capsule segments used by physics, avoiding a fake visible hole over a solid collider
- initial slice 5 loop lay flat on the deck, which proved the hole/collision geometry but deployed-play feedback showed that this pose was not actually grabbable; the corrective pose below supersedes the flat presentation
- new `ring` layout:
  - two `ring_target` Loop Ring prizes at separated positions/approach angles
  - Rubber Ball and Foam Cube fillers keep the scene playable
  - seeded variation remains intentionally tight:
    - ±1.5 mm X/Z
    - ±0.015 rad yaw
    - no extra vertical jitter
- `ring_target` is semantic metadata only and never alters forces, collisions, grip or scoring

Automated geometry regression:
- exactly 12 capsule segments form the loop
- physical outer bounds match the prize catalog dimensions
- center opening remains substantially wider than the existing 10 mm claw finger pad radius

Physics hook regression:
- a 9 mm-radius vertical kinematic probe is placed through the center opening
- the Loop Ring settles around the centered probe without being pushed aside, proving the center is physically hollow
- the same probe then moves laterally
- lateral motion must move the ring by measurable distance, proving the probe catches the real inner rim rather than passing through a fake/non-colliding mesh
- calibrated regression result:
  - centered-probe ring offset ≈ 0.019 mm
  - settled ring center height ≈ 9.99 mm
  - probe lateral travel = 60 mm
  - resulting ring travel ≈ 15.58 mm
- this is a geometry proof only; M09 final acceptance still requires the production claw to hook the ring through normal player controls

Catalog regression is updated from 11 to 12 prize definitions while preserving the existing 12-prize long-settle stability test.

Deployed browser smoke boots `layout=ring` and requires `data-layout-id="ring"`.

No claw, gantry, reel, grip, material, cabinet, chute, camera or timestep tuning changed.

## Ring grabbable-pose correction — 2026-10-04

Deployed-play feedback identified a real gameplay defect in slice 5: a physically hollow ring lying flat on the deck still cannot be reliably picked because the claw has no under-rim access.

Correction:
- add X-axis prize spawn rotation support while preserving the existing yaw-only behavior for all current layouts
- replace each flat ring target with a physically tilted target:
  - initial X tilt ≈ ±0.61 rad (≈35°)
  - initial center X ≈ ±0.16 m
  - initial ring vertical offset = 34 mm
- place one normal dynamic Standard Box behind each ring as a physical support
- move the supports outward to approximately Z ±0.125 m so the boxes brace the outer rim/side rather than occupying the ring opening
- the boxes and rings remain ordinary dynamic prize bodies:
  - no fixed fixture
  - no joint or weld
  - no parenting
  - no magnet
  - no scripted pose lock
  - no special ring pickup force
- one Foam Cube remains as a filler prize

Production-layout settle regression:
- both ring targets settle at ≈0.63 rad (≈36°) tilt
- ring center height ≈41.1–41.2 mm
- low-side centerline ≈8.65 mm above the deck
- elevated high-side inner-rim underside ≈63.5–63.8 mm above the deck
- dedicated supports settle normally and remain outside the nominal clear opening

Hook-and-lift geometry regression:
- after the production ring layout has settled, a claw-tip surrogate is inserted from inside the hollow opening
- surrogate geometry uses a narrow stem through the opening and a wider lower pad beneath the elevated inner rim
- the ring body is explicitly awakened before contact, matching production dynamic-claw contact rather than testing a sleeping-body artifact
- a 50 mm upward hook motion raises the ring center by ≈18.95 mm
- this proves the corrected pose supplies actual under-rim geometry that can be mechanically hooked and lifted

The final M09 acceptance gate still requires manual pickup with the production three-finger claw through normal controls; this regression verifies that the layout no longer makes pickup geometrically impossible.

No claw force, grip torque, friction, gantry, reel, material, cabinet, chute, camera or timestep tuning changed.

## Production-claw ring entry correction — 2026-10-04

Deployed-play feedback after the grabbable-pose correction showed that the remaining problem was **entry geometry, not claw force**:
- the previous Loop Ring true opening was only about 110 × 90 mm
- the cabinet lower finger pad radius is 10 mm
- the open-claw tip radius is much larger than the loop itself, so the intended technique is one-prong hooking rather than centering all three fingers over the hole
- the previous surrogate-hook regression proved that a thin hook could lift the ring, but did not prove that the production claw had a practical approach window

Correction:
- keep the production claw completely unchanged
- enlarge Loop Ring outer footprint:
  - 150 × 130 mm → 190 × 170 mm
  - tube diameter remains 20 mm
- resulting true inner opening:
  - about 110 × 90 mm → about 150 × 130 mm
- reduce the initial X tilt:
  - ≈35° → ≈29.8°
- replace the low Standard Box braces with existing dynamic Tall Box prizes
- Tall Box side faces brace the enlarged rings without occupying the center opening
- no static support, fixed joint, scripted pose lock or ring-specific pickup force is introduced

Production-claw access regression:
- uses the actual cabinet lower finger-pad radius = 10 mm
- accounts for the reduced top-down minor-axis opening caused by ring tilt
- requires at least 80 mm of usable projected finger-centerline corridor
- uses the real open-claw tip radius from the production claw geometry
- evaluates all three 120° prong approach positions
- requires at least two valid one-prong approach carriage positions inside the real M02 X/Z travel envelope

Calibrated production-layout physics result:
- settled ring center height ≈41.9–42.1 mm
- settled tilt ≈0.455–0.458 rad (≈26.1°)
- low-side centerline ≈8.92–8.93 mm above the deck
- elevated high-side inner-rim underside ≈64.8–65.2 mm above the deck
- 50 mm surrogate hook rise lifts the ring center ≈23.07 mm
- 140 automated tests PASS
- ring browser smoke PASS

This correction deliberately does **not** increase claw power. If manual play still cannot insert one production prong after deployment, the next investigation must use full production-claw approach/contact telemetry rather than adding more closing torque.

No claw force, grip torque, friction, gantry, reel, cabinet, chute, camera or timestep tuning changed.

## Production-claw Ring retention tolerance + self-jam correction — 2026-10-04

Deployed play then identified two production-claw issues that the geometric entry proof did not cover.

Ring retention tolerance:
- full production-claw telemetry reproduced the narrow centered sweet spot
- increasing retaining torque did not solve the failure
- support-only and larger-pad sweeps also failed to create a useful tolerance window
- root cause was that the 10 mm lower pad radius covered the entire final finger segment, so offset entry pushed the Ring before the tip could form a useful hook
- production geometry now keeps the lower arm at the normal 4.5 mm radius and limits the 10 mm radius contact pad to the terminal 12 mm
- centered, moderate-depth and ±5 mm tangent Ring approaches all complete physical pickup/retain/return regressions
- deployed manual Ring pickup was accepted after this change

Sibling-finger self-jam:
- after a prize fell out, continued motor closure could force sibling fingers into each other
- sibling contact is now detected from real Rapier body contact
- once sibling contact occurs during a close cycle, the guard latches and the motor command stops advancing inward for that cycle
- the guard clears only when the claw opens again
- contact-limited closure is accepted by the M04 state machine as a valid mechanical close so failed/empty grabs still proceed through lift, return and release
- empty-claw regression stops around −0.157 rad instead of continuing to the nominal −0.63 rad target
- after settle and reopen, sibling contact pairs are 0 / 0 / 0
- Ring pickup regression remains green
- exact short-pad Ball / Cube / Pillow / Animal / Teddy guard OFF vs ON comparison is numerically unchanged
- deployed manual self-jam correction: PASS

No collision is disabled; no finger is allowed to pass through another finger.

## Chute-adjacent layout slice 6 — prize-lip manipulation

Implemented candidate:
- add `chute` as a first-class deterministic cabinet layout ID
- two explicit `chute_target` prizes stage immediately outside the existing physical opening:
  - Rubber Ball beside the right lip, intended for inward roll/push play
  - Foam Cube behind the back lip, intended for push/flip play
- two separated filler prizes preserve a normal playable cabinet scene
- chute-specific seed variation is deliberately tight:
  - ±1 mm X/Z
  - ±0.010 rad yaw
  - no added vertical jitter
- target placement uses the existing cabinet opening and deck geometry; there is no raised artificial lip or invisible fixture
- the existing `ChuteSensor` remains the only win detector

Physics regression:
- each target is tested in the production cabinet geometry
- target must settle on the play deck without an initial sensor win
- only a horizontal rigid-body impulse is then applied toward the physical opening
- success requires the ordinary dynamic body to fall far enough into the chute for the existing sensor to record it
- no prize teleport, sensor injection, scripted win, hidden force field, parenting, magnet, weld or kinematic conversion

Browser CI boots `?scene=cabinet-lab&layout=chute&seed=ci-m09-chute` and requires `data-layout-id="chute"`.

## Production-claw bridge closure regression — 2026-10-04

The earlier bridge regression only proved that the fully dynamic structure could be moved by external physical impulses. The M09 exit gate requires the actual production claw to solve the bridge through repeated interactions.

Final regression:
- uses the exact cabinet production claw geometry and tuning:
  - normal 4.5 mm lower arm
  - 10 mm radius × 12 mm terminal pad
  - finger friction 1.94
  - CLOSE/PICKUP 10.0 N·m
  - RETAINING 0.014 N·m
  - cabinet closed angle −0.63 rad
- uses the real suspended hub, spherical suspension, stabilizer, reel motion, gantry motion, self-contact guard and M04 DROP → AUTO CLOSE → PICKUP → RETAINING → RETURN → RELEASE lifecycle
- starts from the production `bridge` layout after normal physics settle
- uses two sequential plays against the **same evolving bridge state**
- no direct impulse is applied to the bridge beam in this closure regression

Two-step physical solve:
1. setup play, carriage target ≈ X +0.10 / Z −0.02 m
   - bridge beam horizontal travel ≈ **36.13 mm**
   - rotation ≈ **0.0144 rad**
   - peak lift ≈ **58.85 mm**
   - beam remains elevated on the play field
   - chute sensor remains **false**
2. finish play, carriage target ≈ X −0.10 / Z −0.02 m
   - acts on the already changed beam state from play 1
   - horizontal travel during this play ≈ **428.10 mm**
   - rotation ≈ **2.3386 rad**
   - peak lift ≈ **272.29 mm**
   - beam physically reaches the existing chute sensor — **PASS**

Cumulative initial-to-final bridge change:
- horizontal travel ≈ **395.39 mm**
- rotation ≈ **2.3372 rad**

Interpretation:
- the first claw interaction is a genuine setup attempt that changes the physical state without scoring
- the second production-claw interaction finishes the changed state and sends the bridge prize into the normal chute path
- this satisfies the M09 bridge requirement through repeated real claw manipulation rather than a scripted result or test-only prize impulse

Verification on PR candidate:
- **48 test files / 148 tests PASS**
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- native Rapier WASM / startup bundle gates PASS
- gantry, cabinet, showcase, bridge, edge, ring, chute and root browser smokes PASS

M09 exit-gate status:
- bridge can be solved by repeated physical rotation/translation — **automated PASS with production claw**
- ring can be hooked through actual geometry — **automated + deployed manual PASS**
- layout reset does not force identical final poses unless using a fixed seed — **PASS**
- remaining closure action: deployed manual bridge play confirmation

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

**Status: CLOSED — automated + deployed manual validation PASS (2026-10-05)**

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

## Slice 1 — inventory / staff-policy foundation

Implemented:
- cabinet stock now has an explicit initial count, awarded count and remaining count
- only accepted ChuteSensor-derived win results decrement remaining stock
- duplicate prize awards cannot decrement inventory twice
- restock threshold is explicit; current cabinet policy uses 1 remaining prize
- staff requests are rejected while stock is above threshold, preventing arbitrary requests for an ideal placement
- reaching the threshold makes CALL STAFF policy-eligible
- requesting staff transitions service state from `operating` to `staff_requested`
- `staff_requested` latches a player-input lock; slice 2 below performs the actual pause only after a safe handoff
- current scene debug exposes stock remaining, threshold, staff-call eligibility and service state

Deliberately deferred to later M10 slices:
- player-facing CALL STAFF control
- safe idle/play-cycle handoff before service begins
- staff approach / open / reposition / close sequence
- seeded restock placement
- post-restock settle validation
- reopening the machine after service

No prize force, claw force, collision, ChuteSensor logic or payout shortcut was changed.

## Slice 2 — CALL STAFF + safe service handoff

Implemented:
- add a player-facing CALL STAFF control for desktop and mobile cabinet play
- desktop shortcut: `S`
- control remains visible but disabled while store policy does not permit service
- once the restock threshold is reached, CALL STAFF becomes actionable
- accepted call transitions `operating -> staff_requested`
- `staff_requested` immediately locks new player gantry/drop input but does **not** freeze or abort an active M04 play cycle
- the existing DROP/CLOSE/PICKUP/RETAINING/RETURN/RELEASE sequence is allowed to finish normally
- service pauses only after the gantry reports a safe idle condition:
  - M04 play phase is `READY`
  - reel is fully retracted and stopped
  - gantry X/Z motion is below the existing home velocity tolerance
  - fingers have returned to the open target
  - no PT/home-return motion is active
- only then does state transition `staff_requested -> service_paused`
- physics continues running; this is a machine/input service pause, not a world freeze
- debug telemetry exposes service-safety and input-lock state
- browser smoke requires the CALL STAFF control to exist on cabinet/root play

Deferred to the next M10 slice:
- staff approach / service-door open sequence
- deterministic reposition/restock placement
- settle validation
- close/reopen and return to `operating`

No claw/prize force, Ring geometry, collision, ChuteSensor, teleport, parenting, magnet, weld, hidden pickup force or kinematic prize carry was added.

## Slice 3 — adult staff approach + service-door opening

Implemented:
- add a visible adult female arcade staff NPC as a lightweight Three.js character:
  - adult proportions
  - dark ponytail / hair silhouette
  - navy staff uniform + light blouse panel
  - name badge
  - skirt + dark leggings + shoes
  - simple facial features
- presentation goal is a clean, attractive Japanese-arcade-style staff silhouette without changing gameplay outcomes
- character is intentionally built as replaceable visual content; service logic is independent so a later GLB/skinned model can replace it without rewriting M10 state flow
- staff does not appear until the machine has completed the slice-2 safe handoff and entered `service_paused`
- deterministic service sequence:
  - `hidden`
  - `approaching` for about 2.6 s
  - `opening_door` for about 0.9 s
  - `door_open`
- approach includes simple procedural walk bob + alternating arm swing
- at the cabinet, the staff turns toward the right-side service panel and raises an arm while opening it
- CALL STAFF status text now reports STAFF APPROACHING / OPENING MACHINE / SERVICE DOOR OPEN
- service sequence timing and final outside-cabinet position are regression-tested
- the visible right-side glass/service panel is hinged visually for this slice

Important approximation:
- the existing cabinet physics collider remains closed while the service door is only visually open
- this is intentional because slice 3 does not yet move prizes through the opening
- the next restock slice must create a legitimate service-access physics state before any prize is repositioned/restocked; do not move prizes through the still-closed collider

Deferred:
- physical service-door aperture/collider handling
- staff hand/reach interaction with prizes
- seeded restock/reposition placement
- settle validation
- close-door / staff departure / machine reopen

No win forcing or ideal-placement request path was introduced.

## Slice 4 — physical service access + seeded restock settle

Implemented:
- the right-side service door is now backed by the real cabinet collider as a kinematic body
- during normal gameplay the door remains in the same closed pose and preserves cabinet containment
- after the slice-2 safe service pause and slice-3 staff approach, the physical door collider rotates around the same hinge as the visible glass panel
- service access therefore becomes a real open boundary instead of visual-only animation
- newly restocked prizes are not teleported from old awarded bodies:
  - awarded/won bodies remain where physics put them
  - replacement stock is created only as genuinely new inventory
  - new stock is inserted from the opened right-side service area
- the restock plan is deterministic for a fixed seed and differs across seeds
- replacement prize types are drawn only from the current layout's existing prize pool
- insertion poses stay on the right side, away from the chute
- prizes are inserted sequentially at 0.55 s intervals rather than overlapping all at once
- after insertion, normal gravity/contact physics is the only mechanism that forms the new pile
- a fresh settle gate checks linear and angular motion of the replacement stock
- inventory is credited back only after that settle gate reaches READY/TIMEOUT_READY
- ChuteSensor payout polling is suspended while the machine is in `service_paused`, so staff handling cannot be miscounted as a player win
- debug telemetry exposes restock phase, inserted count, settle state and lifetime restocked count

Regression coverage:
- closed service-door cabinet containment remains covered by the existing M06 wall test
- new physical-door regression verifies the real right-side collider moves out of the service opening
- fixed-seed restock plans are identical
- different seeds produce non-identical restock poses
- a multi-prize restock physics regression verifies replacement prizes remain in cabinet bounds and settle below the configured motion thresholds

Important contract:
- no existing prize is teleported or kinematically carried
- no staff action applies a hidden winning impulse
- no restock placement targets the chute
- no restock placement is selected from a “best win” policy
- the physical pile is allowed to rearrange only through gravity and collisions

## Slice 5 — close / depart / reopen / repeat

Implemented:
- restock completion is the only trigger that authorizes door closing
- staff transitions deterministically:
  - `door_open`
  - `closing_door`
  - `departing`
  - `hidden`
- the visible service panel and real kinematic service-door collider close together
- the machine remains service-paused throughout door closing and staff departure
- controls do not unlock while the physical service opening is still exposed
- after the staff reaches `hidden`, cabinet service calls `completeService()`
- `completeService()` refuses to reopen if the cabinet is still at/below the restock threshold
- successful completion returns `service_paused -> operating`
- normal ChuteSensor payout polling and player controls resume only after reopen
- completed service cycles are counted explicitly
- each service cycle uses a distinct `serviceCycleIndex` in:
  - restock RNG seed
  - replacement prize runtime IDs
- replacement prize IDs therefore remain unique across multiple restocks and cannot collide with ChuteSensor/inventory one-shot accounting
- per-cycle restock tracking is reset after reopen while all physical prize bodies remain in the world
- the next depletion can independently trigger CALL STAFF again

Regression coverage:
- inventory service test completes two independent depletion/restock/reopen cycles
- staff sequence test covers approach -> open -> close -> depart -> hidden
- physical service-door test verifies:
  - collider genuinely opens
  - collider returns to its original closed translation
  - collider returns to its original closed rotation
  - staff is hidden after departure
- existing M06 cabinet containment continues to cover the normal closed-door machine

M10 closure gate PASS:
- automated verification: 53 test files / 163 tests PASS before merge
- main CI PASS after merge
- GitHub Pages deployment PASS
- deployed manual validation PASS on 2026-10-05
- full visible service flow accepted: CALL STAFF -> safe pause -> staff approach -> physical door open -> seeded restock -> settle -> physical door close -> staff depart -> operating
- repeat service cycle accepted

M10 is CLOSED.

### Carry-forward UX backlog

A physical chute win is already detected correctly by the existing ChuteSensor, but normal play still needs an unmistakable player-facing win/output indication. Add visual + text + sound feedback later while keeping ChuteSensor as the sole authoritative win source. This is a UX backlog item, not a physics defect.

---

# Major Visual / Art Uplift

**Status: IMPLEMENTATION COMPLETE CANDIDATE — Art Slices 1–5 on dedicated feature branch; deployed manual visual validation pending**

Primary direction:
- Theme A — Modern Japanese Arcade
- clean white production cabinet
- restrained pastel pink + cyan illumination
- metal trim and controlled glass
- original CLAW CHAOS branding
- professional Japanese prize-center presentation

Theme architecture:
- visual identity is centralized in a reusable theme object instead of scattering cabinet/environment/staff color values through scene code
- planned IDs are reserved for:
  - Modern Japanese Arcade
  - Cute Pastel Prize Shop
  - Futuristic Neon Arcade
  - Premium Retro-Modern
- Theme A is the first implemented preset
- machine, environment and staff palettes are separate theme groups
- runtime URL/theme selection is routed through the theme resolver so later implemented skins do not require gameplay rewrites

## Art Slice 1 — theme architecture + cabinet exterior foundation

Implemented candidate:
- production-style lower cabinet shell and front fascia
- enlarged upper header/marquee structure
- original CLAW CHAOS / PRIZE STATION marquee
- white body with restrained chrome/metal trim
- pastel pink + cyan exterior accent LEDs
- upgraded control deck with visible joystick and action button
- dedicated payment/card/coin panel
- prize retrieval door treatment
- access-panel seam, fasteners and ventilation detail
- existing cabinet frame/glass/chute/deck colors now source from Theme A tokens
- global scene background, hemisphere light and key light source from the environment theme
- existing staff visual now receives a staff-theme palette while preserving the M10 service state machine
- browser smoke exposes and verifies the active visual-theme ID

Physics/gameplay contract:
- all new exterior geometry is visual-only
- no new Rapier collider was added
- M06 cabinet physics geometry is unchanged
- ChuteSensor remains authoritative
- no prize parenting, magnet, weld, teleport carry, kinematic prize carry or hidden pickup force
- Ring, Bridge, chute-adjacent and staff/restocking logic are unchanged

Hard-coded visual audit after Slice 1:
- gantry/bridge/winch/claw material literals were identified for Art Slice 2 migration
- full arcade-room geometry and floor/wall/signage tokens are reserved for Art Slice 3
- staff geometry/detail uplift is reserved for Art Slice 4
- holistic reflection/shadow/performance balancing is reserved for Art Slice 5

## Art Slice 2 — cabinet interior / gantry / lighting

Implemented candidate:
- visual-only interior backdrop inset over the existing physical back wall
- metal interior frame accents around the backdrop
- restrained pink/cyan vertical interior accent lighting
- paired shallow ceiling light diffusers kept inside the existing cabinet envelope
- gantry lab now resolves a visual theme explicitly while retaining a safe default
- gantry rail, moving bridge, carriage, winch drum/flanges, pulley, cable and service-wire colors now come from theme tokens
- claw housing chrome/brushed/band/tip materials now come from theme tokens
- thin pink/cyan decorative claw-housing bands add machine identity without changing claw geometry
- subtle carriage status strips move with the existing carriage visual
- cabinet passes the active Theme A into the generic gantry visual path
- no direct hard-coded metal/material colors remain in the gantry visual construction path

Regression coverage:
- new cabinet-interior visual-only contract test
- interior dressing is required to remain inside the existing cabinet envelope
- no decorative chute part is introduced
- ceiling diffusers remain shallow for aiming clearance
- theme regression now asserts gantry/bridge/carriage/winch/claw/lighting tokens
- existing physics and browser regression suites remain authoritative for gameplay behavior

Physics/gameplay contract:
- no Rapier shape, body, joint, friction, force, torque, movement, reel, timing or chute geometry changed
- new interior parts and decorative accent bands are render-only
- physical claw finger meshes remain bound to the same existing rigid bodies
- ChuteSensor, Ring, Bridge, chute-adjacent gameplay and M10 service/restocking logic are unchanged

## Art Slice 3 — surrounding Japanese arcade environment

Implemented candidate:
- large glossy visual-only arcade floor using the environment floor token
- rear wall and side architectural columns establish a real room around the playable cabinet
- original CLAW CHAOS ARCADE / PRIZE FLOOR back-wall sign
- six lightweight ceiling fixtures with emissive diffusers
- four simplified neighboring crane-machine silhouettes:
  - two near side machines
  - two slightly smaller/farther side machines
  - alternating pink/cyan header accents
  - shared low-cost geometry and materials
- two distant prize-display shelves with simple pastel prize silhouettes
- neighboring machines remain outside the player movement lane and primary cabinet footprint
- environment geometry uses no Rapier bodies or colliders
- environment floor/wall/signage/neighbor-machine/ceiling colors come from environment/theme tokens
- no direct hard-coded hexadecimal material colors remain in the environment construction path
- environment identity is composed from the active theme ID plus a reusable `prize-center-room-v1` variant so later B/C/D skins can reuse the room layout
- cabinet runtime exposes the loaded environment ID for browser smoke validation

Performance approach:
- no environment shadow-casting lights are added
- existing hemisphere/directional/cabinet lighting remains authoritative
- emissive ceiling/signage elements are visual only
- repeated neighboring-machine components reuse geometry/material instances
- background prize meshes use low segment counts
- only the primary playable cabinet keeps full physics fidelity

Regression coverage:
- arcade environment is explicitly marked visual-only
- neighboring machine centers remain at least 1 m off the cabinet centerline
- ceiling structure remains above maximum player eye height
- balanced left/right placement and pink/cyan accent distribution are asserted
- room graph instantiation is tested without physics dependencies
- theme regression covers environment floor/wall/signage/neighbor/ceiling tokens
- cabinet/root browser smoke requires the runtime arcade-environment ID

Physics/gameplay contract:
- no environment collider was introduced
- no player/cabinet/prize/claw physics parameter changed
- camera movement bounds are unchanged
- ChuteSensor, Ring, Bridge, chute-adjacent gameplay and M10 staff/restocking remain unchanged

## Art Slice 4 — adult female arcade staff model uplift

Implemented candidate:
- staff rendering is split from M10 service logic into a replaceable visual-rig module
- active character variant: `adult-female-arcade-attendant-v1`
- adult proportions remain around 1.64 m and professional/non-sexualized
- more detailed head and face:
  - shaped face
  - eyes + pupils
  - brows
  - nose
  - mouth
  - hair cap
  - side locks
  - ponytail + themed hair tie
- upgraded Japanese arcade attendant uniform:
  - blouse front
  - structured uniform torso
  - twin lapels
  - waist trim
  - front apron panel
  - apron trim
  - neck ribbon
  - two-layer name badge
  - skirt, stockings and shoes
- articulated visual rig adds independent:
  - left/right shoulders
  - left/right forearms
  - left/right legs
  - head
- walking now includes opposing shoulder/leg motion plus subtle head movement
- service pose uses a bent right elbow/door-working posture and stationary legs
- all staff material colors come from staff/theme tokens; no direct hexadecimal material colors remain in the character construction path
- the service controller exposes the active character variant so a future GLB/skinned implementation can replace the procedural character without changing the service state machine

Regression coverage:
- staff model is explicitly marked visual-only
- character variant and approximate adult height are asserted
- articulated rig joint names are asserted
- professional uniform and recognizable face/hair details are asserted
- rendered descendants are required to remain visual-only
- existing physical service-door regression still drives the real right-side collider through open/close/return
- browser smoke requires the active staff-character variant in cabinet/root scenes

Physics/service contract:
- `staffServiceSequence` timing/state logic is unchanged
- service approach/open/door-open/close/depart coordinates and timing are unchanged
- physical service-door kinematic translation/rotation formula is preserved
- restock planner, restock physics and inventory service logic are unchanged
- staff character has no Rapier body/collider and cannot interfere with prizes or the player
- ChuteSensor, Ring, Bridge and chute-adjacent gameplay are unchanged

## Art Slice 5 — holistic polish / balance / mobile performance

Implemented candidate:
- desktop/mobile render profiles now control art cost in addition to pixel ratio and key-shadow resolution
- desktop retains the full arcade-room dressing and cabinet PointLight shadows
- mobile uses reduced arcade background dressing:
  - keeps both near neighboring machines
  - omits the two farther neighboring machines
  - omits distant prize-display shelves
- mobile disables the cabinet PointLight cube-shadow pass, avoiding six shadow renders from the local point light
- desktop cabinet PointLight shadow map is reduced from the previous fixed 1024 to a profile-controlled 512
- cabinet PointLight shadow near/far range is constrained to the actual cabinet-light volume
- background arcade architecture and neighboring machines no longer cast directional shadows; the playable cabinet/prizes remain the visual and shadow focus
- ACES Filmic tone mapping is enabled globally with restrained profile-controlled exposure
- directional key-light shadow camera is tightened around the playable machine / near environment instead of spending resolution on empty space
- existing Theme A glass remains intentionally subtle to protect aiming readability
- browser smoke now asserts the final ACES art pipeline in addition to theme/environment/staff identity

Mobile/performance contract:
- physics timestep, Rapier bodies, colliders, joints, grip forces and game state are identical across render profiles
- mobile reductions affect render-only background detail and shadow work
- renderer pixel-ratio cap remains 1.5 on mobile and 2.0 on desktop
- primary cabinet remains full-detail on both profiles
- near environment remains present on mobile so the scene still reads as an arcade rather than an empty lab

Regression coverage:
- render-profile tests lock desktop/mobile background and cabinet-shadow budgets
- reduced arcade-room tests verify far machines/displays are omitted while both near machines remain
- existing full environment, staff, cabinet, physics and layout tests remain authoritative
- cabinet/root browser smoke requires Theme A + arcade room + staff variant + ACES tone mapping

Art uplift exit criteria before merge:
- full CI green
- no physics/gameplay regression
- feature branch remains cleanly based on current `main`
- deployed/manual desktop visual validation
- deployed/manual mobile visual validation
- verify glass does not obstruct aim
- verify background does not compete with prizes/claw
- verify staff scale/service pose reads naturally
- verify acceptable mobile frame pacing during normal play and CALL STAFF

Next action:
1. deploy or otherwise expose this feature branch for manual desktop/mobile visual validation before merging PR #70

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
