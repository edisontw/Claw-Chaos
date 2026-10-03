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
  contactAudioProfileId?: string;
}

export interface ContactAudioImpact {
  audioProfileId: string;
  forceNewtons: number;
}

export interface CapsuleSegmentSpec {
  start: Vec3;
  end: Vec3;
  radius: number;
}

export type CompoundColliderSpec =
  | {
      shape: "sphere";
      center: Vec3;
      radius: number;
    }
  | {
      shape: "capsule";
      start: Vec3;
      end: Vec3;
      radius: number;
    };

export type PrimitiveColliderSpec =
  | {
      shape: "cuboid";
      center?: Vec3;
      halfExtents: Vec3;
      rotation?: Quaternion;
    }
  | {
      shape: "sphere";
      center?: Vec3;
      radius: number;
    }
  | {
      shape: "cylinder";
      center?: Vec3;
      halfHeight: number;
      radius: number;
      rotation?: Quaternion;
    }
  | {
      shape: "capsule";
      start: Vec3;
      end: Vec3;
      radius: number;
    };

export interface DynamicMassPropertiesSpec {
  massKg: number;
  centerOfMass: Vec3;
  principalAngularInertia: Vec3;
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

export interface SphericalJointHandle {
  setContactsEnabled(enabled: boolean): void;
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

const CONTACT_AUDIO_FORCE_THRESHOLD_NEWTONS = 1.5;

export class PhysicsRuntime {
  private dynamicBodyCountValue = 0;
  private readonly contactAudioProfiles = new Map<number, string>();
  private previousContactAudioForces = new Map<string, number>();
  private readonly pendingContactAudioImpacts = new Map<string, number>();

  private constructor(
    private readonly world: InstanceType<typeof RAPIER.World>,
    private readonly eventQueue: InstanceType<typeof RAPIER.EventQueue>,
  ) {
    this.world.integrationParameters.dt = FIXED_TIMESTEP_SECONDS;
  }

  static async create(): Promise<PhysicsRuntime> {
    const initialize = (
      RAPIER as unknown as {
        init?: () => Promise<unknown>;
      }
    ).init;
    if (initialize) {
      await initialize.call(RAPIER);
    }

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const eventQueue = new RAPIER.EventQueue(true);
    return new PhysicsRuntime(world, eventQueue);
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

  createKinematicBody(center: Vec3): RigidBodyHandle {
    return this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      ),
    );
  }

