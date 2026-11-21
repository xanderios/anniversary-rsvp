# Storyboard keyframes along the scroll journey. Run after common.py (scenes must exist).
# OUT is injected by the runner.
ext = bpy.data.scenes["Exterior"]
gl, gr = bpy.data.objects["Gate_L"], bpy.data.objects["Gate_R"]

# (name, camera position, look-at target, focal length mm, gate opening in degrees)
SHOTS = [
    ("01_longe",   (0.3, -72.8, 28.2), (0.3, -1.5, 5.0), 76, 0),
    ("02_descida", (-0.4, -40.0, 11.0), (0.5, 0.0, 4.9), 52, 0),
    ("03_jardim",  (-1.3, -16.5, 2.5), (0.6, 0.0, 4.3), 30, 0),
    ("04_portoes", (0.2, -7.0, 1.7), (0.6, 0.5, 2.7), 26, 50),
    ("05_entrada", (0.6, -4.3, 1.5), (0.6, 2.0, 1.75), 24, 105),
]
ONLY = globals().get("ONLY")
for name, loc, tgt, lens, gate in SHOTS:
    if ONLY and name not in ONLY:
        continue
    gl.rotation_euler = (0, 0, math.radians(gate))
    gr.rotation_euler = (0, 0, -math.radians(gate))
    set_cam(ext, loc, tgt, lens)
    ext.render.filepath = OUT + "/" + name + ".png"
    bpy.ops.render.render(write_still=True, scene="Exterior")
gl.rotation_euler = (0, 0, 0); gr.rotation_euler = (0, 0, 0)
set_cam(ext, SHOTS[0][1], SHOTS[0][2], SHOTS[0][3])
if not ONLY or "06_salao" in ONLY:
    it = bpy.data.scenes["Interior"]
    it.render.filepath = OUT + "/06_salao.png"
    bpy.ops.render.render(write_still=True, scene="Interior")
result = {"rendered": True}
