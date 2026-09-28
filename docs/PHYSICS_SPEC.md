# Physics Specification

Version: 0.1  
Date: 2026-09-28

## 1. Purpose

This document defines the physical behavior that Claw Chaos must preserve regardless of engine choice.

The implementation may change, but these behavior contracts remain authoritative.

## 2. Simulation loop

Initial target:
- render: 60 FPS target
- physics: fixed 120 Hz target
- optional 2–4 contact substeps during critical contact-heavy states

These are starting points and must be performance-tested.

Use a fixed simulation timestep for gameplay physics.

Avoid binding physical correctness to render frame rate.

## 3. Units

Recommended canonical units:
- distance: meters
- mass: kilograms
- time: seconds
- angle: radians internally
- force: newtons
- torque: newton-meters

Authoring tools may expose centimeters/degrees for usability but convert to canonical units.

## 4. Coordinate conventions

Define once during engine bootstrap.

Recommended:
- Y = up
- X = cabinet left/right
- Z = cabinet front/back

Gantry motion is X/Z.
Vertical drop/lift is Y.

## 5. Gantry model

Required state:
- position X/Z
- velocity X/Z
- target/control direction
- max speed
- acceleration
- deceleration
- braking strength/response
- movement limits

Input controls desired carriage motion. It must not teleport.

Example control model:
1. resolve input,
2. compute target velocity,
3. accelerate toward target,
4. apply braking/deceleration,
5. enforce rail limits,
6. suspension responds physically to carriage acceleration.

## 6. Suspension model

Preferred initial implementation:
- rigid claw hub body,
- constrained to carriage by a suspension joint/constraint,
- variable vertical length during drop/lift,
- angular X/Z swing,
- optional limited yaw/torsion.

Required parameters:
- suspension length,
- angular damping,
- torsional damping,
- angular limit,
- vertical reel speed,
- reel acceleration,
- minimum/maximum length.

A full multi-segment rope is not required initially.

## 7. Swing behavior

Swing must respond to carriage acceleration.

Simplified physical interpretation:

```text
θ'' + damping + gravity restoring term ~= forcing from carriage acceleration
```

Acceptance behavior:
- smooth acceleration produces modest lag,
- hard stop produces forward swing,
- reversing at the correct phase can increase amplitude,
- releasing controls does not instantly zero claw horizontal velocity.

## 8. Descent

During descent:
- suspension length increases,
- claw retains horizontal velocity,
- claw can contact prizes before reaching maximum depth,
- collision can alter swing,
- early close can occur at any legal descent point.

Do not lock X/Z to the carriage.

## 9. Claw fingers

Each finger is:
- a separate collider/body or articulated link,
- connected to the hub through a revolute/hinge-style joint,
- driven toward a target angle by motor torque/impulse limits.

Parameters:
- open angle,
- closed target angle,
- angular speed target,
- max close torque,
- joint stiffness/compliance,
- joint damping,
- finger mass,
- finger inertia,
- tip geometry.

Contact must be able to stop a finger before its target angle.

## 10. Force phases

At minimum maintain:
- close torque,
- pickup torque,
- retaining torque,
- optional boosted retaining torque.

Possible state timing:
- CLOSING uses close torque,
- initial LIFT uses pickup torque,
- HOLD/RETURN uses retaining torque,
- HOLD_BOOST temporarily raises retaining torque.

No state may attach the prize.

## 11. Contact/friction

Use the physics engine's contact solver.

Prize material data:
- static friction,
- dynamic friction,
- restitution.

Claw finger/tip material also matters.

The same prize should behave differently when:
- pinched firmly with high normal force,
- barely supported at a smooth edge,
- hooked mechanically,
- resting against another prize.

## 12. Center of mass

Each prize may override its center of mass.

Profiles may include:
- centered,
- bottom-heavy,
- top-heavy,
- left/right offset,
- front/back offset.

The visual mesh origin is not assumed to be the physical COM.

## 13. Inertia

Use engine-computed inertia where appropriate.

For intentionally unusual prizes, allow authored inertia override only if needed.

Avoid unrealistic "heavy but rotates like weightless" behavior.

## 14. Rigid prize collision

