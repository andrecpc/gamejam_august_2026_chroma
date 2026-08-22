import { Enemy } from '../entities/Enemy.js?v=1.7.25';
import { EnemyProjectile } from '../entities/EnemyProjectile.js';
import { dist, pointToSegmentDist, polylineLength } from '../utils/Geometry.js';

export class EnemyManager {
    constructor(scene, level, field) {
        this.scene = scene;
        this.field = field;
        this.enemies = [];
        this.laserHitsPlayer = false;
        this.laserGfx = scene.add.graphics();
        this.laserGfx.setDepth(7);
        this.projectiles = scene.add.group({
            classType: EnemyProjectile,
            maxSize: 32,
            runChildUpdate: true
        });

        var configs = level.enemies || [];
        for (var i = 0; i < configs.length; i++) {
            var enemy = new Enemy(scene);
            enemy.spawn(configs[i]);
            this._nudgeFromPlayer(enemy);
            this.enemies.push(enemy);
            if (enemy.type === 'thief') {
                this._resetThiefTrail(enemy);
            }
        }
    }

    onPlayStart() {
        var now = this.scene.time.now;
        for (var i = 0; i < this.enemies.length; i++) {
            var enemy = this.enemies[i];
            if (!enemy.active || enemy.type !== 'turret') continue;
            var delay = enemy.cfg && enemy.cfg.initialDelay != null
                ? enemy.cfg.initialDelay
                : 900;
            enemy.nextActionAt = now + delay;
        }
    }

