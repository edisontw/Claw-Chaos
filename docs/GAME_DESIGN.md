# Claw Chaos — Game Design Document

Version: 0.1  
Date: 2026-09-28  
Status: Pre-production baseline

## 1. Vision

Claw Chaos is a high-fidelity first-person claw machine simulator built around mechanical behavior and physical interaction.

The target feeling is:

> "I am standing in front of a real cabinet, reading the prize pile, judging the claw, timing the swing, and physically changing the next attempt."

A play result should be explainable by:
- where the claw went,
- how fast it was moving,
- where the fingers contacted,
- how hard they closed,
- prize mass and center of mass,
- contact friction,
- support from neighboring prizes,
- suspended swing,
- retaining force during lift,
- collisions on the way back,
- and chute geometry.

The game is not centered on a hidden success roll.

## 2. Design pillars

### 2.1 Physics-first authenticity

The claw must really touch, close around, push, hook, drag, rotate, lift, and release prizes.

A prize that appears held remains a normal physics object. It is not parented to the claw and is not magnetically locked.

### 2.2 First-person physical observation

The player observes through glass as a real player would:
- front view,
- side-angle view,
- small head/body movement,
- leaning,
- looking down at controls and chute,
- looking toward staff or adjacent machines.

The player is not given a free spectator camera in normal play.

### 2.3 Skill through timing and mechanical understanding

Player mastery should include:
- depth judgment,
- center-of-mass reading,
- selecting contact points,
- swing phase,
- early-close timing,
- deciding whether to push, hook, flip, drag, or lift,
- deciding when a temporary hold boost is useful,
- recognizing when the prize needs another setup attempt rather than a direct grab.

### 2.4 Persistent pile state

Failed attempts should matter.

A "failure" may improve the state:
- move a box closer to the chute,
- turn a prize,
- expose a tag,
- free a trapped limb,
- create a gap,
- knock support away,
- move an obstacle,
- make the next attempt easier.

### 2.5 Data-driven variety

Machines, claws, prizes, materials, layouts, rulesets, stores, and operator profiles must be configuration-driven.

The project should gain content primarily by composing reusable data rather than hard-coding one-off prize classes.

---

# 3. Target experience

## 3.1 First minute

The player:
1. approaches a machine,
2. looks through front and side glass,
3. inserts credit / starts play,
4. moves the claw,
5. notices the claw head lags and swings after a stop,
6. presses DROP,
7. presses CLOSE before the claw reaches the floor,
8. watches fingers physically contact the prize,
9. sees the prize rotate or slide,
10. learns that the pile has actually changed.

## 3.2 First hour

The player begins to recognize:
- easy vs awkward center of mass,
- smooth boxes vs grippy plush,
- strong close but weak return hold,
- machine braking that creates a useful swing,
- when to aim for a push rather than a lift,
- when a staff reposition is legitimate,
- differences between 2-prong and 3-prong machines.

## 3.3 Expert play

Expert behavior should include:
- deliberate pendulum phase control,
- diagonal swing,
- swinging during descent,
- early close into a moving target,
- controlled hook attempts,
- bridge-box rotation,
- using another prize as a fulcrum,
- using one prize to knock another,
- deliberately releasing a loosely held prize over the chute,
- minimizing attempts by planning multi-step transformations.

---

# 4. Camera and player embodiment

## 4.1 Baseline first-person pose

The default pose represents a person standing roughly 45–70 cm from the cabinet front.

The actual eye height should be configurable.

## 4.2 Look envelope

Minimum target:
- yaw: ±90°

Preferred:
- yaw: ±100–110°
- pitch up: about +30°
- pitch down: about -40°

This should let the player:
- face the front glass,
- look toward either side glass,
- inspect control panel and prize chute,
- glance at neighboring cabinets and staff.

## 4.3 Body movement

Normal interaction zone:
- forward/back: about 35–50 cm
- left/right: about 30–40 cm
- lean: about ±15–20 cm

These values are design targets, not final tuning constants.

The purpose is to let the player physically "check the side" like a real arcade player.

## 4.4 Camera restrictions

Normal play must not allow:
- clipping through glass,
- teleporting to side/back service areas,
- free-fly,
- unrestricted top-down view,
- orbiting around the prize.

