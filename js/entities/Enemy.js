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

function circlePts(r, n) {
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
}

function expandPts(pts, pad) {
    var out = [];
    var i;
    for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        var len = Math.sqrt(p.x * p.x + p.y * p.y) || 1;
        out.push({
            x: p.x / len * (len + pad),
            y: p.y / len * (len + pad)
        });
    }
    return out;
}

// Старый кружок+глаз+бейдж не удалён: поставь false, чтобы вернуть прежний вид.
var PAPER_LOOK = true;

export class Enemy {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.type = 'pingpong';
        this.x = 0;
        this.y = 0;
        this.vx = 80;
        this.vy = 70;
        this.speedMultiplier = 1;
        this.r = 13;
        this.stuckFor = 0;
        this.cfg = {};
        this.nextActionAt = 0;
        this.lastDrainX = null;
        this.lastDrainY = null;
        this.drainStarted = false;
        this.drainPath = [];
        this.dot = scene.add.circle(0, 0, this.r, 0xff3b5c);
        this.dot.setStrokeStyle(3, 0xffffff, 0.7);
        this.dot.setVisible(false);
        this.dot.setDepth(6);
        this.eye = scene.add.circle(0, 0, 4, 0x1a1020);
        this.eye.setVisible(false);
        this.eye.setDepth(6);
        this.badge = scene.add.text(0, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(7).setVisible(false);
        this.paper = scene.add.graphics();
        this.paper.setDepth(6);
        this.paper.setVisible(false);
        this.tint = 0xff3b5c;
        this._paperPhase = Math.random() * Math.PI * 2;
        this._paperBody = null;
        this._paperDeckle = null;
        this._paperKey = '';
    }

    spawn(cfg) {
        this.cfg = cfg;
        this.active = true;
        this.type = cfg.type || 'pingpong';
        this.x = cfg.x;
        this.y = cfg.y;
        this.vx = cfg.vx != null ? cfg.vx : 90;
        this.vy = cfg.vy != null ? cfg.vy : 70;
        if (this.vx === 0) this.vx = 90;
        if (this.vy === 0) this.vy = 70;
        this.r = cfg.r || 13;
        this.stuckFor = 0;
        this.speedMultiplier = 1;
        this.nextActionAt = this.scene.time.now +
            (cfg.initialDelay != null ? cfg.initialDelay : 900);
        this.lastDrainX = null;
        this.lastDrainY = null;
        this.drainStarted = false;
        this.drainPath = [];
        var colors = {
            pingpong: 0xde3449,
            rover: 0xe0a33a,
            chase: 0x7c4dff,
            turret: 0x2b74e8,
            thief: 0x2bbf8a,
            laser: 0xf06bd0
        };
        var badges = {
            rover: 'R',
            chase: 'C',
            turret: 'T',
            thief: 'S',
            laser: 'L'
        };
        this.dot.setFillStyle(colors[this.type] || 0xff3b5c);
        this.dot.setRadius(this.r);
        this.tint = colors[this.type] || 0xff3b5c;
        this._paperBody = null;
        this._paperDeckle = null;
        this._paperKey = '';
        this._buildPaperShape();
        if (PAPER_LOOK) {
            this.dot.setVisible(false);
            this.eye.setVisible(false);
            this.badge.setVisible(false);
            this.paper.setVisible(true);
            this.paper.setAlpha(1);
            this.paper.setScale(1);
        } else {
            this.paper.setVisible(false);
            this.dot.setVisible(true);
            this.eye.setVisible(true);
            this.badge.setText(badges[this.type] || '');
            this.badge.setVisible(!!badges[this.type]);
        }
        if (this.type === 'thief') {
            this.dot.setStrokeStyle(4, 0xffffff, 1);
            this.dot.setDepth(10);
            this.eye.setDepth(11);
            this.badge.setDepth(11);
            this.paper.setDepth(10);
        }
        this._sync();
    }

