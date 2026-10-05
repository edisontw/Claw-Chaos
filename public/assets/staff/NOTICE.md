# Skinned arcade staff asset

Files:
- `quaternius-woman.gltf`
- `quaternius-woman.png`

Purpose:
- visual-only adult female arcade staff NPC for Claw Chaos
- skeletal idle / walking / service animation

Source:
- Gabor Szauer, `GameAnimationProgramming`
- source files: `AllChapters/Assets/Woman.gltf` and `Woman.png`
- source commit: 912f8663aa624bba184269f328e4719e29915335

Asset attribution:
- public asset manifests attribute the animated woman model to Quaternius under CC0 1.0
- example attribution evidence: layoutit/polycss lists `urban/Animated Woman.glb` as Quaternius, CC0 1.0

Project use:
- loaded through Three.js GLTFLoader
- runtime scaling/material treatment handled by `SkinnedArcadeStaffVisual.ts`
- no physics body or collider is created for this visual asset
