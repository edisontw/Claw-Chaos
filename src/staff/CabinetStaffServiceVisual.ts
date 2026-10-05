import * as THREE from "three";
import type { RigidBodyHandle } from "../physics/PhysicsRuntime";
import {
  DEFAULT_VISUAL_THEME,
  type StaffVisualTheme,
} from "../theme/visualTheme";
import {
  createAdultFemaleArcadeStaffVisual,
  type StaffCharacterRig,
} from "./AdultFemaleArcadeStaffVisual";
import {
  REALISTIC_STAFF_CHARACTER_VARIANT,
  RealisticArcadeStaffVisual,
} from "./RealisticArcadeStaffVisual";
import {
  SKINNED_STAFF_CHARACTER_VARIANT,
  SkinnedArcadeStaffVisual,
} from "./SkinnedArcadeStaffVisual";
import {
  M10_STAFF_SERVICE_CONFIG,
  advanceStaffServiceState,
  createStaffServiceState,
  staffServicePose,
  type StaffServicePhase,
  type StaffServiceState,
} from "./staffServiceSequence";

export class CabinetStaffServiceVisual {
  private state: StaffServiceState =
    createStaffServiceState();
  private readonly rig: StaffCharacterRig;
  private readonly realistic: RealisticArcadeStaffVisual;
  private readonly skinned: SkinnedArcadeStaffVisual;
  private readonly actor = new THREE.Group();
  private readonly doorPivot = new THREE.Group();
  private readonly closedDoorCenter: THREE.Vector3;
  private readonly doorCenterOffset: THREE.Vector3;

  constructor(
    scene: THREE.Scene,
    serviceDoorObjects: readonly THREE.Object3D[],
    private readonly serviceDoorBody: RigidBodyHandle,
    private readonly doorHinge: {
      x: number;
      y: number;
      z: number;
    },
    staffTheme: StaffVisualTheme =
      DEFAULT_VISUAL_THEME.staff,
    private readonly preferHighDetailStaff = true,
  ) {
    this.rig =
      createAdultFemaleArcadeStaffVisual(staffTheme);
    this.realistic =
      new RealisticArcadeStaffVisual(
        preferHighDetailStaff,
      );
    this.skinned =
      new SkinnedArcadeStaffVisual();
    this.actor.name =
      "m10-staff-character-visual-root";
    this.actor.visible = false;
    this.actor.userData.visualOnly = true;

    this.rig.root.visible = true;
    this.realistic.root.visible = false;
    this.skinned.root.visible = false;
    this.actor.add(
      this.rig.root,
      this.realistic.root,
      this.skinned.root,
    );
    scene.add(this.actor);

    const bodyCenter = serviceDoorBody.translation();
    this.closedDoorCenter = new THREE.Vector3(
      bodyCenter.x,
      bodyCenter.y,
      bodyCenter.z,
    );
    this.doorCenterOffset = this.closedDoorCenter
      .clone()
      .sub(
        new THREE.Vector3(
          doorHinge.x,
          doorHinge.y,
          doorHinge.z,
        ),
      );

    this.doorPivot.name = "m10-service-door-pivot";
    this.doorPivot.position.set(
      doorHinge.x,
      doorHinge.y,
      doorHinge.z,
    );
    scene.add(this.doorPivot);

    for (const object of serviceDoorObjects) {
      this.doorPivot.attach(object);
    }
  }

