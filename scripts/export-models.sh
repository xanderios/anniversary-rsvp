#!/bin/sh
# Rebuilds the 3D scenes from the scripts in blender/ and writes web/src/models/*.glb.
# Needs Blender 4.2+ on the PATH (or BLENDER=/path/to/blender). Pass --save to also rewrite blender/castelo.blend.
set -e
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-blender}"
TMP="$(mktemp -d)"
{
  echo "OUT_MODELS = r'$PWD/web/src/models'"
  cat blender/common.py blender/exterior.py blender/interior.py blender/export_web.py
  if [ "$1" = "--save" ]; then echo "bpy.ops.wm.save_as_mainfile(filepath=r'$PWD/blender/castelo.blend')"; fi
} > "$TMP/build.py"
"$BLENDER" -b --factory-startup --python-exit-code 1 -P "$TMP/build.py" | grep -E "RESULT|Error|Traceback|done|exported" || true
rm -rf "$TMP"
ls -l web/src/models/
