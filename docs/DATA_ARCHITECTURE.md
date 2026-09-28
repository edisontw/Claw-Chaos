# Data & Content Architecture

Version: 0.1  
Date: 2026-09-28

## 1. Goal

Claw Chaos must support many machine/prize combinations without hard-coded per-item gameplay logic.

The main runtime definitions are:

```text
MachineDefinition
ClawDefinition
SuspensionDefinition
PrizeDefinition
MaterialProfile
VisualVariant
LayoutDefinition
StoreDefinition
OperatorProfile
RulesetDefinition
ChallengeDefinition
```

All IDs should be stable strings.

Configuration format can begin as JSON/TypeScript objects and later migrate to a validated schema format if needed.

## 2. MachineDefinition

Suggested shape:

```ts
interface MachineDefinition {
  id: string;
  displayName: string;
  family: "three_prong" | "two_prong" | "mini" | "premium";

  cabinet: {
    width: number;
    height: number;
    depth: number;
    playArea: Bounds3;
    chuteId: string;
  };

  gantry: {
    maxSpeedX: number;
    maxSpeedZ: number;
    accelerationX: number;
    accelerationZ: number;
    brakingX: number;
    brakingZ: number;
    xLimits: [number, number];
    zLimits: [number, number];
  };

  suspensionId: string;
  clawId: string;

  forceProfile: {
    closeTorque: number;
    pickupTorque: number;
    retainingTorque: number;
    boostedRetainingTorque?: number;
    pickupDuration: number;
    holdBoostDuration?: number;
  };

  drop: {
    reelSpeed: number;
    reelAcceleration: number;
    minLength: number;
    maxLength: number;
    earlyCloseEnabled: boolean;
  };

  rulesetId: string;
}
```

Do not encode prize-specific win probabilities here.

## 3. ClawDefinition

```ts
interface ClawDefinition {
  id: string;
  fingerCount: 2 | 3;
  hubMass: number;

  finger: {
    length: number;
    mass: number;
    openAngle: number;
    closedAngle: number;
    targetAngularSpeed: number;
    jointStiffness: number;
    jointDamping: number;
    tipMaterialId: string;
    colliderProfile: string;
  };

  visualAssetId: string;
}
```

Later, support per-finger profiles for asymmetric real machines.

## 4. SuspensionDefinition

```ts
interface SuspensionDefinition {
  id: string;
  angularLimitX: number;
  angularLimitZ: number;
  yawLimit: number;
  angularDamping: number;
  torsionalDamping: number;
  compliance: number;
}
```

This allows two cabinets with the same claw to feel different because one has a longer/looser suspension.

## 5. MaterialProfile

Physical material and visual material must be separable.

```ts
interface MaterialProfile {
  id: string;
  category:
    | "cardboard_matte"
    | "cardboard_glossy"
    | "plastic"
    | "clear_plastic"
    | "rubber"
    | "fabric"
    | "plush"
    | "metal";

  staticFriction: number;
  dynamicFriction: number;
  restitution: number;

  audioProfileId: string;
  defaultVisualMaterialId?: string;
}
```

Do not assume the final numeric values before calibration.

## 6. PrizeDefinition

```ts
interface PrizeDefinition {
  id: string;
  displayName: string;
  shapeFamily:
    | "cube"
    | "box"
    | "tall_box"
    | "flat_box"
    | "sphere"
    | "ellipsoid"
    | "cylinder"
    | "capsule"
    | "cone"
    | "ring"
    | "pillow"
    | "bag"
    | "bottle"
    | "plush_humanoid"
    | "plush_animal"
    | "irregular";

  dimensions: Vec3;
  mass: number;
  centerOfMass: Vec3;
  materialId: string;
  colliderProfileId: string;

  articulationProfileId?: string;

  visual: {
    meshId: string;
    variantFamilyId: string;
    baseColorId?: string;
    patternId?: string;
    accessoryIds?: string[];
  };

  economics?: {
    nominalValue?: number;
    operatorCost?: number;
    rarity?: string;
  };

  tags?: string[];
}
```

Economics data must not alter physics automatically. A ruleset/operator profile may choose a harder machine configuration for higher-value prizes, but that is explicit.

