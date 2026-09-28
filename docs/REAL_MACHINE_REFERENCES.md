# Real-Machine Reference Notes

Version: 0.1  
Date: 2026-09-28

## Purpose

This document records real commercial-machine behaviors that inform Claw Chaos.

It is a design reference, not a claim that every claw machine behaves identically.

Implementation should reproduce the broad mechanical/operational concepts while avoiding:
- copied branding,
- copied cabinet art,
- copyrighted characters,
- proprietary sounds,
- exact trade dress.

## 1. SEGA UFO CATCHER family

### UFO CATCHER 10

Official product page:
- https://www.sega.jp/arcade/detail/ufo-catcher-10/

Design relevance:
- current mainstream Japanese crane-machine reference,
- useful for cabinet proportions, visibility, control simplicity, and 2-prong-style prize-game direction,
- reinforces that a realistic simulator should not assume all machines use 3-prong claws.

### UFO CATCHER TRIPLE

Official product page:
- https://www.sega.jp/arcade/detail/ufo-triple/

SEGA describes:
- three arms,
- support for very large prizes,
- large prize outlet,
- transparent cabinet design,
- viewing prizes from multiple angles.

Design implications:
- support a true 3-prong machine family,
- large-prize cabinets need different claw/chute dimensions rather than a scaled cosmetic skin,
- side visibility is part of the real-machine experience and supports the first-person side-inspection camera design.

### UFO CATCHER TRIPLE TWIN / TWIN 2

Official references:
- https://www.sega.jp/topics/detail/180523_arcade_1/
- https://www.sega.jp/arcade/detail/ufo-catcher-triple-twin-2/

Design relevance:
- confirms multiple 3-arm cabinet formats exist,
- supports treating cabinet, claw, playfield and prize size as configurable families.

### Current machine ecosystem

SEGA operator update listing:
- https://am.sega.jp/crane/pit

The listed machine families demonstrate that modern crane-machine operation is not a single mechanical layout.

## 2. ELAUT E-Claw / E-Claw 2.0

Official E-Claw 2.0:
- https://www.elaut.com/games/claw-machines/e-claw-2-0

Official product announcement:
- https://www.elaut.com/all-news/e-claw-2-wonka-claw-new-products

Observed/claimed features relevant to the simulator:
- smart claw and gantry,
- automatic adjustment of brake and weight-cell behavior,
- mixed premium prizes with weight differences,
- detection of unsuitable claw/prize combinations,
- local and remote configuration,
- operational/performance reporting,
- optional overhead camera on the claw gantry.

Design implications:
- machine braking is a real operator/mechanical parameter and should affect swing,
- prize weight and claw selection matter,
- premium machines can legitimately expose an in-world overhead camera display,
- operator mode can include remote-style diagnostics and reporting without inventing a fantasy system.

## 3. ELAUT controller behavior: pickup vs retaining power

Reference manual mirror:
- https://manuals.plus/m/5eb20d656439c647a7eab355f6431381924ed77f40e9bbd27e81096dd90ec705

The documented controller separates concepts including:
- pickup power,
- retaining power,
- pickup time,
- product cost,
- effective price out,
- automatic claw adjustment,
- claw learning,
- prize weight detection,
- payout-related operation.

The manual describes retaining power as a lower force level associated with allowing/releasing the prize and pickup power as the force used to lift the product.

Design implication:

Claw Chaos should not use one scalar called "claw strength".

Use at least:
```text
close torque
pickup torque
retaining torque
pickup duration
optional hold boost
```

Exact real-machine percentages are controller-specific and must not be copied as universal physical constants.

## 4. Commercial regulator vs pure simulation

Real commercial crane controllers may use:
- product cost,
- vending price,
- target payout behavior,
- automatic claw power,
- pickup timing variation.

This supports two separate game modes:

### Pure Simulation
- fixed mechanical parameters,
- no hidden adaptive claw strength,
- physical outcome only.

### Commercial Simulation
- explicit operator rules can alter pickup/retaining/timing parameters,
- physical solver still resolves the final contact outcome.

Never implement commercial behavior by simply selecting WIN/LOSE and animating the result.

## 5. Early close / "catch in air"

Some commercial claw-machine controller documentation describes a second descent/action input that can initiate closing before reaching the bottom.

Design implication:
- Claw Chaos exposes a player-operated early-close action ("收爪") during descent,
- closing still takes physical time,
- the claw retains swing and horizontal momentum.

This feature should remain configurable because not every real cabinet exposes identical controls.

## 6. Prize detector and low-stock operation

Commercial manuals include prize detector / chute detection and low-product alarm concepts.

Design implications:
- win detection belongs in the chute/retrieval path, not at the claw,
- machines can maintain inventory count,
- low-stock state can request restocking,
- chute obstruction can be represented as a service fault.

## 7. Taiwan self-service claw-machine ruleset

Official Ministry of Economic Affairs regulation:
- https://law.moea.gov.tw/LawContent.aspx?id=GL001755

As of the current reference version (promulgated 2024-10-14), the regulation defines self-service prize machines around guaranteed retrieval and consideration/payment principles.

Relevant points include:
- guaranteed-prize functionality,
- guarantee cap stated as NT$990 in the current text,
- accumulated inserted amount/count must not be arbitrarily reset,
- restrictions on unauthorized barriers, partitions, bounce devices, magnetic devices or other additions affecting retrieval possibility,
- required operator/information disclosure.

Design implications:
- implement a dedicated Taiwan ruleset rather than treating this as universal global operation,
- store the guarantee threshold in configuration/data,
- keep accumulation as persistent machine/session state,
- do not conflate guaranteed retrieval with physical retaining force,
- validate regulatory data again before any public release because rules can change.

## 8. First-person realism implications

Real commercial cabinets emphasize visibility through transparent play areas.

Claw Chaos therefore treats viewing behavior as gameplay:
- front glass,
- side glass,
- body shift,
- head turn,
- depth judgment,
- optional in-world monitor on machines that support it.

The simulator should not "solve" depth judgment by giving every machine a free overhead camera.

## 9. What is intentionally generalized

The game will generalize rather than reproduce proprietary internals for:
- coil electrical curves,
- exact controller PWM percentages,
- proprietary payout algorithms,
- manufacturer-specific diagnostic thresholds,
- exact cabinet dimensions unless measured/licensed.

We instead calibrate physically plausible parameters that reproduce observable behavior.

## 10. Research backlog

Future research should document:
- measured claw finger dimensions for representative 2-prong and 3-prong machines,
- typical carriage speeds/accelerations,
- typical suspension lengths,
- real claw head mass,
- real prize material friction estimates,
- common Taiwan machine layouts,
- common Japanese bridge/bar spacing,
- real service/reposition practices,
- machine tilt/shock behavior,
- chute sensor geometry,
- audio recordings or original sound-design references that can be legally recreated.

Each measured parameter should record:
- source,
- machine model,
- measurement method,
- uncertainty,
- whether it is safe to use as a general default.

