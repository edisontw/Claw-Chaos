/**
 * Bounds-aware claw opening for cabinets with narrow glass envelopes.
 * The physical fingers continue to be controlled by their revolute motors.
 * This only caps the target opening angle during player travel; it does not
 * teleport or reconfigure colliders and has no effect on a closing claw.
 */
export interface WallSafeClawProfile {
  interiorHalfX: number;
  interiorHalfZ: number;
  fullOpenBounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
  extendedBounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
  fingerPivotRadius: number;
  fingerNodes: readonly { radial: number; down: number }[];
  fingerRadius: number;
  fingerTipRadius: number;
  minAngleRadians: number;
  maxAngleRadians: number;
  predictiveSeconds: number;
  additionalMarginMeters: number;
}

export interface HorizontalMotion {
  x: number;
  z: number;
  velocityX?: number;
  velocityZ?: number;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

/** The maximum outward extent of any physical finger section, not just the tip. */
export function fingerRadialEnvelope(
  angleRadians: number,
  profile: Pick<
    WallSafeClawProfile,
    "fingerPivotRadius" | "fingerNodes" | "fingerRadius" | "fingerTipRadius"
  >,
): number {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return profile.fingerPivotRadius +
    Math.max(
      ...profile.fingerNodes.map((node, index) =>
        node.radial * cos +
        node.down * sin +
        (index === profile.fingerNodes.length - 1
          ? profile.fingerTipRadius
          : profile.fingerRadius),
      ),
    );
}

/** Full opening is preserved in the original accepted interior and at the chute park. */
export function wallSafeFingerOpenAngle(
  motion: HorizontalMotion,
  profile: WallSafeClawProfile,
): number {
  const aheadX = clamp(
    motion.x + (motion.velocityX ?? 0) * profile.predictiveSeconds,
    profile.extendedBounds.xMin,
    profile.extendedBounds.xMax,
  );
  const aheadZ = clamp(
    motion.z + (motion.velocityZ ?? 0) * profile.predictiveSeconds,
    profile.extendedBounds.zMin,
    profile.extendedBounds.zMax,
  );
  const original = profile.fullOpenBounds;
  if (
    aheadX >= original.xMin &&
    aheadX <= original.xMax &&
    aheadZ >= original.zMin &&
    aheadZ <= original.zMax
  ) {
    return profile.maxAngleRadians;
  }

  const beyond = Math.max(
    original.xMin - aheadX,
    aheadX - original.xMax,
    original.zMin - aheadZ,
    aheadZ - original.zMax,
    0,
  );
  // Preserve the original full-open reach while introducing more clearance
  // progressively beyond the old stops. Motion look-ahead gives the motors
  // time to fold before the moving hub reaches the glass.
  const addedMargin = Math.min(
    profile.additionalMarginMeters,
    beyond * 0.14,
  );
  const radiusLimit = Math.min(
    profile.interiorHalfX - Math.abs(aheadX),
    profile.interiorHalfZ - Math.abs(aheadZ),
  ) - addedMargin;

  if (
    fingerRadialEnvelope(profile.maxAngleRadians, profile) <=
    radiusLimit
  ) {
    return profile.maxAngleRadians;
  }

  let low = profile.minAngleRadians;
  let high = profile.maxAngleRadians;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) * 0.5;
    if (fingerRadialEnvelope(mid, profile) > radiusLimit) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return low;
}
