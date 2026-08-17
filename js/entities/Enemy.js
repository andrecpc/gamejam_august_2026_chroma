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
            pingpong: 0xff3b5c,
            rover: 0xff9d3b,
            chase: 0xc85cff,
            turret: 0x4a5cff,
            thief: 0xff6bd6,
            laser: 0xff365f
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
        this.dot.setVisible(true);
        this.eye.setVisible(true);
        this.badge.setText(badges[this.type] || '');
        this.badge.setVisible(!!badges[this.type]);
        if (this.type === 'thief') {
            this.dot.setStrokeStyle(4, 0xffffff, 1);
            this.dot.setDepth(10);
            this.eye.setDepth(11);
            this.badge.setDepth(11);
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
    }

    _sync() {
        this.dot.setPosition(this.x, this.y);
        this.eye.setPosition(this.x + 3, this.y - 2);
        this.badge.setPosition(this.x, this.y);
    }

    destroy() {
        if (this.dot && this.dot.scene) this.dot.destroy();
        if (this.eye && this.eye.scene) this.eye.destroy();
        if (this.badge && this.badge.scene) this.badge.destroy();
        this.dot = null;
        this.eye = null;
        this.badge = null;
    }
}
