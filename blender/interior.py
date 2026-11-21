# Interior: party hall inside the castle (balloons, sweets table, cake, castle backdrop).
# Run after common.py + exterior.py – lives in its own scene "Interior".
random.seed(5)
PAL.update({"in_castle": "#FCEEE4", "in_castle_d": "#F6DDD2", "in_roof": "#F4B4BE", "drape": "#F8CBCB",
            "rug_line": "#EFB9BE", "sweet": "#F6AEBB"})
_old = bpy.data.scenes.get("Interior")
if _old:
    bpy.data.scenes.remove(_old)
sc = bpy.data.scenes.new("Interior")
C_ROOM = coll("Room", sc); C_PARTY = coll("Party", sc)


def mini_tower(mb, x, y, r, h, roof_h, seg=16, wins=()):
    ph = -math.pi / 2 - math.pi / seg
    T = tr(x, y, 0)
    mb.lathe([(0, r), (h - 0.22, r), (h - 0.04, r * 1.2), (h + 0.2, r * 1.2)], seg, "in_castle", M=T, phase=ph, smooth=True)
    rin = r * 1.2 * math.cos(math.pi / seg)
    fw = 2 * r * 1.2 * math.sin(math.pi / seg)
    for k in range(seg):
        if k % 2:
            continue
        ang = ph + 2 * math.pi * (k + 0.5) / seg
        mb.box((fw * 0.8, 0.16, 0.22), (0, -(rin - 0.08), h + 0.31), "in_castle", M=T @ rot_z(ang + math.pi / 2))
    dh = 0.7 * r + 0.3
    mb.lathe([(h + 0.2, r * 0.84), (h + 0.2 + dh, r * 0.84)], seg, "in_castle", M=T, phase=ph, smooth=True)
    zr = h + 0.2 + dh
    mb.lathe([(zr - 0.08, r * 1.1), (zr, r * 1.3), (zr + 0.07, r * 1.3), (zr + roof_h, 0.03)], seg, "in_roof", M=T, phase=ph, smooth=True)
    top = zr + roof_h
    mb.ico(0.08, (x, y, top + 0.04), "gold")
    mb.lathe([(top, 0.018), (top + 0.6, 0.018)], 4, "gold", M=T)
    mb.poly([(x, y, top + 0.6), (x + 0.5, y, top + 0.48), (x, y, top + 0.36)], "gold")
    r_in = r * math.cos(math.pi / seg)
    for zf, w_, hr_ in wins:
        window(mb, T @ tr(0, -r_in, zf), w_, hr_)
    window(mb, T @ tr(0, -r * 0.84 * math.cos(math.pi / seg), h + 0.2 + dh * 0.25), 0.1 * r + 0.04, dh * 0.3, frame=False)


def build_room():
    r = MB("Room")
    r.box((70, 70, 0.2), (0, 0, -0.1), "in_floor")
    r.box((34, 0.4, 13), (0, 6.4, 6.0), "in_wall")
    for sx in (-1, 1):
        r.box((2.4, 13, 13), (sx * 12.4, 0, 6.0), "ped_white")
    r.box((27, 13, 0.7), (0, 0, 9.85), "ped_white")
    for x in (-9, -6, -3, 0, 3, 6, 9):
        r.lathe([(0, 0.0), (0, 0.28)], 10, "glow_soft", M=tr(x, 1.5, 9.49))
    # rug with a rounded front
    r.box((19, 9.5, 0.05), (0, 0.4, 0.025), "in_rug")
    r.lathe([(0, 5.2), (0.05, 5.2)], 28, "in_rug", M=tr(0, -3.9, 0) @ Matrix.Diagonal((1, 0.42, 1, 1)))
    r.box((18.2, 0.07, 0.06), (0, -4.0, 0.03), "rug_line")
    r.build(coll=C_ROOM)


