# Realistic arcade attendant asset

File:
- `arcade-attendant-realistic.glb`

Original asset:
- Title: Indian Office Woman
- Author: Pixel_Monster
- Source: https://sketchfab.com/3d-models/indian-office-woman-e6c60cafd33c4d54b0b840c4146ed244
- License: CC-BY-4.0
- Public mirror used for reproducible build:
  https://github.com/Breyner-Parada/threejsexamples
- Pinned mirror commit:
  88c20e25e98dcf40690cee3b498112ea6fef08be

Claw Chaos modifications:
- original 16.36 MB GLB was processed only in GitHub Actions and was not committed
- textures resized to max 1024 px
- textures converted to WebP
- optimized output is approximately 2.08 MB
- the optimized asset retains `KHR_draco_mesh_compression`
- original skeleton and animation data are retained
- runtime decoding uses the locally vendored Three.js DRACO decoder

Runtime policy:
- desktop/high-detail profile prefers this realistic rigged asset
- mobile profile keeps the lighter Quaternius skinned staff
- failure falls back to the lighter skinned staff, then to the procedural visual
- all staff variants remain visual-only and have no Rapier body/collider

Attribution is retained here because CC-BY-4.0 requires credit.
