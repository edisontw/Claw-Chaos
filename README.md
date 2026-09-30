# Claw Chaos

**Claw Chaos** is a physics-first, high-fidelity claw machine simulator.

The project goal is not to fake a claw-machine result with a hidden success roll. The claw, suspended head, prize geometry, center of mass, friction, collisions, swing, closing force, retaining force, pile state, and prize chute should produce the result through simulation.

> Design principle: if the player sees it happen, the simulation should explain why it happened.

## Project goals

- First-person view that feels like standing in front of a real machine.
- Realistic X/Z gantry motion, acceleration, braking, suspended claw swing, descent, early close, lift, return, and release.
- Real rigid-body prize interaction: grab, slip, hook, push, drag, rotate, flip, jam, collide, and fall.
- Separate close / pickup / retaining force instead of one abstract "claw strength".
- Player-controlled **early close** ("收爪") while descending.
- Support realistic **claw swinging / 甩爪** techniques instead of a scripted skill button.
- Support a limited **hold boost** mechanic separately from Taiwan-style guaranteed-prize / "保證取物" rulesets.
- Multiple machine families: 3-prong plush crane, 2-prong UFO-style machine, mini crane, premium crane.
- Hundreds of prize variants from data-driven geometry, materials, colors, mass, friction, and center-of-mass profiles.
- Staff call, prize repositioning, restocking, machine servicing, and operator simulation.
- Progressive implementation: use the closest stable approximation when a physically exact simulation is too expensive or unstable.

## Current phase

**M03 IN PROGRESS — Swing Techniques**

M01 — Claw Physics Laboratory is complete and remains the locked physics-contact baseline. The three-prong claw now has six automated physics experiments covering centered pickup, pickup→retaining-force slip, off-center rotation, Teddy limb hook, independent blocked-finger behavior, and oversized-object close blocking. Generic COM/origin visualization now reads Rapier's actual rigid-body mass properties and is shared across the sphere, box, Teddy, oversized prize, and future registered bodies.

Final M01 verification baseline:
- 29 automated tests PASS
- lint PASS
- TypeScript/Vite build PASS
- GitHub Pages base-path PASS
- headless Rapier/WebGL smoke PASS
- collider debug remains available with `D`
- COM/origin debug is available with `M`
- no prize parenting, hidden weld, scripted success/failure, or normal-play prize teleport was introduced

M02 is complete. Slice 1 provides fixed-step X/Z carriage motion, a dynamic claw hub on a stiff/damped spherical suspension, and PT-006 swing-from-braking. Slice 2 adds variable reel payout, physical DROP/LIFT motion, PT-008 horizontal-momentum preservation, and a rigid OPEN/transport finger profile. Slice 3 adds lift-completion detection and a braking-aware physical carriage return/home path. The closed M01 three-finger grasp/contact behavior remains unchanged.

M03 slice 1 is now verified: PT-007 proves that repeated X-axis reversals near the physical resonance cadence can deliberately grow swing, while off-cadence reversals decay. No special swing button, direct swing-angle write, hidden force injection, or transform parenting is used.

### First milestone

A gray-box machine containing:

- one 3-prong claw,
- one gantry,
- suspended claw dynamics,
- early close,
- close / pickup / retaining force,
- a box, ball, and simple teddy,
- 10–15 prizes,
- a physical prize chute.

It is successful when the same physical system can naturally produce:
- a stable pickup,
- a slow slip,
- an off-center rotation,
- a hook,
- a failed grip,
- a push/drag,
- and swing-induced release,

without parenting or magnetically attaching the prize to the claw.

## Documentation

