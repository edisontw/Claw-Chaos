# Project Context

Last updated: 2026-09-28

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

## M01 implementation status — slice 1 complete

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
- open tip span about 296 mm in command-space geometry
- open/closed targets +0.22 / -0.42 rad

M01 as a whole is **not complete**. COM visualization, prize-contact experiments and M01 exit criteria remain.

## Current next step

Proceed with **PT-001 Centered ball pickup** inside `claw-lab`: add one physically simulated sphere with explicit mass/friction, place it under the three-prong claw, and tune only documented motor/contact parameters until the ball can be supported and lifted by geometry/contact alone. Do not add attachment or scripted success logic.

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
