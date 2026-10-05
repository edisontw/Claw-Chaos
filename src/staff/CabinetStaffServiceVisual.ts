import * as THREE from "three";
import type { RigidBodyHandle } from "../physics/PhysicsRuntime";
import {
  M10_STAFF_SERVICE_CONFIG,
  advanceStaffServiceState,
  createStaffServiceState,
  staffServicePose,
  type StaffServicePhase,
  type StaffServiceState,
} from "./staffServiceSequence";

function material(
  color: number,
  roughness = 0.72,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
  });
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      16,
    ),
    mat,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createAdultFemaleStaffModel(): {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
} {
  const root = new THREE.Group();
  root.name = "m10-adult-female-staff";
  root.visible = false;

  const skin = material(0xf1c7a8, 0.82);
  const hair = material(0x2a1d1a, 0.78);
  const uniform = material(0x243b5a, 0.62);
  const blouse = material(0xf4f2ef, 0.88);
  const skirt = material(0x233047, 0.72);
  const stocking = material(0x292a30, 0.82);
  const shoe = material(0x141519, 0.50);
  const badge = material(0xe4c35a, 0.45);

  for (const x of [-0.065, 0.065]) {
    const leg = cylinder(0.043, 0.050, 0.66, stocking);
    leg.position.set(x, 0.39, 0);
    root.add(leg);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.055, 0.18),
      shoe,
    );
    foot.position.set(x, 0.055, 0.035);
    foot.castShadow = true;
    root.add(foot);
  }

  const skirtMesh = cylinder(0.125, 0.18, 0.31, skirt);
  skirtMesh.position.y = 0.82;
  root.add(skirtMesh);

  const torso = cylinder(0.135, 0.165, 0.42, uniform);
  torso.position.y = 1.11;
  root.add(torso);

  const blousePanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.23, 0.018),
    blouse,
  );
  blousePanel.position.set(0, 1.14, 0.145);
  blousePanel.castShadow = true;
  root.add(blousePanel);

  const badgeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.032, 0.010),
    badge,
  );
  badgeMesh.position.set(0.055, 1.22, 0.158);
  root.add(badgeMesh);

  const makeArm = (x: number): THREE.Group => {
    const armRoot = new THREE.Group();
    armRoot.position.set(x, 1.25, 0);
    const upper = cylinder(0.041, 0.046, 0.38, uniform);
    upper.position.y = -0.18;
    armRoot.add(upper);
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 14, 10),
      skin,
    );
    hand.position.y = -0.40;
    hand.castShadow = true;
    armRoot.add(hand);
    root.add(armRoot);
    return armRoot;
  };

  const leftArm = makeArm(-0.18);
  const rightArm = makeArm(0.18);

  const neck = cylinder(0.045, 0.048, 0.09, skin);
  neck.position.y = 1.37;
  root.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 22, 16),
    skin,
  );
  head.position.y = 1.51;
  head.scale.set(0.92, 1.06, 0.96);
  head.castShadow = true;
  root.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.122,
      22,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.62,
    ),
    hair,
  );
  hairCap.position.set(0, 1.545, -0.012);
  hairCap.rotation.x = -0.10;
  hairCap.castShadow = true;
  root.add(hairCap);

  const ponytail = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    hair,
  );
  ponytail.position.set(0, 1.49, -0.125);
  ponytail.scale.set(0.78, 1.75, 0.72);
  ponytail.rotation.x = -0.35;
  ponytail.castShadow = true;
  root.add(ponytail);

  for (const x of [-0.038, 0.038]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 10, 8),
      material(0x221b1b, 0.55),
    );
    eye.position.set(x, 1.53, 0.105);
    root.add(eye);
  }

  return {
    root,
    leftArm,
    rightArm,
  };
}

export class CabinetStaffServiceVisual {
  private state: StaffServiceState =
    createStaffServiceState();
  private readonly actor: THREE.Group;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
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
  ) {
    const model = createAdultFemaleStaffModel();
    this.actor = model.root;
    this.leftArm = model.leftArm;
    this.rightArm = model.rightArm;
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

    const walkSwing =
      Math.sin(pose.walkCycleRadians) * 0.34;
    this.leftArm.rotation.x = walkSwing;
    this.rightArm.rotation.x = -walkSwing;
    this.actor.position.y =
      Math.abs(Math.sin(pose.walkCycleRadians)) * 0.008;

    if (
      this.state.phase === "opening_door" ||
      this.state.phase === "door_open" ||
      this.state.phase === "closing_door"
    ) {
      this.rightArm.rotation.z = -0.72;
      this.rightArm.rotation.x = -0.42;
    } else {
      this.rightArm.rotation.z = 0;
      this.rightArm.rotation.x = -walkSwing;
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
}
