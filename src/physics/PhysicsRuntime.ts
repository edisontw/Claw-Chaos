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

export interface DynamicBodyHandle {
  translation(): Vec3;
  rotation(): Quaternion;
  isSleeping(): boolean;
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

  createStaticCuboid(center: Vec3, halfExtents: Vec3, friction = 0.8): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(friction),
      body,
    );
  }

  createDynamicCuboid(
    center: Vec3,
    halfExtents: Vec3,
    rotationYRadians: number,
  ): DynamicBodyHandle {
    const halfYaw = rotationYRadians * 0.5;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(center.x, center.y, center.z)
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) }),
    );

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(0.7)
        .setRestitution(0.08),
      body,
    );

    this.dynamicBodyCountValue += 1;
    return body;
  }

  step(): void {
    this.world.step();
  }
}
