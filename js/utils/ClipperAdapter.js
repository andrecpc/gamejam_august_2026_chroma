/**
 * Обёртка над Clipper.js. Координаты игры — float, Clipper работает в int.
 */
var SCALE = 100;

function lib() {
    if (!window.ClipperLib) {
        throw new Error('ClipperLib не загружен. Проверь lib/clipper.js');
    }
    return window.ClipperLib;
}

function toClip(points) {
    return points.map(function (p) {
        return { X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) };
    });
}

function fromClip(path) {
    return path.map(function (p) {
        return { x: p.X / SCALE, y: p.Y / SCALE };
    });
}

export function simplifyPoly(path) {
    var C = lib();
    if (!path || path.length < 3) return [];
    var cleaned = C.Clipper.CleanPolygon(toClip(path), 0.6 * SCALE);
    if (!cleaned || cleaned.length < 3) return [];
    if (C.Clipper.Area(cleaned) < 0) cleaned.reverse();
    return fromClip(cleaned);
}

export function tidyLight(path) {
    if (!path || path.length < 3) return [];
    var out = [];
    for (var i = 0; i < path.length; i++) {
        var p = path[i];
        var prev = out.length ? out[out.length - 1] : null;
        if (!prev || Math.abs(prev.x - p.x) > 0.15 || Math.abs(prev.y - p.y) > 0.15) {
            out.push({ x: p.x, y: p.y });
        }
    }
    if (out.length >= 2) {
        var a = out[0], b = out[out.length - 1];
        if (Math.abs(a.x - b.x) < 0.15 && Math.abs(a.y - b.y) < 0.15) out.pop();
    }
    return out.length >= 3 ? out : [];
}

export function polygonArea(points) {
    if (!points || points.length < 3) return 0;
    return Math.abs(lib().Clipper.Area(toClip(points))) / (SCALE * SCALE);
}

export function polygonPerimeter(points) {
    if (!points || points.length < 2) return 0;
    var p = 0;
    for (var i = 0; i < points.length; i++) {
        var a = points[i];
        var b = points[(i + 1) % points.length];
        var dx = b.x - a.x, dy = b.y - a.y;
        p += Math.sqrt(dx * dx + dy * dy);
    }
    return p;
}

export function isSliver(points, minArea) {
    var a = polygonArea(points);
    if (a < minArea) return true;
    var peri = polygonPerimeter(points);
    if (peri < 8) return true;
    var compact = (4 * Math.PI * a) / (peri * peri);
    return compact < 0.02 && a < minArea * 4;
}

export function pointInPolygon(x, y, points) {
    if (!points || points.length < 3) return false;
    return lib().Clipper.PointInPolygon(
        { X: Math.round(x * SCALE), Y: Math.round(y * SCALE) },
        toClip(points)
    ) !== 0;
}

function clipOp(subjects, clips, clipType, light) {
    var C = lib();
    var cpr = new C.Clipper();
    var added = false;
    subjects.forEach(function (p) {
        if (p && p.length >= 3) {
            cpr.AddPath(toClip(p), C.PolyType.ptSubject, true);
            added = true;
        }
    });
    if (!added) return [];
    clips.forEach(function (p) {
        if (p && p.length >= 3) cpr.AddPath(toClip(p), C.PolyType.ptClip, true);
    });
    var solution = new C.Paths();
    cpr.Execute(clipType, solution, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    return solution.map(fromClip).map(function (p) {
        return light ? tidyLight(p) : simplifyPoly(p);
    }).filter(function (p) { return p.length >= 3; });
}

export function difference(subjects, clips, light) {
    return clipOp(subjects, clips, lib().ClipType.ctDifference, light);
}

export function intersection(subjects, clips, light) {
    return clipOp(subjects, clips, lib().ClipType.ctIntersection, light);
}

export function unionPolys(subjects, light) {
    if (!subjects.length) return [];
    var C = lib();
    var cpr = new C.Clipper();
    var n = 0;
    subjects.forEach(function (p) {
        if (p && p.length >= 3) {
            cpr.AddPath(toClip(p), C.PolyType.ptSubject, true);
            n++;
        }
    });
    if (!n) return [];
    var solution = new C.Paths();
    cpr.Execute(C.ClipType.ctUnion, solution, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    return solution.map(fromClip).map(function (p) {
        return light ? tidyLight(p) : simplifyPoly(p);
    }).filter(function (p) { return p.length >= 3; });
}

export function offsetPolys(polys, delta) {
    var C = lib();
    var co = new C.ClipperOffset(2, 0.25);
    var n = 0;
    polys.forEach(function (p) {
        if (p && p.length >= 3) {
            co.AddPath(toClip(p), C.JoinType.jtMiter, C.EndType.etClosedPolygon);
            n++;
        }
    });
    if (!n) return [];
    var solution = new C.Paths();
    co.Execute(solution, delta * SCALE);
    return solution.map(fromClip).map(simplifyPoly).filter(function (p) { return p.length >= 3; });
}

export function bufferPolyline(points, width) {
    var C = lib();
    if (!points || points.length < 2) return [];
    var co = new C.ClipperOffset(2, 0.25);
    co.AddPath(toClip(points), C.JoinType.jtRound, C.EndType.etOpenRound);
    var solution = new C.Paths();
    co.Execute(solution, (width / 2) * SCALE);
    return solution.map(fromClip).map(tidyLight).filter(function (p) { return p.length >= 3; });
}

export function splitByTrail(unclaimedPolys, trailPoints, width) {
    var buf = bufferPolyline(trailPoints, width);
    if (!buf.length) return { parts: unclaimedPolys.slice(), buffer: [] };
    return { parts: difference(unclaimedPolys, buf, true), buffer: buf };
}
