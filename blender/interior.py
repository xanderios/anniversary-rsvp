# Interior: the party hall inside the castle, modelled on the photo of the real party set
# (referencias/): a white proscenium, a warm alcove with a row of ceiling spots, glossy cream
# tiles, a pale pink rug with a wavy front edge, the castle backdrop, balloon columns, the cake.
# Run after common.py + exterior.py – lives in its own scene "Interior". The web export bakes
# this scene's light (Cycles) into vertex colours, so the lights below are what the site shows.
random.seed(5)
PAL.update({
    "h_frame": "#FFFBF6", "h_wall": "#F1E0CB", "h_floor": "#E2D3C1", "h_rug": "#F8D6D8", "h_rug_line": "#E9AFBA",
    "h_castle": "#FBEFE2", "h_roof": "#F2B1C0", "h_drape": "#F7C6CD", "h_gold": "#DDB25E",
    "h_glow": "#FFD88A", "h_spot": "#FFF0CF", "h_niche": "#FFE3B4",
    "ped_pink": "#F8D0D5", "ped_stripe": "#F3BFC7", "ped_white": "#FFF9F4", "ped_white_stripe": "#F6EADF",
    "cake": "#FFF8F2", "sweet": "#F3A9B8", "bow": "#F2AFBE",
    "rose1": "#F6BECB", "rose2": "#FFF3E8", "rose3": "#FBD9DE", "green_in": "#A5B784",
    "balloon1": "#F4AEBB", "balloon2": "#FBE8DA", "balloon3": "#F9CFD4", "balloon4": "#EE9FB0", "balloon5": "#FFF7F1",
})
EMIT.update({"h_glow": 2.4, "h_spot": 5.0, "h_niche": 1.4})
_old = bpy.data.scenes.get("Interior")
if _old:
    bpy.data.scenes.remove(_old)
sc = bpy.data.scenes.new("Interior")
C_ROOM = coll("Room", sc); C_PARTY = coll("Party", sc)

XA, YF, YB, ZC = 10.4, 0.0, 6.4, 10.4      # alcove: half width, front plane, back wall, ceiling
XR, YS = 11.2, -0.5                         # rug apron: half width, where it leaves the proscenium
_K = {"low": 0.62, "medium": 1.0, "high": 1.5}[LOD]


def sg(n):
    """Segments of a round shape at this level of detail (always even)."""
    return max(6, 2 * int(round(n * _K / 2)))


def rug_front(x):
    return -4.75 - 0.45 * math.cos(2 * math.pi * x / XR)