- [Game Design](docs/GAME_DESIGN.md)
- [Physics Specification](docs/PHYSICS_SPEC.md)
- [Data & Content Architecture](docs/DATA_ARCHITECTURE.md)
- [Development Roadmap](docs/ROADMAP.md)
- [Acceptance Tests](docs/ACCEPTANCE_TESTS.md)
- [Project Context](docs/PROJECT_CONTEXT.md)
- [Real-Machine Reference Notes](docs/REAL_MACHINE_REFERENCES.md)
- [Real-Machine Calibration Plan](docs/CALIBRATION_PLAN.md)
- [M01 Three-Prong Claw Geometry Baseline](docs/CLAW_GEOMETRY_BASELINE.md)
- [GitHub Pages Deployment](docs/DEPLOYMENT.md)

## Core non-negotiables

1. Do not decide pickup success with RNG in pure simulation mode.
2. Do not parent a grabbed prize to the claw.
3. Do not teleport prizes during normal play.
4. Do not replace collision outcomes with canned animation.
5. Preserve horizontal claw momentum during descent.
6. Separate physical hold force from guaranteed-prize rules.
7. Build machine and prize content from configuration data rather than hard-coded one-off logic.
8. Prefer stable approximations over unstable "perfect" soft-body or rope simulation.

## Proposed technical direction

Initial recommended stack:

- TypeScript
- PlayCanvas or another WebGL/WebGPU-capable 3D engine
- Rapier 3D for rigid-body physics
- Vite
- fixed-step physics, initially targeting 120 Hz
- deterministic seeds for repeatable test scenes where practical

The engine choice remains a pre-production decision; physics behavior and acceptance criteria are authoritative over any specific framework.

## Reference machine families

The design is inspired by real commercial machine behavior rather than a single brand or cabinet. Reference categories include:

- SEGA UFO CATCHER-style 2-prong machines
- commercial 3-prong plush cranes
- ELAUT-style premium cranes
- mini cranes / keychain machines
- Taiwan self-service claw-machine rulesets and guaranteed-prize operation

See the design documents for which behaviors are simulated directly and which are approximated.

## Immediate next step

Continue **M03 — Swing Techniques** with front/back and diagonal swing reproduction, then validate descent while a deliberately amplified swing is still in progress.

Closed M02 lab controls:
- default scene: `?scene=gantry-lab`
- Arrow keys: manual X/Z gantry motion
- `Space`: physical DROP/LIFT; reaching the top after LIFT starts automatic home return
- `H`: start physical home return when reel is already at the top
- `P`: deterministic PT-006 hard-brake swing regression
- `T`: deterministic PT-008 momentum-during-descent regression
- `D`: collider debug
- `M`: COM/origin debug

M02 closure baseline:
- hard-brake peak swing ≈ 0.036 rad (~2.1°)
- OPEN transport finger flex ≤ 0.035 rad (~2°)
- DROP descent ≈ 0.280 m with horizontal momentum preserved
- full physical LIFT back to payout 0
- lift-completion → home return uses the same X/Z speed/acceleration/braking limits
- closure regression starts ~0.317 m off home and returns to ~1.76 mm home error in 125 fixed ticks
- residual hub swing remains physical during return; max relative offset ≈ 10.7 mm
- no hub/carriage teleport or transform parenting
- **43 automated tests PASS**

M03 slice 1 current calibration:
- suspension horizontal spring stiffness: 170 N/m
- horizontal damping: 1.0 N·s/m
- corrective-force clamp: 4 N
- transport-only OPEN finger hold: stiffness 6000, damping 340, max torque 50
- PT-006 hard-brake peak swing ≈ 0.049 rad (~2.8°)
- PT-007 at 0.40 s half-period: early peak ≈ 20.9 mm → late peak ≈ 24.2 mm (+15.9%)
- PT-007 off-cadence 0.30 s: ≈ 11.9 mm → 8.4 mm (decays)
- current OPEN transport finger flex ≤ 0.0328 rad (~1.9°)
- PT-008 DROP/LIFT and M02 home-return regressions remain PASS
- **44 automated tests PASS** after removing calibration-only exploration tests

M03 remains IN PROGRESS: front/back swing, diagonal swing, and deliberate off-axis descent after swing-building are still pending dedicated acceptance.

## Status

This repository is the source of truth for the Claw Chaos project.
