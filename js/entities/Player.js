import { dist, polylineLength, trailHitsSelf } from '../utils/Geometry.js';
import { SkinManager } from '../managers/SkinManager.js?v=1.7.6';

function strokeDashedPolyline(g, pts, dash, gap, width, color, alpha) {
    if (!pts || pts.length < 2) return;
    var period = dash + gap;
    var i;
    g.lineStyle(width, color, alpha);
    pts[0]._dash = 0;
    for (i = 1; i < pts.length; i++) {
        var x0 = pts[i - 1].x;
        var y0 = pts[i - 1].y;
        var x1 = pts[i].x;
        var y1 = pts[i].y;
        var dx = x1 - x0;
        var dy = y1 - y0;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) continue;
        var ux = dx / len;
        var uy = dy / len;
        var t = 0;
        var acc = pts[i - 1]._dash || 0;
        while (t < len) {
            var inDash = (acc % period) < dash;
            var slot = inDash ? dash - (acc % period) : gap - ((acc % period) - dash);
            var step = Math.min(slot, len - t);
            if (inDash && step > 0.4) {
                g.beginPath();
                g.moveTo(x0 + ux * t, y0 + uy * t);
                g.lineTo(x0 + ux * (t + step), y0 + uy * (t + step));
                g.strokePath();
            }
            t += step;
            acc += step;
        }
        pts[i]._dash = acc;
    }
}

function makeSawDot(scene) {
    var c = scene.add.container(0, 0);
    var g = scene.add.graphics();
    g.fillStyle(0x111111, 0.35);
    g.fillRoundedRect(-11, -8, 32, 16, 4);
    g.fillStyle(0x4a2c1a, 1);
    g.fillRoundedRect(-20, -7, 14, 14, 3);
    g.fillStyle(0x2a1810, 1);
    g.fillRect(-17, -3, 8, 6);
    g.fillStyle(0x6d7480, 1);
    g.fillRoundedRect(-9, -9, 16, 18, 4);
    g.fillStyle(0x47a798, 1);
    g.fillCircle(-2, 0, 3);
    g.fillStyle(0xd7dde4, 1);
    g.fillRoundedRect(5, -5, 22, 10, 2);
    g.fillStyle(0x5c6370, 1);
    var i;
    for (i = 0; i < 6; i++) {
        var tx = 7 + i * 3.4;
        g.fillTriangle(tx, -5, tx + 1.7, -10, tx + 3.4, -5);
        g.fillTriangle(tx, 5, tx + 1.7, 10, tx + 3.4, 5);
    }
    c.add(g);
    return c;
}

function makeSaberDot(scene) {
    var c = scene.add.container(0, 0);
    var g = scene.add.graphics();
    g.fillStyle(0x48f0a0, 0.3);
    g.fillRoundedRect(2, -8, 34, 16, 7);
    g.fillStyle(0x7dffc4, 1);
    g.fillRoundedRect(5, -3.5, 30, 7, 3);
    g.fillStyle(0xf3ead8, 0.85);
    g.fillRoundedRect(6, -1.4, 26, 2.8, 2);
    g.fillStyle(0x2a241c, 1);
    g.fillRoundedRect(-14, -5, 18, 10, 2);
    g.fillStyle(0x8a7a68, 1);
    g.fillRect(-9, -6, 3, 12);
    g.fillStyle(0xd8cbb4, 1);
    g.fillCircle(3, 0, 2.4);
    c.add(g);
    return c;
}

function strokePolyline(g, pts, width, color, alpha) {
    if (!pts || pts.length < 2) return;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
}

export function makeUnicornDot(scene) {
    var c = scene.add.container(0, 0);
    var g = scene.add.graphics();
    g.fillStyle(0xfff1a8, 1);
    g.fillTriangle(12, -4, 36, 0, 12, 4);
    g.fillStyle(0xffd24a, 1);
    g.fillTriangle(14, -2, 32, 0, 14, 2);
    g.lineStyle(2, 0x3d2a22, 0.85);
    g.beginPath();
    g.moveTo(12, -4);
    g.lineTo(36, 0);
    g.lineTo(12, 4);
    g.closePath();
    g.strokePath();
    g.fillStyle(0xfff6ea, 1);
    g.fillCircle(0, 2, 13);
    g.lineStyle(3, 0x3d2a22, 1);
    g.strokeCircle(0, 2, 13);
    g.fillStyle(0xffd0ea, 1);
    g.fillTriangle(-2, -11, 7, -8, 2, -2);
    g.lineStyle(2, 0x3d2a22, 0.9);
    g.strokeTriangle(-2, -11, 7, -8, 2, -2);
    g.fillStyle(0xff7ad9, 1);
    g.fillCircle(-9, -5, 5);
    g.fillStyle(0x7dffc4, 1);
    g.fillCircle(-12, 2, 4.5);
    g.fillStyle(0x4a9fff, 1);
    g.fillCircle(-9, 9, 4);
    g.fillStyle(0x1a120c, 1);
    g.fillCircle(5, 0, 2.3);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5.8, -0.7, 0.9);
    c.add(g);
    return c;
}

