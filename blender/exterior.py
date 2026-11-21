# Exterior: terrain, the long pathway, castle + gates, trees, bushes, flowers, butterflies, sky.
# Run after common.py (see blender/README).
random.seed(11)
reset_data()
scene = bpy.context.scene
scene.name = "Exterior"

C_TER = coll("Terrain"); C_CAS = coll("Castle"); C_TREE = coll("Trees")
C_FLO = coll("Flowers"); C_SKY = coll("Sky")

X0, X1, Y0, Y1 = -14.0, 14.0, -13.0, 11.0     # the castle garden (the original diorama block)
CX = 0.6                                       # castle / door centre
PATH_C = [(-13.5, 0.0), (-10.5, -0.5), (-7.0, -1.5), (-4.0, -0.7), (-1.8, 0.45), (0.6, CX)]
PATH_W = [(-13.5, 4.2), (-11.0, 3.3), (-8.0, 2.4), (-4.0, 1.8), (0.0, 1.25), (0.6, 1.2)]
HILLS = [(-9.8, -3.8, 1.8, 4.4), (10.2, -3.8, 1.8, 4.4), (-10.5, 5.0, 1.3, 5.0), (10.5, 5.0, 1.3, 5.0),
         (-8.5, -10.5, 0.55, 3.2), (8.5, -10.5, 0.55, 3.2), (0.0, 9.5, 0.6, 5.0)]

# ---- the long walk: the same path carries on in front of the garden, through open countryside.
# The garden block keeps its exact shape; everything below only adds to what lies around it.
NX, NY = 30, 26                                # cells of the garden block
DX, DY = (X1 - X0) / NX, (Y1 - Y0) / NY
IX, JF, JB = 19, 58, 3                         # extra cells: each side, in front, behind
GX0, GX1, GY0, GY1 = X0 - IX * DX, X1 + IX * DX, Y0 - JF * DY, Y1 + JB * DY   # the finely modelled ground
PATH_C2 = [(-74.0, 0.6), (-66.0, 1.0), (-58.0, 0.8), (-50.0, -0.9), (-42.0, -1.6), (-34.0, 0.2), (-26.0, 1.5),
           (-19.5, 1.0), (-13.5, 0.0), (-10.5, -0.5)]     # joins PATH_C with the same slope
FAR_HILLS = [  # rolling ground beside the walk ...
    (-11.0, -20.0, 1.5, 4.5), (10.0, -25.0, 1.3, 4.2), (-9.5, -33.0, 1.2, 4.0), (12.0, -38.0, 1.7, 5.0),
    (-13.0, -46.0, 1.6, 5.0), (10.5, -52.0, 1.2, 4.2), (-10.0, -60.0, 1.3, 4.5), (13.0, -63.0, 1.4, 5.0),
    (-24.0, -8.0, 2.4, 7.0), (25.0, -10.0, 2.6, 7.5), (-27.0, -34.0, 2.8, 8.0), (27.0, -30.0, 2.4, 8.0),
    (-25.0, -55.0, 2.2, 8.0), (28.0, -52.0, 2.6, 8.0), (-22.0, 10.0, 2.2, 6.5), (23.0, 11.0, 2.4, 7.0),
    # ... and the far hills that close the horizon
    (-55.0, 40.0, 7.0, 20.0), (0.0, 62.0, 5.5, 22.0), (58.0, 45.0, 7.5, 21.0), (-85.0, -5.0, 8.0, 24.0),
    (88.0, 0.0, 8.5, 25.0), (-70.0, -60.0, 6.0, 22.0), (72.0, -65.0, 6.0, 22.0), (-30.0, 95.0, 8.0, 26.0),
    (40.0, 100.0, 8.5, 26.0), (-110.0, 60.0, 10.0, 30.0), (115.0, 70.0, 10.0, 30.0)]
# where the camera walks (web/src/scene/journey.js keeps the same points): nothing may stand or fly here
CAM_TRACK = [(0.5, -55.0, 5.2), (0.0, -46.0, 3.3), (-0.8, -36.0, 3.0), (0.9, -26.0, 2.8), (-1.3, -16.5, 2.5),
             (0.2, -7.0, 1.7), (0.6, -1.7, 1.5)]


def separate_random(fn, seed):
    """Run fn with its own random stream, leaving the scene's original stream exactly where it was."""
    st = random.getstate()
    random.seed(seed)
    try:
        return fn()
    finally:
        random.setstate(st)


def pc(y):
    return interp(PATH_C, y) if y >= -13.5 else interp(PATH_C2, y)


def hw(y):
    if y >= -13.5:
        return interp(PATH_W, y)
    d = -13.5 - y                # a rounded forecourt, then a steady 4.8 m wide path
    return 2.4 + (1.8 + 0.81 * d) * math.exp(-d / 4.0)


def outside(x, y):
    """0 inside the castle garden, rising to 1 a few metres outside it."""
    return smoothstep(0.0, 7.0, math.hypot(max(X0 - x, x - X1, 0.0), max(Y0 - y, y - Y1, 0.0)))


def H(x, y):
    h = sum(a * math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * s * s)) for hx, hy, a, s in HILLS)
    f = outside(x, y)
    if f > 0.0:
        far = sum(a * math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * s * s)) for hx, hy, a, s in FAR_HILLS)
        far += 0.22 * math.sin(x * 0.23 - y * 0.17) + 0.18 * math.sin(y * 0.31 + x * 0.13) + 0.4
        h += f * max(0.0, far)
    yy = min(y, 0.6)
    pm = smoothstep(hw(yy) + 0.3, hw(yy) + 3.6, abs(x - pc(yy))) if y < 2.5 else 1.0
    d = math.hypot((x - CX) / 7.6, (y - 3.0) / 4.6)
    cm = smoothstep(1.0, 1.55, d)
    return h * pm * cm


def free(x, y, margin=0.4):
    if not (X0 + 0.5 < x < X1 - 0.5 and Y0 + 0.25 < y < Y1 - 0.5):
        return False
    if y < 0.8 and abs(x - pc(y)) < hw(y) + margin:
        return False
    if abs(x - CX) < 7.6 and -0.9 < y < 6.5:
        return False
    return True


def clear(x, y, margin=0.6):
    """Like free(), for the wider countryside: off the path, off the castle."""
    if y < 0.8 and abs(x - pc(y)) < hw(y) + margin:
        return False
    if abs(x - CX) < 7.6 + margin and -0.9 - margin < y < 6.5 + margin:
        return False
    return True