    _nudgeFromPlayer(enemy) {
        if (!enemy || enemy.type === 'turret' || enemy.type === 'laser') return;
        var b = this.field && this.field.bounds;
        if (!b) return;
        var frame = b.frame || 28;
        var sx = b.x + b.w / 2;
        var sy = b.y + b.h - frame / 2;
        var dx = enemy.x - sx;
        var dy = enemy.y - sy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 140) return;
        var cx = b.x + b.w / 2;
        var cy = b.y + b.h / 2;
        var nx = cx - enemy.x;
        var ny = cy - enemy.y;
        var nl = Math.sqrt(nx * nx + ny * ny) || 1;
        var push = 160 - d;
        enemy.x += nx / nl * push;
        enemy.y += ny / nl * push;
        var pad = frame + (enemy.r || 13);
        enemy.x = Math.max(b.x + pad, Math.min(b.x + b.w - pad, enemy.x));
        enemy.y = Math.max(b.y + pad, Math.min(b.y + b.h - pad, enemy.y));
        if (enemy._sync) enemy._sync();
    }

    update(dt, field, player) {
        this.laserHitsPlayer = false;
        this.laserGfx.clear();
        var now = this.scene.time.now;
        var thiefCuts = [];
        var noticed = false;

        for (var i = 0; i < this.enemies.length; i++) {
            var enemy = this.enemies[i];
            if (!enemy.active) continue;
            enemy.update(dt, field, player);

            if (enemy.type === 'turret') {
                this._updateTurret(enemy, player, now);
            } else if (enemy.type === 'laser') {
                this._updateLaser(enemy, player, now);
            } else if (enemy.type === 'thief') {
                var cut = this._collectThiefCut(enemy, field, now);
                if (cut) {
                    thiefCuts.push(cut.segment);
                    if (cut.notice) noticed = true;
                }
            }
        }

        if (thiefCuts.length && field) {
            field.stealColorTrails(thiefCuts);
        }
        if (field && field.flushDeferred) field.flushDeferred();

        if (noticed) {
            this.scene.game.events.emit('game:enemy-action', {
                type: 'thief',
                label: 'Подрезчик оставляет след!'
            });
        }
    }

    _updateTurret(enemy, player, now) {
        if (!player || now < enemy.nextActionAt) return;
        var cfg = enemy.cfg;
        enemy.nextActionAt = now + (cfg.shotInterval || 2200);
        var dx = player.x - enemy.x;
        var dy = player.y - enemy.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var speed = cfg.bulletSpeed || 145;
        var bullet = this.projectiles.get();
        if (bullet) {
            bullet.fire(
                enemy.x,
                enemy.y,
                dx / len * speed,
                dy / len * speed,
                cfg.bulletLife || 4500
            );
        }
    }

    _updateLaser(enemy, player, now) {
        var cfg = enemy.cfg;
        var interval = cfg.interval || 3800;
        var warning = cfg.warning || 1200;
        var activeTime = cfg.activeTime || 650;
        var phase = cfg.phase || 0;
        var t0 = this.scene.playStartedAt || this.scene._spawnTime || 0;
        var cycle = ((now - t0) + phase) % interval;
        var isWarning = cycle < warning;
        var isActive = cycle >= warning && cycle < warning + activeTime;
        if (!isWarning && !isActive) return;

        var angle = Phaser.Math.DegToRad(cfg.angle || 0);
        var length = cfg.length || 230;
        var ex = enemy.x + Math.cos(angle) * length;
        var ey = enemy.y + Math.sin(angle) * length;
        var color = isActive ? 0xff274f : 0xffd24a;
        var alpha = isActive ? 0.95 : 0.35;
        var width = isActive ? 8 : 3;

        this.laserGfx.lineStyle(width, color, alpha);
        this.laserGfx.beginPath();
        this.laserGfx.moveTo(enemy.x, enemy.y);
        this.laserGfx.lineTo(ex, ey);
        this.laserGfx.strokePath();

        if (isActive && player &&
            pointToSegmentDist(
                player.x, player.y,
                enemy.x, enemy.y, ex, ey
            ) <= player.hitRadius() + width / 2) {
            this.laserHitsPlayer = true;
        }
    }

    _collectThiefCut(enemy, field, now) {
        var cfg = enemy.cfg;
        var flushLen = cfg.drainStep || 72;
        var here = { x: enemy.x, y: enemy.y };

        if (!enemy.drainStarted || !enemy.drainPath || !enemy.drainPath.length) {
            this._resetThiefTrail(enemy);
            return null;
        }

        var last = enemy.drainPath[enemy.drainPath.length - 1];
        var travelled = dist(last.x, last.y, here.x, here.y);
        if (travelled > 90) {
            this._resetThiefTrail(enemy);
            return null;
        }
        if (travelled >= 8) {
            enemy.drainPath.push(here);
            enemy.lastDrainX = here.x;
            enemy.lastDrainY = here.y;
        }

        if (polylineLength(enemy.drainPath) < flushLen) return null;

        var onColor = false;
        for (var i = 0; i < enemy.drainPath.length; i++) {
            if (field.colorAt(enemy.drainPath[i].x, enemy.drainPath[i].y)) {
                onColor = true;
                break;
            }
        }
        var path = enemy.drainPath.slice();
        this._resetThiefTrail(enemy);
        if (!onColor || path.length < 2) return null;

        var notice = false;
        if (now >= enemy.nextActionAt) {
            enemy.nextActionAt = now + (cfg.noticeInterval || 4300);
            notice = true;
            this.scene.tweens.add({
                targets: enemy.paper && enemy.paper.visible
                    ? [enemy.paper]
                    : [enemy.dot, enemy.badge],
                scale: 1.35,
                duration: 120,
                yoyo: true
            });
        }
        return {
            segment: { points: path, width: enemy.r * 1.6 },
            notice: notice
        };
    }

    _resetThiefTrail(enemy) {
        enemy.drainStarted = true;
        enemy.lastDrainX = enemy.x;
        enemy.lastDrainY = enemy.y;
        enemy.drainPath = [{ x: enemy.x, y: enemy.y }];
    }

    hitsPlayer(player, consume) {
        if (!player) return false;
        if (this.laserHitsPlayer) return true;

        var children = this.projectiles.getChildren();
        for (var i = 0; i < children.length; i++) {
            var bullet = children[i];
            if (!bullet.active) continue;
            if (dist(player.x, player.y, bullet.x, bullet.y) <=
                player.hitRadius() + bullet.radius) {
                if (consume !== false) bullet.disable();
                return true;
            }
        }
        return false;
    }

    spawnChase(x, y, speed) {
        var enemy = new Enemy(this.scene);
        enemy.spawn({
            type: 'chase',
            x: x,
            y: y,
            speed: speed || 72
        });
        this.enemies.push(enemy);
        this.scene.enemies = this.enemies;
        return enemy;
    }

    destroy() {
        if (!this.enemies) return;
        for (var i = 0; i < this.enemies.length; i++) {
            this.enemies[i].destroy();
        }
        this.enemies = [];

        // Phaser может уничтожить Group раньше shutdown-обработчика сцены.
        // В таком случае projectiles.children уже undefined, и повторный
        // clear() падает внутри Phaser при чтении children.size.
        if (this.projectiles && this.projectiles.children) {
            this.projectiles.clear(true, true);
        }
        this.projectiles = null;

        if (this.laserGfx && this.laserGfx.scene) {
            this.laserGfx.destroy();
        }
        this.laserGfx = null;
    }
}
