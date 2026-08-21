import { hexToInt } from '../utils/Geometry.js';

var ICONS = {
    speed: '⚡',
    slow: '🐌',
    life: '❤',
    hurt: '💔',
    shield: '◆',
    enemySlow: '❄',
    removeEnemy: '✦',
    mystery: '?'
};

var COLORS = {
    speed: 0xe0a33a,
    slow: 0x7c4dff,
    life: 0xde3449,
    hurt: 0xb95c6b,
    shield: 0x47a798,
    enemySlow: 0x2b74e8,
    removeEnemy: 0xff8a3d,
    mystery: 0xe6d8c0
};

var ANGLES = {
    speed: -8,
    slow: 7,
    life: -4,
    hurt: 11,
    shield: 0,
    enemySlow: -10,
    removeEnemy: 6,
    mystery: -12
};

// Старые кружки не удалены: поставь false, чтобы вернуть прежний вид.
var PAPER_LOOK = true;

function fillPts(g, pts) {
    if (!pts || pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
}

function strokePts(g, pts) {
    if (!pts || pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.strokePath();
}

function expandPts(pts, pad) {
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < pts.length; i++) {
        cx += pts[i].x;
        cy += pts[i].y;
    }
    cx /= pts.length;
    cy /= pts.length;
    var out = [];
    for (i = 0; i < pts.length; i++) {
        var dx = pts[i].x - cx;
        var dy = pts[i].y - cy;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        out.push({
            x: pts[i].x + dx / len * pad,
            y: pts[i].y + dy / len * pad
        });
    }
    return out;
}

function lightningPts(s) {
    var raw = [
        [48, 0],
        [18, 46],
        [36, 46],
        [8, 100],
        [68, 40],
        [46, 40]
    ];
    var i;
    var pts = [];
    for (i = 0; i < raw.length; i++) {
        pts.push({
            x: (raw[i][0] - 38) / 46 * s,
            y: (raw[i][1] - 50) / 50 * s * 1.18
        });
    }
    return pts;
}

function heartPts(s) {
    var pts = [];
    var i;
    var n = 20;
    for (i = 0; i < n; i++) {
        var t = (i / n) * Math.PI * 2;
        var x = 16 * Math.pow(Math.sin(t), 3);
        var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push({ x: x * s * 0.05, y: y * s * 0.05 });
    }
    return pts;
}

function heartHalfPts(s, dir) {
    var pts = [];
    var i;
    var n = 11;
    var cx = dir * s * 0.26;
    var cy = -s * 0.2;
    var r = s * 0.36;
    var a0 = dir < 0 ? Math.PI * 1.12 : -Math.PI * 0.12;
    var a1 = dir < 0 ? -Math.PI * 0.12 : Math.PI * 1.12;
    for (i = 0; i <= n; i++) {
        var t = i / n;
        var a = a0 + (a1 - a0) * t;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    pts.push({ x: dir * s * 0.05, y: s * 0.78 });
    pts.push({ x: dir * s * 0.16, y: s * 0.32 });
    pts.push({ x: dir * s * 0.02, y: s * 0.04 });
    pts.push({ x: dir * s * 0.18, y: -s * 0.16 });
    pts.push({ x: dir * s * 0.06, y: -s * 0.44 });
    for (i = 0; i < pts.length; i++) pts[i].x += dir * s * 0.1;
    return pts;
}

function snailPts(s) {
    var pts = [];
    var i;
    var n = 16;
    var cx = s * 0.16;
    var cy = -s * 0.18;
    var r = s * 0.58;
    for (i = 0; i <= n; i++) {
        var a = Math.PI * 0.72 + i / n * Math.PI * 1.72;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    pts.push({ x: s * 0.38, y: s * 0.38 });
    pts.push({ x: s * 0.08, y: s * 0.62 });
    pts.push({ x: -s * 0.42, y: s * 0.56 });
    pts.push({ x: -s * 0.78, y: s * 0.28 });
    pts.push({ x: -s * 0.82, y: s * 0.02 });
    pts.push({ x: -s * 0.96, y: -s * 0.22 });
    pts.push({ x: -s * 1.08, y: -s * 0.4 });
    pts.push({ x: -s * 0.92, y: -s * 0.46 });
    pts.push({ x: -s * 0.8, y: -s * 0.24 });
    pts.push({ x: -s * 0.7, y: -s * 0.06 });
    pts.push({ x: -s * 0.58, y: -s * 0.36 });
    pts.push({ x: -s * 0.42, y: -s * 0.4 });
    pts.push({ x: -s * 0.48, y: -s * 0.1 });
    pts.push({ x: -s * 0.32, y: s * 0.06 });
    return pts;
}

function shieldPts(s) {
    return [
        { x: 0, y: -s * 1.0 },
        { x: s * 0.78, y: -s * 0.58 },
        { x: s * 0.7, y: s * 0.22 },
        { x: 0, y: s * 1.0 },
        { x: -s * 0.7, y: s * 0.22 },
        { x: -s * 0.78, y: -s * 0.58 }
    ];
}

function starPts(s) {
    var pts = [];
    var i;
    for (i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rad = i % 2 === 0 ? s : s * 0.42;
        pts.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
    }
    return pts;
}

function hexPts(s) {
    var pts = [];
    var i;
    for (i = 0; i < 6; i++) {
        var a = Math.PI / 6 + i * Math.PI / 3;
        pts.push({ x: Math.cos(a) * s, y: Math.sin(a) * s });
    }
    return pts;
}

function stickerPts(s) {
    var w = s * 0.92;
    var h = s * 0.88;
    var c = s * 0.28;
    return [
        { x: -w + c, y: -h },
        { x: w - c, y: -h },
        { x: w, y: -h + c },
        { x: w, y: h - c },
        { x: w - c, y: h },
        { x: -w + c, y: h },
        { x: -w, y: h - c },
        { x: -w, y: -h + c }
    ];
}

function burstPts(s) {
    var pts = [];
    var i;
    var n = 12;
    for (i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * Math.PI * 2 / n;
        var rad = i % 2 === 0 ? s * 1.06 : s * 0.52;
        pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }
    return pts;
}

function shapeFor(type, s) {
    if (type === 'speed') return lightningPts(s);
    if (type === 'life') return heartPts(s);
    if (type === 'hurt') return heartHalfPts(s, -1);
    if (type === 'shield') return shieldPts(s);
    if (type === 'enemySlow') return hexPts(s);
    if (type === 'removeEnemy') return starPts(s);
    if (type === 'slow') return snailPts(s);
    return stickerPts(s);
}

export class Booster {
    constructor(scene, cfg) {
        this.scene = scene;
        this.cfg = cfg;
        this.type = cfg.type || 'mystery';
        this.x = cfg.x;
        this.y = cfg.y;
        this.radius = cfg.radius || 22;
        this.active = false;
        this.collected = false;
        this.color = hexToInt(cfg.color || COLORS[this.type] || 0xe6d8c0);

        this.container = scene.add.container(this.x, this.y);
        this.container.setDepth(10);
        this.glow = scene.add.circle(0, 0, this.radius + 10, this.color, 0.18);
        this.body = scene.add.circle(0, 0, this.radius, this.color, 0.92);
        this.body.setStrokeStyle(3, 0xffffff, 0.9);
        this.paper = scene.add.graphics();
        this.icon = scene.add.text(0, 0, cfg.icon || ICONS[this.type] || '?', {
            fontFamily: 'Arial, sans-serif',
            fontSize: (this.type === 'mystery' ? 30 : 24) + 'px',
            fontStyle: 'bold',
            color: '#14203a'
        }).setOrigin(0.5);
        this.container.add([this.glow, this.body, this.paper, this.icon]);
        this.container.setVisible(false);

        this._drawSticker();
        if (PAPER_LOOK) {
            this.glow.setVisible(false);
            this.body.setVisible(false);
            this.icon.setVisible(this.type === 'mystery');
            this.paper.setVisible(true);
            this.paper.setAngle(ANGLES[this.type] || -6);
        } else {
            this.paper.setVisible(false);
            this.glow.setVisible(true);
            this.body.setVisible(true);
            this.icon.setVisible(true);
        }

        this.pulseTween = scene.tweens.add({
            targets: PAPER_LOOK ? this.paper : this.glow,
            scale: PAPER_LOOK ? 1.08 : 1.35,
            alpha: PAPER_LOOK ? 1 : 0.04,
            duration: 680,
            yoyo: true,
            repeat: -1,
            paused: true
        });
    }

    _paintShape(g, base, seed, color) {
        var body = base;
        var deckle = expandPts(base, 4);
        if (window.Paper && Paper.tearPoly) {
            body = Paper.tearPoly(base, seed, 2.2);
            deckle = Paper.tearPoly(expandPts(base, 4), seed + 5, 3);
        }
        g.fillStyle(0x061428, 0.22);
        fillPts(g, deckle.map(function (p) {
            return { x: p.x + 4, y: p.y + 6 };
        }));
        g.fillStyle(0xf7f1e6, 1);
        fillPts(g, deckle);
        g.fillStyle(color, 1);
        fillPts(g, body);
        g.lineStyle(2.2, 0xffffff, 0.92);
        strokePts(g, deckle);
    }

    _drawSnailDetails(g, s) {
        g.lineStyle(2.1, 0x24153d, 0.58);
        g.beginPath();
        var cx = s * 0.16;
        var cy = -s * 0.18;
        var t;
        for (t = 0; t <= 1.001; t += 0.04) {
            var ang = t * Math.PI * 2.15 + 0.35;
            var r = s * (0.07 + t * 0.4);
            var x = cx + Math.cos(ang) * r;
            var y = cy + Math.sin(ang) * r;
            if (t === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.strokePath();
        g.fillStyle(0x1a1230, 0.88);
        g.fillCircle(-s * 1.0, -s * 0.4, Math.max(2.2, s * 0.075));
        g.fillCircle(-s * 0.5, -s * 0.38, Math.max(2.2, s * 0.075));
        g.fillStyle(0xf7f1e6, 0.92);
        g.fillCircle(-s * 1.02, -s * 0.42, Math.max(1, s * 0.03));
        g.fillCircle(-s * 0.52, -s * 0.4, Math.max(1, s * 0.03));
    }

    _drawSticker() {
        var g = this.paper;
        g.clear();
        var s = this.radius * 0.95;
        if (this.type === 'slow' || this.type === 'hurt') s = this.radius * 0.64;
        var seed = (Math.round((this.x || 1) * 17 + (this.y || 1) * 11 + s * 3) >>> 0);
        if (this.type === 'hurt') {
            this._paintShape(g, heartHalfPts(s, -1), seed, this.color);
            this._paintShape(g, heartHalfPts(s, 1), seed + 11, this.color);
            return;
        }
        this._paintShape(g, shapeFor(this.type, s), seed, this.color);
        if (this.type === 'slow') this._drawSnailDetails(g, s);
    }

    show() {
        if (this.collected) return;
        this.active = true;
        this.container.setVisible(true);
        if (GameSettings.reducedMotion()) {
            this.container.setScale(1);
            return;
        }
        this.container.setScale(0);
        this.pulseTween.resume();
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut'
        });
    }

    despawn() {
        if (this.collected) return;
        this.active = false;
        this.collected = true;
        if (this.pulseTween) this.pulseTween.pause();
        this.container.setVisible(false);
    }

    collect(onComplete) {
        if (!this.active || this.collected) return;
        this.active = false;
        this.collected = true;
        this.pulseTween.pause();
        if (GameSettings.reducedMotion()) {
            this.container.setVisible(false);
            if (onComplete) onComplete();
            return;
        }
        this.scene.tweens.add({
            targets: this.container,
            scale: 1.7,
            alpha: 0,
            duration: 180,
            ease: 'Cubic.easeOut',
            onComplete: function () {
                this.container.setVisible(false);
                if (onComplete) onComplete();
            }.bind(this)
        });
    }

    destroy() {
        if (this.pulseTween) this.pulseTween.stop();
        this.container.destroy();
    }
}
