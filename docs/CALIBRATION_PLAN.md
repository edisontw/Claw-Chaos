# Real-Machine Calibration Plan

Version: 0.1  
Date: 2026-09-28

## 1. Purpose

Claw Chaos aims to feel physically close to real claw machines.

That requires a repeatable calibration process. Parameters should not be tuned only by "looks right".

The calibration process should distinguish:

- **measured** — directly measured from a real machine or prize,
- **inferred** — estimated from video/motion/load observations,
- **tuned** — deliberately adjusted for stable simulation or usability.

Every important calibrated parameter should preserve its provenance.

---

## 2. Calibration priority

Calibrate in this order:

1. cabinet and playfield geometry,
2. claw geometry,
3. gantry speed/acceleration/braking,
4. suspension length and swing period,
5. swing damping,
6. reel/drop/lift timing,
7. finger close timing,
8. prize mass and center of mass,
9. contact friction,
10. effective close/pickup/retaining force,
11. chute geometry and release timing,
12. input/control latency.

Do not tune claw force before the geometry, mass and friction are approximately correct.

---

## 3. Cabinet measurement set

For each representative machine, record:

- cabinet width/height/depth,
- playfield width/depth/height,
- front/side glass position and angle,
- gantry rail range,
- chute opening dimensions,
- chute wall/barrier height,
- home position,
- release position,
- control-panel height,
- approximate player eye-to-glass distance.

Recommended units:
- millimeters for source measurement,
- meters after conversion into runtime data.

Photograph or diagram measurement points where legally/operationally appropriate.

---

## 4. Claw geometry

Measure or infer:

- hub diameter/height,
- finger count,
- finger total length,
- curved finger profile,
- tip width/thickness,
- fully open span,
- nominal closed span,
- hinge/pivot location,
- finger rest/open angle,
- finger mass if obtainable,
- claw-head total mass if obtainable.

If exact curved geometry is unavailable:
1. photograph from orthogonal-ish views,
2. trace a simplified curve,
3. reproduce with a small number of collision primitives or convex hulls,
4. verify contact points against video.

Gameplay collider geometry should prioritize correct contact behavior over mesh-level detail.

---

## 5. Gantry motion calibration

Record a representative full-speed move over a known distance.

Measure:
- acceleration time,
- steady-state speed,
- stopping time,
- stopping distance,
- direction-reversal response.

Video method:
1. record at 60 fps or higher,
2. establish known cabinet distance,
3. track carriage position frame-by-frame,
4. derive position vs time,
5. estimate velocity and acceleration.

Store both:
- measured curve,
- simplified runtime approximation.

The runtime model does not need to recreate motor electronics if the observable motion matches.

---

## 6. Suspension and swing calibration

Record the empty claw after a deliberate carriage stop.

Measure:
- cable/suspension length,
- first peak angle/displacement,
- oscillation period,
- amplitude decay across several cycles,
- yaw/twist behavior if visible.

Useful observables:

```text
T = swing period
A0 = initial amplitude
A1, A2, A3 = later peak amplitudes
```

Tune:
- effective suspension length,
- angular damping,
- torsional damping,
- hub mass.

Validation:
- simulated period should match real video within an agreed tolerance,
- amplitude decay should visually and numerically approximate the real machine.

---

## 7. Reel/drop/lift calibration

Measure:
- time from DROP to full lower travel,
- time from close to initial lift,
- full lift time,
- whether speed is constant or ramps,
- upper/lower deceleration behavior.

Also note:
- whether horizontal motion locks after DROP,
- whether the claw can early-close,
- whether lift begins immediately after closing or after a settle delay.

These behaviors belong to machine/control profiles, not global gameplay logic.

---

## 8. Finger-close calibration

Measure:
- time from close command to unloaded closed position,
- loaded close behavior against a known object,
- whether fingers close symmetrically,
- whether finger contact visibly slows/stops one arm,
- open/release speed.