## 7. Collider profiles

Collider generation should reuse templates.

Examples:

```text
box/basic
box/beveled
sphere/basic
capsule/basic
plush/teddy_v1
plush/humanoid_v1
bottle/v1
ring/v1
```

A plush template may define:
- head sphere,
- torso capsule,
- left/right arms,
- left/right legs,
- optional ears/tail.

This lets many plush visuals share stable collision topology.

## 8. Center-of-mass profiles

Reusable profiles:

```text
com/centered
com/bottom_heavy
com/top_heavy
com/left_offset
com/right_offset
com/front_offset
com/back_offset
```

A final PrizeDefinition may use a profile plus small authored offset.

## 9. VisualVariant system

The visual system should support combinatorial generation.

Example:

```ts
interface VisualVariantFamily {
  id: string;
  allowedColors: string[];
  allowedMaterials: string[];
  allowedPatterns: string[];
  allowedAccessories: string[];
}
```

Initial colors:
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

A deterministic variant seed selects a combination.

This allows 100+ visible prizes with a small base asset library.

## 10. PrizeFactory

Runtime responsibility:

```text
PrizeDefinition
+
VisualVariant seed
+
Physics profile
        ↓
PrizeFactory
        ↓
render entity
+
rigid body / articulated body
+
colliders
+
material
+
audio tags
+
metadata
```

PrizeFactory must be the only normal path for spawning prize gameplay entities.

## 11. LayoutDefinition

```ts
interface LayoutDefinition {
  id: string;
  type:
    | "loose"
    | "dense"
    | "showcase"
    | "bridge"
    | "ring"
    | "edge"
    | "chute_adjacent";

  machineFamily?: string;
  prizePoolIds: string[];
  spawnZones: SpawnZone[];
  supportGeometryIds?: string[];
  settleSeconds: number;
  seedPolicy: "fixed" | "session" | "random";
}
```

Layouts specify initial conditions, not final frozen transforms.

After placement, physics settling creates the actual playable state.

## 12. StoreDefinition

```ts
interface StoreDefinition {
  id: string;
  displayName: string;
  visualThemeId: string;
  ambientAudioId: string;
  staffPolicyId: string;
  machineSlots: MachineSlot[];
}
```

A machine slot references:
- machine definition,
- operator profile,
- prize pool,
- layout,
- ruleset.

## 13. Staff policy

```ts
interface StaffPolicy {
  id: string;
  style: "friendly" | "standard" | "strict";
  allowRestock: boolean;
  allowDeadZoneRecovery: boolean;
  allowStandUpPrize: boolean;
  allowGeneralRearrangement: boolean;
}
```

Staff policy should be explicit and inspectable.

## 14. OperatorProfile

```ts
interface OperatorProfile {
  id: string;
  machineOverrides?: Partial<MachineDefinition>;
  restockThresholdRatio: number;
  restockLayoutId: string;
  prizePools: string[];
  commercialSettings?: {
    vendPrice?: number;
    targetProfile?: string;
  };
}
```

Use override layers rather than duplicating entire machine files.

## 15. RulesetDefinition

Examples:
- pure_simulation
- arcade_standard
- taiwan_guaranteed_prize
- challenge_fixed_attempts

```ts
interface RulesetDefinition {
  id: string;
  fixedPhysicsParameters: boolean;
  guaranteedPrize?: {
    enabled: boolean;
    thresholdPolicyId: string;
  };
  allowHoldBoost: boolean;
  allowEarlyClose: boolean;
  abuseDetection?: boolean;
}
```

Legal/regulatory numbers must not be permanently hard-coded into engine logic.

## 16. Runtime machine state

Separate immutable definition from mutable state.

```ts
interface MachineRuntimeState {
  state: MachineState;
  credits: number;
  accumulatedSpend: number;
  inventoryCount: number;
  activePrizeIds: string[];
  serviceRequested: boolean;
  currentForcePhase: string;
  playCount: number;
  prizeOutCount: number;
}
```

## 17. Serialization

