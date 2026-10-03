# Acceptance Tests

Version: 0.3  
Date: 2026-09-29

## 1. Purpose

These tests define observable behavior. Automated tests should cover what can be measured reliably; visual/manual checks cover the rest.

Tolerance values will be calibrated after the first physics prototype.

## 2. Core invariants

Every build must preserve:

- no normal-play prize parenting to claw,
- no hidden pickup weld,
- no hidden success roll in Pure Simulation,
- no prize teleport during active play,
- fixed physics timestep,
- prize result produced by contacts/forces,
- horizontal claw momentum preserved during descent,
- force phases remain separate.

## 3. PT-001 Centered ball pickup

Setup:
- 3-prong claw
- centered sphere
- moderate/high friction
- adequate close/pickup/retaining torque

Expected:
- 3 fingers contact sphere,
- sphere rises,
- remains physically supported,
- no hidden attachment.

Pass:
- sphere reaches target lift height without solver instability.

Implementation status — 2026-09-28:
- **Automated PASS**
- current lab sphere: radius 0.055 m, mass 0.080 kg, friction 0.90
- lab-only hub lift command: 0.18 m
- regression requires sphere lift delta >= 0.08 m
- sphere remains a dynamic rigid body with no parent, weld, or claw-prize joint
- manual visual realism check remains useful on the deployed build via `P`

## 4. PT-002 Low-friction ball slip

Change only:
- lower sphere/claw contact friction or retaining force.

Expected:
- sphere initially rises or is pinched,
- contact gradually migrates,
- sphere visibly slides and falls.

Fail:
- instant scripted drop at a state boundary,
- sphere remains unnaturally locked.

Implementation status — 2026-09-28:
- **Automated PASS via the allowed lower-retaining-force route**
- PT-001 sphere geometry/material remains unchanged: radius 0.055 m, mass 0.080 kg, friction 0.90
- close/pickup torque remains 2.5 N·m
- after 0.06 m of lab lift, PT-002 switches only the motor max torque to a retaining value of 0.003 N·m
- calibrated regression produces about 0.048 m peak sphere lift and then physical loss of support back near the pedestal
- pass requires peak lift >= 0.03 m, slip loss >= 0.04 m, and final lift <= 0.03 m
- the sphere remains dynamic and has no parent, weld, hidden release, or claw-prize joint
- friction-only calibration was tested first: the current sphere/claw geometry showed a sharp threshold (roughly no lift below the useful range, stable capture above it), so no friction value was selected merely to force the expected result
- manual visual check is available at `?scene=claw-lab&experiment=pt002`, then press `P`

## 5. PT-003 Off-center box rotation

Setup:
- rectangular box,
- claw offset from COM.

Expected:
- closing/lift creates torque,
- box rotates,
- box may stabilize, slip, or fall depending on forces.

Fail:
- box always remains axis-aligned with world or claw.

Implementation status — 2026-09-29:
- **Automated PASS**
- box size: 0.13 × 0.08 × 0.07 m
- mass: 0.12 kg
- friction: 0.65
- COM: geometric center; generic `M` debug reads Rapier's actual `worldCom()` and shows it in yellow, with rigid-body origin in magenta
- claw center is offset 0.04 m from the box COM
- support footprint is 0.03 × 0.03 m and centered under the box COM
- passive rotation before claw interaction is effectively 0
- calibrated peak rotation is about 0.122 rad (~7°)
- regression requires peak rotation >= 0.10 rad while the box remains on the support rather than simply tumbling to the floor
- no scripted rotation, prize parenting, weld, or claw-prize joint
- manual visual test: `?scene=claw-lab&experiment=pt003`, then press `P`

## 6. PT-004 Teddy limb hook

Setup:
- compound teddy,
- one claw tip hooks arm/neck/leg geometry.

Expected:
- teddy can hang asymmetrically,
- body rotates below hook,
- contact can later fail naturally.

Fail:
- hook impossible despite valid geometry,
- entire teddy snaps rigidly to claw center.

Implementation status — 2026-09-29:
- **Automated PASS**
- plush approximation: Tier A single dynamic rigid body with compound colliders
- collider parts: head, torso, articulated-looking upper/forearms, paws, and legs
- mass: 0.090 kg
- friction: 0.75
- initial pose: lying teddy (X rotation = π/2)
- calibrated body offset: -0.055 m from claw center
- hook target: -0.40 rad
- close lead before lift: 0.16 s
- right paw/forearm is the intended geometry-only hook region; its cyan marker is a hook target, not a COM proxy
- calibrated peak lift: about 0.045 m
- sustained lift above the 0.035 m threshold: about 0.492 s
- peak rotation relative to settled starting pose: about 0.478 rad (~27.4°)
- final position returns near the support naturally, demonstrating that contact can later fail without a scripted release
- no hook flag, prize parenting, weld, claw-prize joint, or kinematic prize state
- generic `M` debug shows the Teddy's actual Rapier COM separately from its rigid-body origin
- manual visual test: `?scene=claw-lab&experiment=pt004`, then press `P`

## 7. PT-005 Blocked finger

Setup:
- oversized box intersects one finger's closing path.

Expected:
- contacted finger stops/loads,
- other fingers may continue according to joint model.

Fail:
- finger penetrates through box,
- all fingers snap to identical final angle regardless of contact.

