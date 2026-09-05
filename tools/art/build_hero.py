"""Rebuild the character with Blender's bundled Python, without downloads.

From the repository root: blender --background --python tools/art/build_hero.py
Creates a separate funMMO Hero scene and writes only that scene to hero.blend.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
namespace={'HERO_ROOT':str(root)}
for step in ['hero_geometry.py','hero_studio.py','hero_rig.py','hero_export.py']:
    script=root/'tools'/'art'/step
    exec(compile(script.read_text(),step,'exec'),namespace)