def build_room():
    # ---- proscenium (white frame in front) and the alcove behind it
    sh = MB("Shell")
    for sx in (-1, 1):
        sh.box((34, 0.5, 30), (sx * (XA + 17), YF - 0.25, 15), "h_frame")
    sh.box((2 * XA, 0.5, 30 - ZC), (0, YF - 0.25, ZC + (30 - ZC) / 2), "h_frame")
    sh.build(coll=C_ROOM)

    al = MB("Alcove")
    al.box((2 * XA + 1, 0.4, ZC + 0.4), (0, YB + 0.2, (ZC + 0.4) / 2), "h_wall")
    for sx in (-1, 1):
        al.box((0.5, YB - YF, ZC + 0.4), (sx * (XA + 0.25), (YF + YB) / 2, (ZC + 0.4) / 2), "h_wall")
    al.box((2 * XA, YB - YF, 0.4), (0, (YF + YB) / 2, ZC + 0.2), "h_wall")
    for k in range(-3, 4):                       # the row of recessed spots
        al.lathe([(ZC - 0.04, 0.3), (ZC + 0.05, 0.3)], sg(12), "h_spot", M=tr(k * 2.9, 1.7, 0))
    al.build(coll=C_ROOM)

    # ---- floor: one sheet, finely divided where the light falls (its tiles are drawn by the web shader)
    def axis(lo, flo, fhi, hi, cell, coarse=3.2):
        pts = [flo + cell * k for k in range(int(round((fhi - flo) / cell)) + 1)]
        x = flo
        while x > lo + 1e-6:
            x = max(lo, x - coarse); pts.insert(0, x)
        x = pts[-1]
        while x < hi - 1e-6:
            x = min(hi, x + coarse); pts.append(x)
        return pts
    cell = Q_HALL_CELL
    fl = MB("Floor")
    xs, ys = axis(-46.0, -13.2, 13.2, 46.0, cell), axis(-30.0, -13.0, YF - 0.5, YF - 0.5, cell)
    for y0, y1 in zip(ys, ys[1:]):
        for x0, x1 in zip(xs, xs[1:]):
            fl.poly([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], "h_floor")
    fl.build(coll=C_ROOM)

    # ---- rug: wall to wall inside, an apron with a wavy front outside; one sheet, nothing overlapping
    E = [(-XR, YS - 0.3 * k) for k in range(int((YS - (rug_front(-XR) + 0.7)) / 0.3) + 1)]
    rc = 0.7
    cx, cy = -XR + rc, rug_front(-XR + rc) + rc
    E += [(cx - rc * math.cos(math.pi / 2 * i / 6), cy - rc * math.sin(math.pi / 2 * i / 6)) for i in range(0, 7)]
    n = int((XR - rc) / 0.3)
    E += [(-XR + rc + (XR - rc) * i / n, rug_front(-XR + rc + (XR - rc) * i / n)) for i in range(1, n + 1)]   # ... to the middle
    E += [(-x, y) for x, y in reversed(E[:-1])]                                                              # and mirrored
    E = [Vector(p) for p in E]

    def inset(pts, d):
        out = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            nrm = Vector((-t.y, t.x))               # left of the direction of travel = inside
            if i in (0, len(pts) - 1):
                nrm = Vector((1.0 if p.x < 0 else -1.0, 0.0))
            out.append(p + nrm * d)
        return out
    E1, E2 = inset(E, 0.24), inset(E, 0.32)
    zt = 0.06
    rg = MB("Rug")
    for a, b, key in ((E, E1, "h_rug"), (E1, E2, "h_rug_line")):
        for i in range(len(E) - 1):
            rg.poly([(a[i].x, a[i].y, zt), (a[i + 1].x, a[i + 1].y, zt), (b[i + 1].x, b[i + 1].y, zt), (b[i].x, b[i].y, zt)], key)
    for i in range(len(E) - 1):                    # the rim
        rg.poly([(E[i].x, E[i].y, 0), (E[i + 1].x, E[i + 1].y, 0), (E[i + 1].x, E[i + 1].y, zt), (E[i].x, E[i].y, zt)], "h_rug")
    rg.poly([(p.x, p.y, zt) for p in E2] + [(XA, YS, zt), (XA, YB, zt), (-XA, YB, zt), (-XA, YS, zt)], "h_rug")
    rg.build(coll=C_ROOM)


def mini_tower(mb, x, y, r, h, roof_h, wins=()):
    seg = sg(16)
    ph = -math.pi / 2 - math.pi / seg
    T = tr(x, y, 0)
    mb.lathe([(0, r), (h - 0.22, r), (h - 0.04, r * 1.2), (h + 0.2, r * 1.2)], seg, "h_castle", M=T, phase=ph, smooth=True)
    rin = r * 1.2 * math.cos(math.pi / seg)
    fw = 2 * r * 1.2 * math.sin(math.pi / seg)
    for k in range(seg):
        if k % 2:
            continue
        ang = ph + 2 * math.pi * (k + 0.5) / seg
        mb.box((fw * 0.8, 0.16, 0.22), (0, -(rin - 0.08), h + 0.31), "h_castle", M=T @ rot_z(ang + math.pi / 2))
    dh = 0.7 * r + 0.3
    mb.lathe([(h + 0.2, r * 0.84), (h + 0.2 + dh, r * 0.84)], seg, "h_castle", M=T, phase=ph, smooth=True)
    zr = h + 0.2 + dh
    mb.lathe([(zr - 0.08, r * 1.1), (zr, r * 1.3), (zr + 0.07, r * 1.3), (zr + roof_h, 0.03)], seg, "h_roof", M=T, phase=ph, smooth=True)
    top = zr + roof_h
    mb.ico(0.08, (x, y, top + 0.04), "h_gold")
    mb.lathe([(top, 0.02), (top + 0.62, 0.02)], 4, "h_gold", M=T)
    for flip in (False, True):                     # a little golden pennant, seen from both sides
        tri = [(x, y, top + 0.62), (x + 0.5, y, top + 0.5), (x, y, top + 0.38)]
        mb.poly(list(reversed(tri)) if flip else tri, "h_gold")
    r_in = r * math.cos(math.pi / seg)
    for zf, w_, hr_ in wins:
        window(mb, T @ tr(0, -r_in, zf), w_, hr_, key="h_glow")
    window(mb, T @ tr(0, -r * 0.84 * math.cos(math.pi / seg) + 0.035, h + 0.2 + dh * 0.25), 0.1 * r + 0.04, dh * 0.3, frame=False, key="h_glow")