Implementation status — 2026-09-29:
- **Automated PASS**
- isolated scene: `?scene=claw-lab&experiment=pt005`
- one static rigid cuboid blocker is placed only in finger 0's (+X) closing path
- all three fingers receive the same motor target, stiffness, damping and max torque
- acceptance is measured from actual rigid-body angular travel relative to the open pose
- calibrated blocked-finger travel: about 0.000 rad
- calibrated free-finger travels: about 0.314 / 0.314 rad
- PASS thresholds: each free finger >= 0.25 rad, blocked finger <= 0.22 rad, and free-minus-blocked separation >= 0.06 rad
- no finger transform override, joint teleport, collision bypass or shared-angle enforcement
- manual visual test: open `?scene=claw-lab&experiment=pt005`, wait for the claw to open, then press `P`

## 7a. M01-E06 Object too large for full close

Setup:
- centered oversized rigid prize,
- prize fits inside the open claw envelope,
- same full-close motor command as the empty control run.

Expected:
- claw reaches a substantially normal open pose before the test,
- closing fingers stop/load on the prize surface,
- all three fingers remain outside their nominal empty-claw close travel,
- prize is not attached or made kinematic.

Fail:
- prize already prevents the claw from reaching the open pose,
- fingers pass through the prize,
- commanded closed angle is forced despite contact.

Implementation status — 2026-09-29:
- **Automated PASS**
- dynamic box size: 0.14 × 0.08 × 0.14 m
- mass: 1.20 kg
- friction: 0.90
- narrow support pedestal radius: 0.025 m
- control open travel: about 0.083 / 0.083 / 0.083 rad
- oversized-prize open travel: about 0.070 / 0.070 / 0.070 rad
- open-pose difference is about 0.013 rad, below the 0.04 rad limit
- control close travel: about 0.241 / 0.240 / 0.240 rad
- oversized-prize close travel: about 0.052 / 0.001 / 0.001 rad
- prize center remains essentially centered after close (X/Z drift below 0.1 mm in the calibrated run)
- acceptance compares blocked travel against a matched empty-control run rather than assuming commanded angle equals actual rigid-body travel
- no finger transform override, prize attachment, kinematic prize state, or collision bypass
- manual visual test: `?scene=claw-lab&experiment=oversized`, then press `P`

## 7b. M01 final closure audit

Implementation status — 2026-09-29:
- **M01 CLOSED**
- all six required M01 physics experiments are automated PASS
- generic COM/origin tooling uses Rapier `localCom()` / `worldCom()`; no scene estimates the COM from mesh origin
- `M` toggles COM/origin debug; `D` independently toggles Rapier collider debug
- yellow = actual world COM
- magenta wireframe = rigid-body origin
- connector = origin-to-COM offset when non-zero
- sphere, PT-003 box, compound Teddy and oversized prize use the same debug-target interface
- debug rendering is read-only and does not affect solver state

Exit criteria:
- fingers stop physically when blocked — PASS via PT-005
- prize is never attached to claw — PASS across M01 prize-contact experiments
- weak retaining force can produce visible physical slip — PASS via PT-002
- off-center prize rotates naturally — PASS via PT-003
- hook can succeed through geometry alone — PASS via PT-004
- oversized object prevents nominal full close through collision — PASS via M01-E06
- no major solver explosion/jitter — PASS; M01-E06 now asserts finite/bounded rigid-body state throughout the contact-heavy open/close run
- reusable COM visualization exists — PASS
- contact/collider debug remains available — PASS

Final automated verification:
- 29 tests PASS
- lint PASS
- build PASS
- GitHub Pages base-path PASS
- headless browser smoke PASS
- GitHub Pages deployment PASS after squash merge

## 8. PT-006 Swing from braking

Setup:
- free suspended claw,
- move carriage at speed,
- release/hard brake.

Expected:
- claw swings in previous motion direction,
- amplitude depends on acceleration/braking/damping.

Fail:
- claw remains perfectly vertical.

Implementation status — 2026-09-30:
- **Automated PASS**
- position-based kinematic carriage drives a dynamic claw hub through a Rapier spherical joint
- suspension length: 0.31 m
- X/Z gantry max speed: 0.45 m/s
- acceleration: 1.35 m/s²
- braking: 3.5 m/s²
- current M03-compatible horizontal spring stiffness: 170 N/m
- current horizontal damping: 1.0 N·s/m
- corrective-force clamp: 4 N
- angular damping: 3.0
- current regression measures about 0.00303 m lag during +X acceleration
- after braking the hub swings about 0.01522 m forward relative to carriage
- peak measured swing angle is about 0.0491 rad (~2.8°)
- final measured suspension distance is about 0.310000 m
- final residual horizontal offset is about 0.00076 m
- OPEN transport finger flex remains below the existing 0.035 rad (~2°) gate after the M03 recalibration
- finite/bounded transform checks PASS at the 120 Hz fixed step
- no claw parenting to carriage transform and no scripted swing angle is used
- these values are a behavior-proof baseline, not final real-machine calibration
- manual visual test: open `?scene=gantry-lab` and press `P`

## 9. PT-007 Swing amplification

Input:
- repeated direction reversals near favorable phase.

Expected:
- swing amplitude grows within physical limits.

Fail:
- swing unaffected by timing,
- unbounded numerical energy explosion.

