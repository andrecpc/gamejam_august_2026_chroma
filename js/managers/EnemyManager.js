import { Enemy } from '../entities/Enemy.js?v=1.5.3';
import { EnemyProjectile } from '../entities/EnemyProjectile.js';
import { dist, pointToSegmentDist, polylineLength } from '../utils/Geometry.js';

export class EnemyManager {
    constructor(scene, level, field) {
        this.scene = scene;
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
            this.enemies.push(enemy);
            if (enemy.type === 'thief') {
                this._resetThiefTrail(enemy);
            }
        }
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
        var cycle = (now + phase) % interval;
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
            ) <= player.radius + width / 2) {
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
                targets: [enemy.dot, enemy.badge],
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

    hitsPlayer(player) {
        if (!player) return false;
        if (this.laserHitsPlayer) return true;

        var children = this.projectiles.getChildren();
        for (var i = 0; i < children.length; i++) {
            var bullet = children[i];
            if (!bullet.active) continue;
            if (dist(player.x, player.y, bullet.x, bullet.y) <=
                player.radius + bullet.radius) {
                bullet.disable();
                return true;
            }
        }
        return false;
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