def build_backdrop():
    c = MB("CastleBackdrop")
    y = 5.0
    c.box((18.4, 0.7, 2.5), (0, y + 0.4, 1.25), "h_castle")
    n = 26
    for k in range(n + 1):
        x = -9.0 + 18.0 * k / n
        if abs(x) < 2.75:
            continue
        c.box((0.36, 0.3, 0.28), (x, y + 0.2, 2.64), "h_castle")
    for x in (-7.0, -4.3, 4.3, 7.0):
        window(c, tr(x, y + 0.05, 1.05), 0.21, 0.42, key="h_glow")
    # central gatehouse with an arched niche
    W, GH, a, hr = 2.65, 4.65, 1.45, 2.05
    outline = ([(-W, 0), (-a, 0), (-a, hr)]
               + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
               + [(a, hr), (a, 0), (W, 0), (W, GH), (-W, GH)])
    c.prism(outline, 0.6, "h_castle", M=tr(0, y - 0.2, 0))
    c.poly([(-a, y + 0.38, 0), (a, y + 0.38, 0), (a, y + 0.38, hr + a), (-a, y + 0.38, hr + a)], "h_drape")
    c.poly([(-a * 0.62, y + 0.37, 0), (a * 0.62, y + 0.37, 0), (a * 0.62, y + 0.37, hr * 0.7), (-a * 0.62, y + 0.37, hr * 0.7)], "h_niche")
    b = 0.24
    sur = ([(a, 0), (a + b, 0), (a + b, hr)]
           + [((a + b) * math.cos(math.pi * i / 10), hr + (a + b) * math.sin(math.pi * i / 10)) for i in range(1, 10)]
           + [(-(a + b), hr), (-(a + b), 0), (-a, 0), (-a, hr)]
           + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
           + [(a, hr)])
    c.prism(sur, 0.1, "ped_white", M=tr(0, y - 0.3, 0))
    for k in range(7):
        x = -2.35 + 4.7 * k / 6
        c.box((0.32, 0.3, 0.26), (x, y - 0.03, GH + 0.13), "h_castle")
    for x in (-2.0, 2.0):
        window(c, tr(x, y - 0.2, 2.4), 0.18, 0.52, key="h_glow")
    gw, g1, g2 = 1.3, 0.85, 2.05
    c.prism([(-gw, 0), (gw, 0), (gw, g1), (0, g2), (-gw, g1)], 0.5, "h_castle", M=tr(0, y - 0.1, GH))
    beta = math.atan2(g2 - g1, gw); L = math.hypot(gw, g2 - g1)
    for sx in (-1, 1):
        along = Vector((sx * math.cos(beta), 0, -math.sin(beta)))
        nrm = Vector((sx * math.sin(beta), 0, math.cos(beta)))
        cc = Vector((sx * gw / 2, y + 0.12, GH + (g1 + g2) / 2)) + nrm * 0.07 + along * 0.1
        c.box((L + 0.36, 0.7, 0.13), cc, "h_roof", rot=Euler((0, sx * beta, 0)))
    window(c, tr(0, y - 0.1, GH + 0.38), 0.26, 0.45, key="h_glow")
    for x, yy, r_, h, rh, wins in (
            (0.0, 5.75, 0.9, 5.75, 2.4, [(5.3, 0.15, 0.28)]),
            (-3.3, 5.3, 0.84, 5.0, 2.05, [(3.8, 0.16, 0.34), (2.2, 0.14, 0.3)]),
            (3.3, 5.3, 0.84, 5.0, 2.05, [(3.8, 0.16, 0.34), (2.2, 0.14, 0.3)]),
            (-1.7, 5.7, 0.64, 5.3, 1.75, []), (1.7, 5.7, 0.64, 5.3, 1.75, []),
            (-5.6, 5.2, 0.86, 4.0, 2.05, [(3.15, 0.16, 0.32)]), (5.6, 5.2, 0.86, 4.0, 2.05, [(3.15, 0.16, 0.32)]),
            (-8.5, 5.1, 0.96, 3.15, 2.15, [(2.3, 0.17, 0.34)]), (8.5, 5.1, 0.96, 3.15, 2.15, [(2.3, 0.17, 0.34)])):
        mini_tower(c, x, yy, r_, h, rh, wins=wins)
    c.build(coll=C_PARTY)


