# Web export: bakes colour + soft occlusion into vertex colours, merges the static scenery
# into a handful of meshes and writes garden.glb / hall.glb. Run after common.py with both
# scenes built (OUT_MODELS is injected by the runner).
import numpy as np
from mathutils.bvhtree import BVHTree

ext = bpy.data.scenes["Exterior"]
itr = bpy.data.scenes["Interior"]
for _s in (ext, itr):                 # object transforms must be evaluated before matrix_world is read
    for _vl in _s.view_layers:
        _vl.update()

# ---------------------------------------------------------------- occlusion
def _hemi(n, seed=3):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        u, v = (i + rnd.random()) / n, rnd.random()
        r, th = math.sqrt(u), 2 * math.pi * v
        out.append((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u))))
    return out


# What each level of detail keeps. "medium" is the reference; "low" is for old phones (fewer flowers
# and far trees, simpler crowns, coarser baked shade), "high" bakes finer shade into more vertices.
Q = {"low": dict(rays=12, wall_edge=1.4, flowers=0.5, far=0.55, crowns=0.5, hall_cell=0.62),
     "medium": dict(rays=22, wall_edge=0.75, flowers=1.0, far=1.0, crowns=1.0, hall_cell=0.36),
     "high": dict(rays=44, wall_edge=0.42, flowers=1.0, far=1.0, crowns=1.0, hall_cell=0.22)}[LOD]
SUFFIX = {"low": "-low", "medium": "", "high": "-high"}[LOD]
DIRS = _hemi(Q["rays"])
SHADOW_TINT = Vector((0.66, 0.50, 0.53))      # rosy, so shade never goes grey


def occlusion(bvh, p, n, dist):
    a = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
    t = n.cross(a).normalized()
    b = n.cross(t)
    o = p + n * 0.035
    occ = 0.0
    for dx, dy, dz in DIRS:
        hit = bvh.ray_cast(o, t * dx + b * dy + n * dz, dist)
        if hit[0] is not None:
            occ += 1.0 - hit[3] / dist
    return occ / len(DIRS)


def world_bvh(objs, ground_z=None):
    verts, polys = [], []
    for ob in objs:
        me, mw, base = ob.data, ob.matrix_world, len(verts)
        verts.extend(mw @ v.co for v in me.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in me.polygons)
    if ground_z is not None:
        base = len(verts)
        verts.extend(Vector(c) for c in ((-50, -50, ground_z), (50, -50, ground_z), (50, 50, ground_z), (-50, 50, ground_z)))
        polys.append((base, base + 1, base + 2, base + 3))
    return BVHTree.FromPolygons(verts, polys)


def loop_colors(ob, bvh, dist, strength=0.8, local=False):
    """Per-corner linear RGBA: material colour x tinted occlusion. Emissive faces stay pure."""
    me = ob.data
    mw = Matrix() if local else ob.matrix_world
    n3 = mw.to_3x3().inverted().transposed()
    cn = me.corner_normals
    mats = [(Vector(m.diffuse_color[:3]), m.name.endswith("_e")) for m in me.materials]
    cols = [None] * len(me.loops)
    cache = {}
    for p in me.polygons:
        base, emis = mats[p.material_index]
        for li in p.loop_indices:
            if emis or bvh is None:
                cols[li] = (base.x, base.y, base.z, 1.0)
                continue
            vi = me.loops[li].vertex_index
            n = (n3 @ cn[li].vector).normalized()
            key = (vi, round(n.x, 2), round(n.y, 2), round(n.z, 2))
            occ = cache.get(key)
            if occ is None:
                occ = occlusion(bvh, mw @ me.vertices[vi].co, n, dist)
                cache[key] = occ
            k = min(1.0, occ * strength * 1.6)
            sh = SHADOW_TINT.lerp(Vector((1, 1, 1)), 1 - k)
            cols[li] = (base.x * sh.x, base.y * sh.y, base.z * sh.z, 1.0)
    return cols


