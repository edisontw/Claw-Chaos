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

## Current next step

Proceed to **M02 — Gantry & Suspended Claw**. Do not alter the closed M01 physics invariants when adding gantry motion, suspension, swing, descent, lift, return, and release behavior.

## M02 implementation status — slice 1 complete

M02 — Gantry & Suspended Claw started on 2026-09-30 from the closed M01 baseline.

Implemented:
- `gantry-lab` is now the default public/development scene
- fixed-step X/Z carriage controller
- explicit max speed, acceleration, braking/deceleration, and rail limits
- position-based kinematic carriage body
- dynamic claw hub
- fixed-length 0.31 m suspension through a Rapier spherical joint
- stiff, strongly damped horizontal suspension response layered on the spherical length constraint
- spring stiffness 55 N/m, damping 8.5 N·s/m, corrective-force clamp 4 N
- M01 three independent dynamic fingers and revolute joints reused on the suspended hub
- visual suspension cable follows the same hub orientation implied by the physical pendulum
- Arrow-key manual X/Z movement
- `P` deterministic PT-006 accelerate → hard brake → observe sequence
- existing `D` collider debug and `M` COM/origin debug remain available

PT-006 automated baseline:
- acceleration lag: about 0.0035 m
- forward swing after braking: about 0.011 m
- peak swing angle: about 0.036 rad (~2.1°)
- suspension distance: 0.310003 m against 0.310 m target
- carriage reaches zero X velocity after braking
- residual horizontal offset after the braking observation: < 0.001 mm
- finite/bounded stability gate: PASS
- no rigid-lock or transform parenting is used

Verification:
- 36 automated tests PASS after the stiff-suspension refinement
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- headless `gantry-lab` WebGL smoke PASS

These motion values are provisional laboratory behavior, not measured manufacturer calibration.

### M02 slice 2 — variable reel / DROP-LIFT / PT-008

Implemented on 2026-09-30:
- collider-free kinematic reel anchor follows the gantry in X/Z
- reel payout changes only through a fixed-step velocity controller
- payout range: 0.00–0.28 m
- reel max speed: 0.28 m/s
- reel acceleration: 0.9 m/s²
- reel braking: 1.4 m/s²
- limit-aware braking reduces speed before upper/lower reel limits
- dynamic claw hub remains attached to the reel anchor through the existing 0.31 m Rapier spherical constraint
- horizontal spring/damping remains active during descent and lift
- `Space` toggles manual DROP/LIFT
- `T` runs deterministic PT-008
- visible cable extends from carriage guide to the dynamic hub
- no hub teleport, parent-to-carriage transform, or discontinuous cable-length assignment is used

PT-008 automated baseline:
- physical descent: about 0.2802 m
- maximum horizontal offset during descent: about 0.0102 m
- horizontal speed before DROP: about 0.00581 m/s
- first DROP-tick horizontal speed: about 0.01195 m/s
- horizontal velocity is therefore not cleared by DROP; phase dynamics may increase it
- bottom payout: 0.280 m
- physical lift back to top: about 0.2800 m
- final payout: 0.000 m
- spherical suspension distance after lift: about 0.3100 m
- descent and lift each complete in about 146 fixed ticks (~1.22 s)
- finite/bounded stability gate: PASS

### M02 open-finger transport rigidity refinement

Visual review found that the suspended hub motion was realistic but the three open finger links still looked too compliant during gantry acceleration and hard braking. This was isolated from the closed M01 grasp/contact behavior.

M02-only OPEN/transport profile:
- motor stiffness: 2400
- motor damping: 160
- max motor torque: 20.0 N·m
- finger angular damping: 8.0
- M01 contact/closing profile remains unchanged at stiffness 180 / damping 18 / max torque 2.5 N·m

Automated transport-rigidity regression:
- measures each finger's rotation relative to the moving hub, not world-space claw swing
- first stronger-hold attempt still allowed ~0.079 / 0.042 / 0.042 rad peak flex and was rejected
- final calibrated peaks: ~0.0348 / 0.0189 / 0.0191 rad
- acceptance ceiling: 0.035 rad (~2.0°) per finger
- PT-006 suspension metrics and PT-008 DROP/LIFT metrics remain unchanged

Verification after slice 2 + transport refinement:
- 41 automated tests PASS
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- headless `gantry-lab` WebGL smoke PASS

### M02 slice 3 — lift completion / physical home return

