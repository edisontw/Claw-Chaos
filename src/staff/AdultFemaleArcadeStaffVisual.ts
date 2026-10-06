import * as THREE from "three";
import {
  DEFAULT_VISUAL_THEME,
  type StaffVisualTheme,
} from "../theme/visualTheme";

export const STAFF_CHARACTER_VISUAL_ONLY = true;
export const STAFF_CHARACTER_VARIANT =
  "adult-female-arcade-attendant-v2-realistic";
export const STAFF_CHARACTER_HEIGHT_METERS = 1.64;

export interface StaffCharacterRig {
  root: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
}

function standardMaterial(
  color: number,
  roughness = 0.72,
  metalness = 0.02,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function physicalMaterial(
  color: number,
  roughness = 0.54,
  metalness = 0.04,
  clearcoat = 0.08,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: 0.42,
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  result.userData.visualOnly = true;
  return result;
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  name: string,
  segments = 18,
): THREE.Mesh {
  return mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      segments,
    ),
    material,
    name,
  );
}

function capsuleLikeLimb(
  radius: number,
  length: number,
  material: THREE.Material,
  name: string,
): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  root.userData.visualOnly = true;

  const shaft = cylinder(
    radius * 0.92,
    radius,
    length,
    material,
    name + "-shaft",
    14,
  );
  shaft.position.y = -length * 0.5;
  root.add(shaft);

  const joint = mesh(
    new THREE.SphereGeometry(radius, 14, 10),
    material,
    name + "-joint",
  );
  joint.position.y = -length;
  root.add(joint);

  return root;
}