Implementation status — 2026-09-30:
- **Automated PASS**
- uses only normal X-axis gantry input reversals; there is no swing button or direct angle/velocity injection
- suspension and gantry remain fixed-step and physically authoritative
- 0.40 s reversal half-period: early peak ≈ 0.02086 m → late peak ≈ 0.02417 m (**+15.9%**)
- 0.40 s peak swing angle ≈ 0.0781 rad (~4.5°)
- nearby 0.42 s cadence also grows: ≈ 0.02032 m → 0.02253 m
- off-cadence 0.30 s decays: ≈ 0.01186 m → 0.00841 m
- off-cadence 0.46 s also decays slightly: ≈ 0.01599 m → 0.01528 m
- all tested cadences remain finite/bounded at 120 Hz
- current gate requires the 0.40 s cadence to grow by at least 12%, exceed 0.022 m late amplitude, remain below 0.05 m overall amplitude, and keep peak angle below 0.16 rad
- no hidden success/failure logic, parenting, or special-case swing force is used

### M03 slice 2 — front/back + diagonal swing

Implementation status — 2026-10-01:
- **Automated PASS**
- Z-axis front/back uses only normal Z gantry acceleration/braking through the same 120 Hz suspension physics
- favorable 0.40 s half-period: early Z peak ≈ 0.02086 m → late Z peak ≈ 0.02417 m (+15.9%)
- off-cadence 0.30 s: early Z peak ≈ 0.01186 m → late Z peak ≈ 0.00841 m (decays)
- synchronized X/Z 0.40 s reversals produce late component peaks ≈ 0.02408 / 0.02408 m
- diagonal late resultant ≈ 0.03405 m; peak angle ≈ 0.1101 rad (~6.3°)
- maximum suspension-length error across the diagonal run ≈ 0.0000030 m
- all transforms and X/Z motion states remain finite/bounded
- no production physics constants changed for this slice
- no direct swing-angle/velocity injection, hidden swing force, scripted oscillation, or transform parenting
- existing PT-006/PT-007/PT-008/home-return regressions remain required and unchanged
- full suite: **46 automated tests PASS**

Acceptance gates:
- front/back resonant late peak > 0.022 m and > 1.10× early peak
- front/back 0.30 s off-cadence late peak < early peak
- front/back overall resultant < 0.05 m and peak angle < 0.16 rad
- diagonal late X and Z components each > 0.012 m
- diagonal late resultant > 0.018 m and overall resultant < 0.08 m
- diagonal component ratio remains within 0.75–1.25
- peak diagonal angle < 0.22 rad
- suspension-length error < 0.002 m
- all checked transforms/states finite and bounded

### M03 slice 3 — amplified swing through DROP

Implementation status — 2026-10-01:
- **Automated PASS**
- starts from the same synchronized X/Z 0.40 s reversal technique validated in slice 2
- no production physics constants changed
- DROP is triggered only after the physical swing still has meaningful resultant offset and relative horizontal velocity
- carriage input returns to zero and brakes normally while reel payout begins through the existing fixed-step controller
- pre-DROP resultant peak ≈ 0.03405 m
- DROP start X/Z offsets ≈ 0.00985 / 0.00985 m; resultant ≈ 0.01394 m
- DROP start world horizontal speed ≈ 0.6253 m/s
- DROP start relative horizontal speed ≈ 0.1910 m/s
- first DROP tick world horizontal speed ≈ 0.6941 m/s; retention ratio ≈ 1.110
- first DROP tick relative horizontal speed ≈ 0.3010 m/s
- physical descent ≈ 0.28029 m over 146 fixed ticks
- maximum descent X/Z offsets ≈ 0.02155 / 0.02155 m
- maximum descent resultant ≈ 0.03047 m
- hub horizontal travel from DROP start ≈ 0.06169 m
- bottom payout = 0.2800 m
- maximum suspension-length error ≈ 0.0000030 m
- final suspension distance ≈ 0.3100001 m
- finite/bounded stability PASS
- no direct angle/velocity injection, hidden swing force, transform parenting, or descent-time state reset
- full suite: **47 automated tests PASS**

Acceptance gates:
- pre-DROP amplified resultant > 0.025 m
- DROP trigger resultant > 0.008 m and relative horizontal speed > 0.08 m/s
- first DROP tick horizontal speed remains non-zero and world-speed retention ratio > 0.20
- physical descent >= PT-008 minimum descent gate
- descent X and Z offsets each > 0.010 m
- descent resultant > 0.018 m but < 0.080 m
- horizontal hub travel from DROP start > 0.010 m
- suspension-length error < 0.002 m and final distance remains ≈ 0.31 m
- all transforms, controller states and reel states remain finite/bounded

**M03 final closure: PASS.**

## 10. PT-008 Momentum during descent

Setup:
- claw swinging laterally,
- press DROP before swing reaches center.

Expected:
- descending path has horizontal displacement,
- claw does not instantly align under carriage.

Implementation status — 2026-09-30:
- **Automated PASS**
- a collider-free kinematic reel anchor moves vertically while the claw hub remains dynamic
- reel payout range: 0.00–0.28 m
- reel max speed: 0.28 m/s
- acceleration / braking: 0.9 / 1.4 m/s²
- the existing 0.31 m spherical suspension remains physically authoritative below the reel anchor
- measured descent: about 0.28017 m
- maximum horizontal offset during descent: about 0.01032 m
- horizontal speed immediately before DROP: about 0.1348 m/s
- first physics tick after DROP begins: about 0.1777 m/s
- DROP therefore does not zero or rigidly align horizontal motion
- the same regression then reverses the reel and physically lifts the hub about 0.2800 m back to the top
- final payout returns to 0.000 m
- final spherical suspension distance remains about 0.3100 m
- finite/bounded transform checks PASS at 120 Hz under the current M03-compatible suspension calibration
- no claw transform teleport or parent-lock is used
- manual visual test: open `?scene=gantry-lab`, use Arrow keys to create motion, then press `Space`; press `T` for the deterministic PT-008 sequence