## 4.5 In-world overhead camera

Some modern machines support overhead-camera-style assistance.

If implemented:
- it is a machine-specific feature,
- the image appears on a physical/in-world display,
- it does not become a universal game camera.

---

# 5. Cabinet and machine simulation

## 5.1 Mechanical hierarchy

Typical 3-prong configuration:

```text
Cabinet
├─ X rail
│  └─ gantry
│     └─ Z rail / carriage
│        └─ winding mechanism
│           └─ cable / suspension
│              └─ claw hub
│                 ├─ finger A
│                 ├─ finger B
│                 └─ finger C
└─ prize chute
```

Typical 2-prong configuration:

```text
claw hub
├─ left arm
└─ right arm
```

## 5.2 Gantry movement

The gantry must expose physical/control parameters such as:
- maximum speed,
- acceleration,
- deceleration,
- braking response,
- control latency,
- end-stop limits,
- optional small mechanical backlash.

The claw head must not be transformed directly to a perfectly rigid point under the carriage.

## 5.3 Suspended head

The claw head has:
- suspension length,
- angular limits,
- damping,
- effective mass,
- torsional damping,
- optional small yaw freedom.

A simplified pendulum/constraint model is acceptable if a full cable simulation is unstable.

---

# 6. Claw swing ("甩爪")

## 6.1 Principle

Swing is an emergent result of gantry acceleration/braking and suspension physics.

There is no "swing skill" button.

## 6.2 Player techniques

The system must support:
- lateral swing,
- forward/back swing,
- diagonal swing,
- building amplitude through repeated reversal,
- dropping while the claw is moving,
- early closing while the claw is moving,
- carrying a prize while the claw/prize system swings.

## 6.3 Descent momentum

Beginning descent must not zero horizontal velocity.

The claw may therefore follow a sloped or curved horizontal trajectory while descending.

This is required for:
- entering gaps,
- hooking,
- reaching around a direct vertical obstruction,
- side-pushing during descent.

## 6.4 Prize-carry swing

A carried prize changes:
- total suspended mass,
- center of mass,
- damping,
- swing period,
- rotational behavior.

An off-center grip should be visibly less stable than a centered one.

---

# 7. Drop and early close ("收爪")

## 7.1 Input flow

Primary action changes meaning by state:

```text
AIM -> press action -> DROP
DESCENDING -> press action -> EARLY CLOSE
```

If the player does not early-close, the machine closes on configured floor/travel logic.

## 7.2 Closing behavior

Closing must:
- take measurable time,
- use motor/joint force,
- be resisted by prize contact,
- permit asymmetric finger positions,
- permit one finger to contact before the others.

The claw must not instantly snap into a closed animation pose.

## 7.3 Why early close matters

It enables:
- catching upper geometry,
- closing immediately after a finger slips past an edge,
- grabbing during a swing,
- avoiding overly deep penetration into a pile,
- hooking,
- partial grabs,
- using fingers as pushers.

---

# 8. Force phases

The simulation separates force behavior into distinct phases.

## 8.1 Close force

Force/torque while fingers are actively closing.

## 8.2 Pickup force

Force around the first lift interval.

## 8.3 Retaining / holding force

Force maintained during upward travel and return.

A real-feeling machine can therefore:
- close strongly,
- initially lift successfully,
- then allow a prize to slowly slip as retaining force becomes lower.

## 8.4 Hold boost

An optional machine mechanic controlled by the player.

Possible implementation:
- press/hold button to temporarily raise retaining torque,
- limited duration,
- configurable per machine,
- no magical attachment.

Use cases:
- survive peak swing load,
- stabilize during initial lift,
- delay a slow slip,
- deliberately avoid boosting so a prize releases over the chute.

## 8.5 Guaranteed-prize ruleset

This is a separate commercial/ruleset concept.

Do not conflate:
- physical retaining force,
- hold boost,
- guaranteed-prize / accumulated-spend operation.

A Taiwan-style ruleset may track the player's accumulated amount and apply the cabinet/operator policy when the guarantee condition is reached.

---

# 9. Prize interaction vocabulary

The physics system should naturally support:

## 9.1 Grab

