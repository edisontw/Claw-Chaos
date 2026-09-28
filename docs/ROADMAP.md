# Development Roadmap

Version: 0.1  
Date: 2026-09-28

## Roadmap principle

Build the simulator from the inside out.

Do not begin with a full arcade, progression, NPC crowds, or a large prize catalogue.

Each phase has an exit gate. Do not proceed merely because code exists; proceed when behavior is convincing and regression-tested.

---

# M00 — Repository & simulation harness

## Goal

Create a minimal development environment capable of running deterministic/repeatable physics test scenes.

## Deliverables

- project bootstrap
- fixed-step physics loop
- basic 3D scene
- debug controls
- physics debug overlay foundation
- test-scene loader
- seeded scene initialization
- CI/lint/test baseline

## Exit criteria

- app launches locally
- fixed physics timestep is independent of render FPS
- one dynamic cube falls and settles reproducibly within tolerance
- a test scene can be selected by ID/URL/debug menu

---

# M01 — Claw Physics Laboratory

## Goal

Prove a physically driven 3-prong claw before building a cabinet.

## Scene

Gray room containing:
- claw hub,
- 3 independent fingers,
- floor,
- box,
- ball,
- simple compound teddy.

## Deliverables

- hub rigid body
- 3 hinge/revolute finger joints
- open/close motor target
- configurable close torque
- configurable material friction
- COM visualization
- collision/contact debug view

## Required experiments

1. centered ball grip
2. low-friction ball slip
3. off-center box pinch/rotation
4. teddy limb hook
5. one-finger contact
6. object too large for full close

## Exit criteria

- fingers stop physically when blocked
- prize is never attached to claw
- low-friction prize can visibly slide out
- off-center prize rotates naturally
- hook can succeed through geometry alone
- no major solver explosion/jitter

---

# M02 — Gantry & Suspended Claw

## Goal

Create the mechanical motion of a real cabinet.

## Deliverables

- X/Z carriage
- speed/acceleration/braking limits
- suspension constraint
- configurable suspension length/damping
- vertical reel control
- lift/return mechanics

## Exit criteria

- claw lags under acceleration
- hard stop produces a readable swing
- no rigid-lock effect under the carriage
- claw returns toward center through damping/gravity
- motion is stable at target fixed timestep

---

# M03 — Swing Techniques

## Goal

Make "甩爪" a real, learnable interaction.

## Deliverables

- preserved horizontal momentum
- lateral swing
- front/back swing
- diagonal swing
- phase-building through reversals
- descent while swinging

## Exit criteria

A tester can intentionally reproduce:
- left/right swing,
- front/back swing,
- diagonal swing,
- larger swing through timed reversal,
- off-axis descent caused by momentum.

No special swing button is used.

---

# M04 — Drop, Early Close, Force Phases

## Goal

Complete the first authentic claw-machine play cycle.

## Deliverables

- machine state machine
- DROP
- DESCENDING
- player-triggered EARLY CLOSE ("收爪")
- automatic floor/travel close
- CLOSE torque phase
- PICKUP torque phase
- RETAINING torque phase
- optional HOLD BOOST
- return
- release

## Exit criteria

- pressing action during descent closes early
- closing takes time and can be physically blocked
- strong close + weak retaining force can produce delayed slip
- hold boost changes force, not attachment
- player can deliberately allow release by withholding boost
- state transitions do not zero prize motion

---

# M05 — Prize Physics Library v1

## Goal

Create reusable prize content.

## Deliverables

At least:
- cube
- box
- tall box
- flat box
- sphere
- ellipsoid
- cylinder/capsule
- pillow
- simple teddy
- simple animal

Plus:
- material profiles
- mass profiles
- COM profiles
- PrizeFactory
- 6–12 colors
- basic pattern/material variants

## Target

50–100+ generated visible variants.

## Exit criteria

- prize creation is data-driven
- same shape can behave differently by material/mass/COM
- no prize-specific grab code
- 10–15 object pile can settle and remain stable

---

# M06 — Cabinet & Chute

## Goal

Move the working simulation into a real cabinet.

## Deliverables

- cabinet frame
- glass collision/rendering
- play-area walls
- chute geometry
- chute sensor
- control panel
- basic cabinet lighting
- machine limits

## Exit criteria

- prizes cannot escape through cabinet
- chute accepts a prize only after physical entry
- prize touching chute lip does not auto-win
- claw cannot travel outside legal play area
- glass remains readable enough for gameplay

---

# M07 — First-Person Player View

## Goal

Make play feel like standing at the cabinet.

## Deliverables

- head look ≥ ±90° yaw
- preferred ±100–110° tuning
- limited vertical look
- small forward/back movement
- small left/right movement
- lean
- control-panel interaction
- front/side visual inspection

## Exit criteria

Player can:
- aim from front,
- move sideways,
- judge depth through side glass,
- look down at controls,
- look at chute,
without free-fly or clipping through cabinet.

---

# M08 — Visual & Audio Realism Pass 1

## Goal

Make the single cabinet believable without overbuilding content.

## Deliverables

- PBR cabinet materials
- controlled glass reflections
- rails/cable/winch detail
- LEDs
- mechanical audio
- prize contact audio
- simple arcade ambience
- optional controller haptics