    update(dt, field, player) {
        if (!this.active) return;
        if (this.type === 'turret' || this.type === 'laser') {
            this._sync();
            return;
        }
        if (this.type === 'rover' || this.type === 'thief') {
            if (this.type === 'thief') {
                var currentSpeed = Math.sqrt(
                    this.vx * this.vx + this.vy * this.vy
                ) || 1;
                var thiefSpeed = this.cfg.speed || 18;
                this.vx = this.vx / currentSpeed * thiefSpeed;
                this.vy = this.vy / currentSpeed * thiefSpeed;
            }
            this._updateRover(dt, field);
            return;
        }
        if (this.type === 'chase' && player) {
            var dx = player.x - this.x;
            var dy = player.y - this.y;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var speed = this.cfg.speed || 72;
            var tx = this.x + dx / len * 14;
            var ty = this.y + dy / len * 14;
            if (field.isUnclaimed(tx, ty)) {
                this.vx = dx / len * speed;
                this.vy = dy / len * speed;
            }
        }
        this._updateColorBound(dt, field);
    }

    _updateColorBound(dt, field) {
        if (!this.active) return;
        var elapsed = dt;
        dt *= this.speedMultiplier || 1;
        // pingpong — только по оставшемуся цвету.
        // rover (позже) — по всему полю, включая срезанные стены.
        if (!field.colors.length) return;

        if (!field.isUnclaimed(this.x, this.y)) {
            var safe = this._findNearestColorPoint(field);
            if (!safe) return;
            this.x = safe.x;
            this.y = safe.y;
        }

        var ox = this.x;
        var oy = this.y;
        var currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        var speed = Math.max(70, currentSpeed);
        var nx = this.x + this.vx * dt;
        var ny = this.y + this.vy * dt;

        if (!field.isUnclaimed(nx, ny)) {
            var direction = this._bestDirection(field, speed, dt);
            if (direction) {
                this.vx = direction.x * speed;
                this.vy = direction.y * speed;
                nx = this.x + this.vx * dt;
                ny = this.y + this.vy * dt;
            } else {
                nx = this.x;
                ny = this.y;
            }
        }

        if (field.isUnclaimed(nx, ny)) {
            this.x = nx;
            this.y = ny;
        }

        var moved = Math.sqrt(
            (this.x - ox) * (this.x - ox) +
            (this.y - oy) * (this.y - oy)
        );
        if (moved < 0.15) this.stuckFor += elapsed;
        else this.stuckFor = 0;

        if (this.stuckFor > 0.22) {
            var escape = this._bestDirection(field, speed, Math.max(dt, 0.05));
            if (escape) {
                this.vx = escape.x * speed;
                this.vy = escape.y * speed;
            } else {
                var point = this._findNearestColorPoint(field);
                if (point) {
                    this.x = point.x;
                    this.y = point.y;
                    this._setRandomDirection(speed);
                }
            }
            this.stuckFor = 0;
        }

        this._sync();
    }

    _updateRover(dt, field) {
        var box = field.innerRect();
        var pad = this.r + 2;
        var minX = box.x + pad;
        var maxX = box.x + box.w - pad;
        var minY = box.y + pad;
        var maxY = box.y + box.h - pad;
        var step = dt * (this.speedMultiplier || 1);
        var nx = this.x + this.vx * step;
        var ny = this.y + this.vy * step;

        if (nx <= minX || nx >= maxX) {
            this.vx *= -1;
            nx = Phaser.Math.Clamp(nx, minX, maxX);
        }
        if (ny <= minY || ny >= maxY) {
            this.vy *= -1;
            ny = Phaser.Math.Clamp(ny, minY, maxY);
        }
        this.x = nx;
        this.y = ny;
        this._sync();
    }