def build_backdrop():
    c = MB("CastleBackdrop")
    y = 5.0
    c.box((15.2, 0.7, 2.3), (0, y + 0.4, 1.15), "in_castle")
    n = 22
    for k in range(n + 1):
        x = -7.4 + 14.8 * k / n
        if abs(x) < 2.4:
            continue
        c.box((0.34, 0.3, 0.26), (x, y + 0.2, 2.43), "in_castle")
    for x in (-6.4, -4.9, 4.9, 6.4):
        window(c, tr(x, y + 0.05, 0.95), 0.2, 0.4)
    # central gatehouse with arched niche
    W, GH, a, hr = 2.3, 4.3, 1.3, 1.9
    outline = ([(-W, 0), (-a, 0), (-a, hr)]
               + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
               + [(a, hr), (a, 0), (W, 0), (W, GH), (-W, GH)])
    c.prism(outline, 0.6, "in_castle", M=tr(0, y - 0.2, 0))
    c.poly([(-a, y + 0.38, 0), (a, y + 0.38, 0), (a, y + 0.38, hr + a), (-a, y + 0.38, hr + a)], "drape")
    b = 0.22
    sur = ([(a, 0), (a + b, 0), (a + b, hr)]
           + [((a + b) * math.cos(math.pi * i / 10), hr + (a + b) * math.sin(math.pi * i / 10)) for i in range(1, 10)]
           + [(-(a + b), hr), (-(a + b), 0), (-a, 0), (-a, hr)]
           + [(a * math.cos(math.pi * (1 - i / 10)), hr + a * math.sin(math.pi * (1 - i / 10))) for i in range(1, 10)]
           + [(a, hr)])
    c.prism(sur, 0.1, "ped_white", M=tr(0, y - 0.3, 0))
    for k in range(7):
        x = -2.05 + 4.1 * k / 6
        c.box((0.3, 0.3, 0.24), (x, y - 0.03, GH + 0.12), "in_castle")
    for x in (-1.75, 1.75):
        window(c, tr(x, y - 0.2, 2.2), 0.17, 0.5)
    gw, g1, g2 = 1.15, 0.8, 1.9
    c.prism([(-gw, 0), (gw, 0), (gw, g1), (0, g2), (-gw, g1)], 0.5, "in_castle", M=tr(0, y - 0.1, GH))
    beta = math.atan2(g2 - g1, gw); L = math.hypot(gw, g2 - g1)
    for sx in (-1, 1):
        along = Vector((sx * math.cos(beta), 0, -math.sin(beta)))
        nrm = Vector((sx * math.sin(beta), 0, math.cos(beta)))
        cc = Vector((sx * gw / 2, y + 0.12, GH + (g1 + g2) / 2)) + nrm * 0.07 + along * 0.1
        c.box((L + 0.36, 0.7, 0.13), cc, "in_roof", rot=Euler((0, sx * beta, 0)))
    window(c, tr(0, y - 0.1, GH + 0.35), 0.24, 0.42)
    for x, yy, r_, h, rh, wins in (
            (0.0, 5.75, 0.85, 5.3, 2.2, [(4.9, 0.14, 0.26)]),
            (-2.75, 5.3, 0.78, 4.6, 1.9, [(3.5, 0.15, 0.32), (2.0, 0.13, 0.28)]),
            (2.75, 5.3, 0.78, 4.6, 1.9, [(3.5, 0.15, 0.32), (2.0, 0.13, 0.28)]),
            (-1.45, 5.7, 0.6, 4.9, 1.6, []), (1.45, 5.7, 0.6, 4.9, 1.6, []),
            (-4.6, 5.2, 0.8, 3.7, 1.9, [(2.9, 0.15, 0.3)]), (4.6, 5.2, 0.8, 3.7, 1.9, [(2.9, 0.15, 0.3)]),
            (-7.1, 5.1, 0.9, 2.9, 2.0, [(2.1, 0.16, 0.32)]), (7.1, 5.1, 0.9, 2.9, 2.0, [(2.1, 0.16, 0.32)])):
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
        mb.poly([(0, 0, 0), (w, 0.45 * l, 0.04), (0, l, 0)], "green_in", M=Mq)
        mb.poly([(0, 0, 0), (0, l, 0), (-w, 0.45 * l, 0.04)], "leaf2", M=Mq)


def stand(mb, x, y, z, s=1.0, tiers=1):
    T = tr(x, y, z) @ Matrix.Scale(s, 4)
    mb.lathe([(0, 0.24), (0.04, 0.24), (0.07, 0.05), (0.3, 0.04), (0.33, 0.34), (0.37, 0.34)], 14, "gold", M=T, smooth=True)
    for k in range(7):
        a0 = 2 * math.pi * k / 7
        mb.ico(0.075, (0.2 * math.cos(a0), 0.2 * math.sin(a0), 0.44), "sweet" if k % 2 else "cake", M=T)
    mb.ico(0.08, (0, 0, 0.5), "sweet", M=T)


def pedestal(mb, x, y, r, h, key="ped_pink", flutes=True):
    T = tr(x, y, 0)
    if flutes:
        seg = 28
        prof = [(0.06, r), (h - 0.06, r)]
        mb.lathe(prof, seg, key, M=T, key2="in_rug", p2=0.5)
    else:
        mb.lathe([(0.06, r), (h - 0.06, r)], 28, key, M=T, smooth=True)
    mb.lathe([(0, r * 1.03), (0.06, r * 1.03)], 20, "gold", M=T)
    mb.lathe([(h - 0.06, r * 1.03), (h, r * 1.03)], 20, "gold" if key == "ped_pink" else "ped_white", M=T)
    mb.lathe([(h, r * 0.98), (h + 0.012, r * 0.98)], 20, "ped_white", M=T)


