# Shared low-poly helpers for the "Castelo da Maria Alice" scenes.
# Executed inside Blender (concatenated before exterior.py / interior.py).
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler

# Level of detail of the web export: low | medium | high (the runner injects LOD before this file).
LOD = globals().get("LOD", "medium")

# ---------------------------------------------------------------- palette
# Sampled from the reference illustration (Image 1) – sRGB hex.
PAL = {
    # castle
    "wall": "#FBF6F4", "wall_light": "#FFFDFB", "wall_dark": "#F3DCDB",      # near white: the site's warm light turns it rosy
    "roof": "#EE9197", "roof_dark": "#DC747C", "flag": "#F29AA4",
    "gold": "#E2AA43", "glow": "#FFD47E", "glow_soft": "#FFE6B8",
    "wood": "#DDA468", "wood_dark": "#C88E55",
    "post": "#B98450", "post_dark": "#93643A", "lamp": "#FFE9AE",
    # ground
    "grass": "#C9D390", "grass2": "#C1CD88", "grass_side": "#A9B973",
    "path": "#F1D2C7", "tile1": "#F9E4DA", "tile2": "#F6DCD1", "tile3": "#FBEAE2",
    "base": "#C98C68", "base_lip": "#E2AC8B",
    # vegetation
    "trunk": "#BA7A42", "trunk_dark": "#A46A33",
    "bloss1": "#FBD3DC", "bloss2": "#F9C4D1", "bloss3": "#FDE0E6",
    "cyp1": "#BCCD9A", "cyp2": "#B0C48E",
    "leaf": "#ABBF74", "leaf2": "#9DB56B", "stem": "#9FB56C",
    "petal_pink": "#F9C0CF", "petal_rose": "#F7AEC2", "petal_light": "#FCDAE2",
    "petal_white": "#FFF7F1", "center": "#F4C452",
    "tulip": "#F8B0C1", "tulip2": "#FBC8D3",
    "bush1": "#A9C27C", "bush2": "#9AB56E", "bush3": "#B9CF8E", "berry": "#E8848E",
    # sky
    "cloud": "#FFF3F1", "cloud2": "#FDE8EA", "spark": "#FFF6DC",
    "bfly": "#F7A6B9", "bfly_in": "#FCD3DB", "bfly_body": "#D98898",
    # interior
    "in_wall": "#FCEDE3", "in_floor": "#F4E5DA", "in_rug": "#F9D6D7",
    "balloon1": "#F6B8C2", "balloon2": "#FBE9E0", "balloon3": "#F9D0D4", "balloon4": "#F7C2CB",
    "cake": "#FFF6EF", "ped_pink": "#F5C4C4", "ped_white": "#FFF8F3",
    "rose1": "#F8C6D0", "rose2": "#FFF4EA", "rose3": "#FBDADD", "green_in": "#A9BB86",
}


def hex2lin(h):
    h = h.lstrip("#")
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


_MATS = {}


def get_mat(key, emit=0.0):
    name = key if emit == 0 else "%s_e" % key
    m = bpy.data.materials.get(name)
    if m is not None and name in _MATS:
        return m
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    col = hex2lin(PAL[key])
    b.inputs["Base Color"].default_value = col
    b.inputs["Roughness"].default_value = 1.0
    for k in ("Specular IOR Level", "Specular"):
        if k in b.inputs:
            b.inputs[k].default_value = 0.0
    if emit > 0:
        b.inputs["Emission Color"].default_value = col
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = col
    _MATS[name] = m
    return m


EMIT = {"glow": 1.25, "glow_soft": 1.9, "spark": 1.6, "lamp": 1.6}


def M_(key):
    return get_mat(key, EMIT.get(key, 0.0))


# ---------------------------------------------------------------- scene utils
def reset_data():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for b in list(blk):
            blk.remove(b)
    _MATS.clear()


def coll(name, scene=None):
    scene = scene or bpy.context.scene
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def rot_z(a):
    return Matrix.Rotation(a, 4, "Z")


