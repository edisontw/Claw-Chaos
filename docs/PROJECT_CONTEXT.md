# Project Context

Last updated: 2026-09-30

## Product identity

**Claw Chaos** is a high-fidelity claw machine simulation game.

The primary differentiator is **physics-first authenticity**. The game should feel like operating a real cabinet in front of the glass, not like controlling a generic 3D crane with a hidden win probability.

## Source of truth

- GitHub `main` is authoritative.
- Update this file when a major architectural or gameplay decision changes.
- Do not let temporary implementation convenience silently change the simulation principles.

## Player fantasy

The player should gradually learn to read:

- prize pose,
- center of mass,
- surface friction,
- available contact points,
- claw geometry,
- swing phase,
- machine braking,
- close timing,
- pickup force,
- retaining force,
- neighboring prize support,
- chute geometry.

Expert play should look like physical reasoning rather than memorizing a probability table.

## Core interaction loop

1. Stand in front of the cabinet.
2. Look through the front and side glass.
3. Move/lean slightly to judge depth.
4. Inspect prize pose and surrounding pile.
5. Position or deliberately swing the claw.
6. Press DROP.
7. Optionally press CLOSE while descending.
8. Allow the claw to physically contact, close, settle, and lift.
9. Use or withhold temporary hold boost when that machine/ruleset supports it.
10. Watch the prize remain stable, rotate, slide, fall, collide, or enter the chute.
11. Re-evaluate the new pile state.
12. Ask staff for a legitimate reposition/restock only when allowed by the store policy.

## Camera contract

Normal play uses a first-person cabinet view.

Target movement envelope:

- horizontal head look: at least ±90°, preferred about ±100–110°
- vertical head look: about +30° / -40°
- forward/back body shift: about 35–50 cm
- left/right body shift: about 30–40 cm
- optional lean: about ±15–20 cm

The player may look at side glass, controls, chute, neighboring machines and staff.

Normal play must not provide:
- free-fly camera,
- camera through glass,
- arbitrary overhead camera,
- orbit camera around the prize.

A real cabinet may optionally expose an overhead camera on an in-world monitor.

## Mechanical contract

The simulation must model, directly or by a documented approximation:

- X/Z gantry motion,
- acceleration and braking,
- suspended claw inertia,
- 2D swing in X/Z,
- descent and retract,
- claw hub,
- independently constrained fingers,
- finger close speed,
- close torque,
- pickup force phase,
- retaining/holding force phase,
- optional hold boost,
- release above the chute,
- prize chute sensor.

### Early close ("收爪")

During descent, pressing the action again initiates claw closing immediately.

If the player does not early-close, the machine auto-closes at the configured travel/floor condition.

Closing is motor-driven over time; it is never an instantaneous animation snap.

### Claw swing ("甩爪")

Swing must emerge from:
- gantry acceleration,
- gantry braking,
- suspension length,
- damping,
- claw/prize mass,
- player timing.

There is no "swing skill" button.

Horizontal momentum must be preserved when descent begins.

### Holding force vs guaranteed prize

These are separate systems.

**Retaining / holding force**
- physical motor/joint force that keeps fingers closed during lift and return.

**Hold boost**
- an optional player-operated temporary increase in retaining force.

**Guaranteed prize**
- an operator/ruleset mechanic based on accumulated spend or equivalent policy.
- not the same as hold force.

## Prize simulation contract

Every prize has data for:

- collision geometry,
- mass,
- center of mass,
- inertia,
- static friction,
- dynamic friction,
- restitution,
- material family,
- visual material,
- color/pattern variant.

Plush prizes should initially use compound/articulated rigid bodies. Full soft-body simulation is not required for the initial product.

## Content strategy

Prize content must be combinatorial and data-driven.

Base shape examples:
- cube
- rectangular box
- tall box
- flat box
- sphere
- ellipsoid
- cylinder
- capsule
- cone
- ring
- pillow
- bag
- bottle
- plush humanoid
- plush animal
- irregular toy

Combine with:
- multiple sizes,
- 12+ colors,
- material families,
- mass profiles,
- center-of-mass profiles,
- packaging/accessories.

The first public demo should comfortably exceed 100 visible variants without requiring 100 bespoke high-detail models.

## Machine difficulty philosophy

Never implement "expensive prize = hidden miss chance".

Difficulty should come from real parameters such as:
- prize mass,
- prize dimensions,
- prize friction,
- awkward center of mass,
- claw opening,
- claw geometry,
- lower retaining force,
- shorter pickup/boost duration,
- braking response,
- suspension damping,
- chute/barrier geometry,
- prize placement,
- bridge/ring/edge setups.

Pure Simulation mode keeps the physical parameters fixed.

Commercial Simulation mode may change operator-configurable force/timing parameters according to machine rules, but the final result still comes from physics.

