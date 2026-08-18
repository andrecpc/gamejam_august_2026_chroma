import {
    difference, intersection, polygonArea, pointInPolygon, splitByTrail,
    unionPolys, offsetPolys, isSliver, bufferPolyline, tidyLight, simplifyPoly
} from '../utils/ClipperAdapter.js?v=1.7.7';
import {
    extendEnds, hexToInt, nearestOnRing, pointToSegmentDist,
    polylineLength, ringChain, ringChainBack
} from '../utils/Geometry.js?v=1.7.7';

var SLIVER_AREA = 180;
var MAX_CAPTURE = 0.82;

export class FieldManager {
    constructor(scene, level) {
        this.scene = scene;
        this.level = level;
        this.bounds = level.bounds;
        this.palette = level.palette;
        this.colors = [];
        this.claimed = [];
        this.enemyWalls = [];
        this.frame = [];
        this.gfx = scene.add.graphics();
        this.gfx.setDepth(3);
        this.colorLayers = [];
        this.underScraps = [];
        this.edge = scene.add.graphics();
        this.edge.setDepth(2);
        this.sheet = scene.add.graphics();
        this.sheet.setDepth(0.4);
        this.paper = null;
        var b = this.bounds;
        var cx = b.x + b.w / 2;
        var cy = b.y + b.h / 2;
        if (window.Paper && Paper.addScrap) {
            this.underScraps.push(Paper.addScrap(scene, b.x + 36, b.y - 10, 210, 92, 0x47a798, 101, {
                depth: 0.16, jag: 9, angle: -7, shadowX: 14, shadowY: 20, raw: true, fibers: 'light'
            }));
            this.underScraps.push(Paper.addScrap(scene, b.x + b.w - 28, b.y - 6, 190, 86, 0xd28e43, 102, {
                depth: 0.18, jag: 9, angle: 8, shadowX: 14, shadowY: 20, raw: true, fibers: 'light'
            }));
            this.underScraps.push(Paper.addScrap(scene, b.x + 28, b.y + b.h + 8, 200, 88, 0x47a798, 103, {
                depth: 0.16, jag: 9, angle: 8, shadowX: 14, shadowY: 20, raw: true, fibers: 'light'
            }));
            this.underScraps.push(Paper.addScrap(scene, b.x + b.w - 22, b.y + b.h + 10, 220, 96, 0xd28e43, 104, {
                depth: 0.18, jag: 9, angle: -9, shadowX: 14, shadowY: 20, raw: true, fibers: 'light'
            }));
        }
        if (window.Paper && Paper.drawScrap) {
            Paper.drawScrap(
                this.sheet,
                cx,
                cy,
                b.w + 44,
                b.h + 44,
                0xe6d8c0,
                77,
                { jag: 11, shadowX: 22, shadowY: 30, fibers: 'light' }
            );
            this.paper = Paper.overlayFiber(scene, cx, cy, b.w + 44, b.h + 44, 77, {
                depth: 0.5,
                alpha: 0.22,
                jag: 11
            });
        }
        this._buildFrame();
        this._loadPolygons(level.polygons);
        this.totalArea = this._sumColorArea();
        this.playerClaimedArea = 0;
        this.vialCapacity = this.totalArea * 0.10;
        this._needsDraw = false;
        this._wallsNeedMerge = false;
        this.draw();
    }

    innerRect() {
        var b = this.bounds;
        var f = b.frame || 28;
        return { x: b.x + f, y: b.y + f, w: b.w - 2 * f, h: b.h - 2 * f };
    }

    _buildFrame() {
        var b = this.bounds;
        var f = b.frame || 28;
        this.frame = [
            rectPoly(b.x, b.y, b.w, f),
            rectPoly(b.x, b.y + b.h - f, b.w, f),
            rectPoly(b.x, b.y, f, b.h),
            rectPoly(b.x + b.w - f, b.y, f, b.h)
        ];
        this.claimed = [];
    }

    _loadPolygons(list) {
        this.colors = list.map(function (p) {
            return { id: p.id, color: p.color, points: p.points.slice() };
        });
    }