## Exit criteria

- machine movement has identifiable mechanical sound
- cardboard/plastic/plush contacts differ
- glass reflections do not obscure aiming
- no major visual mismatch between collision and mesh

---

# M09 — Layout Gameplay

## Goal

Expand beyond loose piles.

## Deliverables

- loose pile
- dense pile
- showcase
- bridge
- edge
- ring/loop
- chute-adjacent arrangement
- deterministic layout seed
- physics settle pipeline

## Exit criteria

- bridge can be solved by repeated physical rotation/translation
- ring can be hooked through actual geometry
- layout reset does not force identical final poses unless using a fixed seed

---

# M10 — Staff & Restocking

## Goal

Simulate cabinet maintenance and prize depletion.

## Deliverables

- inventory count
- restock threshold
- CALL STAFF interaction
- staff policy
- service state
- short staff approach/open/reposition/close sequence
- restock placement + physics settle

## Exit criteria

- player cannot arbitrarily request an ideal winning placement
- depleted machine can be restocked
- post-restock pile is physically stable and non-identical across seeds
- machine pauses safely during service

---

# M11 — Second Machine Family

## Preferred order

Add a 2-prong UFO-style machine.

## Deliverables

- 2-prong claw definition
- appropriate finger geometry
- box-focused layouts
- bridge-focused tuning

## Exit criteria

- shares core physics architecture
- does not duplicate entire simulator logic
- feels mechanically distinct from 3-prong machine

---

# M12 — Commercial & Guaranteed-Prize Rulesets

## Goal

Separate pure physics from commercial operation.

## Deliverables

- Pure Simulation ruleset
- Commercial Simulation configuration
- accumulated-spend state
- Taiwan-style guaranteed-prize ruleset data model
- operator-configurable pickup/retaining behavior
- debug disclosure of active parameters

## Exit criteria

- Pure Simulation has fixed physical parameters
- commercial behavior adjusts explicit machine parameters rather than forcing win/lose outcomes
- guaranteed-prize state is separate from hold force

---

# M13 — Arcade Room

## Goal

Build a believable small arcade around proven gameplay.

## Deliverables

- 4–8 machine slots
- neighboring cabinet visuals
- ambient audio field
- staff route
- limited NPC presence
- machine selection/approach

## Exit criteria

- only active/near cabinet receives highest physics fidelity
- neighboring machines do not degrade active-cabinet simulation
- moving between cabinets feels natural

---

# M14 — Public Demo

## Target content

- 1 arcade room
- 3-prong machine
- 2-prong machine or clearly distinct second setup
- 8+ base prize geometries
- 100+ visual variants
- multiple materials/COM profiles
- swing
- early close
- close/pickup/retaining phases
- hold boost where configured
- loose/bridge/ring or edge layouts
- staff call/restock
- challenge mode
- stable save/config version

## Demo acceptance

The build must be fun in gray-box skill terms before content polish is judged.

---

# M15+ — Expansion

Possible directions:
- mini cranes
- premium cranes
- overhead-camera cabinets
- more plush articulation
- additional store themes
- operator mode
- maintenance/calibration gameplay
- analytics
- challenge editor
- Steam build
- WebGPU/desktop rendering upgrade
- VR experimentation
- optional advanced soft-body experiments

---

# Work-order rule for coding agents

Each development pass should:
1. read `docs/PROJECT_CONTEXT.md`,
2. read only the relevant spec sections,
3. implement one coherent milestone slice,
4. add/update regression tests,
5. update roadmap status,
6. avoid unrelated refactors,
7. preserve physics-first constraints.

If a feature is too complex:
- implement the closest stable approximation,
- document the approximation,
- leave an upgrade path,
- do not fake the result with hidden attachment/success logic.

# Cross-cutting gates added after design review

These gates apply across milestones.

## Web delivery gate

Before M00 is considered complete:
- Vite production build must succeed,
- repository-relative asset paths must work under `/Claw-Chaos/`,
- production build must run with `npm run preview`,
- GitHub Pages deployment workflow may be enabled once the app scaffold exists,
- no asset URL may assume deployment at domain root unless intentionally configured.

See `docs/DEPLOYMENT.md`.

## Calibration gate

Before declaring M04/M06 "realistic":
- create at least one reference-machine calibration record,
- record measured or inferred carriage timing,
- record swing period/damping,
- record claw dimensions/open span,
- record descent/lift timing,
- document uncertainty.

See `docs/CALIBRATION_PLAN.md`.

## Replay/debug gate

Before extensive gameplay tuning:
- fixed-tick input recording exists,
- layout seeds are logged,
- active machine force phases are inspectable,
- a physics bug can be reproduced by a test scene or replay/checkpoint.

## Content/legal gate

Before public demo:
- maintain asset manifest,
- verify licenses,
- use generic/original prize art unless specific rights are available,
- avoid manufacturer trade dress/logo copying.

## Current execution order

The immediate order is:

```text
M00 repository + Vite/Web/physics harness
→ M01 claw physics laboratory
→ M02 gantry/suspension
→ M03 swing
→ M04 drop/early-close/force phases
```

Do not start the full arcade environment before these gates pass.
