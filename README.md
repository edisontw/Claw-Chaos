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

**M06 IN PROGRESS — Cabinet & Chute**

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

M03 is now closed. Slice 1 PT-007 proves timing-sensitive lateral swing amplification, slice 2 verifies the same model for front/back and synchronized diagonal swing, and slice 3 proves that a deliberately amplified diagonal swing remains physical during DROP. No special swing button, direct swing-angle/velocity write, hidden force injection, transform parenting, or descent-time state reset is used.

M04 is now closed. The play-cycle state machine covers physical DROP, EARLY/AUTO CLOSE, close settle, PICKUP, weak RETAINING, limited player HOLD BOOST, physical reel-top completion, braking-aware carriage return, motor-driven RELEASE, and return to READY. HOLD BOOST is a real temporary torque change only; it does not attach the prize or override contact physics.

M05 is now closed. PrizeFactory is the single normal spawn path for 11 starter definitions, including rigid primitives plus pillow, simple Teddy and simple animal compound prizes. Reusable material/mass/COM profiles now produce measured behavioral differences, deterministic visual variants enumerate 176 valid combinations, and a 12-prize contact pile settles and remains stable for a 60-second post-settle regression. The default `gantry-lab` and closed M01–M04 physics remain unchanged.

M06 is now closed. The physical cabinet, raised play deck, real chute, collider-free one-shot sensor, M02–M04 integrated play lifecycle, carried-prize RETURN → motor RELEASE, and explicit result/inventory handoff are all regression-tested. The cabinet result consumer is idempotent against duplicate event delivery, transparent glass uses a low-obstruction pane plus visible boundary outline, and the closed M01–M05 physics — including the M04 torque/BOOST calibration — remain unchanged.

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

M07 remains a **closure candidate** after the depth/readability and starter-prize interaction pass. Player movement stays restricted to the front. No laser or projected aim guide is used: the cabinet now restores natural depth cues with a low-contrast woven deck texture, fixed cabinet-light shadows, occlusion and the existing small lateral player motion. The remaining M07 gate is deployed-build manual play/readability confirmation.

Root/default scene:
- `https://edisontw.github.io/Claw-Chaos/` → `cabinet-lab`
- explicit lab URL remains `?scene=gantry-lab`

Current cabinet realism baseline:
- chute center X/Z = -0.28 / 0.20 m
- chute opening = 0.24 × 0.18 m
- chute sensor enlarged with the opening
- cabinet claw idle/home height = **+85 mm** relative to the locked `gantry-lab` baseline
- cabinet reel maximum payout is extended by the same 85 mm, preserving bottom reach; carriage top keeps ≈10 mm ceiling clearance
- two visual service/control wires accompany the main suspension cable
- chute sensor debug wireframe is hidden during normal play; a raised solid trim sits above the deck around the opening to avoid moving-camera seam/z-fighting artifacts
- cabinet-only grip profile = finger friction **0.72**, CLOSE/PICKUP **2.9 N·m**, RETAINING **0.0055 N·m**
- cabinet strong PICKUP phase = **0.12 m lift** before switching to RETAINING; locked `gantry-lab` remains **0.06 m**
- actual `prize/sphere_ball` on the full flat deck: 75 g / friction 0.82 / radius 52.5 mm → peak/final lift ≈ **226 mm**
- same flat-deck geometry at 150 g → peak lift only ≈ **7.1 mm**, so grip remains mass-sensitive rather than magnetic
- `prize/cube_small` is now a **75 g Foam Cube** with a rounded physical collider (~14 mm corner radius) instead of an ideal sharp plastic cuboid
- rounded Foam Cube interaction: ≈ **22.7 mm planar displacement + 10.4 mm peak lift**; legacy sharp cuboid comparison ≈ 2.5 mm + 2.1 mm
- rigid cardboard boxes/cans remain harder targets; the starter cube is not scripted to win
- locked `gantry-lab` M04 force profile remains 0.60 / 2.5 / 0.003
- EARLY CLOSE from Space/F immediately locks current reel payout; closing fingers no longer keep descending
- AUTO CLOSE remains the normal near-bottom fallback
- depth/readability uses woven deck texture + fixed shadow-casting cabinet light; **no laser / aim projection**
- root/browser default-scene smoke is regression-gated

Current `cabinet-lab` player-view controls:
- click canvas: capture mouse for first-person look; `Esc` releases pointer lock
- mouse: head look, clamped to **±90° yaw** and **−70°/+25° pitch**
- `W/S`: small front/back standing-position adjustment only
- `A/D`: small left/right adjustment only; player remains in front of the cabinet
- player X range = **±0.28 m**
- player Z range ≈ **0.534–0.78 m**, always outside the front glass
- `Q/E`: small bounded lean, max **30 mm**
- walking around either cabinet side is intentionally disabled
- center reticle: gaze target
- `F`: interact when the reticle is on the red control-panel button
- chute gaze is inspection-only
- `F3`: collider debug in `cabinet-lab`
- `M`: COM/origin debug
- machine keyboard controls remain Arrow keys / Space / Shift / H / P / T

