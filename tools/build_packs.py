#!/usr/bin/env python3
"""Rebuild levels.json: current drafts become lab, plus training levels."""

from __future__ import annotations

import json
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "levels" / "levels.json"

BOUNDS = {"x": 40, "y": 130, "w": 640, "h": 640, "frame": 28}

LAB_HINTS = {
    1: "заполни пробирки, нарезая цвета",
    2: "орбита ведёт хвост • оторвись и вернись на стену",
    3: "собирай значки • фиолетовая улитка замедляет",
    4: "R везде • C преследует • T стреляет • L лазер • S ворует",
    5: "успей заполнить пробирки до конца таймера",
    6: "зачисти нужный процент поля",
    7: "заполни пробирки за ограниченное число срезов",
    8: "полные пробирки строят башни • уклоняйся от залпов",
    9: "отсеки лапы и ядро • уклоняйся от залпов паука",
}


def poly(pid: str, color: str, x: float, y: float, w: float, h: float) -> dict:
    return {
        "id": pid,
        "color": color,
        "points": [
            {"x": x, "y": y},
            {"x": x + w, "y": y},
            {"x": x + w, "y": y + h},
            {"x": x, "y": y + h},
        ],
    }


def base(**extra) -> dict:
    level = {
        "lives": 3,
        "playerSpeed": 210,
        "bounds": dict(BOUNDS),
        "enemies": [],
        "boosters": [],
        "constraints": {},
        "magneticPaths": [],
        "tutorials": [],
    }
    level.update(extra)
    return level


def training_levels(lab: list[dict]) -> list[dict]:
    magnet = next(level for level in lab if level["id"] == 2)["magneticPaths"]
    full_red = [poly("poly_red_1", "red", 68, 158, 584, 584)]
    two_halves = [
        poly("poly_red_1", "red", 68, 158, 292, 584),
        poly("poly_blue_1", "blue", 360, 158, 292, 584),
    ]
    three_blocks = [
        poly("poly_red_1", "red", 68, 158, 292, 584),
        poly("poly_blue_1", "blue", 360, 158, 292, 292),
        poly("poly_yellow_1", "yellow", 360, 450, 292, 292),
    ]
    three_stripes = [
        poly("poly_red_1", "red", 68, 158, 194, 584),
        poly("poly_green_1", "green", 262, 158, 196, 584),
        poly("poly_blue_1", "blue", 458, 158, 194, 584),
    ]
    return [
        base(
            id=1,
            pack="training",
            name="Капля",
            hint="нажми в любом месте — появится стик",
            vials=[{"color": "red"}],
            polygons=full_red,
            tutorials=[
                {
                    "id": "cut_wall",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Нажми на экран — появится стик. Его удобно держать внизу, там где корзины. Зажми стик и веди точку: с рамки заезжай в бумагу и возвращайся обратно на рамку. Отрезанный кусок скомкается в корзину своего цвета.",
                },
                {
                    "id": "cut_keep_going",
                    "trigger": "cut",
                    "persist": "until-draw",
                    "text": "Отлично, контур замкнулся! Режь ещё, пока корзина внизу не заполнится доверху.",
                },
            ],
        ),
        base(
            id=2,
            pack="training",
            name="Два цвета",
            hint="в корзину идёт цвет отрезанного куска",
            vials=[{"color": "red"}, {"color": "blue"}],
            polygons=two_halves,
            tutorials=[
                {
                    "id": "cut_color",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "В корзину падает цвет того куска, который ты отрезал. Сначала нужна красная, потом синяя. Попробуй отрезать 2 цвета за 1 раз — каждый кусок уйдёт в свою корзину. Если уровень завис: пауза и рестарт. Если пропал звук — обнови страницу и зайди на тот же уровень.",
                }
            ],
        ),
        base(
            id=3,
            pack="training",
            name="Очередь",
            hint="×N — сколько корзин этого цвета ещё будет",
            vials=[
                {"color": "red"},
                {"color": "red"},
                {"color": "blue"},
                {"color": "yellow"},
                {"color": "red"},
            ],
            polygons=three_blocks,
            tutorials=[
                {
                    "id": "vial_queue",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Отрезать цвет можно, только если внизу уже стоит корзина этого цвета. ×N рядом с корзиной — сколько ещё таких корзин будет потом, поэтому не срезай весь цвет сразу. Попробуй жёлтый: пока жёлтой корзины нет, он не отрежется. Это нормально.",
                }
            ],
        ),
        base(
            id=4,
            pack="training",
            name="Живой цвет",
            hint="наполни корзины, не касаясь врага",
            vials=[{"color": "red"}, {"color": "blue"}],
            enemies=[{"type": "pingpong", "x": 220, "y": 420, "vx": 70, "vy": 52}],
            polygons=two_halves,
            tutorials=[
                {
                    "id": "enemy_pingpong",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Красный кружок — враг. Он бегает по бумаге, и касание снимает жизнь. Наполни корзины и старайся его не задеть. Если замкнёшь контур вокруг врага, он пропадёт.",
                }
            ],
        ),
        base(
            id=5,
            pack="training",
            name="Карусель",
            hint="точка прилипает к светящейся линии",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "red"}, {"color": "blue"}],
            magnetSnapRadius=22,
            magnetDetachDistance=34,
            magnetRideSpeedFactor=0.86,
            magneticPaths=magnet,
            polygons=two_halves,
            tutorials=[
                {
                    "id": "magnet_path",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Светящаяся линия — дорожка. Подъедь близко: точка сама прилипнет и поедет по ней. Чтобы отлипнуть, резко свайпни стиком в сторону от линии и возвращайся на рамку.",
                }
            ],
        ),
        base(
            id=6,
            pack="training",
            name="Аптечка",
            hint="пересеки значки и посмотри, что они делают",
            maxLives=5,
            vials=[{"color": "red"}, {"color": "green"}, {"color": "blue"}],
            enemies=[{"type": "pingpong", "x": 420, "y": 470, "vx": 80, "vy": 58}],
            boosters=[
                {"type": "shield", "x": 150, "y": 260, "duration": 7000},
                {"type": "speed", "x": 560, "y": 250, "duration": 6000, "multiplier": 1.45},
                {"type": "life", "x": 360, "y": 620, "amount": 1},
            ],
            polygons=three_stripes,
            tutorials=[
                {
                    "id": "boosters",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Значки на поле — бустеры. Проедь по ним точкой: щит защищает от врага, молния ускоряет, сердечко даёт жизнь. Попробуй все, потом заполни корзины.",
                }
            ],
        ),
        base(
            id=7,
            pack="training",
            name="Дедлайн",
            hint="некоторые уровни ограничивают время и не только",
            playerSpeed=225,
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "red"}],
            boosters=[{"type": "shield", "x": 360, "y": 450, "duration": 5000}],
            constraints={"time": 55, "winCondition": "vials"},
            polygons=two_halves,
            tutorials=[
                {
                    "id": "constraint_time",
                    "trigger": "start",
                    "persist": "until-move",
                    "text": "Этот уровень на время: сначала предупреждение, потом отсчёт 3–2–1, и только тогда пойдёт таймер. Успей заполнить корзины, пока секунды не кончились. На других уровнях вместо таймера бывают лимит срезов или свои условия.",
                }
            ],
        ),
    ]