    _sumColorArea() {
        var s = 0;
        for (var i = 0; i < this.colors.length; i++) s += polygonArea(this.colors[i].points);
        return s;
    }

    colorArea(color) {
        var total = 0;
        for (var i = 0; i < this.colors.length; i++) {
            if (this.colors[i].color === color) {
                total += polygonArea(this.colors[i].points);
            }
        }
        return total;
    }

    isOnFrame(x, y) {
        for (var i = 0; i < this.frame.length; i++) {
            if (pointInPolygon(x, y, this.frame[i])) return true;
        }
        return false;
    }

    isClaimed(x, y) {
        if (this.colorAt(x, y)) return false;
        for (var i = 0; i < this.claimed.length; i++) {
            if (pointInPolygon(x, y, this.claimed[i])) return true;
        }
        for (i = 0; i < this.enemyWalls.length; i++) {
            if (pointInPolygon(x, y, this.enemyWalls[i])) return true;
        }
        return false;
    }

    colorAt(x, y) {
        for (var i = 0; i < this.colors.length; i++) {
            if (pointInPolygon(x, y, this.colors[i].points)) return this.colors[i].color;
        }
        return null;
    }

    isWall(x, y) {
        if (this.colorAt(x, y)) return false;
        if (this.isOnFrame(x, y)) return true;
        for (var i = 0; i < this.claimed.length; i++) {
            if (polygonArea(this.claimed[i]) < 80) continue;
            if (pointInPolygon(x, y, this.claimed[i])) return true;
        }
        for (i = 0; i < this.enemyWalls.length; i++) {
            if (polygonArea(this.enemyWalls[i]) < 80) continue;
            if (pointInPolygon(x, y, this.enemyWalls[i])) return true;
        }
        return false;
    }

    isSafe(x, y) {
        if (this.colorAt(x, y)) return false;
        return this.isOnFrame(x, y) || this.isClaimed(x, y);
    }

    colorBounds() {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var found = false;
        for (var i = 0; i < this.colors.length; i++) {
            var pts = this.colors[i].points;
            for (var j = 0; j < pts.length; j++) {
                found = true;
                if (pts[j].x < minX) minX = pts[j].x;
                if (pts[j].y < minY) minY = pts[j].y;
                if (pts[j].x > maxX) maxX = pts[j].x;
                if (pts[j].y > maxY) maxY = pts[j].y;
            }
        }
        if (!found) return this.innerRect();
        return { x: minX, y: minY, w: Math.max(8, maxX - minX), h: Math.max(8, maxY - minY) };
    }

    colorCentroid() {
        var x = 0, y = 0, n = 0;
        for (var i = 0; i < this.colors.length; i++) {
            var pts = this.colors[i].points;
            for (var j = 0; j < pts.length; j++) {
                x += pts[j].x;
                y += pts[j].y;
                n++;
            }
        }
        if (!n) {
            var b = this.innerRect();
            return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        }
        return { x: x / n, y: y / n };
    }

    isUnclaimed(x, y) {
        if (this.isSafe(x, y)) return false;
        for (var i = 0; i < this.colors.length; i++) {
            if (pointInPolygon(x, y, this.colors[i].points)) return true;
        }
        return false;
    }