def build_party():
    p = MB("PartyTable")
    # centre table + cake
    pedestal(p, 0, -0.6, 2.0, 1.45)
    zt = 1.45
    p.lathe([(zt, 1.05), (zt + 0.07, 1.05)], 20, "gold", M=tr(0, -0.6, 0))
    for r_, z0, h in ((0.82, zt + 0.07, 0.55), (0.6, zt + 0.62, 0.5), (0.4, zt + 1.12, 0.45)):
        p.lathe([(z0, r_), (z0 + h, r_)], 28, "cake", M=tr(0, -0.6, 0), smooth=True)
        for k in range(8):
            a0 = 2 * math.pi * k / 8
            p.ico(0.055, (r_ * math.cos(a0), -0.6 + r_ * math.sin(a0), z0 + h * 0.55), "sweet")
    zc = zt + 1.57
    p.lathe([(zc, 0.12), (zc + 0.25, 0.12)], 8, "in_castle", M=tr(0, -0.6, 0))
    p.lathe([(zc + 0.25, 0.17), (zc + 0.55, 0.0)], 8, "in_roof", M=tr(0, -0.6, 0))
    # side pedestals (mirrored)
    for sx in (-1, 1):
        p.box((1.15, 1.15, 1.25), (sx * 3.0, -1.1, 0.625), "ped_white")
        stand(p, sx * 3.0, -1.1, 1.25, 1.3)
        pedestal(p, sx * 4.3, -2.0, 0.7, 0.95)
        stand(p, sx * 4.3, -2.0, 0.95, 1.2)
        pedestal(p, sx * 4.55, 0.3, 0.75, 1.7, key="ped_white", flutes=False)
        stand(p, sx * 4.55, 0.3, 1.7, 1.25)
        p.box((1.0, 1.0, 1.55), (sx * 6.05, -1.0, 0.775), "ped_white")
        stand(p, sx * 6.05, -1.0, 1.55, 1.2)
        pedestal(p, sx * 7.2, 0.7, 0.8, 2.0)
        stand(p, sx * 7.2, 0.7, 2.0, 1.3)
        pedestal(p, sx * 7.6, -2.3, 0.75, 1.3)
        stand(p, sx * 7.6, -2.3, 1.3, 1.1)
        pedestal(p, sx * 9.3, -1.6, 0.8, 1.5)
    p.build(coll=C_PARTY)

    f = MB("Flowers")
    for sx in (-1, 1):
        # tall urn arrangements flanking the cake
        f.lathe([(0, 0.34), (0.1, 0.34), (0.22, 0.13), (0.5, 0.11), (0.95, 0.42), (1.35, 0.5), (1.45, 0.44)], 10,
                "ped_white", M=tr(sx * 3.5, 2.6, 0) @ Matrix.Scale(1.3, 4))
        bouquet(f, sx * 3.7, 2.6, 2.95, 1.15, 40, 6)
        bouquet(f, sx * 2.5, -3.1, 0.6, 0.8, 24, 5)        # floor arrangements
        bouquet(f, sx * 9.3, -1.6, 2.05, 0.75, 22, 4)         # outer pedestals
        bouquet(f, sx * 5.6, -3.3, 0.4, 0.5, 12, 3)
    f.build(coll=C_PARTY)

    for sx in (-1, 1):
        b = MB("Balloons_L" if sx < 0 else "Balloons_R")
        keys = ["balloon1", "balloon2", "balloon3", "balloon4", "balloon1", "balloon2"]
        z = 0.7
        i = 0
        while z < 7.6:
            r_ = random.choice([0.36, 0.42, 0.5, 0.6, 0.72, 0.92])
            x = sx * (10.4 + random.uniform(-0.85, 0.85))
            yy = random.uniform(-0.7, 0.7) + 2.0
            b.ico(r_, (x, yy, z), keys[i % len(keys)], sub=3, scale=(1, 1, 1.12), smooth=True)
            z += r_ * random.uniform(0.2, 0.36)
            i += 1
        b.build(coll=C_PARTY)


build_room()
build_backdrop()
build_party()
for _k in ("balloon1", "balloon2", "balloon3", "balloon4"):      # balloons get a soft sheen
    _b = next(n for n in M_(_k).node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    _b.inputs["Roughness"].default_value = 0.38
    if "Specular IOR Level" in _b.inputs:
        _b.inputs["Specular IOR Level"].default_value = 0.45

for name, loc, energy, size in (("Key", (0, -9, 8.2), 560, 14), ("Fill", (0, -3, 8.6), 170, 10)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy; ld.size = size; ld.color = (1.0, 0.93, 0.86)
    lo = bpy.data.objects.new(name, ld); lo.location = loc
    lo.rotation_euler = (Vector((0, 2, 2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo)
for i, (loc, energy) in enumerate((((-5.5, 3.9, 0.4), 70), ((5.5, 3.9, 0.4), 70), ((0, 4.4, 2.2), 45))):
    ld = bpy.data.lights.new("Warm_%d" % i, "POINT")
    ld.energy = energy; ld.color = (1.0, 0.8, 0.58); ld.shadow_soft_size = 0.8
    lo = bpy.data.objects.new("Warm_%d" % i, ld); lo.location = loc
    sc.collection.objects.link(lo)
gradient_world(sc, "HallWarm", top="#FCEDE3", bottom="#FCEDE3", ambient="#FFF0E2", strength=0.74)
setup_render(sc)
set_cam(sc, (0, -19.5, 4.0), (0, 3, 3.9), 30)
result = {"interior_objects": len(sc.objects)}
