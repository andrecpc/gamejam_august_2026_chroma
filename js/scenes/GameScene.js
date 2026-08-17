import { Player } from '../entities/Player.js?v=1.5.4';
import { FieldManager } from '../managers/FieldManager.js?v=1.5.3';
import { VialManager } from '../managers/VialManager.js?v=1.5.5';
import { LevelManager } from '../managers/LevelManager.js?v=1.4.0';
import { MagneticManager } from '../managers/MagneticManager.js';
import { BoosterManager } from '../managers/BoosterManager.js?v=1.5.1';
import { EnemyManager } from '../managers/EnemyManager.js?v=1.5.3';
import { ObjectiveManager } from '../managers/ObjectiveManager.js?v=1.5.4';
import { BossManager } from '../managers/BossManager.js?v=1.5.7';
import { RewardedAdManager } from '../managers/RewardedAdManager.js?v=1.0.0';
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

function packHudLabel(packId, levelId) {
    var prefix = {
        training: 'Обуч. ',
        lab: 'Лаб. ',
        campaign: 'Ур. '
    }[packId] || '';
    return prefix + levelId;
}

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

        this.confetti = this.add.group({ maxSize: 64, runChildUpdate: true });
        this._bindInput();

        this.scene.launch('UI', { pack: this.packId, level: this.levelId });
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

        this.stickGfx = this.add.graphics();
        this.stickGfx.setDepth(20);
        this.floatLayer = this.add.container(0, 0);
        this.floatLayer.setDepth(25);

        this.add.text(40, 36, packHudLabel(this.packId, this.levelId), {
            fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#9aa4e0'
        });
        if (window.QAMode && QAMode.enabled) {
            this.add.text(130, 42, 'QA', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#ffd24a'
            });
        }
    }

    _onShutdown() {
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
        this.endOverlay = null;
        this.enemies = [];
    }

    _bindInput() {
        var self = this;
        this.input.on('pointerdown', function (p) {
            if (self.gameOver) return;
            var b = self.field.bounds;
            if (p.y < b.y - 10 || p.y > b.y + b.h + 20) return;
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
            self.stickGfx.clear();
        });
        this.input.on('pointerupoutside', function () {
            self.stick.active = false;
            self.dir.x = 0;
            self.dir.y = 0;
            self.stickGfx.clear();
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

    _drawStick() {
        var g = this.stickGfx;
        g.clear();
        if (!this.stick.active) return;
        g.fillStyle(0xffffff, 0.12);
        g.fillCircle(this.stick.ox, this.stick.oy, 54);
        g.lineStyle(3, 0xffffff, 0.35);
        g.strokeCircle(this.stick.ox, this.stick.oy, 54);
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(
            this.stick.ox + this.dir.x * 48,
            this.stick.oy + this.dir.y * 48,
            22
        );
    }

    _collideEnemies() {
        if (this.time.now < this.invulnUntil) return;
        var p = this.player;
        for (var i = 0; i < this.enemies.length; i++) {
            var e = this.enemies[i];
            if (!e.active) continue;
            if (dist(p.x, p.y, e.x, e.y) < p.radius + e.r) {
                this._hurt('враг');
                return;
            }
            if (p.drawing) {
                var hit = pointHitsPolyline(e.x, e.y, p.trail, e.r + 3);
                if (hit >= 0) {
                    p.igniteTrail(hit);
                    if (window.AudioManager && AudioManager.playZap) AudioManager.playZap();
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
            var fillEvent = result.events.find(function (event) {
                return event.type === 'fill';
            });
            self._flyDrops(
                piece,
                result.acceptedArea,
                fillEvent ? fillEvent.vial.id : null
            );
            result.events.forEach(function (ev) {
                self.game.events.emit('game:vial-' + ev.type, {
                    vial: { id: ev.vial.id, color: ev.vial.color, fill: ev.vial.fill }
                });
                if (ev.type === 'pop') {
                    if (self.bossManager) {
                        self.bossManager.onVialCompleted(ev.vial.color);
                    }
                    self._confetti(self.player.x, self.player.y);
                    if (window.AudioManager && AudioManager.playPork) AudioManager.playPork();
                } else if (window.AudioManager && AudioManager.playPour) {
                    AudioManager.playPour();
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
                this._floatText(this.player.x, this.player.y - 28, 'Нет свободной пробирки!');
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
                'Этот цвет нужен будущим пробиркам'
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
        this._floatText(this.player.x, this.player.y - 28, 'Нет свободной пробирки!');
        if (window.AudioManager && AudioManager.playError) AudioManager.playError();
    }

    _flyDrops(piece, area, vialId) {
        var self = this;
        var from = polyCentroid(piece.polys[0]);
        var color = hexToInt(this.level.palette[piece.color]);
        var drop = this.add.circle(from.x, from.y, Math.min(22, 8 + Math.sqrt(area) * 0.08), color, 0.9);
        drop.setDepth(18);
        var target = { x: this.scale.width / 2, y: this.scale.height - 210 };
        var ui = this.scene.get('UI');
        if (ui && ui.getVialTarget) {
            target = ui.getVialTarget(vialId) || target;
        }
        this.tweens.add({
            targets: drop,
            x: target.x + Phaser.Math.Between(-18, 18),
            y: target.y,
            scale: 0.4,
            duration: 420,
            ease: 'Cubic.easeIn',
            onComplete: function () {
                drop.destroy();
                self.game.events.emit('game:splash', {
                    color: piece.color,
                    vialId: vialId,
                    x: target.x,
                    y: target.y
                });
            }
        });
    }

    _confetti(x, y) {
        for (var i = 0; i < 14; i++) {
            var bit = this.add.rectangle(x, y, 8, 14, Phaser.Utils.Array.GetRandom([
                0xff4d6d, 0x4a9fff, 0xffd24a, 0x3ee6a0, 0xffffff
            ])).setDepth(19);
            this.confetti.add(bit);
            this.tweens.add({
                targets: bit,
                x: x + Phaser.Math.Between(-90, 90),
                y: y + Phaser.Math.Between(40, 140),
                angle: Phaser.Math.Between(0, 360),
                alpha: 0,
                duration: 500,
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
        var t = this.add.text(x, y, msg, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffd24a',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);
        this.tweens.add({
            targets: t,
            y: y - 36,
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
        var self = this;
        result.events.forEach(function (event) {
            self.game.events.emit('game:vial-' + event.type, {
                vial: {
                    id: event.vial.id,
                    color: event.vial.color,
                    fill: event.vial.fill
                }
            });
            if (event.type === 'pop') {
                if (self.bossManager) {
                    self.bossManager.onVialCompleted(event.vial.color);
                }
                self._confetti(self.player.x, self.player.y);
            }
        });
        this.game.events.emit('game:vials-changed', this.vials.snapshot());
        if (window.AudioManager) AudioManager.playPork();
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
            }
        }
        if (window.AudioManager) AudioManager.playSuccess();
        GameSettings.vibrate([18, 35, 18, 35, 45]);
        if (!GameSettings.reducedMotion()) {
            this.cameras.main.flash(260, 160, 255, 220, true);
            this._confetti(this.scale.width * 0.35, this.scale.height * 0.35);
            this._confetti(this.scale.width * 0.65, this.scale.height * 0.42);
        }
        this.game.events.emit('game:over', { win: true, level: this.levelId });
        if (this._isTrainingComplete()) {
            this._overlay('ОБУЧЕНИЕ ПРОЙДЕНО', true, {
                subtitle: 'Вот вы и прошли обучение.',
                campaignCta: true
            });
        } else {
            this._overlay('УРОВЕНЬ ПРОЙДЕН', true);
        }
    }

    _isTrainingComplete() {
        return this.packId === 'training' &&
            this.levelId >= LevelManager.count(this, 'training');
    }

    _handleObjectiveResult(result) {
        if (!result) return false;
        if (result.win) {
            this._win();
            return true;
        }
        if (result.lose) {
            this._lose(result.reason);
            return true;
        }
        return false;
    }

    _lose(reason) {
        this.gameOver = true;
        this.game.events.emit('game:over', { win: false, level: this.levelId });
        this._overlay(reason || 'ПРОИГРЫШ', false);
    }

    _claimRevive() {
        if (!this.rewards || !this.rewards.canRevive()) {
            return Promise.resolve(false);
        }
        return this.rewards.claimRevive().then(function (completed) {
            if (!completed || !this.sys.isActive()) return false;
            if (this.endOverlay) {
                this.endOverlay.destroy(true);
                this.endOverlay = null;
            }
            this.gameOver = false;
            this.lives = 1;
            this.invulnUntil = this.time.now + 2200;
            this._respawnOnFrame();
            this._blinkInvuln();
            this.game.events.emit('game:lives-changed', { lives: this.lives });
            this.game.events.emit('game:revived');
            this._floatText(this.player.x, this.player.y - 28, 'ВОСКРЕШЕНИЕ!');
            if (window.AudioManager) AudioManager.playSuccess();
            return true;
        }.bind(this));
    }

    _overlay(title, win, extra) {
        extra = extra || {};
        var W = this.scale.width;
        var H = this.scale.height;
        var self = this;
        var overlay = this.add.container(0, 0).setDepth(50);
        overlay.setAlpha(0);
        this.endOverlay = overlay;
        overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65));
        var titleSize = extra.subtitle || extra.campaignCta ? '48px' : '56px';
        var titleText = this.add.text(W / 2, extra.subtitle ? H * 0.26 : H * 0.32, title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: titleSize,
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5).setScale(0.72);
        overlay.add(titleText);
        if (extra.subtitle) {
            overlay.add(this.add.text(W / 2, H * 0.36, extra.subtitle, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '28px',
                color: '#dfe4ff',
                align: 'center',
                wordWrap: { width: 600 }
            }).setOrigin(0.5));
        }

        var canRevive = !win && this.lives <= 0 &&
            this.rewards && this.rewards.canRevive();
        var overlayButtons = [];
        var addOverlayButton = function (btn) {
            overlay.add(btn);
            overlayButtons.push(btn);
            return btn;
        };
        if (canRevive) {
            var adBtn = addOverlayButton(new UIButton(this, W / 2, H * 0.48, '📺 ВОСКРЕСНУТЬ С 1 ЖИЗНЬЮ', function () {
                if (!adBtn.hit.input || !adBtn.hit.input.enabled) return;
                adBtn.hit.disableInteractive();
                adBtn.setLabel('РЕКЛАМА...');
                self._claimRevive().then(function (completed) {
                    if (!completed && adBtn.scene) {
                        adBtn.setLabel('РЕКЛАМА НЕДОСТУПНА');
                    }
                });
            }, { width: 570, color: 0xffd24a, fontSize: 27, interactive: false }));
        }

        var retryY = extra.campaignCta ? 0.48 : (win ? 0.5 : (canRevive ? 0.62 : 0.52));
        addOverlayButton(new UIButton(this, W / 2, H * retryY, 'ЗАНОВО', function () {
            self.scene.restart({ pack: self.packId, level: self.levelId });
        }, { width: 440, color: 0x4a5cff, interactive: false }));

        if (extra.campaignCta) {
            addOverlayButton(new UIButton(this, W / 2, H * 0.62, 'ПЕРЕЙТИ К ОСНОВНОЙ КАМПАНИИ', function () {
                self.scene.start('LevelSelect', { pack: 'campaign' });
            }, { width: 620, color: 0x3ee6a0, fontSize: 26, interactive: false }));
        } else {
            addOverlayButton(new UIButton(this, W / 2, H * (win ? 0.62 : (canRevive ? 0.74 : 0.64)), win ? 'ДАЛЬШЕ' : 'В МЕНЮ', function () {
                if (win) {
                    var next = LevelManager.get(self, self.levelId + 1, self.packId);
                    if (next) self.scene.start('Game', { pack: self.packId, level: next.id });
                    else self.scene.start('LevelSelect', { pack: self.packId });
                } else {
                    self.scene.start('Menu');
                }
            }, { width: 440, color: 0x2ce6d0, interactive: false }));
        }
        this._armOverlayButtons(overlay, overlayButtons);
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 190,
            ease: 'Quad.easeOut'
        });
        this.tweens.add({
            targets: titleText,
            scale: 1,
            duration: 420,
            ease: 'Back.easeOut'
        });
    }

    _armOverlayButtons(overlay, buttons) {
        var self = this;
        var armed = false;
        var pointerHandler = null;
        var arm = function () {
            if (armed) return;
            if (!self.sys.isActive()) return;
            armed = true;
            if (pointerHandler) self.input.off('pointerup', pointerHandler);
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i] && buttons[i].arm) buttons[i].arm();
            }
        };
        var anyPointerDown = function () {
            var pointers = self.input.manager.pointers;
            for (var i = 0; i < pointers.length; i++) {
                if (pointers[i] && pointers[i].isDown) return true;
            }
            return false;
        };
        var wait = function () {
            if (!self.sys.isActive() || armed) return;
            if (anyPointerDown()) {
                pointerHandler = wait;
                self.input.once('pointerup', wait);
                return;
            }
            self.time.delayedCall(140, arm);
        };
        overlay.once('destroy', function () {
            if (pointerHandler) self.input.off('pointerup', pointerHandler);
        });
        wait();
    }
}
