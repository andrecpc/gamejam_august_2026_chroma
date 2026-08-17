import { clamp, dist, pointToSegmentDist } from '../utils/Geometry.js';

/**
 * Магнитные контуры уровня.
 *
 * Контур притягивает точку, автоматически ведёт её по ломаной и отпускает
 * после уверенного свайпа в сторону доступного цветного поля.
 */
export class MagneticManager {
    constructor(scene, level) {
        this.scene = scene;
        this.paths = [];
        this.snapRadius = level.magnetSnapRadius || 20;
        this.detachDistance = level.magnetDetachDistance || 30;
        this.rideSpeedFactor = level.magnetRideSpeedFactor || 0.82;
        this.gfx = scene.add.graphics();
        this.gfx.setDepth(5);

        var source = level.magneticPaths || [];
        for (var i = 0; i < source.length; i++) {
            var path = this._preparePath(source[i]);
            if (path) this.paths.push(path);
        }
        this.draw();
    }

    _preparePath(raw) {
        var points = (raw.points || []).map(function (p) {
            return { x: p.x, y: p.y };
        });
        if (points.length < 2) return null;

        var closed = raw.closed !== false;
        var segments = [];
        var total = 0;
        var count = closed ? points.length : points.length - 1;

        for (var i = 0; i < count; i++) {
            var a = points[i];
            var b = points[(i + 1) % points.length];
            var len = dist(a.x, a.y, b.x, b.y);
            if (len < 0.5) continue;
            segments.push({
                a: a,
                b: b,
                length: len,
                start: total,
                tx: (b.x - a.x) / len,
                ty: (b.y - a.y) / len
            });
            total += len;
        }
        if (!segments.length || total < 1) return null;

        return {
            id: raw.id || ('magnet_' + this.paths.length),
            points: points,
            segments: segments,
            total: total,
            closed: closed,
            color: raw.color || 0x63f5ff
        };
    }

    nearest(x, y) {
        var best = null;
        for (var p = 0; p < this.paths.length; p++) {
            var path = this.paths[p];
            for (var i = 0; i < path.segments.length; i++) {
                var s = path.segments[i];
                var abx = s.b.x - s.a.x;
                var aby = s.b.y - s.a.y;
                var ab2 = abx * abx + aby * aby;
                var t = ab2 === 0 ? 0 : clamp(
                    ((x - s.a.x) * abx + (y - s.a.y) * aby) / ab2,
                    0,
                    1
                );
                var px = s.a.x + abx * t;
                var py = s.a.y + aby * t;
                var d = pointToSegmentDist(x, y, s.a.x, s.a.y, s.b.x, s.b.y);
                if (!best || d < best.distance) {
                    best = {
                        pathIndex: p,
                        segmentIndex: i,
                        distance: d,
                        x: px,
                        y: py,
                        along: s.start + s.length * t,
                        tx: s.tx,
                        ty: s.ty
                    };
                }
            }
        }
        return best;
    }

    tryAttach(player, x, y, dir) {
        if (!this.paths.length || player.magnetState) return false;
        var hit = this.nearest(x, y);
        if (!hit || hit.distance > this.snapRadius) return false;

        var projection = (dir ? dir.x : 0) * hit.tx + (dir ? dir.y : 0) * hit.ty;
        player.magnetState = {
            pathIndex: hit.pathIndex,
            along: hit.along,
            direction: projection < 0 ? -1 : 1,
            attachedAt: this.scene.time.now,
            x: hit.x,
            y: hit.y
        };
        player.x = hit.x;
        player.y = hit.y;
        return true;
    }

    updateRider(player, dir, dt, field) {
        var state = player.magnetState;
        if (!state) return null;
        var path = this.paths[state.pathIndex];
        if (!path) {
            player.magnetState = null;
            return null;
        }

        var inputLen = dir ? Math.sqrt(dir.x * dir.x + dir.y * dir.y) : 0;
        var canDetach = this.scene.time.now - state.attachedAt > 180;
        if (canDetach && inputLen > 0.55) {
            var ux = dir.x / inputLen;
            var uy = dir.y / inputLen;
            var targetX = player.x + ux * this.detachDistance;
            var targetY = player.y + uy * this.detachDistance;
            var nearest = this.nearest(targetX, targetY);
            var landsInColor = field.isUnclaimed(targetX, targetY);
            var landsOnWall = field.isWall(targetX, targetY);

            if ((landsInColor || landsOnWall) &&
                (!nearest || nearest.distance > this.snapRadius * 0.72)) {
                var from = { x: player.x, y: player.y };
                player.magnetState = null;
                player.x = targetX;
                player.y = targetY;
                return {
                    detached: true,
                    from: from,
                    landsInColor: landsInColor,
                    landsOnWall: landsOnWall
                };
            }
        }

        var speed = player.speed * this.rideSpeedFactor;
        state.along += speed * dt * state.direction;

        if (path.closed) {
            state.along = ((state.along % path.total) + path.total) % path.total;
        } else if (state.along <= 0 || state.along >= path.total) {
            state.along = clamp(state.along, 0, path.total);
            state.direction *= -1;
        }

        var point = this._pointAt(path, state.along);
        player.x = point.x;
        player.y = point.y;
        state.x = point.x;
        state.y = point.y;
        return { riding: true };
    }

    _pointAt(path, along) {
        for (var i = 0; i < path.segments.length; i++) {
            var s = path.segments[i];
            if (along <= s.start + s.length || i === path.segments.length - 1) {
                var t = clamp((along - s.start) / s.length, 0, 1);
                return {
                    x: s.a.x + (s.b.x - s.a.x) * t,
                    y: s.a.y + (s.b.y - s.a.y) * t
                };
            }
        }
        return path.points[0];
    }

    draw() {
        var g = this.gfx;
        g.clear();
        for (var i = 0; i < this.paths.length; i++) {
            var path = this.paths[i];
            var points = path.points;

            g.lineStyle(14, 0x42dfe8, 0.12);
            this._stroke(g, points, path.closed);
            g.lineStyle(5, 0xb9fbff, 0.8);
            this._stroke(g, points, path.closed);
            g.lineStyle(2, 0xffffff, 0.9);
            this._stroke(g, points, path.closed);
        }
    }

    _stroke(g, points, closed) {
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i++) {
            g.lineTo(points[i].x, points[i].y);
        }
        if (closed) g.closePath();
        g.strokePath();
    }

    destroy() {
        this.gfx.destroy();
    }
}