export class Player {
    constructor(scene, x, y, cfg) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.lastSafeX = x;
        this.lastSafeY = y;
        this.radius = 11;
        this.hitR = 17;
        this.baseSpeed = (cfg && cfg.playerSpeed) || 210;
        this.speed = this.baseSpeed;
        this.trail = [];
        this.drawing = false;
        this.flameIndex = -1;
        this.flameSpeed = 420;
        this.magnetState = null;
        this.skin = SkinManager.selected();
        this.facing = -Math.PI / 2;

        var isCircle = this.skin.shape === 'circle';
        var glowR = isCircle ? 20 : (this.skin.shape === 'unicorn' ? 22 : 18);
        this.glow = scene.add.circle(
            x, y,
            glowR,
            isCircle ? 0x111111 : this.skin.glowColor,
            isCircle ? 0.28 : 0.18
        );
        if (!isCircle && this.skin.shape !== 'unicorn') {
            this.glow.setBlendMode(Phaser.BlendModes.ADD);
        }
        this.glow.setDepth(8);
        this.dot = this._createDot(scene, x, y);
        this.dot.setDepth(9);
        this.shieldRing = scene.add.circle(x, y, 23, 0x55eaff, 0.06);
        this.shieldRing.setStrokeStyle(4, 0x72f5ff, 0.9);
        this.shieldRing.setBlendMode(Phaser.BlendModes.ADD);
        this.shieldRing.setDepth(10);
        this.shieldRing.setVisible(false);
        this.trailGfx = scene.add.graphics();
        this.trailGfx.setDepth(7);
        this.wake = [];
    }

    _createDot(scene, x, y) {
        var r = this.radius;
        var dot;
        if (this.skin.shape === 'diamond') {
            dot = scene.add.rectangle(x, y, r * 1.65, r * 1.65, this.skin.coreColor);
            dot.setAngle(45);
            dot.setStrokeStyle(3, this.skin.strokeColor, 1);
        } else if (this.skin.shape === 'star') {
            dot = scene.add.star(x, y, 5, r * 0.55, r * 1.25, this.skin.coreColor);
            dot.setStrokeStyle(2, this.skin.strokeColor, 1);
        } else if (this.skin.shape === 'hex') {
            dot = scene.add.star(x, y, 6, r * 0.72, r * 1.22, this.skin.coreColor);
            dot.setStrokeStyle(3, this.skin.strokeColor, 1);
        } else if (this.skin.shape === 'saw') {
            dot = makeSawDot(scene);
            dot.setPosition(x, y);
        } else if (this.skin.shape === 'saber') {
            dot = makeSaberDot(scene);
            dot.setPosition(x, y);
        } else if (this.skin.shape === 'unicorn') {
            dot = makeUnicornDot(scene);
            dot.setPosition(x, y);
        } else if (this.skin.shape === 'comet') {
            dot = scene.add.triangle(
                x, y,
                0, -r * 1.55,
                -r * 0.95, r * 1.05,
                r * 0.95, r * 1.05,
                this.skin.coreColor
            );
            dot.setStrokeStyle(3, this.skin.strokeColor, 1);
        } else if (this.skin.shape === 'wisp') {
            dot = scene.add.circle(x, y, r * 1.15, this.skin.coreColor, 0.42);
            dot.setStrokeStyle(4, this.skin.strokeColor, 0.95);
            dot.setBlendMode(Phaser.BlendModes.ADD);
        } else {
            var alpha = this.skin.shape === 'ring' ? 0.3 : 1;
            var visualR = this.skin.shape === 'circle' ? r + 3 : r;
            dot = scene.add.circle(x, y, visualR, this.skin.coreColor, alpha);
            dot.setStrokeStyle(
                this.skin.shape === 'ring' ? 5 : (this.skin.shape === 'circle' ? 5 : 4),
                this.skin.shape === 'circle' ? 0x111111 : this.skin.strokeColor,
                1
            );
        }
        return dot;
    }

    copyVisual(scene) {
        var wrap = scene.add.container(this.x, this.y);
        var isCircle = this.skin.shape === 'circle';
        var glowR = isCircle ? 20 : (this.skin.shape === 'unicorn' ? 22 : 18);
        var glow = scene.add.circle(
            0, 0,
            glowR,
            isCircle ? 0x111111 : this.skin.glowColor,
            isCircle ? 0.28 : 0.18
        );
        if (!isCircle && this.skin.shape !== 'unicorn') {
            glow.setBlendMode(Phaser.BlendModes.ADD);
        }
        wrap.add(glow);
        wrap.add(this._createDot(scene, 0, 0));
        wrap.setDepth(95);
        return wrap;
    }

    hitRadius() {
        return this.hitR || (this.radius + 6);
    }

    resetToSafe() {
        this.x = this.lastSafeX;
        this.y = this.lastSafeY;
        this.trail = [];
        this.drawing = false;
        this.flameIndex = -1;
        this.magnetState = null;
        this._sync();
        this.trailGfx.clear();
    }

    update(dt, dir, field, magnets) {
        if (dir && (dir.x || dir.y)) {
            this.facing = Math.atan2(dir.y, dir.x);
        }
        if (this.magnetState && magnets) {
            var ride = magnets.updateRider(this, dir, dt, field);
            if (ride && ride.detached) {
                if (!this.drawing && ride.landsInColor) {
                    this.drawing = true;
                    this.lastSafeX = ride.from.x;
                    this.lastSafeY = ride.from.y;
                    this.trail = [{ x: ride.from.x, y: ride.from.y }];
                }
                if (this.drawing) {
                    this._appendTrailPoint(ride.from.x, ride.from.y);
                    this._appendTrailPoint(this.x, this.y);
                }

                if (this.drawing && ride.landsOnWall &&
                    polylineLength(this.trail) >= 18) {
                    var closed = this.trail.slice();
                    this.trail = [];
                    this.drawing = false;
                    this.flameIndex = -1;
                    this.lastSafeX = this.x;
                    this.lastSafeY = this.y;
                    this._sync();
                    this._drawTrail();
                    return { detached: true, close: closed };
                }

                if (!this.drawing && ride.landsOnWall) {
                    this.lastSafeX = this.x;
                    this.lastSafeY = this.y;
                }
            } else if (ride && ride.riding && this.drawing) {
                this._appendTrailPoint(this.x, this.y);
            }
            if (this.drawing && trailHitsSelf(this.trail)) {
                return { hitSelf: true };
            }
            this._tickFlame(dt);
            this._sync();
            this._drawTrail();
            return ride;
        }

        if (!dir || (dir.x === 0 && dir.y === 0)) {
            this._tickFlame(dt);
            this._sync();
            this._drawTrail();
            return;
        }
        var nx = this.x + dir.x * this.speed * dt;
        var ny = this.y + dir.y * this.speed * dt;
        var b = field.bounds;
        nx = Phaser.Math.Clamp(nx, b.x + 4, b.x + b.w - 4);
        ny = Phaser.Math.Clamp(ny, b.y + 4, b.y + b.h - 4);

        if (magnets && magnets.tryAttach(this, nx, ny, dir)) {
            // Если точка приехала с внешней стены, хвост не обрывается:
            // магнитная дуга становится частью будущего контура.
            if (this.drawing) {
                this._appendTrailPoint(this.x, this.y);
            } else {
                this.lastSafeX = this.x;
                this.lastSafeY = this.y;
            }
            this._sync();
            this._drawTrail();
            return { magnetAttached: true };
        }

        var wasSafe = field.isWall(this.x, this.y);
        var nowSafe = field.isWall(nx, ny);

        this.x = nx;
        this.y = ny;

        if (wasSafe && !nowSafe) {
            this.drawing = true;
            this.trail = [{ x: this.lastSafeX, y: this.lastSafeY }, { x: this.x, y: this.y }];
        } else if (this.drawing && nowSafe) {
            this.trail.push({ x: this.x, y: this.y });
            if (polylineLength(this.trail) < 18) {
                this.trail = [];
                this.drawing = false;
                this.flameIndex = -1;
                this.lastSafeX = this.x;
                this.lastSafeY = this.y;
            } else {
                var closed = this.trail.slice();
                this.trail = [];
                this.drawing = false;
                this.flameIndex = -1;
                this.lastSafeX = this.x;
                this.lastSafeY = this.y;
                this._sync();
                this._drawTrail();
                return { close: closed };
            }
        } else if (this.drawing) {
            this._appendTrailPoint(this.x, this.y);
            if (trailHitsSelf(this.trail)) {
                return { hitSelf: true };
            }
        } else if (nowSafe) {
            this.lastSafeX = this.x;
            this.lastSafeY = this.y;
        }

        this._tickFlame(dt);
        this._sync();
        this._drawTrail();
        return null;
    }

    _appendTrailPoint(x, y) {
        if (!this.trail.length) {
            this.trail.push({ x: x, y: y });
            return;
        }
        var last = this.trail[this.trail.length - 1];
        if (dist(last.x, last.y, x, y) >= 4) {
            this.trail.push({ x: x, y: y });
        }
    }

    _updateWake() {
        if (!this.skin || !this.skin.rainbow) {
            this.wake = [];
            return;
        }
        var moving = this.scene && this.scene.dir &&
            (this.scene.dir.x || this.scene.dir.y);
        if (moving) {
            var last = this.wake.length ? this.wake[this.wake.length - 1] : null;
            if (!last || dist(last.x, last.y, this.x, this.y) >= 3) {
                this.wake.push({ x: this.x, y: this.y });
            }
            if (this.wake.length > 13) this.wake.shift();
        } else if (this.wake.length) {
            this.wake.shift();
        }
    }

    igniteTrail(atIndex) {
        if (this.flameIndex < 0) this.flameIndex = atIndex;
        else this.flameIndex = Math.max(this.flameIndex, atIndex);
    }

    _tickFlame(dt) {
        if (this.flameIndex < 0 || !this.drawing) return;
        this.flameIndex += this.flameSpeed * dt / 8;
        if (this.flameIndex >= this.trail.length - 1) {
            this.flameIndex = this.trail.length;
        }
    }

    flameReachedHero() {
        return this.drawing && this.flameIndex >= this.trail.length - 1 && this.flameIndex > 0;
    }

    _sync() {
        this.dot.setPosition(this.x, this.y);
        this.glow.setPosition(this.x, this.y);
        this.shieldRing.setPosition(this.x, this.y);
        if (this.skin.shape === 'saw' || this.skin.shape === 'saber' ||
            this.skin.shape === 'comet' || this.skin.shape === 'unicorn') {
            this.dot.setRotation(this.facing);
        }
        if (GameSettings.reducedMotion()) {
            this.glow.setScale(1);
            this.dot.setScale(1);
            return;
        }
        var pulse = Math.sin(this.scene.time.now / 105);
        this.glow.setScale(1.05 + pulse * 0.12);
        if (this.skin.shape !== 'unicorn' && this.skin.shape !== 'saw' && this.skin.shape !== 'saber') {
            this.dot.setScale(this.drawing ? 1.04 + pulse * 0.05 : 1);
        }
        if (this.skin.shape === 'star' || this.skin.shape === 'hex') {
            this.dot.setAngle((this.scene.time.now / 18) % 360);
        }
    }

    setShieldActive(active) {
        this.shieldRing.setVisible(!!active);
        if (!active || GameSettings.reducedMotion()) {
            this.shieldRing.setScale(1);
            return;
        }
        this.shieldRing.setScale(
            1 + Math.sin(this.scene.time.now / 120) * 0.08
        );
    }

    _drawTrail() {
        this._updateWake();
        var g = this.trailGfx;
        g.clear();
        var rainbow = this.skin && this.skin.rainbow;
        var bands = [0xff3b5c, 0xff8a3d, 0xffd24a, 0x3ee6a0, 0x4a9fff, 0xb07cff];
        if (this.trail.length >= 2) {
            strokeDashedPolyline(g, this.trail, 16, 10, 9, 0x1a120c, 0.7);
            strokeDashedPolyline(g, this.trail, 16, 10, 6, 0xffffff, 1);
        }
        if (rainbow && this.wake.length >= 2) {
            var w;
            for (w = 0; w < bands.length; w++) {
                strokePolyline(g, this.wake, 14 - w * 1.8, bands[w], 0.92);
            }
        }
        if (this.trail.length < 2) return;

        if (this.flameIndex >= 0) {
            var fi = Math.min(this.trail.length - 1, Math.floor(this.flameIndex));
            var burning = this.trail.slice(fi);
            if (burning.length >= 2) {
                g.lineStyle(7, 0xffaa33, 1);
                g.beginPath();
                g.moveTo(burning[0].x, burning[0].y);
                var k;
                for (k = 1; k < burning.length; k++) {
                    g.lineTo(burning[k].x, burning[k].y);
                }
                g.strokePath();
            }
        }
    }

    destroy() {
        this.dot.destroy();
        this.glow.destroy();
        this.shieldRing.destroy();
        this.trailGfx.destroy();
    }
}