def flavor(text: str) -> list[dict]:
    return [
        {
            "id": "flavor",
            "trigger": "start",
            "persist": "until-move",
            "text": text,
        }
    ]


def shape(pid: str, color: str, points: list[dict]) -> dict:
    return {"id": pid, "color": color, "points": points}


def ring(prefix: str, color: str, x: float, y: float, w: float, h: float, t: float) -> list[dict]:
    return [
        poly(f"{prefix}_n", color, x, y, w, t),
        poly(f"{prefix}_s", color, x, y + h - t, w, t),
        poly(f"{prefix}_w", color, x, y + t, t, h - 2 * t),
        poly(f"{prefix}_e", color, x + w - t, y + t, t, h - 2 * t),
    ]


def diamond_pts(cx: float, cy: float, rx: float, ry: float) -> list[dict]:
    return [
        {"x": cx, "y": cy - ry},
        {"x": cx + rx, "y": cy},
        {"x": cx, "y": cy + ry},
        {"x": cx - rx, "y": cy},
    ]


def fill_around_diamonds(
    color: str,
    prefix: str,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    diamonds: list[tuple],
) -> list[dict]:
    diamonds = sorted(diamonds, key=lambda d: d[1])
    out: list[dict] = []
    n = 0

    def add_rect(x: float, y: float, w: float, h: float) -> None:
        nonlocal n
        if w <= 0.5 or h <= 0.5:
            return
        n += 1
        out.append(poly(f"{prefix}_{n}", color, x, y, w, h))

    def add_pts(pts: list[dict]) -> None:
        nonlocal n
        n += 1
        out.append(shape(f"{prefix}_{n}", color, pts))

    y_cursor = y0
    for cx, cy, rx, ry in diamonds:
        top = cy - ry
        bot = cy + ry
        left = cx - rx
        right = cx + rx
        add_rect(x0, y_cursor, x1 - x0, top - y_cursor)
        add_rect(x0, top, left - x0, bot - top)
        add_rect(right, top, x1 - right, bot - top)
        add_pts([{"x": left, "y": top}, {"x": cx, "y": top}, {"x": left, "y": cy}])
        add_pts([{"x": cx, "y": top}, {"x": right, "y": top}, {"x": right, "y": cy}])
        add_pts([{"x": right, "y": cy}, {"x": right, "y": bot}, {"x": cx, "y": bot}])
        add_pts([{"x": left, "y": cy}, {"x": cx, "y": bot}, {"x": left, "y": bot}])
        y_cursor = bot
    add_rect(x0, y_cursor, x1 - x0, y1 - y_cursor)
    return out




def orbit_field() -> list[dict]:
    """Две сплошные половины + четыре жёлтых ромба сверху, без дыр в поле."""
    yellows = [
        (230, 320, 78, 78),
        (490, 320, 78, 78),
        (230, 580, 78, 78),
        (490, 580, 78, 78),
    ]
    return [
        shape(f"poly_yellow_{i + 1}", "yellow", diamond_pts(cx, cy, rx, ry))
        for i, (cx, cy, rx, ry) in enumerate(yellows)
    ] + [
        poly("poly_red_1", "red", 68, 158, 292, 584),
        poly("poly_blue_1", "blue", 360, 158, 292, 584),
    ]


def superellipse_path(cx: float, cy: float, rx: float, ry: float, n: float = 1.35, count: int = 48) -> list[dict]:
    pts = []
    for i in range(count):
        t = 2 * math.pi * i / count
        ct = math.cos(t)
        st = math.sin(t)
        x = cx + rx * math.copysign(abs(ct) ** (2 / n), ct)
        y = cy + ry * math.copysign(abs(st) ** (2 / n), st)
        pts.append({"x": round(x, 1), "y": round(y, 1)})
    pts.append(dict(pts[0]))
    return pts


def ray_to_square(cx: float, cy: float, angle: float, x0: float, y0: float, x1: float, y1: float) -> dict:
    dx = math.cos(angle)
    dy = math.sin(angle)
    ts = []
    if dx > 1e-6:
        ts.append((x1 - cx) / dx)
    elif dx < -1e-6:
        ts.append((x0 - cx) / dx)
    if dy > 1e-6:
        ts.append((y1 - cy) / dy)
    elif dy < -1e-6:
        ts.append((y0 - cy) / dy)
    t = min(v for v in ts if v > 0)
    return {"x": round(cx + dx * t, 1), "y": round(cy + dy * t, 1)}


def pie_wedges(cx: float, cy: float, colors: list[str], n: int = 8) -> list[dict]:
    x0, y0, x1, y1 = 68, 158, 652, 742
    polys = []
    for i in range(n):
        a0 = -math.pi / 2 + i * 2 * math.pi / n
        a1 = -math.pi / 2 + (i + 1) * 2 * math.pi / n
        p0 = ray_to_square(cx, cy, a0, x0, y0, x1, y1)
        p1 = ray_to_square(cx, cy, a1, x0, y0, x1, y1)
        polys.append(shape(
            f"poly_{colors[i % len(colors)]}_{i + 1}",
            colors[i % len(colors)],
            [{"x": cx, "y": cy}, p0, p1],
        ))
    return polys


def tri_sectors(colors: list[str]) -> list[dict]:
    cx, cy = 360.0, 450.0
    x0, y0, x1, y1 = 68.0, 158.0, 652.0, 742.0
    n = len(colors)
    polys = []
    for i, color in enumerate(colors):
        a0 = -math.pi / 2 + i * 2 * math.pi / n
        a1 = a0 + 2 * math.pi / n
        p0 = ray_to_square(cx, cy, a0, x0, y0, x1, y1)
        p1 = ray_to_square(cx, cy, a1, x0, y0, x1, y1)
        pts = [{"x": cx, "y": cy}, p0] + square_corners_between(p0, p1) + [p1]
        polys.append(shape(f"poly_{color}_1", color, pts))
    return polys