Current M07 front-view baseline:
- eye height = 0.98 m; no vertical/free-fly input
- yaw = ±90°; pitch = −70° / +25°
- camera FOV remains exactly 50°
- no side standing zones and no front-corner traversal
- front-only movement plus head turn is used for aiming/readability
- control-panel and chute gaze targets remain reachable from the legal front zone
- **30 test files / 81 tests PASS**
- lint/build/base-path and browser smokes PASS

Current `gantry-lab` controls:
- direct lab scene: `?scene=gantry-lab`
- Arrow keys: manual X/Z aiming while READY
- first `Space`: physical DROP
- second `Space` during descent: EARLY CLOSE + immediate reel-height lock
- no second action: AUTO CLOSE near maximum payout
- after close: settle → physical LIFT → PICKUP → RETAINING → RETURN → RELEASE runs automatically
- hold `Shift` during RETAINING/RETURNING: limited HOLD BOOST
- `H`: legacy M02 home-return test path when the M04 play cycle is READY and reel is at top
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

M03 final closure baseline:
- suspension horizontal spring stiffness: 170 N/m
- horizontal damping: 1.0 N·s/m
- corrective-force clamp: 4 N
- transport-only OPEN finger hold: stiffness 6000, damping 340, max torque 50
- PT-006 hard-brake peak swing ≈ 0.049 rad (~2.8°)
- PT-007 at 0.40 s half-period: early peak ≈ 20.9 mm → late peak ≈ 24.2 mm (+15.9%)
- PT-007 off-cadence 0.30 s: ≈ 11.9 mm → 8.4 mm (decays)
- current OPEN transport finger flex ≤ 0.0328 rad (~1.9°)
- PT-008 DROP/LIFT and M02 home-return regressions remain PASS
- M03 slice 2 front/back at 0.40 s: Z early peak ≈ 20.86 mm → late peak ≈ 24.17 mm (+15.9%)
- M03 slice 2 front/back off-cadence 0.30 s: ≈ 11.86 mm → 8.41 mm (decays)
- M03 slice 2 diagonal at 0.40 s: late X/Z peaks ≈ 24.08 / 24.08 mm; late resultant ≈ 34.05 mm
- diagonal peak angle ≈ 0.110 rad (~6.3°); maximum suspension-length error ≈ 0.003 mm
- all directional swing runs remain finite/bounded
- amplified diagonal swing before DROP: resultant peak ≈ 34.05 mm
- DROP starts with ≈ 13.94 mm resultant offset and ≈ 0.191 m/s relative horizontal speed
- first DROP tick retains/increases physical horizontal speed; world-speed ratio ≈ 1.11
- physical descent ≈ 0.28029 m over 146 fixed ticks
- descent max X/Z offsets ≈ 21.55 / 21.55 mm; resultant ≈ 30.47 mm
- hub travels ≈ 61.69 mm horizontally during descent
- maximum suspension-length error ≈ 0.003 mm; final suspension distance ≈ 0.310000 m
- finite/bounded PASS
- **47 automated tests PASS**

M03 is **CLOSED**.

M04 slice 1 current baseline:
- first `Space`: physical DROP / DESCENDING
- second `Space` during descent: EARLY CLOSE
- no second action: AUTO CLOSE at configured travel threshold 0.275 m
- EARLY CLOSE test trigger payout ≈ 0.10227 m
- closing command duration: 58 fixed ticks ≈ 0.4833 s
- payout continues during early closing to ≈ 0.23760 m
- AUTO CLOSE trigger payout ≈ 0.27562 m
- automatic path reaches physical max payout 0.280 m
- closing uses the unchanged M01 contact motor profile (180 / 18 / 2.5 N·m)
- OPEN/aiming retains the M02 transport profile
- no instant-close transform, no finger teleport, no hidden close force
- **49 automated tests PASS**

M04 slice 2 current baseline:
- close completion enters a dedicated settle state before lift
- close-settle window: 0.90 s; measured fixed-step transition = 109 ticks ≈ 0.908 s
- physical reel LIFT begins only after settle
- PICKUP phase remains on the M01 strong contact torque: 2.5 N·m
- RETAINING starts after ≈ 0.06027 m of physical reel recovery (44 ticks ≈ 0.367 s)
- RETAINING torque: 0.003 N·m
- suspended-claw physical ball regression: peak lift ≈ 43.65 mm
- ball lift at RETAINING transition ≈ 21.56 mm
- weak-retaining slip loss ≈ 44.45 mm
- final ball height returns near its support (≈ −0.80 mm relative to baseline), rather than being teleported/released
- reel physically returns to payout 0.000 m
- maximum suspension-length error ≈ 0.056 mm
- no prize parent/weld/joint, prize teleport, or velocity reset
- **51 automated tests PASS**