def rot_x(a):
    return Matrix.Rotation(a, 4, "X")


def rot_y(a):
    return Matrix.Rotation(a, 4, "Y")


def tr(x, y, z):
    return Matrix.Translation((x, y, z))


def arch_pts(a, hr, n=6, z0=0.0):
    """Arch-topped outline (CCW seen from the front): half width a, straight part hr."""
    pts = [(a, z0), (a, hr)]
    pts += [(a * math.cos(math.pi * i / n), hr + a * math.sin(math.pi * i / n)) for i in range(1, n)]
    pts += [(-a, hr), (-a, z0)]
    return pts


class MB:
    """Mesh builder: accumulates low-poly primitives into one flat-shaded mesh."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, key):
        m = M_(key)
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _finish(self, verts, faces, key, M, smooth=False):
        if M is not None:
            bmesh.ops.transform(self.bm, matrix=M, verts=verts)
        idx = self._mi(key)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth

    def box(self, size, loc, key, rot=None, M=None):
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = r["verts"]
        faces = list({f for v in verts for f in v.link_faces})
        T = Matrix.Translation(loc)
        R = rot.to_matrix().to_4x4() if rot is not None else Matrix()
        S = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        MM = T @ R @ S
        if M is not None:
            MM = M @ MM
        self._finish(verts, faces, key, MM)

    def ico(self, r, loc, key, sub=1, scale=(1, 1, 1), M=None, rot=None, jitter=0.0, smooth=False, key2=None, p2=0.0):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r)
        verts = res["verts"]
        if jitter:
            for v in verts:
                v.co += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * jitter * r
        faces = list({f for v in verts for f in v.link_faces})
        MM = Matrix.Translation(loc)
        if rot is not None:
            MM = MM @ rot.to_matrix().to_4x4()
        MM = MM @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        if M is not None:
            MM = M @ MM
        self._finish(verts, faces, key, MM, smooth)
        if key2:
            i2 = self._mi(key2)
            for f in faces:
                if random.random() < p2:
                    f.material_index = i2

    def lathe(self, prof, seg, key, M=None, phase=0.0, key2=None, p2=0.0, smooth=False):
        """Revolve profile [(z, r), ...] around Z. key2/p2: random second colour per face."""
        bm = self.bm
        rings, new = [], []
        for z, r in prof:
            if r <= 1e-6:
                v = bm.verts.new((0, 0, z))
                rings.append([v]); new.append(v)
            else:
                ring = [bm.verts.new((r * math.cos(phase + 2 * math.pi * k / seg),
                                      r * math.sin(phase + 2 * math.pi * k / seg), z)) for k in range(seg)]
                rings.append(ring); new += ring
        faces = []
        for a, b in zip(rings, rings[1:]):
            if len(a) == 1 and len(b) == 1:
                continue
            for k in range(seg):
                k2 = (k + 1) % seg
                if len(a) == 1:
                    faces.append(bm.faces.new((a[0], b[k2], b[k])))
                elif len(b) == 1:
                    faces.append(bm.faces.new((a[k], a[k2], b[0])))
                else:
                    faces.append(bm.faces.new((a[k], a[k2], b[k2], b[k])))
        if len(rings[0]) > 1:
            faces.append(bm.faces.new(list(reversed(rings[0]))))
        if len(rings[-1]) > 1:
            faces.append(bm.faces.new(rings[-1]))
        self._finish(new, faces, key, M, smooth)
        if key2:
            i2 = self._mi(key2)
            for f in faces:
                if random.random() < p2:
                    f.material_index = i2

    def poly(self, pts, key, M=None):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        self._finish(vs, [f], key, M)

    def prism(self, pts, depth, key, M=None):
        """Extrude an (x, z) outline (CCW from the front, facing -Y) by depth along +Y."""
        bm = self.bm
        fr = [bm.verts.new((x, 0, z)) for x, z in pts]
        bk = [bm.verts.new((x, depth, z)) for x, z in pts]
        faces = [bm.faces.new(fr), bm.faces.new(list(reversed(bk)))]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((fr[j], fr[i], bk[i], bk[j])))
        self._finish(fr + bk, faces, key, M)

    def build(self, loc=(0, 0, 0), coll=None, parent=None, rot=None, scale=None):
        bm = self.bm
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        any_smooth = any(f.smooth for f in bm.faces)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        if any_smooth:      # all-flat meshes stay faceted; mixed ones keep crisp creases
            try:
                me.set_sharp_from_angle(angle=math.radians(42))
            except Exception:
                pass
        ob = bpy.data.objects.new(self.name, me)
        ob.location = loc
        if rot is not None:
            ob.rotation_euler = rot
        if scale is not None:
            ob.scale = scale
        (coll or bpy.context.scene.collection).objects.link(ob)
        if parent is not None:
            ob.parent = parent
        return ob


def inst(template, loc, rz=0.0, s=1.0, coll=None, name=None, rot=None):
    ob = bpy.data.objects.new(name or template.name, template.data)
    ob.location = loc
    ob.rotation_euler = rot if rot is not None else (0, 0, rz)
    ob.scale = (s, s, s) if not isinstance(s, (tuple, list)) else s
    (coll or template.users_collection[0]).objects.link(ob)
    return ob


def interp(pts, t):
    """Smooth (cubic Hermite) interpolation through [(t, v), ...] sorted by t."""
    if t <= pts[0][0]:
        return pts[0][1]
    if t >= pts[-1][0]:
        return pts[-1][1]
    n = len(pts)
    for i in range(n - 1):
        if pts[i][0] <= t <= pts[i + 1][0]:
            break
    def slope(k):
        a, b = max(k - 1, 0), min(k + 1, n - 1)
        return (pts[b][1] - pts[a][1]) / (pts[b][0] - pts[a][0])
    t0, v0 = pts[i]; t1, v1 = pts[i + 1]
    h = t1 - t0; u = (t - t0) / h
    m0, m1 = slope(i) * h, slope(i + 1) * h
    return ((2 * u**3 - 3 * u**2 + 1) * v0 + (u**3 - 2 * u**2 + u) * m0
            + (-2 * u**3 + 3 * u**2) * v1 + (u**3 - u**2) * m1)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def window(mb, M, hw_, hrect, frame=True, key="glow"):
    """Arched glowing window. M: local x right, z up, front at y=0 facing -Y."""
    if frame:
        mb.prism(arch_pts(hw_ + 0.07, hrect + 0.02, 6, z0=-0.07), 0.04, "wall_light", M @ tr(0, -0.04, 0))
    mb.prism(arch_pts(hw_, hrect, 6), 0.03, key, M @ tr(0, -0.065, 0))


def setup_render(scene, w=1536, h=1024, pct=75, samples=128):
    # Cycles: soft bounced light, soft shadows, natural occlusion (baked for the web build).
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.samples = samples
    c.use_denoising = True
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.sample_clamp_indirect = 4.0
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        c.device = "GPU" if prefs.compute_device_type != "NONE" else "CPU"
    except Exception:
        pass
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = pct
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    try:
        scene.view_settings.look = "None"
    except Exception:
        pass


def set_cam(scene, loc, target, lens):
    cam = scene.camera
    if cam is None:
        cd = bpy.data.cameras.new("Camera")
        cam = bpy.data.objects.new("Camera", cd)
        scene.collection.objects.link(cam)
        scene.camera = cam
    cam.location = loc
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 500
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return cam


def gradient_world(scene, name, top, bottom, ambient, strength):
    w = bpy.data.worlds.new(name)
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    amb = nt.nodes.new("ShaderNodeBackground")
    amb.inputs["Color"].default_value = hex2lin(ambient)
    amb.inputs["Strength"].default_value = strength
    sky = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hex2lin(bottom)
    ramp.color_ramp.elements[1].color = hex2lin(top)
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], sky.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(sky.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return w
