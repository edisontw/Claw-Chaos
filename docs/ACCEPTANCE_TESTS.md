# Acceptance Tests

Version: 0.2  
Date: 2026-09-28

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
- COM: geometric center, visualized by a yellow marker
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
- right paw/forearm is the intended geometry-only hook region
- calibrated peak lift: about 0.045 m
- sustained lift above the 0.035 m threshold: about 0.492 s
- peak rotation relative to settled starting pose: about 0.478 rad (~27.4°)
- final position returns near the support naturally, demonstrating that contact can later fail without a scripted release
- no hook flag, prize parenting, weld, claw-prize joint, or kinematic prize state
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

## 9. PT-007 Swing amplification

Input:
- repeated direction reversals near favorable phase.

Expected:
- swing amplitude grows within physical limits.

Fail:
- swing unaffected by timing,
- unbounded numerical energy explosion.

## 10. PT-008 Momentum during descent

Setup:
- claw swinging laterally,
- press DROP before swing reaches center.

Expected:
- descending path has horizontal displacement,
- claw does not instantly align under carriage.

## 11. PT-009 Early close

Input:
- press DROP,
- press action again before max depth.

Expected:
- claw enters CLOSING immediately,
- fingers take time to close,
- lift occurs after configured close/settle logic.

## 12. PT-010 Automatic close

Input:
- press DROP,
- do not press early close.

Expected:
- claw closes at configured travel/floor condition.

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

## 14. PT-012 Hold boost

Setup:
- prize near slip threshold.

Expected:
- boost temporarily increases physical grip stability,
- release/timeout returns to base retaining force.

Fail:
- boost creates a hidden parent/weld.

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

## 20. PT-018 Chute win

Setup:
- prize physically falls through chute.

Expected:
- sensor records correct prize,
- win fires once,
- inventory/state update occurs once.

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

## 24. PT-022 COM differentiation

Compare:
- same visual box,
- centered vs side-offset COM.

Expected:
- different rotation/stability under same approximate grip.

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
- at least ±90° yaw,
- slight up/down look,
- forward/back movement,
- left/right movement,
- optional lean.

Player must be able to inspect both side angles without clipping through glass.

## 28. PT-026 Camera integrity

Normal play must reject:
- free fly,
- clipping through glass,
- arbitrary overhead teleport.

## 29. PT-027 100+ prize variants

Data/content test:
- generator can enumerate at least 100 valid visual prize variants from configured base assets and variant families.

No 100-class implementation is allowed.

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

## PT-032 Release timing

Expected:
- fingers physically open at configured release point/height,
- prize leaves contact through gravity/momentum/contact loss,
- no direct prize transform into chute.

## PT-033 Home cycle

Expected:
- after release/chute check, machine returns to configured ready/home state,
- next play cannot start while the machine is in an unsafe intermediate state.

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

## PT-038 Collision-mask integrity

Verify:
- chute sensor does not push prize,
- claw cannot trigger prize-out,
- player boundary cannot physically shove prizes through glass,
- decorative objects do not affect active prize physics unless explicitly configured.

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

## PT-044 Calibration record completeness

At least one reference machine must have documented:
- dimensions,
- movement timing,
- swing period/damping,
- descent/lift timing,
- source/method/uncertainty.