## 11. PT-009 Early close

Input:
- press DROP,
- press action again before max depth.

Expected:
- claw enters CLOSING immediately,
- fingers take time to close,
- lift occurs after configured close/settle logic.

Current implementation status — updated 2026-10-02:
- **Automated PASS for DROP → DESCENDING → EARLY CLOSE at current height**
- first action moves READY → DESCENDING
- second action during descent records close reason EARLY
- measured regression action payout ≈ 0.1022708 m
- the action transition applies the reel brake immediately and CLOSING commands HOLD rather than further payout
- payout remains ≈ 0.1022708 m for the entire 58-tick / 0.4833 s physical finger-closing interval
- finger command still moves from +0.35 rad toward -0.42 rad at the unchanged 1.6 rad/s command rate
- no claw/payout teleport is used; the reel mechanism is mechanically latched at the current simulated payout
- closing uses the existing contact motor stiffness/damping/max torque
- after close/settle, PICKUP reverses the reel physically as before

## 12. PT-010 Automatic close

Input:
- press DROP,
- do not press early close.

Expected:
- claw closes at configured travel/floor condition.

Implementation status — 2026-10-01:
- **Automated PASS for configured travel-close path**
- current pre-cabinet proxy is payout threshold 0.275 m
- measured transition payout ≈ 0.27562 m
- close reason is AUTO
- close command again requires 58 ticks ≈ 0.4833 s
- reel physically reaches max payout 0.280 m
- later cabinet/floor contact can replace or augment this travel threshold without changing the state-machine contract

## 13. PT-011 Force-phase slip

Setup:
- close torque > retaining torque,
- prize can initially be lifted.

Expected:
- strong initial grip,
- later gradual slip or loss when retaining phase begins.

Fail:
- retaining phase change has no physical effect,
- prize abruptly teleports out.

Implementation status — 2026-10-01:
- **Automated PASS**
- M04 close completion is followed by a 0.90 s settle window; measured fixed-step duration = 109 ticks ≈ 0.908 s
- reel then reverses physically into PICKUP through the unchanged M02 reel acceleration/braking controller
- PICKUP uses 2.5 N·m, matching the closed M01 contact baseline
- after ≈ 0.06027 m physical reel recovery (44 ticks ≈ 0.367 s), phase changes to RETAINING
- RETAINING uses 0.003 N·m
- suspended-claw sphere regression peak lift ≈ 0.04365 m
- sphere remains ≈ 0.02156 m lifted at the RETAINING transition
- subsequent weak-force slip loss ≈ 0.04445 m
- final sphere lift ≈ −0.00080 m, remaining near the support rather than being teleported away
- final reel payout = 0.000 m
- maximum suspension-length error ≈ 0.000056 m
- regression scene raises the M01 sphere/support placement by 0.015 m to produce the intended grip geometry under the suspended M04 claw; claw physics and prize material parameters are unchanged
- no prize parent, weld, prize joint, kinematic conversion, scripted release, or velocity reset
- finite/bounded PASS
- M04 slice 3 additionally verifies prize speed remains continuous across PICKUP → RETAINING: ≈ 0.19819 m/s immediately before and ≈ 0.19436 m/s immediately after the transition
- no state-transition velocity clearing is used
- full M04 closure suite: **54 automated tests PASS**

Cabinet gameplay calibration — updated 2026-10-03:
- locked standalone M04 lab values remain unchanged
- cabinet-only finger friction = **1.94**
- cabinet-only CLOSE/PICKUP torque = **10.0 N·m**
- cabinet-only RETAINING torque remains **0.014 N·m**
- cabinet-only HOLD BOOST remains **0.018 N·m**
- cabinet-only strong PICKUP distance remains **0.18 m**
- cabinet-only closed angle = **−0.63 rad**
- cabinet-only lower-finger contact radius = **10 mm**, matched by the visible lower finger section
- success requires reaching top and remaining at least 80 mm above the starting deck height after 1.2 s RETAINING and at final observation
- centered Rubber Ball: peak ≈ **0.2529 m**, +1.2 s/final ≈ **0.2529 m** — PASS
- centered Foam Cube: peak ≈ **0.2419 m**, +1.2 s/final ≈ **0.2419 m** — PASS
- centered Small Pillow: peak ≈ **0.2514 m**, +1.2 s ≈ **0.2465 m**, final ≈ **0.2464 m** — PASS
- centered Simple Animal: peak ≈ **0.2098 m**, +1.2 s/final ≈ **0.2092 m** — PASS
- Simple Teddy at +20 mm X / −30 mm Z torso-offset aim: peak ≈ **0.1664 m**, +1.2 s ≈ **0.1123 m**, final ≈ **0.1124 m** — PASS
- centered Teddy is deliberately not a guaranteed pickup; alignment remains meaningful
- the previous 150 g mass-rejection criterion is retired for the stronger gameplay profile; dense high-friction spheres may also be physically retained
- no magnet, kinematic prize conversion, prize joint, parenting, scripted carry, teleport, or velocity reset is used.