Multiple fingers support the prize sufficiently to lift it.

## 9.2 Hook

One or more fingers catch:
- a limb,
- ring,
- tag,
- handle,
- box lip,
- gap.

## 9.3 Push

A finger moves a prize laterally without lifting it.

## 9.4 Drag

The claw partially grips or traps a prize and moves it across a surface.

## 9.5 Flip

The claw applies torque causing a prize to rotate into a better/worse pose.

## 9.6 Roll

Round/curved prizes move due to contact and gravity.

## 9.7 Knock

A carried or moving prize collides with another prize.

## 9.8 Jam

A prize becomes constrained by:
- chute edge,
- another prize,
- bridge bars,
- cabinet wall,
- claw.

Jams should be physical states, not just scripted "fail" messages.

---

# 10. Prize physics

Every prize definition includes:

- collision shape or compound shape,
- dimensions,
- mass,
- center of mass,
- inertia,
- static friction,
- dynamic friction,
- restitution,
- material category,
- optional articulated joints,
- optional attachment geometry (tag/ring/handle).

## 10.1 Rigid prizes

Examples:
- boxes,
- balls,
- cans,
- cylinders,
- bottles,
- plastic capsules.

## 10.2 Plush approximation

Initial production approach:
- compound rigid or articulated rigid body,
- head/body/limbs represented by simple colliders,
- soft angular joints,
- skinned visual mesh.

This must support:
- neck hooks,
- arm hooks,
- leg hooks,
- asymmetric hanging,
- compression-like visual behavior.

A true deformable soft body is a later experimental feature, not a prerequisite.

---

# 11. Prize content system

## 11.1 Base geometry library

Initial target families:

1. cube
2. rectangular box
3. tall box
4. flat box
5. sphere
6. ellipsoid
7. cylinder
8. capsule
9. cone
10. ring
11. pillow
12. bag
13. bottle
14. plush humanoid
15. plush animal
16. irregular toy

## 11.2 Visual variation

Recommended initial color palette:
- red
- orange
- yellow
- green
- cyan
- blue
- purple
- pink
- white
- black
- gray
- brown

Material families:
- matte cardboard
- glossy cardboard
- PVC/plastic
- transparent plastic
- rubber
- fabric
- plush
- metal

Patterns/accessories can add:
- stripes,
- geometric print,
- label,
- clear window,
- ribbon,
- tag,
- ring,
- handle.

## 11.3 Physical variation

The same visual geometry may have different:
- mass profile,
- center-of-mass profile,
- friction,
- packaging,
- internal ballast.

This creates learnable physical differences without requiring a unique mesh for every prize.

## 11.4 Content scaling

Example combinatorial capacity:

```text
16 shapes × 12 colors × 4 common materials = 768 base combinations
```

Not all combinations need to be used, but the architecture must make hundreds of variants inexpensive.

---

# 12. Machine families

## 12.1 Three-prong plush crane

Best for:
- plush,
- balls,
- mixed loose prizes,
- small/medium boxes.

Core skills:
- positioning,
- swing,
- early close,
- partial grip,
- hold timing.

## 12.2 Two-prong UFO-style machine

Best for:
- boxed figures,
- bridge setups,
- edge pushes,
- rotation,
- ring/handle configurations.

Core skills:
- left/right finger control through positioning,
- asymmetric contact,
- controlled rotation,
- repeated setup attempts.

## 12.3 Premium crane

Best for:
- larger/heavier prizes,
- higher-value merchandise,
- more precise machine configuration.

Possible features:
- larger cabinet,
- weight-aware operator configuration,
- overhead camera monitor,
- premium lighting/feedback.

## 12.4 Mini crane

Best for:
- keychains,
- capsules,
- candy-sized items,
- small figures.

Requires smaller collision tolerances and careful CCD.

---

# 13. Prize layouts

## 13.1 Loose pile

Natural randomized pile after physics settling.

## 13.2 Dense pile

More tightly packed; strong support from neighbors.

## 13.3 Showcase arrangement

Visually organized but still physically simulated.

## 13.4 Bridge

Box supported by two rails/bars.

Goal often becomes:
- rotate,
- translate,
- lower one corner,
- progressively drop through the gap.