For reproducible testing and persistent arcade visits, save:
- machine definition IDs,
- config version,
- layout seed,
- prize runtime transforms,
- linear/angular velocities if mid-play save is allowed,
- prize inventory,
- operator state,
- guaranteed-prize counter,
- staff/service state.

Do not save raw pointers or engine object IDs as durable identifiers.

## 18. Versioning

All externalized config should include schema version.

Example:

```json
{
  "schemaVersion": 1,
  "id": "prize/box_medium_001"
}
```

Migration tools become necessary once public saves/content exist.

## 19. Validation

Build a data validation step that checks:
- unique IDs,
- referenced IDs exist,
- positive mass/dimensions,
- friction/restitution ranges,
- valid claw finger count,
- legal movement limits,
- COM inside or intentionally outside expected bounds,
- no missing collision profile,
- no layout with zero prize pool.

This validation should run in CI when data files are introduced.

## 20. Content expansion rule

Adding a new prize should normally require:
1. new data entry,
2. optionally a new mesh/texture,
3. optionally a new collider profile only if existing profiles are inadequate.

It should not require:
- new gameplay code,
- new grab code,
- new "success chance",
- new machine state.

# 21. ControlProfile

Machine control behavior belongs in data.

```ts
interface ControlProfile {
  id: string;
  movementMode: "joystick" | "digital_buttons" | "staged_axes";
  analogMovement: boolean;
  allowMoveDuringDescent: boolean;
  allowMoveDuringLift: boolean;
  earlyCloseEnabled: boolean;
  holdBoostEnabled: boolean;
  optionalYawControl?: boolean;
  aimTimeLimitSeconds?: number;
  autoDropOnTimeout?: boolean;
}
```

This prevents one global control scheme from being incorrectly applied to all machine families.

## 22. ReturnProfile

```ts
interface ReturnProfile {
  id: string;
  homePosition: Vec2;
  chutePosition: Vec2;
  releaseHeight: number;
  releaseDelaySeconds: number;
  postReleaseDelaySeconds: number;
  returnSpeedScale: number;
  liftBeforeReturn: boolean;
}
```

The return path must remain physical.

## 23. CameraProfile

```ts
interface CameraProfile {
  id: string;
  eyeHeightMeters: number;
  horizontalFovDegrees: number;
  yawMinDegrees: number;
  yawMaxDegrees: number;
  pitchMinDegrees: number;
  pitchMaxDegrees: number;
  bodyTravelX: [number, number];
  bodyTravelZ: [number, number];
  leanLimitMeters: number;
}
```

Camera FOV and head-turn range are separate concepts.

Use a plausible FOV and let the player turn/shift position for side inspection rather than using an extreme fisheye lens.

## 24. FaultProfile

```ts
interface FaultProfile {
  id: string;
  detectChuteJam: boolean;
  detectTravelFault: boolean;
  detectPrizeOutSensorFault: boolean;
  tiltResponse?: "ignore" | "warn" | "abort_play";
  recoveryPolicyId: string;
}
```

## 25. CalibrationProfile

A machine/prize parameter can carry provenance:

```ts
interface CalibratedValue<T> {
  value: T;
  basis: "measured" | "inferred" | "tuned";
  sourceId?: string;
  uncertainty?: number;
  notes?: string;
}
```

Do not require this wrapper for every runtime scalar in early prototypes, but preserve the concept in calibration tooling/data.

## 26. ReplayRecord

```ts
interface ReplayRecord {
  schemaVersion: number;
  buildVersion: string;
  machineDefinitionId: string;
  configHash: string;
  layoutSeed: string;
  inputEvents: Array<{
    tick: number;
    action: string;
    value: number | boolean | Vec2;
  }>;
  checkpoints?: ReplayCheckpoint[];
}
```

This is primarily a regression/debugging tool before it becomes a user-facing replay feature.

## 27. AssetManifest and licensing

Every external asset should record:
- asset ID,
- source/author,
- license,
- modification status,
- attribution requirement,
- redistribution permission.

Avoid:
- ripped arcade cabinet models,
- copied manufacturer logos,
- copyrighted character prizes,
- unlicensed sound recordings.

Procedurally generated or original generic prizes are preferred for the baseline build.