Preferred collision primitives:
- box,
- sphere,
- capsule,
- cylinder if stable,
- convex hull where needed,
- compound primitive/hull.

Avoid concave dynamic triangle meshes for ordinary prizes.

## 15. Plush collision

Initial plush representation:
- head collider,
- torso collider,
- arm colliders,
- leg colliders,
- optional ears/tail only when gameplay-relevant.

Two implementation tiers:

### Tier A
Single rigid body with compound collider.

### Tier B
Articulated multi-body with limited compliant joints.

Tier B is preferred once stable.

Visual skin may deform without making every vertex physical.

## 16. Continuous collision detection

CCD should be enabled selectively for:
- claw tips,
- small fast prizes,
- mini-crane pieces,
- other objects at high tunneling risk.

Do not enable CCD indiscriminately if performance cost is high.

## 17. Solver stability

Tune:
- velocity iterations,
- position iterations,
- friction iterations if exposed,
- penetration correction,
- contact slop,
- joint stabilization,
- sleep thresholds.

Primary failure to avoid:
- pile jitter,
- energy injection,
- objects slowly walking across the floor,
- claw exploding from deep penetration,
- fingers tunneling through prize geometry.

## 18. Sleeping

Settled prizes should sleep.

Wake conditions include:
- claw contact,
- neighboring collision,
- staff/restock placement,
- scripted cabinet service that physically moves the prize.

A settled pile must remain stable over time.

## 19. Prize pile initialization

Recommended pipeline:
1. load/generate prize definitions,
2. place objects above/around target positions with valid spacing,
3. simulate settlement,
4. wait for sleep/stability threshold,
5. capture/reuse seed if needed,
6. start player interaction.

Do not begin gameplay with unresolved massive overlaps.

## 20. Staff reposition approximation

Initial staff movement can temporarily:
- disable normal player control,
- move a prize through a controlled service manipulation,
- place it at a legal target pose,
- re-enable dynamic physics,
- run settlement.

Avoid teleporting during active play; service mode is a documented exception because it represents a staff member physically repositioning the object.

## 21. Prize chute

The chute requires:
- wall/edge colliders,
- opening geometry,
- retrieval path,
- sensor volume.

A prize is awarded only after a configured sensor condition is met.

Recommended sensor validation:
- dynamic prize body enters valid chute sensor,
- remains or passes through required region,
- prize is not the claw or a non-prize prop.

## 22. Determinism

Full bitwise cross-platform determinism may not be practical.

Required practical reproducibility:
- fixed-step simulation,
- seeded initial prize layouts,
- no uncontrolled gameplay RNG,
- deterministic input recording where supported,
- tolerance-based regression tests.

Physics acceptance should use tolerances rather than exact floating-point equality.

## 23. No-attachment rule

Forbidden in normal pickup:
- parenting prize transform to claw,
- setting prize kinematic while held,
- zeroing prize gravity because "grabbed",
- hidden weld joint triggered by "successful grab",
- magnetic force that is not an explicit machine mechanic.

Allowed:
- real contact/friction,
- finger constraints,
- physical hooks,
- explicit special machine mechanics if visible and documented.

## 24. No hidden success roll

Pure Simulation mode must never call something equivalent to:

```ts
if (Math.random() < successChance) {
  attachPrize();
}
```

Difficulty comes from physical parameters.

Commercial Simulation may adjust configured machine parameters, but physics resolves the outcome.

## 25. Performance strategy

Performance priority:
1. one machine must be physically convincing,
2. then scale prize count,
3. then add visual quality,
4. then add neighboring machines/NPCs.

Potential optimizations:
- sleeping,
- simplified colliders,
- distance-based simulation for non-active cabinets,
- lower update rate for distant non-interactive props,
- one fully active cabinet at a time in arcade mode,
- pooled prize bodies.

Never reduce active-cabinet claw/prize contact quality merely to simulate distant decorative cabinets.

## 26. Physics debug overlay

Development-only overlay should expose:
- body awake/sleep state,
- collision shapes,
- COM markers,
- contact points/normals,
- claw joint angles,
- current motor torque limits,
- gantry velocity,
- claw velocity,
- suspension angle,
- swing angular velocity,
- current force phase,
- prize/chute sensor state.