## 13.5 Ring / loop

Prize includes a loop/handle designed for claw-tip interaction.

## 13.6 Edge / ledge

Prize must be pushed/dragged/rotated off an edge.

## 13.7 Chute-adjacent pile

Loose prize field near a raised chute barrier.

---

# 14. Difficulty and prize value

Prize value must not directly map to a hidden miss probability.

Difficulty can be expressed through:
- heavier mass,
- smoother surface,
- larger/wider geometry,
- awkward center of mass,
- tight packing,
- lower retaining force,
- shorter pickup/boost duration,
- narrower claw span,
- less favorable claw finger profile,
- difficult bridge gap,
- taller chute barrier,
- stricter movement limits,
- lower suspension damping.

A high-value item may be mechanically difficult but still honestly obtainable through skill.

---

# 15. Game modes

## 15.1 Arcade Visit

Primary immersive mode.

Features:
- first-person arcade,
- credits/currency,
- multiple machines,
- staff,
- restocking,
- persistent machine state.

## 15.2 Pure Simulation

For skill and physics testing.

Properties:
- fixed physical parameters,
- no hidden adaptive strength,
- no payout regulator,
- repeatable seeds where practical,
- optional inspection/debug tools outside the normal play view.

## 15.3 Challenge

Examples:
- win within N attempts,
- win under a budget,
- use only push/flip techniques,
- no hold boost,
- bridge challenge,
- hook challenge.

## 15.4 Operator Mode

Player manages:
- prize cost,
- play price,
- machine claw profile,
- pickup/retaining force,
- restocking,
- layouts,
- maintenance,
- machine performance.

Operator mode should expose the consequences of settings rather than simply provide a "profit slider".

---

# 16. Staff and service

## 16.1 Call staff

The player may request service.

Possible reasons:
- prize pile depleted,
- prize clearly inaccessible due to pile migration,
- prize jam,
- suspected machine fault,
- restock needed.

## 16.2 Store policy

Each store/operator profile may be:
- friendly,
- standard,
- strict.

This controls which reposition requests are accepted.

The player cannot freely command:
- "place this prize right next to the chute".

## 16.3 Service sequence

Target in-world flow:

```text
CALL
-> staff approaches
-> machine pauses
-> service door opens
-> reposition/restock/service
-> door closes
-> machine resumes
```

Early implementation can use a compact state machine and authored animation.

## 16.4 Restocking

Restocking should not reset the entire machine to a fixed snapshot.

Preferred:
1. generate placement targets,
2. place/add prizes with small random offsets,
3. run physics settling,
4. validate no impossible interpenetrations,
5. begin play.

---

# 17. Prize depletion and dynamic cabinet state

Cabinets maintain inventory.

Example state:
- capacity: 24 prizes
- restock threshold: 7

When enough prizes have been removed:
- machine may become sparse,
- prize difficulty may change naturally,
- staff may restock.

Morning, afternoon, and post-restock states should look meaningfully different.

---

# 18. Prize chute and win detection

The chute must have real geometry.

Win detection should use a sensor/trigger volume in the retrieval path.

A prize is awarded only after it physically enters/passes the configured sensor region.

Do not award merely because:
- the prize touched the chute lip,
- the claw carried it above the chute,
- a bounding box briefly overlapped the chute opening.

---

# 19. Visual realism

## 19.1 Cabinet

Include progressively:
- glass,
- frame seams,
- service doors,
- locks,
- casters,
- rails,
- cables,
- winch,
- claw wiring,
- LEDs,
- control panel,
- credit display,
- chute flap.

## 19.2 Glass

Glass should show:
- restrained reflections,
- LED reflections,
- environmental light,
- subtle fingerprints/smudges,
- small wear.

Gameplay clarity takes priority over physically perfect optical glass.

## 19.3 Prizes

Details by maturity:
- box edges,
- printed labels,
- clear windows,
- plastic wrap highlights,
- plush fibers,
- sewn seams,
- tags,
- mild compression/deformation,
- scuffs.

## 19.4 Arcade environment

Later phases add:
- adjacent cabinets,
- ceiling lights,
- signs,
- ambient machine light,
- floor reflection,
- staff,
- other players,
- changing sound field.