Starter-cube interaction update — 2026-10-03:
- former `prize/cube_small` sharp 95 mm plastic cuboid was reproduced as essentially immobile under a centered flat-deck grab
- sweeps of close torque (2.9→5.0 N·m), finger friction, prize friction, deeper close angle, thicker/shorter tips and AUTO CLOSE depth did not make the sharp cuboid realistically grabbable
- starter definition is now **Foam Cube**, 75 g, soft material, rounded physical collider `box/rounded_v1` (~14 mm corner radius)
- rounded Foam Cube: peak lift ≈ **10.4 mm**, maximum planar displacement ≈ **22.7 mm**
- legacy sharp comparison: peak lift ≈ 2.1 mm, planar displacement ≈ 2.5 mm
- acceptance requires visible physical interaction (>15 mm via lift or planar displacement) rather than forcing a rigid box to behave like a ball
- hard box definitions remain sharp/high-difficulty.
- current plush-capable production grip fully retains the rounded Foam Cube at ≈ **0.2419 m** final; the earlier 10.4 mm/22.7 mm values remain historical pre-strong-grip baselines.

Depth-readability manual acceptance — 2026-10-03:
- no laser, projected drop marker or hidden aim guide
- play deck carries a low-contrast woven texture so perspective scaling is visible
- fixed cabinet light casts real claw/prize shadows onto the deck
- player may use only the existing small front-zone lateral motion for parallax
- PASS requires easier depth judgment without turning the shadow/texture into an explicit vertical targeting indicator.

## 14. PT-012 Hold boost

Setup:
- prize near slip threshold.

Expected:
- boost temporarily increases physical grip stability,
- release/timeout returns to base retaining force.

Fail:
- boost creates a hidden parent/weld.

Implementation status — 2026-10-01:
- **Automated PASS**
- prototype input: hold `Shift`
- BOOST is active only during RETAINING/RETURNING and only while requested
- base RETAINING torque = 0.003 N·m
- calibrated BOOST torque = 0.010 N·m
- maximum BOOST budget = 0.80 s of actual use per play cycle
- same near-slip sphere without BOOST is already near its support at RETAINING +0.4 s: lift ≈ -0.000064 m
- with BOOST, lift at the same time ≈ 0.019257 m
- at/after the 0.80 s budget limit, force returns to the base retaining value; measured lift ≈ -0.002071 m and the prize subsequently falls physically
- the chosen 0.010 N·m is the smallest tested torque with a clear 0.4 s stabilization benefit; ≥0.015 N·m produced no useful additional benefit in the calibration sweep
- no parent, weld, prize joint, kinematic conversion, teleport, or hidden success state
- full suite: **54 automated tests PASS**

## 15. PT-013 Carried-prize swing

Setup:
- claw carrying a prize,
- carriage accelerates/brakes.

Expected:
- combined claw/prize system swings,
- off-center grip introduces rotation,
- carried prize can collide with pile/cabinet geometry.

## 16. PT-014 Knock interaction

Setup:
- carried prize collides with second dynamic prize.

Expected:
- second prize receives collision impulse,
- first prize reacts to equal/opposite contact through solver.

Fail:
- carried prize behaves kinematically.

## 17. PT-015 Dense pile stability

Setup:
- 10–15 prizes,
- settle until sleep.

Expected:
- after settling, pile remains visually stable for at least 60 simulated seconds.

Fail:
- persistent jitter,
- gradual self-propelled drift,
- spontaneous pile explosion.

M05 closure — 2026-10-01:
- **Automated PASS**
- 12 dynamic PrizeFactory prizes placed in a compact contact-bounded pile
- all 12 reach sleeping state after ≈ 2.3167 simulated seconds
- post-settle observation = 60 simulated seconds
- maximum post-settle drift = 0 m
- maximum post-settle speed = 0 m/s
- final sleeping bodies = 12/12
- finite/bounded PASS
- no freeze/kinematic conversion or transform reset is used.

## 18. PT-016 Wake propagation

Setup:
- settled sleeping pile,
- claw contacts one prize.

Expected:
- contacted prize wakes,
- relevant neighboring contacts wake as needed,
- distant unrelated objects may remain asleep.

## 19. PT-017 Chute edge

Setup:
- prize resting partially on chute edge.

Expected:
- no win until valid chute sensor condition is satisfied.

M06 integrated deck calibration — 2026-10-01:
- **Automated PASS**
- `prize/box_flat` is placed partially over the physical chute lip with its COM still supported by the raised play deck
- final body Y ≈ 0.287457 m
- minimum world-COM Y ≈ 0.287045 m
- chute sensor event count = 0
- chute sensor win count = 0
- no scripted support, freeze or sensor override is used.

## 20. PT-018 Chute win

Setup:
- prize physically falls through chute.

Expected:
- sensor records correct prize,
- win fires once,
- inventory/state update occurs once.

M06 final closure — 2026-10-02:
- **Automated PASS for physical sensor entry + exactly-once result/inventory update**
- `prize/cube_small` falls under gravity through the real raised-deck opening
- first sensor entry remains fixed tick 33 ≈ 0.275 s in the PT-018 physics regression
- sensor emits exactly one event for the physical prize instance
- `CabinetResultInventoryState` accepts the event exactly once
- replaying the identical event returns no second result
- presenting the same physical prize under a different sensor sequence also returns no second result
- result count = 1 and inventory count = 1
- the full carried-prize lifecycle independently reaches the same one-shot sensor only after motor RELEASE
- no result/inventory code modifies physics, prize transform, velocity, collision or sensor geometry.