M04 slice 3 / closure baseline:
- prototype HOLD BOOST input: hold `Shift`
- base RETAINING torque: 0.003 N·m
- calibrated BOOST torque: 0.010 N·m
- BOOST budget: maximum 0.80 s of actual use per play cycle
- near-slip sphere at 0.4 s after RETAINING: no BOOST ≈ −0.06 mm lift; BOOST ≈ 19.26 mm lift
- after the 0.80 s BOOST budget expires, force returns to base retaining torque and the same prize physically slips/falls
- PICKUP → RETAINING prize speed remains continuous: ≈ 0.1982 → 0.1944 m/s across the transition
- lifecycle regression: reel-top → RETURNING at tick 63
- off-home carriage reaches release/home at tick 149 with ≈ 1.83 mm position error
- fingers physically open from −0.42 rad to +0.35 rad in 58 ticks ≈ 0.483 s
- READY is reached only after release completes at tick 206
- no prize parent/weld/joint, hidden hold attachment, teleport, or velocity reset
- **54 automated tests PASS**

M04 is **CLOSED**. Full carried-prize return to a modeled chute, chute-edge interaction, and chute sensing remain later cabinet/prize acceptance work.

M05 final closure baseline:
- 11 PrizeFactory definitions: cube, box, tall box, flat box, sphere, ellipsoid, cylinder, capsule, pillow, simple Teddy and simple animal
- 5 material profiles, 3 mass profiles, 5 COM profiles
- 8 colors × 2 finish variants across 11 definitions = **176 formally enumerated unique visible variants**
- explicit Rapier total mass + local COM + principal inertia; colliders contribute zero extra mass
- material behavior PT-021: same box/impulse setup slides ≈ 124.20 mm with plastic versus ≈ 92.23 mm with rubber
- mass behavior: same 0.03 N·s impulse gives ≈ 0.3333 m/s for light 0.090 kg versus ≈ 0.1852 m/s for heavy 0.162 kg
- COM behavior PT-022: centered COM remains at 0 rad while left-offset COM reaches ≈ 0.40385 rad with peak angular speed ≈ 1.6154 rad/s under the same center impulse
- PT-015: 12-prize contact pile reaches sleep in ≈ 2.317 s; after another 60 simulated seconds, maximum drift = 0 and all 12 remain sleeping
- pillow/Teddy/animal use stable compound primitive collision profiles; no prize-specific grab code
- `?scene=prize-lab` visualizes all 11 definitions with `M` COM/origin and `D` collider debug
- **62 automated tests PASS**

M05 is **CLOSED**.

M06 final closure baseline:
- cabinet interior X ±0.46 m / Z ±0.36 m with physical front/side glass, back wall and ceiling
- raised physical play deck Y = 0.265 m aligns the existing M02/M04 reel geometry with prize contact while a lower catch floor remains below
- physical chute opening = 0.18 × 0.15 m, centered at X/Z = 0.28 / 0.20 m
- chute sensor remains collider-free and records each physical prize instance once
- normal M04 RETURN in `cabinet-lab` targets the chute center; legacy M02 `H` home remains X/Z = 0 / 0
- PT-017 lip/no-win and PT-018 physical chute entry remain PASS
- carried high-stack sphere lifecycle remains PICKUP → RETAINING tick 46 → RETURNING tick 56 → RELEASING tick 117 → sensor tick 149 → READY tick 174
- carried ball travels ≈ 83.35 mm during RETURN; dynamic hub lag peaks ≈ 16.21 mm; max fixed-tick prize displacement ≈ 18.33 mm
- HOLD BOOST use ≈ 0.592 s, below the locked 0.80 s budget; no M04 torque or BOOST value changed
- chute event now feeds `CabinetResultInventoryState`; duplicate delivery and duplicate-prize delivery cannot double-award inventory
- `cabinet-lab` reports sensor wins, accepted results, inventory count and last result prize
- glass render opacity is reduced to 0.10 and glass panels receive visible edge outlines; collision geometry is unchanged
- **28 test files / 69 automated tests PASS**
- lint PASS; TypeScript/Vite build PASS; GitHub Pages base-path PASS
- headless browser smoke PASS for both `gantry-lab` and `cabinet-lab`

M06 is **CLOSED**. First-person yaw/pitch, side inspection and camera/glass clipping constraints are M07 scope.

## Status

This repository is the source of truth for the Claw Chaos project.