## Staff and restocking

When prizes are depleted, displaced, jammed, or legitimately unreachable, players can call staff subject to store policy.

Staff behavior should be represented in-world:
- walk to machine,
- pause machine,
- open service door,
- reposition/restock,
- close door,
- return machine to service.

Initial implementation may use a short state-machine animation rather than full inverse-kinematic physical handling.

Restocking should use placement seeds followed by rigid-body settling rather than instantly restoring a canonical screenshot-perfect pile.

## Realism priority

Never sacrifice:
1. claw contact,
2. claw force behavior,
3. friction,
4. mass,
5. center of mass,
6. swing,
7. prize pile stability.

Allowed approximations:
- plush deformation → articulated rigid + skinning
- rope → pendulum/suspension constraint
- metal elasticity → joint spring
- package deformation → rigid collision + visual flex
- fur → shader/material response
- glass → PBR/reflection approximation

## Development discipline

Do not start with:
- a large arcade map,
- dozens of cabinets,
- elaborate NPC crowds,
- progression economy,
- licensed-looking prize art,
- operator analytics.

First prove that one gray-box claw interacting with one box, one ball and one teddy is physically convincing.

## Implemented baseline — M00 complete

M00 — Repository & simulation harness was completed and verified on 2026-09-28.

Actual technical stack:
- TypeScript 6
- Vite 8
- Three.js WebGL renderer
- Rapier 3D via `@dimforge/rapier3d-compat`
- Vitest
- ESLint
- GitHub Actions CI with Node.js 22

Runtime baseline:
- canonical units remain meters / kilograms / seconds / radians
- Rapier gravity is `(0, -9.81, 0)`
- physics uses a fixed 120 Hz step
- rendering uses `requestAnimationFrame` independently from physics ticks
- the accumulator permits at most 8 catch-up physics steps per render frame
- excessive backlog is discarded after a 0.25 s frame-delta clamp to prevent spiral-of-death behavior
- initial deterministic scene selection uses `?scene=falling-cube&seed=<value>`
- current debug overlay shows FPS, tick count, simulation time, scene/seed, dynamic body count, and dropped catch-up time

M00 verification:
- `npm ci`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS, including seeded RNG, fixed-step timing, scene selection, and a Rapier fall/settle regression
- `npm run build`: PASS
- production base path `/Claw-Chaos/`: PASS
- `npm run preview` project-subpath/asset smoke: PASS
- headless browser bootstrap through first Rapier + WebGL rendered frame: PASS

M00 ended with these deliberate limitations:
- only `falling-cube` existed at M00 completion
- no render interpolation between fixed physics snapshots yet
- no claw gameplay, prize gameplay, cabinet, staff, economy, NPC, or backend had been introduced

## M01 implementation record — CLOSED

The first **M01 — Claw Physics Laboratory** slice was implemented and CI-verified on 2026-09-28.

Current laboratory baseline:
- `claw-lab` is the default scene; `?scene=falling-cube` remains as the M00 regression scene
- fixed rigid claw hub
- three independent dynamic finger rigid bodies
- three Rapier revolute joints with independent limits
- fixed-tick open/close motor command ramp
- configurable motor stiffness, damping, maximum torque, finger density and friction
- engineering controls: `C` close, `O` open, `Space` toggle
- `D` toggles Rapier collider debug lines
- visible joint pivot/axis diagnostics
- no prize parenting, hidden weld, or pickup-success logic

Verification:
- 11 automated tests PASS
- revolute motor movement and independent idle-finger behavior are regression-tested
- lint/build/base-path/headless WebGL smoke PASS
- GitHub Pages deployment workflow is active on `main`
- public target remains `https://edisontw.github.io/Claw-Chaos/`

### M01 geometry refinement — complete

The first mechanical slice was followed by a realistic-geometry refinement on 2026-09-28:

- blocky hub visuals replaced with a stacked cylindrical motor housing and lower collar
- each finger remains one independent rigid body and one revolute joint
- straight bar finger replaced by a three-segment outward sweep with an inward hook tip
- each finger uses three capsule colliders attached to the same rigid body
- visible rod centerlines follow the same segmented path as the physics colliders
- provisional geometry is centralized in `CLAW_LAB_CONFIG`
- calibration-ready reference values are documented in `docs/CLAW_GEOMETRY_BASELINE.md`
- the reference dimensions are engineering approximations inferred from supplied real-claw images, not measurements of a named commercial machine
- automated geometry tests cover path length, rod diameter and open/closed tip-span envelope

Current provisional geometry:
- motor housing OD 90 mm
- lower collar OD 110 mm
- pivot radius 50 mm
- finger rod diameter 9 mm
- segmented finger path about 246 mm
- open tip span about 348 mm in command-space geometry
- open/closed targets +0.35 / -0.42 rad