    _bestDirection(field, speed, dt) {
        var base = Math.atan2(this.vy, this.vx);
        var step = Math.max(2.5, Math.min(7, speed * dt));
        var best = null;
        var bestScore = -1;

        // Сначала близкие к отражению направления, затем полный круг.
        for (var i = 0; i < 24; i++) {
            var offset = i === 0 ? Math.PI :
                ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12);
            var angle = base + offset;
            var dx = Math.cos(angle);
            var dy = Math.sin(angle);
            var score = 0;

            // Выбираем луч, который дольше всего остаётся внутри цвета.
            for (var probe = 1; probe <= 7; probe++) {
                if (!field.isUnclaimed(
                    this.x + dx * step * probe,
                    this.y + dy * step * probe
                )) break;
                score++;
            }

            if (score > bestScore) {
                bestScore = score;
                best = { x: dx, y: dy };
            }
        }
        return bestScore > 0 ? best : null;
    }

    _findNearestColorPoint(field) {
        var best = null;
        var bestD2 = Infinity;
        var box = field.colorBounds();
        var step = Math.max(4, Math.min(10, Math.min(box.w, box.h) / 12));

        for (var y = box.y + step / 2; y <= box.y + box.h; y += step) {
            for (var x = box.x + step / 2; x <= box.x + box.w; x += step) {
                if (!field.isUnclaimed(x, y)) continue;
                var dx = x - this.x;
                var dy = y - this.y;
                var d2 = dx * dx + dy * dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    best = { x: x, y: y };
                }
            }
        }

        if (best) return best;
        var c = field.colorCentroid();
        return field.isUnclaimed(c.x, c.y) ? c : null;
    }

    _setRandomDirection(speed) {
        var angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    kill() {
        this.active = false;
        this.dot.setVisible(false);
        this.eye.setVisible(false);
        this.badge.setVisible(false);
        if (this.paper) this.paper.setVisible(false);
    }

    _buildPaperShape() {
        var visR = Math.max(10, this.r - 1);
        this._paperR = visR;
        var base = circlePts(visR, 14);
        var seed = (Math.round((this.x || 1) * 13 + (this.y || 1) * 7 + (this.r || 13) * 5) >>> 0);
        if (window.Paper && Paper.tearPoly) {
            this._paperBody = Paper.tearPoly(base, seed, 3);
            this._paperDeckle = Paper.tearPoly(expandPts(base, 3), seed + 3, 4);
        } else {
            this._paperBody = base;
            this._paperDeckle = expandPts(base, 3);
        }
    }

    _drawPaper() {
        if (!this.paper) return;
        if (!this._paperBody) this._buildPaperShape();
        var t = (this.scene.time && this.scene.time.now) ? this.scene.time.now / 1000 : 0;
        var glow = 0.5 + Math.sin(t * 1.15 + this._paperPhase) * 0.5;
        var key = this.type + ':' + ((glow * 20) | 0);
        if (key === this._paperKey) return;
        this._paperKey = key;
        var g = this.paper;
        g.clear();
        var color = this.tint || 0xde3449;
        g.fillStyle(0x061428, 0.28);
        fillPts(g, this._paperDeckle.map(function (p) {
            return { x: p.x + 3, y: p.y + 5 };
        }));
        g.fillStyle(0xf7f1e6, 1);
        fillPts(g, this._paperDeckle);
        g.fillStyle(color, 1);
        fillPts(g, this._paperBody);
        g.lineStyle(1.8 + glow * 1.8, 0xffffff, 0.28 + glow * 0.48);
        strokePts(g, this._paperDeckle);
        var visR = this._paperR || 11;
        var ex = visR * 0.22;
        var ey = -visR * 0.18;
        var er = Math.max(2.1, visR * 0.2);
        g.fillStyle(0xf7f1e6, 1);
        g.fillCircle(ex, ey, er + 1.1);
        g.fillStyle(0x1a1420, 1);
        g.fillCircle(ex + 0.4, ey - 0.2, er);
    }

    _sync() {
        this.dot.setPosition(this.x, this.y);
        this.eye.setPosition(this.x + 3, this.y - 2);
        this.badge.setPosition(this.x, this.y);
        if (this.paper) {
            this.paper.setPosition(this.x, this.y);
            if (PAPER_LOOK && this.active) this._drawPaper();
        }
    }

    destroy() {
        if (this.dot && this.dot.scene) this.dot.destroy();
        if (this.eye && this.eye.scene) this.eye.destroy();
        if (this.badge && this.badge.scene) this.badge.destroy();
        if (this.paper && this.paper.scene) this.paper.destroy();
        this.dot = null;
        this.eye = null;
        this.badge = null;
        this.paper = null;
    }
}