# ---------------------------------------------------------------- night light
LAMP_POS = [Vector(p) for p in LAMPS]
LAMP_R = 12.0


def lamp_light(ob):
    """Per-corner light received from the lanterns (0 .. about 2), or None when none is near.
    It rides in a second UV layer; the web shader adds it, warm, as night falls."""
    me, mw = ob.data, ob.matrix_world
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    c = mw @ Vector(((co.min(0) + co.max(0)) / 2).tolist())
    rad = float(np.linalg.norm(co.max(0) - co.min(0))) / 2 * max(mw.to_scale())
    near = [L for L in LAMP_POS if (L - c).length < LAMP_R + rad]
    if not near:
        return None
    n3 = mw.to_3x3().inverted().transposed()
    cn = me.corner_normals
    out = [0.0] * len(me.loops)
    cache = {}
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        n = (n3 @ cn[li].vector).normalized()
        key = (vi, round(n.x, 1), round(n.y, 1), round(n.z, 1))
        v = cache.get(key)
        if v is None:
            p = mw @ me.vertices[vi].co
            v = 0.0
            for L in near:
                d = L - p
                dist = d.length
                if dist >= LAMP_R:
                    continue
                facing = max(0.0, n.dot(d) / dist) if dist > 1e-4 else 1.0
                v += 2.3 * (0.35 + 0.65 * facing) / (1.0 + (dist / 2.3) ** 2) * smoothstep(LAMP_R, LAMP_R * 0.5, dist)
            cache[key] = v
        out[li] = v
    return out


def kept(i, frac):
    """Deterministic thinning: keeps about `frac` of a numbered series, evenly spread."""
    return frac >= 1.0 or (i * 0.6180339887) % 1.0 < frac


def simplified(ob, ratio):
    """Temporary copy with fewer facets (the low level of detail)."""
    tmp = bpy.data.objects.new(ob.name + "_lo", ob.data)
    ext.collection.objects.link(tmp)
    tmp.matrix_world = ob.matrix_world.copy()
    mod = tmp.modifiers.new("lo", "DECIMATE")
    mod.ratio = ratio
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp, do_unlink=True)
    out = bpy.data.objects.new(ob.name + "_lo", me)
    out.matrix_world = ob.matrix_world.copy()
    return out


