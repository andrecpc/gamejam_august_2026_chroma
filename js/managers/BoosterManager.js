import { Booster } from '../entities/Booster.js?v=1.3.0';
import { dist } from '../utils/Geometry.js';

var LABELS = {
    speed: 'Ускорение',
    slow: 'Замедление',
    shield: 'Щит',
    enemySlow: 'Холод'
};

export class BoosterManager {
    constructor(scene, level) {
        this.scene = scene;
        this.items = [];
        this.effects = [];
        this.spawnTimers = [];
        this.lastEffectSignature = '';

        var configs = level.boosters || [];
        for (var i = 0; i < configs.length; i++) {
            this._create(configs[i]);
        }

        this.antiCfg = level.antiBoosters || null;
        if (this.antiCfg && this.antiCfg.interval > 0) {
            var antiTimer = this.scene.time.addEvent({
                delay: this.antiCfg.interval,
                loop: true,
                callback: this._spawnAntiBooster,
                callbackScope: this
            });
            this.spawnTimers.push(antiTimer);
        }
    }

    _create(cfg) {
        var item = new Booster(this.scene, cfg);
        this.items.push(item);
        var delay = Math.max(0, cfg.spawnDelay || 0);
        if (delay > 0) {
            var spawnTimer = this.scene.time.delayedCall(delay, function () {
                item.show();
                this.scene.game.events.emit('game:booster-spawned', {
                    type: cfg.type,
                    x: cfg.x,
                    y: cfg.y
                });
            }, [], this);
            this.spawnTimers.push(spawnTimer);
        } else {
            item.show();
        }
    }

    spawnReward(type, x, y, overrides) {
        var cfg = Object.assign({
            type: type,
            x: x,
            y: y,
            duration: 6000
        }, overrides || {});
        this._create(cfg);
        return cfg;
    }

    _spawnAntiBooster() {
        if (!this.scene || this.scene.gameOver) return;
        var types = (this.antiCfg && this.antiCfg.types) || ['slow'];
        var type = types[Math.floor(Math.random() * types.length)];
        var bounds = this.scene.field
            ? this.scene.field.innerRect()
            : { x: 90, y: 180, w: 540, h: 540 };
        var x = bounds.x + 40 + Math.random() * Math.max(40, bounds.w - 80);
        var y = bounds.y + 40 + Math.random() * Math.max(40, bounds.h - 80);
        this._create({
            type: type,
            x: Math.round(x),
            y: Math.round(y),
            duration: type === 'slow' ? 4500 : 5000,
            multiplier: type === 'slow' ? 0.55 : 0.5
        });
    }

    update(player, enemies) {
        if (!player) return;
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (!item.active || item.collected) continue;
            if (dist(player.x, player.y, item.x, item.y) <=
                player.radius + item.radius + 3) {
                this._collect(item, player, enemies || []);
            }
        }
        this._updateEffects(player, enemies || []);
    }

    _collect(item, player, enemies) {
        item.collect();
        var cfg = item.cfg;
        var resolved = this._resolve(cfg);
        this._apply(resolved, player, enemies);

        if (window.AudioManager) {
            if (resolved.type === 'slow') AudioManager.playError();
            else AudioManager.playSuccess();
        }
        GameSettings.vibrate(16);

        this.scene.game.events.emit('game:booster-picked', {
            sourceType: cfg.type,
            type: resolved.type,
            label: this._pickupLabel(resolved)
        });
    }

    _resolve(cfg) {
        if (cfg.type !== 'mystery') return cfg;
        var outcomes = cfg.outcomes || [
            { type: 'speed', duration: 6000, multiplier: 1.45 },
            { type: 'shield', duration: 6000 },
            { type: 'life', amount: 1 },
            { type: 'slow', duration: 4500, multiplier: 0.62 }
        ];
        var picked = Phaser.Utils.Array.GetRandom(outcomes);
        return Object.assign({}, cfg, picked, {
            type: picked.type,
            sourceType: 'mystery'
        });
    }

    _apply(cfg, player, enemies) {
        var now = this.scene.time.now;
        var duration = Math.max(0, cfg.duration || 0);

        switch (cfg.type) {
        case 'speed':
            this._addEffect({
                type: 'speed',
                multiplier: cfg.multiplier || 1.45,
                expires: now + (duration || 6000)
            });
            break;
        case 'slow':
            this._addEffect({
                type: 'slow',
                multiplier: cfg.multiplier || 0.62,
                expires: now + (duration || 4500)
            });
            break;
        case 'shield':
            this.scene.shieldUntil = Math.max(
                this.scene.shieldUntil || 0,
                now + (duration || 6000)
            );
            this._addEffect({
                type: 'shield',
                expires: this.scene.shieldUntil
            });
            break;
        case 'enemySlow':
            this._addEffect({
                type: 'enemySlow',
                multiplier: cfg.multiplier || 0.48,
                expires: now + (duration || 6000)
            });
            break;
        case 'life':
            if (this.scene.addLife) this.scene.addLife(cfg.amount || 1);
            break;
        case 'removeEnemy':
            for (var i = 0; i < enemies.length; i++) {
                if (enemies[i].active) {
                    enemies[i].kill();
                    break;
                }
            }
            break;
        }

        this._updateEffects(player, enemies);
    }

    _addEffect(effect) {
        // Повторный эффект того же типа заменяет старый и продлевает таймер.
        for (var i = this.effects.length - 1; i >= 0; i--) {
            if (this.effects[i].type === effect.type) this.effects.splice(i, 1);
        }
        this.effects.push(effect);
    }

    _updateEffects(player, enemies) {
        var now = this.scene.time.now;
        this.effects = this.effects.filter(function (effect) {
            return effect.expires > now;
        });

        var playerMultiplier = 1;
        var enemyMultiplier = 1;
        for (var i = 0; i < this.effects.length; i++) {
            var effect = this.effects[i];
            if (effect.type === 'speed' || effect.type === 'slow') {
                playerMultiplier *= effect.multiplier;
            }
            if (effect.type === 'enemySlow') {
                enemyMultiplier *= effect.multiplier;
            }
        }

        player.speed = player.baseSpeed * playerMultiplier;
        for (i = 0; i < enemies.length; i++) {
            enemies[i].speedMultiplier = enemyMultiplier;
        }

        var visible = this.effects.map(function (effect) {
            return {
                type: effect.type,
                label: LABELS[effect.type] || effect.type,
                seconds: Math.max(1, Math.ceil((effect.expires - now) / 1000))
            };
        });
        var signature = JSON.stringify(visible);
        if (signature !== this.lastEffectSignature) {
            this.lastEffectSignature = signature;
            this.scene.game.events.emit('game:effects-changed', {
                effects: visible
            });
        }
    }

    _pickupLabel(cfg) {
        if (cfg.sourceType === 'mystery') {
            return '? → ' + (LABELS[cfg.type] || cfg.type);
        }
        if (cfg.type === 'life') return '+1 жизнь';
        if (cfg.type === 'removeEnemy') return 'Враг удалён';
        return LABELS[cfg.type] || cfg.type;
    }

    destroy() {
        for (var t = 0; t < this.spawnTimers.length; t++) {
            if (this.spawnTimers[t]) this.spawnTimers[t].remove(false);
        }
        this.spawnTimers = [];
        for (var i = 0; i < this.items.length; i++) this.items[i].destroy();
        this.items = [];
        this.effects = [];
    }
}