  createKinematicCuboid(
    center: Vec3,
    halfExtents: Vec3,
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
      RAPIER.ColliderDesc.cuboid(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      ).setFriction(friction),
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

  createDynamicBodyWithMassProperties(
    origin: Vec3,
    colliders: readonly PrimitiveColliderSpec[],
    massProperties: DynamicMassPropertiesSpec,
    material: CuboidMaterialOptions = {},
    rotation: Quaternion = { x: 0, y: 0, z: 0, w: 1 },
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(origin.x, origin.y, origin.z)
        .setRotation(rotation)
        .setAdditionalMassProperties(
          massProperties.massKg,
          massProperties.centerOfMass,
          massProperties.principalAngularInertia,
          { x: 0, y: 0, z: 0, w: 1 },
        ),
    );

    for (const collider of colliders) {
      let descriptor;

      if (collider.shape === "cuboid") {
        descriptor = RAPIER.ColliderDesc.cuboid(
          collider.halfExtents.x,
          collider.halfExtents.y,
          collider.halfExtents.z,
        );
        if (collider.center) {
          descriptor = descriptor.setTranslation(
            collider.center.x,
            collider.center.y,
            collider.center.z,
          );
        }
        if (collider.rotation) {
          descriptor = descriptor.setRotation(collider.rotation);
        }
      } else if (collider.shape === "sphere") {
        descriptor = RAPIER.ColliderDesc.ball(collider.radius);
        if (collider.center) {
          descriptor = descriptor.setTranslation(
            collider.center.x,
            collider.center.y,
            collider.center.z,
          );
        }
      } else if (collider.shape === "cylinder") {
        descriptor = RAPIER.ColliderDesc.cylinder(
          collider.halfHeight,
          collider.radius,
        );
        if (collider.center) {
          descriptor = descriptor.setTranslation(
            collider.center.x,
            collider.center.y,
            collider.center.z,
          );
        }
        if (collider.rotation) {
          descriptor = descriptor.setRotation(collider.rotation);
        }
      } else {
        const dx = collider.end.x - collider.start.x;
        const dy = collider.end.y - collider.start.y;
        const dz = collider.end.z - collider.start.z;
        const length = Math.hypot(dx, dy, dz);

        if (length <= Number.EPSILON) {
          continue;
        }

        const center = {
          x: (collider.start.x + collider.end.x) * 0.5,
          y: (collider.start.y + collider.end.y) * 0.5,
          z: (collider.start.z + collider.end.z) * 0.5,
        };
        const capsuleRotation = rotationFromYDirection({
          x: dx,
          y: dy,
          z: dz,
        });
        const halfHeight = Math.max(
          0.0001,
          length * 0.5 - collider.radius,
        );

        descriptor = RAPIER.ColliderDesc.capsule(
          halfHeight,
          collider.radius,
        )
          .setTranslation(center.x, center.y, center.z)
          .setRotation(capsuleRotation);
      }

      descriptor = descriptor
        .setDensity(0)
        .setFriction(material.friction ?? 0.7)
        .setRestitution(material.restitution ?? 0.08);

      if (material.contactAudioProfileId) {
        descriptor = descriptor
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(
            CONTACT_AUDIO_FORCE_THRESHOLD_NEWTONS,
          );
      }

      const createdCollider = this.world.createCollider(
        descriptor,
        body,
      );
      if (material.contactAudioProfileId) {
        this.contactAudioProfiles.set(
          createdCollider.handle,
          material.contactAudioProfileId,
        );
      }
    }

    body.recomputeMassPropertiesFromColliders();
    this.dynamicBodyCountValue += 1;
    return body;
  }

  createDynamicCylinder(
    center: Vec3,
    halfHeight: number,
    radius: number,
    massKg: number,
    material: CuboidMaterialOptions = {},
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(center.x, center.y, center.z),
    );

    const volume = Math.PI * radius ** 2 * (halfHeight * 2);
    const density = massKg / volume;

    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(halfHeight, radius)
        .setDensity(density)
        .setFriction(material.friction ?? 0.7)
        .setRestitution(material.restitution ?? 0.08),
      body,
    );

    this.dynamicBodyCountValue += 1;
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

