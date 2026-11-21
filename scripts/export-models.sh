#!/bin/sh
# Rebuilds the 3D scenes from the scripts in blender/ and writes web/src/models/*.glb, once per
# level of detail: garden-low.glb / garden.glb (medium) / garden-high.glb, and the same for hall.
# Needs Blender 4.2+ on the PATH (or BLENDER=/path/to/blender). The hall's light is baked with
# Cycles, so each level takes about a minute.
#   sh scripts/export-models.sh            all three levels
#   sh scripts/export-models.sh medium     only one
#   --save                                 also rewrite blender/castelo.blend (medium level)
set -e
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-blender}"
SAVE=""; LODS=""
for a in "$@"; do
  case "$a" in
    --save) SAVE=1 ;;
    low|medium|high) LODS="$LODS $a" ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
[ -n "$LODS" ] || LODS="low medium high"
TMP="$(mktemp -d)"
for LOD in $LODS; do
  {
    echo "LOD = '$LOD'"
    echo "OUT_MODELS = r'$PWD/web/src/models'"
    cat blender/common.py blender/exterior.py blender/interior.py blender/export_web.py
    if [ -n "$SAVE" ] && [ "$LOD" = "medium" ]; then echo "bpy.ops.wm.save_as_mainfile(filepath=r'$PWD/blender/castelo.blend')"; fi
  } > "$TMP/build.py"
  "$BLENDER" -b --factory-startup --python-exit-code 1 -P "$TMP/build.py" > "$TMP/log.txt" 2>&1 || { grep -E "Error|Traceback|File \"|could not" "$TMP/log.txt" >&2; echo "build failed ($LOD)" >&2; rm -rf "$TMP"; exit 1; }
  grep -E "^RESULT|hall exposure" "$TMP/log.txt" || true
done
rm -rf "$TMP"
ls -l web/src/models/
