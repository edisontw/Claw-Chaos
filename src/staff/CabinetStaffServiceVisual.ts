import * as THREE from "three";
import type { RigidBodyHandle } from "../physics/PhysicsRuntime";
import {
  DEFAULT_VISUAL_THEME,
  type StaffVisualTheme,
} from "../theme/visualTheme";
import {
  STAFF_CHARACTER_VARIANT,
  createAdultFemaleArcadeStaffVisual,
  type StaffCharacterRig,
} from "./AdultFemaleArcadeStaffVisual";
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
  private readonly actor: THREE.Group;
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
  ) {
    this.rig =
      createAdultFemaleArcadeStaffVisual(staffTheme);
    this.actor = this.rig.root;
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

    this.updateCharacterPose(pose.walkCycleRadians);
    this.actor.position.y =
      Math.abs(Math.sin(pose.walkCycleRadians)) *
      0.006;

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
    return STAFF_CHARACTER_VARIANT;
  }
}
