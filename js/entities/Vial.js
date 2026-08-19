import { hexToInt } from '../utils/Geometry.js';

var BALLS = [
    { x: 0, y: 6, r: 16, over: false },
    { x: -17, y: -6, r: 14, over: false },
    { x: 16, y: -4, r: 14, over: false },
    { x: -2, y: -18, r: 15, over: false },
    { x: 15, y: -22, r: 13, over: false },
    { x: -16, y: -26, r: 13, over: false },
    { x: 2, y: -38, r: 14, over: true },
    { x: -13, y: -46, r: 11, over: true },
    { x: 14, y: -48, r: 11, over: true }
];

function trapPts(cx, cy, topW, botW, h) {
    var top = cy - h / 2;
    var bot = cy + h / 2;
    return [
        { x: cx - topW / 2, y: top },
        { x: cx + topW / 2, y: top },
        { x: cx + botW / 2, y: bot },
        { x: cx - botW / 2, y: bot }
    ];
}

function fillPts(g, pts) {
    if (!pts.length) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
}

function darkenLocal(color, k) {
    var r = (color >> 16) & 255;
    var g = (color >> 8) & 255;
    var b = color & 255;
    r = Math.round(r * (1 - k));
    g = Math.round(g * (1 - k));
    b = Math.round(b * (1 - k));
    return (r << 16) | (g << 8) | b;
}

/**
 * Корзина из крафт-бумаги: внутрь летят скомканные шарики.
 */
