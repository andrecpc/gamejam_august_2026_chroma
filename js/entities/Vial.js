import { hexToInt } from '../utils/Geometry.js';

/**
 * Пробирка в UI: корпус + волна жидкости (синусоида по верхнему краю).
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
        this.remainingCount = 1;
        this.w = 92;
        this.h = 150;
        this.gfx = scene.add.graphics();
        this.icon = scene.add.circle(x, y + 102, 16, this.color);
        this.icon.setStrokeStyle(3, 0xffffff, 0.85);
        this.label = scene.add.text(x, y + 128, colorName, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#dfe4ff'
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
        this.icon.setScale(punch);
        this.label.setScale(punch);
        this._draw();
    }

    appear() {
        if (GameSettings.reducedMotion()) {
            this.visualScale = 1;
            this.gfx.setAlpha(1);
            this.icon.setAlpha(1);
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
            targets: [this.gfx, this.icon, this.label],
            alpha: 1,
            duration: 180,
            ease: 'Quad.easeOut'
        });
    }

    _draw() {
        var g = this.gfx;
        g.clear();
        var w = this.w * this.visualScale;
        var h = this.h * this.visualScale;
        var x = this.x - w / 2;
        var y = this.y - h / 2;

        g.fillStyle(0x000000, 0.28);
        g.fillRoundedRect(x + 4, y + 6, w, h, 18);

        g.fillStyle(0x20264a, 0.95);
        g.fillRoundedRect(x, y, w, h, 18);
        g.lineStyle(3, 0xffffff, 0.22);
        g.strokeRoundedRect(x, y, w, h, 18);

        var pad = 8;
        var ix = x + pad;
        var iy = y + pad;
        var iw = w - pad * 2;
        var ih = h - pad * 2;
        var level = ih * this.fill;
        if (level > 2) {
            var top = iy + ih - level;
            g.fillStyle(this.color, 0.92);
            g.beginPath();
            var steps = 14;
            for (var i = 0; i <= steps; i++) {
                var px = ix + iw * (i / steps);
                var wave = Math.sin(i * 0.9 + this.time * 7) * (3.5 + this.fill * 2);
                var py = top + wave;
                if (i === 0) g.moveTo(px, py);
                else g.lineTo(px, py);
            }
            g.lineTo(ix + iw, iy + ih);
            g.lineTo(ix, iy + ih);
            g.closePath();
            g.fillPath();

            g.fillStyle(0xffffff, 0.18);
            g.fillEllipse(ix + iw * 0.35, top + 10, iw * 0.35, 8);

            for (var bubble = 0; bubble < 3; bubble++) {
                var travel = (this.time * (0.22 + bubble * 0.06) + bubble * 0.31) % 1;
                var bubbleY = iy + ih - Math.min(level - 5, travel * Math.max(8, level - 6));
                var bubbleX = ix + iw * (0.25 + bubble * 0.24) +
                    Math.sin(this.time * 2.3 + bubble * 1.8) * 4;
                if (bubbleY > top + 5) {
                    g.fillStyle(0xffffff, 0.22);
                    g.fillCircle(bubbleX, bubbleY, 2 + bubble);
                }
            }
        }

        g.fillStyle(0xffffff, 0.12);
        g.fillRoundedRect(x + 8, y + 10, 14, h - 24, 8);
    }

    explode(onDone) {
        var self = this;
        this.scene.tweens.add({
            targets: [this.gfx, this.icon, this.label],
            scale: 1.25,
            alpha: 0,
            duration: 220,
            ease: 'Back.easeIn',
            onComplete: function () {
                self.gfx.setScale(1).setAlpha(1);
                self.icon.setScale(1).setAlpha(1);
                self.label.setScale(1).setAlpha(1);
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