Implemented on 2026-09-30:
- reel-top completion is detected only after payout reaches the upper limit and reel velocity settles
- manual LIFT reaching the top transitions into `RETURNING_HOME`
- `H` can start the same home-return path when the reel is already at the top
- RETURNING_HOME locks conflicting DROP/test triggers until the return finishes
- X/Z return uses a braking-aware fixed-step target controller built on the same gantry speed/acceleration/braking limits
- configured provisional mechanical home: X=0, Z=0
- home completion tolerance: 3 mm position and 0.02 m/s axis velocity
- dynamic hub, spherical suspension, stabilizer and finger joints remain active throughout return
- no carriage/hub teleport, snap-to-home transform, or residual-velocity clearing is used

Automated lift-to-home regression:
- starts about 0.3167 m off home before DROP/LIFT
- physical DROP: 146 ticks
- physical LIFT: 146 ticks
- residual hub horizontal speed at return start: about 0.4208 m/s in the stress regression
- residual hub offset at return start: about 3.33 mm
- max hub/carriage relative offset during return: about 10.74 mm
- physical return distance: about 0.3677 m
- max diagonal carriage movement per fixed tick: about 5.30 mm, within the 0.45 m/s per-axis speed envelope
- return completes in 125 ticks (~1.04 s)
- final home error: about 1.76 mm
- final X/Z velocities: about 0.0065 / 0.0139 m/s
- final reel payout: 0.000 m
- final spherical suspension distance: about 0.3100 m
- finite/bounded stability gate: PASS

### M02 final closure — 2026-09-30

**Status: CLOSED**

Closure audit:
- X/Z carriage with explicit speed/acceleration/braking limits — PASS
- rail-limit handling without energetic bounce — PASS
- dynamic claw suspended without rigid transform lock — PASS
- realistic small hard-stop swing and fast recentering — PASS
- OPEN transport fingers remain mechanically stiff while M01 contact compliance is preserved — PASS
- variable reel payout with bounded acceleration/braking — PASS
- DROP preserves horizontal momentum — PASS
- full physical LIFT to top — PASS
- automatic lift-completion transition — PASS
- physical carriage return/home path — PASS
- residual swing remains physical during return — PASS
- fixed 120 Hz stability and finite/bounded transforms — PASS
- no prize/claw parenting, hidden weld, scripted success/failure, or normal-play teleport introduced — PASS

Final M02 verification baseline:
- 43 automated tests PASS
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- headless `gantry-lab` WebGL smoke PASS

Full prize-carry return/release/chute lifecycle acceptance remains for later gameplay/cabinet phases; M02 closes the mechanical gantry/suspension/reel/home-return substrate required by those tests.

## M03 implementation status — slice 1 verified 2026-09-30

**Status: IN PROGRESS**

PT-007 lateral swing amplification is now automated and PASS.

Current M03-compatible mechanical calibration:
- horizontal suspension spring: 170 N/m
- horizontal damping: 1.0 N·s/m
- corrective-force clamp: 4 N
- OPEN/transport-only finger hold: stiffness 6000, damping 340, max torque 50
- M01 grasp/contact motor semantics remain unchanged

Measured PT-007 timing response:
- 0.30 s reversal half-period decays from about 11.86 mm to 8.41 mm
- 0.40 s reversal half-period grows from about 20.86 mm to 24.17 mm (+15.9%)
- 0.42 s also grows to about 22.53 mm
- 0.46 s decays slightly
- 0.40 s peak angle is about 0.078 rad (~4.5°)
- finite/bounded stability PASS at 120 Hz

The same calibration revalidates the closed M02 gates:
- PT-006 lag ≈ 3.03 mm, forward swing ≈ 15.22 mm, peak angle ≈ 0.049 rad
- OPEN finger transport maximum deflection ≈ 0.03272 rad (< 0.035 rad gate)
- PT-008 physical DROP/LIFT and horizontal-momentum preservation — PASS
- physical lift-completion → home return — PASS
- no transform parenting, direct swing-angle injection, or hidden swing force introduced

The committed suite contains **44 automated tests** after removing calibration-only exploration files.

## M03 implementation status — slice 2 verified 2026-10-01

Front/back and diagonal swing now have dedicated physical regressions with no production-physics changes.

