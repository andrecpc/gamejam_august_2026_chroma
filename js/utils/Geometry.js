/**
 * Простая геометрия: расстояние, попадание в отрезок, самопересечение хвоста.
 */
export function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

export function pointToSegmentDist(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var apx = px - ax, apy = py - ay;
    var ab2 = abx * abx + aby * aby;
    var t = ab2 === 0 ? 0 : clamp((apx * abx + apy * aby) / ab2, 0, 1);
    return dist(px, py, ax + abx * t, ay + aby * t);
}

export function segmentsIntersect(a, b, c, d) {
    function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
    var r = { x: b.x - a.x, y: b.y - a.y };
    var s = { x: d.x - c.x, y: d.y - c.y };
    var den = cross(r.x, r.y, s.x, s.y);
    if (Math.abs(den) < 1e-8) return false;
    var qp = { x: c.x - a.x, y: c.y - a.y };
    var t = cross(qp.x, qp.y, s.x, s.y) / den;
    var u = cross(qp.x, qp.y, r.x, r.y) / den;
    return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

export function trailHitsSelf(trail) {
    var n = trail.length;
    if (n < 5) return false;
    var a = trail[n - 2], b = trail[n - 1];
    for (var i = 0; i < n - 4; i++) {
        if (segmentsIntersect(a, b, trail[i], trail[i + 1])) return true;
    }
    return false;
}

export function pointHitsPolyline(px, py, trail, radius) {
    for (var i = 1; i < trail.length; i++) {
        if (pointToSegmentDist(px, py, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y) <= radius) {
            return i;
        }
    }
    return -1;
}

export function polylineLength(trail) {
    var len = 0;
    for (var i = 1; i < trail.length; i++) {
        len += dist(trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y);
    }
    return len;
}

export function extendEnds(points, extra) {
    if (!points || points.length < 2) return points ? points.slice() : [];
    var out = points.map(function (p) { return { x: p.x, y: p.y }; });
    var a = out[0], b = out[1];
    var d0 = dist(a.x, a.y, b.x, b.y) || 1;
    out[0] = { x: a.x - (b.x - a.x) / d0 * extra, y: a.y - (b.y - a.y) / d0 * extra };
    var n = out.length;
    var c = out[n - 2], d = out[n - 1];
    var d1 = dist(c.x, c.y, d.x, d.y) || 1;
    out[n - 1] = { x: d.x + (d.x - c.x) / d1 * extra, y: d.y + (d.y - c.y) / d1 * extra };
    return out;
}

export function polyCentroid(points) {
    var x = 0, y = 0;
    if (!points.length) return { x: 0, y: 0 };
    for (var i = 0; i < points.length; i++) {
        x += points[i].x;
        y += points[i].y;
    }
    return { x: x / points.length, y: y / points.length };
}

export function nearestOnRing(ring, p) {
    var best = { i: 0, t: 0, x: ring[0].x, y: ring[0].y, d: Infinity };
    for (var i = 0; i < ring.length; i++) {
        var a = ring[i];
        var b = ring[(i + 1) % ring.length];
        var abx = b.x - a.x, aby = b.y - a.y;
        var ab2 = abx * abx + aby * aby;
        var t = ab2 === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2, 0, 1);
        var x = a.x + abx * t, y = a.y + aby * t;
        var d = dist(p.x, p.y, x, y);
        if (d < best.d) best = { i: i, t: t, x: x, y: y, d: d };
    }
    return best;
}

export function ringChain(ring, fromHit, toHit) {
    var pts = [{ x: fromHit.x, y: fromHit.y }];
    var i = fromHit.i;
    var guard = 0;
    if (fromHit.t < 0.999) {
        var b = ring[(fromHit.i + 1) % ring.length];
        pts.push({ x: b.x, y: b.y });
        i = (fromHit.i + 1) % ring.length;
    }
    while (guard++ < ring.length + 2) {
        if (i === toHit.i) break;
        i = (i + 1) % ring.length;
        pts.push({ x: ring[i].x, y: ring[i].y });
    }
    pts.push({ x: toHit.x, y: toHit.y });
    return pts;
}

export function ringChainBack(ring, fromHit, toHit) {
    var n = ring.length;
    var pts = [{ x: fromHit.x, y: fromHit.y }];
    var i = fromHit.i;
    var guard = 0;
    if (fromHit.t > 0.001) {
        pts.push({ x: ring[i].x, y: ring[i].y });
    }
    while (guard++ < n + 2) {
        if (i === toHit.i) break;
        i = (i - 1 + n) % n;
        pts.push({ x: ring[i].x, y: ring[i].y });
    }
    pts.push({ x: toHit.x, y: toHit.y });
    return pts;
}

export function hexToInt(hex) {
    if (typeof hex === 'number') return hex;
    return parseInt(String(hex).replace('#', ''), 16);
}
