import { describe, expect, it, vi } from "vitest";
import { createCabinetPhysics, M06_CABINET_CONFIG } from "../cabinet/cabinetGeometry";
import { cabinetPrizeDefinition } from "../cabinet/cabinetPrizeSizing";
import {
  CABINET_CLAW_PARK_POSITION,
  CABINET_GANTRY_TRAVEL_BOUNDS,
  CABINET_STOCKED_GRIP_TUNING,
  CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
  CABINET_STOCKED_APPROACH_REEL_SPEED_METERS_PER_SECOND,
  CABINET_STOCKED_APPROACH_DISTANCE_METERS,
} from "../cabinet/cabinetPlayTuning";
import { FIXED_TIMESTEP_SECONDS, PHYSICS_HZ } from "../config/simulation";
import { PhysicsRuntime } from "../physics/PhysicsRuntime";
import { createPrize } from "../prizes/PrizeFactory";
import { getPrizeDefinition } from "../prizes/catalog";
import { createGantryLabScene } from "../scenes/gantryLab";

describe("stocked descent does not auto-close on a nearby prize brush", () => {
  it("continues descending after a real side-prize contact instead of auto-closing 2.5 cm later", async () => {
    const physics = await PhysicsRuntime.create();
    const cabinet = createCabinetPhysics(physics);
    const definition = cabinetPrizeDefinition(
      getPrizeDefinition("prize/box_tall"), "stocked",
    );
    const prize = createPrize(physics, definition, {
      position: {
        x: 0.14,
        y: M06_CABINET_CONFIG.playDeckY + definition.dimensions.y * 0.5,
        z: 0,
      },
      variantSeed: "tall-side-brush",
    });
    for (let tick = 0; tick < PHYSICS_HZ * 2; tick += 1) physics.step();
    vi.stubGlobal("window", new EventTarget());
    const THREE = await import("three");
    const scene = createGantryLabScene(new THREE.Scene(), physics, {
      addLabFloor: false,
      initialPosition: { x: 0, z: 0 },
      playReturnTarget: CABINET_CLAW_PARK_POSITION,
      travelBounds: CABINET_GANTRY_TRAVEL_BOUNDS,
      verticalHomeOffset: CABINET_STOCKED_GRIP_TUNING.verticalHomeOffsetMeters,
      additionalPickupDropMeters: CABINET_STOCKED_GRIP_TUNING.additionalPickupDropMeters,
      reelMaxSpeedMetersPerSecond: CABINET_STOCKED_REEL_MAX_SPEED_METERS_PER_SECOND,
      reelApproachMaxSpeedMetersPerSecond: CABINET_STOCKED_APPROACH_REEL_SPEED_METERS_PER_SECOND,
      reelApproachDistanceMeters: CABINET_STOCKED_APPROACH_DISTANCE_METERS,
      descentFloorBodies: () => cabinet.playDeckBodies,
      descentContactBodies: () => [prize.body],
      clawContinuousCollision: true,
      gripProfile: {
        hubMassKg: CABINET_STOCKED_GRIP_TUNING.hubMassKg,
        fingerFriction: CABINET_STOCKED_GRIP_TUNING.fingerFriction,
        fingerRodFriction: CABINET_STOCKED_GRIP_TUNING.fingerRodFriction,
        fingerDensity: CABINET_STOCKED_GRIP_TUNING.fingerDensity,
        fingerAngularDamping: CABINET_STOCKED_GRIP_TUNING.fingerAngularDamping,
        openAngleRadians: CABINET_STOCKED_GRIP_TUNING.openAngleRadians,
        closedAngleRadians: CABINET_STOCKED_GRIP_TUNING.closedAngleRadians,
        fingerLowerPadRadiusMeters: CABINET_STOCKED_GRIP_TUNING.fingerLowerPadRadiusMeters,
        fingerLowerPadLengthMeters: CABINET_STOCKED_GRIP_TUNING.fingerLowerPadLengthMeters,
        descentPrizeContactStiffness: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactStiffness,
        descentPrizeContactDamping: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactDamping,
        descentPrizeContactMaxTorque: CABINET_STOCKED_GRIP_TUNING.descentPrizeContactMaxTorque,
        descentOpenStiffness: CABINET_STOCKED_GRIP_TUNING.descentOpenStiffness,
        descentOpenDamping: CABINET_STOCKED_GRIP_TUNING.descentOpenDamping,
        descentOpenMaxTorque: CABINET_STOCKED_GRIP_TUNING.descentOpenMaxTorque,
        bottomCloseSettleSeconds: CABINET_STOCKED_GRIP_TUNING.bottomCloseSettleSeconds,
        closeRampSeconds: CABINET_STOCKED_GRIP_TUNING.closeRampSeconds,
        closeRampStartTorque: CABINET_STOCKED_GRIP_TUNING.closeRampStartTorque,
        closeMotorDamping: CABINET_STOCKED_GRIP_TUNING.closeMotorDamping,
        closePickupTorque: CABINET_STOCKED_GRIP_TUNING.closePickupTorque,
        retainingTorque: CABINET_STOCKED_GRIP_TUNING.retainingTorque,
        holdBoostTorque: CABINET_STOCKED_GRIP_TUNING.holdBoostTorque,
        pickupLiftDistanceMeters: CABINET_STOCKED_GRIP_TUNING.pickupLiftDistanceMeters,
      },
    });
    for (let tick = 0; tick < PHYSICS_HZ; tick += 1) {
      scene.beforePhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      physics.step();
    }
    expect(scene.primaryAction?.()).toBe(true);
    const fingers = scene.bindings.map((binding) => binding.body).filter(
      (body) => body.isDynamic() && body !== scene.massPropertiesDebugTargets?.[0]?.body,
    );
    let contactPayout: number | null = null;
    let closingPayout: number | null = null;
    let continuedPastOldPrematureStop = false;
    let deckContact = false;
    for (let tick = 0; tick < PHYSICS_HZ * 5; tick += 1) {
      scene.beforePhysicsStep?.(FIXED_TIMESTEP_SECONDS);
      physics.step();
      const phase = scene.getMachineAudioState?.()?.playPhase;
      const line = scene.debugLines?.().find((s) => s.startsWith("Reel payout"));
      const payout = Number(line?.match(/Reel payout\s+([0-9.]+)/)?.[1] ?? "0");
      const prizeTouch = fingers.some(
        (body) => physics.countBodyContactPairs(body, prize.body) > 0,
      );
      deckContact ||= cabinet.playDeckBodies.some(
        (deck) => fingers.some(
          (body) => physics.countBodyContactPairs(body, deck) > 0,
        ),
      );
      if (prizeTouch && contactPayout === null && phase === "DESCENDING") {
        contactPayout = payout;
      }
      if (contactPayout !== null && payout > contactPayout + 0.035) {
        if (phase === "DESCENDING") continuedPastOldPrematureStop = true;
      }
      if (phase === "CLOSING") {
        closingPayout = payout;
        break;
      }
    }
    console.log("stocked side-brush drop", JSON.stringify({
      contactPayout, closingPayout, continuedPastOldPrematureStop, deckContact,
    }));
    expect(contactPayout).not.toBeNull();
    expect(continuedPastOldPrematureStop).toBe(true);
    expect(closingPayout).not.toBeNull();
    expect(closingPayout!).toBeGreaterThan(contactPayout! + 0.05);
    vi.unstubAllGlobals();
  }, 20_000);
});