---

# 20. Audio realism

## 20.1 Machine audio

- gantry motor,
- rail movement,
- braking,
- winch,
- cable movement,
- claw motor/coil,
- button click,
- coin/credit sound,
- chute impact,
- cabinet/service door.

## 20.2 Prize contact audio

Material-driven contact:
- cardboard,
- plastic,
- plush,
- metal,
- glass/cabinet,
- rubber.

## 20.3 Arcade ambience

- neighboring machine sounds,
- music,
- announcements,
- crowd,
- footsteps,
- staff voices.

Audio should be spatialized.

---

# 21. Haptics

Optional controller haptics:
- gantry stop,
- claw impact,
- heavy lift load,
- major prize collision,
- chute win.

Keep feedback restrained and mechanically motivated.

---

# 22. UI and controls

## 22.1 UI philosophy

Prefer in-world UI.

Machine panel can display:
- credit,
- timer,
- accumulated amount,
- guaranteed-prize state,
- machine prompts.

Minimal floating HUD.

## 22.2 Suggested keyboard/mouse prototype controls

Player body:
- WASD: small movement around cabinet
- Mouse: head look
- Q/E: lean

Machine:
- arrows or secondary control mapping: joystick
- Space: drop / early close
- Shift: optional hold boost
- F: interact

Final mapping will be usability-tested.

## 22.3 Controller

A gamepad may map:
- left stick: machine joystick,
- right stick: head look,
- trigger/stick modifier: body shift,
- face button: drop/close,
- shoulder/trigger: hold boost.

---

# 23. State machine

Baseline machine state:

```text
ATTRACT
  ↓
CREDIT
  ↓
READY / AIM
  ↓
DROP
  ↓
DESCENDING
  ├─ early close
  └─ floor/travel close
  ↓
CLOSING
  ↓
SETTLE
  ↓
LIFT
  ↓
HOLD
  ↓
RETURN
  ↓
RELEASE
  ↓
CHUTE CHECK
  ↓
RESULT / READY
```

State changes must not silently teleport prize state.

---

# 24. Commercial simulation

A separate commercial-simulation ruleset may model operator configuration such as:
- vend price,
- prize cost,
- pickup power,
- retaining power,
- pickup duration,
- target operating profile.

The system may alter real mechanical parameters according to the configured machine logic.

However:
- the final physical result still comes from simulation,
- Pure Simulation mode must keep physics parameters fixed,
- ruleset behavior must be inspectable in debug/operator views.

---

# 25. Taiwan-style guaranteed-prize ruleset

If a Taiwan ruleset is enabled, keep a separate state for:
- accumulated spend,
- guarantee threshold,
- whether the current prize/machine is under guarantee operation,
- how the store satisfies the guarantee.

Do not implement this by silently changing the player's physics without representing the corresponding ruleset behavior.

Regulatory details can change; exact limits/policies must be kept in data/config and validated against current rules before release.

---

# 26. Anti-cheat / cabinet abuse simulation

Optional realism:
- cabinet tilt/shock detection,
- warning state,
- machine abort/open-claw response for severe physical abuse.

Player body movement should not allow physically shoving the cabinet during standard play.

---

# 27. Progression

Progression should not make the claw supernaturally powerful.

Preferred progression:
- access to new arcades,
- new machine families,
- challenge certifications,
- prize collection,
- machine knowledge,
- operator tools,
- cosmetic player/room customization,
- advanced simulator tools.

Skill remains transferable.

---

# 28. Failure philosophy

The game should avoid binary "failure" framing.

An attempt can be useful if it:
- changes pose,
- exposes a hook point,
- frees the prize,
- moves it closer to chute,
- weakens pile support,
- rotates a box on a bridge.

Score/challenge systems may recognize setup efficiency.

---

# 29. Accessibility

Plan for:
- adjustable look sensitivity,
- optional reduced head bob,
- optional reduced swing-camera response (does not change claw physics),
- remappable controls,
- subtitles,
- high-contrast interaction prompts,
- color-independent state indicators,
- optional aim reference marks only in accessibility/training modes.

Accessibility assists must not silently change Pure Simulation physics unless explicitly selected.

---

# 30. Technical approximation policy