### Open-angle calibration — complete

After visual review against common commercial 3-prong claws, the open target was widened before PT-002:

- open joint target: +0.22 → +0.35 rad
- approximate open angle: 12.6° → 20.1°
- command-space tip span: about 296 mm → about 348 mm
- closed target remains -0.42 rad
- finger geometry, friction, mass, motor speed, stiffness/damping and max torque remain unchanged
- PT-001 must continue to pass after this calibration

### PT-001 centered ball pickup — automated PASS

The first prize-contact experiment was implemented and CI-verified on 2026-09-28.

Laboratory setup:
- centered dynamic sphere
- radius 55 mm
- mass 80 g
- friction 0.90
- restitution 0.03
- narrow static pedestal under the sphere
- existing three independent segmented fingers/revolute joints
- lab-only kinematic vertical hub motion for pickup verification; this is not M02 suspension/gantry behavior
- `P` runs the deterministic PT-001 sequence: close → settle → lift → hold → result
- collider debug remains available with `D` but is OFF by default

Acceptance regression:
- sphere is not parented to the claw
- sphere has no weld/joint to the claw
- sphere remains a dynamic rigid body
- automated integration test requires the sphere to rise by at least 0.08 m from its centered reference height
- lint/tests/build/base-path/headless claw-lab smoke PASS
- total automated tests after this slice: 15 PASS

### PT-002 slip under reduced retaining force — automated PASS

PT-002 was calibrated after testing two candidate mechanisms.

Observed calibration behavior:
- friction-only sweeps with the current centered sphere/claw geometry were strongly thresholded: lower friction values produced almost no pickup, while higher values produced stable capture with almost no slip
- static retaining-torque sweeps showed the same two-state behavior
- the accepted lab approximation therefore uses an explicit **PICKUP → RETAINING** force transition, which is already part of the mechanical contract

PT-002 baseline:
- sphere geometry, mass, friction and restitution are unchanged from PT-001
- close/pickup torque: 2.5 N·m
- pickup phase continues through the first 0.06 m of lab lift
- retaining torque after that point: 0.003 N·m
- automated run reaches about 0.048 m peak ball lift, then physically slips back near the pedestal
- PASS requires peak lift >= 0.03 m, slip loss >= 0.04 m, final lift <= 0.03 m
- no prize transform, parenting, weld, joint, kinematic prize state or scripted release is used

The alternate experiment is selected with `?scene=claw-lab&experiment=pt002`; press `P` to run it. PT-001 remains the default claw-lab experiment.

### PT-003 off-center box rotation — automated PASS

PT-003 is isolated at `?scene=claw-lab&experiment=pt003`.

Baseline:
- dynamic box: 0.13 × 0.08 × 0.07 m
- mass: 0.12 kg
- friction: 0.65
- COM: geometric center, marked visibly in yellow
- box center is offset 0.04 m from the claw center
- support footprint: 0.03 × 0.03 m, centered under the COM
- passive rotation before contact is effectively zero
- calibrated contact-driven peak rotation is about 0.122 rad (~7°)
- box remains supported instead of passing by simply falling/tumbling
- no scripted angular motion or hidden prize-claw constraint is used

PT-003 calibration also established that a 0.024 m support footprint was too unstable and caused near-180° tumble, while 0.040 m nearly locked the box; 0.030 m produced a stable and readable off-center rotation.

### PT-004 teddy limb hook — automated PASS

PT-004 is isolated at `?scene=claw-lab&experiment=pt004`.

Implementation:
- Tier A plush approximation: one dynamic rigid body with compound head/torso/arm/paw/leg colliders
- Teddy begins in a lying pose and settles physically before the test starts
- mass 0.090 kg, friction 0.75
- calibrated Teddy center offset: -0.055 m
- calibrated hook target: -0.40 rad
- close lead before lift: 0.16 s
- cyan marker identifies the intended right paw/forearm hook region
- yellow marker shows the compound-body origin/COM reference
- scene and integration test share the same Teddy collider definition

Verified behavior:
- peak lift about 0.045 m
- lift remains above the 0.035 m threshold for about 0.492 s
- peak rotation about 0.478 rad (~27.4°) relative to the settled starting pose
- hanging remains asymmetric rather than snapping to the claw center
- Teddy can settle back onto the support after losing contact
- no hook state, attachment, weld, prize joint, transform override, or scripted release

### PT-005 blocked finger — automated PASS

PT-005 is isolated at `?scene=claw-lab&experiment=pt005`.

Implementation:
- one static rigid cuboid blocker intersects only the +X finger's close path
- each finger remains a separate dynamic body with its own Rapier revolute joint
- all three joints receive the same close command and motor-force parameters
- the result is measured from actual rigid-body angular travel from the open reference pose
- no per-finger scripted stop or final-angle override is used

