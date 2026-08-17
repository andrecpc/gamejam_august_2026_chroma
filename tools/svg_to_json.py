# -*- coding: utf-8 -*-
"""
Пайплайн Inkscape → JSON.

Запуск из папки game_v2:
    python tools/svg_to_json.py

Скрипт читает levels/svg/*.svg, достаёт полигоны/пути по именам слоёв
и обновляет (или создаёт) levels/levels.json.

Уже существующие поля уровня (пробирки, жизни, ограничения) НЕ затираются —
обновляются только геометрия, магнитные пути и точки спавна врагов.
"""
from __future__ import print_function

import json
import math
import os
import re
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG_DIR = os.path.join(ROOT, "levels", "svg")
JSON_PATH = os.path.join(ROOT, "levels", "levels.json")

NS = {
    "svg": "http://www.w3.org/2000/svg",
    "inkscape": "http://www.inkscape.org/namespaces/inkscape",
}

POLY_RE = re.compile(r"^poly_([a-z]+)_(\d+)$", re.I)
SPAWN_RE = re.compile(r"^spawner_enemy_([a-z0-9_]+)$", re.I)
MAG_RE = re.compile(r"^path_magnetic_(\d+)$", re.I)


def local(tag):
    return tag.split("}")[-1] if "}" in tag else tag


def label_of(el):
    return (
        el.get("{http://www.inkscape.org/namespaces/inkscape}label")
        or el.get("id")
        or ""
    )


def num(el, attr, default=0.0):
    v = el.get(attr)
    return float(v) if v not in (None, "") else default


def lerp(a, b, t):
    return a + (b - a) * t


def cubic(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def quad(p0, p1, p2, t):
    u = 1 - t
    return (
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    )


def flatten_cubic(p0, p1, p2, p3, steps=14):
    return [cubic(p0, p1, p2, p3, i / float(steps)) for i in range(1, steps + 1)]


def flatten_quad(p0, p1, p2, steps=10):
    return [quad(p0, p1, p2, i / float(steps)) for i in range(1, steps + 1)]


TOKEN_RE = re.compile(
    r"([MmLlHhVvCcQqSsTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)"
)


def parse_path_d(d):
    tokens = TOKEN_RE.findall(d.replace(",", " "))
    cmd = None
    nums = []
    out = []
    cx = cy = 0.0
    sx = sy = 0.0
    last_c = None

    def take(n):
        vals = [float(x) for x in nums[:n]]
        del nums[:n]
        return vals

    i = 0
    stream = []
    for op, number in tokens:
        if op:
            stream.append(("cmd", op))
        else:
            stream.append(("num", number))

    idx = 0
    while idx < len(stream):
        kind, val = stream[idx]
        if kind == "cmd":
            cmd = val
            idx += 1
            continue
        # numbers: collect for current command
        need = {
            "M": 2, "m": 2, "L": 2, "l": 2, "H": 1, "h": 1, "V": 1, "v": 1,
            "C": 6, "c": 6, "Q": 4, "q": 4, "S": 4, "s": 4, "T": 2, "t": 2,
            "Z": 0, "z": 0,
        }.get(cmd, 0)
        if cmd in ("Z", "z"):
            if out:
                out.append((sx, sy))
            cx, cy = sx, sy
            idx += 1
            continue
        buf = []
        while idx < len(stream) and stream[idx][0] == "num" and len(buf) < need:
            buf.append(float(stream[idx][1]))
            idx += 1
        if len(buf) < need:
            break
        if cmd in ("M", "m"):
            dx, dy = buf
            if cmd == "m":
                cx += dx
                cy += dy
            else:
                cx, cy = dx, dy
            sx, sy = cx, cy
            out.append((cx, cy))
            cmd = "l" if cmd == "m" else "L"
        elif cmd in ("L", "l"):
            dx, dy = buf
            if cmd == "l":
                cx += dx
                cy += dy
            else:
                cx, cy = dx, dy
            out.append((cx, cy))
        elif cmd in ("H", "h"):
            dx = buf[0]
            cx = cx + dx if cmd == "h" else dx
            out.append((cx, cy))
        elif cmd in ("V", "v"):
            dy = buf[0]
            cy = cy + dy if cmd == "v" else dy
            out.append((cx, cy))
        elif cmd in ("C", "c"):
            x1, y1, x2, y2, x, y = buf
            if cmd == "c":
                x1 += cx
                y1 += cy
                x2 += cx
                y2 += cy
                x += cx
                y += cy
            pts = flatten_cubic((cx, cy), (x1, y1), (x2, y2), (x, y))
            out.extend(pts)
            last_c = (x2, y2)
            cx, cy = x, y
        elif cmd in ("Q", "q"):
            x1, y1, x, y = buf
            if cmd == "q":
                x1 += cx
                y1 += cy
                x += cx
                y += cy
            pts = flatten_quad((cx, cy), (x1, y1), (x, y))
            out.extend(pts)
            last_c = (x1, y1)
            cx, cy = x, y
        else:
            # S/T/A — упрощённо: конечная точка
            cx, cy = buf[-2], buf[-1]
            out.append((cx, cy))
    return out


def points_from_element(el):
    tag = local(el.tag)
    if tag == "rect":
        x, y, w, h = num(el, "x"), num(el, "y"), num(el, "width"), num(el, "height")
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    if tag == "polygon" or tag == "polyline":
        raw = (el.get("points") or "").replace(",", " ").split()
        nums = [float(v) for v in raw]
        return list(zip(nums[0::2], nums[1::2]))
    if tag == "circle":
        cx, cy, r = num(el, "cx"), num(el, "cy"), num(el, "r")
        return [
            (cx + r * math.cos(2 * math.pi * i / 32.0), cy + r * math.sin(2 * math.pi * i / 32.0))
            for i in range(32)
        ]
    if tag == "ellipse":
        cx, cy, rx, ry = num(el, "cx"), num(el, "cy"), num(el, "rx"), num(el, "ry")
        return [
            (cx + rx * math.cos(2 * math.pi * i / 32.0), cy + ry * math.sin(2 * math.pi * i / 32.0))
            for i in range(32)
        ]
    if tag == "path":
        return parse_path_d(el.get("d") or "")
    return []


def shoelace(pts):
    if len(pts) < 3:
        return 0.0
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) * 0.5