  createDynamicCompound(
    origin: Vec3,
    colliders: readonly CompoundColliderSpec[],
    massKg: number,
    material: CuboidMaterialOptions = {},
    rotation: Quaternion = { x: 0, y: 0, z: 0, w: 1 },
  ): RigidBodyHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(origin.x, origin.y, origin.z)
        .setRotation(rotation),
    );

    const totalVolume = colliders.reduce((sum, collider) => {
      if (collider.shape === "sphere") {
        return sum + (4 / 3) * Math.PI * collider.radius ** 3;
      }

      const dx = collider.end.x - collider.start.x;
      const dy = collider.end.y - collider.start.y;
      const dz = collider.end.z - collider.start.z;
      const length = Math.hypot(dx, dy, dz);
      const cylinderLength = Math.max(0, length - 2 * collider.radius);
      const cylinderVolume =
        Math.PI * collider.radius ** 2 * cylinderLength;
      const sphereVolume = (4 / 3) * Math.PI * collider.radius ** 3;
      return sum + cylinderVolume + sphereVolume;
    }, 0);

    const density =
      totalVolume > Number.EPSILON ? massKg / totalVolume : undefined;

    for (const collider of colliders) {
      let descriptor;

      if (collider.shape === "sphere") {
        descriptor = RAPIER.ColliderDesc.ball(collider.radius).setTranslation(
          collider.center.x,
          collider.center.y,
          collider.center.z,
        );
      } else {
        const dx = collider.end.x - collider.start.x;
        const dy = collider.end.y - collider.start.y;
        const dz = collider.end.z - collider.start.z;
        const length = Math.hypot(dx, dy, dz);

        if (length <= Number.EPSILON) {
          continue;
        }

        const center = {
          x: (collider.start.x + collider.end.x) * 0.5,
          y: (collider.start.y + collider.end.y) * 0.5,
          z: (collider.start.z + collider.end.z) * 0.5,
        };
        const rotation = rotationFromYDirection({ x: dx, y: dy, z: dz });
        const halfHeight = Math.max(
          0.0001,
          length * 0.5 - collider.radius,
        );

        descriptor = RAPIER.ColliderDesc.capsule(
          halfHeight,
          collider.radius,
        )
          .setTranslation(center.x, center.y, center.z)
          .setRotation(rotation);
      }

      descriptor = descriptor
        .setFriction(material.friction ?? 0.7)
        .setRestitution(material.restitution ?? 0.08);

      if (density !== undefined) {
        descriptor = descriptor.setDensity(density);
      }

      this.world.createCollider(descriptor, body);
    }

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

  createSphericalJoint(
    body1: RigidBodyHandle,
    body2: RigidBodyHandle,
    anchor1: Vec3,
    anchor2: Vec3,
    contactsEnabled = false,
  ): SphericalJointHandle {
    const params = RAPIER.JointData.spherical(anchor1, anchor2);
    const joint = this.world.createImpulseJoint(
      params,
      body1,
      body2,
      true,
    ) as unknown as SphericalJointHandle;

    joint.setContactsEnabled(contactsEnabled);
    return joint;
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

  consumeContactAudioImpacts(): ContactAudioImpact[] {
    const impacts = Array.from(
      this.pendingContactAudioImpacts,
      ([audioProfileId, forceNewtons]) => ({
        audioProfileId,
        forceNewtons,
      }),
    );
    this.pendingContactAudioImpacts.clear();
    return impacts;
  }

  debugRender(): PhysicsDebugBuffers {
    return this.world.debugRender();
  }

  step(): void {
    this.world.step(this.eventQueue);

    const currentContactAudioForces = new Map<string, number>();

    this.eventQueue.drainContactForceEvents((event) => {
      const collider1 = event.collider1();
      const collider2 = event.collider2();
      const audioProfile1 =
        this.contactAudioProfiles.get(collider1);
      const audioProfile2 =
        this.contactAudioProfiles.get(collider2);

      if (!audioProfile1 && !audioProfile2) {
        return;
      }

      const forceNewtons = event.totalForceMagnitude();
      const pairKey =
        collider1 < collider2
          ? `${collider1}:${collider2}`
          : `${collider2}:${collider1}`;
      const previousForce =
        this.previousContactAudioForces.get(pairKey) ?? 0;

      currentContactAudioForces.set(
        pairKey,
        Math.max(
          currentContactAudioForces.get(pairKey) ?? 0,
          forceNewtons,
        ),
      );

      if (
        forceNewtons < CONTACT_AUDIO_FORCE_THRESHOLD_NEWTONS ||
        previousForce >= CONTACT_AUDIO_FORCE_THRESHOLD_NEWTONS
      ) {
        return;
      }

      const profiles: string[] = [];
      if (audioProfile1) {
        profiles.push(audioProfile1);
      }
      if (
        audioProfile2 &&
        audioProfile2 !== audioProfile1
      ) {
        profiles.push(audioProfile2);
      }

      for (const audioProfileId of profiles) {
        this.pendingContactAudioImpacts.set(
          audioProfileId,
          Math.max(
            this.pendingContactAudioImpacts.get(audioProfileId) ?? 0,
            forceNewtons,
          ),
        );
      }
    });

    this.previousContactAudioForces = currentContactAudioForces;
  }
}