function createFace(
  headRoot: THREE.Group,
  theme: StaffVisualTheme,
): void {
  const skin = physicalMaterial(
    theme.skinColor,
    0.78,
    0.00,
    0.015,
  );
  const hair = standardMaterial(theme.hairColor, 0.74);
  const eyeWhite = standardMaterial(theme.blouseColor, 0.94);
  const iris = standardMaterial(theme.hairColor, 0.44);
  const lip = standardMaterial(theme.trimColor, 0.78);

  const face = mesh(
    new THREE.SphereGeometry(0.111, 28, 20),
    skin,
    "staff-face",
  );
  face.scale.set(0.88, 1.10, 0.92);
  headRoot.add(face);

  for (const x of [-0.101, 0.101]) {
    const ear = mesh(
      new THREE.SphereGeometry(0.021, 12, 9),
      skin,
      x < 0 ? "staff-ear-left" : "staff-ear-right",
    );
    ear.position.set(x, -0.004, -0.004);
    ear.scale.set(0.62, 1.05, 0.45);
    headRoot.add(ear);
  }

  const nose = mesh(
    new THREE.ConeGeometry(0.010, 0.025, 12),
    skin,
    "staff-nose",
  );
  nose.position.set(0, -0.010, 0.103);
  nose.rotation.x = Math.PI * 0.5;
  headRoot.add(nose);

  for (const x of [-0.034, 0.034]) {
    const eye = mesh(
      new THREE.SphereGeometry(0.0095, 12, 8),
      eyeWhite,
      x < 0 ? "staff-eye-left" : "staff-eye-right",
    );
    eye.position.set(x, 0.021, 0.100);
    eye.scale.set(1.0, 0.48, 0.28);
    headRoot.add(eye);

    const pupil = mesh(
      new THREE.SphereGeometry(0.0048, 10, 7),
      iris,
      x < 0
        ? "staff-pupil-left"
        : "staff-pupil-right",
    );
    pupil.position.set(x, 0.020, 0.107);
    pupil.scale.set(0.82, 1.0, 0.34);
    headRoot.add(pupil);

    const brow = mesh(
      new THREE.BoxGeometry(0.030, 0.0035, 0.004),
      hair,
      x < 0
        ? "staff-brow-left"
        : "staff-brow-right",
    );
    brow.position.set(x, 0.050, 0.098);
    brow.rotation.z = x < 0 ? -0.07 : 0.07;
    headRoot.add(brow);
  }

  const mouth = mesh(
    new THREE.BoxGeometry(0.027, 0.0035, 0.004),
    lip,
    "staff-mouth",
  );
  mouth.position.set(0, -0.055, 0.101);
  mouth.rotation.x = -0.05;
  headRoot.add(mouth);

  const hairCap = mesh(
    new THREE.SphereGeometry(
      0.121,
      26,
      18,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.64,
    ),
    hair,
    "staff-hair-cap",
  );
  hairCap.position.set(0, 0.037, -0.013);
  hairCap.rotation.x = -0.08;
  headRoot.add(hairCap);

  for (const [index, x] of [-0.055, 0, 0.055].entries()) {
    const bang = mesh(
      new THREE.CapsuleGeometry(0.011, 0.060, 4, 9),
      hair,
      "staff-bang-" + index,
    );
    bang.position.set(x, 0.054 - Math.abs(x) * 0.2, 0.087);
    bang.rotation.z = -x * 1.4;
    bang.rotation.x = 0.10;
    headRoot.add(bang);
  }

  for (const x of [-0.091, 0.091]) {
    const sideLock = mesh(
      new THREE.CapsuleGeometry(0.015, 0.112, 4, 10),
      hair,
      x < 0
        ? "staff-hair-side-left"
        : "staff-hair-side-right",
    );
    sideLock.position.set(x, -0.020, -0.006);
    sideLock.rotation.z = x < 0 ? -0.08 : 0.08;
    headRoot.add(sideLock);
  }

  const ponytail = mesh(
    new THREE.CapsuleGeometry(0.038, 0.165, 5, 12),
    hair,
    "staff-ponytail",
  );
  ponytail.position.set(0, -0.018, -0.145);
  ponytail.rotation.x = -0.28;
  ponytail.scale.set(0.84, 1.16, 0.78);
  headRoot.add(ponytail);

  const hairTie = mesh(
    new THREE.TorusGeometry(0.023, 0.006, 8, 18),
    standardMaterial(theme.hairAccessoryColor, 0.58),
    "staff-hair-tie",
  );
  hairTie.position.set(0, 0.038, -0.106);
  hairTie.rotation.x = Math.PI * 0.5;
  headRoot.add(hairTie);

  const earpiece = mesh(
    new THREE.SphereGeometry(0.015, 12, 9),
    standardMaterial(theme.uniformSecondaryColor, 0.46),
    "staff-headset-earpiece",
  );
  earpiece.position.set(0.108, 0.002, 0.002);
  earpiece.scale.set(0.65, 1.0, 0.45);
  headRoot.add(earpiece);

  const boom = mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 0.090, 8),
    standardMaterial(theme.uniformSecondaryColor, 0.42),
    "staff-headset-boom",
  );
  boom.position.set(0.086, -0.028, 0.055);
  boom.rotation.z = -0.80;
  boom.rotation.x = Math.PI * 0.5;
  headRoot.add(boom);

  const mic = mesh(
    new THREE.SphereGeometry(0.006, 10, 7),
    standardMaterial(theme.uniformSecondaryColor, 0.42),
    "staff-headset-mic",
  );
  mic.position.set(0.055, -0.051, 0.090);
  headRoot.add(mic);
}