A useful first approximation is a motorized hinge with:
- target angular speed,
- torque limit,
- compliance/damping.

Do not tune closing by animation duration alone.

---

## 9. Prize mass and center of mass

For real reference prizes:

Measure:
- total mass,
- dimensions,
- obvious internal asymmetry.

Estimate COM:
- balance the object along one axis,
- repeat along another axis,
- infer approximate center.

For boxed prizes, note:
- inserts,
- windows,
- heavy figure position,
- cardboard/plastic packaging.

For plush, note:
- head/body mass distribution,
- weighted beans/pellets if present,
- limb proportions.

---

## 10. Friction calibration

Direct real coefficient measurement may be difficult.

Use controlled comparative tests.

Possible incline test:
1. place representative material on a representative contact surface,
2. slowly increase angle,
3. record onset-of-slip angle,
4. estimate static friction from the tangent of that angle.

Use this only as an approximation because:
- fabric/plush contact is deformable,
- claw tips may have coatings,
- packaging edges create geometric hooking.

Dynamic friction can be inferred from controlled sliding distance/deceleration.

Record uncertainty.

---

## 11. Effective claw-force calibration

Exact motor/coil torque may be inaccessible.

Prefer behavioral inference.

Possible tests:
- known prize mass that can/cannot be lifted,
- same object with different contact positions,
- observe slip after pickup-to-retaining transition,
- compare loaded finger closure angle/time.

Tune the smallest set of parameters that reproduces:
- initial pinch,
- successful pickup,
- delayed slip,
- retaining behavior.

Do not fit a hidden "success percentage".

---

## 12. Return and release calibration

Record:
- lift completion height,
- horizontal return path,
- return speed,
- braking above chute,
- release delay,
- opening time,
- prize fall/chute impact.

This is especially important because return deceleration can change prize swing and cause a real loss before release.

---

## 13. Input and control calibration

Observe:
- joystick/button dead zone,
- digital vs analog movement,
- delay from input to visible carriage motion,
- whether diagonal movement is allowed,
- whether X/Z axes can move simultaneously,
- whether controls lock after DROP,
- aim timer,
- early-close behavior.

Represent these through `ControlProfile`.

---

## 14. Camera/view calibration

Use real standing-player observations to tune:
- eye height,
- distance to front glass,
- horizontal FOV,
- side-step range,
- lean range.

Do not use extreme camera FOV to compensate for insufficient head/body movement.

Depth perception should come from:
- parallax,
- side viewing,
- cabinet geometry,
- motion,
not an artificial top-down view.

---

## 15. Calibration scene mapping

Each measured behavior should map to a simulator scene:

```text
calibration/gantry_accel
calibration/gantry_brake
calibration/empty_swing
calibration/reel_drop
calibration/finger_close
calibration/ball_grip
calibration/box_slip
calibration/return_release
```

A calibration scene should expose:
- parameter values,
- reference target,
- simulated measurement,
- error/tolerance.

---

## 16. Calibration record format

Suggested record:

```json
{
  "id": "calibration/example-machine/empty-swing",
  "machineModel": "generic-reference-01",
  "date": "2026-09-28",
  "basis": "measured",
  "source": "60fps side video",
  "measurements": {
    "suspensionLengthM": 0.42,
    "swingPeriodS": 1.30
  },
  "uncertainty": {
    "suspensionLengthM": 0.01,
    "swingPeriodS": 0.03
  },
  "notes": "Example schema only; values are not project defaults."
}
```

Do not copy example values into production defaults without measurement.

---

## 17. Calibration acceptance

A machine can be called "reference calibrated" only when the project has documented at least:

- cabinet/playfield dimensions,
- claw geometry/open span,
- gantry movement timing,
- suspension/swing period,
- swing damping,
- drop/lift timing,
- close timing,
- at least one reference prize mass/material case,
- return/release behavior,
- source/method/uncertainty.

Gameplay tuning may still occur afterward, but deviations should be documented as tuned approximations.
