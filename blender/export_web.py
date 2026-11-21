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


DIRS = _hemi(22)
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

    def __init__(self, name, origin=(0, 0, 0)):
        self.name, self.origin = name, Vector(origin)
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.uv = self.bm.loops.layers.uv.new("UVMap")

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

    def build(self, coll, parent=None, rot=None, scale=None, loc=None):
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
static_occluders = [O[n] for n in ("Terrain", "Path", "Castle", "Gate_L", "Gate_R")]
trees = [o for o in ext.objects if o.type == "MESH" and o.name.startswith(("BlossomTree_", "Bush_", "GBush_", "Cypress_", "FarTreeA_"))]
bvh = world_bvh(static_occluders + trees)

g = Group("Ground")
for n in ("Terrain", "Path"):
    g.add(O[n], loop_colors(O[n], bvh, 2.6, 0.75))
g.build(G)
print("ground done", flush=True)

g = Group("Castle")
fine = refined(O["Castle"], 0.75)
g.add(fine, loop_colors(fine, bvh, 1.3, 0.62))
castle_w = g.build(G)

for n in ("Gate_L", "Gate_R"):
    g = Group(n, origin=O[n].matrix_world.translation)
    g.add(O[n], loop_colors(O[n], bvh, 1.2, 0.5))
    g.build(G)

g = Group("Trees")
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
g = Group("Flowers")
tmpl_cols = {}
for f in [o for o in ext.objects if o.type == "MESH" and o.name.startswith(("Fg_", "Mid_", "Castle_", "Ext_"))]:
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
    g.add(c, loop_colors(c, world_bvh([c]), 1.4, 0.45))
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
mode_g = export(G, OUT_MODELS + "/garden.glb")
print("garden exported", mode_g, flush=True)

# ================================================================ hall
Hc = fresh_collection("WEB_hall")
hall_objs = [o for o in itr.objects if o.type == "MESH"]
hbvh = world_bvh(hall_objs)
for src_name, out_name, dist, k in (("Room", "Room", 3.0, 0.7), ("CastleBackdrop", "Backdrop", 1.6, 0.75),
                                    ("PartyTable", "Table", 1.6, 0.8), ("Flowers", "HallFlowers", 1.0, 0.75),
                                    ("Balloons_L", "Balloons_L", 1.2, 0.7), ("Balloons_R", "Balloons_R", 1.2, 0.7)):
    src = O[src_name] if src_name != "Flowers" else next(o for o in hall_objs if o.name.startswith("Flowers"))
    if src_name in ("Room", "CastleBackdrop"):
        src = refined(src, 1.6 if src_name == "Room" else 0.8)
    g = Group(out_name)
    g.add(src, loop_colors(src, hbvh, dist, k))
    g.build(Hc)
mode_h = export(Hc, OUT_MODELS + "/hall.glb")

print("RESULT", [o.name for o in G.objects if not o.name.startswith(("W_Flag", "W_Butterfly"))], [o.name for o in Hc.objects], mode_g, mode_h, flush=True)
result = {"garden": [o.name for o in G.objects][:40], "hall": [o.name for o in Hc.objects], "vc_mode": [str(mode_g), str(mode_h)],
          "tris": sum(len(o.data.polygons) for o in list(G.objects) + list(Hc.objects) if o.type == "MESH")}