## 21. PT-019 Bridge box progression

Setup:
- box across two bars.

Expected:
- repeated asymmetric pushes/grips can rotate/translate box,
- final drop can emerge from physical loss of support.

Fail:
- bridge requires a hard-coded "progress percentage".

## 22. PT-020 Ring hook

Setup:
- ring/handle prize.

Expected:
- claw tip can physically enter and catch ring,
- success depends on geometry/contact.

## 23. PT-021 Material differentiation

Compare:
- same shape/mass,
- different friction profiles.

Expected:
- measurable difference in slip/drag behavior.

M05 closure — 2026-10-01:
- **Automated PASS**
- same `prize/box_standard`, same mass profile, same centered COM, same floor and same initial 1.20 m/s horizontal speed
- plastic profile travel ≈ 0.124198 m
- rubber profile travel ≈ 0.092227 m
- measured travel separation ≈ 0.031971 m
- both bodies physically decelerate to 0 m/s
- only the material profile differs.

## 24. PT-022 COM differentiation

Compare:
- same visual box,
- centered vs side-offset COM.

Expected:
- different rotation/stability under same approximate grip.

M05 closure — 2026-10-01:
- **Automated PASS**
- same `prize/box_standard`, same mass/material, same impulse through the visual/geometric center
- centered COM local X = 0 m
- centered result: 0 rad rotation, 0 rad/s peak angular speed
- left-offset COM local X ≈ -0.01890 m
- offset result: ≈ 0.403848 rad rotation
- peak angular speed ≈ 1.615396 rad/s
- difference arises from real Rapier mass properties; no scripted rotation.

## 25. PT-023 Restock settle

Setup:
- restock machine with layout seed.

Expected:
- prizes settle without severe overlap,
- stable pile formed,
- different seed changes final arrangement.

## 26. PT-024 Staff service safety

During service:
- player machine controls disabled,
- claw movement stopped/safe,
- reposition/restock completes,
- physics re-enabled and settled before play resumes.

## 27. PT-025 First-person camera range

Manual check:
- ±90° yaw,
- bounded up/down look,
- small forward/back adjustment,
- small left/right adjustment,
- no required lean control.

Current front-only implementation — 2026-10-03:
- **Automated controller PASS**
- yaw = ±90°
- pitch = −70° / +25°
- default eye height = **1.04 m**
- bounded player-height range = **0.98…1.10 m** in 0.02 m steps
- desktop uses `PageUp/PageDown`; mobile uses `VIEW + / VIEW −`
- desktop FOV = 50°; mobile FOV = 58°
- X = −0.28…+0.28 m
- desktop Z ≈ 0.534…0.84 m; mobile max Z = 0.90 m
- Q/E lean/roll has been removed
- player remains in front of the cabinet; side standing positions are intentionally removed
- control-panel button and chute remain gaze-reachable from the legal front zone.

## 28. PT-026 Camera integrity

Normal play must reject:
- free fly,
- clipping through glass,
- arbitrary overhead teleport,
- walking around the cabinet sides.

Current front-only implementation — 2026-10-03:
- **Automated movement-integrity PASS**
- no free-fly input exists; the only vertical adjustment is the bounded 0.98–1.10 m player eye-height range
- minimum Z stays outside the front-glass clearance
- maximum |X| = 0.28 m, well inside the physical side-glass X extent
- sustained diagonal movement saturates at the front standing rectangle
- player cannot traverse around either front corner
- head look changes orientation only
- `F` directly delegates to the existing M04 primary action and does not require gaze focus
- chute gaze has no play action.

## 29. PT-027 100+ prize variants

Data/content test:
- generator can enumerate at least 100 valid visual prize variants from configured base assets and variant families.

No 100-class implementation is allowed.

M05 closure — 2026-10-01:
- **Automated PASS**
- 11 PrizeFactory definitions × 8 colors × 2 finishes
- explicit enumerator returns **176** variants
- uniqueness regression confirms 176/176 unique definition/color/finish keys
- deterministic seeded runtime selection remains supported
- no one-class-per-variant implementation.

## 30. PT-028 Pure Simulation fixed parameters

Repeat:
- same scene seed,
- same machine config,
- recorded input.

Expected:
- result is reproducible within documented physics tolerance,
- no adaptive hidden strength changes.

## 31. PT-029 Commercial parameter transparency

When commercial simulation changes force/timing behavior:
- debug/operator tooling can report active parameters,
- behavior is attributable to configured machine logic.

## 32. PT-030 Performance baseline

Initial single-cabinet target:
- 60 FPS render target on reference development hardware,
- 120 Hz fixed physics target,
- active 10–15 prize pile,
- no visible contact degradation.

Exact hardware baseline will be defined after prototype profiling.

## 33. Visual/manual realism checklist

For each playable build, manually inspect:
- finger contacts match mesh/collider,
- prize does not hover,
- heavy prize appears to load the system more than light prize,
- glass does not block aiming,
- claw swing is readable but not exaggerated,
- lift does not visibly snap,
- release happens from real finger opening/contact loss,
- prize impact audio matches material,
- cabinet/chute proportions remain plausible.
- chute trim remains visually stable while the first-person camera moves; no green sensor-debug box or coplanar rim flicker is visible
- idle claw sits close to the upper mechanism without visually/physically intersecting the cabinet ceiling.

