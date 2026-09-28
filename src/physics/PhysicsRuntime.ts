import RAPIER from "@dimforge/rapier3d-compat";
import { FIXED_TIMESTEP_SECONDS } from "../config/simulation";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type RigidBodyHandle = InstanceType<typeof RAPIER.RigidBody>;

export interface PhysicsDebugBuffers {
  vertices: Float32Array;
  colors: Float32Array;
}

export interface CuboidMaterialOptions {
  friction?: number;
  restitution?: number;
  density?: number;
}

export interface RevoluteJointHandle {
  configureMotorPosition(targetPos: number, stiffness: number, damping: number): void;
  setMotorMaxForce(maxForce: number): void;
  setLimits(min: number, max: number): void;
  setContactsEnabled(enabled: boolean): void;
  limitsEnabled(): boolean;
  limitsMin(): number;
  limitsMax(): number;
}

export interface RevoluteJointOptions {
  anchor1: Vec3;
  anchor2: Vec3;
  axis: Vec3;
  minAngle: number;
  maxAngle: number;
  initialTarget: number;
  stiffness: number;
  damping: number;
  maxTorque: number;
  contactsEnabled?: boolean;
}

export class PhysicsRuntime {
  private dynamicBodyCountValue = 0;

  private constructor(private readonly world: InstanceType<typeof RAPIER.World>) {
    this.world.integrationParameters.dt = FIXED_TIMESTEP_SECONDS;
  }

  static async create(): Promise<PhysicsRuntime> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    return new PhysicsRuntime(world);
  }

  get dynamicBodyCount(): number {
    return this.dynamicBodyCountValue;
  }

  createStaticCuboid(
    center: Vec3,
    halfExtents: Vec3,
    friction = 0.8,
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(friction),
      body,
    );

    return body;
  }

  createDynamicCuboid(
    center: Vec3,
    halfExtents: Vec3,
    rotationYRadians: number,
    material: CuboidMaterialOptions = {},
  ): RigidBodyHandle {
    const halfYaw = rotationYRadians * 0.5;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(center.x, center.y, center.z)
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) }),
    );

    let collider = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    )
      .setFriction(material.friction ?? 0.7)
      .setRestitution(material.restitution ?? 0.08);

    if (material.density !== undefined) {
      collider = collider.setDensity(material.density);
    }

    this.world.createCollider(collider, body);

    this.dynamicBodyCountValue += 1;
    return body;
  }

  createRevoluteJoint(
    body1: RigidBodyHandle,
    body2: RigidBodyHandle,
    options: RevoluteJointOptions,
  ): RevoluteJointHandle {
    const params = RAPIER.JointData.revolute(
      options.anchor1,
      options.anchor2,
      options.axis,
    );

    const joint = this.world.createImpulseJoint(
      params,
      body1,
      body2,
      true,
    ) as unknown as RevoluteJointHandle;

    joint.setLimits(options.minAngle, options.maxAngle);
    joint.configureMotorPosition(
      options.initialTarget,
      options.stiffness,
      options.damping,
    );
    joint.setMotorMaxForce(options.maxTorque);
    joint.setContactsEnabled(options.contactsEnabled ?? false);

    return joint;
  }

  debugRender(): PhysicsDebugBuffers {
    return this.world.debugRender();
  }

  step(): void {
    this.world.step();
  }
}