Measured directional response:
- Z-axis 0.40 s half-period: early peak ≈ 20.86 mm → late peak ≈ 24.17 mm (+15.9%)
- Z-axis off-cadence 0.30 s: early peak ≈ 11.86 mm → late peak ≈ 8.41 mm (decays)
- synchronized X/Z 0.40 s diagonal: early resultant ≈ 31.16 mm → late resultant ≈ 34.05 mm
- diagonal late component peaks: X ≈ 24.08 mm, Z ≈ 24.08 mm
- diagonal peak swing angle ≈ 0.110 rad (~6.3°)
- maximum measured suspension-length error ≈ 0.000003 m (~0.003 mm)
- all transforms and motion states remain finite/bounded

Regression status:
- left/right swing — PASS
- front/back swing — PASS
- diagonal swing — PASS
- timing-sensitive amplification — PASS
- off-cadence decay — PASS
- PT-006/PT-007/PT-008/home-return gates — preserved
- production M01 grasp/contact and M02 mechanics — unchanged
- automated suite — **46 tests PASS**

## M03 implementation status — slice 3 / final closure verified 2026-10-01

**Status: CLOSED**

The final M03 regression builds a diagonal swing using only the existing 0.40 s X/Z reversal cadence, then starts physical DROP while the swing still has both meaningful displacement and relative horizontal velocity.

Measured amplified-descent response:
- pre-DROP diagonal resultant peak ≈ 34.05 mm
- DROP trigger state: X/Z offsets ≈ 9.85 / 9.85 mm; resultant ≈ 13.94 mm
- DROP trigger relative horizontal speed ≈ 0.191 m/s
- world horizontal speed at DROP start ≈ 0.625 m/s
- first DROP tick world horizontal speed ≈ 0.694 m/s; retention ratio ≈ 1.11
- first DROP tick relative horizontal speed ≈ 0.301 m/s
- physical descent ≈ 0.28029 m over 146 fixed ticks
- max descent X/Z offsets ≈ 21.55 / 21.55 mm
- max descent resultant ≈ 30.47 mm
- hub horizontal travel from DROP start ≈ 61.69 mm
- bottom payout = 0.280 m
- maximum suspension-length error ≈ 0.0000030 m (~0.003 mm)
- final suspension distance ≈ 0.3100001 m
- finite/bounded stability PASS

M03 closure audit:
- preserved horizontal momentum — PASS
- lateral swing — PASS
- front/back swing — PASS
- diagonal swing — PASS
- phase-building through reversals — PASS
- wrong cadence decays rather than receiving scripted energy — PASS
- descent while amplified swing remains active — PASS
- no special swing button — PASS
- no angle/velocity injection, hidden swing force, transform parenting, or descent-time state reset — PASS
- PT-006/PT-007/PT-008/home-return regressions — PASS
- M01 grasp/contact semantics — unchanged
- full suite — **47 automated tests PASS**

## M04 implementation status — slice 1 verified 2026-10-01

**Status: IN PROGRESS**

Implemented:
- explicit play-cycle states: READY → DESCENDING → CLOSING → CLOSED_AT_DEPTH
- first action starts physical DROP through the existing reel controller
- second action during DESCENDING triggers EARLY CLOSE immediately
- no second action triggers AUTO CLOSE at 0.275 m configured travel
- finger target still advances only through the fixed 120 Hz motor-command ramp
- closing switches from the M02 OPEN transport profile back to the unchanged M01 contact motor profile
- gantry aiming input is locked after DROP begins
- PT-006/PT-008 test paths are isolated from an active M04 cycle

Measured regression:
- EARLY CLOSE action at payout ≈ 0.10227 m
- close command completes in 58 ticks ≈ 0.4833 s
- reel continues descending while the claw closes, reaching ≈ 0.23760 m at close completion
- AUTO CLOSE transition occurs at payout ≈ 0.27562 m
- automatic path reaches max payout 0.280 m
- close target reaches -0.42 rad through normal command progression
- full suite: **49 automated tests PASS**

Not yet implemented in M04:
- close-settle timer
- automatic physical lift after close
- PICKUP torque phase
- RETAINING torque phase
- HOLD BOOST
- full return/release lifecycle

## M04 implementation status — slice 2 verified 2026-10-01

Implemented:
- CLOSED_AT_DEPTH now has a dedicated fixed-step settle window before reel reversal
- settle baseline = 0.90 s, intentionally aligned with the proven M01 close/contact stabilization window
- after settle, reel command reverses physically into PICKUP
- PICKUP begins from the physical payout present after close/settle; no snap to a lift start position
- after 0.06 m of physical reel recovery the force phase changes to RETAINING
- CLOSE/PICKUP currently share the proven M01 2.5 N·m contact torque while remaining separate state-machine phases
- RETAINING uses the existing calibrated 0.003 N·m weak torque
- reel continues physically to payout 0 under RETAINING
- production debug reports play phase, force phase, phase time, pickup-start payout and active motor torque

