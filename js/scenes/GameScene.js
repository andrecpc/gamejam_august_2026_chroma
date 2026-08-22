import { Player } from '../entities/Player.js?v=1.7.31';
import { FieldManager } from '../managers/FieldManager.js?v=1.7.35';
import { VialManager } from '../managers/VialManager.js?v=1.7.32';
import { LevelManager } from '../managers/LevelManager.js?v=1.7.31';
import { SecretRules } from '../secret/SecretRules.js?v=1.7.40';
import { ObjectiveManager } from '../managers/ObjectiveManager.js?v=1.7.35';
import { MagneticManager } from '../managers/MagneticManager.js';
import { BoosterManager } from '../managers/BoosterManager.js?v=1.7.28';
import { EnemyManager } from '../managers/EnemyManager.js?v=1.7.35';
import { BossManager } from '../managers/BossManager.js?v=1.7.11';
import { RewardedAdManager } from '../managers/RewardedAdManager.js?v=1.7.8';
import { dist, hexToInt, pointHitsPolyline, polyCentroid } from '../utils/Geometry.js';

var COLOR_NAMES = {
    red: 'красный',
    blue: 'синий',
    yellow: 'жёлтый',
    green: 'зелёный',
    purple: 'фиолетовый',
    orange: 'оранжевый',
    cyan: 'голубой',
    pink: 'розовый',
    lime: 'лаймовый',
    rainbow: 'радужный',
    tape: 'скотч'
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
        this._stickMouseHeld = false;
        this.dir = { x: 0, y: 0 };
        this.invulnUntil = 0;
        this.shieldUntil = 0;
        this.shieldNoticeUntil = 0;
        this._firedTutorials = {};
        this._tutorialMoveSent = false;
        this._wasDrawing = false;
        this._pendingWin = false;
        this.loseKind = null;
        this._hasMoved = false;
        this._finaleConfettiEvent = null;
        this._crumbAt = null;
        this._stickNeedsRelease = false;
        this._onVisChange = null;
        this._introHold = false;
        this.playStartedAt = 0;
        this._bossDeathPlaying = false;
        this._cutStreak = 0;
        this._comboHit = false;
        this.secret = null;
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
        this.secret = SecretRules.attach(this);
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
        if (window.AudioManager && AudioManager.startMusic) {
            AudioManager.startMusic(this._levelMusicMode());
        }

        this.confetti = this.add.group({ maxSize: 280, runChildUpdate: true });
        this._bindInput();
        this._spawnTime = this.time.now;
        this._resetStick();
        this._lockStickUntilRelease();
        this.events.on('resume', this._lockStickUntilRelease, this);
        this._onVisChange = function () {
            if (document.hidden) {
                self._lockStickUntilRelease();
                return;
            }
            if (window.AudioManager && AudioManager.resume) AudioManager.resume();
        };
        document.addEventListener('visibilitychange', this._onVisChange);

        this.scene.launch('UI', { pack: this.packId, level: this.levelId });
        this.floatLayer = this.add.container(0, 0);
        this.floatLayer.setDepth(25);
        this.game.events.on('game:baskets-idle', this._onBasketsIdle, this);
        this.game.events.on('game:boss-defeated', this._onBossDefeated, this);
        if (this.level.constraints && this.level.constraints.time) {
            this._introHold = true;
            this.playStartedAt = 0;
            this._lockStickUntilRelease();
        } else {
            this.playStartedAt = this.time.now;
        }
        this.time.delayedCall(0, function () {
            self.game.events.emit('game:ready', {
                lives: self.lives,
                level: self.levelId,
                palette: self.level.palette,
                vials: self.vials.snapshot()
            });
            if (self.level.constraints && self.level.constraints.time) {
                self._startTimedIntro();
            }
            if (self.bossManager) self.bossManager.emitStatus();
            if (self.bossManager && self.bossManager.lockPuzzle) {
                self.time.delayedCall(500, function () {
                    self.game.events.emit('game:enemy-action', {
                        type: 'fieldBoss',
                        label: 'Сначала печати в кольцах — ядро под щитом'
                    });
                });
            } else if (self.bossManager && self.bossManager.type === 'colorBoss') {
                self.time.delayedCall(800, function () {
                    self.game.events.emit('game:enemy-action', {
                        type: 'colorBoss',
                        label: 'Отрезай цвет — падает полоска того же цвета',
                        hold: 2600
                    });
                });
            }
        });
        this.events.once('shutdown', this._onShutdown, this);
        this.events.once('destroy', this._onShutdown, this);
    }

    _onShutdown() {
        this.game.events.off('game:baskets-idle', this._onBasketsIdle, this);
        this.game.events.off('game:boss-defeated', this._onBossDefeated, this);
        if (this.scene.isActive('UI') || this.scene.isSleeping('UI')) {
            this.scene.stop('UI');
        }
        if (this.secret) { this.secret.destroy(); this.secret = null; }
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
        this.events.off('resume', this._lockStickUntilRelease, this);
        if (this._onVisChange) {
            document.removeEventListener('visibilitychange', this._onVisChange);
            this._onVisChange = null;
        }
        if (this._winMouseMove) {
            window.removeEventListener('mousemove', this._winMouseMove);
            this._winMouseMove = null;
        }
        if (this._winMouseUp) {
            window.removeEventListener('mouseup', this._winMouseUp);
            this._winMouseUp = null;
        }
        if (this._winBlur) {
            window.removeEventListener('blur', this._winBlur);
            this._winBlur = null;
        }
        if (this.tweens) this.tweens.killAll();
        if (this.time) this.time.removeAllEvents();
        this._finaleConfettiEvent = null;
        if (window.AudioManager && AudioManager.stopFinale) AudioManager.stopFinale();
        if (window.AudioManager && AudioManager.stopCritters) AudioManager.stopCritters();
        this.enemies = [];
    }

    _bindInput() {
        var self = this;
        this.input.on('pointerdown', function (p) {
            if (self.gameOver) return;
            if (self._introHold) return;
            if (self._bossDeathPlaying) return;
            if (self._stickNeedsRelease) return;
            var W = self.scale.width;
            var H = self.scale.height;
            if (p.x > W - 120 && p.y < 120) return;
            if (p.x > W - 230 && p.y > H - 180) return;
            self.stick.active = true;
            self.stick.ox = p.x;
            self.stick.oy = p.y;
            self._stickMouseHeld = !p || p.pointerType !== 'touch';
        });
        this.input.on('pointermove', function (p) {
            if (!self.stick.active) return;
            self._aimStick(p.x, p.y);
        });
        this.input.on('pointerup', function (p) {
            if (p && p.pointerType !== 'touch') {
                var inside = p.x >= 0 && p.y >= 0 &&
                    p.x <= self.scale.width && p.y <= self.scale.height;
                if (!inside) return;
                self._stickMouseHeld = false;
            }
            self._resetStick();
            if (!self._anyPointerDown()) self._stickNeedsRelease = false;
        });
        this.input.on('pointerupoutside', function (p) {
            if (p && p.pointerType === 'mouse') return;
            self._resetStick();
            if (!self._anyPointerDown()) self._stickNeedsRelease = false;
        });
        this._winMouseMove = function (ev) {
            if (!self.stick || !self.stick.active || !self._stickMouseHeld) return;
            var pos = self._clientToGame(ev.clientX, ev.clientY);
            self._aimStick(pos.x, pos.y);
        };
        this._winMouseUp = function () {
            if (!self._stickMouseHeld) return;
            self._stickMouseHeld = false;
            self._resetStick();
            self._stickNeedsRelease = false;
        };
        this._winBlur = function () {
            if (!self._stickMouseHeld) return;
            self._stickMouseHeld = false;
            self._lockStickUntilRelease();
        };
        window.addEventListener('mousemove', this._winMouseMove);
        window.addEventListener('mouseup', this._winMouseUp);
        window.addEventListener('blur', this._winBlur);
    }

    _clientToGame(clientX, clientY) {
        var bounds = this.scale && this.scale.canvasBounds;
        if (!bounds || bounds.width < 1 || bounds.height < 1) {
            bounds = this.game.canvas.getBoundingClientRect();
        }
        return {
            x: (clientX - bounds.left) * (this.scale.width / bounds.width),
            y: (clientY - bounds.top) * (this.scale.height / bounds.height)
        };
    }

    _aimStick(x, y) {
        var dx = x - this.stick.ox;
        var dy = y - this.stick.oy;
        var max = 70;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 8) {
            this.dir.x = 0;
            this.dir.y = 0;
            return;
        }
        var k = len > max ? max / len : 1;
        this.dir.x = (dx * k) / max;
        this.dir.y = (dy * k) / max;
    }

    update(t, dt) {
        if (this.gameOver) return;
        if (this._introHold) {
            if (this._stickNeedsRelease) {
                this._resetStick();
                if (!this._anyPointerDown() && !this._stickMouseHeld) {
                    this._stickNeedsRelease = false;
                }
            } else {
                this._resetStick();
            }
            this._drawStick();
            return;
        }
        if (this.bossManager && this.bossManager.defeated && !this.gameOver) {
            this._bossDeathPlaying = !!(this.bossManager.deathAnimUntil &&
                this.time.now < this.bossManager.deathAnimUntil);
            if (this._tryBossWin()) return;
            if (this._bossDeathPlaying) {
                this._resetStick();
                this._drawStick();
                return;
            }
        }
        if (this._stickNeedsRelease) {
            this._resetStick();
            if (!this._anyPointerDown() && !this._stickMouseHeld) {
                this._stickNeedsRelease = false;
            }
        } else if (this.stick.active && !this._anyPointerDown() && !this._stickMouseHeld) {
            this._resetStick();
        }
        var dts = Math.min(dt, 50) / 1000;
        if (this.secret) this.secret.update(dts);
        if (this.dir && (this.dir.x || this.dir.y)) this._hasMoved = true;
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
        if (this.player.drawing) {
            this._fireTutorials('drawing');
            this._tickCutCrumbs();
        } else {
            this._crumbAt = null;
        }
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
        var canConsumeShot = this.time.now >= this.invulnUntil;
        if (this.enemyManager && this.enemyManager.hitsPlayer(this.player, canConsumeShot)) {
            this._hurt('снаряд');
        }
        if (this.bossManager && this.bossManager.hitsPlayer(this.player, canConsumeShot)) {
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

    _resetStick() {
        this.stick.active = false;
        this.dir.x = 0;
        this.dir.y = 0;
        if (this._stickGfx()) this._stickGfx().clear();
    }

    _anyPointerDown() {
        var pointers = this.input && this.input.manager && this.input.manager.pointers;
        if (!pointers) return false;
        var i;
        for (i = 0; i < pointers.length; i++) {
            if (pointers[i] && pointers[i].isDown) return true;
        }
        return false;
    }

    _lockStickUntilRelease() {
        this._stickMouseHeld = false;
        this._resetStick();
        this._stickNeedsRelease = true;
        var self = this;
        if (this._stickUnlockEvent) {
            this._stickUnlockEvent.remove(false);
            this._stickUnlockEvent = null;
        }
        if (!this._anyPointerDown()) {
            this._stickNeedsRelease = false;
            return;
        }
        this._stickUnlockEvent = this.time.delayedCall(600, function () {
            self._stickNeedsRelease = false;
            self._resetStick();
        });
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
        if (this.secret && this.secret.handleCut(cut)) return;

        var acceptedByColor = {};
        var anyAccept = false;
        var anyReject = false;
        var reserveColor = null;
        var noBasket = false;
        var self = this;
        var objectiveResult = null;
        var coreBlocked = false;
        var flights = [];
        cut.pieces.sort(function (a, b) { return b.area - a.area; });
        var main = cut.pieces[0];
        var hasPourable = cut.pieces.some(function (p) {
            return self.vials.canClaim(p.color) === 'pour';
        });

        cut.pieces.forEach(function (piece) {
            if (self.bossManager && self.bossManager.protectsColor(piece.color)) {
                anyReject = true;
                coreBlocked = true;
                self.field.bouncePolys(piece.polys);
                return;
            }
            var mode = self.vials.canClaim(piece.color);
            if (mode === 'blocked') {
                if (!hasPourable && (piece === main || piece.area > (main.area * 0.45))) {
                    anyReject = true;
                    noBasket = true;
                    self.field.bouncePolys(piece.polys);
                }
                return;
            }
            if (mode === 'vanish') {
                acceptedByColor[piece.color] = 1;
                anyAccept = true;
                if (piece === main || (main && piece.area > main.area * 0.45)) {
                    noBasket = true;
                }
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
                    noBasket = true;
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
                    flights.push({
                        piece: piece,
                        amount: ev.amount,
                        vialId: ev.vial.id,
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
            this._resetCutStreak();
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
                this._toastNoBasket();
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
            this._registerSuccessfulCut();
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
                self._popEnemy(e);
                e.kill();
            }
            (applied.killed || []).forEach(kill);
            if (window.AudioManager && AudioManager.playCut) {
                AudioManager.playCut({ combo: this._comboHit });
            }
            GameSettings.vibrate(this._comboHit ? 18 : 12);
            this._cutJuice(trail, cut.pieces);
            this._fireTutorials('cut');
            this.game.events.emit('game:tutorial-dismiss', { reason: 'cut' });
            if (this.objectives) {
                objectiveResult = this.objectives.onSuccessfulCut(dead.length);
            }
            if (dead.length) {
                this._floatText(this.player.x, this.player.y - 48, 'ПОЙМАН!');
                this.time.delayedCall(70, function () {
                    if (window.AudioManager && AudioManager.playCatch) AudioManager.playCatch();
                });
            }
            this._dispatchBasketFlights(flights, !!(objectiveResult && objectiveResult.win));
        }
        if (reserveColor && anyAccept) {
            this._floatText(
                this.player.x,
                this.player.y - 28,
                'Этот цвет нужен будущим корзинам'
            );
        } else if (noBasket && !coreBlocked) {
            this._toastNoBasket();
        }

        this.game.events.emit('game:vials-changed', this.vials.snapshot());
        this._handleObjectiveResult(objectiveResult);
    }

    _failCut(reason) {
        this._resetCutStreak();
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
        this._toastNoBasket();
        if (window.AudioManager && AudioManager.playError) AudioManager.playError();
    }

    _resetCutStreak() {
        this._cutStreak = 0;
        this._comboHit = false;
    }

    _registerSuccessfulCut() {
        this._cutStreak = (this._cutStreak || 0) + 1;
        this._comboHit = this._cutStreak > 0 && this._cutStreak % 3 === 0;
        if (!this._comboHit) return;
        this._floatText(this.player.x, this.player.y - 72, 'КОМБО!', {
            size: '30px',
            color: '#f7f1e4',
            hold: 700,
            rise: 48
        });
        this._spawnPaperCrumbs(this.player.x, this.player.y, 0xf7f1e4, 14);
        GameSettings.vibrate([8, 20, 16]);
    }

    _dispatchBasketFlights(flights, winningCut) {
        if (!flights || !flights.length) return;
        var last = flights.length - 1;
        var slowLast = !GameSettings.reducedMotion() && (
            winningCut || (this.vials && this.vials.allDone && this.vials.allDone())
        );
        var i;
        for (i = 0; i < flights.length; i++) {
            var f = flights[i];
            this.game.events.emit('game:basket-lock', { vialId: f.vialId });
            this._flyDrops(f.piece, f.amount, f.vialId, {
                fill: f.fill,
                popped: f.popped,
                color: f.color,
                combo: this._comboHit,
                slowMo: slowLast && i === last
            });
        }
    }

    _levelMusicMode() {
        if (this.bossManager && this.bossManager.active) return 'boss';
        if (this.level && this.level.constraints && this.level.constraints.time) {
            return 'timed';
        }
        return 'normal';
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
                combo: !!payload.combo,
                dunk: !!payload.slowMo,
                x: target.x,
                y: target.y
            });
        };
        if (GameSettings.reducedMotion()) {
            arrive();
            return;
        }
        var launch = function () {
            self._launchCrumple(from, r, color, target, arrive, payload.slowMo);
        };
        if (piece && piece.polys && piece.polys[0] && !piece._juicePeeled) {
            piece._juicePeeled = true;
            this._peelThenCrumple(piece, color, from, launch, payload.slowMo);
            return;
        }
        if (window.AudioManager && AudioManager.playRustle) AudioManager.playRustle();
        launch();
    }

    _peelThenCrumple(piece, color, from, done, slowMo) {
        var poly = piece.polys[0];
        var c = polyCentroid(poly) || from;
        var wrap = this.add.container(c.x, c.y).setDepth(17);
        var g = this.add.graphics();
        wrap.add(g);
        var shifted = [];
        var i;
        for (i = 0; i < poly.length; i++) {
            shifted.push({ x: poly[i].x - c.x, y: poly[i].y - c.y });
        }
        if (window.Paper && Paper.drawColorPiece) {
            Paper.drawColorPiece(g, shifted, color, Math.round(c.x * 13 + c.y) >>> 0, {
                lift: true,
                matchField: true
            });
        } else {
            g.fillStyle(color, 1);
            g.beginPath();
            g.moveTo(shifted[0].x, shifted[0].y);
            for (i = 1; i < shifted.length; i++) g.lineTo(shifted[i].x, shifted[i].y);
            g.closePath();
            g.fillPath();
        }
        this._spawnPaperCrumbs(c.x, c.y, color, slowMo ? 16 : 10);
        if (window.AudioManager && AudioManager.playRustle) AudioManager.playRustle();
        var self = this;
        this.tweens.add({
            targets: wrap,
            y: c.y - (slowMo ? 16 : 12),
            scale: slowMo ? 1.06 : 1.04,
            duration: slowMo ? 180 : 160,
            ease: 'Back.easeOut',
            onComplete: function () {
                self.tweens.add({
                    targets: wrap,
                    scale: 0.18,
                    angle: Phaser.Math.Between(-48, 48),
                    duration: slowMo ? 130 : 170,
                    ease: 'Quad.easeIn',
                    onComplete: function () {
                        wrap.destroy(true);
                        done();
                    }
                });
            }
        });
    }

    _launchCrumple(from, r, color, target, arrive, dunk) {
        var self = this;
        var drop = this.add.graphics().setDepth(18);
        drop.x = from.x;
        drop.y = from.y - 8;
        if (window.Paper && Paper.drawCrumple) {
            Paper.drawCrumple(drop, 0, 0, r * (dunk ? 1.22 : 1), color, Math.round(from.x * 13 + from.y * 7) >>> 0);
        } else {
            drop.fillStyle(color, 0.9);
            drop.fillCircle(0, 0, r);
        }
        if (!dunk) {
            this.tweens.add({
                targets: drop,
                scaleX: 1.32,
                scaleY: 0.58,
                duration: 110,
                yoyo: true,
                ease: 'Quad.easeIn',
                onComplete: function () {
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
                }
            });
            return;
        }
        var hangX = from.x + (target.x - from.x) * 0.4;
        var hangY = Math.max(72, Math.min(from.y, target.y) - 86);
        this.tweens.add({
            targets: drop,
            x: hangX,
            y: hangY,
            scale: 1.34,
            angle: 70,
            duration: 360,
            ease: 'Quad.easeOut',
            onComplete: function () {
                self._spawnDunkStreak(drop, r, color);
                self.tweens.add({
                    targets: drop,
                    x: target.x,
                    y: target.y,
                    scale: 0.4,
                    angle: 390,
                    duration: 210,
                    ease: 'Cubic.easeIn',
                    onComplete: function () {
                        var hx = target.x;
                        var hy = target.y;
                        drop.destroy();
                        if (!GameSettings.reducedMotion()) {
                            self.cameras.main.shake(140, 0.012);
                            self._spawnPaperCrumbs(hx, hy, color, 18);
                            self._impactBurst(hx, hy, color, 16);
                        }
                        if (window.AudioManager && AudioManager.playSwish) AudioManager.playSwish();
                        arrive();
                    }
                });
            }
        });
    }

    _spawnDunkStreak(drop, r, color) {
        var self = this;
        var n = 0;
        this.time.addEvent({
            delay: 26,
            repeat: 7,
            callback: function () {
                if (!drop || !drop.active) return;
                n += 1;
                var ghost = self.add.graphics().setDepth(17);
                ghost.setPosition(drop.x, drop.y);
                ghost.setScale(drop.scaleX, drop.scaleY);
                ghost.setAngle(drop.angle);
                ghost.setAlpha(0.42 - n * 0.04);
                if (window.Paper && Paper.drawCrumple) {
                    Paper.drawCrumple(ghost, 0, 0, r, color, (n * 19) >>> 0);
                } else {
                    ghost.fillStyle(color, 0.4);
                    ghost.fillCircle(0, 0, r);
                }
                self.tweens.add({
                    targets: ghost,
                    alpha: 0,
                    scale: 0.2,
                    duration: 170,
                    onComplete: function () { ghost.destroy(); }
                });
            }
        });
    }

    _cutJuice(trail, pieces) {
        if (!GameSettings.reducedMotion()) {
            this.cameras.main.shake(100, 0.005);
        }
        this._flashCutEdge(trail);
        this._cutImpact();
        if (GameSettings.reducedMotion() || !trail || trail.length < 2) return;
        var step = Math.max(1, Math.floor(trail.length / 16));
        var i;
        for (i = 0; i < trail.length; i += step) {
            this._spawnPaperCrumb(trail[i].x, trail[i].y, 0xf7f1e6, true);
            if (i % (step * 2) === 0) {
                this._spawnPaperCrumb(trail[i].x, trail[i].y, 0xf7f1e6, true);
            }
        }
        if (pieces && pieces[0] && pieces[0].polys && pieces[0].polys[0]) {
            var c = polyCentroid(pieces[0].polys[0]);
            var tint = pieces[0].color && this.level.palette
                ? hexToInt(this.level.palette[pieces[0].color] || 0xf7f1e6)
                : 0xf7f1e6;
            if (c) this._spawnPaperCrumbs(c.x, c.y, tint, this._comboHit ? 16 : 8);
        }
        if (this._comboHit && trail && trail.length > 2) {
            var extra = Math.max(1, Math.floor(trail.length / 10));
            var k;
            for (k = 0; k < trail.length; k += extra) {
                this._spawnPaperCrumb(trail[k].x, trail[k].y, 0xf7f1e6, false);
            }
        }
    }

    _flashCutEdge(trail) {
        if (!trail || trail.length < 2 || !window.Paper || !Paper.drawCutDeckle) return;
        var g = this.add.graphics().setDepth(6.4);
        Paper.drawCutDeckle(g, trail, Math.round((trail[0].x || 0) * 9 + (trail[0].y || 0)) >>> 0);
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: GameSettings.reducedMotion() ? 120 : 420,
            delay: GameSettings.reducedMotion() ? 0 : 140,
            onComplete: function () { g.destroy(); }
        });
    }

    _tickCutCrumbs() {
        if (GameSettings.reducedMotion() || !this.player) return;
        var trail = this.player.trail;
        if (!trail || trail.length < 2) return;
        var last = trail[trail.length - 1];
        if (this._crumbAt && dist(this._crumbAt.x, this._crumbAt.y, last.x, last.y) < 8) return;
        this._crumbAt = { x: last.x, y: last.y };
        this._spawnPaperCrumb(last.x, last.y, 0xf7f1e6, true);
        this._spawnPaperCrumb(
            last.x + Phaser.Math.Between(-6, 6),
            last.y + Phaser.Math.Between(-6, 6),
            0xffffff,
            true
        );
        var name = this.field && this.field.colorAt && this.field.colorAt(last.x, last.y);
        var tint = 0xf7f1e6;
        if (name && this.level && this.level.palette && this.level.palette[name]) {
            tint = hexToInt(this.level.palette[name]);
        }
        this._spawnPaperCrumb(last.x, last.y, tint, true);
    }

    _spawnPaperCrumbs(x, y, color, count) {
        var n = count || 6;
        var i;
        for (i = 0; i < n; i++) this._spawnPaperCrumb(x, y, color, false);
    }

    _spawnPaperCrumb(x, y, color, tiny) {
        if (!this.sys || !this.sys.isActive()) return;
        var w = tiny ? Phaser.Math.Between(3, 6) : Phaser.Math.Between(5, 10);
        var h = tiny ? Phaser.Math.Between(4, 8) : Phaser.Math.Between(8, 14);
        var bit = this.add.rectangle(x, y, w, h, color, 0.95).setDepth(19);
        bit.setAngle(Phaser.Math.Between(0, 360));
        if (this.confetti) this.confetti.add(bit);
        this.tweens.add({
            targets: bit,
            x: x + Phaser.Math.Between(-28, 28),
            y: y + Phaser.Math.Between(12, 46),
            angle: bit.angle + Phaser.Math.Between(-120, 120),
            alpha: 0,
            scale: 0.3,
            duration: Phaser.Math.Between(280, 480),
            ease: 'Quad.easeOut',
            onComplete: function (tw, targets) { targets[0].destroy(); }
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
            var twHost = (ui && ui.tweens) ? ui : this;
            twHost.tweens.add({
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

    _popEnemy(enemy) {
        var x = enemy.x;
        var y = enemy.y;
        var color = enemy.tint || 0xffd24a;
        this._impactBurst(x, y, color, GameSettings.reducedMotion() ? 8 : 18);
        this._spawnPaperCrumbs(x, y, color, 14);
        this._spawnPaperCrumbs(x, y, 0xf7f1e6, 10);
        if (GameSettings.reducedMotion()) return;
        this.cameras.main.shake(90, 0.008);
        var rim = this.add.circle(x, y, 10, 0xf7f1e6, 0)
            .setStrokeStyle(5, 0xf7f1e6, 0.95)
            .setDepth(19);
        this.confetti.add(rim);
        this.tweens.add({
            targets: rim,
            scale: 5.4,
            alpha: 0,
            duration: 360,
            ease: 'Cubic.easeOut',
            onComplete: function () { rim.destroy(); }
        });
        var i;
        for (i = 0; i < 5; i++) {
            var bit = this.add.graphics().setDepth(19);
            var w = Phaser.Math.Between(10, 18);
            var h = Phaser.Math.Between(8, 14);
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(bit, 0, 0, w, h, i % 2 ? color : 0xf7f1e6, 70 + i, {
                    jag: 4, shadowX: 4, shadowY: 5, fibers: false
                });
            } else {
                bit.fillStyle(color, 1);
                bit.fillCircle(0, 0, w / 2);
            }
            bit.setPosition(x, y);
            this.tweens.add({
                targets: bit,
                x: x + Phaser.Math.Between(-70, 70),
                y: y + Phaser.Math.Between(-50, 60),
                angle: Phaser.Math.Between(-120, 120),
                alpha: 0,
                duration: Phaser.Math.Between(280, 460),
                ease: 'Quad.easeOut',
                onComplete: function (tw, tgt) { tgt[0].destroy(); }
            });
        }
    }

    _updateTutorialDismiss() {
        if (this.packId !== 'training' && this.packId !== 'secret') return;
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

    _startTimedIntro() {
        var self = this;
        this._introHold = true;
        this.playStartedAt = 0;
        this._lockStickUntilRelease();
        this.game.events.emit('game:countdown', {
            text: 'Уровень на время',
            tick: false
        });
        if (GameSettings.reducedMotion()) {
            this.time.delayedCall(900, function () {
                if (self.sys && self.sys.isActive()) self._endTimedIntro();
            });
            return;
        }
        this.time.delayedCall(2000, function () {
            if (self.sys && self.sys.isActive()) {
                self.game.events.emit('game:countdown', { text: '3', tick: true });
            }
        });
        this.time.delayedCall(2800, function () {
            if (self.sys && self.sys.isActive()) {
                self.game.events.emit('game:countdown', { text: '2', tick: true });
            }
        });
        this.time.delayedCall(3600, function () {
            if (self.sys && self.sys.isActive()) {
                self.game.events.emit('game:countdown', { text: '1', tick: true });
            }
        });
        this.time.delayedCall(4300, function () {
            if (self.sys && self.sys.isActive()) self._endTimedIntro();
        });
    }

    _endTimedIntro() {
        this.game.events.emit('game:countdown-hide');
        this._introHold = false;
        this.playStartedAt = this.time.now;
        if (this.objectives && this.objectives.startClock) this.objectives.startClock();
        if (this.enemyManager && this.enemyManager.onPlayStart) {
            this.enemyManager.onPlayStart();
        }
        if (this.bossManager && this.bossManager.active && !this.bossManager.defeated) {
            var delay = this.bossManager.cfg && this.bossManager.cfg.initialDelay != null
                ? this.bossManager.cfg.initialDelay
                : 900;
            this.bossManager.nextAttackAt = this.time.now + delay;
        }
        this._lockStickUntilRelease();
    }

    _toastNoBasket() {
        var b = this.field && this.field.bounds;
        var x = this.player ? this.player.x : this.scale.width / 2;
        var y = this.player ? this.player.y - 36 : this.scale.height * 0.42;
        if (b) y = Math.min(y, b.y + b.h * 0.42);
        this._floatText(x, y, 'Нет свободной корзины!', { hold: 2200, size: '24px' });
    }

    _fireTutorials(trigger) {
        if ((this.packId !== 'training' && this.packId !== 'secret') ||
            !this.level || !this.level.tutorials) {
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

    _floatText(x, y, msg, opts) {
        opts = opts || {};
        var ui = this.scene.get('UI');
        var host = (ui && ui.add && ui.scene) ? ui : this;
        var W = this.scale.width;
        var H = this.scale.height;
        var t = host.add.text(0, 0, msg, {
            fontFamily: 'Arial, sans-serif',
            fontSize: opts.size || '22px',
            fontStyle: 'bold',
            color: opts.color || '#ffd24a',
            stroke: '#000000',
            strokeThickness: opts.stroke != null ? opts.stroke : 4
        }).setOrigin(0.5).setDepth(95);
        var pad = 28;
        var hw = Math.max(36, t.width / 2);
        var hh = Math.max(14, t.height / 2);
        var tx = Phaser.Math.Clamp(x, pad + hw, W - pad - hw);
        var ty = Phaser.Math.Clamp(y, pad + hh, H - pad - hh);
        var rise = opts.rise != null ? opts.rise : 36;
        var endY = Phaser.Math.Clamp(ty - rise, pad + hh, H - pad - hh);
        var hold = opts.hold != null ? opts.hold : 1600;
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
                    delay: hold,
                    onComplete: function () { t.destroy(); }
                });
            }
        });
    }

    _hurt() {
        if (this.gameOver) return false;
        if (this._tryBossWin()) {
            return false;
        }
        if (this.time.now < this.shieldUntil) {
            if (this.time.now >= this.shieldNoticeUntil) {
                this.shieldNoticeUntil = this.time.now + 500;
                this._floatText(this.player.x, this.player.y - 28, 'ЩИТ!');
                if (window.AudioManager && AudioManager.playZap) AudioManager.playZap();
            }
            return false;
        }
        if (this.time.now < this.invulnUntil) return false;
        this.invulnUntil = this.time.now + 700;
        this._resetCutStreak();
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
        if (this.lives > 0 && this.boosters && this.boosters.grantShield) {
            this.boosters.grantShield(2000);
        }
        if (this.lives <= 0) this._lose();
        return true;
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
            this._lockStickUntilRelease();
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
            from: { x: target.x, y: target.y - 90 },
            slowMo: !!(this.vials && this.vials.allDone && this.vials.allDone())
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
        if (this.field.xf) {
            var world = this.field.toWorld(x, y);
            x = world.x;
            y = world.y;
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

    _onBossDefeated() {
        if (window.AudioManager && AudioManager.startMusic) {
            AudioManager.startMusic('destroy');
        }
    }

    _tryBossWin() {
        if (!this.bossManager || !this.bossManager.defeated || this.gameOver) {
            return false;
        }
        if (this.bossManager.deathAnimUntil &&
            this.time.now < this.bossManager.deathAnimUntil) {
            this._bossDeathPlaying = true;
            return false;
        }
        this._bossDeathPlaying = false;
        if (this._pendingWin) {
            if (this._needsBasketWinWait()) return false;
            this._pendingWin = false;
            this._win();
            return true;
        }
        if (!this.objectives || this.objectives.winCondition === 'boss') {
            this._win();
            return true;
        }
        var result = this.objectives.evaluateNow();
        if (result && result.win) {
            if (this._needsBasketWinWait()) {
                this._pendingWin = true;
                return false;
            }
            this._win();
            return true;
        }
        return false;
    }

    _win() {
        this.gameOver = true;
        this.won = true;
        if (window.AudioManager && AudioManager.stopCritters) AudioManager.stopCritters();
        if (!window.QAMode || !QAMode.enabled) {
            GameSettings.completeLevel(this.levelId, this.packId);
            if (this._isTrainingComplete()) {
                GameSettings.unlockLevel(1, 'campaign');
                GameSettings.unlockCampaign();
            }
        }
        if (this._isCampaignComplete()) {
            if (GameSettings.unlockSecret) GameSettings.unlockSecret();
            if (window.AudioManager && AudioManager.playFinale) AudioManager.playFinale();
            else if (window.AudioManager) AudioManager.playWin();
        } else if (window.AudioManager) {
            if (AudioManager.startMusic) AudioManager.startMusic('normal');
            if (AudioManager.playWin) AudioManager.playWin();
            else AudioManager.playSuccess();
        }
        GameSettings.vibrate([18, 35, 18, 35, 45]);
        this._resetStick();
        this._lockStickUntilRelease();
        this.game.events.emit('game:over', { win: true, level: this.levelId });
        if (this._isCampaignComplete()) {
            this._overlay('УРОВЕНЬ ПРОЙДЕН', true, {
                subtitle: 'Ну вот вы и прошли эту чудо игру. Респект!',
                finale: true,
                secretCta: !!(window.SecretPack && SecretPack.enabled)
            });
        } else if (this._isTrainingComplete()) {
            this._overlay('ОБУЧЕНИЕ ПРОЙДЕНО', true, {
                subtitle: 'Вот вы и прошли обучение.',
                campaignCta: true
            });
        } else {
            this._overlay('УРОВЕНЬ ПРОЙДЕН', true);
        }
        if (!GameSettings.reducedMotion()) {
            this.cameras.main.flash(260, 160, 255, 220, true);
            this._burstWinConfetti();
            if (this._isCampaignComplete()) this._loopWinConfetti();
        }
    }

    _isCampaignComplete() {
        return this.packId === 'campaign' &&
            this.levelId >= LevelManager.count(this, 'campaign');
    }

    _burstWinConfetti() {
        var W = this.scale.width;
        var H = this.scale.height;
        this._confetti(W * 0.5, H * 0.3, 32);
        this._confetti(W * 0.22, H * 0.36, 26);
        this._confetti(W * 0.78, H * 0.36, 26);
        this._confetti(W * 0.38, H * 0.24, 20);
        this._confetti(W * 0.62, H * 0.24, 20);
        this._confetti(W * 0.5, H * 0.48, 18);
    }

    _loopWinConfetti() {
        var self = this;
        if (this._finaleConfettiEvent) this._finaleConfettiEvent.remove(false);
        this._finaleConfettiEvent = this.time.addEvent({
            delay: 260,
            loop: true,
            callback: function () {
                if (!self.sys.isActive()) return;
                var W = self.scale.width;
                var H = self.scale.height;
                self._confetti(Phaser.Math.Between(80, W - 80), Phaser.Math.Between(H * 0.18, H * 0.42), 16);
            }
        });
    }

    _isTrainingComplete() {
        return this.packId === 'training' &&
            this.levelId >= LevelManager.count(this, 'training');
    }

    _needsBasketWinWait() {
        var ui = this.scene.get('UI');
        return !!(ui && ui.hasPendingBaskets && ui.hasPendingBaskets());
    }

    _onBasketsIdle() {
        if (!this._pendingWin || this.won) return;
        if (this._needsBasketWinWait()) return;
        if (this.bossManager && this.bossManager.deathAnimUntil &&
            this.time.now < this.bossManager.deathAnimUntil) {
            return;
        }
        this._pendingWin = false;
        this._win();
    }

    _handleObjectiveResult(result) {
        if (!result) return false;
        if (result.win) {
            if (this.bossManager && this.bossManager.defeated &&
                this.bossManager.deathAnimUntil &&
                this.time.now < this.bossManager.deathAnimUntil) {
                this._pendingWin = true;
                this._bossDeathPlaying = true;
                if (this._needsBasketWinWait()) {
                    this.time.delayedCall(4200, this._onBasketsIdle, [], this);
                }
                return true;
            }
            if (this._needsBasketWinWait()) {
                this.gameOver = true;
                this._pendingWin = true;
                this.time.delayedCall(4200, this._onBasketsIdle, [], this);
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
        this._resetStick();
        this._lockStickUntilRelease();
        if (window.AudioManager) {
            if (AudioManager.stopCritters) AudioManager.stopCritters();
            if (AudioManager.startMusic) AudioManager.startMusic('normal');
        }
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
            this._resetStick();
            this._lockStickUntilRelease();
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
                if (this.boosters && this.boosters.grantShield) {
                    this.boosters.grantShield(2000);
                }
                this.game.events.emit('game:lives-changed', { lives: this.lives });
                this._floatText(this.player.x, this.player.y - 28, 'ВОСКРЕШЕНИЕ!');
            }
            this.game.events.emit('game:revived');
            if (window.AudioManager) {
                if (AudioManager.startMusic) AudioManager.startMusic(this._levelMusicMode());
                if (AudioManager.playSuccess) AudioManager.playSuccess();
            }
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
