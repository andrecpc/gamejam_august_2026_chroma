import { dist, polylineLength, trailHitsSelf } from '../utils/Geometry.js';
import { SkinManager } from '../managers/SkinManager.js?v=1.5.4';

export class Player {
    constructor(scene, x, y, cfg) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.lastSafeX = x;
        this.lastSafeY = y;
        this.radius = 11;
        this.baseSpeed = (cfg && cfg.playerSpeed) || 210;
        this.speed = this.baseSpeed;
        this.trail = [];
        this.drawing = false;
        this.flameIndex = -1;
        this.flameSpeed = 420;
        this.magnetState = null;
        this.skin = SkinManager.selected();
        this.facing = -Math.PI / 2;

        this.glow = scene.add.circle(
            x, y, this.skin.shape === 'wisp' ? 26 : 18, this.skin.glowColor, 0.18
        );
        this.glow.setBlendMode(Phaser.BlendModes.ADD);
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
            dot = scene.add.circle(x, y, r, this.skin.coreColor, alpha);
            dot.setStrokeStyle(
                this.skin.shape === 'ring' ? 5 : 3,
                this.skin.strokeColor,
                1
            );
        }
        return dot;
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
        if (GameSettings.reducedMotion()) {
            this.glow.setScale(1);
            this.dot.setScale(1);
            return;
        }
        var pulse = Math.sin(this.scene.time.now / 105);
        this.glow.setScale(1.05 + pulse * 0.12);
        this.dot.setScale(this.drawing ? 1.04 + pulse * 0.05 : 1);
        if (this.skin.shape === 'star' || this.skin.shape === 'hex') {
            this.dot.setAngle((this.scene.time.now / 18) % 360);
        } else if (this.skin.shape === 'comet') {
            this.dot.setRotation(this.facing + Math.PI / 2);
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
        var g = this.trailGfx;
        g.clear();
        if (this.trail.length < 2) return;
        var maxLen = 420;
        var len = 0;
        for (var i = 1; i < this.trail.length; i++) {
            var dx = this.trail[i].x - this.trail[i - 1].x;
            var dy = this.trail[i].y - this.trail[i - 1].y;
            len += Math.sqrt(dx * dx + dy * dy);
        }
        var danger = Math.min(1, len / maxLen);
        var pulse = 1 + Math.sin(this.scene.time.now / 90) * 0.35 * danger;
        var color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(this.skin.trailColor),
            Phaser.Display.Color.ValueToColor(this.skin.dangerColor),
            100,
            Math.floor(danger * 100)
        );
        var c = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
        g.lineStyle((this.skin.trailWidth || 4) * pulse, c, 0.95);
        g.beginPath();
        g.moveTo(this.trail[0].x, this.trail[0].y);
        for (var j = 1; j < this.trail.length; j++) {
            g.lineTo(this.trail[j].x, this.trail[j].y);
        }
        g.strokePath();

        if (this.flameIndex >= 0) {
            var fi = Math.min(this.trail.length - 1, Math.floor(this.flameIndex));
            g.lineStyle(6, 0xffaa33, 1);
            g.beginPath();
            g.moveTo(this.trail[fi].x, this.trail[fi].y);
            for (var k = fi + 1; k < this.trail.length; k++) {
                g.lineTo(this.trail[k].x, this.trail[k].y);
            }
            g.strokePath();
        }
    }

    destroy() {
        this.dot.destroy();
        this.glow.destroy();
        this.shieldRing.destroy();
        this.trailGfx.destroy();
    }
}