Measured controller regression:
- auto-close completes at payout 0.280 m
- close-settle transition = 109 fixed ticks ≈ 0.908 s
- PICKUP → RETAINING = 44 ticks ≈ 0.367 s
- physical reel recovery at transition ≈ 0.06027 m
- RETAINING starts at payout ≈ 0.21973 m

Physical prize regression:
- uses the M01 sphere/material/contact parameters with a 15 mm higher support placement calibrated for the suspended M04 claw; this is regression-scene placement, not a production prize rule
- peak physical ball lift ≈ 0.04365 m
- lift still present at RETAINING start ≈ 0.02156 m
- weak-force slip loss ≈ 0.04445 m
- final lift ≈ −0.00080 m, i.e. returns near support rather than falling to the floor
- final reel payout = 0.000 m
- maximum suspension-length error ≈ 0.000056 m
- finite/bounded PASS
- no prize attachment, weld, kinematic prize state, teleport, scripted drop, or motion reset
- full suite: **51 automated tests PASS**

## M04 implementation status — slice 3 / final closure verified 2026-10-01

**Status: CLOSED**

Implemented:
- prototype HOLD BOOST input is hold `Shift`
- BOOST is eligible only during RETAINING and RETURNING
- base RETAINING torque remains 0.003 N·m
- calibrated HOLD BOOST torque = 0.010 N·m
- BOOST has a maximum 0.80 s actual-use budget per play cycle; time is consumed only while BOOST is active
- reel-top completion moves the M04 state machine from RETAINING → RETURNING
- RETURNING reuses the same braking-aware M02 gantry target controller; the carriage is not teleported
- reaching the home position/velocity tolerance moves RETURNING → RELEASING
- RELEASING opens the physical finger motor from -0.42 rad toward +0.35 rad at the existing 1.6 rad/s command rate
- the machine returns to READY only after the open target is physically reached

Measured HOLD BOOST regression:
- near-slip sphere with no BOOST: lift at 0.4 s after RETAINING ≈ -0.000064 m
- same sphere with 0.010 N·m BOOST: lift at 0.4 s ≈ 0.019257 m
- at the 0.80 s BOOST limit the prize has returned to ≈ -0.002071 m relative lift and continues to fall under the base retaining force
- PICKUP → RETAINING prize speed remains continuous: ≈ 0.19819 → 0.19436 m/s across the state transition
- no prize velocity clear/reset occurs

Measured lifecycle regression:
- reel top → RETURNING at fixed tick 63
- RETURNING → RELEASING at tick 149
- home-position error at release ≈ 0.001834 m
- physical opening takes 58 ticks ≈ 0.4833 s
- READY is reached at tick 206 only after finger command reaches +0.35 rad
- final payout = 0.000 m
- no prize attachment, weld, hidden hold joint, normal-play teleport, or state-transition velocity reset
- full suite: **54 automated tests PASS**
- lint/build/GitHub Pages base-path/headless `gantry-lab` smoke PASS

M04 closure scope:
- the pre-cabinet mechanical play cycle is complete
- full carried-prize return to a modeled chute, chute-edge collision, chute sensor, and prize-out validation remain later M05/M06 acceptance work and are not claimed complete here

## M05 implementation status — final closure verified 2026-10-01

**Status: CLOSED**

Prize content architecture:
- `src/prizes/` remains the data-driven prize runtime
- PrizeFactory is the single normal spawn path for M05 prize gameplay entities
- 11 starter definitions are implemented:
  - cube
  - box
  - tall box
  - flat box
  - sphere
  - ellipsoid
  - cylinder
  - capsule
  - pillow
  - simple Teddy
  - simple animal
- pillow / Teddy / animal are stable compound primitive profiles, not separate gameplay classes
- five reusable material profiles
- three mass profiles: light / standard / heavy
- five COM profiles: centered / bottom-heavy / top-heavy / left-offset / right-offset
- explicit Rapier total mass, local COM and principal inertia remain separate from collider topology
- colliders contribute zero extra mass on the PrizeFactory path
- 8 colors × 2 finishes × 11 definitions enumerate **176 unique valid visible variants**
- deterministic variant seeds remain supported
- `?scene=prize-lab` displays all 11 definitions while `gantry-lab` remains the default scene