# ================================================================ terrain
def build_terrain():
    # The garden block draws its random numbers first, in the original order, so it comes out
    # exactly as before; the land around it uses a stream of its own.
    jit = {}
    for j in range(NY + 1):
        for i in range(NX + 1):
            if 0 < i < NX and 0 < j < NY:
                jit[(i, j)] = (random.uniform(-0.28, 0.28), random.uniform(-0.28, 0.28))
    tone = {}
    for j in range(NY):
        for i in range(NX):
            tone[(i, j)] = 0 if random.random() < 0.6 else 1

    def build():
        bm = bmesh.new()
        i0, i1, j0, j1 = -IX, NX + IX, -JF, NY + JB
        grid = {}
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                x, y = X0 + DX * i, Y0 + DY * j
                if (i, j) in jit:
                    x += jit[(i, j)][0]; y += jit[(i, j)][1]
                elif i0 < i < i1 and j0 < j < j1:
                    x += random.uniform(-0.28, 0.28); y += random.uniform(-0.28, 0.28)
                grid[(i, j)] = bm.verts.new((x, y, H(x, y)))
        for j in range(j0, j1):
            for i in range(i0, i1):
                f = bm.faces.new((grid[(i, j)], grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)]))
                f.material_index = tone[(i, j)] if (i, j) in tone else (0 if random.random() < 0.6 else 1)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])

        # far countryside: rings of ever larger facets out to where the haze swallows them
        from mathutils.geometry import delaunay_2d_cdt
        rim = ([(i, j0) for i in range(i0, i1)] + [(i1, j) for j in range(j0, j1)]
               + [(i, j1) for i in range(i1, i0, -1)] + [(i0, j) for j in range(j1, j0, -1)])
        pts = [Vector((grid[k].co.x, grid[k].co.y)) for k in rim]
        nrim = len(pts)
        edges = [(k, (k + 1) % nrim) for k in range(nrim)]
        d, step = 0.0, 1.25
        while d < 135.0:
            d += step
            ax0, ax1, ay0, ay1 = GX0 - d, GX1 + d, GY0 - d, GY1 + d
            per = 2 * ((ax1 - ax0) + (ay1 - ay0))
            n = max(8, int(per / (step * 1.15)))
            for k in range(n):
                t = (k + random.uniform(0.1, 0.9)) / n * per
                jx, jy = random.uniform(-0.3, 0.3) * step, random.uniform(-0.3, 0.3) * step
                if t < ax1 - ax0:
                    q = (ax0 + t, ay0)
                elif t < (ax1 - ax0) + (ay1 - ay0):
                    q = (ax1, ay0 + t - (ax1 - ax0))
                elif t < 2 * (ax1 - ax0) + (ay1 - ay0):
                    q = (ax1 - (t - (ax1 - ax0) - (ay1 - ay0)), ay1)
                else:
                    q = (ax0, ay1 - (t - 2 * (ax1 - ax0) - (ay1 - ay0)))
                pts.append(Vector((q[0] + jx, q[1] + jy)))
            step *= 1.24
        co, _e, tris, ov, _oe, _of = delaunay_2d_cdt(pts, edges, [], 0, 1e-6)
        vs = {}
        def vert(k):
            if k not in vs:
                src = [q for q in ov[k] if q < nrim]
                vs[k] = grid[rim[src[0]]] if src else bm.verts.new((co[k].x, co[k].y, H(co[k].x, co[k].y)))
            return vs[k]
        for t in tris:
            c = (co[t[0]] + co[t[1]] + co[t[2]]) / 3
            if GX0 < c.x < GX1 and GY0 < c.y < GY1:
                continue
            f = bm.faces.new([vert(k) for k in t])
            f.material_index = 0 if random.random() < 0.6 else 1
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
        me = bpy.data.meshes.new("Terrain"); bm.to_mesh(me); bm.free()
        for m in (M_("grass"), M_("grass2")):
            me.materials.append(m)
        ob = bpy.data.objects.new("Terrain", me); C_TER.objects.link(ob)

    separate_random(build, 2027)


def build_path():
    p = MB("Path")
    ys = [Y0 + 0.5 * k for k in range(int((0.5 - Y0) / 0.5) + 1)]
    for a, b in zip(ys, ys[1:]):
        p.poly([(pc(a) - hw(a), a, 0.04), (pc(a) + hw(a), a, 0.04),
                (pc(b) + hw(b), b, 0.04), (pc(b) - hw(b), b, 0.04)], "path")
    # stone tiles
    y = Y0 + 0.06
    while y < 0.3:
        dy = random.uniform(0.95, 1.35) * (0.75 + 0.25 * hw(y) / 4.2)
        yb = min(y + dy, 0.42)
        n = max(2, int(round(2 * hw(y) / 1.45)))
        cuts = [0.0] + sorted(min(0.92, max(0.08, (k + random.uniform(-0.28, 0.28)) / n)) for k in range(1, n)) + [1.0]
        for f0, f1 in zip(cuts, cuts[1:]):
            def P(f, yy):
                return Vector((pc(yy) - hw(yy) + 2 * hw(yy) * f, yy, 0.075))
            q = [P(f0, y), P(f1, y), P(f1, yb), P(f0, yb)]
            c = sum(q, Vector()) / 4
            q = [v + (c - v).normalized() * 0.075 for v in q]
            p.poly(q, random.choice(["tile1", "tile1", "tile2", "tile3"]))
        y = yb

    def longer():        # the same paving, carried on to the far end of the walk
        n = int(round((Y0 - GY0) / 0.5))
        ys = [GY0 + (Y0 - GY0) * k / n for k in range(n + 1)]
        for a, b in zip(ys, ys[1:]):
            p.poly([(pc(a) - hw(a), a, 0.04), (pc(a) + hw(a), a, 0.04),
                    (pc(b) + hw(b), b, 0.04), (pc(b) - hw(b), b, 0.04)], "path")
        y, end = GY0 + 0.06, Y0 + 0.06
        while y < end - 0.01:
            dy = random.uniform(0.95, 1.35) * (0.75 + 0.25 * hw(y) / 4.2)
            yb = y + dy
            if yb > end - 0.5:
                yb = end
            n = max(2, int(round(2 * hw(y) / 1.45)))
            cuts = [0.0] + sorted(min(0.92, max(0.08, (k + random.uniform(-0.28, 0.28)) / n)) for k in range(1, n)) + [1.0]
            for f0, f1 in zip(cuts, cuts[1:]):
                def P(f, yy):
                    return Vector((pc(yy) - hw(yy) + 2 * hw(yy) * f, yy, 0.075))
                q = [P(f0, y), P(f1, y), P(f1, yb), P(f0, yb)]
                c = sum(q, Vector()) / 4
                q = [v + (c - v).normalized() * 0.075 for v in q]
                p.poly(q, random.choice(["tile1", "tile1", "tile2", "tile3"]))
            y = yb
    separate_random(longer, 2028)
    p.build(coll=C_TER)


# ================================================================ castle
FLAG_POS = []


def tower(mb, x, y, r, h, roof_h, wins=(), seg=16, top_wins=(-1, 0, 1), flag=True, trim=None):
    trim = trim or mb                      # windows live in their own mesh (see build_castle)
    ph = -math.pi / 2 - math.pi / seg
    T = tr(x, y, 0)
    mb.lathe([(0, r * 1.07), (0.3, r * 1.07), (0.38, r), (h - 0.32, r), (h - 0.05, r * 1.2), (h + 0.3, r * 1.2)],
             seg, "wall", M=T, phase=ph, smooth=True)
    rin = r * 1.2 * math.cos(math.pi / seg)
    fw = 2 * r * 1.2 * math.sin(math.pi / seg)
    for k in range(seg):
        if k % 2:
            continue
        ang = ph + 2 * math.pi * (k + 0.5) / seg
        mb.box((fw * 0.84, 0.22, 0.32), (0, -(rin - 0.11), h + 0.3 + 0.16), "wall", M=T @ rot_z(ang + math.pi / 2))
    dh = max(0.75, 0.85 * r)
    r2 = r * 0.86
    mb.lathe([(h + 0.3, r2), (h + 0.3 + dh, r2)], seg, "wall", M=T, phase=ph, smooth=True)
    zr = h + 0.3 + dh
    mb.lathe([(zr - 0.12, r * 1.12), (zr, r * 1.34), (zr + 0.1, r * 1.34), (zr + roof_h, 0.045)],
             seg, "roof", M=T, phase=ph, smooth=True)
    top = zr + roof_h
    mb.ico(0.12, (x, y, top + 0.06), "gold", sub=2, smooth=True)
    if flag:
        mb.lathe([(top, 0.028), (top + 1.05, 0.028)], 4, "gold", M=T)
        mb.ico(0.06, (x, y, top + 1.08), "gold")
        FLAG_POS.append((x, y, top + 0.98))
    r_in = r * math.cos(math.pi / seg)
    for zf, k, w_, hr_ in wins:
        ang = -math.pi / 2 + 2 * math.pi * k / seg
        window(trim, T @ rot_z(ang + math.pi / 2) @ tr(0, -r_in, zf), w_, hr_)
    r2_in = r2 * math.cos(math.pi / seg)
    for k in top_wins:
        ang = -math.pi / 2 + 2 * math.pi * k / seg
        window(trim, T @ rot_z(ang + math.pi / 2) @ tr(0, -r2_in + 0.035, h + 0.3 + dh * 0.28), 0.085 * r + 0.03, dh * 0.22, frame=False)
    # stone accents
    for _ in range(int(3 + h * 1.3)):
        k = random.randint(-3, 3)
        ang = -math.pi / 2 + 2 * math.pi * k / seg
        z = random.uniform(0.6, h - 0.8)
        mb.box((0.3 * r, 0.03, 0.15), (random.uniform(-0.08, 0.08) * r, -r_in - 0.004, z),
               random.choice(["wall_dark", "wall_light"]), M=T @ rot_z(ang + math.pi / 2))


def wall_bricks(mb, x0, x1, z0, z1, y, n):
    for _ in range(n):
        mb.box((0.34, 0.03, 0.16), (random.uniform(x0, x1), y - 0.004, random.uniform(z0, z1)),
               random.choice(["wall_dark", "wall_light"]))


def merlons_x(mb, x0, x1, y, z, skip=None):
    n = max(1, int(round((x1 - x0) / 0.66)))
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k / n
        if skip and skip[0] < x < skip[1]:
            continue
        mb.box((0.36, 0.34, 0.34), (x, y, z + 0.17), "wall")


