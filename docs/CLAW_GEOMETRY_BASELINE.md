# M01 Three-Prong Claw Geometry Baseline

Version: 0.1  
Date: 2026-09-28

## Purpose

This file defines the first realistic-geometry baseline for the M01 claw laboratory.

The values are **engineering approximations inferred from the supplied real-claw visual references**, not measurements of a named commercial machine. They are intentionally centralized so later real-machine calibration can replace them without rewriting claw behavior.

## Baseline parameters

| Parameter | v1 value | Notes |
| --- | ---: | --- |
| motor housing outside diameter | 0.090 m | cylindrical visual body |
| motor housing total height | 0.145 m | stacked upper/lower housing |
| lower collar outside diameter | 0.110 m | visual pivot ring |
| finger pivot radius | 0.050 m | three pivots at 120 degrees |
| finger rod diameter | 0.009 m | render and collider reference |
| finger path length | about 0.246 m | three straight capsule segments approximating a curve |
| finger node 0 | radial 0.000 m, down 0.000 m | hinge |
| finger node 1 | radial 0.030 m, down 0.070 m | upper outward sweep |
| finger node 2 | radial 0.075 m, down 0.165 m | widest lower sweep |
| finger node 3 | radial 0.050 m, down 0.225 m | inward hook tip |
| open joint target | +0.35 rad | about +20.1 degrees |
| closed joint target | -0.42 rad | about -24.1 degrees |
| estimated open tip span | about 0.348 m | geometric command-space estimate before solver compliance |
| effective finger density | 3200 kg/m^3 | mass-tuning parameter, not a claim of solid material density |
| claw contact friction | 0.60 | provisional; calibrate during PT-001/PT-002 |
| restitution | 0.02 | suppress unrealistic metal bounce |
| motor speed | 1.6 rad/s | retained from verified M01 slice |
| motor stiffness | 180 | provisional Rapier motor setting |
| motor damping | 18 | provisional Rapier motor setting |
| max motor torque | 2.5 N*m | provisional; calibrate during prize-contact tests |

## Geometry model

Each finger remains one independently driven rigid body connected to the hub by one revolute joint.

Visual geometry:
- thin metallic segmented rod,
- outward sweep,
- lower inward hook,
- smooth node caps,
- cylindrical motor housing and lower pivot collar.

Physics geometry:
- three capsule colliders attached to one finger rigid body,
- capsule segments follow the same three-node path as the visible rod,
- no dynamic concave triangle mesh,
- no prize attachment, weld, parenting, or magnetic helper.

The render mesh and collider are deliberately not identical at triangle level. Their centerlines and effective radius should match closely enough that contact behavior remains visually explainable.

## Calibration policy

Do not tune these values merely to force a successful grab.

When PT-001 and later experiments begin, adjust only explicit physical parameters such as:
- opening span,
- finger path,
- tip radius,
- friction,
- mass/effective density,
- joint target,
- motor speed/torque/stiffness/damping.

Record meaningful changes here or in the calibration record.

## Upgrade path

When a real reference machine is measured:
1. record source/method/uncertainty,
2. replace inferred dimensions with measured values,
3. preserve the same data-driven geometry contract,
4. rerun M01 acceptance scenes,
5. do not add prize-specific exceptions to compensate for geometry changes.
