#!/usr/bin/env python3
"""Static validator for the game_v5 level JSON contract."""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path


ENEMY_TYPES = {"pingpong", "rover", "chase", "turret", "laser", "thief"}
BOOSTER_TYPES = {
    "speed", "slow", "life", "shield", "enemySlow", "removeEnemy", "mystery"
}
WIN_CONDITIONS = {"vials", "coverage", "all", "boss", "catch"}
BOSS_TYPES = {"bulletHell", "fieldBoss", "colorBoss"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")


def number(value: object) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def polygon_area(points: list[dict]) -> float:
    total = 0.0
    for index, point in enumerate(points):
        other = points[(index + 1) % len(points)]
        total += point["x"] * other["y"] - other["x"] * point["y"]
    return abs(total) / 2


def validate_point(
    report: Report,
    where: str,
    point: object,
    rect: dict,
    allow_frame: bool = False,
) -> bool:
    if not isinstance(point, dict) or not number(point.get("x")) or not number(point.get("y")):
        report.error(where, "ожидалась точка с числовыми x и y")
        return False
    margin = 0 if allow_frame else rect["frame"]
    min_x = rect["x"] + margin
    max_x = rect["x"] + rect["w"] - margin
    min_y = rect["y"] + margin
    max_y = rect["y"] + rect["h"] - margin
    if not (min_x <= point["x"] <= max_x and min_y <= point["y"] <= max_y):
        report.error(
            where,
            f"точка ({point['x']}, {point['y']}) вне допустимого поля "
            f"[{min_x}..{max_x}] × [{min_y}..{max_y}]",
        )
        return False
    return True


def validate_level(
    report: Report,
    level: dict,
    palette: set[str],
    svg_dir: Path,
    pack_id: str,
) -> None:
    level_id = level.get("id")
    where = f"{pack_id}/{level_id}"
    bounds = level.get("bounds")
    if not isinstance(bounds, dict):
        report.error(where, "нет bounds")
        return
    rect = {
        "x": bounds.get("x"),
        "y": bounds.get("y"),
        "w": bounds.get("w"),
        "h": bounds.get("h"),
        "frame": bounds.get("frame", 28),
    }
    if not all(number(value) for value in rect.values()) or rect["w"] <= 0 or rect["h"] <= 0:
        report.error(where, "bounds должен содержать положительные числовые x/y/w/h/frame")
        return

    source_svg = level.get("sourceSvg")
    if source_svg and not (svg_dir / source_svg).is_file():
        report.error(where, f"не найден sourceSvg: {source_svg}")

    polygons = level.get("polygons", [])
    if not isinstance(polygons, list) or not polygons:
        report.error(where, "нужен хотя бы один цветной полигон")
        return

    polygon_ids: set[str] = set()
    area_by_color: dict[str, float] = defaultdict(float)
    total_area = 0.0
    for index, polygon in enumerate(polygons):
        poly_where = f"{where}.polygons[{index}]"
        poly_id = polygon.get("id")
        color = polygon.get("color")
        points = polygon.get("points")
        if not isinstance(poly_id, str) or not poly_id:
            report.error(poly_where, "нет строкового id")
        elif poly_id in polygon_ids:
            report.error(poly_where, f"повторяющийся id {poly_id!r}")
        else:
            polygon_ids.add(poly_id)
        if color not in palette:
            report.error(poly_where, f"цвет {color!r} отсутствует в palette")
        if not isinstance(points, list) or len(points) < 3:
            report.error(poly_where, "полигон должен иметь минимум три точки")
            continue
        if not all(
            validate_point(report, f"{poly_where}.points[{i}]", point, rect)
            for i, point in enumerate(points)
        ):
            continue
        area = polygon_area(points)
        if area < 80:
            report.error(poly_where, f"слишком малая площадь: {area:.1f}")
        area_by_color[color] += area
        total_area += area

    vials = level.get("vials", [])
    if not isinstance(vials, list):
        report.error(where, "vials должен быть массивом")
        vials = []
    vial_counts = Counter()
    for index, vial in enumerate(vials):
        color = vial.get("color") if isinstance(vial, dict) else None
        if color not in palette:
            report.error(f"{where}.vials[{index}]", f"неизвестный цвет {color!r}")
        elif color not in area_by_color:
            report.error(f"{where}.vials[{index}]", f"на поле нет цвета {color!r}")
        vial_counts[color] += 1

    capacity = total_area * 0.10
    for color, count in vial_counts.items():
        available = area_by_color.get(color, 0)
        required = count * capacity
        if available + 1 < required:
            report.error(
                where,
                f"цвета {color!r} недостаточно: {available:.0f} < {required:.0f}",
            )
        elif available < required * 1.05:
            report.warn(
                where,
                f"цвет {color!r} не имеет рекомендуемого запаса 5%",
            )

    for index, enemy in enumerate(level.get("enemies", [])):
        enemy_where = f"{where}.enemies[{index}]"
        if enemy.get("type") not in ENEMY_TYPES:
            report.error(enemy_where, f"неизвестный type {enemy.get('type')!r}")
        validate_point(report, enemy_where, enemy, rect)

    for index, booster in enumerate(level.get("boosters", [])):
        booster_where = f"{where}.boosters[{index}]"
        if booster.get("type") not in BOOSTER_TYPES:
            report.error(booster_where, f"неизвестный type {booster.get('type')!r}")
        validate_point(report, booster_where, booster, rect)

    constraints = level.get("constraints", {})
    win_condition = constraints.get("winCondition")
    if win_condition is not None and win_condition not in WIN_CONDITIONS:
        report.error(where, f"неизвестный winCondition {win_condition!r}")
    for key in ("time", "coverPercent", "maxCuts", "catchEnemies"):
        if key in constraints and (not number(constraints[key]) or constraints[key] <= 0):
            report.error(where, f"constraints.{key} должен быть положительным числом")

    for index, path in enumerate(level.get("magneticPaths", [])):
        points = path.get("points", [])
        path_where = f"{where}.magneticPaths[{index}]"
        if not isinstance(points, list) or len(points) < 2:
            report.error(path_where, "путь должен иметь минимум две точки")
            continue
        for point_index, point in enumerate(points):
            validate_point(
                report,
                f"{path_where}.points[{point_index}]",
                point,
                rect,
            )

    boss = level.get("boss")
    if boss is not None:
        validate_boss(report, where, boss, rect, len(vials))
    if win_condition == "catch" and not (number(constraints.get("catchEnemies")) and constraints.get("catchEnemies", 0) > 0):
        report.error(where, "winCondition 'catch' требует catchEnemies > 0")
    if win_condition == "boss" and not boss:
        report.error(where, "winCondition 'boss' требует объект boss")


def validate_boss(
    report: Report,
    level_where: str,
    boss: object,
    rect: dict,
    vial_count: int,
) -> None:
    where = f"{level_where}.boss"
    if not isinstance(boss, dict):
        report.error(where, "boss должен быть объектом")
        return
    boss_type = boss.get("type")
    if boss_type not in BOSS_TYPES:
        report.error(where, f"неизвестный type {boss_type!r}")
        return
    validate_point(report, where, boss, rect)
    if not number(boss.get("radius", 0)) or boss.get("radius", 0) <= 0:
        report.error(where, "radius должен быть положительным числом")

    if boss_type == "bulletHell":
        if not number(boss.get("health", 0)) or boss.get("health", 0) <= 0:
            report.error(where, "bulletHell требует положительный health")
        slots = boss.get("towerSlots", [])
        if len(slots) < vial_count:
            report.warn(
                where,
                f"towerSlots ({len(slots)}) меньше числа пробирок ({vial_count})",
            )
        for index, slot in enumerate(slots):
            validate_point(
                report,
                f"{where}.towerSlots[{index}]",
                slot,
                rect,
                allow_frame=True,
            )
    elif boss_type == "fieldBoss":
        nodes = boss.get("nodes", [])
        if not isinstance(nodes, list) or not nodes:
            report.error(where, "fieldBoss требует непустой nodes")
            return
        node_ids: set[str] = set()
        for index, node in enumerate(nodes):
            node_where = f"{where}.nodes[{index}]"
            node_id = node.get("id") if isinstance(node, dict) else None
            if not isinstance(node_id, str) or not node_id:
                report.error(node_where, "нужен строковый id")
            elif node_id in node_ids:
                report.error(node_where, f"повторяющийся id {node_id!r}")
            else:
                node_ids.add(node_id)
            validate_point(report, node_where, node, rect)
    elif boss_type == "colorBoss":
        colors = boss.get("colors")
        if not isinstance(colors, list) or not colors:
            report.error(where, "colorBoss требует непустой colors")
            return
        if len(colors) > 4:
            report.error(where, "colorBoss: не больше 4 полосок")
        for index, color in enumerate(colors):
            if not isinstance(color, str) or not color:
                report.error(f"{where}.colors[{index}]", "нужен цвет")
        cut = boss.get("cutPercent", 0.5)
        if number(cut) and not (0 < cut <= 1):
            report.error(where, "cutPercent должен быть в (0, 1]")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "json_path",
        nargs="?",
        default=str(Path(__file__).parents[1] / "levels" / "levels.json"),
    )
    args = parser.parse_args()
    json_path = Path(args.json_path).resolve()
    report = Report()

    try:
        pack = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    palette_data = pack.get("palette")
    packs_meta = pack.get("packs") or {}
    levels = pack.get("levels")
    if not isinstance(palette_data, dict) or not palette_data:
        report.error("root", "palette должен быть непустым объектом")
        palette_data = {}
    if not isinstance(levels, list) or not levels:
        report.error("root", "levels должен быть непустым массивом")
        levels = []

    known_packs = {"training", "lab", "campaign"}
    if packs_meta:
        extra = set(packs_meta) - known_packs
        for pack_id in extra:
            report.warn("root", f"неизвестный pack {pack_id!r}")

    by_pack: dict[str, list[int]] = defaultdict(list)
    for level in levels:
        if not isinstance(level, dict):
            report.error("root", "каждый уровень должен быть объектом")
            continue
        pack_id = level.get("pack") or "training"
        if pack_id not in known_packs:
            report.error("root", f"уровень {level.get('id')} имеет неизвестный pack {pack_id!r}")
        if not isinstance(level.get("id"), int):
            report.error("root", "id уровня должен быть целым числом")
            continue
        by_pack[pack_id].append(level["id"])

    for pack_id, ids in by_pack.items():
        if len(ids) != len(set(ids)):
            report.error("root", f"id в паке {pack_id} должны быть уникальными")
        expected = list(range(1, len(ids) + 1))
        if sorted(ids) != expected:
            report.error("root", f"id пака {pack_id} должны идти подряд: {expected}")

    svg_dir = json_path.parent / "svg"
    for level in levels:
        if not isinstance(level, dict):
            continue
        validate_level(
            report,
            level,
            set(palette_data),
            svg_dir,
            level.get("pack") or "training",
        )

    for warning in report.warnings:
        print(f"WARNING: {warning}")
    for error in report.errors:
        print(f"ERROR: {error}", file=sys.stderr)

    print(
        f"Checked {len(levels)} levels in {len(by_pack)} packs: "
        f"{len(report.errors)} errors, {len(report.warnings)} warnings"
    )
    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