Verified behavior:
- blocked finger travel: about 0.000 rad
- free finger 1 travel: about 0.314 rad
- free finger 2 travel: about 0.314 rad
- free fingers therefore continue closing independently while the contacted finger remains physically blocked
- regression thresholds require both free fingers >= 0.25 rad, blocked finger <= 0.22 rad, and at least 0.06 rad separation
- collision remains authoritative; there is no penetration bypass or synchronized three-finger snap

### M01-E06 oversized-object close — automated PASS

The sixth required M01 experiment is isolated at `?scene=claw-lab&experiment=oversized`.

Implementation:
- centered dynamic box, 0.14 × 0.08 × 0.14 m
- mass 1.20 kg, friction 0.90
- narrow pedestal keeps the prize centered without becoming the primary blocker
- matched control and oversized-prize runs use the same claw, motor command and timing
- acceptance measures actual finger-body angular travel from the settled open pose
- a separate check verifies the oversized prize does not materially prevent the claw from first reaching the open pose

Verified behavior:
- control open travel ≈ 0.083 / 0.083 / 0.083 rad
- oversized open travel ≈ 0.070 / 0.070 / 0.070 rad
- control close travel ≈ 0.241 / 0.240 / 0.240 rad
- oversized close travel ≈ 0.052 / 0.001 / 0.001 rad
- the prize remains centered to within roughly 0.1 mm X/Z drift in the calibrated regression
- contact, not a scripted angle clamp, prevents nominal full closure

All six required M01 physics experiments are now automated PASS.

### M01 final closure — 2026-09-29

**Status: CLOSED**

Generic mass-properties debug tooling is now part of the shared debug architecture:
- `M` toggles COM/origin visualization independently of collider debug `D`
- yellow shows Rapier `worldCom()`
- magenta wireframe shows the rigid-body transform origin
- a line connects them when they differ
- the renderer reads `localCom()` / `worldCom()` from Rapier and never mutates simulation state
- sphere, PT-003 box, compound Teddy and oversized prize use the same registration mechanism
- PT-003/PT-004 prize-specific COM markers were removed
- the Teddy cyan hook-target marker remains because it is a geometry target, not a COM proxy

Final closure audit:
- blocked finger stops physically while free fingers continue — PASS
- no prize attachment/parenting/weld — PASS
- weak retaining force produces physical slip — PASS
- off-center box rotates from contact torque — PASS
- Teddy hook succeeds through geometry alone — PASS
- oversized prize prevents nominal full close through collision — PASS
- contact-heavy oversized regression remains finite and bounded — PASS
- reusable COM/origin visualization — PASS
- Rapier collider debug remains available — PASS

Final verification baseline:
- 29 automated tests PASS
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- headless Rapier/WebGL smoke PASS
- GitHub Pages deployment PASS after merge

## M07 implementation status — slice 1 verified 2026-10-02

**Status: IN PROGRESS**

First-person player rig:
- active only in `cabinet-lab`
- pointer-lock mouse look
- yaw ±105°
- pitch −40° / +30°
- fixed eye height 0.98 m
- player movement envelope X ±0.62 m / Z 0.484–0.82 m
- front glass outer face Z = 0.384 m; minimum camera-center clearance = 0.10 m
- WASD movement, Q/E lean
- max lean 55 mm / max roll 4°
- no free-fly or vertical movement
- F3 collider debug in cabinet player view; non-player scenes retain legacy D debug
- machine controls remain independent

Acceptance:
- PT-025 yaw/pitch/movement/lean automated constraints — PASS
- PT-026 front-glass clearance and bounded/no-free-fly motion — PASS
- browser cabinet smoke initializes the M07 player controller and requires `Player view` debug output
- M01–M06 physics and result/inventory behavior unchanged
- **29 test files / 72 tests PASS** on first-slice verification

Pending:
- manual front/side visual-depth check
- control-panel/chute look-down framing and interaction
- final camera-integrity audit before M07 closure

## Current next step

Continue **M07 slice 2** with player-view usability rather than physics changes: verify useful side-glass depth inspection at the current ±105°/bounded movement envelope, add look-down control-panel/chute interaction framing, and keep all camera motion outside the physical cabinet.

## Design-review additions

The 2026-09-28 second-pass review identified and formalized several previously under-specified areas:

- machine-specific control profiles rather than one universal joystick scheme,
- finite aim timers and complete credit/play lifecycle,
- explicit physical return/home/release path,
- passive claw yaw/torsion and reel limits,
- machine faults/service recovery,
- fixed-tick input/replay diagnostics,
- real-machine calibration/measurement methodology,
- asset licensing/provenance,
- GitHub Pages/Web deployment and performance constraints.

Read:
- `docs/CALIBRATION_PLAN.md`
- `docs/DEPLOYMENT.md`

These additions are part of the baseline design, not optional polish.