def bouquet(mb, cx, cy, cz, R, n, leaves=7):
    for _ in range(n):
        d = Vector((random.uniform(-1, 1), random.uniform(-1, 0.6), random.uniform(-0.25, 1))).normalized()
        p = Vector((cx, cy, cz)) + Vector((d.x * R, d.y * R * 0.8, d.z * R * 0.85))
        mb.ico(random.uniform(0.2, 0.33) * R + 0.05, p, random.choice(["rose1", "rose2", "rose3", "rose1"]), sub=1,
               rot=Euler((random.uniform(0, 3), random.uniform(0, 3), 0)))
    for _ in range(leaves):
        d = Vector((random.uniform(-1, 1), random.uniform(-1, 0.2), random.uniform(-0.2, 0.9))).normalized()
        Mq = Matrix.Translation(Vector((cx, cy, cz)) + d * R * 0.8) @ d.to_track_quat("Y", "Z").to_matrix().to_4x4()
        l, w = R * 0.5, R * 0.17
        for flip in (False, True):                 # leaves are seen from both sides
            for tri, key in (([(0, 0, 0), (w, 0.45 * l, 0.04), (0, l, 0)], "green_in"), ([(0, 0, 0), (0, l, 0), (-w, 0.45 * l, 0.04)], "leaf2")):
                mb.poly(list(reversed(tri)) if flip else tri, key, M=Mq)


def stand(mb, x, y, z, s=1.0):
    T = tr(x, y, z) @ Matrix.Scale(s, 4)
    mb.lathe([(0, 0.24), (0.04, 0.24), (0.07, 0.05), (0.3, 0.04), (0.33, 0.34), (0.37, 0.34)], sg(14), "h_gold", M=T, smooth=True)
    for k in range(7):
        a0 = 2 * math.pi * k / 7
        mb.ico(0.075, (0.2 * math.cos(a0), 0.2 * math.sin(a0), 0.44), "sweet" if k % 2 else "cake", M=T)
    mb.ico(0.08, (0, 0, 0.5), "sweet", M=T)


def pedestal(mb, x, y, r, h, key="ped_pink", flutes=True):
    T = tr(x, y, 0)
    if flutes:                                     # pleated: every other flat is a shade deeper
        seg = sg(28)
        bm, new, faces = mb.bm, [], []
        ring = [[bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)] for z in (0.06, h - 0.06)]
        for k in range(seg):
            k2 = (k + 1) % seg
            f = bm.faces.new((ring[0][k], ring[0][k2], ring[1][k2], ring[1][k]))
            faces.append((f, k))
        mb._finish(ring[0] + ring[1], [f for f, _ in faces], key, T)
        i2 = mb._mi("ped_stripe" if key == "ped_pink" else "ped_white_stripe")
        for f, k in faces:
            if k % 2:
                f.material_index = i2
    else:
        mb.lathe([(0.06, r), (h - 0.06, r)], sg(28), key, M=T, smooth=True)
    mb.lathe([(0, r * 1.03), (0.06, r * 1.03)], sg(20), "h_gold", M=T)
    mb.lathe([(h - 0.06, r * 1.03), (h, r * 1.03)], sg(20), "h_gold" if key == "ped_pink" else "ped_white", M=T)
    mb.lathe([(h, r * 0.97), (h + 0.02, r * 0.97)], sg(20), "ped_white", M=T)


