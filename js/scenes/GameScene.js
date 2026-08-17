import { Player } from '../entities/Player.js?v=1.7.5';
import { FieldManager } from '../managers/FieldManager.js?v=1.7.1';
import { VialManager } from '../managers/VialManager.js?v=1.5.5';
import { LevelManager } from '../managers/LevelManager.js?v=1.4.0';
import { MagneticManager } from '../managers/MagneticManager.js';
import { BoosterManager } from '../managers/BoosterManager.js?v=1.5.1';
import { EnemyManager } from '../managers/EnemyManager.js?v=1.7.5';
import { ObjectiveManager } from '../managers/ObjectiveManager.js?v=1.7.5';
import { BossManager } from '../managers/BossManager.js?v=1.7.5';
import { RewardedAdManager } from '../managers/RewardedAdManager.js?v=1.6.8';
import { dist, hexToInt, pointHitsPolyline, polyCentroid } from '../utils/Geometry.js';

var COLOR_NAMES = {
    red: 'красный',
    blue: 'синий',
    yellow: 'жёлтый',
    green: 'зелёный',
    purple: 'фиолетовый',
    orange: 'оранжевый',
    cyan: 'голубой',
    pink: 'розовый'
};

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
    }

    init(data) {
        this.packId = (data && data.pack) || 'training';
        this.levelId = (data && data.level) || 1;
        this.gameOver = false;
        this.won = false;
        this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
        this.dir = { x: 0, y: 0 };
        this.invulnUntil = 0;
        this.shieldUntil = 0;
        this.shieldNoticeUntil = 0;
        this._firedTutorials = {};
        this._tutorialMoveSent = false;
        this._wasDrawing = false;
        this._pendingWin = false;
        this.loseKind = null;
    }

    create() {
        var self = this;
        Background.create(this);

        this.level = LevelManager.get(this, this.levelId, this.packId);
        if (!this.level) {
            this.scene.start('LevelSelect', { pack: this.packId });
            return;
        }
        this.lives = this.level.lives;
        this.field = new FieldManager(this, this.level);
        this.vials = new VialManager(this.level, this.field.vialCapacity);
        this.magnets = new MagneticManager(this, this.level);
        this.objectives = new ObjectiveManager(
            this, this.level, this.field, this.vials
        );

        var b = this.field.bounds;
        var startX = b.x + b.w / 2;
        var startY = b.y + b.h - (b.frame || 28) / 2;
        this.player = new Player(this, startX, startY, this.level);

        this.enemyManager = new EnemyManager(this, this.level, this.field);
        this.enemies = this.enemyManager.enemies;
        this.bossManager = new BossManager(this, this.level);
        this.boosters = new BoosterManager(this, this.level);
        this.rewards = new RewardedAdManager(this);

        this.confetti = this.add.group({ maxSize: 180, runChildUpdate: true });
        this._bindInput();

        this.scene.launch('UI', { pack: this.packId, level: this.levelId });
        this.floatLayer = this.add.container(0, 0);
        this.floatLayer.setDepth(25);
        this.game.events.on('game:baskets-idle', this._onBasketsIdle, this);
        this.time.delayedCall(0, function () {
            self.game.events.emit('game:ready', {
                lives: self.lives,
                level: self.levelId,
                palette: self.level.palette,
                vials: self.vials.snapshot()
            });
            if (self.bossManager) self.bossManager.emitStatus();
            if (self.bossManager && self.bossManager.lockPuzzle) {
                self.time.delayedCall(500, function () {
                    self.game.events.emit('game:enemy-action', {
                        type: 'fieldBoss',
                        label: 'Сначала печати в кольцах — ядро под щитом'
                    });
                });
            } else if (self.bossManager && self.bossManager.type === 'colorBoss') {
                self.time.delayedCall(500, function () {
                    self.game.events.emit('game:enemy-action', {
                        type: 'colorBoss',
                        label: 'Отрезай цвет — падает полоска того же цвета'
                    });
                });
            }
        });
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);
    }

    _onShutdown() {
        this.game.events.off('game:baskets-idle', this._onBasketsIdle, this);
        if (this.scene.isActive('UI') || this.scene.isSleeping('UI')) {
            this.scene.stop('UI');
        }
        if (this.field) { this.field.destroy(); this.field = null; }
        if (this.magnets) { this.magnets.destroy(); this.magnets = null; }
        if (this.boosters) { this.boosters.destroy(); this.boosters = null; }
        if (this.enemyManager) {
            this.enemyManager.destroy();
            this.enemyManager = null;
        }
        if (this.bossManager) {
            this.bossManager.destroy();
            this.bossManager = null;
        }
        if (this.player) { this.player.destroy(); this.player = null; }
        this.rewards = null;
        this.objectives = null;
        if (this.confetti && this.confetti.children) {
            this.confetti.clear(true, true);
        }
        this.confetti = null;
        if (this.input) this.input.removeAllListeners();
        if (this.tweens) this.tweens.killAll();
        if (this.time) this.time.removeAllEvents();
        this.enemies = [];
    }

    _bindInput() {
        var self = this;
        this.input.on('pointerdown', function (p) {
            if (self.gameOver) return;
            var W = self.scale.width;
            var H = self.scale.height;
            if (p.x > W - 120 && p.y < 120) return;
            if (p.x > W - 185 && p.y > H - 120) return;
            self.stick.active = true;
            self.stick.ox = p.x;
            self.stick.oy = p.y;
        });
        this.input.on('pointermove', function (p) {
            if (!self.stick.active) return;
            var dx = p.x - self.stick.ox;
            var dy = p.y - self.stick.oy;
            var max = 70;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 8) {
                self.dir.x = 0;
                self.dir.y = 0;
                return;
            }
            var k = len > max ? max / len : 1;
            self.dir.x = (dx * k) / max;
            self.dir.y = (dy * k) / max;
        });
        this.input.on('pointerup', function () {
            self.stick.active = false;
            self.dir.x = 0;
            self.dir.y = 0;
            if (self._stickGfx() ) self._stickGfx().clear();
        });
        this.input.on('pointerupoutside', function () {
            self.stick.active = false;
            self.dir.x = 0;
            self.dir.y = 0;
            if (self._stickGfx()) self._stickGfx().clear();
        });
    }

    update(t, dt) {
        if (this.gameOver) return;
        var dts = Math.min(dt, 50) / 1000;
        var timedResult = this.objectives ? this.objectives.update() : null;
        if (this._handleObjectiveResult(timedResult)) return;

        if (this.enemyManager) {
            this.enemyManager.update(dts, this.field, this.player);
        }
        if (this.bossManager) {
            this.bossManager.update(dts, this.player);
            if (this._tryBossWin()) return;
        }

        var ev = this.player.update(dts, this.dir, this.field, this.magnets);
        if (ev && ev.hitSelf) {
            this._hurt('хвост');
            return;
        }
        if (ev && ev.magnetAttached) this._fireTutorials('magnet');
        if (this.player.drawing) this._fireTutorials('drawing');
        this._updateTutorialDismiss();
        if (ev && ev.close) {
            try {
                this._onClose(ev.close);
            } catch (err) {
                console.error(err);
                this._floatText(this.player.x, this.player.y - 28, 'Срез не удался');
            }
            if (this._tryBossWin()) return;
        }

        if (this.boosters) this.boosters.update(this.player, this.enemies);
        if (this.player) {
            this.player.setShieldActive(this.time.now < this.shieldUntil);
        }
        this._collideEnemies();
        if (this.enemyManager && this.enemyManager.hitsPlayer(this.player)) {
            this._hurt('снаряд');
        }
        if (this.bossManager && this.bossManager.hitsPlayer(this.player)) {
            this._hurt('залп босса');
        }
        if (this.player.flameReachedHero()) this._hurt('огонь');

        this._drawStick();
    }

    _stickGfx() {
        var ui = this.scene.get('UI');
        var g = ui && ui.stickGfx;
        return (g && g.scene) ? g : null;
    }

    _drawStick() {
        var g = this._stickGfx();
        if (!g) return;
        g.clear();
        if (!this.stick.active) return;
        var x = this.stick.ox;
        var y = this.stick.oy;
        g.fillStyle(0x061428, 0.38);
        g.fillCircle(x + 5, y + 7, 58);
        g.fillStyle(0xf3ead8, 0.22);
        g.fillCircle(x, y, 56);
        g.lineStyle(5, 0x111111, 0.85);
        g.strokeCircle(x, y, 54);
        g.lineStyle(3, 0xf7f1e6, 0.95);
        g.strokeCircle(x, y, 50);
        var kx = x + this.dir.x * 48;
        var ky = y + this.dir.y * 48;
        g.fillStyle(0x061428, 0.4);
        g.fillCircle(kx + 3, ky + 4, 24);
        g.fillStyle(0xf3ead8, 1);
        g.fillCircle(kx, ky, 22);
        g.lineStyle(4, 0x111111, 1);
        g.strokeCircle(kx, ky, 22);
    }

    _collideEnemies() {
        var p = this.player;
        if (!p) return;
        var hitR = p.hitRadius ? p.hitRadius() : (p.radius + 6);
        for (var i = 0; i < this.enemies.length; i++) {
            var e = this.enemies[i];
            if (!e.active) continue;
            if (dist(p.x, p.y, e.x, e.y) <= hitR + e.r) {
                this._hurt('враг');
                return;
            }
            if (p.drawing) {
                var hit = pointHitsPolyline(e.x, e.y, p.trail, e.r + 4);
                if (hit >= 0) {
                    this._hurt('враг');
                    return;
                }
            }
        }
    }

    _onClose(trail) {
        var cut = this.field.closeTrail(trail, this.enemies);
        if (!cut.ok) {
            this._failCut(cut.reason);
            return;
        }

        var acceptedByColor = {};
        var anyAccept = false;
        var anyReject = false;
        var reserveColor = null;
        var self = this;
        var objectiveResult = null;
        var coreBlocked = false;
        cut.pieces.sort(function (a, b) { return b.area - a.area; });
        var main = cut.pieces[0];

        cut.pieces.forEach(function (piece) {
            if (self.bossManager && self.bossManager.protectsColor(piece.color)) {
                anyReject = true;
                coreBlocked = true;
                self.field.bouncePolys(piece.polys);
                return;
            }
            var mode = self.vials.canClaim(piece.color);
            if (mode === 'blocked') {
                if (piece === main || piece.area > (main.area * 0.45)) {
                    anyReject = true;
                    self.field.bouncePolys(piece.polys);
                }
                return;
            }
            if (mode === 'vanish') {
                acceptedByColor[piece.color] = 1;
                anyAccept = true;
                return;
            }
            if (self.vials.wouldExhaustColor(
                piece.color,
                piece.area,
                self.field.colorArea(piece.color)
            )) {
                anyReject = true;
                reserveColor = piece.color;
                self.field.bouncePolys(piece.polys);
                return;
            }
            var result = self.vials.pour(piece.color, piece.area);
            if (result.acceptedArea <= 0) {
                if (piece === main) {
                    anyReject = true;
                    self.field.bouncePolys(piece.polys);
                }
                return;
            }
            anyAccept = true;
            acceptedByColor[piece.color] = Math.min(1, result.acceptedArea / piece.area);
            result.events.forEach(function (ev) {
                if (ev.type === 'fill') {
                    var popped = result.events.some(function (p) {
                        return p.type === 'pop' && p.vial.id === ev.vial.id;
                    });
                    self.game.events.emit('game:basket-lock', { vialId: ev.vial.id });
                    self._flyDrops(piece, ev.amount, ev.vial.id, {
                        fill: ev.vial.fill,
                        popped: popped,
                        color: piece.color
                    });
                }
                if (ev.type === 'pop' && self.bossManager) {
                    self.bossManager.onVialCompleted(ev.vial.color);
                }
            });
        });

        if (anyReject && !anyAccept) {
            if (window.AudioManager && AudioManager.playError) AudioManager.playError();
            if (coreBlocked) {
                this._floatText(
                    this.player.x,
                    this.player.y - 28,
                    'Ядро под щитом — сначала печати'
                );
            } else if (reserveColor) {
                var count = this.vials.remainingOf(reserveColor).length;
                this._floatText(
                    this.player.x,
                    this.player.y - 28,
                    'Оставь ' + (COLOR_NAMES[reserveColor] || reserveColor) +
                    ': ещё ×' + count
                );
            } else {
                this._floatText(this.player.x, this.player.y - 28, 'Нет свободной корзины!');
            }
            return;
        }

        if (anyAccept) {
            if (coreBlocked) {
                this._floatText(
                    this.player.x,
                    this.player.y - 28,
                    'Ядро под щитом — сначала печати'
                );
            }
            var applied = this.field.applyClaim(cut.captured, cut.buffer, acceptedByColor, this.enemies);
            if (applied.rolledBack) {
                this._failCut('no-split');
                return;
            }
            if (this.bossManager) {
                this.bossManager.onPlayerClaim(applied.claimed);
                var colorAreas = {};
                cut.pieces.forEach(function (piece) {
                    var ratio = acceptedByColor[piece.color];
                    if (!ratio) return;
                    colorAreas[piece.color] =
                        (colorAreas[piece.color] || 0) + piece.area * ratio;
                });
                this.bossManager.onColorCuts(colorAreas);
            }
            var dead = [];
            function kill(e) {
                if (!e || dead.indexOf(e) !== -1) return;
                dead.push(e);
                self._impactBurst(e.x, e.y, 0xffd24a, 8);
                e.kill();
            }
            (applied.killed || []).forEach(kill);
            (cut.trapped || []).forEach(kill);
            if (window.AudioManager && AudioManager.playCut) AudioManager.playCut();
            GameSettings.vibrate(12);
            this._cutImpact();
            this._fireTutorials('cut');
            if (this.objectives) {
                objectiveResult = this.objectives.onSuccessfulCut(dead.length);
            }
            if (dead.length) {
                this._floatText(this.player.x, this.player.y - 48, 'ПОЙМАН!');
            }
        }
        if (reserveColor && anyAccept) {
            this._floatText(
                this.player.x,
                this.player.y - 28,
                'Этот цвет нужен будущим корзинам'
            );
        }

        this.game.events.emit('game:vials-changed', this.vials.snapshot());
        this._handleObjectiveResult(objectiveResult);
    }

    _failCut(reason) {
        if (reason === 'no-split') {
            this._floatText(this.player.x, this.player.y - 28, 'Контур не замкнулся');
            if (window.AudioManager && AudioManager.playError) AudioManager.playError();
            return;
        }
        if (reason === 'too-small') {
            this._floatText(this.player.x, this.player.y - 28, 'Слишком маленький срез');
            if (window.AudioManager && AudioManager.playError) AudioManager.playError();
            return;
        }
        this._floatText(this.player.x, this.player.y - 28, 'Нет свободной корзины!');
        if (window.AudioManager && AudioManager.playError) AudioManager.playError();
    }

    _flyDrops(piece, area, vialId, payload) {
        payload = payload || {};
        var self = this;
        var from = payload.from
            || (piece && piece.polys && piece.polys[0] && polyCentroid(piece.polys[0]))
            || { x: this.scale.width / 2, y: this.scale.height * 0.45 };
        var color = hexToInt(
            (this.level.palette && this.level.palette[payload.color]) || 0x4a8adf
        );
        var r = Math.min(22, 8 + Math.sqrt(area || 400) * 0.08);
        var target = { x: this.scale.width / 2, y: this.scale.height - 248 };
        var ui = this.scene.get('UI');
        if (ui && ui.getVialTarget) {
            target = ui.getVialTarget(vialId) || target;
        }
        var arrive = function () {
            self.game.events.emit('game:basket-arrive', {
                vialId: vialId,
                color: payload.color,
                fill: payload.fill,
                popped: payload.popped,
                x: target.x,
                y: target.y
            });
        };
        if (GameSettings.reducedMotion()) {
            arrive();
            return;
        }
        var drop = this.add.graphics().setDepth(18);
        drop.x = from.x;
        drop.y = from.y;
        if (window.Paper && Paper.drawCrumple) {
            Paper.drawCrumple(drop, 0, 0, r, color, Math.round(from.x * 13 + from.y * 7) >>> 0);
        } else {
            drop.fillStyle(color, 0.9);
            drop.fillCircle(0, 0, r);
        }
        var fly = function () {
            self.tweens.add({
                targets: drop,
                x: target.x + Phaser.Math.Between(-10, 10),
                y: target.y,
                scale: 0.45,
                duration: 420,
                ease: 'Cubic.easeIn',
                onComplete: function () {
                    drop.destroy();
                    arrive();
                }
            });
        };
        this.tweens.add({
            targets: drop,
            scaleX: 1.28,
            scaleY: 0.62,
            duration: 90,
            yoyo: true,
            ease: 'Quad.easeIn',
            onComplete: fly
        });
    }

    _confetti(x, y, count) {
        var host = this;
        var ui = this.scene.get('UI');
        if (ui && ui.add) host = ui;
        var total = count || 14;
        var colors = [0xde3449, 0x1f7fd7, 0xf0c107, 0x47a798, 0xd28e43, 0xf3ead8, 0x8960a0];
        for (var i = 0; i < total; i++) {
            var bit = host.add.rectangle(x, y, Phaser.Math.Between(7, 12), Phaser.Math.Between(12, 20), Phaser.Utils.Array.GetRandom(colors)).setDepth(205);
            this.tweens.add({
                targets: bit,
                x: x + Phaser.Math.Between(-140, 140),
                y: y + Phaser.Math.Between(50, 220),
                angle: Phaser.Math.Between(0, 360),
                alpha: 0,
                duration: Phaser.Math.Between(700, 1100),
                onComplete: function (tw, tgt) { tgt[0].destroy(); }
            });
        }
    }

    _cutImpact() {
        if (!this.player) return;
        var color = this.player.skin
            ? this.player.skin.trailColor
            : 0x72f5ff;
        this._impactBurst(this.player.x, this.player.y, color, 12);
    }

    _impactBurst(x, y, color, count) {
        var total = GameSettings.reducedMotion()
            ? Math.min(4, count || 10)
            : (count || 10);
        var ring = this.add.circle(x, y, 12, color, 0)
            .setStrokeStyle(4, color, 0.9)
            .setDepth(19);
        this.confetti.add(ring);
        this.tweens.add({
            targets: ring,
            scale: 3.8,
            alpha: 0,
            duration: 280,
            ease: 'Cubic.easeOut',
            onComplete: function () { ring.destroy(); }
        });

        for (var i = 0; i < total; i++) {
            var angle = Math.PI * 2 * i / total + Phaser.Math.FloatBetween(-0.18, 0.18);
            var distance = Phaser.Math.Between(34, 76);
            var spark = this.add.circle(
                x,
                y,
                Phaser.Math.Between(2, 5),
                color,
                0.95
            ).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
            this.confetti.add(spark);
            this.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                scale: 0.15,
                alpha: 0,
                duration: Phaser.Math.Between(230, 360),
                ease: 'Quad.easeOut',
                onComplete: function (tw, targets) { targets[0].destroy(); }
            });
        }
    }

    _updateTutorialDismiss() {
        if (this.packId !== 'training') return;
        if (!this._tutorialMoveSent && (this.dir.x || this.dir.y)) {
            this._tutorialMoveSent = true;
            this.game.events.emit('game:tutorial-dismiss', { reason: 'move' });
        }
        var drawing = !!(this.player && this.player.drawing);
        if (drawing && !this._wasDrawing) {
            this.game.events.emit('game:tutorial-dismiss', { reason: 'draw' });
        }
        this._wasDrawing = drawing;
    }

    _fireTutorials(trigger) {
        if (this.packId !== 'training' || !this.level || !this.level.tutorials) {
            return;
        }
        var items = this.level.tutorials;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.trigger !== trigger) continue;
            if (this._firedTutorials[item.id]) continue;
            this._firedTutorials[item.id] = true;
            this.game.events.emit('game:tutorial', item);
        }
    }

    _floatText(x, y, msg) {
        var ui = this.scene.get('UI');
        var host = (ui && ui.add && ui.scene) ? ui : this;
        var W = this.scale.width;
        var H = this.scale.height;
        var t = host.add.text(0, 0, msg, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffd24a',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(95);
        var pad = 28;
        var hw = Math.max(36, t.width / 2);
        var hh = Math.max(14, t.height / 2);
        var tx = Phaser.Math.Clamp(x, pad + hw, W - pad - hw);
        var ty = Phaser.Math.Clamp(y, pad + hh, H - pad - hh);
        var endY = Phaser.Math.Clamp(ty - 36, pad + hh, H - pad - hh);
        t.setPosition(tx, ty);
        host.tweens.add({
            targets: t,
            y: endY,
            duration: 280,
            ease: 'Quad.easeOut',
            onComplete: function () {
                if (!t.scene) return;
                t.scene.tweens.add({
                    targets: t,
                    alpha: 0,
                    duration: 420,
                    delay: 1600,
                    onComplete: function () { t.destroy(); }
                });
            }
        });
    }

    _hurt() {
        if (this.gameOver) return;
        if (this._tryBossWin()) {
            return;
        }
        if (this.time.now < this.shieldUntil) {
            if (this.time.now >= this.shieldNoticeUntil) {
                this.shieldNoticeUntil = this.time.now + 500;
                this._floatText(this.player.x, this.player.y - 28, 'ЩИТ!');
                if (window.AudioManager && AudioManager.playZap) AudioManager.playZap();
            }
            return;
        }
        if (this.time.now < this.invulnUntil) return;
        this.invulnUntil = this.time.now + 1100;
        this.lives -= 1;
        if (window.AudioManager && AudioManager.playHit) AudioManager.playHit();
        GameSettings.vibrate([35, 25, 45]);
        this._impactBurst(this.player.x, this.player.y, 0xff4f72, 16);
        if (!GameSettings.reducedMotion()) {
            this.cameras.main.flash(130, 255, 35, 75, true);
            this.cameras.main.shake(190, 0.011);
        }
        this.game.events.emit('game:lives-changed', { lives: this.lives });
        this._respawnOnFrame();
        this._blinkInvuln();
        if (this.lives <= 0) this._lose();
    }

    addLife(amount) {
        var maxLives = this.level.maxLives || 5;
        this.lives = Math.min(maxLives, this.lives + (amount || 1));
        this.game.events.emit('game:lives-changed', { lives: this.lives });
        this._floatText(this.player.x, this.player.y - 28, '+1 ЖИЗНЬ');
    }

    getRewardOptions() {
        if (!this.rewards) return [];
        return this.rewards.getOptions({
            canAddLife: this.lives < (this.level.maxLives || 5),
            hasEnemies: this.enemies.some(function (enemy) {
                return enemy.active;
            }),
            hasVials: this.vials.displayed().length > 0
        });
    }

    claimReward(offerId) {
        if (!this.rewards) return Promise.resolve(null);
        return this.rewards.claim(offerId).then(function (option) {
            if (!option || !this.sys) return null;
            this._applyReward(option);
            return option;
        }.bind(this));
    }

    _applyReward(option) {
        var spawn;
        if (option.type === 'life') {
            this.addLife(1);
        } else if (option.type === 'removeEnemy') {
            for (var i = 0; i < this.enemies.length; i++) {
                if (this.enemies[i].active) {
                    this.enemies[i].kill();
                    this._floatText(
                        this.enemies[i].x,
                        this.enemies[i].y,
                        'ВРАГ УДАЛЁН'
                    );
                    break;
                }
            }
        } else if (option.type === 'randomBooster') {
            spawn = this._rewardSpawnPoint();
            var outcomes = [
                { type: 'speed', duration: 6000, multiplier: 1.45 },
                { type: 'shield', duration: 6000 },
                { type: 'life', amount: 1 }
            ];
            if (this.enemies.some(function (enemy) { return enemy.active; })) {
                outcomes.push(
                    { type: 'enemySlow', duration: 6000, multiplier: 0.5 },
                    { type: 'removeEnemy' }
                );
            }
            this.boosters.spawnReward('mystery', spawn.x, spawn.y, {
                outcomes: outcomes
            });
        } else if (option.type === 'specificBooster') {
            spawn = this._rewardSpawnPoint();
            var overrides = {};
            if (option.booster === 'speed') overrides.multiplier = 1.45;
            if (option.booster === 'enemySlow') overrides.multiplier = 0.5;
            this.boosters.spawnReward(
                option.booster,
                spawn.x,
                spawn.y,
                overrides
            );
        } else if (option.type === 'fillVial') {
            this._rewardFillVial();
        }
        this.game.events.emit('game:reward-granted', {
            label: option.label
        });
    }

    _rewardSpawnPoint() {
        var box = this.field.innerRect();
        for (var i = 0; i < 30; i++) {
            var x = Phaser.Math.Between(
                Math.ceil(box.x + 35),
                Math.floor(box.x + box.w - 35)
            );
            var y = Phaser.Math.Between(
                Math.ceil(box.y + 35),
                Math.floor(box.y + box.h - 35)
            );
            if (this.field.colorAt(x, y) &&
                dist(x, y, this.player.x, this.player.y) > 75) {
                return { x: x, y: y };
            }
        }
        return this.field.colorCentroid();
    }

    _rewardFillVial() {
        var result = this.vials.completeRandomDisplayed();
        if (!result) return;
        var vial = result.vial;
        var self = this;
        if (this.bossManager) {
            result.events.forEach(function (event) {
                if (event.type === 'pop') self.bossManager.onVialCompleted(event.vial.color);
            });
        }
        this.game.events.emit('game:basket-lock', { vialId: vial.id });
        var ui = this.scene.get('UI');
        var target = (ui && ui.getVialTarget && ui.getVialTarget(vial.id)) || {
            x: this.scale.width / 2,
            y: this.scale.height - 248
        };
        this._flyDrops(null, this.field.vialCapacity, vial.id, {
            fill: 1,
            popped: true,
            color: vial.color,
            from: { x: target.x, y: target.y - 90 }
        });
        this.game.events.emit('game:vials-changed', this.vials.snapshot());
        if (this.objectives) {
            this._handleObjectiveResult(this.objectives.evaluateNow());
        }
    }

    _respawnOnFrame() {
        var b = this.field.bounds;
        var f = b.frame || 28;
        var x = b.x + b.w / 2;
        var y = b.y + b.h - f / 2;
        var enemies = this.enemies || [];
        var i;
        for (i = 0; i < 8; i++) {
            var tx = b.x + f / 2 + (b.w - f) * (i / 7);
            var ty = y;
            var ok = true;
            for (var e = 0; e < enemies.length; e++) {
                if (enemies[e].active && dist(tx, ty, enemies[e].x, enemies[e].y) < 50) ok = false;
            }
            if (ok) { x = tx; break; }
        }
        this.player.x = x;
        this.player.y = y;
        this.player.lastSafeX = x;
        this.player.lastSafeY = y;
        this.player.resetToSafe();
    }

    _blinkInvuln() {
        var p = this.player;
        if (!p || !p.dot) return;
        this.tweens.add({
            targets: [p.dot, p.glow],
            alpha: 0.25,
            duration: 90,
            yoyo: true,
            repeat: 6,
            onComplete: function () {
                if (p.dot) p.dot.setAlpha(1);
                if (p.glow) p.glow.setAlpha(1);
            }
        });
    }

    _tryBossWin() {
        if (!this.bossManager || !this.bossManager.defeated || this.gameOver) {
            return false;
        }
        if (!this.objectives || this.objectives.winCondition === 'boss') {
            this._win();
            return true;
        }
        var result = this.objectives.evaluateNow();
        if (result && result.win) {
            this._win();
            return true;
        }
        return false;
    }

    _win() {
        this.gameOver = true;
        this.won = true;
        if (!window.QAMode || !QAMode.enabled) {
            GameSettings.completeLevel(this.levelId, this.packId);
            if (this._isTrainingComplete()) {
                GameSettings.unlockLevel(1, 'campaign');
                GameSettings.unlockCampaign();
            }
        }
        if (window.AudioManager) {
            if (AudioManager.playWin) AudioManager.playWin();
            else AudioManager.playSuccess();
        }
        GameSettings.vibrate([18, 35, 18, 35, 45]);
        this.game.events.emit('game:over', { win: true, level: this.levelId });
        if (this._isTrainingComplete()) {
            this._overlay('ОБУЧЕНИЕ ПРОЙДЕНО', true, {
                subtitle: 'Вот вы и прошли обучение.',
                campaignCta: true
            });
        } else {
            this._overlay('УРОВЕНЬ ПРОЙДЕН', true);
        }
        if (!GameSettings.reducedMotion()) {
            this.cameras.main.flash(260, 160, 255, 220, true);
            var W = this.scale.width;
            var H = this.scale.height;
            this._confetti(W * 0.5, H * 0.3, 32);
            this._confetti(W * 0.22, H * 0.36, 26);
            this._confetti(W * 0.78, H * 0.36, 26);
            this._confetti(W * 0.38, H * 0.24, 20);
            this._confetti(W * 0.62, H * 0.24, 20);
            this._confetti(W * 0.5, H * 0.48, 18);
        }
    }

    _isTrainingComplete() {
        return this.packId === 'training' &&
            this.levelId >= LevelManager.count(this, 'training');
    }

    _needsBasketWinWait() {
        var wc = this.objectives && this.objectives.winCondition;
        if (wc && wc !== 'vials' && wc !== 'all') return false;
        var ui = this.scene.get('UI');
        return !!(ui && ui.hasPendingBaskets && ui.hasPendingBaskets());
    }

    _onBasketsIdle() {
        if (!this._pendingWin || this.won) return;
        this._pendingWin = false;
        this._win();
    }

    _handleObjectiveResult(result) {
        if (!result) return false;
        if (result.win) {
            if (this._needsBasketWinWait()) {
                this.gameOver = true;
                this._pendingWin = true;
                this.time.delayedCall(1800, this._onBasketsIdle, [], this);
                return true;
            }
            this._win();
            return true;
        }
        if (result.lose) {
            this._lose(result.reason, result.loseKind || 'lives');
            return true;
        }
        return false;
    }

    _lose(reason, kind) {
        this.gameOver = true;
        this.loseKind = kind || 'lives';
        this.game.events.emit('game:over', { win: false, level: this.levelId });
        this._overlay(reason || 'ПРОИГРЫШ', false);
    }

    _continueOffer() {
        if (!this.rewards || !this.rewards.canRevive()) return null;
        if (this.loseKind === 'time') {
            return { kind: 'time', label: '📺 +15 СЕКУНД' };
        }
        if (this.loseKind === 'cuts') {
            return { kind: 'cuts', label: '📺 +1 СРЕЗ' };
        }
        return { kind: 'lives', label: '📺 +1 СЕРДЦЕ' };
    }

    _claimRevive() {
        return this._claimContinue('lives');
    }

    _claimContinue(kind) {
        if (!this.rewards || !this.rewards.canRevive()) {
            return Promise.resolve(false);
        }
        kind = kind || this.loseKind || 'lives';
        return this.rewards.claimRevive().then(function (completed) {
            if (!completed || !this.sys.isActive()) return false;
            this.gameOver = false;
            this.loseKind = null;
            if (kind === 'time' && this.objectives && this.objectives.grantExtraTime) {
                this.objectives.grantExtraTime(15);
                this._floatText(this.scale.width / 2, this.scale.height * 0.42, '+15 СЕК');
            } else if (kind === 'cuts' && this.objectives && this.objectives.grantExtraCuts) {
                this.objectives.grantExtraCuts(1);
                this._floatText(this.scale.width / 2, this.scale.height * 0.42, '+1 СРЕЗ');
            } else {
                this.lives = Math.max(1, this.lives + 1);
                this.invulnUntil = this.time.now + 2200;
                this._respawnOnFrame();
                this._blinkInvuln();
                this.game.events.emit('game:lives-changed', { lives: this.lives });
                this._floatText(this.player.x, this.player.y - 28, 'ВОСКРЕШЕНИЕ!');
            }
            this.game.events.emit('game:revived');
            if (window.AudioManager) AudioManager.playSuccess();
            var ui = this.scene.get('UI');
            if (ui && ui.hideEndOverlay) ui.hideEndOverlay();
            return true;
        }.bind(this));
    }

    _overlay(title, win, extra) {
        extra = extra || {};
        var ui = this.scene.get('UI');
        if (ui && ui.showEndOverlay) {
            ui.showEndOverlay({
                title: title,
                win: win,
                extra: extra,
                continueOffer: win ? null : this._continueOffer()
            });
            return;
        }
    }
}