function createArm(
  x: number,
  theme: StaffVisualTheme,
): {
  shoulder: THREE.Group;
  forearm: THREE.Group;
} {
  const uniform = standardMaterial(
    theme.uniformSecondaryColor,
    0.64,
  );
  const skin = standardMaterial(theme.skinColor, 0.82);

  const shoulder = new THREE.Group();
  shoulder.name =
    x < 0 ? "staff-left-shoulder" : "staff-right-shoulder";
  shoulder.position.set(x, 1.30, 0);
  shoulder.userData.visualOnly = true;

  const sleeve = capsuleLikeLimb(
    0.044,
    0.205,
    uniform,
    x < 0 ? "staff-left-upper-arm" : "staff-right-upper-arm",
  );
  shoulder.add(sleeve);

  const forearm = new THREE.Group();
  forearm.name =
    x < 0 ? "staff-left-forearm" : "staff-right-forearm";
  forearm.position.y = -0.205;
  forearm.userData.visualOnly = true;
  shoulder.add(forearm);

  const forearmMesh = capsuleLikeLimb(
    0.035,
    0.185,
    skin,
    x < 0 ? "staff-left-forearm-mesh" : "staff-right-forearm-mesh",
  );
  forearm.add(forearmMesh);

  const hand = mesh(
    new THREE.SphereGeometry(0.042, 14, 10),
    skin,
    x < 0 ? "staff-left-hand" : "staff-right-hand",
  );
  hand.position.set(0, -0.205, 0.006);
  hand.scale.set(0.82, 1.15, 0.72);
  forearm.add(hand);

  return { shoulder, forearm };
}

function createLeg(
  x: number,
  theme: StaffVisualTheme,
): THREE.Group {
  const stocking = standardMaterial(
    theme.stockingColor,
    0.82,
  );
  const shoeMaterial = physicalMaterial(
    theme.shoeColor,
    0.46,
    0.04,
    0.10,
  );

  const legRoot = new THREE.Group();
  legRoot.name =
    x < 0 ? "staff-left-leg" : "staff-right-leg";
  legRoot.position.set(x, 0.73, 0);
  legRoot.userData.visualOnly = true;

  const leg = cylinder(
    0.040,
    0.047,
    0.60,
    stocking,
    x < 0
      ? "staff-left-leg-mesh"
      : "staff-right-leg-mesh",
    16,
  );
  leg.position.y = -0.30;
  legRoot.add(leg);

  const ankle = cylinder(
    0.035,
    0.037,
    0.10,
    stocking,
    x < 0 ? "staff-left-ankle" : "staff-right-ankle",
    14,
  );
  ankle.position.y = -0.635;
  legRoot.add(ankle);

  const shoe = mesh(
    new THREE.BoxGeometry(0.092, 0.055, 0.185),
    shoeMaterial,
    x < 0 ? "staff-left-shoe" : "staff-right-shoe",
  );
  shoe.position.set(0, -0.700, 0.045);
  shoe.geometry.translate(0, 0, 0.020);
  legRoot.add(shoe);

  return legRoot;
}

function createUniformTorsoGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.126, -0.205),
    new THREE.Vector2(0.136, -0.145),
    new THREE.Vector2(0.145, -0.055),
    new THREE.Vector2(0.151, 0.045),
    new THREE.Vector2(0.158, 0.125),
    new THREE.Vector2(0.150, 0.202),
  ];
  return new THREE.LatheGeometry(profile, 28);
}