def build_castle():
    cas = MB("Castle")
    # Windows (glowing panes and their frames) are a mesh of their own: thin trim must not darken
    # the wall under it when occlusion is baked, nor throw a smeared shadow down the wall.
    trim = MB("CastleTrim")
    W, D, GH = 2.5, 3.0, 3.4
    a, hr = 1.05, 1.45
    # --- gatehouse: front wall with arched opening
    outline = ([(-W, 0), (-a, 0), (-a, hr)]
               + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
               + [(a, hr), (a, 0), (W, 0), (W, GH), (-W, GH)])
    cas.prism(outline, 0.5, "wall")
    b = 0.3
    surround = ([(a, 0), (a + b, 0), (a + b, hr)]
                + [((a + b) * math.cos(math.pi * i / 10), hr + (a + b) * math.sin(math.pi * i / 10)) for i in range(1, 10)]
                + [(-(a + b), hr), (-(a + b), 0), (-a, 0), (-a, hr)]
                + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
                + [(a, hr)])
    cas.prism(surround, 0.12, "wall_light", M=tr(0, -0.12, 0))
    for sx in (-1, 1):
        cas.box((0.5, D - 0.5, GH), (sx * (W - 0.25), 0.5 + (D - 0.5) / 2, GH / 2), "wall")
    cas.box((2 * W - 1, 0.3, GH), (0, D - 0.15, GH / 2), "wall")
    cas.box((2 * W - 1, D - 0.8, 0.3), (0, 0.5 + (D - 0.8) / 2, GH - 0.15), "wall")
    cas.box((2 * W - 1, D, 0.07), (0, D / 2, 0.035), "tile2")
    yg = 1.95
    cas.poly([(-W + 0.5, yg, 0.07), (W - 0.5, yg, 0.07), (W - 0.5, yg, GH - 0.3), (-W + 0.5, yg, GH - 0.3)], "glow_soft")
    merlons_x(cas, -W + 0.2, W - 0.2, 0.19, GH, skip=(-1.5, 1.5))
    for sx in (-1, 1):
        for yy in (0.85, 1.5):
            cas.box((0.34, 0.36, 0.34), (sx * (W - 0.19), yy, GH + 0.17), "wall")
    wall_bricks(cas, -W + 0.3, -a - 0.55, 0.4, GH - 0.4, 0, 5)
    wall_bricks(cas, a + 0.55, W - 0.3, 0.4, GH - 0.4, 0, 5)
    window(trim, tr(0, 0, 2.78), 0.17, 0.2)
    # --- gable above the gate
    gw, gh1, gh2, gd = 1.3, 1.05, 2.4, 1.6
    cas.prism([(-gw, 0), (gw, 0), (gw, gh1), (0, gh2), (-gw, gh1)], gd, "wall", M=tr(0, 0.0, GH))
    beta = math.atan2(gh2 - gh1, gw)
    L = math.hypot(gw, gh2 - gh1)
    for sx in (-1, 1):
        along = Vector((sx * math.cos(beta), 0, -math.sin(beta)))
        nrm = Vector((sx * math.sin(beta), 0, math.cos(beta)))
        c = Vector((sx * gw / 2, gd / 2 - 0.08, GH + (gh1 + gh2) / 2)) + nrm * 0.085 + along * 0.14
        cas.box((L + 0.5, gd + 0.3, 0.17), c, "roof", rot=Euler((0, sx * beta, 0)))
    window(trim, tr(0, 0, GH + 0.5), 0.3, 0.5)
    cas.ico(0.11, (0, 0.5, GH + gh2 + 0.22), "gold")
    cas.lathe([(GH + gh2 + 0.2, 0.026), (GH + gh2 + 1.0, 0.026)], 4, "gold", M=tr(0, 0.5, 0))
    FLAG_POS.append((0, 0.5, GH + gh2 + 0.92))
    # --- keep behind the gable
    cas.box((4.3, 1.9, 5.2), (0.1, 3.95, 2.6), "wall")
    merlons_x(cas, -1.85, 2.05, 3.17, 5.2)
    # --- towers
    tower(cas, 0.9, 3.1, 1.1, 8.3, 3.7, wins=[(6.6, 0, 0.17, 0.3), (7.4, 1, 0.13, 0.22), (5.6, -1, 0.13, 0.22)], trim=trim)
    tower(cas, -1.95, 2.9, 1.0, 7.0, 3.0, wins=[(5.9, 0, 0.16, 0.28), (4.6, -1, 0.13, 0.22)], trim=trim)
    tower(cas, 3.15, 2.5, 0.95, 6.4, 3.1, wins=[(5.3, 0, 0.15, 0.26), (4.3, 1, 0.12, 0.2)], trim=trim)
    tower(cas, -5.9, 0.7, 1.25, 4.3, 2.8, wins=[(3.1, 0, 0.19, 0.3), (2.0, 1, 0.14, 0.24), (2.6, -1, 0.14, 0.24)], trim=trim)
    tower(cas, 3.45, 0.15, 0.9, 4.1, 2.6, wins=[(3.0, 0, 0.15, 0.26), (1.7, 0, 0.13, 0.22)], trim=trim)
    tower(cas, 6.15, 0.6, 0.95, 3.0, 2.4, wins=[(1.9, 0, 0.15, 0.26), (2.2, -1, 0.12, 0.2)], trim=trim)
    # --- wing walls
    cas.box((3.2, 0.9, 2.7), (-4.1, 0.95, 1.35), "wall")
    merlons_x(cas, -5.4, -2.8, 0.67, 2.7)
    window(trim, tr(-3.75, 0.5, 1.35), 0.17, 0.28)
    wall_bricks(cas, -5.0, -2.8, 0.3, 2.3, 0.5, 5)
    cas.box((3.4, 0.9, 2.3), (4.4, 1.05, 1.15), "wall")
    merlons_x(cas, 4.5, 5.2, 0.77, 2.3)
    window(trim, tr(4.85, 0.6, 1.2), 0.15, 0.24)
    wall_bricks(cas, 4.4, 5.2, 0.3, 1.9, 0.6, 3)
    # door frame: a wooden lining just in front of the leaves, so no light leaks around them
    fw_ = 0.07
    ai = a - fw_
    lining = ([(ai, 0), (a, 0), (a, hr)]
              + [(a * math.cos(math.pi * i / 10), hr + a * math.sin(math.pi * i / 10)) for i in range(1, 10)]
              + [(-a, hr), (-a, 0), (-ai, 0), (-ai, hr)]
              + [(ai * math.cos(math.pi * (1 - i / 10)), hr + ai * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
              + [(ai, hr)])
    cas.prism(lining, 0.07, "wood_dark", M=tr(0, 0.12, 0))
    castle = cas.build(loc=(CX, 0, 0), coll=C_CAS)
    trim.build(loc=(CX, 0, 0), coll=C_CAS)

    # --- gates (two leaves hinged on the outer edges, opening inwards)
    def leaf(side):
        d = MB("Gate_L" if side < 0 else "Gate_R")
        pts = [(-a, 0), (0, 0), (0, hr)] + [(a * math.cos(t) - a, hr + a * math.sin(t))
                                             for t in [math.pi / 2 * i / 6 for i in range(1, 7)]]
        pts = [(x, z * 0.99) for x, z in pts]       # the two leaves meet exactly: no slit between them
        if side < 0:
            pts = [(-x, z) for x, z in reversed(pts)]
        d.prism(pts, 0.12, "wood")
        for i in (1, 2, 3):
            xc = a * i / 4                       # distance from the hinge
            top = hr + math.sqrt(max(0.0, a * a - (a - xc) ** 2))
            d.box((0.03, 0.03, top * 0.985 - 0.04), (side * -xc, -0.005, top * 0.985 / 2), "wood_dark")
        for zb_ in (0.45, 1.55):
            d.box((a * 0.97, 0.03, 0.07), (side * -a * 0.5, -0.008, zb_), "wood_dark")
        d.ico(0.075, (side * -(a - 0.17), -0.06, 1.15), "gold")
        if side > 0:                             # a cover strip on one leaf laps over the meeting edges
            d.box((0.06, 0.025, 2.4), (-a, -0.0125, 1.2), "wood_dark")
        return d.build(loc=(side * a, 0.2, 0.07), parent=castle, coll=C_CAS)
    leaf(-1); leaf(1)

    # --- flags
    fl = MB("Flag")
    n = 5
    for i in range(n):
        x0, x1 = 1.15 * i / n, 1.15 * (i + 1) / n
        def edge(x):
            t = x / 1.15
            return (0.23 - 0.14 * t, 0.07 * math.sin(t * 5.0), -0.02 * t)
        h0, w0, s0 = edge(x0); h1, w1, s1 = edge(x1)
        fl.poly([(x0, w0, s0 - h0), (x1, w1, s1 - h1), (x1, w1, s1 + h1), (x0, w0, s0 + h0)], "flag")
    flag_t = fl.build(loc=(CX + FLAG_POS[0][0], FLAG_POS[0][1], FLAG_POS[0][2] - 0.25), coll=C_CAS, parent=None)
    flag_t.name = "Flag_0"
    for i, (fx, fy, fz) in enumerate(FLAG_POS[1:], 1):
        s = 0.62 if i == 0 else 1.0
        inst(flag_t, (CX + fx, fy, fz - 0.25), 0, 1.0, coll=C_CAS, name="Flag_%d" % i)
    flag_t.scale = (0.7, 0.7, 0.7)   # the small pennant on the gable
    # warm light spilling out of the gate
    ld = bpy.data.lights.new("GateGlow", "POINT")
    ld.energy = 420; ld.color = (1.0, 0.86, 0.6); ld.shadow_soft_size = 0.6
    lo = bpy.data.objects.new("GateGlow", ld); lo.location = (CX, 1.7, 1.9); C_CAS.objects.link(lo)
    return castle


# ================================================================ trees
def add_blossom(mb, M, r):
    for k in range(5):
        a0 = 2 * math.pi * k / 5
        R = rot_z(a0)
        mb.poly([(0.08 * r, 0, 0.02), (0.5 * r, -0.36 * r, 0.05), (1.0 * r, -0.2 * r, 0.1),
                 (1.0 * r, 0.2 * r, 0.1), (0.5 * r, 0.36 * r, 0.05)], "petal_white", M=M @ R)
    mb.ico(0.26 * r, (0, 0, 0.08 * r), "center", scale=(1, 1, 0.55), M=M)


def blossom_tree(name, x, y, s=1.0, n_flowers=10):
    t = MB(name)
    lean = random.uniform(-0.06, 0.06)
    Mt = rot_y(lean)
    t.lathe([(0, 0.5), (0.25, 0.4), (2.7, 0.27)], 7, "trunk", M=Mt, key2="trunk_dark", p2=0.3)
    for ang, tilt, L in ((0.4, 0.75, 2.1), (2.5, 0.8, 2.0), (4.4, 0.6, 1.9), (1.5, 0.3, 2.0)):
        Mb = Mt @ tr(0, 0, 2.45) @ rot_z(ang) @ rot_y(tilt)
        t.lathe([(0, 0.24), (L, 0.1)], 6, "trunk", M=Mb, key2="trunk_dark", p2=0.3)
    lobes = [(0, 0, 4.9, 1.75)]
    for k in range(7):
        a0 = 2 * math.pi * k / 7 + 0.3
        lobes.append((2.35 * math.cos(a0), 1.55 * math.sin(a0), 4.15 + random.uniform(-0.25, 0.3),
                      random.uniform(1.2, 1.5)))
    lobes += [(-1.0, -0.2, 5.75, 1.2), (1.05, 0.1, 5.65, 1.25), (0.1, -0.9, 5.2, 1.3)]
    keys = ["bloss1", "bloss2", "bloss3"]
    for i, (lx, ly, lz, lr) in enumerate(lobes):
        t.ico(lr, (lx, ly, lz), keys[i % 3], sub=2,
              rot=Euler((random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3))))
    for _ in range(n_flowers):
        lx, ly, lz, lr = random.choice(lobes)
        d = Vector((random.uniform(-0.9, 0.9), random.uniform(-1.0, -0.45), random.uniform(-0.25, 0.75))).normalized()
        p = Vector((lx, ly, lz)) + d * lr * 0.985
        if any((p - Vector(l[:3])).length < l[3] * 0.97 for l in lobes):
            continue
        Mq = Matrix.Translation(p) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        add_blossom(t, Mq, random.uniform(0.3, 0.42))
    return t.build(loc=(x, y, H(x, y) - 0.12), coll=C_TREE, scale=(s, s, s), rot=(0, 0, random.uniform(-0.4, 0.4)))


def cypress_template(name):
    c = MB(name)
    c.lathe([(0, 0.0), (0.12, 0.34), (0.75, 0.66), (1.6, 0.6), (2.5, 0.36), (3.1, 0.0)], 7, "cyp1", key2="cyp2", p2=0.4)
    return c.build(coll=C_TREE, loc=(0, 0, -50))


def bush(name, x, y, s=1.0):
    b = MB(name)
    keys = ["bloss1", "bloss2", "bloss3"]
    lobes = []
    for i in range(5):
        lx, ly = random.uniform(-0.6, 0.6), random.uniform(-0.35, 0.35)
        lr = random.uniform(0.38, 0.6)
        lobes.append((lx, ly, lr * 0.75, lr))
        b.ico(lr, (lx, ly, lr * 0.75), keys[i % 3], sub=1,
              rot=Euler((random.uniform(0, 3), random.uniform(0, 3), 0)))
    for _ in range(5):
        lx, ly, lz, lr = random.choice(lobes)
        d = Vector((random.uniform(-0.8, 0.8), random.uniform(-1.0, -0.4), random.uniform(0.0, 0.8))).normalized()
        p = Vector((lx, ly, lz)) + d * lr * 0.97
        add_blossom(b, Matrix.Translation(p) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(), 0.17)
    return b.build(loc=(x, y, H(x, y) - 0.05), coll=C_TREE, scale=(s, s, s))


# ================================================================ flowers
def add_leaf(mb, M, l, w, key="leaf"):
    mb.poly([(0, 0, 0), (w, 0.45 * l, 0.07), (0, l, 0.0)], key, M=M)
    mb.poly([(0, 0, 0), (0, l, 0.0), (-w, 0.45 * l, 0.07)], "leaf2" if key == "leaf" else "leaf", M=M)


def add_leaves(mb, n, l, w, tilt=1.05):
    for k in range(n):
        a0 = 2 * math.pi * k / n + random.uniform(-0.4, 0.4)
        add_leaf(mb, rot_z(a0) @ rot_x(tilt + random.uniform(-0.15, 0.15)), l * random.uniform(0.8, 1.1), w)


def cosmos_template(name, petal, hs=1.0):
    f = MB(name)
    f.lathe([(0, 0.035), (hs, 0.028)], 5, "stem")
    add_leaves(f, 3, 0.55, 0.11)
    Mh = tr(0, -0.02, hs) @ rot_x(math.radians(58))
    for k in range(5):
        R = rot_z(2 * math.pi * k / 5 + 0.3)
        f.poly([(0.04, 0, 0), (0.2, -0.15, 0.03), (0.38, -0.13, 0.06), (0.45, 0, 0.07),
                (0.38, 0.13, 0.06), (0.2, 0.15, 0.03)], petal, M=Mh @ R)
    f.ico(0.1, (0, 0, 0.04), "center", scale=(1, 1, 0.6), M=Mh)
    return f.build(coll=C_FLO, loc=(0, 0, -50))


def tulip_template(name, key, hs=0.85):
    f = MB(name)
    f.lathe([(0, 0.035), (hs, 0.03)], 5, "stem")
    add_leaves(f, 2, 0.7, 0.1, tilt=1.25)
    f.lathe([(hs - 0.02, 0.0), (hs + 0.06, 0.13), (hs + 0.24, 0.185), (hs + 0.42, 0.13), (hs + 0.54, 0.0)],
            6, key, key2="tulip2" if key == "tulip" else "tulip", p2=0.3)
    return f.build(coll=C_FLO, loc=(0, 0, -50))


def daisy_template(name, petal):
    f = MB(name)
    f.lathe([(0, 0.02), (0.16, 0.016)], 4, "stem")
    Mh = tr(0, 0, 0.16) @ rot_x(math.radians(32))
    for k in range(5):
        R = rot_z(2 * math.pi * k / 5)
        f.poly([(0.02, 0, 0), (0.1, -0.075, 0.015), (0.2, 0, 0.03), (0.1, 0.075, 0.015)], petal, M=Mh @ R)
    f.ico(0.05, (0, 0, 0.02), "center", scale=(1, 1, 0.6), M=Mh)
    return f.build(coll=C_FLO, loc=(0, 0, -50))


def bud_template(name):
    f = MB(name)
    f.lathe([(0, 0.022), (0.9, 0.018)], 4, "stem")
    add_leaves(f, 2, 0.4, 0.07, tilt=1.3)
    for z, dx in ((0.9, 0.0), (0.68, 0.07), (0.5, -0.07)):
        f.ico(0.075, (dx, 0, z), "petal_pink", scale=(1, 1, 1.35))
    return f.build(coll=C_FLO, loc=(0, 0, -50))


def leafclump_template(name):
    f = MB(name)
    add_leaves(f, 6, 0.7, 0.16, tilt=0.95)
    return f.build(coll=C_FLO, loc=(0, 0, -50))


OCC = []


def scatter(n, xr, yr, templates, smin, smax, mind=0.5, margin=0.4, prefix="Fl"):
    placed, tries = 0, 0
    while placed < n and tries < n * 40:
        tries += 1
        x, y = random.uniform(*xr), random.uniform(*yr)
        if not free(x, y, margin):
            continue
        if any((x - ox) ** 2 + (y - oy) ** 2 < (mind + orad) ** 2 for ox, oy, orad in OCC):
            continue
        OCC.append((x, y, mind))
        t = random.choice(templates)
        inst(t, (x, y, H(x, y) - 0.04), random.uniform(-0.45, 0.45), random.uniform(smin, smax),
             coll=C_FLO, name="%s_%s" % (prefix, t.name))
        placed += 1


FLOWER_T = {}


def build_flowers():
    cos = [cosmos_template("CosmosPink", "petal_pink", 1.0), cosmos_template("CosmosWhite", "petal_white", 0.8),
           cosmos_template("CosmosRose", "petal_rose", 1.2), cosmos_template("CosmosLight", "petal_light", 0.65)]
    tul = [tulip_template("TulipA", "tulip"), tulip_template("TulipB", "tulip2", 1.05)]
    dai = [daisy_template("DaisyWhite", "petal_white"), daisy_template("DaisyPink", "petal_light")]
    bud = [bud_template("Bud")]
    clump = [leafclump_template("LeafClump")]
    FLOWER_T.update(cos=cos, tul=tul, dai=dai, bud=bud, clump=clump)
    for sx in (-1, 1):
        xr = (4.0, 13.6) if sx > 0 else (-13.6, -4.0)
        # foreground beds: big blooms
        scatter(13, xr, (-12.75, -9.6), cos, 1.5, 2.1, mind=0.62, prefix="Fg")
        scatter(9, xr, (-12.6, -9.0), tul, 1.5, 2.0, mind=0.45, prefix="Fg")
        scatter(10, xr, (-12.8, -9.5), clump, 1.1, 1.6, mind=0.3, prefix="Fg")
        scatter(16, xr, (-12.8, -8.2), dai, 1.6, 2.4, mind=0.28, prefix="Fg")
        # mid garden
        xr2 = (2.0, 13.5) if sx > 0 else (-13.5, -2.6)
        scatter(9, xr2, (-8.8, -4.5), cos, 0.9, 1.3, mind=0.5, prefix="Mid")
        scatter(8, xr2, (-8.8, -3.0), tul, 0.9, 1.3, mind=0.4, prefix="Mid")
        scatter(8, xr2, (-8.5, -2.0), bud, 0.9, 1.3, mind=0.3, prefix="Mid")
        scatter(34, xr2, (-9.0, 0.5), dai, 1.0, 1.7, mind=0.22, prefix="Mid")
    # flower borders in front of the castle walls
    for sx in (-1, 1):
        xr = (CX + 1.7, CX + 7.4) if sx > 0 else (CX - 7.4, CX - 1.7)
        scatter(7, xr, (-2.3, -0.95), cos, 0.75, 1.05, mind=0.34, margin=0.15, prefix="Castle")
        scatter(7, xr, (-2.3, -0.95), tul, 0.8, 1.1, mind=0.26, margin=0.15, prefix="Castle")
        scatter(7, xr, (-2.2, -0.95), bud, 0.9, 1.25, mind=0.2, margin=0.15, prefix="Castle")
        scatter(12, xr, (-2.6, -0.95), dai, 0.9, 1.4, mind=0.16, margin=0.1, prefix="Castle")


# ================================================================ sky
def build_butterflies():
    """Butterflies fly long, loose loops (see world.js): centre + (ax sin a, ay cos 0.7a, az cos 1.3a).
    Every loop is tested against all the scenery, so none ever passes through a tree, the castle,
    the flowers or the camera's own way."""
    def wing(name, side):
        w = MB(name)
        up = [(0.03, 0.02), (0.42, 0.72), (0.9, 0.82), (1.08, 0.5), (0.86, 0.1), (0.3, -0.04)]
        lo = [(0.03, -0.04), (0.5, -0.06), (0.82, -0.3), (0.72, -0.72), (0.4, -0.8), (0.1, -0.36)]
        for pts, c in ((up, (0.62, 0.42)), (lo, (0.47, -0.4))):
            w.poly([(side * x, y, 0) for x, y in pts], "bfly")
            w.poly([(side * (c[0] + (x - c[0]) * 0.6), c[1] + (y - c[1]) * 0.6, 0.012) for x, y in pts], "bfly_in")
            w.poly([(side * (c[0] + (x - c[0]) * 0.6), c[1] + (y - c[1]) * 0.6, -0.012) for x, y in pts], "bfly_in")
        return w
    body = MB("ButterflyBody")
    body.lathe([(-0.5, 0.0), (-0.3, 0.05), (0.2, 0.07), (0.42, 0.06), (0.52, 0.0)], 5, "bfly_body", M=rot_x(-math.pi / 2))
    for sx in (-1, 1):
        body.lathe([(0, 0.012), (0.42, 0.006)], 3, "bfly_body", M=tr(sx * 0.03, 0.5, 0) @ rot_x(-1.2) @ rot_y(sx * 0.45))
    body_t = body.build(coll=C_SKY, loc=(0, 0, -50))
    wl_t = wing("ButterflyWingL", -1).build(coll=C_SKY, loc=(0, 0, -50))
    wr_t = wing("ButterflyWingR", 1).build(coll=C_SKY, loc=(0, 0, -50))

    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    verts, polys = [], []
    for ob in scene.objects:
        if ob.type != "MESH" or ob.location.z < -40 or ob.name.startswith(("Terrain", "Sparkle")):
            continue
        base = len(verts)
        verts.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
        polys.extend(tuple(base + i for i in pl.vertices) for pl in ob.data.polygons)
    solid = BVHTree.FromPolygons(verts, polys)

    def track_dist(p):
        best = 1e9
        for a, b in zip(CAM_TRACK, CAM_TRACK[1:]):
            for lift in (0.0, 1.4):          # on tall, narrow screens the camera walks a little higher
                a_, b_ = Vector(a) + Vector((0, 0, lift)), Vector(b) + Vector((0, 0, lift))
                t = max(0.0, min(1.0, (p - a_).dot(b_ - a_) / (b_ - a_).length_squared))
                best = min(best, (p - (a_ + (b_ - a_) * t)).length)
        return best

    def loop_ok(c, amp, reach, walk):
        for k in range(700):
            a = 20 * math.pi * k / 700          # the three rhythms repeat every 20 pi
            p = Vector((c[0] + amp[0] * math.sin(a), c[1] + amp[1] * math.cos(0.7 * a), c[2] + amp[2] * math.cos(1.3 * a)))
            if p.z < H(p.x, p.y) + reach + 0.9:
                return False
            if solid.find_nearest(p, reach + 0.45)[0] is not None:
                return False
            if walk and track_dist(p) < reach + 1.9:
                return False
        return True

    # (how many, |x| range, y range, height range, size range, loop width / depth / height, near the walk?)
    groups = [
        (4, (2.0, 17.0), (-13.0, -4.5), (9.5, 14.0), (0.85, 1.15), (3.0, 4.6), (1.0, 1.8), (0.6, 1.1), False),   # high, in front of the towers
        (4, (3.5, 22.0), (-24.0, -5.0), (3.0, 7.5), (0.5, 0.72), (1.7, 3.2), (1.2, 2.2), (0.5, 0.9), True),      # over the garden
        (8, (4.5, 15.0), (-60.0, -24.0), (2.2, 5.5), (0.36, 0.56), (1.8, 3.2), (1.5, 2.8), (0.45, 0.9), True),   # along the walk
    ]
    made, placed = 0, []
    for n, xr, yr, zr, sr, axr, ayr, azr, walk in groups:
        got, tries = 0, 0
        while got < n and tries < 40000:
            tries += 1
            shrink = max(0.45, 0.9 ** (tries // 2500))      # a crowded spot gets a tighter loop
            # spread them out: alternate sides, and step along the stretch
            side = -1 if (got % 2 == 0) else 1
            y_ = yr[0] + (yr[1] - yr[0]) * ((got + random.uniform(0.0, 1.0)) / n if tries % 5000 < 3500 else random.random())
            c = ((pc(y_) if walk else 0.0) + side * random.uniform(*xr), y_, random.uniform(*zr))
            s_ = random.uniform(*sr)
            amp = (random.uniform(*axr) * shrink, random.uniform(*ayr) * shrink, random.uniform(*azr))
            if any(math.hypot(c[0] - q[0], c[1] - q[1]) < 4.0 for q in placed):
                continue
            if not loop_ok(c, amp, 1.15 * s_, walk):
                continue
            roll = random.uniform(-0.45, 0.45)
            e = bpy.data.objects.new("Butterfly_%d" % made, None)
            e.empty_display_size = 0.3
            e.location = c; e.scale = (s_, s_, s_)
            e.rotation_euler = Euler((math.radians(62), roll * 0.4, roll), "XYZ")
            e["fly"] = [round(v, 3) for v in (amp[0], amp[1], amp[2], random.uniform(0.34, 0.62), random.uniform(0.0, 6.283))]
            C_SKY.objects.link(e)
            flap = random.uniform(0.45, 0.75)
            b_ = inst(body_t, (0, 0, 0), coll=C_SKY, name="Butterfly_%d_Body" % made); b_.parent = e
            l_ = inst(wl_t, (0, 0, 0), coll=C_SKY, name="Butterfly_%d_WingL" % made); l_.parent = e
            l_.rotation_euler = (0, flap, 0)
            r_ = inst(wr_t, (0, 0, 0), coll=C_SKY, name="Butterfly_%d_WingR" % made); r_.parent = e
            r_.rotation_euler = (0, -flap, 0)
            placed.append(c); made += 1; got += 1
        if got < n:
            raise RuntimeError("could not place every butterfly (%d of %d)" % (got, n))


def build_sky():
    def cloud(name, x, y, z, s, n):
        c = MB(name)
        R = lambda: Euler((random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3)))
        span = n * 1.0
        for i in range(n):
            t = (i + 0.5) / n
            r = (0.5 + 0.82 * math.sin(math.pi * t)) * random.uniform(0.86, 1.12)
            c.ico(r, ((t - 0.5) * span + random.uniform(-0.12, 0.12), random.uniform(-0.2, 0.2), r * 0.62),
                  "cloud", sub=2, jitter=0.06, rot=R())
        for _ in range(n + 2):
            t = random.uniform(0.08, 0.92)
            bulge = math.sin(math.pi * t)
            r = random.uniform(0.34, 0.56) * (0.65 + 0.55 * bulge)
            if random.random() < 0.35:      # perched on top
                p = ((t - 0.5) * span, random.uniform(-0.3, 0.1), 1.15 + 0.75 * bulge)
            else:                            # tucked in along the front and underside
                p = ((t - 0.5) * span, -0.45 - 0.5 * bulge, random.uniform(0.0, 0.5))
            c.ico(r, p, random.choice(["cloud", "cloud", "cloud2"]), sub=2, jitter=0.06, rot=R())
        return c.build(loc=(x, y, z), coll=C_SKY, scale=(s, s, s))
    cloud("Cloud_0", -11.0, 15.0, 9.9, 1.0, 7)
    cloud("Cloud_1", 10.5, 15.0, 9.0, 1.05, 6)
    cloud("Cloud_2", -6.0, 17.0, 5.6, 0.62, 4)
    cloud("Cloud_3", 13.5, 17.0, 4.6, 0.6, 5)
    st = MB("Sparkle")
    pts = []
    for k in range(8):
        r = 1.0 if k % 2 == 0 else 0.22
        pts.append((r * math.cos(math.pi * k / 4), 0, r * math.sin(math.pi * k / 4)))
    st.poly(pts, "spark")
    st_t = st.build(coll=C_SKY, loc=(0, 0, -50))
    for i in range(34):
        inst(st_t, (random.uniform(-19, 19), 13.0, random.uniform(1.0, 11.8)), 0,
             random.uniform(0.07, 0.2), coll=C_SKY, name="Sparkle_%d" % i)


# ================================================================ countryside (all new, own random stream)
def green_bush(name, x, y, s=1.0, berries=True):
    """Low, rounded, faceted shrub: two or three squashed lobes, sometimes with berries."""
    b = MB(name)
    keys = random.choice([("bush1", "bush2"), ("bush2", "bush1"), ("bush3", "bush1"), ("bush1", "bush3")])
    lobes = [(0.0, 0.0, random.uniform(0.62, 0.78))]
    ang = random.uniform(0, 6.283)
    for k in range(random.choice([1, 2, 2])):
        r = random.uniform(0.36, 0.52)
        d = random.uniform(0.5, 0.72)
        lobes.append((d * math.cos(ang), d * math.sin(ang), r))
        ang += random.uniform(1.7, 2.9)
    for n_, (lx, ly, lr) in enumerate(lobes):
        b.ico(lr, (lx, ly, lr * 0.58), keys[0], sub=2 if n_ == 0 else 1, scale=(1, 1, 0.8), jitter=0.09 if n_ == 0 else 0.05,
              key2=keys[1], p2=0.38, rot=Euler((random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3))))
    if berries:
        for _ in range(random.randint(5, 9)):
            lx, ly, lr = random.choice(lobes)
            dv = Vector((random.uniform(-1, 1), random.uniform(-1.0, 0.35), random.uniform(0.05, 1.0))).normalized()
            q = Vector((lx, ly, lr * 0.58)) + Vector((dv.x * lr, dv.y * lr, dv.z * lr * 0.8)) * 0.97
            if any((q - Vector((ox, oy, orr * 0.58))).length < orr * 0.8 for ox, oy, orr in lobes if (ox, oy, orr) != (lx, ly, lr)):
                continue
            b.lathe([(-0.085, 0.0), (0.0, 0.085), (0.085, 0.0)], 4, "berry",
                    M=Matrix.Translation(q) @ Euler((random.uniform(0, 3), random.uniform(0, 3), 0)).to_matrix().to_4x4())
    return b.build(loc=(x, y, H(x, y) - 0.05), coll=C_TREE, scale=(s, s, s), rot=(0, 0, random.uniform(0, 6.283)))


def far_tree_template(name, keys):
    t = MB(name)
    t.lathe([(0, 0.3), (2.2, 0.18)], 5, "trunk")
    for (lx, ly, lz, lr), k in zip(((0, 0, 3.6, 1.7), (-1.2, 0.2, 2.9, 1.25), (1.25, -0.1, 3.0, 1.3), (0.2, -0.3, 4.6, 1.1)), keys):
        t.ico(lr, (lx, ly, lz), k, sub=1, rot=Euler((random.uniform(0, 3), random.uniform(0, 3), 0)))
    return t.build(coll=C_TREE, loc=(0, 0, -50))


def build_countryside():
    trees, shrubs = [], []       # (x, y, radius) of what already stands

    def roomy(x, y, r, others):
        return all((x - ox) ** 2 + (y - oy) ** 2 >= (r + orr) ** 2 for ox, oy, orr in others)

    # ---- the garden had too many flowers: thin them out
    keep = {"Fg_": 0.45, "Mid_": 0.42, "Castle_": 0.55}
    for o in list(C_FLO.objects):
        k = next((v for pre, v in keep.items() if o.name.startswith(pre)), None)
        if k is not None and random.random() > k:
            bpy.data.objects.remove(o, do_unlink=True)

    # ---- blossom trees: more of them to the sides of the garden and all along the walk
    for i, (x, y, sc, nf) in enumerate([
            (-21.5, -6.5, 0.9, 14), (22.5, -7.5, 0.95, 14), (-27.0, 2.0, 0.8, 9), (28.0, 3.0, 0.85, 9),
            (-18.5, 5.5, 0.6, 6), (19.5, 6.0, 0.6, 6),
            (-8.8, -21.0, 0.8, 12), (10.2, -27.5, 0.9, 14), (-10.2, -36.0, 0.95, 14), (9.0, -44.5, 0.85, 12),
            (-9.6, -53.0, 0.9, 12), (10.4, -60.5, 0.8, 10),
            (19.0, -17.5, 0.65, 7), (-19.0, -28.0, 0.7, 8), (20.0, -39.0, 0.75, 8), (-21.0, -46.5, 0.7, 8),
            (22.0, -57.0, 0.7, 7), (-23.0, -62.0, 0.75, 7)]):
        blossom_tree("BlossomTree_X%d" % i, x, y, sc, nf)
        trees.append((x, y, 1.0 * sc + 0.4))
    trees += [(-10.3, -4.2, 1.4), (11.3, -4.0, 1.4), (-5.6, -1.9, 0.8), (8.3, -0.4, 0.8), (-8.6, 1.4, 0.7), (12.2, 2.5, 0.7)]
    old_bushes = [(-6.9, -0.7, 0.9), (-4.4, -1.2, 0.7), (7.3, -1.4, 0.85), (-9.6, -0.2, 0.7), (10.0, -0.9, 0.75), (-3.2, -1.25, 0.55), (5.0, -1.2, 0.6)]

    # ---- green bushes
    def plant_bush(x, y, sc):
        r = 0.95 * sc
        if not clear(x, y, 0.25 + r * 0.55) or not roomy(x, y, r, shrubs) or not roomy(x, y, r * 0.6, trees) or not roomy(x, y, r, old_bushes):
            return False
        # a bush takes the place of the flowers under it
        for o in list(C_FLO.objects):
            if o.location.z > -40 and (o.location.x - x) ** 2 + (o.location.y - y) ** 2 < (r * 0.95) ** 2:
                bpy.data.objects.remove(o, do_unlink=True)
        green_bush("GBush_%d" % len(shrubs), x, y, sc, berries=random.random() < 0.6)
        shrubs.append((x, y, r))
        return True

    for side in (-1, 1):                         # following the pathway, both sides, all the way
        y = GY0 + 1.5 + random.uniform(0, 2)
        while y < -1.6:
            sc = random.uniform(0.95, 1.5) * (1.0 if y < -14 else 0.85)
            x = pc(y) + side * (hw(y) + 0.5 + 0.6 * sc + random.uniform(0.0, 1.1))
            if random.random() < 0.86 and plant_bush(x, y, sc) and random.random() < 0.45:
                sc2 = sc * random.uniform(0.55, 0.7)
                plant_bush(x + side * random.uniform(0.9, 1.5) * sc, y + random.uniform(-1.0, 1.0), sc2)
            y += random.uniform(2.7, 4.8)
    for n, xr, yr, sr in ((22, (-13.3, 13.3), (-12.6, -1.5), (0.9, 1.5)),      # in the castle garden
                          (18, (-31.0, 31.0), (-12.8, 9.0), (1.0, 1.7)),       # to its sides
                          (44, (-30.0, 30.0), (-65.0, -13.0), (0.9, 1.8))):    # out in the meadows
        got, tries = 0, 0
        while got < n and tries < n * 60:
            tries += 1
            x, y = random.uniform(*xr), random.uniform(*yr)
            if n == 18 and abs(x) < 13.6:
                continue
            if plant_bush(x, y, random.uniform(*sr)):
                got += 1

    # ---- flowers out here grow in small drifts, with grass between them
    T = FLOWER_T
    taken = []
    def drift(cx, cy, n, spread, big):
        kinds = random.choice([T["cos"], T["cos"], T["tul"], T["dai"], T["dai"], T["bud"]])
        for _ in range(n):
            for _try in range(12):
                a, d = random.uniform(0, 6.283), spread * math.sqrt(random.random())
                x, y = cx + d * math.cos(a), cy + d * math.sin(a)
                small = kinds is T["dai"]
                r = 0.2 if small else 0.42
                if not clear(x, y, 0.35) or not roomy(x, y, r, taken) or not roomy(x, y, 0.3, shrubs) or not roomy(x, y, 0.2, trees):
                    continue
                if X0 - 0.3 < x < X1 + 0.3 and Y0 - 0.3 < y < Y1:
                    continue                      # the castle garden keeps its own flowers
                taken.append((x, y, r))
                t = random.choice(kinds)
                s_ = random.uniform(1.0, 1.5) * big * (1.25 if small else 1.0)
                inst(t, (x, y, H(x, y) - 0.04), random.uniform(-0.45, 0.45), s_, coll=C_FLO, name="Ext_%s" % t.name)
                if random.random() < 0.3:
                    c = T["clump"][0]
                    inst(c, (x + random.uniform(-0.4, 0.4), y + random.uniform(-0.4, 0.4), H(x, y) - 0.04), random.uniform(0, 6), random.uniform(0.9, 1.3) * big, coll=C_FLO, name="Ext_%s" % c.name)
                break
    for side in (-1, 1):
        y = GY0 + 2.0
        while y < -13.5:                          # beside the walk
            off = hw(y) + random.uniform(0.9, 5.5)
            drift(pc(y) + side * off, y, random.randint(3, 7), random.uniform(0.9, 1.7), 1.0)
            y += random.uniform(3.4, 6.0)
    for _ in range(30):                           # scattered through the meadows and beside the garden
        x, y = random.uniform(-30.5, 30.5), random.uniform(-65.0, 8.0)
        near = 1.0 if abs(x) < 16 else 1.25
        drift(x, y, random.randint(3, 8), random.uniform(1.0, 2.2), near)
    for side in (-1, 1):                          # the front beds carry on sideways
        for _ in range(10):
            drift(side * random.uniform(14.6, 30.0), random.uniform(-13.2, -3.0), random.randint(4, 8), random.uniform(1.2, 2.2), 1.35)

    # ---- cypresses: groups nearby, a scattering over the far hills
    n = 20
    for _ in range(46):
        cx, cy = random.uniform(-31.0, 31.0), random.uniform(-64.0, 12.0)
        if X0 - 1 < cx < X1 + 1 and Y0 - 1 < cy < Y1 + 1:
            continue
        for k in range(random.randint(1, 3)):
            x, y = cx + random.uniform(-1.6, 1.6), cy + random.uniform(-1.6, 1.6)
            s_ = random.uniform(0.95, 1.6)
            if not clear(x, y, 4.5) or not roomy(x, y, 0.75 * s_, trees) or not roomy(x, y, 0.6 * s_, shrubs):
                continue
            trees.append((x, y, 0.6 * s_))
            inst(cyp, (x, y, H(x, y) - 0.1), random.uniform(0, 6), (s_ * 0.85, s_ * 0.85, s_ * random.uniform(0.8, 0.95)),
                 coll=C_TREE, name="Cypress_%d" % n)
            n += 1
    fa, fb = far_tree_template("FarTreeA", ("bloss1", "bloss2", "bloss3", "bloss1")), far_tree_template("FarTreeB", ("bloss3", "bloss1", "bloss2", "bloss3"))
    nf = 0
    for _ in range(560):
        x, y = random.uniform(-125.0, 125.0), random.uniform(-88.0, 118.0)
        if GX0 - 3 < x < GX1 + 3 and GY0 - 3 < y < GY1 + 3:
            if not (y > Y1 + 1.5 and abs(x) < 31):          # the fine ground only gets them behind the castle
                continue
        if abs(x - CX) < 9 and y < 9:
            continue
        dist = math.hypot(x, y + 25)
        if random.random() > min(1.0, 55.0 / (dist + 20.0)):
            continue
        behind = abs(x - CX) < 24 and y > 8         # the castle's own backdrop stays low and quiet
        s_ = random.uniform(1.0, 1.7) * (1.0 + dist / 400.0) * (0.8 if behind else 1.0)
        if not roomy(x, y, 0.8 * s_, trees):
            continue
        trees.append((x, y, 0.8 * s_))
        if random.random() < 0.27 and not behind:
            inst(random.choice((fa, fb)), (x, y, H(x, y) - 0.1), random.uniform(0, 6), s_ * 0.8, coll=C_TREE, name="FarTree%s_%d" % ("A", nf))
            nf += 1
        else:
            inst(cyp, (x, y, H(x, y) - 0.1), random.uniform(0, 6), (s_ * 0.85, s_ * 0.85, s_ * random.uniform(0.8, 0.95)),
                 coll=C_TREE, name="Cypress_%d" % n)
            n += 1


# ================================================================ lamp posts
LAMPS = []          # lantern centres (x, y, z): the web export bakes their night light and adds a glow


def lantern(mb, M):
    """A four-sided lantern hanging from (or standing under) its top point at the origin of M."""
    q = math.pi / 4
    mb.lathe([(-0.2, 0.235), (-0.05, 0.06), (0.03, 0.0)], 4, "post_dark", M=M, phase=q)
    mb.lathe([(-0.235, 0.2), (-0.2, 0.2)], 4, "post_dark", M=M, phase=q)
    mb.lathe([(-0.62, 0.115), (-0.235, 0.18)], 4, "lamp", M=M, phase=q)
    mb.lathe([(-0.7, 0.05), (-0.66, 0.135), (-0.62, 0.135)], 4, "post_dark", M=M, phase=q)
    for k in range(4):                           # the four corner bars of the cage
        a0 = q + k * math.pi / 2
        lo_, hi_ = Vector((0.118 * math.cos(a0), 0.118 * math.sin(a0), -0.62)), Vector((0.183 * math.cos(a0), 0.183 * math.sin(a0), -0.235))
        d = hi_ - lo_
        Mq = Matrix.Translation((lo_ + hi_) / 2) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        mb.box((0.03, 0.03, d.length), (0, 0, 0), "post_dark", M=M @ Mq)
    return M @ Vector((0, 0, -0.43))


def lamp_post(mb, x, y, face, kind, s=1.15):
    """A wooden post with a lantern. kind 0: the lantern hangs from an arm that points along `face`;
    kind 1: the lantern stands on top of the post."""
    T = tr(x, y, H(x, y) - 0.06) @ rot_z(face) @ Matrix.Scale(s, 4)
    q = math.pi / 4
    top = 3.05 if kind == 0 else 2.55
    mb.lathe([(0, 0.25), (0.36, 0.25), (0.5, 0.15), (0.62, 0.125)], 4, "post_dark", M=T, phase=q)
    mb.lathe([(0.62, 0.105), (top, 0.08)], 4, "post", M=T, phase=q)
    mb.lathe([(1.3, 0.118), (1.4, 0.118)], 4, "post_dark", M=T, phase=q)
    if kind == 0:
        mb.lathe([(top, 0.1), (top + 0.05, 0.1), (top + 0.2, 0.0)], 4, "post_dark", M=T, phase=q)
        mb.box((1.0, 0.09, 0.09), (0.36, 0, top - 0.2), "post", M=T)
        mb.box((0.62, 0.07, 0.07), (0.3, 0, top - 0.47), "post_dark", rot=Euler((0, -math.pi / 4, 0)), M=T)
        mb.box((0.03, 0.03, 0.16), (0.7, 0, top - 0.325), "post_dark", M=T)
        head = lantern(mb, T @ tr(0.7, 0, top - 0.4))
    else:
        mb.lathe([(top, 0.16), (top + 0.06, 0.16)], 4, "post_dark", M=T, phase=q)
        head = lantern(mb, T @ tr(0, 0, top + 0.76))
    LAMPS.append(tuple(round(v, 3) for v in head))


def build_lamps():
    """Lamp posts here and there along the walk, a pair where the garden begins and a pair at the gates.
    Each one stands just off the paving, clear of bushes and trees; flowers make room for it."""
    lm = MB("Lamps")
    solid = [(o.location.x, o.location.y, (0.95 if o.name.startswith(("GBush_", "Bush_")) else 0.55) * o.scale.x)
             for o in C_TREE.objects if o.location.z > -40 and o.name.startswith(("GBush_", "Bush_", "BlossomTree_", "Cypress_"))]
    #        (y, side, kind)
    spots = [(-62.0, -1, 0), (-54.5, 1, 1), (-47.0, -1, 0), (-39.0, 1, 0), (-31.5, -1, 1), (-24.0, 1, 0),
             (-16.5, -1, 0), (-9.0, 1, 1), (-9.0, -1, 0)]
    for y0, side, kind in spots:
        for dy in (0.0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8, 3.5, -3.5):
            y = y0 + dy
            x = pc(y) + side * (hw(y) + 1.3)      # well off the paving: the camera never brushes past a lantern
            if all((x - ox) ** 2 + (y - oy) ** 2 >= (0.6 + orr) ** 2 for ox, oy, orr in solid):
                break
        lamp_post(lm, x, y, math.pi if side > 0 else 0.0, kind)
    for side in (-1, 1):                         # flanking the gates
        lamp_post(lm, CX + side * 2.12, -0.62, -math.pi / 2, 1, s=1.0)
    for o in list(C_FLO.objects):                # no flower grows through a post
        if o.location.z > -40 and any((o.location.x - lx) ** 2 + (o.location.y - ly) ** 2 < 0.55 ** 2 for lx, ly, _z in LAMPS):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(C_TREE.objects):               # ... and no bush stands where the gate lamps do
        if o.name.startswith(("GBush_", "Bush_")) and any(abs(lx - CX) < 3 and ly > -2 and (o.location.x - lx) ** 2 + (o.location.y - ly) ** 2 < (0.5 + 0.95 * o.scale.x) ** 2 for lx, ly, _z in LAMPS):
            bpy.data.objects.remove(o, do_unlink=True)
    return lm.build(coll=C_CAS)


# ================================================================ build all
build_terrain()
build_path()
castle = build_castle()

blossom_tree("BlossomTree_L", -10.3, -4.2, 1.0, 26)
blossom_tree("BlossomTree_R", 11.3, -4.0, 1.0, 26)
blossom_tree("BlossomTree_ML", -5.6, -1.9, 0.42, 6)
blossom_tree("BlossomTree_MR", 8.3, -0.4, 0.36, 6)
blossom_tree("BlossomTree_BL", -8.6, 1.4, 0.34, 5)
blossom_tree("BlossomTree_BR", 12.2, 2.5, 0.38, 5)
for i, (x, y, s) in enumerate([(-6.9, -0.7, 0.9), (-4.4, -1.2, 0.7), (7.3, -1.4, 0.85), (-9.6, -0.2, 0.7), (10.0, -0.9, 0.75),
                               (-3.2, -1.25, 0.55), (5.0, -1.2, 0.6)]):
    bush("Bush_%d" % i, x, y, s)
cyp = cypress_template("Cypress")
for i, (x, y, s) in enumerate([(-8.0, 2.6, 1.25), (-6.9, 3.6, 1.0), (-9.9, 3.6, 1.45), (-12.3, 2.2, 1.2), (-13.0, -1.2, 1.0),
                               (-11.4, 0.9, 0.9), (8.6, 2.8, 1.3), (9.9, 4.0, 1.5), (11.3, 3.0, 1.1), (13.1, 0.6, 1.05),
                               (12.6, 4.6, 1.3), (7.6, 4.2, 1.0), (-4.2, 7.4, 1.7), (-6.4, 6.6, 1.4), (5.6, 7.6, 1.75),
                               (7.8, 6.6, 1.35), (-12.6, 6.5, 1.5), (13.0, 7.2, 1.45), (-9.5, 7.5, 1.6), (10.3, 7.8, 1.6)]):
    inst(cyp, (x, y, H(x, y) - 0.1), random.uniform(0, 6), (s * 0.85, s * 0.85, s * random.uniform(0.8, 0.95)),
         coll=C_TREE, name="Cypress_%d" % i)
OCC += [(-10.3, -4.2, 0.9), (11.3, -4.0, 0.9), (-5.6, -1.9, 0.5), (8.3, -0.4, 0.5)]
build_flowers()
build_sky()
separate_random(build_countryside, 2029)
separate_random(build_lamps, 2031)
separate_random(build_butterflies, 2030)

# ---------------------------------------------------------------- light + camera
sd = bpy.data.lights.new("Sun", "SUN")
sd.energy = 1.35; sd.color = (1.0, 0.95, 0.9); sd.angle = math.radians(26)
sun = bpy.data.objects.new("Sun", sd)
sun.rotation_euler = Vector((0.42, 0.57, -0.71)).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(sun)
gradient_world(scene, "SkyPink", top="#F9D1DA", bottom="#FCE2E6", ambient="#FFF3F1", strength=0.74)
setup_render(scene)
set_cam(scene, (0.3, -72.8, 28.2), (0.3, -1.5, 5.0), 72)
result = {"objects": len(bpy.data.objects), "meshes": len(bpy.data.meshes),
          "tris": sum(len(m.polygons) for m in bpy.data.meshes)}