This is essential for diagnosing "looks wrong" problems.

## 27. Calibration scenes

Maintain permanent deterministic test scenes:
- ball center grab,
- low-friction ball slip,
- off-center box rotation,
- teddy arm hook,
- swing-without-prize,
- swing-with-prize,
- dense pile stability,
- bridge box,
- chute edge/jam,
- mini small-object CCD.

These scenes must survive refactoring.

## 28. Physics acceptance principle

When a behavior looks unrealistic, first diagnose:
- force,
- mass,
- inertia,
- friction,
- collision geometry,
- solver stability,
- suspension response.

Do not patch it with a prize-specific gameplay exception unless a real mechanical reason exists.

# 29. Input sampling and control latency

Player/machine input should be sampled into the fixed-step simulation rather than applied only on render frames.

Recommended flow:
1. collect render-frame input,
2. convert to a stable input state,
3. consume that state on each physics tick,
4. log state changes with tick numbers.

Machine profiles may intentionally add small control latency or digital button behavior, but engine/render latency must not unpredictably change gameplay.

---

# 30. Horizontal input lock after drop

Whether X/Z carriage movement remains available after DROP is machine-specific.

Represent this as configuration.

Do not globally assume:
- the player can steer during descent,
or
- the player is always locked.

Swing momentum remains physical even if control input becomes locked.

---

# 31. Claw yaw and torsion

Support an optional torsional degree of freedom:
- current yaw angle,
- angular velocity,
- restoring stiffness,
- torsional damping,
- yaw limit.

Baseline machines should use small passive twist/yaw.

A simplified torsional spring constraint is acceptable.

---

# 32. Winch/reel dynamics

The vertical reel should expose:
- cable length,
- target reel velocity,
- reel acceleration,
- upper/lower limit,
- braking/deceleration,
- stop tolerance.

Do not change cable length discontinuously during normal play.

The hub may continue to swing while reel length changes.

---

# 33. Collision layers and masks

Define explicit collision groups for at least:
- cabinet static geometry,
- claw hub,
- claw fingers,
- prize,
- chute sensor,
- player/camera boundary,
- service-only geometry,
- decorative non-physics objects.

Goals:
- prize collides with cabinet/claw/prizes,
- claw does not trigger prize-out incorrectly,
- player body cannot push active prizes through glass,
- sensors do not generate physical impulses,
- decorative props do not destabilize the active simulation.

---

# 34. Limit handling

Rail and reel limits must use stable physical/control handling.

Avoid high-energy rebound from hard numerical clipping.

Preferred behavior:
- command decelerates before limit,
- final travel constrained safely,
- optional small bumper/compliance if the real machine exhibits it.

---

# 35. Physics watchdog and recovery

Development builds should detect:
- NaN/invalid transforms,
- extreme velocities,
- bodies below world bounds,
- impossible penetration depth,
- joint break/explosion,
- prize permanently embedded in static geometry.

Production handling should:
- pause the machine,
- enter a fault/service state,
- preserve valid state where possible.

Do not silently normalize a bad simulation and continue as if nothing happened.

---

# 36. Replay checkpoints

A diagnostic replay can use:
- initial config/version,
- layout seed,
- input events by fixed tick,
- periodic state checkpoints.

Because browser/CPU physics may not be bitwise identical across all platforms, checkpoints should support divergence detection with tolerance.

---

# 37. Calibration metrics

For each reference machine, collect measurable targets such as:
- time from zero to max carriage speed,
- stopping distance,
- free-swing period,
- decay of swing amplitude,
- time to descend full travel,
- time to lift,
- finger close time,
- max open span,
- loaded vs unloaded swing response.

Tune simulation against these observables before tuning "feel".

---

# 38. Web performance budget

Initial active-scene target:
- 60 FPS render target,
- 120 Hz fixed physics target,
- 10–15 active prizes minimum,
- no visible tunneling during normal claw motion,
- stable contact with debugging disabled.

If target hardware cannot sustain this:
1. simplify visual effects first,
2. simplify distant/inactive simulation,
3. simplify prize colliders where physically equivalent,
4. profile solver/contact hotspots,
5. only then reconsider physics rate.

Do not reduce active simulation fidelity without documenting the trade-off.
