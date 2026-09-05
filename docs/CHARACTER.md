# Playable character

The default adventurer is an original modern anime character: blonde layered
hair, blue eyes, a slightly oversized lavender hoodie, navy and lavender plaid
skirt, ankle socks and white sneakers. All guest players currently share this
appearance. NPCs and enemies retain their prototype models.

Press **C** or **C · Character** to inspect the character. Right-drag to orbit,
scroll to zoom, and press C again to restore the previous camera. Movement,
spell effects and mounting select animations automatically.

## Art source and exports

- [Turnaround concept](../assets/characters/hero/concept/turnaround.png).
- [3D modeling concept](../assets/characters/hero/concept/model-reference.png).
- [Concept prompts](../assets/characters/hero/concept/PROMPTS.md), generated with
  the built-in imagegen tool. These are design references, not game screenshots.
- [Editable Blender scene](../assets/characters/hero/hero.blend).
- [Full-detail glTF](../public/characters/hero/hero.glb) and
  [distance glTF](../public/characters/hero/hero-lod1.glb).
- [Export manifest](../public/characters/hero/manifest.json) with exact counts.

The model is authored from curved mesh surfaces with a deform rig, painted eye
and cheek detail, layered hair, pleated fabric, garment seams and drawstrings.
Geometry and textures are original; no third-party art downloads or remote
model-generation services are used. The game model is a stylized interpretation
of the concepts, with simpler fabric and hair detail than the illustrations.

## Runtime budget and animation

The full model is approximately 46,000 triangles; its distance model is
approximately 11,500. Each uses two materials, packed textures, and 24 bones.
The glTF files are approximately 2 MB and 0.72 MB. There are no external texture
URLs, compression decoders, or runtime cloth/hair simulations.

Five clips are authored at 60 frames per second:

| Clip | Use | Duration |
| --- | --- | --- |
| Idle | Standing and breathing | 2.4 s |
| Walk | Available for slower locomotion | 1.2 s |
| Run | Current WASD movement speed | 0.7 s |
| Cast | Server-confirmed spells | 0.8 s |
| Ride | Seated travel pose | 2 s |

Hair and skirt secondary motion is baked into the rig. Animation transitions
blend over 160 ms. The local player always uses full detail. Other players switch
to the distance model beyond 26 m and return to full detail inside 22 m; beyond
120 m their meshes and animation playback are disabled. Mesh buffers and
materials are shared between players; each has independent bones and animations.

60 fps animation authoring does not itself guarantee 60 fps rendering. The
optional `tests/character-performance.mjs` measures 10-second samples at 1080p
for a close view, 20 connected characters standing, and 20 connected characters
moving. It rejects software rendering when `FUNMMO_GPU_TEST=1` and records
average frame rate and the 95th-percentile frame interval in ignored artifacts.
Run it in the restricted browser container with explicitly configured graphics
device access; keep machine-specific device/group configuration outside the repo.
This is a local rendering benchmark, not an MMO server-scale load test.

## Editing and rebuilding

Open `assets/characters/hero/hero.blend` in Blender 5.2 or later. The scene contains
the character, rig, distance mesh, studio lights and a preview camera. The distance
mesh is hidden for editing; only selected character meshes and the armature are
exported. Five actions are retained on the rig's NLA tracks.

The reproducible authoring scripts are in `tools/art/`. Using an already reviewed
Blender installation, run from the repository root:

```sh
blender --background --python tools/art/build_hero.py
```

This rebuilds the generated scene and overwrites the character source and exports.
Preserve manual edits before rebuilding. The scripts create only the `funMMO Hero`
scene, use Blender's bundled Python/NumPy, and perform no package installation or
network access. To preserve hand edits, run only the export step from Blender with
`HERO_ROOT` set to the repository root.

Keep both glTF files, the manifest, and the `.blend` source together when changing
the character. Run `./dev test`, `./dev build`, `./dev up`, and `./dev browser`.
Review the close-up and mounted screenshots as well as the game journey. Structural
tests check texture embedding, triangle limits, indices, skin weights, bone counts,
and animation durations. Review the Blender file's packed data and output paths
for privacy before publishing it.