### M06 gray-box cabinet readability closure — 2026-10-02

- front/side glass remains physically collidable
- glass render opacity is 0.10 to reduce obstruction through the play area
- visible edge outlines preserve panel/boundary readability despite the low-opacity pane
- no FOV widening, camera teleport or collision bypass is used to solve visibility
- both `gantry-lab` and `cabinet-lab` browser startup smoke PASS
- first-person ±90°+ yaw, side-glass depth inspection and anti-clipping remain PT-025/PT-026 work for M07.

## 34. Regression policy

Every resolved physics bug should ideally produce one of:
- a new automated test,
- a deterministic reproduction scene,
- a documented manual acceptance case.

Do not close recurring physics bugs with only parameter tweaks and no reproduction case.

# Additional acceptance tests from design review

## PT-031 Return path is physical

Setup:
- prize held during RETURN.

Expected:
- carriage physically travels toward chute,
- prize can swing/rotate/slip during return,
- no teleport to chute.

M02 prerequisite status — 2026-09-30:
- mechanical return path is **automated PASS**
- fixed-step carriage target-return uses the same speed/acceleration/braking limits as manual motion
- regression returns from ~0.317 m off home to ~1.76 mm error without teleport
- dynamic hub keeps measurable residual swing during return (~10.7 mm max relative offset)

M04 lifecycle integration — 2026-10-01:
- **mechanical RETURN integration PASS**
- reel-top completion moves RETAINING → RETURNING automatically
- M04 RETURN uses the same braking-aware gantry target controller, not a transform jump
- lifecycle regression reaches the home/release target at fixed tick 149 with ≈ 1.834 mm position error

M06 full cabinet integration — 2026-10-01:
- **PT-031 Automated PASS**
- a physically held high-stack light rubber sphere reaches RETAINING at tick 46 and RETURNING at tick 56
- M06 closure-time cabinet RETURN target was the then-current chute center X/Z = +0.28 / 0.20 m
- the ball moves ≈ 83.35 mm horizontally with the claw before RELEASE
- dynamic hub/carriage lag peaks ≈ 16.21 mm during the return
- maximum prize movement in one 120 Hz tick ≈ 18.33 mm
- no prize setTranslation, parent, weld, prize joint, magnet or velocity reset
- failed long-carry calibration trials legitimately slipped before release and were rejected rather than hidden by force changes.

Current cabinet-layout update — 2026-10-02:
- real chute center is now **X/Z = -0.28 / 0.20 m**
- lifecycle fixture is mirrored to start X = -0.155 m, preserving the calibrated 0.125 m return distance
- RETAINING tick 46, RETURNING tick 56, RELEASING tick 117, sensor tick 154, READY tick 174
- ball horizontal travel at release ≈ 75.25 mm
- max dynamic hub lag ≈ 13.37 mm
- maximum carried/PICKUP/RETAINING/RETURN prize step ≈ **4.84 mm per 120 Hz tick**
- post-release free-fall through the enlarged chute can reach ≈ 26.49 mm/tick and is bounded separately (<35 mm/tick) rather than being misclassified as transport teleport
- sensor records exactly one WIN; no prize transform/parent/weld/magnet/velocity reset is introduced.

## PT-032 Release timing

Expected:
- fingers physically open at configured release point/height,
- prize leaves contact through gravity/momentum/contact loss,
- no direct prize transform into chute.

M04 mechanical prerequisite — 2026-10-01:
- **Automated PASS for motor-driven release timing**
- RELEASING begins only after the home position/velocity gate
- finger command starts at -0.42 rad and advances physically to +0.35 rad
- opening takes 58 fixed ticks ≈ 0.4833 s at the unchanged 1.6 rad/s command rate
- READY is not entered until the open-angle tolerance is reached
- no finger snap and no prize transform/release script

M06 modeled-chute release — 2026-10-01:
- **PT-032 Automated PASS**
- cabinet fixture enters RELEASING at tick 117 only after the physical return target is reached
- chute sensor does not fire until tick 149, after release has begun
- sensor records exactly one event
- ball finishes at Y ≈ -0.248008 m on the physical lower catch
- HOLD BOOST use is ≈ 0.591667 s / 0.800 s budget and does not attach the prize.

## PT-033 Home cycle

Expected:
- after release/chute check, machine returns to configured ready/home state,
- next play cannot start while the machine is in an unsafe intermediate state.

M02 prerequisite status — 2026-09-30:
- mechanical lift-completion → home-return transition is **automated PASS**
- conflicting DROP/test triggers are locked during `RETURNING_HOME`
- home completion requires both position and velocity tolerances

M04 state lifecycle — 2026-10-01:
- **Automated PASS for the pre-cabinet play-cycle state machine**
- reel-top → RETURNING at fixed tick 63
- RETURNING → RELEASING at tick 149
- RELEASING → READY only after physical opening completes at tick 206
- next DROP action is therefore unavailable during RETURNING/RELEASING
- final reel payout = 0.000 m

M06 final cabinet lifecycle — 2026-10-02:
- carried-prize fixture: RETURNING tick 56 → RELEASING tick 117 → chute sensor tick 149 → READY tick 174
- **physical/home-state ordering PASS**
- next play remains unavailable until READY
- chute event now feeds the idempotent result/inventory state exactly once
- result/inventory handling does not delay or advance the mechanical READY transition.

## PT-034 Aim timer

