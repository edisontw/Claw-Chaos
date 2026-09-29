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

**M01 in progress — three-prong claw laboratory mechanics are live**

M00 is complete. M01 now has a three-prong mechanical baseline, realistic segmented claw geometry, and all six required physics experiments passing: centered pickup, retaining-force slip, off-center rotation, Teddy limb hook, blocked-finger independence, and oversized-object full-close blocking. Outcomes come from rigid-body contacts and explicit motor forces; there is no prize parenting, hidden weld, scripted release/rotation/hook, or success roll.

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

Continue **M01 — Claw Physics Laboratory** with **generic COM visualization tooling and the final M01 closure audit**.

The current `claw-lab` now provides:
- rigid hub plus three independent dynamic fingers,
- Rapier revolute joints and physical motor limits,
- configurable open/close motor command,
- `C` close, `O` open, `Space` toggle,
- `D` collider debug,
- visible joint pivot/axis diagnostics,
- realistic segmented hook geometry with three capsule colliders per finger,
- centralized provisional dimensions in `docs/CLAW_GEOMETRY_BASELINE.md`,
- centered 55 mm / 80 g PT-001 sphere with explicit friction/restitution,
- `P` automated close → lift → hold laboratory cycle,
- PT-001 PASS/FAIL and ball lift telemetry,
- `?experiment=pt002` pickup→retaining-force slip mode,
- PT-002 peak-lift/slip-loss/active-torque telemetry,
- `?experiment=pt003` off-center rectangular-box rotation scene,
- visible PT-003 COM and orientation markers,
- `?experiment=pt004` compound Teddy limb-hook scene,
- shared Teddy compound collider definition with visible hook-region/COM markers,
- `?experiment=pt005` one-finger blocker scene with per-finger angular-travel telemetry,
- `?experiment=oversized` dynamic oversized-prize close-block scene,
- matched empty-control vs oversized-prize close regression,
- active GitHub Pages deployment.

All six required M01 physics experiments are automated PASS. The oversized regression allows a near-normal open pose, then reduces actual close travel from about 0.240 rad in the matched control to roughly 0.052 / 0.001 / 0.001 rad through contact alone. Next consolidate COM markers into reusable tooling and perform the final M01 exit-criteria audit before starting M02.

## Status

This repository is the source of truth for the Claw Chaos project.
