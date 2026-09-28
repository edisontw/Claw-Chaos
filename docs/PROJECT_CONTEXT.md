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

## Current next step

Implement **M00 — Repository & simulation harness** from `docs/ROADMAP.md`.

M00 is intentionally before the claw Physics Laboratory. It must establish:
- Vite/TypeScript scaffold,
- fixed-step simulation loop,
- test-scene selection,
- seeded initialization,
- debug/diagnostic foundations,
- production build,
- GitHub Pages-safe `/Claw-Chaos/` asset paths.

After M00 passes, proceed to **M01 — Claw Physics Laboratory**.



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
