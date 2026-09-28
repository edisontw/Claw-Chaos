# Acceptance Tests

Version: 0.1  
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