    containsEnemy(poly, enemies) {
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (e.active && pointInPolygon(e.x, e.y, poly)) return true;
        }
        return false;
    }

    enemiesIn(poly, enemies) {
        var out = [];
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (e.active && pointInPolygon(e.x, e.y, poly)) out.push(e);
        }
        return out;
    }

    closeTrail(trail, enemies) {
        var fail = function (reason) {
            return { ok: false, reason: reason, pieces: [], captured: [], buffer: [], trapped: [] };
        };
        if (!trail || trail.length < 3 || polylineLength(trail) < 36) return fail('no-split');

        var unclaimed = unionPolys(this.colors.map(function (c) { return c.points; }), true);
        if (!unclaimed.length) return fail('no-split');

        // Старые срезы и след подрезчика могут заранее разделить цвет на
        // независимые острова. Режем только тот остров, через который идёт
        // текущий хвост игрока, иначе все остальные острова ошибочно
        // попадут в captured.
        var active = this._componentForTrail(unclaimed, trail);
        if (!active) active = this._colorPolyForTrail(trail);
        if (!active) return fail('no-split');
        var working = [active];
        var unclaimedArea = polygonArea(active);
        var i;

        var extended = extendEnds(trail, 56);
        var split = this._splitUntilSevered(working, extended);
        var parts = (split.parts || []).filter(function (p) {
            return polygonArea(p) >= SLIVER_AREA;
        });
        var buffer = split.buffer || [];

        if (parts.length < 2) {
            var looped = this._loopsFromTrail(working, trail, unclaimedArea);
            if (looped) {
                parts = looped.parts;
                buffer = looped.buffer || buffer;
            }
        }

        if (parts.length < 2) {
            var colorPoly = this._colorPolyForTrail(trail);
            if (colorPoly) {
                split = this._splitUntilSevered([colorPoly], extended);
                var colorParts = (split.parts || []).filter(function (p) {
                    return polygonArea(p) >= SLIVER_AREA;
                });
                if (colorParts.length >= 2) {
                    parts = colorParts;
                    buffer = split.buffer || buffer;
                    working = [colorPoly];
                    unclaimedArea = polygonArea(colorPoly);
                }
            }
        }

        if (parts.length < 2) return fail('no-split');

        var largestIdx = 0;
        var largestArea = polygonArea(parts[0]);
        for (i = 1; i < parts.length; i++) {
            var a = polygonArea(parts[i]);
            if (a > largestArea) {
                largestArea = a;
                largestIdx = i;
            }
        }

        var captured = [];
        for (i = 0; i < parts.length; i++) {
            if (i === largestIdx) continue;
            captured.push(parts[i]);
        }

        var capturedArea = 0;
        for (i = 0; i < captured.length; i++) capturedArea += polygonArea(captured[i]);

        if (capturedArea > unclaimedArea * MAX_CAPTURE) {
            var smallest = captured[0];
            var smallA = polygonArea(captured[0]);
            for (i = 1; i < captured.length; i++) {
                var sa = polygonArea(captured[i]);
                if (sa < smallA) { smallA = sa; smallest = captured[i]; }
            }
            captured = [smallest];
            capturedArea = smallA;
        }

        if (!captured.length || capturedArea < SLIVER_AREA) return fail('too-small');

        var trapped = [];
        for (i = 0; i < captured.length; i++) {
            trapped = trapped.concat(this.enemiesIn(captured[i], enemies || []));
        }

        var byColor = {};
        for (i = 0; i < this.colors.length; i++) {
            var col = this.colors[i];
            var cut = intersection([col.points], captured, true);
            cut = cut.filter(function (poly) { return polygonArea(poly) >= SLIVER_AREA; });
            var area = 0;
            for (var j = 0; j < cut.length; j++) area += polygonArea(cut[j]);
            if (area < SLIVER_AREA) continue;
            if (!byColor[col.color]) byColor[col.color] = { color: col.color, area: 0, polys: [] };
            byColor[col.color].area += area;
            byColor[col.color].polys = byColor[col.color].polys.concat(cut);
        }

        var pieces = Object.keys(byColor).map(function (k) { return byColor[k]; });
        if (!pieces.length) return fail('too-small');

        return {
            ok: true,
            reason: null,
            pieces: pieces,
            captured: captured,
            buffer: buffer,
            trapped: trapped,
            capturedArea: capturedArea,
            unclaimedArea: unclaimedArea
        };
    }

    _componentForTrail(components, trail) {
        var best = null;
        var bestHits = 0;
        for (var i = 0; i < components.length; i++) {
            var hits = this._trailHitsPoly(trail, components[i]);
            if (hits > bestHits) {
                bestHits = hits;
                best = components[i];
            }
        }
        return best;
    }

    _colorPolyForTrail(trail) {
        var best = null;
        var bestHits = 0;
        for (var i = 0; i < this.colors.length; i++) {
            var hits = this._trailHitsPoly(trail, this.colors[i].points);
            if (hits > bestHits) {
                bestHits = hits;
                best = this.colors[i].points;
            }
        }
        return best;
    }

    _trailHitsPoly(trail, poly) {
        if (!trail || !poly) return 0;
        var hits = 0;
        for (var j = 1; j < trail.length - 1; j++) {
            if (pointInPolygon(trail[j].x, trail[j].y, poly)) hits += 2;
            else if (this._nearPoly(trail[j].x, trail[j].y, poly, 12)) hits += 1;
        }
        return hits;
    }

    _nearPoly(x, y, poly, pad) {
        for (var i = 0; i < poly.length; i++) {
            var a = poly[i];
            var b = poly[(i + 1) % poly.length];
            if (pointToSegmentDist(x, y, a.x, a.y, b.x, b.y) <= pad) return true;
        }
        return false;
    }

    _splitUntilSevered(unclaimed, trail) {
        var widths = [3, 5, 7, 10, 14, 20];
        var last = { parts: unclaimed.slice(), buffer: [] };
        var i;
        for (i = 0; i < widths.length; i++) {
            last = splitByTrail(unclaimed, trail, widths[i], true);
            var solid = (last.parts || []).filter(function (p) {
                return polygonArea(p) >= SLIVER_AREA;
            });
            if (solid.length >= 2) return last;
        }
        for (i = 0; i < widths.length; i++) {
            last = splitByTrail(unclaimed, trail, widths[i], false);
            solid = (last.parts || []).filter(function (p) {
                return polygonArea(p) >= SLIVER_AREA;
            });
            if (solid.length >= 2) return last;
        }
        return last;
    }

    _loopsFromTrail(unclaimed, trail, unclaimedArea) {
        var ring = this._ringNearTrail(unclaimed, trail);
        if (!ring || ring.length < 4) return null;
        var start = nearestOnRing(ring, trail[0]);
        var end = nearestOnRing(ring, trail[trail.length - 1]);
        if (start.d > 64 || end.d > 64) return null;

        var around1 = ringChain(ring, end, start);
        var around2 = ringChainBack(ring, end, start);
        var loop1 = trail.concat(around1);
        var loop2 = trail.concat(around2);
        var a1 = polygonArea(loop1);
        var a2 = polygonArea(loop2);
        if (a1 < SLIVER_AREA && a2 < SLIVER_AREA) return null;

        var small = a1 <= a2 ? loop1 : loop2;
        var smallA = Math.min(a1, a2);
        if (smallA < SLIVER_AREA || smallA > unclaimedArea * MAX_CAPTURE) return null;
        var ocean = a1 <= a2 ? loop2 : loop1;
        return { parts: [small, ocean], buffer: [] };
    }

    _ringNearTrail(unclaimed, trail) {
        var mid = trail[Math.floor(trail.length / 2)];
        var best = null;
        var bestA = 0;
        for (var i = 0; i < unclaimed.length; i++) {
            var a = polygonArea(unclaimed[i]);
            if (a > bestA) { bestA = a; best = unclaimed[i]; }
        }
        for (i = 0; i < unclaimed.length; i++) {
            if (pointInPolygon(mid.x, mid.y, unclaimed[i])) return unclaimed[i];
        }
        return best;
    }

    applyClaim(captured, buffer, acceptedByColor, enemies) {
        var snapshot = this._snapshot();
        var acceptedPolys = [];
        var colorNames = Object.keys(acceptedByColor);
        var i;

        for (i = 0; i < colorNames.length; i++) {
            var name = colorNames[i];
            var ratio = acceptedByColor[name];
            if (ratio <= 0) continue;
            var ofColor = [];
            for (var c = 0; c < this.colors.length; c++) {
                if (this.colors[c].color === name) ofColor.push(this.colors[c].points);
            }
            var piece = intersection(ofColor, captured, true);
            if (!piece.length) continue;
            if (ratio >= 0.999) {
                acceptedPolys = acceptedPolys.concat(piece);
            } else {
                var total = 0;
                for (var k = 0; k < piece.length; k++) total += polygonArea(piece[k]);
                var need = total * ratio;
                var got = 0;
                for (k = 0; k < piece.length; k++) {
                    if (got >= need && k > 0) break;
                    acceptedPolys.push(piece[k]);
                    got += polygonArea(piece[k]);
                }
            }
        }

        if (!acceptedPolys.length) return { claimed: [], killed: [] };

        var expected = 0;
        for (i = 0; i < acceptedPolys.length; i++) expected += polygonArea(acceptedPolys[i]);

        var unionClaim = offsetPolys(unionPolys(acceptedPolys), 0.9);
        if (!unionClaim.length) unionClaim = unionPolys(acceptedPolys);

        var beforeArea = this._sumColorArea();
        this.claimed = unionPolys(this.claimed.concat(unionClaim));
        this._rebuildColors(unionClaim);
        var remainColors = this.colors.map(function (c) { return c.points; });
        if (remainColors.length) {
            this.claimed = difference(this.claimed, remainColors, true);
        }

        var afterArea = this._sumColorArea();
        var lost = beforeArea - afterArea;
        if (lost > expected * 1.45 + 1500 || afterArea < beforeArea * 0.12) {
            this._restore(snapshot);
            this.draw();
            return { claimed: [], killed: [], rolledBack: true };
        }

        this.playerClaimedArea += Math.max(0, lost);
        this.claimed = this.claimed.filter(function (p) { return polygonArea(p) >= SLIVER_AREA; });
        this.draw();

        var killed = [];
        for (i = 0; i < (enemies || []).length; i++) {
            var e = enemies[i];
            if (!e.active) continue;
            for (var p = 0; p < unionClaim.length; p++) {
                if (pointInPolygon(e.x, e.y, unionClaim[p])) {
                    killed.push(e);
                    break;
                }
            }
        }
        return { claimed: unionClaim, killed: killed };
    }

    _snapshot() {
        return {
            colors: this.colors.map(function (c) {
                return { id: c.id, color: c.color, points: c.points.slice() };
            }),
            claimed: this.claimed.map(function (p) { return p.slice(); }),
            enemyWalls: this.enemyWalls.map(function (p) { return p.slice(); })
        };
    }

    _restore(snap) {
        this.colors = snap.colors;
        this.claimed = snap.claimed;
        this.enemyWalls = snap.enemyWalls || [];
    }

    _rebuildColors(subtract, soften) {
        var next = [];
        for (var i = 0; i < this.colors.length; i++) {
            var remain = difference([this.colors[i].points], subtract, true);
            for (var r = 0; r < remain.length; r++) {
                var cleaned = tidyLight(remain[r]);
                var pts = cleaned.length >= 3 ? cleaned : remain[r];
                if (pts.length > 28) {
                    var simple = simplifyPoly(pts);
                    if (simple && simple.length >= 3) pts = simple;
                }
                if (soften && pts.length >= 6) {
                    var inset = offsetPolys([pts], -1.2);
                    if (inset.length) {
                        for (var s = 0; s < inset.length; s++) {
                            if (polygonArea(inset[s]) < 80) continue;
                            next.push({
                                id: this.colors[i].id,
                                color: this.colors[i].color,
                                points: inset[s]
                            });
                        }
                        continue;
                    }
                }
                if (polygonArea(pts) < 80) continue;
                next.push({
                    id: this.colors[i].id,
                    color: this.colors[i].color,
                    points: pts
                });
            }
        }
        this.colors = next;
    }

    stealColorAt(x, y, radius) {
        if (!this.colorAt(x, y)) return 0;
        var circle = [];
        var steps = 20;
        for (var i = 0; i < steps; i++) {
            var angle = Math.PI * 2 * i / steps;
            circle.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius
            });
        }
        var lost = this._stealPolys(
            [circle],
            Math.PI * radius * radius,
            true
        );
        this.flushDeferred();
        return lost;
    }

    stealColorTrail(points, width) {
        return this.stealColorTrails([{ points: points, width: width }]);
    }

    stealColorTrails(segments) {
        if (!segments || !segments.length) return 0;
        var shapes = [];
        var expected = 0;
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            if (!seg || !seg.points || seg.points.length < 2) continue;
            var trail = bufferPolyline(seg.points, seg.width);
            if (!trail.length) continue;
            for (var t = 0; t < trail.length; t++) shapes.push(trail[t]);
            expected += polylineLength(seg.points) * seg.width +
                Math.PI * Math.pow(seg.width / 2, 2);
        }
        if (!shapes.length) return 0;
        return this._stealPolys(shapes, expected, true);
    }

    _stealPolys(shape, expected, createWall) {
        var before = this._sumColorArea();
        var snapshot = this._snapshot();
        var wasDirty = this._needsDraw;
        var wallsDirty = this._wallsNeedMerge;
        var stolen = intersection(
            this.colors.map(function (c) { return c.points; }),
            shape,
            true
        );
        if (!stolen.length) return 0;

        // Стены подрезчика хранятся отдельно от захваченной игроком площади:
        // они безопасны, но не участвуют в выборе стороны следующего среза.
        if (createWall) {
            for (var s = 0; s < stolen.length; s++) this.enemyWalls.push(stolen[s]);
            this._wallsNeedMerge = true;
            if (this.enemyWalls.length > 10) this._mergeEnemyWalls();
        }
        this._rebuildColors(stolen, true);

        var lost = before - this._sumColorArea();
        if (lost <= 0 || lost > expected * 1.6) {
            this._restore(snapshot);
            this._needsDraw = wasDirty;
            this._wallsNeedMerge = wallsDirty;
            return 0;
        }
        this._needsDraw = true;
        return lost;
    }

    _mergeEnemyWalls() {
        if (this.enemyWalls.length > 1) {
            this.enemyWalls = unionPolys(this.enemyWalls);
        }
        this.enemyWalls = this.enemyWalls.filter(function (p) {
            return polygonArea(p) >= 80;
        });
        var remaining = this.colors.map(function (c) { return c.points; });
        if (remaining.length) {
            this.claimed = difference(this.claimed, remaining, true);
            this.enemyWalls = difference(this.enemyWalls, remaining, true);
        }
        this._wallsNeedMerge = false;
    }

    flushDeferred() {
        if (this._wallsNeedMerge) this._mergeEnemyWalls();
        if (this._needsDraw) this.draw();
    }

    bouncePolys(polys) {
        var ghost = this.scene.add.graphics();
        ghost.setDepth(8);
        this._fillPolys(ghost, polys, 0xffffff, 0.4);
        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 280,
            onComplete: function () { ghost.destroy(); }
        });
    }

    _ensureColorLayers() {
        while (this.colorLayers.length < this.colors.length) {
            this.colorLayers.push(this.scene.add.graphics());
        }
        while (this.colorLayers.length > this.colors.length) {
            this.colorLayers.pop().destroy();
        }
    }

    draw() {
        this._needsDraw = false;
        this.gfx.clear();
        this.edge.clear();
        this._ensureColorLayers();
        var order = [];
        var i;
        for (i = 0; i < this.colors.length; i++) {
            order.push({
                i: i,
                a: polygonArea(this.colors[i].points)
            });
        }
        order.sort(function (a, b) { return b.a - a.a; });
        var n = order.length;
        for (i = 0; i < this.colorLayers.length; i++) this.colorLayers[i].clear();
        for (i = 0; i < n; i++) {
            var col = this.colors[order[i].i];
            var tint = hexToInt(this.palette[col.color] || 0x888888);
            var g = this.colorLayers[order[i].i];
            g.setDepth(0.85 + (n <= 1 ? 0 : i / (n - 1)) * 0.7);
            if (window.Paper && Paper.drawColorPiece) {
                var seed = 0x9e3779b9;
                var key = (col.id || '') + '|' + (col.color || '');
                var pts0 = col.points[0] || { x: 0, y: 0 };
                key += '|' + Math.round(pts0.x) + ',' + Math.round(pts0.y);
                var k;
                for (k = 0; k < key.length; k++) {
                    seed = Math.imul(seed ^ key.charCodeAt(k), 16777619) >>> 0;
                }
                Paper.drawColorPiece(g, col.points, tint, seed);
            } else {
                this._fillPolys(g, [col.points], tint, 1);
            }
        }
        this._refreshColorGrain();
    }

    _ensureColorGrain() {
        if (this.colorGrain) return;
        var key = this.scene.textures.exists('paper-pulp') ? 'paper-pulp'
            : (this.scene.textures.exists('paper-kraft') ? 'paper-kraft' : null);
        if (!key) return;
        var b = this.bounds;
        this.colorGrain = this.scene.add.tileSprite(
            b.x + b.w / 2,
            b.y + b.h / 2,
            b.w,
            b.h,
            key
        );
        this.colorGrain.setDepth(1.78);
        if (key === 'paper-kraft') {
            this.colorGrain.setBlendMode(Phaser.BlendModes.MULTIPLY);
            this.colorGrain.setAlpha(0.32);
        } else {
            this.colorGrain.setBlendMode(Phaser.BlendModes.OVERLAY);
            this.colorGrain.setAlpha(0.42);
        }
        this.grainMaskG = this.scene.make.graphics({ add: false });
    }

    _refreshColorGrain() {
        this._ensureColorGrain();
        if (!this.colorGrain || !this.grainMaskG) return;
        this.grainMaskG.clear();
        this.grainMaskG.fillStyle(0xffffff, 1);
        var i;
        for (i = 0; i < this.colors.length; i++) {
            var p = this.colors[i].points;
            if (!p || p.length < 3) continue;
            this.grainMaskG.beginPath();
            this.grainMaskG.moveTo(p[0].x, p[0].y);
            var j;
            for (j = 1; j < p.length; j++) this.grainMaskG.lineTo(p[j].x, p[j].y);
            this.grainMaskG.closePath();
            this.grainMaskG.fillPath();
        }
        if (this.colorGrain.mask) this.colorGrain.clearMask(true);
        if (this.colors.length) {
            this.colorGrain.setVisible(true);
            this.colorGrain.setMask(this.grainMaskG.createGeometryMask());
        } else {
            this.colorGrain.setVisible(false);
        }
    }

    _fillPolys(g, polys, color, alpha) {
        g.fillStyle(color, alpha);
        for (var i = 0; i < polys.length; i++) {
            var p = polys[i];
            if (!p || p.length < 3) continue;
            g.beginPath();
            g.moveTo(p[0].x, p[0].y);
            for (var j = 1; j < p.length; j++) g.lineTo(p[j].x, p[j].y);
            g.closePath();
            g.fillPath();
        }
    }

    _strokePoly(g, p) {
        if (!p || p.length < 3) return;
        g.beginPath();
        g.moveTo(p[0].x, p[0].y);
        for (var j = 1; j < p.length; j++) g.lineTo(p[j].x, p[j].y);
        g.closePath();
        g.strokePath();
    }

    destroy() {
        this.gfx.destroy();
        this.edge.destroy();
        var i;
        for (i = 0; i < this.colorLayers.length; i++) this.colorLayers[i].destroy();
        this.colorLayers = [];
        for (i = 0; i < this.underScraps.length; i++) {
            if (this.underScraps[i] && this.underScraps[i].destroy) this.underScraps[i].destroy();
        }
        this.underScraps = [];
        if (this.sheet && this.sheet.destroy) this.sheet.destroy();
        if (this.paper && this.paper.destroy) this.paper.destroy();
        if (this.colorGrain) {
            if (this.colorGrain.mask) this.colorGrain.clearMask(true);
            this.colorGrain.destroy();
        }
        if (this.grainMaskG && this.grainMaskG.destroy) this.grainMaskG.destroy();
        this.sheet = null;
        this.paper = null;
        this.colorGrain = null;
        this.grainMaskG = null;
    }
}

function rectPoly(x, y, w, h) {
    return [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h }
    ];
}