# ---------------------------------------------------------------- export materials
def web_mat(name, emissive):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    if emissive:
        nt.links.new(vc.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.0
    return m


VC, GLOW = web_mat("VC", False), web_mat("GLOW", True)


def fresh_collection(name):
    c = bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            d = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0 and isinstance(d, bpy.types.Mesh):
                bpy.data.meshes.remove(d)
        bpy.data.collections.remove(c)
    c = bpy.data.collections.new(name)
    ext.collection.children.link(c)
    return c


class Group:
    """Accumulates source objects into one export mesh (two slots: VC, GLOW)."""

    def __init__(self, name, origin=(0, 0, 0), lamps=False):
        self.name, self.origin = name, Vector(origin)
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.lamp = self.bm.loops.layers.uv.new("Lamp") if lamps else None
        self.gone = []          # faces to leave out (never seen), removed in one go when the mesh is built

    def add(self, ob, cols, uvfun=None):
        me, bm = ob.data, self.bm
        nv, nf = len(bm.verts), len(bm.faces)
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        M = Matrix.Translation(-self.origin) @ ob.matrix_world
        for v in bm.verts[nv:]:
            v.co = M @ v.co
        emis = [m.name.endswith("_e") for m in me.materials]
        col, uv = self.bm.loops.layers.float_color["Col"], self.bm.loops.layers.uv["UVMap"]
        for f, p in zip(bm.faces[nf:], me.polygons):
            f.material_index = 1 if emis[p.material_index] else 0
            for l, li in zip(f.loops, p.loop_indices):
                l[col] = cols[li]
                if uvfun:
                    l[uv].uv = uvfun(me.vertices[me.loops[li].vertex_index].co)
        if self.lamp is not None:
            lit = lamp_light(ob)
            if lit:
                lamp = self.bm.loops.layers.uv["Lamp"]
                for f, p in zip(bm.faces[nf:], me.polygons):
                    for l, li in zip(f.loops, p.loop_indices):
                        l[lamp].uv = (lit[li], 0.0)

    def build(self, coll, parent=None, rot=None, scale=None, loc=None):
        # Flat facets that lie in one plane share their vertices (a wall cut into many triangles is
        # still one wall): every other edge of a flat facet stays crisp.
        bm = self.bm
        if self.gone:
            bmesh.ops.delete(bm, geom=self.gone, context="FACES")
        bm.normal_update()
        for e in bm.edges:
            fs = e.link_faces
            if len(fs) == 2 and not (fs[0].smooth and fs[1].smooth) and fs[0].normal.angle(fs[1].normal, 0.0) > 0.02:
                e.smooth = False
        for f in bm.faces:
            f.smooth = True
        me = bpy.data.meshes.new("W_" + self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        me.materials.append(VC); me.materials.append(GLOW)
        ca = me.color_attributes.get("Col")
        if ca:
            me.color_attributes.active_color = ca
            try:
                me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
            except Exception:
                pass
        ob = bpy.data.objects.new("W_" + self.name, me)
        ob.location = loc if loc is not None else self.origin
        if rot is not None:
            ob.rotation_euler = rot
        if scale is not None:
            ob.scale = scale
        coll.objects.link(ob)
        if parent is not None:
            ob.parent = parent
        return ob


def refined(ob, maxlen):
    """Temporary copy with long edges bisected, so vertex occlusion stays local on big flat walls."""
    bm_ = bmesh.new()
    bm_.from_mesh(ob.data)
    for _ in range(5):
        long_ = [e for e in bm_.edges if e.calc_length() > maxlen]
        if not long_:
            break
        bmesh.ops.subdivide_edges(bm_, edges=long_, cuts=1)
        bmesh.ops.triangulate(bm_, faces=[f for f in bm_.faces if len(f.verts) > 3])
    me = bpy.data.meshes.new(ob.data.name + "_fine")
    bm_.to_mesh(me)
    bm_.free()
    for m in ob.data.materials:
        me.materials.append(m)
    tmp = bpy.data.objects.new(ob.name + "_fine", me)
    tmp.matrix_world = ob.matrix_world.copy()
    return tmp


def plain(ob):
    return loop_colors(ob, None, 0)


def export(coll, path):
    kw = dict(filepath=path, export_format="GLB", collection=coll.name, export_yup=True, export_apply=False,
              export_texcoords=True, export_normals=True, export_materials="EXPORT", export_cameras=False,
              export_lights=False, export_animations=False, export_extras=True,
              export_meshopt_compression_enable=True)
    for vc in ({"export_vertex_color": "NAME", "export_vertex_color_name": "Col"}, {"export_vertex_color": "ACTIVE"}, {}):
        try:
            bpy.ops.export_scene.gltf(**kw, **vc)
            return vc
        except TypeError:
            continue


# ================================================================ garden
G = fresh_collection("WEB_garden")
O = bpy.data.objects
static_occluders = [O[n] for n in ("Terrain", "Path", "Castle", "Gate_L", "Gate_R")]      # not the lamp posts: too thin to shade a wall
trees = [o for o in ext.objects if o.type == "MESH" and o.name.startswith(("BlossomTree_", "Bush_", "GBush_", "Cypress_", "FarTreeA_"))]
if Q["far"] < 1.0:        # fewer of the trees that only ever show small, far from the walk
    _far = [t for t in trees if t.name.startswith(("Cypress_", "FarTreeA_")) and (abs(t.location.x) > 34 or t.location.y > 14 or t.location.y < -70)]
    _drop = {t.name for i, t in enumerate(_far) if not kept(i, Q["far"])}
    trees = [t for t in trees if t.name not in _drop]
if Q["crowns"] < 1.0:
    trees = [simplified(t, Q["crowns"]) if t.name.startswith(("BlossomTree_", "Bush_", "GBush_")) else t for t in trees]
bvh = world_bvh(static_occluders + trees)

g = Group("Ground", lamps=True)
for n in ("Terrain", "Path"):
    g.add(O[n], loop_colors(O[n], bvh, 2.6, 0.75))
g.build(G)
print("ground done", flush=True)

g = Group("Castle", lamps=True)
fine = refined(O["Castle"], Q["wall_edge"])
g.add(fine, loop_colors(fine, bvh, 1.3, 0.62))
castle_w = g.build(G)

g = Group("CastleTrim", lamps=True)          # windows: flat colour, no baked shade around them
g.add(O["CastleTrim"], plain(O["CastleTrim"]))
g.build(G)

g = Group("Lamps", lamps=True)
g.add(O["Lamps"], loop_colors(O["Lamps"], world_bvh([O["Lamps"]]), 0.8, 0.5))
_lw = g.build(G)
_lw["lamps"] = [c for p in LAMPS for c in p]      # lantern centres (Blender x, y, z ...), read by world.js

for n in ("Gate_L", "Gate_R"):
    g = Group(n, origin=O[n].matrix_world.translation, lamps=True)
    g.add(O[n], loop_colors(O[n], bvh, 1.2, 0.5))
    g.build(G)

g = Group("Trees", lamps=True)
shared_cols = {}
for t in trees:
    if t.name.startswith(("Cypress_", "FarTreeA_")):
        if t.data.name not in shared_cols:   # instances of one mesh: self-occlusion only, baked once
            shared_cols[t.data.name] = loop_colors(t, world_bvh([t], ground_z=t.matrix_world.translation.z), 1.5, 0.7)
        g.add(t, shared_cols[t.data.name])
    else:
        g.add(t, loop_colors(t, bvh, 2.2, 0.8))
g.build(G)
print("trees done", flush=True)

# flowers: instanced templates -> one mesh. UV carries (height above the root, random phase) for the sway.
g = Group("Flowers", lamps=True)
tmpl_cols = {}
for _i, f in enumerate([o for o in ext.objects if o.type == "MESH" and o.name.startswith(("Fg_", "Mid_", "Castle_", "Ext_"))]):
    if not kept(_i, Q["flowers"]):
        continue
    me = f.data
    if me.name not in tmpl_cols:
        bm_ = bmesh.new(); bm_.from_mesh(me)
        bm_.faces.new([bm_.verts.new(c) for c in ((-9, -9, 0), (9, -9, 0), (9, 9, 0), (-9, 9, 0))])
        local_bvh = BVHTree.FromBMesh(bm_); bm_.free()
        tmpl_cols[me.name] = loop_colors(f, local_bvh, 0.45, 0.55, local=True)
    s, ph = f.scale.z, random.random()
    g.add(f, tmpl_cols[me.name], uvfun=lambda co, s=s, ph=ph: (max(0.0, co.z) * s, ph))
g.build(G)

print("flowers done", flush=True)
for c in [o for o in ext.objects if o.name.startswith("Cloud_")]:
    g = Group(c.name, origin=c.matrix_world.translation)
    c2 = simplified(c, Q["crowns"]) if Q["crowns"] < 1.0 else c
    g.add(c2, loop_colors(c2, world_bvh([c2]), 1.4, 0.45))
    g.build(G)

# moving parts keep their own nodes
fl = Group("Flag")
fl.add(O["Flag_0"], plain(O["Flag_0"]), uvfun=lambda co: (co.x, 0.0))
flag_me = None
for f in [o for o in ext.objects if o.name.startswith("Flag_")]:
    if flag_me is None:
        src = O["Flag_0"]
        keep = (src.location.copy(), src.scale.copy())
        src.location, src.scale = (0, 0, 0), (1, 1, 1)
        bpy.context.view_layer.update()
        fl2 = Group("Flag")
        fl2.add(src, plain(src), uvfun=lambda co: (co.x, 0.0))
        tmp = fl2.build(G)
        flag_me = tmp.data
        bpy.data.objects.remove(tmp, do_unlink=True)
        src.location, src.scale = keep
        bpy.context.view_layer.update()
    ob = bpy.data.objects.new("W_" + f.name, flag_me)
    ob.location, ob.scale = f.location, f.scale
    G.objects.link(ob)
fl.bm.free()

parts = {}
for i in range(64):
    e = O.get("Butterfly_%d" % i)
    if e is None:
        break
    root = bpy.data.objects.new("W_Butterfly_%d" % i, None)
    root.location, root.rotation_euler, root.scale = e.location, e.rotation_euler, e.scale
    root["fly"] = list(e["fly"])          # loop width, depth, height, speed, phase (read by world.js)
    G.objects.link(root)
    for part in ("Body", "WingL", "WingR"):
        src = O["Butterfly_%d_%s" % (i, part)]
        if part not in parts:
            keep = src.parent, src.rotation_euler.copy()
            src.parent, src.rotation_euler = None, (0, 0, 0)
            bpy.context.view_layer.update()
            gp = Group("Bfly" + part)
            gp.add(src, plain(src))
            tmp = gp.build(G)
            parts[part] = tmp.data
            bpy.data.objects.remove(tmp, do_unlink=True)
            src.parent, src.rotation_euler = keep
            bpy.context.view_layer.update()
        ob = bpy.data.objects.new("W_Butterfly_%d_%s" % (i, part), parts[part])
        ob.parent = root
        ob.rotation_euler = src.rotation_euler
        G.objects.link(ob)

print("exporting garden", flush=True)
mode_g = export(G, OUT_MODELS + "/garden%s.glb" % SUFFIX)
print("garden exported", mode_g, flush=True)

# ================================================================ hall
# The hall's light is baked: Cycles renders the scene's real lamps (ceiling spots, wall washers,
# glowing windows, bounced light) into every vertex, and the site draws it unlit.
Hc = fresh_collection("WEB_hall")
HS = {o.name: o for o in itr.objects if o.type == "MESH"}


def dice(ob, cell, axes=(0, 1, 2), lo=(-16.0, -14.0, 0.0), hi=(16.0, 7.0, 13.0)):
    """Cuts the mesh along a regular grid (inside the part of the hall the camera sees), so the
    baked light is sampled evenly: no long thin triangles smearing a shadow across a wall."""
    bm_ = bmesh.new()
    bm_.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm_, verts=bm_.verts[:], dist=1e-5)      # neighbouring pieces share their vertices
    for axis in axes:
        a0 = max(lo[axis], min(v.co[axis] for v in bm_.verts))
        a1 = min(hi[axis], max(v.co[axis] for v in bm_.verts))
        n = Vector([1.0 if k == axis else 0.0 for k in range(3)])
        k = math.floor(a0 / cell) + 1
        while k * cell < a1 - 1e-4:
            bmesh.ops.bisect_plane(bm_, geom=bm_.verts[:] + bm_.edges[:] + bm_.faces[:], plane_co=n * (k * cell), plane_no=n, dist=1e-4)
            k += 1
    bmesh.ops.triangulate(bm_, faces=[f for f in bm_.faces if len(f.verts) > 3])
    bm_.to_mesh(ob.data)
    bm_.free()


def cycles_device(scene):
    scene.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            (getattr(prefs, "refresh_devices", None) or prefs.get_devices)()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                return kind
    except Exception as e:
        print("cycles device:", e)
    return "CPU"


cell = Q["hall_cell"]
for name, size, axes in (("Shell", 1.6, (0, 2)), ("Alcove", cell * 1.15, (0, 1, 2)), ("Rug", cell, (0, 1)), ("CastleBackdrop", cell * 1.1, (0, 2)),
                         ("PartyTable", cell * 1.25, (0, 1, 2)), ("Floor", 99.0, ())):
    dice(HS[name], size, axes)

itr.render.engine = "CYCLES"
print("hall bake on", cycles_device(itr), flush=True)
itr.cycles.samples = {"low": 128, "medium": 256, "high": 384}[LOD]
itr.cycles.use_adaptive_sampling = False
itr.cycles.max_bounces = 6
itr.cycles.diffuse_bounces = 4
itr.cycles.sample_clamp_indirect = 6.0
itr.render.bake.target = "VERTEX_COLORS"
itr.render.bake.use_pass_direct = itr.render.bake.use_pass_indirect = itr.render.bake.use_pass_color = True
if bpy.context.window is not None:
    bpy.context.window.scene = itr
_vl = itr.view_layers[0]
_vl.update()
BAKED = {}
for name, ob in HS.items():
    me = ob.data
    ca = me.color_attributes.new("Bake", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = ca
    for o in itr.objects:
        o.select_set(False, view_layer=_vl)
    ob.select_set(True, view_layer=_vl)
    _vl.objects.active = ob
    with bpy.context.temp_override(scene=itr, view_layer=_vl, active_object=ob, object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.bake(type="DIFFUSE")
    buf = np.empty(len(me.loops) * 4, dtype=np.float32)
    me.color_attributes["Bake"].data.foreach_get("color", buf)
    BAKED[name] = buf.reshape(-1, 4)[:, :3].astype(np.float64)
    me.color_attributes.remove(me.color_attributes["Bake"])      # only the processed colours are exported
    print("baked", name, len(me.loops), flush=True)

# Exposure: the white proscenium, lit by the room, comes out as its own paint colour.
_sh = HS["Shell"].data
_front = [li for p in _sh.polygons if p.normal.y < -0.9 and abs(p.center.x) < 13.5 and p.center.z < 12.5 for li in p.loop_indices]
_alb = np.array(_sh.materials[0].diffuse_color[:3])
EXPO = float(0.95 * np.mean(_alb) / max(1e-6, np.mean(BAKED["Shell"][_front])))
print("hall exposure", round(EXPO, 3), {k: [round(float(q) * EXPO, 2) for q in np.percentile(v.max(axis=1), (10, 50, 90, 99))] for k, v in BAKED.items()}, flush=True)


def hall_colors(name):
    """Baked light per corner; lamps and glowing panes keep their own colour. Bright spots roll off softly."""
    me = HS[name].data
    c = BAKED[name] * EXPO
    # A corner buried inside another piece (a wall behind its trim, a rug under a pedestal) bakes pure
    # black; left alone it would smear a dark spike across the visible part of its facet. Such corners
    # take the light of the facet's other corners instead.
    dark = c.max(axis=1) < 0.05
    for p in me.polygons:
        lis = list(p.loop_indices)
        d = dark[lis]
        if d.any() and not d.all():
            c[[li for li, k in zip(lis, d) if k]] = c[[li for li, k in zip(lis, d) if not k]].mean(axis=0)
    dark = c.max(axis=1) < 0.05
    # A facet with every corner buried may still poke out (flowers packed into a bouquet): it takes the
    # light of the facets it touches, or failing that the average of its own material.
    if dark.any():
        at_vertex = {}
        for li, loop in enumerate(me.loops):
            if not dark[li]:
                at_vertex.setdefault(loop.vertex_index, []).append(li)
        by_mat = {}
        for p in me.polygons:
            lit_ = [li for li in p.loop_indices if not dark[li]]
            if lit_:
                by_mat.setdefault(p.material_index, []).extend(lit_)
        mat_mean = {k: c[v].mean(axis=0) for k, v in by_mat.items()}
        fixed = []
        for p in me.polygons:
            lis = list(p.loop_indices)
            if not dark[lis].all():
                continue
            near = [li for l in lis for li in at_vertex.get(me.loops[l].vertex_index, ())]
            if near:
                fixed.append((lis, c[near].mean(axis=0)))
            elif p.material_index in mat_mean:
                fixed.append((lis, mat_mean[p.material_index] * 0.8))
        for lis, v in fixed:
            c[lis] = v
        dark = c.max(axis=1) < 0.05
    # corners that share a vertex and a facing share one value: smoother, and far fewer vertices to send
    cn = me.corner_normals
    groups = {}
    for li, loop in enumerate(me.loops):
        n = cn[li].vector
        groups.setdefault((loop.vertex_index, round(n.x, 1), round(n.y, 1), round(n.z, 1)), []).append(li)
    for lis in groups.values():
        if len(lis) > 1:
            seen = [li for li in lis if not dark[li]]
            c[lis] = c[seen or lis].mean(axis=0)
    knee = 0.82
    hot = c > knee
    c[hot] = knee + (1.0 - knee) * np.tanh((c[hot] - knee) / (1.0 - knee))
    cols = [(float(r), float(g_), float(b_), 1.0) for r, g_, b_ in c]
    for p in me.polygons:
        m = me.materials[p.material_index]
        if m.name.endswith("_e"):
            for li in p.loop_indices:
                cols[li] = (*m.diffuse_color[:3], 1.0)
    return cols


EYES = [Vector((x, y, z)) for x in (-5.0, 0.0, 5.0) for y in (-25.0, -15.0) for z in (1.2, 7.5)]     # everywhere the camera may be


def add_visible(g, ob, cols):
    """Adds ob to the group, without the faces that always face away from the camera."""
    nf = len(g.bm.faces)
    g.add(ob, cols)
    g.bm.faces.ensure_lookup_table()
    for f in g.bm.faces[nf:]:
        f.normal_update()
        c = f.calc_center_median() + g.origin
        if all(f.normal.dot(e - c) <= 0 for e in EYES):
            g.gone.append(f)


for out_name, srcs in (("Room", ("Shell", "Alcove", "Rug")), ("Floor", ("Floor",)), ("Backdrop", ("CastleBackdrop",)),
                       ("Table", ("PartyTable",)), ("HallFlowers", ("Flowers",)), ("Balloons_L", ("Balloons_L",)), ("Balloons_R", ("Balloons_R",))):
    g = Group(out_name)
    for s in srcs:
        if s == "Flowers":                     # leaves are drawn two-sided: keep them all
            g.add(HS[s], hall_colors(s))
        else:
            add_visible(g, HS[s], hall_colors(s))
    g.build(Hc)
if bpy.context.window is not None:
    bpy.context.window.scene = ext           # the export collections hang under the exterior scene
mode_h = export(Hc, OUT_MODELS + "/hall%s.glb" % SUFFIX)

if globals().get("PREVIEW"):                 # a quick look at the hall's light (not part of the build)
    itr.cycles.samples = 48
    itr.cycles.use_denoising = True
    itr.render.resolution_x, itr.render.resolution_y, itr.render.resolution_percentage = 960, 640, 100
    itr.render.filepath = PREVIEW
    itr.view_settings.exposure = math.log2(EXPO)
    bpy.ops.render.render(write_still=True, scene=itr.name)

print("RESULT", LOD, [o.name for o in G.objects if not o.name.startswith(("W_Flag", "W_Butterfly"))], [o.name for o in Hc.objects], mode_g, mode_h, flush=True)
result = {"garden": [o.name for o in G.objects][:40], "hall": [o.name for o in Hc.objects], "vc_mode": [str(mode_g), str(mode_h)],
          "tris": sum(len(o.data.polygons) for o in list(G.objects) + list(Hc.objects) if o.type == "MESH")}
