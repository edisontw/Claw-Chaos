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

export interface CapsuleSegmentSpec {
  start: Vec3;
  end: Vec3;
  radius: number;
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

function rotationFromYDirection(direction: Vec3): Quaternion {
  const length = Math.hypot(direction.x, direction.y, direction.z);

  if (length <= Number.EPSILON) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  const x = direction.x / length;
  const y = direction.y / length;
  const z = direction.z / length;

  if (y < -0.999999) {
    return { x: 1, y: 0, z: 0, w: 0 };
  }

  const qx = z;
  const qy = 0;
  const qz = -x;
  const qw = 1 + y;
  const qLength = Math.hypot(qx, qy, qz, qw);

  return {
    x: qx / qLength,
    y: qy / qLength,
    z: qz / qLength,
    w: qw / qLength,
  };
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

  createStaticCylinder(
    center: Vec3,
    halfHeight: number,
    radius: number,
    friction = 0.55,
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );

    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius).setFriction(friction),
      body,
    );

    return body;
  }

  createKinematicCylinder(
    center: Vec3,
    halfHeight: number,
    radius: number,
    friction = 0.55,
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      ),
    );

    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius).setFriction(friction),
      body,
    );

    return body;
  }

  createDynamicSphere(
    center: Vec3,
    radius: number,
    massKg: number,
    material: CuboidMaterialOptions = {},
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(center.x, center.y, center.z),
    );

    const volume = (4 / 3) * Math.PI * radius ** 3;
    const density = massKg / volume;

    this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setDensity(density)
        .setFriction(material.friction ?? 0.7)
        .setRestitution(material.restitution ?? 0.08),
      body,
    );

    this.dynamicBodyCountValue += 1;
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

  createDynamicCapsuleChain(
    origin: Vec3,
    segments: readonly CapsuleSegmentSpec[],
    material: CuboidMaterialOptions = {},
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x, origin.y, origin.z),
    );

    for (const segment of segments) {
      const dx = segment.end.x - segment.start.x;
      const dy = segment.end.y - segment.start.y;
      const dz = segment.end.z - segment.start.z;
      const length = Math.hypot(dx, dy, dz);

      if (length <= Number.EPSILON) {
        continue;
      }

      const center = {
        x: (segment.start.x + segment.end.x) * 0.5,
        y: (segment.start.y + segment.end.y) * 0.5,
        z: (segment.start.z + segment.end.z) * 0.5,
      };
      const rotation = rotationFromYDirection({ x: dx, y: dy, z: dz });
      const cylinderHalfHeight = Math.max(0.0001, length * 0.5 - segment.radius);

      let collider = RAPIER.ColliderDesc.capsule(cylinderHalfHeight, segment.radius)
        .setTranslation(center.x, center.y, center.z)
        .setRotation(rotation)
        .setFriction(material.friction ?? 0.7)
        .setRestitution(material.restitution ?? 0.08);

      if (material.density !== undefined) {
        collider = collider.setDensity(material.density);
      }

      this.world.createCollider(collider, body);
    }

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