def confetti_tiles() -> list[dict]:
    colors = ["red", "blue", "yellow", "green", "purple"]
    xs = [68, 263, 458, 652]
    ys = [158, 304, 450, 596, 742]
    tiles = []
    idx = 0
    for row in range(4):
        for col in range(3):
            tiles.append(poly(
                f"poly_{colors[idx % 5]}_{idx + 1}",
                colors[idx % 5],
                xs[col],
                ys[row],
                xs[col + 1] - xs[col],
                ys[row + 1] - ys[row],
            ))
            idx += 1
    return tiles


def five_stripes() -> list[dict]:
    colors = ["red", "blue", "yellow", "green", "purple"]
    w = 584 / 5
    return [
        poly(f"poly_{colors[i]}_1", colors[i], 68 + i * w, 158, w, 584)
        for i in range(5)
    ]


def clamp_pt(x: float, y: float, x0: float = 68, y0: float = 158, x1: float = 652, y1: float = 742) -> dict:
    return {"x": round(min(x1, max(x0, x)), 1), "y": round(min(y1, max(y0, y)), 1)}


def regular_ngon(cx: float, cy: float, r: float, n: int, start: float = 0.0) -> list[dict]:
    pts = []
    for i in range(n):
        a = start + i * 2 * math.pi / n
        pts.append(clamp_pt(cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def square_spiral(colors: list[str], band: float = 58) -> list[dict]:
    x0, y0, x1, y1 = 68.0, 158.0, 652.0, 742.0
    polys: list[dict] = []
    idx = 0

    def add(x: float, y: float, w: float, h: float) -> None:
        nonlocal idx
        if w < 4 or h < 4:
            return
        color = colors[idx % len(colors)]
        idx += 1
        polys.append(poly(f"poly_{color}_{idx}", color, x, y, w, h))

    for _ in range(16):
        w = x1 - x0
        h = y1 - y0
        if w <= band * 1.7 or h <= band * 1.7:
            add(x0, y0, w, h)
            break
        b = min(band, w / 2, h / 2)
        add(x0, y0, w, b)
        add(x1 - b, y0 + b, b, h - b)
        add(x0, y1 - b, w - b, b)
        add(x0, y0 + b, b, h - 2 * b)
        x0 += b
        y0 += b
        x1 -= b
        y1 -= b
    return polys


def hourglass() -> list[dict]:
    return [
        shape("poly_red_1", "red", [
            {"x": 68, "y": 158}, {"x": 652, "y": 158},
            {"x": 652, "y": 280}, {"x": 360, "y": 450}, {"x": 68, "y": 280},
        ]),
        shape("poly_blue_1", "blue", [
            {"x": 68, "y": 620}, {"x": 360, "y": 450}, {"x": 652, "y": 620},
            {"x": 652, "y": 742}, {"x": 68, "y": 742},
        ]),
        shape("poly_yellow_1", "yellow", [
            {"x": 68, "y": 280}, {"x": 360, "y": 450}, {"x": 68, "y": 620},
        ]),
        shape("poly_yellow_2", "yellow", [
            {"x": 652, "y": 280}, {"x": 652, "y": 620}, {"x": 360, "y": 450},
        ]),
    ]


def slanted_stripes(colors: list[str], shift: float = 88) -> list[dict]:
    x0, y0, x1, y1 = 68.0, 158.0, 652.0, 742.0
    n = len(colors)
    w = x1 - x0
    polys = []
    for i, color in enumerate(colors):
        top_a = x0 + w * i / n
        top_b = x0 + w * (i + 1) / n
        bot_a = x0 + w * i / n + shift
        bot_b = x0 + w * (i + 1) / n + shift
        if i == 0:
            bot_a = x0
        if i == n - 1:
            top_b = x1
            bot_b = x1
        polys.append(shape(f"poly_{color}_1", color, [
            clamp_pt(top_a, y0), clamp_pt(top_b, y0),
            clamp_pt(bot_b, y1), clamp_pt(bot_a, y1),
        ]))
    return polys


def shared_wave(base: float, amplitude: float, t: float, periods: int, lo: float, hi: float) -> float:
    return min(hi, max(lo, base + amplitude * math.sin(t * periods * 2 * math.pi)))


def chevron_bands(colors: list[str], amplitude: float = 38, periods: int = 3) -> list[dict]:
    x0, y0, x1, y1 = 68.0, 158.0, 652.0, 742.0
    n = len(colors)
    h = (y1 - y0) / n
    steps = 14
    edges: list[list[dict]] = []
    for k in range(n + 1):
        y_base = y0 + k * h
        if k == 0:
            edges.append([{"x": x0, "y": y0}, {"x": x1, "y": y0}])
            continue
        if k == n:
            edges.append([{"x": x0, "y": y1}, {"x": x1, "y": y1}])
            continue
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            pts.append(clamp_pt(x, shared_wave(y_base, amplitude, t, periods, y0, y1)))
        edges.append(pts)
    polys = []
    for i, color in enumerate(colors):
        outline = edges[i] + list(reversed(edges[i + 1]))
        polys.append(shape(f"poly_{color}_1", color, outline))
    return polys


def wave_stripes(colors: list[str], amplitude: float = 32, periods: int = 3) -> list[dict]:
    x0, y0, x1, y1 = 68.0, 158.0, 652.0, 742.0
    n = len(colors)
    w = (x1 - x0) / n
    steps = 16
    edges: list[list[dict]] = []
    for k in range(n + 1):
        x_base = x0 + k * w
        if k == 0:
            edges.append([{"x": x0, "y": y0}, {"x": x0, "y": y1}])
            continue
        if k == n:
            edges.append([{"x": x1, "y": y0}, {"x": x1, "y": y1}])
            continue
        pts = []
        for i in range(steps + 1):
            t = i / steps
            y = y0 + (y1 - y0) * t
            pts.append(clamp_pt(shared_wave(x_base, amplitude, t, periods, x0, x1), y))
        edges.append(pts)
    polys = []
    for i, color in enumerate(colors):
        outline = edges[i] + list(reversed(edges[i + 1]))
        polys.append(shape(f"poly_{color}_{i + 1}", color, outline))
    return polys


def plus_field() -> list[dict]:
    return [
        poly("poly_red_1", "red", 68, 158, 202, 202),
        poly("poly_blue_1", "blue", 450, 158, 202, 202),
        poly("poly_green_1", "green", 68, 540, 202, 202),
        poly("poly_purple_1", "purple", 450, 540, 202, 202),
        poly("poly_yellow_1", "yellow", 270, 158, 180, 584),
        poly("poly_yellow_2", "yellow", 68, 360, 202, 180),
        poly("poly_yellow_3", "yellow", 450, 360, 202, 180),
    ]


def envelope() -> list[dict]:
    cx, cy = 360.0, 450.0
    return [
        shape("poly_red_1", "red", [
            {"x": 68, "y": 158}, {"x": 652, "y": 158}, {"x": cx, "y": cy},
        ]),
        shape("poly_blue_1", "blue", [
            {"x": 652, "y": 158}, {"x": 652, "y": 742}, {"x": cx, "y": cy},
        ]),
        shape("poly_green_1", "green", [
            {"x": 652, "y": 742}, {"x": 68, "y": 742}, {"x": cx, "y": cy},
        ]),
        shape("poly_yellow_1", "yellow", [
            {"x": 68, "y": 742}, {"x": 68, "y": 158}, {"x": cx, "y": cy},
        ]),
    ]


def nested_frames() -> list[dict]:
    return (
        ring("poly_green", "green", 68, 158, 584, 584, 56)
        + ring("poly_blue", "blue", 124, 214, 472, 472, 72)
        + ring("poly_red", "red", 196, 286, 328, 328, 64)
        + [poly("poly_yellow_1", "yellow", 260, 350, 200, 200)]
    )


def fortress() -> list[dict]:
    # Три рамки снаружи внутрь + жёлтое сердце. Печати сидят в разных кольцах.
    return (
        ring("poly_red", "red", 68, 158, 584, 584, 70)
        + ring("poly_blue", "blue", 138, 228, 444, 444, 68)
        + ring("poly_green", "green", 206, 296, 308, 308, 58)
        + [poly("poly_yellow_1", "yellow", 264, 354, 192, 192)]
    )


def _perim_t(p: dict, x0: float = 68, y0: float = 158, x1: float = 652, y1: float = 742) -> float:
    x, y = p["x"], p["y"]
    w, h = x1 - x0, y1 - y0
    eps = 1.6
    if abs(y - y0) <= eps:
        return x - x0
    if abs(x - x1) <= eps:
        return w + (y - y0)
    if abs(y - y1) <= eps:
        return w + h + (x1 - x)
    if abs(x - x0) <= eps:
        return w + h + w + (y1 - y)
    dists = [
        (abs(y - y0), x - x0),
        (abs(x - x1), w + (y - y0)),
        (abs(y - y1), w + h + (x1 - x)),
        (abs(x - x0), w + h + w + (y1 - y)),
    ]
    return min(dists, key=lambda item: item[0])[1]


def square_corners_between(p0: dict, p1: dict) -> list[dict]:
    corners = [
        {"x": 68, "y": 158, "t": 0.0},
        {"x": 652, "y": 158, "t": 584.0},
        {"x": 652, "y": 742, "t": 1168.0},
        {"x": 68, "y": 742, "t": 1752.0},
    ]
    t0 = _perim_t(p0)
    t1 = _perim_t(p1)
    total = 2336.0
    picked = []
    for corner in corners:
        t = corner["t"]
        if t0 <= t1:
            if t0 < t < t1:
                picked.append(corner)
        elif t > t0 or t < t1:
            picked.append(corner)
    picked.sort(key=lambda c: (c["t"] - t0) % total)
    return [{"x": c["x"], "y": c["y"]} for c in picked]


def clover_lock() -> list[dict]:
    cx, cy, hex_r = 360.0, 450.0, 132.0
    colors = ["red", "blue", "green"]
    polys = [shape("poly_yellow_1", "yellow", regular_ngon(cx, cy, hex_r, 6, math.pi / 6))]
    for i, color in enumerate(colors):
        a0 = -math.pi / 2 + i * 2 * math.pi / 3
        a1 = a0 + 2 * math.pi / 3
        inner0 = clamp_pt(cx + hex_r * math.cos(a0), cy + hex_r * math.sin(a0))
        inner1 = clamp_pt(cx + hex_r * math.cos(a1), cy + hex_r * math.sin(a1))
        outer0 = ray_to_square(cx, cy, a0, 68, 158, 652, 742)
        outer1 = ray_to_square(cx, cy, a1, 68, 158, 652, 742)
        pts = [inner0, outer0] + square_corners_between(outer0, outer1) + [outer1, inner1]
        polys.append(shape(f"poly_{color}_1", color, pts))
    return polys


def moon_field() -> list[dict]:
    # D-луна: жёлтый касается левой/верхней/нижней рамки широким краем,
    # дуга не касается правой стены — иначе срез срывается на точке касания.
    cx, cy, r = 340.0, 450.0, 185.0
    arc = []
    for i in range(17):
        a = -math.pi / 2 + i * math.pi / 16
        arc.append(clamp_pt(cx + r * math.cos(a), cy + r * math.sin(a)))
    yellow = (
        [{"x": 68, "y": 158}, {"x": 340, "y": 158}]
        + arc
        + [{"x": 340, "y": 742}, {"x": 68, "y": 742}]
    )
    top_y = arc[0]["y"]
    bot_y = arc[-1]["y"]
    return [
        shape("poly_yellow_1", "yellow", yellow),
        poly("poly_purple_1", "purple", 340, 158, 312, top_y - 158),
        poly("poly_purple_2", "purple", 340, bot_y, 312, 742 - bot_y),
        shape("poly_purple_3", "purple", (
            [{"x": 652, "y": top_y}, {"x": 652, "y": bot_y}]
            + list(reversed(arc))
        )),
    ]


def hex_in_square() -> list[dict]:
    cx, cy, r = 360.0, 450.0, 252.0
    hex_pts = regular_ngon(cx, cy, r, 6, 0)
    by_x = sorted(hex_pts, key=lambda p: (p["x"], p["y"]))
    by_y = sorted(hex_pts, key=lambda p: (p["y"], p["x"]))
    left = by_x[0]
    right = by_x[-1]
    top_pair = [p for p in hex_pts if abs(p["y"] - by_y[0]["y"]) < 1.5]
    bot_pair = [p for p in hex_pts if abs(p["y"] - by_y[-1]["y"]) < 1.5]
    top_y = by_y[0]["y"]
    bot_y = by_y[-1]["y"]
    tl = min(top_pair, key=lambda p: p["x"])
    tr = max(top_pair, key=lambda p: p["x"])
    bl = min(bot_pair, key=lambda p: p["x"])
    br = max(bot_pair, key=lambda p: p["x"])
    return [
        shape("poly_yellow_1", "yellow", hex_pts),
        shape("poly_red_1", "red", [
            {"x": 68, "y": 158}, {"x": 652, "y": 158},
            {"x": 652, "y": top_y}, {"x": 68, "y": top_y},
        ]),
        shape("poly_blue_1", "blue", [
            {"x": 68, "y": bot_y}, {"x": 652, "y": bot_y},
            {"x": 652, "y": 742}, {"x": 68, "y": 742},
        ]),
        shape("poly_green_1", "green", [
            {"x": 68, "y": top_y}, tl, left, bl, {"x": 68, "y": bot_y},
        ]),
        shape("poly_purple_1", "purple", [
            {"x": 652, "y": top_y}, {"x": 652, "y": bot_y}, br, right, tr,
        ]),
    ]


def figure8_paths() -> list[dict]:
    return [
        {"closed": True, "points": superellipse_path(360, 328, 148, 98, 1.38, 40)},
        {"closed": True, "points": superellipse_path(360, 572, 148, 98, 1.38, 40)},
    ]


def neon_rails() -> list[dict]:
    return [
        {
            "closed": False,
            "points": [
                {"x": 110, "y": 240}, {"x": 360, "y": 390}, {"x": 610, "y": 240},
            ],
        },
        {
            "closed": False,
            "points": [
                {"x": 110, "y": 660}, {"x": 360, "y": 510}, {"x": 610, "y": 660},
            ],
        },
        {
            "closed": False,
            "points": [{"x": 360, "y": 200}, {"x": 360, "y": 700}],
        },
    ]


def thieves(count: int, speed: float, drain_step: int = 72) -> list[dict]:
    spots = [
        (140, 220), (360, 220), (560, 220),
        (140, 380), (360, 380), (560, 380),
        (140, 540), (360, 540), (560, 540),
        (250, 680), (470, 680), (360, 300),
    ]
    out = []
    for i in range(count):
        x, y = spots[i % len(spots)]
        out.append({
            "type": "thief",
            "x": x,
            "y": y,
            "vx": 24 if i % 2 == 0 else -22,
            "vy": -18 if i % 3 == 0 else 20,
            "speed": speed,
            "drainStep": drain_step,
            "noticeInterval": 4000,
        })
    return out


def campaign_levels(lab: list[dict]) -> list[dict]:
    two_halves = [
        poly("poly_red_1", "red", 68, 158, 292, 584),
        poly("poly_blue_1", "blue", 360, 158, 292, 584),
    ]
    three_stripes = [
        poly("poly_red_1", "red", 68, 158, 194, 584),
        poly("poly_green_1", "green", 262, 158, 196, 584),
        poly("poly_blue_1", "blue", 458, 158, 194, 584),
    ]
    three_blocks = [
        poly("poly_red_1", "red", 68, 158, 292, 584),
        poly("poly_blue_1", "blue", 360, 158, 292, 292),
        poly("poly_yellow_1", "yellow", 360, 450, 292, 292),
    ]
    stained = [
        poly("poly_red_1", "red", 68, 158, 292, 292),
        poly("poly_blue_1", "blue", 360, 158, 292, 292),
        poly("poly_yellow_1", "yellow", 68, 450, 292, 292),
        poly("poly_green_1", "green", 360, 450, 292, 292),
    ]
    split = [
        shape("poly_red_1", "red", [
            {"x": 68, "y": 158}, {"x": 652, "y": 158}, {"x": 68, "y": 742},
        ]),
        shape("poly_blue_1", "blue", [
            {"x": 652, "y": 158}, {"x": 652, "y": 742}, {"x": 68, "y": 742},
        ]),
    ]
    onion = ring("poly_red", "red", 68, 158, 584, 584, 122) + ring(
        "poly_blue", "blue", 190, 280, 340, 340, 60
    ) + [
        poly("poly_yellow_1", "yellow", 250, 340, 220, 220),
    ]
    orbit_colors = orbit_field()
    orbit_path = [{"closed": True, "points": superellipse_path(360, 450, 132, 132, 1.32, 48)}]
    spider = {
        "type": "fieldBoss",
        "x": 360,
        "y": 430,
        "radius": 46,
        "initialDelay": 0,
        "attackInterval": 1250,
        "radialBullets": 6,
        "aimedEvery": 2,
        "bulletSpeed": 76,
        "maxProjectiles": 64,
        "nodes": [
            {"id": "leg_nw", "x": 180, "y": 250},
            {"id": "leg_ne", "x": 540, "y": 250},
            {"id": "leg_sw", "x": 180, "y": 610},
            {"id": "leg_se", "x": 540, "y": 610},
        ],
    }

    return [
        base(
            id=1,
            pack="campaign",
            name="Витраж",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}, {"color": "green"}],
            polygons=stained,
            constraints={"maxCuts": 3, "winCondition": "vials"},
        ),
        base(
            id=2,
            pack="campaign",
            name="Раскол",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "red"}],
            polygons=split,
            constraints={"maxCuts": 2, "winCondition": "vials"},
        ),
        base(
            id=3,
            pack="campaign",
            name="Луковица",
            playerSpeed=230,
            vials=[{"color": "red"}, {"color": "red"}, {"color": "blue"}, {"color": "yellow"}],
            polygons=onion,
            constraints={"time": 20, "winCondition": "vials"},
        ),
        base(
            id=4,
            pack="campaign",
            name="Сосед",
            vials=[{"color": "red"}, {"color": "blue"}],
            enemies=[{"type": "pingpong", "x": 220, "y": 420, "vx": 78, "vy": 60}],
            polygons=two_halves,
            playerSpeed=220,
            constraints={"catchEnemies": 1, "winCondition": "catch"},
        ),
        base(
            id=5,
            pack="campaign",
            name="Орбита",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}],
            magnetSnapRadius=26,
            magnetDetachDistance=36,
            magnetRideSpeedFactor=2.58,
            magneticPaths=orbit_path,
            enemies=[
                {"type": "pingpong", "x": 200, "y": 400, "vx": 70, "vy": 54},
                {"type": "pingpong", "x": 500, "y": 520, "vx": -64, "vy": 48},
            ],
            polygons=orbit_colors,
        ),
        base(
            id=6,
            pack="campaign",
            name="Сюрприз",
            maxLives=5,
            vials=[
                {"color": "red"}, {"color": "blue"}, {"color": "yellow"},
                {"color": "green"}, {"color": "purple"},
            ],
            enemies=[
                {"type": "rover", "x": 140, "y": 240, "vx": 52, "vy": 40},
                {"type": "rover", "x": 560, "y": 260, "vx": -48, "vy": 36},
                {"type": "rover", "x": 200, "y": 620, "vx": 44, "vy": -38},
                {"type": "rover", "x": 520, "y": 600, "vx": -40, "vy": -42},
                {"type": "rover", "x": 360, "y": 430, "vx": 36, "vy": 50},
            ],
            boosters=[
                {"type": "shield", "x": 150, "y": 260, "duration": 7000},
                {"type": "mystery", "x": 360, "y": 450, "spawnDelay": 2500},
                {"type": "speed", "x": 560, "y": 620, "duration": 5500, "multiplier": 1.45},
                {"type": "life", "x": 200, "y": 620, "amount": 1},
            ],
            polygons=five_stripes(),
        ),
        base(
            id=7,
            pack="campaign",
            name="Союзник",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}],
            enemies=thieves(6, 64, 96),
            polygons=[
                poly("poly_red_1", "red", 68, 158, 184, 584),
                poly("poly_blue_1", "blue", 268, 158, 184, 584),
                poly("poly_yellow_1", "yellow", 468, 158, 184, 584),
            ],
            claimed=[
                poly("gap_1", "paper", 252, 158, 16, 584),
                poly("gap_2", "paper", 452, 158, 16, 584),
            ],
        ),
        base(
            id=8,
            pack="campaign",
            name="Лихорадка",
            playerSpeed=250,
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "red"}],
            enemies=[{"type": "pingpong", "x": 500, "y": 360, "vx": 86, "vy": 64}],
            boosters=[{"type": "shield", "x": 360, "y": 450, "duration": 5000}],
            constraints={"time": 10, "winCondition": "vials"},
            polygons=two_halves,
        ),
        base(
            id=9,
            pack="campaign",
            name="Конфетти",
            vials=[
                {"color": "red"}, {"color": "blue"}, {"color": "yellow"},
                {"color": "green"}, {"color": "purple"},
            ],
            polygons=confetti_tiles(),
        ),
        base(
            id=10,
            pack="campaign",
            name="Стробоскоп",
            vials=[
                {"color": "red"}, {"color": "blue"}, {"color": "yellow"},
                {"color": "green"}, {"color": "purple"},
            ],
            enemies=[
                {"type": "turret", "x": 140, "y": 220, "shotInterval": 2600, "bulletSpeed": 120, "initialDelay": 3600},
                {"type": "turret", "x": 560, "y": 220, "shotInterval": 2700, "bulletSpeed": 120, "initialDelay": 4000},
                {"type": "turret", "x": 140, "y": 660, "shotInterval": 2800, "bulletSpeed": 120, "initialDelay": 4400},
                {"type": "turret", "x": 560, "y": 660, "shotInterval": 2500, "bulletSpeed": 120, "initialDelay": 3800},
                {"type": "laser", "x": 200, "y": 220, "angle": 90, "length": 260, "interval": 4000, "warning": 1200, "activeTime": 650, "phase": 200},
                {"type": "laser", "x": 500, "y": 220, "angle": 90, "length": 260, "interval": 4200, "warning": 1200, "activeTime": 650, "phase": 900},
                {"type": "laser", "x": 250, "y": 700, "angle": 270, "length": 240, "interval": 4100, "warning": 1200, "activeTime": 650, "phase": 1500},
                {"type": "laser", "x": 470, "y": 700, "angle": 270, "length": 240, "interval": 4300, "warning": 1200, "activeTime": 650, "phase": 2100},
            ],
            polygons=five_stripes(),
        ),
        base(
            id=11,
            pack="campaign",
            name="Крепость",
            maxLives=5,
            playerSpeed=220,
            vials=[{"color": "red"}, {"color": "blue"}],
            boosters=[
                {"type": "shield", "x": 360, "y": 650, "duration": 6000},
                {"type": "slow", "x": 150, "y": 260, "duration": 4500, "multiplier": 0.55, "lifetime": 2800, "spawnDelay": 400},
                {"type": "slow", "x": 570, "y": 260, "duration": 4500, "multiplier": 0.55, "lifetime": 3200, "spawnDelay": 1100},
                {"type": "slow", "x": 360, "y": 430, "duration": 4500, "multiplier": 0.55, "lifetime": 2600, "spawnDelay": 1800},
                {"type": "hurt", "x": 180, "y": 540, "lifetime": 3000, "spawnDelay": 700},
                {"type": "hurt", "x": 540, "y": 540, "lifetime": 2800, "spawnDelay": 1600},
            ],
            antiBoosters={
                "interval": 2400,
                "types": ["slow", "slow", "hurt"],
                "lifetime": 3200,
                "maxAlive": 4,
                "immediate": True,
            },
            boss={
                "type": "bulletHell",
                "x": 360,
                "y": 370,
                "radius": 40,
                "health": 28,
                "initialDelay": 0,
                "attackInterval": 2100,
                "radialBullets": 6,
                "aimedEvery": 3,
                "bulletSpeed": 90,
                "maxProjectiles": 64,
                "towerDamage": 1,
                "towerFireInterval": 900,
                "towerBulletSpeed": 280,
                "towerSlots": [{"x": 95, "y": 185}, {"x": 625, "y": 185}],
            },
            constraints={"winCondition": "boss"},
            polygons=two_halves,
        ),
        base(
            id=12,
            pack="campaign",
            name="Поляна",
            vials=[{"color": "green"}, {"color": "yellow"}],
            polygons=[
                poly("poly_green_1", "green", 68, 158, 584, 292),
                poly("poly_yellow_1", "yellow", 68, 450, 584, 292),
            ],
        ),
        base(
            id=13,
            pack="campaign",
            name="Часы",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}, {"color": "green"}],
            polygons=pie_wedges(360, 450, ["red", "blue", "yellow", "green"], 8),
            constraints={"maxCuts": 3, "winCondition": "vials"},
        ),
        base(
            id=14,
            pack="campaign",
            name="Неон",
            playerSpeed=230,
            vials=[
                {"color": "red"}, {"color": "yellow"},
                {"color": "blue"}, {"color": "green"},
            ],
            magnetSnapRadius=24,
            magnetDetachDistance=34,
            magnetRideSpeedFactor=2.05,
            magneticPaths=neon_rails(),
            enemies=[
                {
                    "type": "laser", "x": 140, "y": 450, "angle": 0, "length": 180,
                    "interval": 3600, "warning": 1000, "activeTime": 600, "phase": 0,
                },
                {
                    "type": "laser", "x": 580, "y": 450, "angle": 180, "length": 180,
                    "interval": 3600, "warning": 1000, "activeTime": 600, "phase": 1800,
                },
                {"type": "chase", "x": 360, "y": 240, "vx": 36, "vy": 28, "speed": 62},
            ],
            boosters=[{"type": "speed", "x": 360, "y": 450, "duration": 5000, "multiplier": 1.4}],
            polygons=chevron_bands(["red", "yellow", "blue", "green"], 42, 2),
        ),
        base(
            id=15,
            pack="campaign",
            name="Клетка",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}, {"color": "green"}],
            enemies=[
                {"type": "pingpong", "x": 200, "y": 300, "vx": 72, "vy": 50},
                {"type": "pingpong", "x": 500, "y": 560, "vx": -68, "vy": 46},
            ],
            polygons=stained,
            constraints={"catchEnemies": 2, "winCondition": "catch"},
        ),
        base(
            id=16,
            pack="campaign",
            name="Зачистка",
            playerSpeed=225,
            vials=[{"color": "red"}],
            polygons=[poly("poly_red_1", "red", 68, 158, 584, 584)],
            constraints={"coverPercent": 50, "winCondition": "coverage"},
        ),
        base(
            id=17,
            pack="campaign",
            name="Охота",
            playerSpeed=225,
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}, {"color": "green"}],
            enemies=[
                {"type": "chase", "x": 200, "y": 280, "vx": 48, "vy": 36, "speed": 70},
                {"type": "chase", "x": 500, "y": 280, "vx": -42, "vy": 34, "speed": 64},
                {"type": "chase", "x": 200, "y": 600, "vx": 40, "vy": -30, "speed": 76},
                {"type": "chase", "x": 520, "y": 600, "vx": -46, "vy": -28, "speed": 68},
            ],
            polygons=stained,
        ),
        base(
            id=18,
            pack="campaign",
            name="Перекрёсток",
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "yellow"}, {"color": "green"}],
            enemies=[
                {"type": "laser", "x": 360, "y": 180, "angle": 90, "length": 300, "interval": 3800, "warning": 1100, "activeTime": 700, "phase": 0},
                {"type": "laser", "x": 360, "y": 720, "angle": 270, "length": 300, "interval": 3800, "warning": 1100, "activeTime": 700, "phase": 1900},
                {"type": "laser", "x": 100, "y": 450, "angle": 0, "length": 280, "interval": 4000, "warning": 1100, "activeTime": 700, "phase": 900},
                {"type": "laser", "x": 620, "y": 450, "angle": 180, "length": 280, "interval": 4000, "warning": 1100, "activeTime": 700, "phase": 2800},
                {"type": "turret", "x": 160, "y": 240, "shotInterval": 2400, "bulletSpeed": 130, "initialDelay": 500},
                {"type": "turret", "x": 560, "y": 640, "shotInterval": 2400, "bulletSpeed": 130, "initialDelay": 1100},
            ],
            polygons=stained,
        ),
        base(
            id=19,
            pack="campaign",
            name="Буря",
            playerSpeed=235,
            vials=[{"color": "red"}, {"color": "blue"}, {"color": "green"}],
            enemies=[
                {"type": "pingpong", "x": 200, "y": 320, "vx": 80, "vy": 58},
                {"type": "pingpong", "x": 520, "y": 560, "vx": -74, "vy": 50},
                {"type": "rover", "x": 360, "y": 240, "vx": 46, "vy": 40},
                {"type": "rover", "x": 360, "y": 640, "vx": -42, "vy": -36},
            ],
            boosters=[
                {"type": "shield", "x": 360, "y": 450, "duration": 5000},
                {"type": "speed", "x": 140, "y": 620, "duration": 4000, "multiplier": 1.4},
            ],
            constraints={"time": 7, "winCondition": "vials"},
            polygons=three_stripes,
        ),
        base(
            id=20,
            pack="campaign",
            name="Паутина",
            playerSpeed=215,
            vials=[{"color": "purple"}, {"color": "purple"}],
            boss=spider,
            constraints={"winCondition": "boss"},
            polygons=[poly("poly_purple_1", "purple", 68, 158, 584, 584)],
        ),
        base(
            id=21,
            pack="campaign",
            name="Спираль",
            vials=[
                {"color": "red"}, {"color": "red"},
                {"color": "blue"}, {"color": "blue"},
                {"color": "yellow"}, {"color": "green"},
            ],
            enemies=[{"type": "pingpong", "x": 360, "y": 210, "vx": 64, "vy": 40}],
            polygons=square_spiral(["red", "blue", "yellow", "green"], 62),
            constraints={"maxCuts": 5, "winCondition": "vials"},
        ),
        base(
            id=22,
            pack="campaign",
            name="Песок",
            playerSpeed=230,
            vials=[
                {"color": "red"}, {"color": "red"},
                {"color": "yellow"},
                {"color": "blue"}, {"color": "blue"},
            ],
            enemies=[
                {"type": "pingpong", "x": 200, "y": 360, "vx": 62, "vy": 44},
                {"type": "chase", "x": 500, "y": 620, "vx": -40, "vy": -28, "speed": 68},
            ],
            constraints={"time": 15, "winCondition": "vials"},
            polygons=hourglass(),
        ),
        base(
            id=23,
            pack="campaign",
            name="Восьмёрка",
            vials=[
                {"color": "red"}, {"color": "red"},
                {"color": "yellow"},
                {"color": "blue"}, {"color": "blue"},
            ],
            magnetSnapRadius=24,
            magnetDetachDistance=34,
            magnetRideSpeedFactor=2.1,
            magneticPaths=figure8_paths(),
            enemies=[
                {"type": "rover", "x": 360, "y": 450, "vx": 44, "vy": 38},
                {"type": "chase", "x": 220, "y": 300, "vx": 36, "vy": 30, "speed": 62},
            ],
            polygons=slanted_stripes(["red", "yellow", "blue"], 96),
        ),
        base(
            id=24,
            pack="campaign",
            name="Конверт",
            vials=[
                {"color": "green"}, {"color": "green"},
                {"color": "yellow"}, {"color": "yellow"},
                {"color": "red"}, {"color": "blue"},
            ],
            enemies=[
                {"type": "chase", "x": 360, "y": 620, "vx": 30, "vy": -40, "speed": 72},
                {"type": "chase", "x": 200, "y": 280, "vx": 42, "vy": 34, "speed": 66},
                {"type": "pingpong", "x": 500, "y": 300, "vx": 68, "vy": 50},
                {"type": "pingpong", "x": 180, "y": 560, "vx": -62, "vy": 46},
                {"type": "rover", "x": 520, "y": 620, "vx": -44, "vy": -38},
                {"type": "turret", "x": 360, "y": 240, "shotInterval": 2600, "bulletSpeed": 130, "initialDelay": 700},
            ],
            antiBoosters={
                "interval": 1600,
                "types": ["slow", "hurt", "slow"],
                "persist": True,
                "maxAlive": 8,
                "immediate": True,
            },
            polygons=envelope(),
            constraints={"coverPercent": 35, "winCondition": "all"},
        ),
        base(
            id=25,
            pack="campaign",
            name="Крест",
            vials=[
                {"color": "yellow"}, {"color": "yellow"},
                {"color": "red"}, {"color": "blue"},
                {"color": "green"}, {"color": "purple"},
            ],
            enemies=[{"type": "pingpong", "x": 360, "y": 450, "vx": 54, "vy": 42}],
            polygons=plus_field(),
            constraints={"maxCuts": 3, "winCondition": "vials"},
        ),
        base(
            id=26,
            pack="campaign",
            name="Мишень",
            vials=[
                {"color": "green"}, {"color": "green"},
                {"color": "blue"}, {"color": "blue"},
                {"color": "red"}, {"color": "yellow"},
            ],
            enemies=[
                {"type": "pingpong", "x": 240, "y": 330, "vx": 58, "vy": 42},
                {"type": "pingpong", "x": 160, "y": 450, "vx": -50, "vy": 38},
                {
                    "type": "turret", "x": 334, "y": 424,
                    "shotInterval": 2400, "bulletSpeed": 140, "initialDelay": 400, "r": 13,
                },
                {
                    "type": "turret", "x": 386, "y": 424,
                    "shotInterval": 2400, "bulletSpeed": 140, "initialDelay": 700, "r": 13,
                },
                {
                    "type": "turret", "x": 334, "y": 476,
                    "shotInterval": 2400, "bulletSpeed": 140, "initialDelay": 1000, "r": 13,
                },
                {
                    "type": "turret", "x": 386, "y": 476,
                    "shotInterval": 2400, "bulletSpeed": 140, "initialDelay": 1300, "r": 13,
                },
            ],
            polygons=nested_frames(),
            constraints={"catchEnemies": 6, "winCondition": "all"},
        ),
        base(
            id=27,
            pack="campaign",
            name="Луна",
            vials=[
                {"color": "yellow"}, {"color": "yellow"}, {"color": "yellow"},
                {"color": "purple"},
            ],
            enemies=[
                {
                    "type": "turret", "x": 580, "y": 230,
                    "shotInterval": 2100, "bulletSpeed": 150, "initialDelay": 600,
                },
                {
                    "type": "turret", "x": 580, "y": 688,
                    "shotInterval": 2100, "bulletSpeed": 150, "initialDelay": 1500,
                },
                {
                    "type": "laser", "x": 200, "y": 180, "angle": 90, "length": 240,
                    "interval": 3800, "warning": 1100, "activeTime": 650, "phase": 200,
                },
                {
                    "type": "laser", "x": 140, "y": 450, "angle": 0, "length": 200,
                    "interval": 4000, "warning": 1100, "activeTime": 650, "phase": 1400,
                },
                {
                    "type": "laser", "x": 500, "y": 720, "angle": 270, "length": 220,
                    "interval": 3900, "warning": 1100, "activeTime": 650, "phase": 2400,
                },
            ],
            boosters=[{"type": "removeEnemy", "x": 200, "y": 450}],
            antiBoosters={"interval": 7000, "types": ["slow"]},
            polygons=moon_field(),
        ),
        base(
            id=28,
            pack="campaign",
            name="Соты",
            vials=[
                {"color": "yellow"}, {"color": "yellow"},
                {"color": "red"}, {"color": "blue"},
                {"color": "green"}, {"color": "purple"},
            ],
            enemies=[
                {"type": "pingpong", "x": 360, "y": 450, "vx": 58, "vy": 46},
                {"type": "chase", "x": 200, "y": 250, "vx": 40, "vy": 36, "speed": 70},
            ],
            boosters=[
                {"type": "mystery", "x": 360, "y": 250, "spawnDelay": 900},
                {"type": "speed", "x": 360, "y": 650, "duration": 5000, "multiplier": 1.4},
            ],
            polygons=hex_in_square(),
        ),
        base(
            id=29,
            pack="campaign",
            name="Волна",
            playerSpeed=230,
            vials=[
                {"color": "red"}, {"color": "red"}, {"color": "red"},
                {"color": "blue"}, {"color": "yellow"},
            ],
            enemies=[
                {
                    "type": "laser", "x": 200, "y": 180, "angle": 90, "length": 300,
                    "interval": 3400, "warning": 1000, "activeTime": 600, "phase": 0,
                },
                {
                    "type": "laser", "x": 520, "y": 720, "angle": 270, "length": 300,
                    "interval": 3600, "warning": 1000, "activeTime": 600, "phase": 1700,
                },
                {"type": "chase", "x": 360, "y": 450, "vx": 40, "vy": 32, "speed": 74},
            ],
            polygons=wave_stripes(["red", "blue", "red", "yellow", "green"], 30, 2),
            constraints={"time": 32, "coverPercent": 45, "winCondition": "all"},
        ),
        base(
            id=30,
            pack="campaign",
            name="Страж",
            playerSpeed=220,
            vials=[
                {"color": "red"},
                {"color": "blue"},
                {"color": "green"},
            ],
            boss={
                "type": "colorBoss",
                "title": "СТРАЖ",
                "x": 360,
                "y": 450,
                "radius": 44,
                "initialDelay": 800,
                "attackInterval": 2200,
                "radialBullets": 6,
                "aimedEvery": 2,
                "bulletSpeed": 88,
                "maxProjectiles": 64,
                "moveSpeed": 52,
                "vx": 38,
                "vy": 30,
                "cutPercent": 0.5,
                "colors": ["red", "blue", "green"],
            },
            constraints={"winCondition": "all"},
            polygons=tri_sectors(["red", "blue", "green"]),
        ),
    ]