  private updateCharacterPose(
    walkCycleRadians: number,
  ): void {
    const walkSin = Math.sin(walkCycleRadians);
    const walkCos = Math.cos(walkCycleRadians);
    const shoulderSwing = walkSin * 0.30;
    const legSwing = walkSin * 0.22;

    this.rig.leftShoulder.rotation.set(
      shoulderSwing,
      0,
      0,
    );
    this.rig.rightShoulder.rotation.set(
      -shoulderSwing,
      0,
      0,
    );
    this.rig.leftForearm.rotation.set(
      -0.06 + Math.max(0, -walkCos) * 0.05,
      0,
      0,
    );
    this.rig.rightForearm.rotation.set(
      -0.06 + Math.max(0, walkCos) * 0.05,
      0,
      0,
    );
    this.rig.leftLeg.rotation.set(
      -legSwing,
      0,
      0,
    );
    this.rig.rightLeg.rotation.set(
      legSwing,
      0,
      0,
    );
    this.rig.head.rotation.set(
      Math.sin(walkCycleRadians * 0.5) * 0.012,
      0,
      Math.cos(walkCycleRadians * 0.5) * 0.008,
    );

    const servicing =
      this.state.phase === "opening_door" ||
      this.state.phase === "door_open" ||
      this.state.phase === "closing_door";

    if (servicing) {
      this.rig.leftShoulder.rotation.set(
        -0.12,
        0,
        0.08,
      );
      this.rig.leftForearm.rotation.set(
        -0.18,
        0,
        0,
      );
      this.rig.rightShoulder.rotation.set(
        -0.52,
        0,
        -0.66,
      );
      this.rig.rightForearm.rotation.set(
        -0.82,
        0.08,
        -0.08,
      );
      this.rig.leftLeg.rotation.set(0, 0, 0);
      this.rig.rightLeg.rotation.set(0, 0, 0);
      this.rig.head.rotation.set(
        -0.04,
        -0.18,
        0,
      );
    }
  }

  update(
    servicePaused: boolean,
    closeRequested: boolean,
    stepSeconds: number,
  ): void {
    this.state = advanceStaffServiceState(
      this.state,
      servicePaused,
      closeRequested,
      stepSeconds,
    );
    const pose = staffServicePose(this.state);

    this.actor.visible = pose.visible;
    this.actor.position.set(pose.x, 0, pose.z);
    this.actor.rotation.y = pose.yawRadians;

    const useRealistic =
      this.realistic.status === "realistic";
    const useSkinned =
      !useRealistic &&
      this.skinned.status === "skinned";
    this.realistic.root.visible = useRealistic;
    this.skinned.root.visible = useSkinned;
    this.rig.root.visible =
      !useRealistic && !useSkinned;

    this.realistic.update(
      this.state.phase,
      stepSeconds,
    );
    this.skinned.update(
      this.state.phase,
      stepSeconds,
    );

    if (useRealistic || useSkinned) {
      this.actor.position.y = 0;
    } else {
      this.updateCharacterPose(
        pose.walkCycleRadians,
      );
      this.actor.position.y =
        Math.abs(
          Math.sin(pose.walkCycleRadians),
        ) * 0.006;
    }

    const smoothDoor =
      pose.doorOpenFraction *
      pose.doorOpenFraction *
      (3 - 2 * pose.doorOpenFraction);
    const doorAngle =
      M10_STAFF_SERVICE_CONFIG.doorOpenRadians *
      smoothDoor;
    this.doorPivot.rotation.y = doorAngle;

    const cos = Math.cos(doorAngle);
    const sin = Math.sin(doorAngle);
    const offset = this.doorCenterOffset;
    this.serviceDoorBody.setNextKinematicTranslation({
      x:
        this.doorHinge.x +
        offset.x * cos +
        offset.z * sin,
      y: this.closedDoorCenter.y,
      z:
        this.doorHinge.z -
        offset.x * sin +
        offset.z * cos,
    });
    this.serviceDoorBody.setNextKinematicRotation({
      x: 0,
      y: Math.sin(doorAngle * 0.5),
      z: 0,
      w: Math.cos(doorAngle * 0.5),
    });
  }

  get phase(): StaffServicePhase {
    return this.state.phase;
  }

  get characterVariant(): string {
    return this.preferHighDetailStaff
      ? REALISTIC_STAFF_CHARACTER_VARIANT
      : SKINNED_STAFF_CHARACTER_VARIANT;
  }

  get visualStatus():
    | "loading"
    | "realistic"
    | "skinned"
    | "fallback" {
    if (this.realistic.status === "realistic") {
      return "realistic";
    }
    if (this.skinned.status === "skinned") {
      return "skinned";
    }
    if (
      this.preferHighDetailStaff &&
      this.realistic.status === "loading"
    ) {
      return "loading";
    }
    if (this.skinned.status === "loading") {
      return "loading";
    }
    return "fallback";
  }
}