Behavioral differentiation:
- PT-021 material regression, same box and initial condition:
  - plastic travel ≈ 0.124198 m
  - rubber travel ≈ 0.092227 m
  - difference ≈ 0.031971 m
  - both physically stop
- mass-profile regression under the same 0.03 N·s impulse:
  - light mass ≈ 0.090 kg → x speed ≈ 0.333333 m/s
  - heavy mass ≈ 0.162 kg → x speed ≈ 0.185185 m/s
- PT-022 COM regression under the same impulse through the visual/geometric center:
  - centered COM: rotation = 0, peak angular speed = 0
  - left-offset COM: local COM X ≈ -0.01890 m
  - resulting rotation ≈ 0.403848 rad
  - peak angular speed ≈ 1.615396 rad/s

PT-015 dense pile:
- 12 dynamic PrizeFactory prizes
- contact-bounded pile reaches all-sleep state in ≈ 2.3167 s
- then runs another 60 simulated seconds
- maximum post-settle drift = 0
- maximum post-settle speed = 0
- final sleeping bodies = 12 / 12
- finite/bounded PASS

M05 exit audit:
- prize creation is data-driven — PASS
- same shape can behave differently by material — PASS
- same shape can behave differently by mass — PASS
- same shape can behave differently by COM — PASS
- no prize-specific grab code — PASS
- 10–15 object pile can settle and remain stable — PASS
- formal 100+ visual variant enumeration — PASS, 176
- closed M01–M04 force/suspension/play-cycle calibration remains unchanged

Final verification:
- **62 automated tests PASS**
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- browser `gantry-lab` smoke PASS

Approximation note:
- M05 provides physics-ready primitive/compound prize archetypes and basic color/finish variation, not final art production
- future texture/pattern art is cosmetic content expansion and does not require new grab/success logic

## M06 implementation status — slice 1 verified 2026-10-01

**Status: IN PROGRESS**

Implemented foundation:
- new shared `src/cabinet/` module
- cabinet/play-area collision shell:
  - X interior half-width = 0.46 m
  - Z interior half-depth = 0.36 m
  - physical floor, glass/front/side boundaries, back wall and ceiling
- existing M02 carriage envelope remains fully inside the cabinet legal bounds
- floor is split around a real chute opening rather than using a visual-only hole
- enclosed physical chute walls and bottom catch surface
- chute sensor is a non-contact observation volume and therefore cannot push or support prizes
- chute sensor records a prize only when its real Rapier world COM enters the configured sensor volume
- each prize ID can generate at most one win event
- `?scene=cabinet-lab` renders the same cabinet geometry with transparent glass, a basic control panel, cabinet light, green sensor-volume debug and PrizeFactory prizes
- `gantry-lab` remains the default scene; no M01–M05 claw/force calibration changed

Acceptance:
- cabinet containment regression:
  - peak |X| ≈ 0.407590 m
  - peak |Z| ≈ 0.307604 m
  - all bodies remain finite/bounded inside the physical shell
- PT-017 chute edge:
  - flat box physically settles across the chute opening
  - final Y ≈ 0.022487 m
  - minimum COM Y ≈ 0.022045 m
  - sensor events = 0
  - sensor wins = 0
- PT-018 chute win:
  - small cube falls physically through the opening
  - first sensor entry = fixed tick 33 ≈ 0.275 s
  - event count = 1
  - sensor win count = 1
  - final cube Y ≈ -0.252569 m on the lower chute catch
  - continued polling cannot create a duplicate win

Verification:
- **66 automated tests PASS**
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- browser `gantry-lab` smoke PASS

Scope still pending:
- the M02–M04 gantry/claw is not yet mounted inside the cabinet scene
- physical RETURN target is not yet moved to the real chute position
- a physically carried prize has not yet been returned and released into the chute
- end-to-end result/inventory state is not yet connected to the M04 play lifecycle
- glass readability is represented by a conservative transparent material but still needs manual/play-view acceptance after first-person camera integration

## Current next step

Continue **M06 slice 2** by integrating the existing gantry/claw/play-cycle into the physical cabinet. Set the physical return/release target over the chute, then add a carried-prize regression proving the prize can swing/slip during RETURN, leaves the fingers through motor-driven release/contact loss, and triggers the chute sensor only after physical entry. Do not teleport the claw or prize and do not let sensor state pull the prize into the chute.

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