export function createAdultFemaleArcadeStaffVisual(
  theme: StaffVisualTheme = DEFAULT_VISUAL_THEME.staff,
): StaffCharacterRig {
  const root = new THREE.Group();
  root.name = STAFF_CHARACTER_VARIANT;
  root.visible = false;
  root.userData.visualOnly = true;
  root.userData.characterVariant =
    STAFF_CHARACTER_VARIANT;

  const skin = standardMaterial(theme.skinColor, 0.82);
  const uniform = physicalMaterial(
    theme.uniformPrimaryColor,
    0.58,
    0.02,
    0.06,
  );
  const uniformSecondary = standardMaterial(
    theme.uniformSecondaryColor,
    0.64,
  );
  const blouse = standardMaterial(theme.blouseColor, 0.88);
  const skirt = standardMaterial(theme.skirtColor, 0.72);
  const trim = standardMaterial(theme.trimColor, 0.58);
  const badge = physicalMaterial(
    theme.badgeColor,
    0.42,
    0.24,
    0.10,
  );

  const leftLeg = createLeg(-0.064, theme);
  const rightLeg = createLeg(0.064, theme);
  root.add(leftLeg, rightLeg);

  const skirtMesh = cylinder(
    0.122,
    0.176,
    0.305,
    skirt,
    "staff-skirt",
    24,
  );
  skirtMesh.position.y = 0.83;
  root.add(skirtMesh);

  const waistBand = cylinder(
    0.146,
    0.153,
    0.024,
    trim,
    "staff-waist-trim",
    22,
  );
  waistBand.position.y = 0.982;
  root.add(waistBand);

  const torso = mesh(
    createUniformTorsoGeometry(),
    uniform,
    "staff-uniform-torso",
  );
  torso.position.y = 1.15;
  root.add(torso);

  const shirtPlacket = mesh(
    new THREE.BoxGeometry(0.026, 0.220, 0.014),
    blouse,
    "staff-shirt-placket",
  );
  shirtPlacket.position.set(0, 1.185, 0.154);
  root.add(shirtPlacket);

  for (const x of [-0.045, 0.045]) {
    const collar = mesh(
      new THREE.BoxGeometry(0.058, 0.105, 0.014),
      uniformSecondary,
      x < 0 ? "staff-collar-left" : "staff-collar-right",
    );
    collar.position.set(x, 1.275, 0.157);
    collar.rotation.z = x < 0 ? -0.34 : 0.34;
    root.add(collar);
  }

  for (const y of [1.13, 1.19, 1.25]) {
    const button = mesh(
      new THREE.SphereGeometry(0.006, 10, 7),
      badge,
      "staff-shirt-button-" + y.toFixed(2),
    );
    button.position.set(0, y, 0.164);
    button.scale.set(1, 1, 0.50);
    root.add(button);
  }

  const waistPiping = mesh(
    new THREE.BoxGeometry(0.230, 0.018, 0.016),
    trim,
    "staff-waist-piping",
  );
  waistPiping.position.set(0, 1.010, 0.151);
  root.add(waistPiping);

  const collarAccent = mesh(
    new THREE.BoxGeometry(0.086, 0.018, 0.016),
    trim,
    "staff-collar-accent",
  );
  collarAccent.position.set(0, 1.322, 0.158);
  root.add(collarAccent);

  const lanyardMaterial = standardMaterial(
    theme.trimColor,
    0.64,
  );
  for (const x of [-0.032, 0.032]) {
    const strap = mesh(
      new THREE.BoxGeometry(0.010, 0.175, 0.006),
      lanyardMaterial,
      x < 0
        ? "staff-lanyard-left"
        : "staff-lanyard-right",
    );
    strap.position.set(x, 1.205, 0.164);
    strap.rotation.z = x < 0 ? -0.17 : 0.17;
    root.add(strap);
  }

  const badgeBack = mesh(
    new THREE.BoxGeometry(0.070, 0.040, 0.012),
    badge,
    "staff-name-badge",
  );
  badgeBack.position.set(0.070, 1.245, 0.166);
  root.add(badgeBack);

  const badgeStripe = mesh(
    new THREE.BoxGeometry(0.058, 0.008, 0.014),
    blouse,
    "staff-name-badge-stripe",
  );
  badgeStripe.position.set(0.070, 1.245, 0.173);
  root.add(badgeStripe);

  const leftArm = createArm(-0.178, theme);
  const rightArm = createArm(0.178, theme);
  root.add(leftArm.shoulder, rightArm.shoulder);

  const neck = cylinder(
    0.043,
    0.047,
    0.085,
    skin,
    "staff-neck",
    16,
  );
  neck.position.y = 1.395;
  root.add(neck);

  const head = new THREE.Group();
  head.name = "staff-head-rig";
  head.position.y = 1.515;
  head.userData.visualOnly = true;
  createFace(head, theme);
  root.add(head);

  return {
    root,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftForearm: leftArm.forearm,
    rightForearm: rightArm.forearm,
    leftLeg,
    rightLeg,
    head,
  };
}