def to_xy(pts):
    # убрать дубликаты подряд
    out = []
    for x, y in pts:
        p = {"x": round(x, 2), "y": round(y, 2)}
        if not out or abs(out[-1]["x"] - p["x"]) > 0.2 or abs(out[-1]["y"] - p["y"]) > 0.2:
            out.append(p)
    if len(out) >= 2 and out[0] == out[-1]:
        out.pop()
    return out


def parse_svg(path):
    tree = ET.parse(path)
    root = tree.getroot()
    polygons = []
    enemies = []
    magnetic = []

    for el in root.iter():
        name = label_of(el)
        if not name:
            continue
        m = POLY_RE.match(name)
        if m:
            pts = to_xy(points_from_element(el))
            if len(pts) >= 3:
                polygons.append({
                    "id": name,
                    "color": m.group(1).lower(),
                    "points": pts,
                    "area": round(shoelace([(p["x"], p["y"]) for p in pts]), 1),
                })
            continue
        m = SPAWN_RE.match(name)
        if m:
            pts = points_from_element(el)
            if tag_is_circle(el):
                x, y = num(el, "cx"), num(el, "cy")
            elif pts:
                x, y = pts[0]
            else:
                x, y = num(el, "x"), num(el, "y")
            enemies.append({
                "type": m.group(1).lower(),
                "x": round(x, 1),
                "y": round(y, 1),
                "vx": 88,
                "vy": 64,
            })
            continue
        m = MAG_RE.match(name)
        if m:
            pts = to_xy(points_from_element(el))
            if len(pts) >= 2:
                magnetic.append({"id": name, "points": pts})

    return polygons, enemies, magnetic


def tag_is_circle(el):
    return local(el.tag) == "circle"


def filename_id(name):
    m = re.match(r"^(\d+)", name)
    return int(m.group(1)) if m else None


def main():
    if not os.path.isdir(SVG_DIR):
        print("No folder", SVG_DIR)
        return

    pack = {"palette": {
        "red": "#ff4d6d", "blue": "#4a9fff", "yellow": "#ffd24a", "green": "#3ee6a0",
        "purple": "#b07cff", "orange": "#ff8a3d", "cyan": "#2ce6d0", "pink": "#ff5ca8",
    }, "levels": []}
    if os.path.isfile(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            pack = json.load(f)

    by_key = {}
    for lvl in pack.get("levels", []):
        key = (lvl.get("pack") or "lab", lvl.get("id"))
        by_key[key] = lvl

    svgs = sorted(fn for fn in os.listdir(SVG_DIR) if fn.lower().endswith(".svg"))
    if not svgs:
        print("No svg files in levels/svg")
        return

    for fn in svgs:
        lid = filename_id(fn)
        if lid is None:
            print("Skip (no leading number):", fn)
            continue
        path = os.path.join(SVG_DIR, fn)
        polygons, enemies, magnetic = parse_svg(path)
        total = sum(p.get("area") or 0 for p in polygons)
        n_vials = int(round(total * 0.7 / max(total * 0.1, 1))) if total else 0
        print("%s -> id=%s, polygons=%d, area=%.0f, vials<=%d (70pct)" % (
            fn, lid, len(polygons), total, n_vials
        ))
        for p in polygons:
            print("   %s  area=%s  pts=%d" % (p["id"], p["area"], len(p["points"])))
            p.pop("area", None)

        lvl = None
        for existing in pack.get("levels", []):
            if existing.get("sourceSvg") == fn:
                lvl = existing
                break
        if lvl is None:
            lvl = by_key.get(("lab", lid))
        if lvl is None:
            lvl = {
                "id": lid,
                "pack": "lab",
                "name": "Уровень %s" % lid,
                "lives": 3,
                "playerSpeed": 210,
                "bounds": {"x": 40, "y": 130, "w": 640, "h": 640, "frame": 28},
                "vials": [],
                "boosters": [],
                "constraints": {},
            }
            pack.setdefault("levels", []).append(lvl)
            by_key[("lab", lid)] = lvl
        lvl["sourceSvg"] = fn
        lvl["polygons"] = polygons
        lvl["magneticPaths"] = magnetic
        lvl.setdefault("pack", "lab")
        if enemies:
            existing_by_type = {}
            for old_enemy in lvl.get("enemies", []):
                existing_by_type.setdefault(old_enemy.get("type"), []).append(old_enemy)
            merged_enemies = []
            for parsed_enemy in enemies:
                same_type = existing_by_type.get(parsed_enemy.get("type"), [])
                config = dict(same_type.pop(0)) if same_type else {}
                config["type"] = parsed_enemy["type"]
                config["x"] = parsed_enemy["x"]
                config["y"] = parsed_enemy["y"]
                config.setdefault("vx", parsed_enemy.get("vx", 88))
                config.setdefault("vy", parsed_enemy.get("vy", 64))
                merged_enemies.append(config)
            lvl["enemies"] = merged_enemies

    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Wrote:", JSON_PATH)


if __name__ == "__main__":
    main()