def main() -> None:
    pack = json.loads(SRC.read_text(encoding="utf-8"))
    raw_levels = pack.get("levels") or []
    lab_src = [level for level in raw_levels if level.get("pack") == "lab"]
    if not lab_src:
        lab_src = [
            level for level in raw_levels
            if level.get("pack") not in ("training", "campaign")
        ]

    lab = []
    for level in lab_src:
        item = json.loads(json.dumps(level))
        item["pack"] = "lab"
        item["hint"] = LAB_HINTS.get(item["id"], item.get("hint", ""))
        item.setdefault("tutorials", [])
        lab.append(item)

    training = training_levels(lab)
    campaign = campaign_levels(lab)
    out = {
        "palette": pack["palette"],
        "packs": {
            "training": {
                "id": "training",
                "title": "Обучение",
                "unlock": "sequential",
            },
            "campaign": {
                "id": "campaign",
                "title": "Кампания",
                "unlock": "sequential",
            },
            "lab": {
                "id": "lab",
                "title": "Лаборатория",
                "unlock": "all",
            },
        },
        "levels": training + campaign + lab,
    }
    SRC.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(out['levels'])} levels: "
        f"training={len(training)} campaign={len(campaign)} lab={len(lab)}"
    )


if __name__ == "__main__":
    main()