When exact simulation is too expensive or unstable, use the closest stable behavior.

| Real phenomenon | Ideal | Initial production approximation |
|---|---|---|
| Plush deformation | deformable soft body | articulated compound rigid body + skinning |
| Cable dynamics | segmented rope | pendulum/suspension constraint |
| Metal finger flex | elastic FEM | joint spring/compliance |
| Cardboard deformation | deformable shell | rigid collider + visual flex |
| Fur micro-contact | surface microgeometry | material friction + shader |
| Plastic wrapping | cloth film | mesh/material response |
| Glass optics | path/ray tracing | PBR + reflection probe |
| Large dense prize piles | detailed mesh collision | simplified compound collision |

---

# 31. Realism priority order

Do not compromise these first:
1. claw contact,
2. claw force behavior,
3. friction,
4. mass,
5. center of mass,
6. swing,
7. pile stability,
8. chute geometry.

Approximate later:
9. plush visual compression,
10. fine cable deformation,
11. packaging-film motion,
12. fiber-level fur.

---

# 32. Content targets

## First physics milestone
- 1 machine
- 1 three-prong claw
- 1 box
- 1 ball
- 1 simple teddy
- 10–15 total objects

## First public demo
- 1 arcade room
- 3-prong machine
- at least one additional machine setup or family
- 8+ base prize geometries
- 100+ visible variants
- multiple material/friction profiles
- swing
- early close
- force phases
- hold boost
- staff call
- restock

## Mature target
- 5–8 machine families/configurations
- 15–25 base prize geometries
- 300–1000+ data-driven visual/physical variants
- 10+ material profiles
- multiple claw geometries
- multiple store/operator profiles
- bridge/ring/edge/loose-pile layouts

---

# 33. Real-world reference direction

The project uses real commercial machine behavior as design references rather than cloning one cabinet.

Reference families/research:
- SEGA UFO CATCHER product family and 2-prong operation
- ELAUT E-Claw / E-Claw 2.0 premium crane systems
- commercial controller manuals describing pickup power, retaining power, pickup timing, and in-air close behavior
- Taiwan self-service claw-machine rulesets for guaranteed-prize operation

Useful starting references:
- https://www.sega.jp/arcade/detail/ufo-catcher-10/
- https://gamecenter-guide.sega.com/en/arcade/cranegame/
- https://www.elaut.com/games/claw-machines/e-claw-2-0
- https://www.elaut.com/all-news/e-claw-2-wonka-claw-new-products
- https://law.moea.gov.tw/

Do not copy protected trade dress, logos, branded prize characters, sound assets, or cabinet art.

---

# 34. Definition of success

The design succeeds when:

- an experienced claw-machine player can recognize real techniques,
- a beginner can understand why an attempt behaved as it did,
- the prize pile remains physically persistent,
- no hidden attachment is needed to make a pickup work,
- a player can intentionally produce swing, early close, push, hook, drag, flip, and controlled release,
- different machine configurations feel mechanically different,
- content can scale to hundreds of prize variants without hundreds of unique gameplay classes.

# 35. Real-machine control profiles

Not every cabinet should use the same control scheme.

Support configurable control profiles such as:

### Joystick + action button
Common flow:
- joystick moves X/Z,
- action starts descent,
- action may become early-close while descending.

### Direction buttons + action button
Used for cabinets that expose discrete direction buttons rather than an analog stick.

### Two-stage / limited-axis control
Some prize machines intentionally constrain the order or availability of movement axes.

The simulator should support a profile where:
- one stage selects one axis,
- a later stage selects the other axis,
- or movement becomes locked after DROP.

### Optional claw rotation control
Some specialized machines may permit controlled claw yaw/rotation.

This is not a universal default. Most baseline machines should let yaw/twist emerge from suspension mechanics rather than a free player rotation command.

Machine control profile must define:
- available axes,
- analog vs digital input,
- movement before/after DROP,
- early-close availability,
- hold-boost availability,
- play timer behavior,
- return/home behavior.

---

# 36. Credit, timer, and one-play lifecycle

A machine play is a complete lifecycle, not only a claw animation.

A configurable play may contain:

