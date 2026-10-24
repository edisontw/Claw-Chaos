import { describe, expect, it } from "vitest";
import {
  MOBILE_ACTION_DEBOUNCE_MS,
  MOBILE_JOYSTICK_DEAD_ZONE_FRACTION,
  canClaimJoystickPointer,
  isActiveJoystickPointer,
  isNonPointerActionClick,
  isActionPressAllowed,
  normalizeVirtualJoystick,
} from "./mobileCabinetControls";

describe("mobile cabinet controls", () => {
  it("accepts keyboard and assistive-tech action clicks without repeating pointer taps", () => {
    // Enter/Space and assistive-tech synthesized clicks have detail 0.
    expect(isNonPointerActionClick(0)).toBe(true);
    // Touch/mouse pointerdown already triggered the action: ignore follow-up clicks.
    expect(isNonPointerActionClick(1)).toBe(false);
    expect(isNonPointerActionClick(2)).toBe(false);
  });

  it("keeps the active joystick finger until release, even with a second touch", () => {
    expect(canClaimJoystickPointer(null)).toBe(true);
    // Another finger touching the joystick must not steal the active drag.
    expect(canClaimJoystickPointer(7)).toBe(false);
    expect(canClaimJoystickPointer(42)).toBe(false);
    // After pointerup or pointercancel clears the owner, another drag can start.
    expect(canClaimJoystickPointer(null)).toBe(true);
  });

  it("releases the joystick only when its owning pointer loses capture", () => {
    expect(isActiveJoystickPointer(null, 7)).toBe(false);
    expect(isActiveJoystickPointer(7, 8)).toBe(false);
    expect(isActiveJoystickPointer(7, 7)).toBe(true);
    expect(isActiveJoystickPointer(0, 0)).toBe(true);
    // A stale lostpointercapture from an earlier finger must not stop a new drag.
    expect(isActiveJoystickPointer(8, 7)).toBe(false);
  });

  it("applies a dead zone, remaps travel, and clamps to the unit circle", () => {
    const centered = normalizeVirtualJoystick(0, 0, 50);
    expect(centered).toEqual({ x: 0, z: 0 });

    const deadZonePixels =
      50 * MOBILE_JOYSTICK_DEAD_ZONE_FRACTION;
    const insideDeadZone = normalizeVirtualJoystick(
      deadZonePixels * 0.8,
      0,
      50,
    );
    expect(insideDeadZone).toEqual({ x: 0, z: 0 });

    const right = normalizeVirtualJoystick(50, 0, 50);
    expect(right.x).toBeCloseTo(1, 10);
    expect(right.z).toBeCloseTo(0, 10);

    const up = normalizeVirtualJoystick(0, -50, 50);
    expect(up.x).toBeCloseTo(0, 10);
    expect(up.z).toBeCloseTo(-1, 10);

    const halfTravel = normalizeVirtualJoystick(
      50 *
        (MOBILE_JOYSTICK_DEAD_ZONE_FRACTION +
          (1 - MOBILE_JOYSTICK_DEAD_ZONE_FRACTION) * 0.5),
      0,
      50,
    );
    expect(halfTravel.x).toBeCloseTo(0.5, 10);

    const diagonal = normalizeVirtualJoystick(100, 100, 50);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 10);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.z).toBeGreaterThan(0);
  });

  it("handles invalid or tiny joystick radii safely", () => {
    const vector = normalizeVirtualJoystick(1, -1, 0);
    expect(Number.isFinite(vector.x)).toBe(true);
    expect(Number.isFinite(vector.z)).toBe(true);
    expect(Math.hypot(vector.x, vector.z)).toBeLessThanOrEqual(1);
  });

  it("debounces accidental rapid action taps without blocking deliberate follow-up", () => {
    expect(
      isActionPressAllowed(Number.NEGATIVE_INFINITY, 1000),
    ).toBe(true);
    expect(
      isActionPressAllowed(
        1000,
        1000 + MOBILE_ACTION_DEBOUNCE_MS - 1,
      ),
    ).toBe(false);
    expect(
      isActionPressAllowed(
        1000,
        1000 + MOBILE_ACTION_DEBOUNCE_MS,
      ),
    ).toBe(true);
  });
});