def balloon(mb, r, p, key, tilt):
    """A faceted balloon: a pear-shaped body and a little knot (referencias: low-poly balloons)."""
    res = bmesh.ops.create_icosphere(mb.bm, subdivisions=2, radius=r)
    verts = res["verts"]
    for v in verts:
        t = v.co.z / r                               # -1 at the knot .. 1 on top
        pinch = 1.0 - 0.3 * max(0.0, -t) ** 1.6
        v.co.x *= pinch; v.co.y *= pinch
        v.co.z *= 1.12 if t > 0 else 1.2
    faces = list({f for v in verts for f in v.link_faces})
    M = Matrix.Translation(p) @ tilt.to_matrix().to_4x4()
    mb._finish(verts, faces, key, M)
    mb.lathe([(-1.33 * r, 0.085 * r + 0.02), (-1.17 * r, 0.03 * r)], 5, key, M=M)


def balloon_column(name, cx, cy, n, seed):
    """n balloons piled into a column from the floor to near the ceiling. No two overlap: each new
    one settles into the lowest free spot beside the ones already there."""
    rnd = random.Random(seed)
    sizes = [0.82, 0.55, 0.7, 0.45, 0.62, 0.4, 0.76, 0.5, 0.58, 0.42]
    sx = 1 if cx > 0 else -1
    blocked = [(sx * 7.2, 0.7, 1.2, 2.95), (sx * 9.3, -1.6, 1.05, 2.95)]      # (x, y, radius, top) of the set pieces nearby
    keys = ["balloon1", "balloon2", "balloon3", "balloon4", "balloon1", "balloon5", "balloon3", "balloon2"]
    placed = []
    b = MB(name)
    order = sorted((sizes[i % len(sizes)] for i in range(n)), reverse=True)      # big ones first, small ones fill the gaps
    for i in range(n):
        r = order[i]
        best = None
        for _ in range(3000):
            x, y = cx + rnd.uniform(-1.25, 1.0), cy + rnd.uniform(-0.95, 0.95)
            z = rnd.uniform(1.3 * r + 0.08, 9.6 - 1.2 * r)
            if any((x - px) ** 2 + (y - py) ** 2 + ((z - pz) / 1.14) ** 2 < (r + pr + 0.05) ** 2 for px, py, pz, pr in placed):
                continue
            if abs(x) + r > XA - 0.06:                # clear of the alcove wall
                continue
            if any(z - 1.35 * r < top and (x - ox) ** 2 + (y - oy) ** 2 < (orad + r) ** 2 for ox, oy, orad, top in blocked):
                continue
            if best is None or z < best[2]:
                best = (x, y, z)
        if best is None:
            continue
        placed.append((best[0], best[1], best[2], r))
        balloon(b, r, best, keys[i % len(keys)], Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.283))))
    return b.build(coll=C_PARTY), len(placed)


N_BALLOONS = 21      # per column: half of the 42 the hall used to have, and none of them overlap


