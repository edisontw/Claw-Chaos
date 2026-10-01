import type {
  RigidBodyHandle,
  Vec3,
} from "../physics/PhysicsRuntime";
import { M06_CABINET_CONFIG } from "./cabinetGeometry";

export interface ChuteSensorVolume {
  center: Vec3;
  halfExtents: Vec3;
}

export interface ChuteWinEvent {
  prizeId: string;
  sequence: number;
}

export class ChuteSensor {
  private readonly recordedPrizeIds = new Set<string>();
  private sequence = 0;

  constructor(
    readonly volume: ChuteSensorVolume = {
      center: {
        x: M06_CABINET_CONFIG.chuteCenterX,
        y: M06_CABINET_CONFIG.chuteSensorCenterY,
        z: M06_CABINET_CONFIG.chuteCenterZ,
      },
      halfExtents: {
        x: M06_CABINET_CONFIG.chuteSensorHalfX,
        y: M06_CABINET_CONFIG.chuteSensorHalfY,
        z: M06_CABINET_CONFIG.chuteSensorHalfZ,
      },
    },
  ) {}

  containsPoint(point: Vec3): boolean {
    const { center, halfExtents } = this.volume;
    return (
      Math.abs(point.x - center.x) <= halfExtents.x &&
      Math.abs(point.y - center.y) <= halfExtents.y &&
      Math.abs(point.z - center.z) <= halfExtents.z
    );
  }

  pollPrize(
    prizeId: string,
    body: RigidBodyHandle,
  ): ChuteWinEvent | null {
    if (this.recordedPrizeIds.has(prizeId)) {
      return null;
    }

    const centerOfMass = body.worldCom();
    if (!this.containsPoint(centerOfMass)) {
      return null;
    }

    this.recordedPrizeIds.add(prizeId);
    this.sequence += 1;
    return {
      prizeId,
      sequence: this.sequence,
    };
  }

  hasRecordedPrize(prizeId: string): boolean {
    return this.recordedPrizeIds.has(prizeId);
  }

  get winCount(): number {
    return this.recordedPrizeIds.size;
  }
}