When a machine has a finite aim timer:
- timer begins at configured state,
- expiration follows configured policy,
- physics continues deterministically through the resulting drop/lock behavior.

## PT-035 Control-profile lock

For a profile with movement locked after DROP:
- player input no longer accelerates gantry,
- existing claw horizontal momentum/swing remains.

## PT-036 Passive yaw/torsion

When enabled:
- claw can twist slightly from motion/contact,
- torsional damping returns it toward equilibrium,
- yaw does not snap instantly to zero.

## PT-037 Reel limit stability

Expected:
- lower/upper reel limit cannot create high-energy bounce or numerical explosion,
- cable length never exceeds configured safe tolerance.

Implementation status — 2026-09-30:
- **Automated PASS**
- fixed-step reel controller uses limit-aware braking before endpoints
- payout stays within 0.00–0.28 m
- PT-008 completes both lower-limit DROP and upper-limit LIFT without energetic bounce
- final spherical suspension distance remains ~0.310 m
- finite/bounded stability checks PASS at 120 Hz

## PT-038 Collision-mask integrity

Verify:
- chute sensor does not push prize,
- claw cannot trigger prize-out,
- player boundary cannot physically shove prizes through glass,
- decorative objects do not affect active prize physics unless explicitly configured.

M06 integration status — 2026-10-01:
- chute-sensor no-push requirement — **PASS by construction**
- sensor is a pure observation volume over Rapier `worldCom()`; it creates no collider, impulse, joint or force
- one-shot state records entry only after the prize is already physically inside the configured volume
- `cabinet-lab` polls only registered prize rigid bodies, so claw/cabinet parts cannot trigger prize-out
- player-boundary shove-through-glass remains M07 player/camera-boundary scope.

## PT-039 Physics watchdog

Inject an invalid/extreme test condition.

Expected:
- development build detects fault,
- simulation enters a diagnosable safe state,
- fault is logged with tick/context.

## PT-040 Replay reproducibility

Record a short fixed-tick input sequence.

Expected:
- same build/config/seed replays within documented transform/velocity tolerance,
- divergence is detectable and reported.

## PT-041 Asset base-path test

Production build served from `/Claw-Chaos/` must load:
- JS chunks,
- CSS,
- physics/WASM assets,
- textures,
- models,
- audio.

No root-relative path should break the GitHub Pages build.

## PT-042 GitHub Pages smoke test

After deployment:
- landing page loads,
- WebGL/WebGPU fallback path initializes as intended,
- one physics scene starts,
- browser console has no fatal asset-path/CORS errors.

## PT-043 Camera optics vs head turn

Manual check:
- side inspection comes from head/body movement,
- FOV is not widened to an implausible fisheye just to expose side content.

## PT-046 Default play framing and desktop drag direction

Setup:
- root/default `cabinet-lab`,
- desktop pointer-lock input.

Expected:
- mouse movement follows the same content-drag direction used on touch,
- initial yaw = 0°,
- initial pitch = **−23°**,
- default eye height = **1.04 m**,
- desktop initial Z = **0.78 m** and max Z = **0.84 m**,
- desktop FOV remains **50°**,
- without moving the camera, representative upper-claw and front-prize-top points both lie inside the vertical FOV,
- mobile retains Z 0.84 / max 0.90 / 58° FOV while inheriting the same starting pitch,
- bounded eye-height controls cannot exceed 0.98–1.10 m.

Automated status — 2026-10-03:
- explicit desktop drag-direction regression PASS
- explicit zero-input startup-framing regression PASS
- full suite = **32 test files / 89 tests PASS**
- lint/build/base-path/browser smokes PASS.

## PT-045 Mobile touch play path

Setup:
- phone or coarse-pointer device,
- root/default `cabinet-lab`.

Expected:
- direct drag on the WebGL view changes bounded yaw/pitch without pointer lock,
- left virtual analog joystick moves the claw through the same gantry physics controller used by desktop input,
- releasing the joystick returns input to zero,
- right `DROP / CLOSE` button invokes the same primary action as Space/F,
- `VIEW + / VIEW −` changes only bounded player eye height in 20 mm steps,
- safe-area insets keep controls clear of notches/home indicators,
- debug overlay does not occupy phone play space,
- portrait and landscape remain playable without horizontal page scrolling.

Automated status — 2026-10-03:
- joystick normalization is unit-tested with **14% dead zone**, remapped travel, diagonal clamping and zero/tiny radius safety
- action debounce regression verifies taps inside **140 ms** are rejected while a later deliberate action is accepted
- touch-look regression verifies **0.0030 rad/pixel** is distinct from desktop mouse **0.0022 rad/pixel**
- touch-drag regression verifies scene-following drag semantics rather than opposite FPS-style touch motion
- mobile framing regression locks Z 0.84 / max 0.90 and **58° FOV**, with representative upper-claw + prize-deck vertical span fitting in view
- render-profile regression locks mobile DPR cap **1.5** / shadow **512** versus desktop DPR 2 / shadow 1024
- browser smoke requires `data-mobile-controls="ready"` and the `mobile-view-height` controls for explicit cabinet and root/default scenes
- full suite = **32 test files / 89 tests PASS**
- real-device Android Chrome / iPhone Safari comfort, portrait/landscape layout and sustained FPS remain manual M07 closure gates.

## PT-044 Calibration record completeness

At least one reference machine must have documented:
- dimensions,
- movement timing,
- swing period/damping,
- descent/lift timing,
- source/method/uncertainty.