```text
IDLE
→ CREDIT ACCEPTED
→ READY
→ AIM TIMER
→ DROP
→ CLOSE
→ LIFT
→ RETURN
→ RELEASE
→ CHUTE CHECK
→ HOME
→ READY / OUT OF CREDIT
```

Machine profiles may define:
- price per play,
- number of credits,
- aim time limit,
- whether movement stops when time expires,
- whether DROP is automatic when aim time expires,
- whether player input is locked after DROP,
- delay before the next credit/play,
- attract-mode timing.

The baseline simulation must not assume infinite aiming time.

---

# 37. Home position, return path, and release timing

The carriage/claw must have an explicit home/release configuration.

A machine definition should specify:
- home X/Z,
- prize chute X/Z,
- return speed profile,
- whether lift completes before horizontal return,
- whether horizontal return begins while the claw is still settling,
- release height,
- release delay,
- finger opening speed,
- post-release wait,
- route back to home/ready position.

This matters because a carried prize can:
- swing during return,
- collide with cabinet/prizes,
- slide during deceleration,
- miss or strike the chute edge.

Do not teleport the claw above the chute.

---

# 38. Claw yaw, cable twist, and reel limits

The suspended claw is not only an X/Z pendulum.

Depending on machine profile, allow small:
- yaw rotation,
- torsional lag,
- twist damping.

The reel/winch should define:
- minimum cable length,
- maximum cable length,
- reel speed,
- reel acceleration,
- upper/lower limit behavior,
- stop tolerance,
- emergency stop behavior.

Initial implementation may use a simplified torsional spring rather than true cable twist.

---

# 39. Machine faults and recovery

Realistic play needs safe handling for faults without corrupting simulation state.

Fault categories may include:
- prize chute blocked,
- claw/finger jam,
- carriage limit fault,
- prize trapped in service-only region,
- sensor disagreement,
- physics instability watchdog,
- service door open.

Recovery rules:
- freeze or safely stop player input,
- preserve prize state when possible,
- move into SERVICE state,
- perform a visible/documented reset or staff intervention,
- never silently award/remove a prize to hide a physics bug.

A development-only hard reset is allowed, but production gameplay should explain the recovery in-world.

---

# 40. Physical calibration and real-machine measurement

"Realistic" requires measured references rather than only visual tuning.

Maintain a calibration dataset for representative real machines:

- cabinet dimensions,
- playfield dimensions,
- claw finger length and curvature,
- open span,
- claw head mass,
- suspension length,
- carriage speed,
- acceleration/braking time,
- drop/lift speed,
- swing period,
- damping,
- prize masses and dimensions,
- approximate material friction,
- chute dimensions,
- control/input latency.

Where direct torque measurement is unavailable, infer effective parameters from observable motion and load tests.

Every calibrated value should record:
- source/machine model,
- measurement method,
- uncertainty,
- whether it is a measured value, inferred value, or gameplay-tuned approximation.

See `docs/CALIBRATION_PLAN.md`.

---

# 41. Replay, observability, and explainable outcomes

Physics debugging and realism verification require an input/event recording system.

Record, where practical:
- fixed-tick number,
- input state,
- machine state,
- force phase,
- carriage transform/velocity,
- claw transform/velocity,
- finger joint angles,
- active machine parameters,
- prize transforms at checkpoints,
- chute sensor events,
- random/layout seed.

The goal is not perfect cross-platform bitwise determinism; it is reproducible diagnosis.

A failed grab should be explainable after the fact:
- low friction,
- off-center COM,
- weak retaining phase,
- excessive return swing,
- contact lost at a known tick,
rather than "the game decided to fail".

---

# 42. Web platform and performance tiers

GitHub Pages/Web builds are a first-class delivery target for development and public demos.

The active cabinet keeps full simulation fidelity.

Potential scaling strategy:
- active cabinet: full 120 Hz target physics,
- nearby inactive cabinets: simplified animation/low-rate state,
- distant cabinets: visual-only,
- sleeping prizes: zero active solver cost where supported.

Quality settings may reduce:
- reflection quality,
- shadow resolution,
- environment effects,
- decorative NPC count.

Quality settings must not secretly alter active-cabinet:
- mass,
- friction,
- claw force,
- contact geometry,
- gameplay timing.