export class Vial {
    constructor(scene, x, y, colorName, palette) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.colorName = colorName;
        this.color = hexToInt(palette[colorName] || 0xff4d6d);
        this.fill = 0;
        this.targetFill = 0;
        this.pulse = 0;
        this.visualScale = 1;
        this.squashX = 1;
        this.squashY = 1;
        this.remainingCount = 1;
        this.busy = false;
        this.w = 108;
        this.h = 132;
        this.gfx = scene.add.graphics();
        this.icon = scene.add.circle(x, y, 1, this.color, 0);
        this.label = scene.add.text(x, y + 78, colorName, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#f6efe4'
        }).setOrigin(0.5, 0);
        this.time = 0;
    }

    setColor(colorName, palette) {
        if (this.colorName !== colorName) {
            this.fill = 0;
            this.targetFill = 0;
        }
        this.colorName = colorName;
        this.color = hexToInt(palette[colorName] || 0xff4d6d);
        this.icon.setFillStyle(this.color);
        this._refreshLabel();
    }

    setRemainingCount(count) {
        this.remainingCount = Math.max(1, count || 1);
        this._refreshLabel();
    }

    _refreshLabel() {
        this.label.setText(this.colorName + '  ×' + this.remainingCount);
    }

    setFill(v, immediate) {
        var next = Phaser.Math.Clamp(v, 0, 1);
        if (immediate) {
            this.fill = next;
            this.targetFill = next;
            this.pulse = 0;
            return;
        }
        if (next > this.targetFill + 0.005) this.pulse = 1;
        this.targetFill = next;
    }

    update(dt) {
        this.time += dt;
        var ease = Math.min(1, dt * 8);
        this.fill += (this.targetFill - this.fill) * ease;
        if (Math.abs(this.targetFill - this.fill) < 0.001) {
            this.fill = this.targetFill;
        }
        this.pulse = Math.max(0, this.pulse - dt * 2.8);
        var punch = 1 + Math.sin((1 - this.pulse) * Math.PI) * this.pulse * 0.09;
        this.visualScale = punch;
        this.label.setScale(punch * this.squashX, punch * this.squashY);
        var key = (this.fill * 1000 | 0) + ':' + (this.visualScale * 200 | 0) + ':' +
            ((this.gfx.alpha * 100) | 0) + ':' + this.colorName + ':' +
            ((this.squashX * 100) | 0) + ':' + ((this.squashY * 100) | 0);
        if (key === this._drawKey) return;
        this._drawKey = key;
        this._draw();
    }

    appear() {
        this.squashX = 1;
        this.squashY = 1;
        if (GameSettings.reducedMotion()) {
            this.visualScale = 1;
            this.gfx.setAlpha(1);
            this.icon.setAlpha(0);
            this.label.setAlpha(1);
            return;
        }
        this.scene.tweens.killTweensOf(this);
        this.visualScale = 0.82;
        this.gfx.setAlpha(0);
        this.icon.setAlpha(0);
        this.label.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            visualScale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        this.scene.tweens.add({
            targets: [this.gfx, this.label],
            alpha: 1,
            duration: 180,
            ease: 'Quad.easeOut'
        });
    }

    _draw() {
        var g = this.gfx;
        g.clear();
        var s = this.visualScale;
        var w = this.w * s * this.squashX;
        var h = this.h * s * this.squashY;
        var x = this.x;
        var y = this.y;
        var seed = (Math.round(this.x) * 13 + Math.round(this.y) * 7) >>> 0;
        var color = (window.Paper && Paper.craft) ? Paper.craft(this.color) : this.color;
        var topW = w * 1.08;
        var botW = w * 0.68;
        var body = trapPts(x, y, topW, botW, h);
        var deckle = trapPts(x, y, topW + 14 * s, botW + 12 * s, h + 10 * s);
        var inner = trapPts(x, y + 6 * s, topW * 0.76, botW * 0.76, h * 0.7);
        if (window.Paper && Paper.tearPoly) {
            body = Paper.tearPoly(body, seed, 4);
            deckle = Paper.tearPoly(deckle, seed + 3, 5);
            inner = Paper.tearPoly(inner, seed + 5, 3);
        }

        g.fillStyle(0x061428, 0.16);
        fillPts(g, body.map(function (p) { return { x: p.x + 14, y: p.y + 18 }; }));
        g.fillStyle(0x061428, 0.42);
        fillPts(g, body.map(function (p) { return { x: p.x + 8, y: p.y + 11 }; }));
        g.fillStyle(0xf7f1e6, 1);
        fillPts(g, deckle);
        g.fillStyle(color, 1);
        fillPts(g, body);

        if (window.Paper && Paper.craft) {
            g.fillStyle(darkenLocal(color, 0.12), 0.16);
            g.fillEllipse(x - w * 0.08, y + h * 0.04, w * 0.42, h * 0.22);
            g.fillStyle(0xf7f1e6, 0.12);
            g.fillEllipse(x + w * 0.1, y - h * 0.12, w * 0.28, h * 0.14);
        }

        g.fillStyle(0x2a241c, 0.86);
        fillPts(g, inner);

        var n = this.fill * BALLS.length;
        var i;
        var pass;
        for (pass = 0; pass < 2; pass++) {
            if (pass === 1) {
                var lip = trapPts(x, y + h * 0.34, topW * 0.98, botW * 0.94, h * 0.36);
                if (window.Paper && Paper.tearPoly) lip = Paper.tearPoly(lip, seed + 9, 3);
                g.fillStyle(darkenLocal(color, 0.18), 1);
                fillPts(g, lip);
                g.fillStyle(0x3d3428, 0.18);
                g.fillRect(x - botW * 0.22, y + h * 0.16, botW * 0.12, h * 0.28);
            }
            for (i = 0; i < BALLS.length; i++) {
                var p = BALLS[i];
                if (!!p.over !== (pass === 1)) continue;
                var vis = Phaser.Math.Clamp(n - i, 0, 1);
                if (vis <= 0.04) continue;
                if (window.Paper && Paper.drawCrumple) {
                    Paper.drawCrumple(
                        g,
                        x + p.x * s,
                        y + p.y * s,
                        p.r * s * (0.55 + vis * 0.45),
                        this.color,
                        seed + i * 17
                    );
                } else {
                    g.fillStyle(this.color, vis);
                    g.fillCircle(x + p.x * s, y + p.y * s, p.r * s * vis);
                }
            }
        }
    }

    juicyCatch() {
        this.pulse = 1;
        if (GameSettings.reducedMotion()) {
            this.squashX = 1;
            this.squashY = 1;
            return;
        }
        this.scene.tweens.killTweensOf(this);
        this.squashX = 1.22;
        this.squashY = 0.78;
        this.scene.tweens.add({
            targets: this,
            squashX: 1,
            squashY: 1,
            duration: 420,
            ease: 'Elastic.easeOut'
        });
    }

    explode(onDone) {
        var self = this;
        var duration = GameSettings.reducedMotion() ? 200 : 860;
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.killTweensOf([this.gfx, this.icon, this.label]);
        this.scene.tweens.add({
            targets: this,
            visualScale: 0.74,
            duration: duration,
            ease: 'Cubic.easeIn'
        });
        this.scene.tweens.add({
            targets: [this.gfx, this.label],
            alpha: 0,
            duration: duration,
            ease: 'Sine.easeIn',
            onComplete: function () {
                self.visualScale = 1;
                self.squashX = 1;
                self.squashY = 1;
                self.gfx.setScale(1).setAlpha(0);
                self.icon.setScale(1).setAlpha(0);
                self.label.setScale(1).setAlpha(0);
                if (onDone) onDone();
            }
        });
    }

    destroy() {
        this.gfx.destroy();
        this.icon.destroy();
        this.label.destroy();
    }
}