def build_party():
    p = MB("PartyTable")
    # centre table + cake
    pedestal(p, 0, -0.6, 2.0, 1.45, key="ped_white")
    zt = 1.45
    p.lathe([(zt + 0.02, 1.05), (zt + 0.09, 1.05)], sg(20), "h_gold", M=tr(0, -0.6, 0))
    for r_, z0, h in ((0.82, zt + 0.09, 0.55), (0.6, zt + 0.64, 0.5), (0.4, zt + 1.14, 0.45)):
        p.lathe([(z0, r_), (z0 + h, r_)], sg(28), "cake", M=tr(0, -0.6, 0), smooth=True)
        for k in range(8):                          # little bows around every tier
            a0 = 2 * math.pi * (k + 0.5) / 8
            Mb = tr(r_ * math.cos(a0), -0.6 + r_ * math.sin(a0), z0 + h * 0.55) @ rot_z(a0 + math.pi / 2)
            for sx in (-1, 1):
                p.ico(0.05, (sx * 0.06, 0, 0), "bow", scale=(1.3, 0.6, 0.9), M=Mb)
            p.ico(0.032, (0, 0, 0), "sweet", M=Mb)
    zc = zt + 1.59
    p.lathe([(zc, 0.12), (zc + 0.25, 0.12)], 8, "h_castle", M=tr(0, -0.6, 0))
    p.lathe([(zc + 0.25, 0.17), (zc + 0.55, 0.0)], 8, "h_roof", M=tr(0, -0.6, 0))
    # side pedestals (mirrored)
    for sx in (-1, 1):
        p.box((1.15, 1.15, 1.25), (sx * 3.0, -1.1, 0.625), "ped_white")
        stand(p, sx * 3.0, -1.1, 1.25, 1.3)
        pedestal(p, sx * 4.3, -2.0, 0.7, 0.95)
        stand(p, sx * 4.3, -2.0, 0.97, 1.2)
        pedestal(p, sx * 4.55, 0.3, 0.75, 1.7, key="ped_white", flutes=False)
        stand(p, sx * 4.55, 0.3, 1.72, 1.25)
        p.box((1.0, 1.0, 1.55), (sx * 6.05, -1.0, 0.775), "ped_white")
        stand(p, sx * 6.05, -1.0, 1.55, 1.2)
        pedestal(p, sx * 7.2, 0.7, 0.8, 2.0)
        stand(p, sx * 7.2, 0.7, 2.02, 1.3)
        pedestal(p, sx * 7.6, -2.3, 0.75, 1.3)
        stand(p, sx * 7.6, -2.3, 1.32, 1.1)
        pedestal(p, sx * 9.3, -1.6, 0.8, 1.5)
    p.build(coll=C_PARTY)

    f = MB("Flowers")
    for sx in (-1, 1):
        # tall urn arrangements flanking the cake
        f.lathe([(0, 0.34), (0.1, 0.34), (0.22, 0.13), (0.5, 0.11), (0.95, 0.42), (1.35, 0.5), (1.45, 0.44)], sg(10),
                "ped_white", M=tr(sx * 3.5, 2.6, 0) @ Matrix.Scale(1.3, 4))
        bouquet(f, sx * 3.7, 2.6, 2.95, 1.15, 40, 6)
        bouquet(f, sx * 2.5, -3.1, 0.6, 0.8, 24, 5)        # floor arrangements
        bouquet(f, sx * 9.3, -1.6, 2.05, 0.75, 22, 4)         # outer pedestals
        bouquet(f, sx * 5.6, -3.3, 0.4, 0.5, 12, 3)
    f.build(coll=C_PARTY)

    counts = [balloon_column("Balloons_L" if sx < 0 else "Balloons_R", sx * 9.0, 0.95, N_BALLOONS, 71 + sx)[1] for sx in (-1, 1)]
    if min(counts) < N_BALLOONS:
        raise RuntimeError("could not place every balloon: %s" % counts)


Q_HALL_CELL = {"low": 0.62, "medium": 0.36, "high": 0.22}[LOD]
build_room()
build_backdrop()
build_party()

# ---------------------------------------------------------------- light (baked for the web)
def _light(name, kind, loc, energy, color, aim=None, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy; ld.color = color
    for k, v in kw.items():
        setattr(ld, k, v)
    lo = bpy.data.objects.new(name, ld); lo.location = loc
    if aim is not None:
        lo.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo)
    return lo


_light("Key", "AREA", (0, -15, 6.5), 4200, (1.0, 0.95, 0.9), aim=(0, 3, 4.5), size=16)            # soft, from the room
_light("Fill", "AREA", (0, -3, 9.6), 70, (1.0, 0.94, 0.88), aim=(0, 1, 2), size=12)
for k in range(-3, 4):                                                                          # ceiling spots
    _light("Spot_%d" % (k + 3), "SPOT", (k * 2.9, 1.7, ZC - 0.1), 100, (1.0, 0.86, 0.66), aim=(k * 2.9, 2.3, 0),
           spot_size=math.radians(150), spot_blend=1.0, shadow_soft_size=0.3)
for i, (x, energy, w) in enumerate(((-6.6, 110, 3.4), (6.6, 110, 3.4), (-2.9, 60, 2.2), (2.9, 60, 2.2))):   # washers on the floor behind the castle
    _light("Wash_%d" % i, "AREA", (x, 6.05, 0.25), energy, (1.0, 0.74, 0.46), aim=(x, 6.25, 6.0), shape="RECTANGLE", size=w, size_y=0.4)
_light("Niche", "POINT", (0, 4.9, 1.6), 26, (1.0, 0.78, 0.52), shadow_soft_size=0.5)                                 # the glow behind the cake
gradient_world(sc, "HallWarm", top="#FBF2E8", bottom="#FBF2E8", ambient="#FFF1E4", strength=0.3)
setup_render(sc)
set_cam(sc, (0, -18.6, 3.9), (0, 3, 3.8), 30)
result = {"interior_objects": len(sc.objects)}
