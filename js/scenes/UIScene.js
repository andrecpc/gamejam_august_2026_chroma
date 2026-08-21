import { Vial } from '../entities/Vial.js?v=1.7.23';
import { LevelManager } from '../managers/LevelManager.js?v=1.4.0';

export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UI' });
    }

    init(data) {
        this.packId = (data && data.pack) || 'training';
        this.levelId = (data && data.level) || 1;
    }

    create() {
        var W = this.scale.width;
        var H = this.scale.height;
        var self = this;
        var level = LevelManager.get(this, this.levelId, this.packId);
        this.palette = level.palette;

        if (window.Paper && Paper.addScrap) {
            Paper.addScrap(this, 168, 70, 300, 108, 0xe6d8c0, 61, {
                depth: 32, jag: 6, shadowX: 12, shadowY: 16, angle: -3
            });
            Paper.addScrap(this, W / 2, 48, 320, 70, 0xe6d8c0, 71, {
                depth: 32, jag: 6, shadowX: 12, shadowY: 16
            });
        }
        var packPrefix = { training: 'Обуч. ', lab: 'Лаб. ', campaign: 'Ур. ' }[this.packId] || '';
        var levelLabel = packPrefix + this.levelId;
        if (window.QAMode && QAMode.enabled) levelLabel += '  QA';
        this.add.text(48, 42, levelLabel, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#3d2a22'
        }).setDepth(34);
        this.livesText = this.add.text(48, 72, '', {
            fontFamily: 'Arial, sans-serif', fontSize: '30px', color: '#ff5c7a'
        }).setDepth(34).setVisible(false);
        this.hearts = [];
        this.lastLives = -1;
        for (var hi = 0; hi < 5; hi++) {
            var wrap = this.add.container(62 + hi * 48, 90).setDepth(34);
            if (window.Paper && Paper.drawHeart) {
                var hg = this.add.graphics();
                Paper.drawHeart(hg, 0, 0, 20, 0xde3449, 201 + hi);
                wrap.add(hg);
            } else {
                wrap.add(this.add.text(0, 0, '❤', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '28px',
                    color: '#ff5c7a'
                }).setOrigin(0.5));
            }
            wrap.setVisible(false);
            this.hearts.push(wrap);
        }
        this.effectsText = this.add.text(40, 116, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#f6efe4',
            lineSpacing: 4
        }).setDepth(34);
        this.effectsBg = this.add.graphics().setDepth(33);
        this.objectiveText = this.add.text(W / 2, 46, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#3d2a22',
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(34);
        this.objectiveBars = this.add.graphics().setDepth(34);
        this.bossBar = this.add.graphics().setDepth(35).setVisible(false);
        this.bossText = this.add.text(W / 2, 70, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#3d2a22',
            stroke: '#f3ead8',
            strokeThickness: 6,
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5).setDepth(36).setVisible(false);

        this._pauseButton(W - 70, 70);

        this.playerHalo = this.add.circle(0, 0, 20, 0x111111, 0.3).setDepth(88).setVisible(false);
        this.playerMark = this.add.circle(0, 0, 14, 0xfff6ea, 1)
            .setStrokeStyle(5, 0x111111, 1)
            .setDepth(89)
            .setVisible(false);
        this.stickGfx = this.add.graphics().setDepth(86);
        this.playerHud = null;

        this.vialSlots = [];
        var slotY = H - 210;
        var xs = [W / 2 - 140, W / 2, W / 2 + 140];
        for (var i = 0; i < 3; i++) {
            var slot = new Vial(this, xs[i], slotY, 'red', this.palette);
            if (slot.setPersonality) slot.setPersonality(i);
            this.vialSlots.push(slot);
        }

        var hintText = (level && level.hint) || '';
        if (!hintText && this.packId !== 'campaign') {
            hintText = 'заполни корзины, нарезая цвета';
        }
        if (window.Paper && Paper.basketText) hintText = Paper.basketText(hintText);
        this.hint = this.add.text(28, H - 22, hintText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#d7c4a8',
            align: 'left',
            wordWrap: { width: 430 }
        }).setOrigin(0, 1);
        if (!hintText) this.hint.setVisible(false);

        this.adStub = new UIButton(this, W - 108, H - 96, '📺', function () {
            self._openRewardMenu();
        }, { width: 128, height: 108, fontSize: 52, color: 0x2aa384 });

        this._flights = {};
        this._pendingSnap = null;
        this.endOverlay = null;
        this.endDim = null;

        this.game.events.on('game:ready', this._onReady, this);
        this.game.events.on('game:vials-changed', this._onVials, this);
        this.game.events.on('game:lives-changed', this._onLives, this);
        this.game.events.on('game:effects-changed', this._onEffects, this);
        this.game.events.on('game:booster-picked', this._onBoosterPicked, this);
        this.game.events.on('game:enemy-action', this._onEnemyAction, this);
        this.game.events.on('game:objectives-changed', this._onObjectives, this);
        this.game.events.on('game:boss-changed', this._onBoss, this);
        this.game.events.on('game:reward-granted', this._onRewardGranted, this);
        this.game.events.on('game:basket-lock', this._onBasketLock, this);
        this.game.events.on('game:basket-arrive', this._onBasketArrive, this);
        this.game.events.on('game:tutorial', this._onTutorial, this);
        this.game.events.on('game:tutorial-dismiss', this._onTutorialDismiss, this);
        this.game.events.on('game:countdown', this._onCountdown, this);
        this.game.events.on('game:countdown-hide', this._hideCountdown, this);
        this.game.events.on('game:over', this._onGameOver, this);
        this.events.once('shutdown', this._off, this);
        this._showStartTutorials(level);
    }

    _off() {
        this._closeRewardMenu(true);
        this.game.events.off('game:ready', this._onReady, this);
        this.game.events.off('game:vials-changed', this._onVials, this);
        this.game.events.off('game:lives-changed', this._onLives, this);
        this.game.events.off('game:effects-changed', this._onEffects, this);
        this.game.events.off('game:booster-picked', this._onBoosterPicked, this);
        this.game.events.off('game:enemy-action', this._onEnemyAction, this);
        this.game.events.off('game:objectives-changed', this._onObjectives, this);
        this.game.events.off('game:boss-changed', this._onBoss, this);
        this.game.events.off('game:reward-granted', this._onRewardGranted, this);
        this.game.events.off('game:basket-lock', this._onBasketLock, this);
        this.game.events.off('game:basket-arrive', this._onBasketArrive, this);
        this.game.events.off('game:tutorial', this._onTutorial, this);
        this.game.events.off('game:tutorial-dismiss', this._onTutorialDismiss, this);
        this.game.events.off('game:countdown', this._onCountdown, this);
        this.game.events.off('game:countdown-hide', this._hideCountdown, this);
        this.game.events.off('game:over', this._onGameOver, this);
        this.hideEndOverlay();
        this._hideCountdown(true);
        if (this.tutorialCard) {
            this.tutorialCard.destroy(true);
            this.tutorialCard = null;
        }
        this.tutorialPersist = null;
        if (this.hearts) {
            for (var hi = 0; hi < this.hearts.length; hi++) {
                if (this.hearts[hi] && this.hearts[hi].destroy) this.hearts[hi].destroy();
            }
            this.hearts = [];
        }
        (this.vialSlots || []).forEach(function (v) { v.destroy(); });
        if (this.playerHud) {
            this.playerHud.destroy();
            this.playerHud = null;
        }
    }

    _onReady(data) {
        this._onLives({ lives: data.lives });
        this._onVials(data.vials);
    }

    _showStartTutorials(level) {
        if (!level || this.packId !== 'training' || !level.tutorials) return;
        var items = level.tutorials;
        for (var i = 0; i < items.length; i++) {
            if (items[i].trigger !== 'start') continue;
            this._onTutorial(items[i]);
            break;
        }
    }

    _onTutorial(data) {
        if (!data || !data.text) return;
        this._hideTutorial(true);
        var W = this.scale.width;
        var persist = data.persist || 'until-move';
        var copy = (window.Paper && Paper.basketText) ? Paper.basketText(data.text) : data.text;
        var text = this.add.text(0, 0, copy, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#3d2a22',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: 580 }
        }).setOrigin(0.5);
        var cardH = Math.min(460, Math.max(120, text.height + 40));
        var cardY = Math.max(110, 36 + cardH / 2);
        if (cardY + cardH / 2 > 500) cardY = 500 - cardH / 2;
        var card = this.add.container(W / 2, cardY).setDepth(80);
        var bg = this.add.graphics();
        if (window.Paper && Paper.drawScrap) {
            Paper.drawScrap(bg, 0, 0, 640, cardH + 20, 0xe6d8c0, 81, {
                jag: 9, shadowX: 14, shadowY: 18, fibers: true
            });
        } else {
            bg.fillStyle(0xe6d8c0, 1);
            bg.fillRoundedRect(-320, -cardH / 2, 640, cardH, 20);
        }
        card.add([bg, text]);
        card.setAlpha(0);
        this.tutorialCard = card;
        this.tutorialPersist = persist;
        this.tweens.add({
            targets: card,
            alpha: 1,
            y: cardY - 8,
            duration: GameSettings.reducedMotion() ? 80 : 220,
            ease: 'Quad.easeOut'
        });
    }

    _onGameOver() {
        this._hideTutorial(true);
        this._hideCountdown(true);
        if (this.playerMark) this.playerMark.setVisible(false);
        if (this.playerHalo) this.playerHalo.setVisible(false);
        if (this.stickGfx) this.stickGfx.clear();
        var game = this.scene.get('Game');
        if (game && game._lockStickUntilRelease) game._lockStickUntilRelease();
        else if (game && game._resetStick) game._resetStick();
    }

    _onTutorialDismiss(data) {
        var reason = data && data.reason;
        if (!this.tutorialCard) return;
        if (this.tutorialPersist === 'until-move' && reason === 'move') {
            this._hideTutorial(false);
        } else if (this.tutorialPersist === 'until-draw' && reason === 'draw') {
            this._hideTutorial(false);
        } else if (this.tutorialPersist === 'until-cut' && reason === 'cut') {
            this._hideTutorial(false);
        }
    }

    _onCountdown(data) {
        if (!data || !data.text) return;
        this._hideCountdown(true);
        var W = this.scale.width;
        var H = this.scale.height;
        var tick = !!data.tick;
        var layer = this.add.container(0, 0).setDepth(220).setAlpha(0);
        var dim = this.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0x0c254d, tick ? 0.32 : 0.58);
        dim.setInteractive();
        var copy = (window.Paper && Paper.basketText) ? Paper.basketText(data.text) : data.text;
        var label;
        if (tick) {
            label = this.add.text(W / 2, H * 0.42, copy, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '120px',
                fontStyle: 'bold',
                color: '#ffd24a',
                stroke: '#0c254d',
                strokeThickness: 10,
                align: 'center'
            }).setOrigin(0.5).setScale(1.18);
            layer.add([dim, label]);
        } else {
            var scrap = this.add.graphics();
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(scrap, 0, 0, 600, 180, 0xe6d8c0, 88, {
                    jag: 10, shadowX: 16, shadowY: 20, fibers: true
                });
            } else {
                scrap.fillStyle(0xe6d8c0, 1);
                scrap.fillRoundedRect(-300, -90, 600, 180, 22);
            }
            scrap.setPosition(W / 2, H * 0.42);
            label = this.add.text(W / 2, H * 0.42, copy, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '44px',
                fontStyle: 'bold',
                color: '#3d2a22',
                align: 'center',
                wordWrap: { width: 520 }
            }).setOrigin(0.5);
            layer.add([dim, scrap, label]);
        }
        this.countdownLayer = layer;
        this.tweens.add({
            targets: layer,
            alpha: 1,
            duration: GameSettings.reducedMotion() ? 60 : 180,
            ease: 'Quad.easeOut'
        });
        if (tick && !GameSettings.reducedMotion()) {
            this.tweens.add({
                targets: label,
                scale: 1,
                duration: 280,
                ease: 'Back.easeOut'
            });
        }
        if (window.AudioManager && AudioManager.playClick && tick) AudioManager.playClick();
    }

    _hideCountdown(immediate) {
        var layer = this.countdownLayer;
        this.countdownLayer = null;
        if (!layer) return;
        this.tweens.killTweensOf(layer);
        if (immediate || GameSettings.reducedMotion()) {
            layer.destroy(true);
            return;
        }
        this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 180,
            onComplete: function () { layer.destroy(true); }
        });
    }

    _hideTutorial(immediate) {
        var card = this.tutorialCard;
        this.tutorialCard = null;
        this.tutorialPersist = null;
        if (!card) return;
        this.tweens.killTweensOf(card);
        if (immediate || GameSettings.reducedMotion()) {
            card.destroy(true);
            return;
        }
        this.tweens.add({
            targets: card,
            alpha: 0,
            duration: 180,
            onComplete: function () {
                card.destroy(true);
            }
        });
    }

    _onLives(data) {
        var n = (data && typeof data.lives === 'number') ? data.lives : 0;
        var i;
        if (this.hearts && this.hearts.length) {
            for (i = 0; i < this.hearts.length; i++) {
                var heart = this.hearts[i];
                var on = i < n;
                this.tweens.killTweensOf(heart);
                heart.setScale(1);
                heart.setAngle(0);
                heart.setAlpha(on ? 1 : 0);
                heart.setVisible(on);
            }
            this.livesText.setVisible(false);
        } else {
            var s = '';
            for (i = 0; i < n; i++) s += '❤ ';
            this.livesText.setVisible(true).setText(s.trim() || '—');
        }
        if (this.lastLives >= 0 && this.lastLives !== n) {
            var pulseIdx = n < this.lastLives
                ? Math.max(0, n - 1)
                : Math.max(0, n - 1);
            var pulse = (this.hearts && this.hearts[pulseIdx] && this.hearts[pulseIdx].visible)
                ? this.hearts[pulseIdx]
                : this.livesText;
            if (pulse && pulse.visible) {
                pulse.setScale(1.28);
                this.tweens.add({
                    targets: pulse,
                    scale: 1,
                    angle: 0,
                    duration: 360,
                    ease: 'Back.easeOut'
                });
            }
        }
        this.lastLives = n;
    }

    _onEffects(data) {
        var effects = (data && data.effects) || [];
        var icons = {
            speed: '⚡',
            slow: '🐌',
            shield: '◉',
            enemySlow: '❄'
        };
        this.effectsText.setText(effects.map(function (effect) {
            return (icons[effect.type] || '✦') + ' ' +
                effect.label + '  ' + effect.seconds + 'с';
        }).join('\n'));
        this.effectsBg.clear();
        if (effects.length) {
            this.effectsBg.fillStyle(0x11142d, 0.78);
            this.effectsBg.fillRoundedRect(
                28,
                104,
                245,
                18 + effects.length * 29,
                14
            );
            this.effectsBg.lineStyle(2, 0x72f5ff, 0.25);
            this.effectsBg.strokeRoundedRect(
                28,
                104,
                245,
                18 + effects.length * 29,
                14
            );
        }
    }

    _onBoosterPicked(data) {
        var W = this.scale.width;
        var H = this.scale.height;
        var isHurt = data && data.type === 'hurt';
        var text = this.add.text(
            W / 2,
            isHurt ? H * 0.38 : 190,
            isHurt ? '−1 ЖИЗНЬ' : data.label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: isHurt ? '44px' : '30px',
                fontStyle: 'bold',
                color: isHurt ? '#ff6b7a' : '#ffffff',
                stroke: '#17203c',
                strokeThickness: isHurt ? 8 : 5
            }
        ).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: text,
            y: isHurt ? H * 0.38 - 24 : 155,
            alpha: 0,
            delay: isHurt ? 2200 : 200,
            duration: isHurt ? 500 : 650,
            onComplete: function () { text.destroy(); }
        });
    }

    _onEnemyAction(data) {
        var W = this.scale.width;
        var hold = (data && data.hold) || 1400;
        var text = this.add.text(W / 2, 220, data.label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '27px',
            fontStyle: 'bold',
            color: '#ffcf5c',
            stroke: '#17203c',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: text,
            y: 180,
            alpha: 0,
            delay: hold,
            duration: 700,
            onComplete: function () { text.destroy(); }
        });
    }

    _onObjectives(data) {
        var parts = [];
        if (data.timeLeft !== null) {
            var min = Math.floor(data.timeLeft / 60);
            var sec = data.timeLeft % 60;
            parts.push('⏱ ' + min + ':' + String(sec).padStart(2, '0'));
        }
        if (data.coverTarget !== null) {
            parts.push('Поле ' + data.coverage + '/' + data.coverTarget + '%');
        }
        if (data.maxCuts !== null) {
            parts.push('Срезы ' + data.cuts + '/' + data.maxCuts);
        }
        if (data.catchTarget !== null) {
            parts.push('Поймай врага ' + data.caught + '/' + data.catchTarget);
        }
        this.objectiveText.setText(parts.join('  •  '));
        this.objectiveBars.clear();
        var barX = this.scale.width / 2 - 130;
        var barY = 80;
        var drawBar = function (ratio, color) {
            ratio = Phaser.Math.Clamp(ratio, 0, 1);
            this.objectiveBars.fillStyle(0x11142d, 0.85);
            this.objectiveBars.fillRoundedRect(barX, barY, 260, 7, 4);
            this.objectiveBars.fillStyle(color, 1);
            this.objectiveBars.fillRoundedRect(barX, barY, 260 * ratio, 7, 4);
            barY += 12;
        }.bind(this);
        if (data.coverTarget !== null) {
            drawBar(data.coverTarget > 0 ? data.coverage / data.coverTarget : 0, 0x3ee6a0);
        }
        if (data.maxCuts !== null) {
            var cutsLeft = 1 - data.cuts / Math.max(1, data.maxCuts);
            drawBar(cutsLeft, cutsLeft < 0.25 ? 0xff5c6c : 0xffd24a);
        }
        if (data.catchTarget !== null) {
            drawBar(
                data.catchTarget > 0 ? data.caught / data.catchTarget : 0,
                0xff8a3d
            );
        }
        if (data.timeLeft !== null && data.timeLeft <= 5) {
            this.objectiveText.setColor('#ff5c6c');
            if (!GameSettings.reducedMotion()) {
                this.tweens.killTweensOf(this.objectiveText);
                this.objectiveText.setScale(1.08);
                this.tweens.add({
                    targets: this.objectiveText,
                    scale: 1,
                    duration: 260,
                    ease: 'Back.easeOut'
                });
            }
        } else {
            this.objectiveText.setColor('#3d2a22');
        }
    }

    _onBoss(data) {
        var W = this.scale.width;
        this.bossBar.setVisible(true);
        this.bossText.setVisible(true);
        this.bossBar.clear();
        if (data.bars && data.bars.length) {
            var barW = 280;
            var barX = W / 2 - barW / 2;
            var barY = 108;
            for (var i = 0; i < data.bars.length; i++) {
                var bar = data.bars[i];
                var h = 9;
                var y = barY + i * 13;
                this.bossBar.fillStyle(0x11142d, 0.95);
                this.bossBar.fillRoundedRect(barX, y, barW, h, 4);
                this.bossBar.fillStyle(bar.tint || 0xffffff, 1);
                this.bossBar.fillRoundedRect(
                    barX,
                    y,
                    Math.max(0, barW * Math.max(0, Math.min(1, bar.health))),
                    h,
                    4
                );
            }
            this.bossText.setText((data.title || 'БОСС') + '  •  режь цвет полоски');
        } else {
            var ratio = data.maxHealth > 0 ? data.health / data.maxHealth : 0;
            var width = 270;
            this.bossBar.fillStyle(0x11142d, 0.95);
            this.bossBar.fillRoundedRect(W / 2 - width / 2, 108, width, 18, 8);
            this.bossBar.fillStyle(ratio > 0.5 ? 0xff5ca8 : 0xff365f, 1);
            this.bossBar.fillRoundedRect(
                W / 2 - width / 2,
                108,
                Math.max(0, width * ratio),
                18,
                8
            );
            if (data.type === 'fieldBoss') {
                var title = data.title || 'ПАУК';
                this.bossText.setText(data.coreVulnerable
                    ? title + ' ' + data.health + '/' + data.maxHealth +
                        '  •  ЯДРО УЯЗВИМО'
                    : title + ' ' + data.health + '/' + data.maxHealth +
                        '  •  печати ' + data.nodesLeft);
            } else {
                this.bossText.setText(
                    'БОСС ' + data.health + '/' + data.maxHealth +
                    '  •  башни ' + data.towers
                );
            }
        }
        if (this.lastBossHealth !== undefined &&
            data.health < this.lastBossHealth &&
            !GameSettings.reducedMotion()) {
            this.tweens.killTweensOf(this.bossText);
            this.bossText.setScale(1.16);
            this.tweens.add({
                targets: this.bossText,
                scale: 1,
                duration: 220,
                ease: 'Back.easeOut'
            });
        }
        this.lastBossHealth = data.health;
    }

    _onVials(snap) {
        this._pendingSnap = snap;
        this._layoutVials(snap);
    }

    _slotById(vialId) {
        for (var i = 0; i < this.vialSlots.length; i++) {
            if (this.vialSlots[i].vialId === vialId) return this.vialSlots[i];
        }
        return null;
    }

    _onBasketLock(data) {
        if (!data || data.vialId == null) return;
        this._flights[data.vialId] = (this._flights[data.vialId] || 0) + 1;
        var slot = this._slotById(data.vialId);
        if (slot) slot.busy = true;
    }

    _onBasketArrive(data) {
        if (!data) return;
        var id = data.vialId;
        this._flights[id] = Math.max(0, (this._flights[id] || 1) - 1);
        var last = this._flights[id] === 0;
        if (last) delete this._flights[id];
        this._onSplash(data);
        var slot = this._slotById(id);
        if (slot && slot.juicyCatch) {
            slot.juicyCatch(data.dunk ? 'dunk' : !!data.combo);
        }
        this._basketBurst(data);
        if (slot && data.fill != null) slot.setFill(data.fill);
        if (window.AudioManager && AudioManager.playPour) AudioManager.playPour();
        if (data.popped && last) {
            this._onVialPop({
                vial: { id: id, color: data.color },
                x: data.x,
                y: data.y
            });
                if (slot) {
                    var self = this;
                    slot.explode(function () {
                        slot.busy = false;
                        slot.vialId = null;
                        if (self._pendingSnap) self._layoutVials(self._pendingSnap);
                        self._notifyBasketsIdle();
                    });
                } else {
                    this._notifyBasketsIdle();
                }
        } else if (last && slot) {
            slot.busy = false;
            if (this._pendingSnap) this._layoutVials(this._pendingSnap);
            this._notifyBasketsIdle();
        }
    }

    hasPendingBaskets() {
        var id;
        for (id in this._flights) {
            if (this._flights[id] > 0) return true;
        }
        var i;
        for (i = 0; i < this.vialSlots.length; i++) {
            if (this.vialSlots[i].busy) return true;
        }
        return false;
    }

    _notifyBasketsIdle() {
        if (this.hasPendingBaskets()) return;
        this.game.events.emit('game:baskets-idle');
    }

    _layoutVials(snap) {
        var shown = (snap && snap.displayed) || [];
        var assigned = {};
        var i;
        for (i = 0; i < 3; i++) {
            var held = this.vialSlots[i];
            if (held.busy && held.vialId != null) {
                assigned[held.vialId] = true;
                var live = null;
                var s;
                for (s = 0; s < shown.length; s++) {
                    if (shown[s].id === held.vialId) {
                        live = shown[s];
                        break;
                    }
                }
                if (live) held.setRemainingCount(live.remainingOfColor);
            }
        }
        var queue = [];
        for (i = 0; i < shown.length; i++) {
            if (!assigned[shown[i].id]) queue.push(shown[i]);
        }
        var qi = 0;
        for (i = 0; i < 3; i++) {
            var slot = this.vialSlots[i];
            if (slot.busy) continue;
            if (qi < queue.length) {
                var v = queue[qi++];
                var previousId = slot.vialId;
                var isNew = slot.vialId !== v.id;
                slot.vialId = v.id;
                slot.setColor(v.color, this.palette);
                slot.setFill(v.fill, isNew);
                slot.setRemainingCount(v.remainingOfColor);
                slot.gfx.setVisible(true);
                slot.icon.setVisible(false);
                slot.label.setVisible(true);
                if (isNew && previousId !== v.id) slot.appear({ silent: previousId == null });
            } else {
                slot.vialId = null;
                slot.setFill(0, true);
                slot.gfx.setVisible(false);
                slot.icon.setVisible(false);
                slot.label.setVisible(false);
            }
        }
    }

    _onVialPop(data) {
        var target = (data.x !== undefined && data.y !== undefined)
            ? { x: data.x, y: data.y }
            : this.getVialTarget(data.vial && data.vial.id);
        if (!target) return;
        GameSettings.vibrate([12, 20, 18]);
        if (window.AudioManager && AudioManager.playRustle) AudioManager.playRustle();
        else if (window.AudioManager && AudioManager.playPork) AudioManager.playPork();
        var paletteColor = this.palette[data.vial && data.vial.color] || 0xffffff;
        var color = typeof paletteColor === 'number'
            ? paletteColor
            : Phaser.Display.Color.HexStringToColor(paletteColor).color;
        var ring = this.add.circle(target.x, target.y, 28, color, 0)
            .setStrokeStyle(5, 0xffffff, 0.9)
            .setDepth(45);
        this.tweens.add({
            targets: ring,
            scale: GameSettings.reducedMotion() ? 1.35 : 2.2,
            alpha: 0,
            duration: GameSettings.reducedMotion() ? 160 : 320,
            ease: 'Cubic.easeOut',
            onComplete: function () { ring.destroy(); }
        });
    }

    _onSplash(data) {
        var paletteColor = this.palette[data.color] || 0x72f5ff;
        var color = typeof paletteColor === 'number'
            ? paletteColor
            : Phaser.Display.Color.HexStringToColor(paletteColor).color;
        var target = (data.x !== undefined && data.y !== undefined)
            ? { x: data.x, y: data.y }
            : this.getVialTarget(data.vialId) || {
            x: this.scale.width / 2,
            y: this.scale.height - 248
        };
        var x = target.x;
        var y = target.y;
        var dropCount = GameSettings.reducedMotion() ? 2 : 5;
        for (var i = 0; i < dropCount; i++) {
            var ball = this.add.graphics().setDepth(38);
            ball.x = x + Phaser.Math.Between(-16, 16);
            ball.y = y - Phaser.Math.Between(4, 18);
            var br = Phaser.Math.Between(6, 11);
            if (window.Paper && Paper.drawCrumple) {
                Paper.drawCrumple(ball, 0, 0, br, color, (Math.round(ball.x) * 9 + i * 31) >>> 0);
            } else {
                ball.fillStyle(color, 0.9);
                ball.fillCircle(0, 0, br);
            }
            this.tweens.add({
                targets: ball,
                y: y + Phaser.Math.Between(18, 42),
                x: ball.x + Phaser.Math.Between(-8, 8),
                scale: 0.35,
                alpha: 0,
                duration: Phaser.Math.Between(280, 420),
                ease: 'Quad.easeIn',
                onComplete: function (tw, targets) { targets[0].destroy(); }
            });
        }
    }

    _basketBurst(data) {
        var paletteColor = this.palette[data.color] || 0x72f5ff;
        var color = typeof paletteColor === 'number'
            ? paletteColor
            : Phaser.Display.Color.HexStringToColor(paletteColor).color;
        var target = (data.x !== undefined && data.y !== undefined)
            ? { x: data.x, y: data.y }
            : this.getVialTarget(data.vialId);
        if (!target) return;
        var count = GameSettings.reducedMotion() ? 4 : 12;
        var i;
        for (i = 0; i < count; i++) {
            var w = Phaser.Math.Between(5, 9);
            var h = Phaser.Math.Between(10, 18);
            var bit = this.add.rectangle(target.x, target.y - 18, w, h, i % 3 ? color : 0xf7f1e6, 0.95)
                .setDepth(46)
                .setAngle(Phaser.Math.Between(-40, 40));
            this.tweens.add({
                targets: bit,
                x: target.x + Phaser.Math.Between(-54, 54),
                y: target.y - Phaser.Math.Between(36, 92),
                angle: bit.angle + Phaser.Math.Between(-180, 180),
                alpha: 0,
                duration: Phaser.Math.Between(320, 520),
                ease: 'Quad.easeOut',
                onComplete: function (tw, targets) { targets[0].destroy(); }
            });
        }
    }

    getVialTarget(vialId) {
        for (var i = 0; i < this.vialSlots.length; i++) {
            if (this.vialSlots[i].vialId === vialId) {
                var slot = this.vialSlots[i];
                return {
                    x: slot.x,
                    y: slot.y - slot.h * 0.42
                };
            }
        }
        return null;
    }

    _openRewardMenu() {
        if (this.rewardModal || this.endOverlay) return;
        if (this.scene.isActive('Pause')) return;
        var game = this.scene.get('Game');
        if (!game || game.gameOver) return;
        var options = game.getRewardOptions();
        if (!options.length) return;
        this.scene.pause('Game');

        var W = this.scale.width;
        var H = this.scale.height;
        var self = this;
        var modal = this.add.container(0, 0).setDepth(100);
        modal.setAlpha(GameSettings.reducedMotion() ? 1 : 0);
        this.rewardModal = modal;
        this.rewardWatching = false;
        this.rewardButtons = [];

        var shade = this.add.rectangle(
            W / 2, H / 2, W, H, 0x2a3a62, 0.55
        ).setInteractive();
        modal.add(shade);
        modal.add(this.add.rectangle(
            W / 2, H * 0.48, 620, 780, 0x20264a, 1
        ).setStrokeStyle(4, 0xffffff, 0.18));
        this.rewardTitle = this.add.text(W / 2, 185, 'ВЫБЕРИ НАГРАДУ', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '43px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        modal.add(this.rewardTitle);
        modal.add(this.add.text(
            W / 2,
            245,
            'каждый вариант требует просмотра рекламы',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '21px',
                color: '#aeb7e8'
            }
        ).setOrigin(0.5));

        options.forEach(function (option, index) {
            var button = new UIButton(
                self,
                W / 2,
                355 + index * 145,
                '📺  ' + option.label,
                function () {
                    self._watchReward(option.offerId);
                },
                {
                    width: 540,
                    height: 105,
                    fontSize: 25,
                    color: option.color
                }
            );
            self.rewardButtons.push(button);
            modal.add(button);
        });

        var close = new UIButton(this, W / 2, 835, 'ЗАКРЫТЬ', function () {
            self._closeRewardMenu();
        }, { width: 320, height: 86, fontSize: 28, color: 0x555d8f });
        modal.add(close);
        if (!GameSettings.reducedMotion()) {
            this.tweens.add({
                targets: modal,
                alpha: 1,
                duration: 180,
                ease: 'Quad.easeOut'
            });
        }
    }

    _watchReward(offerId) {
        if (this.rewardWatching) return;
        var game = this.scene.get('Game');
        if (!game) return;
        this.rewardWatching = true;
        this.rewardTitle.setText('РЕКЛАМА...');
        for (var i = 0; i < this.rewardButtons.length; i++) {
            this.rewardButtons[i].hit.disableInteractive();
        }
        game.claimReward(offerId).then(function (option) {
            if (!this.scene || !this.sys.isActive()) return;
            if (option) {
                this.rewardWatching = false;
                this._closeRewardMenu();
                return;
            }
            this.rewardWatching = false;
            this.rewardTitle.setText('РЕКЛАМА НЕДОСТУПНА');
            for (var i = 0; i < this.rewardButtons.length; i++) {
                this.rewardButtons[i].hit.setInteractive({
                    useHandCursor: true
                });
            }
        }.bind(this));
    }

    _closeRewardMenu(force) {
        if (this.rewardWatching && !force) return;
        if (!this.rewardModal) return;
        this.rewardWatching = false;
        this.rewardModal.destroy(true);
        this.rewardModal = null;
        this.rewardButtons = [];
        this.rewardTitle = null;
        var game = this.scene.get('Game');
        if (game && this.scene.isPaused('Game') &&
            !this.scene.isActive('Pause')) {
            this.scene.resume('Game');
        }
        if (game && game._lockStickUntilRelease) game._lockStickUntilRelease();
    }

    _onRewardGranted(data) {
        var text = this.add.text(
            this.scale.width / 2,
            250,
            'НАГРАДА: ' + data.label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '27px',
                fontStyle: 'bold',
                color: '#ffd24a',
                stroke: '#17203c',
                strokeThickness: 5
            }
        ).setOrigin(0.5).setDepth(90);
        this.tweens.add({
            targets: text,
            y: 205,
            alpha: 0,
            duration: 1000,
            onComplete: function () { text.destroy(); }
        });
    }

    update(t, dt) {
        var dts = dt / 1000;
        for (var i = 0; i < this.vialSlots.length; i++) {
            if (this.vialSlots[i].gfx.visible) this.vialSlots[i].update(dts);
        }
        var game = this.scene.get('Game');
        var p = game && game.player;
        var show = !!(p && !game.gameOver);
        this._syncPlayerHud(p, show);
    }

    _syncPlayerHud(p, show) {
        var isCircle = !!(p && p.skin && p.skin.shape === 'circle');
        var underHud = !!(show && p && p.y < 190);
        if (this.playerMark) this.playerMark.setVisible(show && isCircle);
        if (this.playerHalo) this.playerHalo.setVisible(show && isCircle);
        if (show && isCircle) {
            this.playerMark.setPosition(p.x, p.y);
            this.playerHalo.setPosition(p.x, p.y);
        }
        if (p && p.dot) p.dot.setVisible(show && !isCircle);
        if (p && p.glow) p.glow.setVisible(show && !isCircle);

        var needHud = show && !isCircle && underHud && !this.endOverlay;
        if (!needHud) {
            if (this.playerHud) this.playerHud.setVisible(false);
            return;
        }
        if (!this.playerHud && p.copyVisual) {
            this.playerHud = p.copyVisual(this);
        }
        if (!this.playerHud) return;
        this.playerHud.setVisible(true);
        this.playerHud.setPosition(p.x, p.y);
        this.playerHud.setRotation(p.facing || 0);
    }

    _pauseButton(x, y) {
        var self = this;
        var btn = this.add.container(x, y).setDepth(36);
        var bg = this.add.graphics();
        if (window.Paper && Paper.drawDisc) {
            Paper.drawDisc(bg, 0, 0, 40, 0xe6d8c0, 55);
            bg.fillStyle(0x6a4a32, 1);
            bg.fillRect(-13, -14, 9, 28);
            bg.fillRect(4, -14, 9, 28);
        } else if (window.Paper && Paper.drawScrap) {
            Paper.drawScrap(bg, 0, 0, 86, 86, 0xe6d8c0, 55, {
                jag: 6, shadowX: 12, shadowY: 16, fibers: true
            });
        } else {
            bg.fillStyle(0xe6d8c0, 1);
            bg.fillCircle(0, 0, 40);
        }
        var hit = this.add.rectangle(0, 0, 90, 90, 0x000000, 0);
        hit.setInteractive({ useHandCursor: true });
        btn.add([bg, hit]);
        this.pauseHit = hit;
        this.pauseBtn = btn;
        this.pausePressed = false;
        hit.on('pointerdown', function () {
            self.pausePressed = true;
        });
        hit.on('pointerout', function () {
            self.pausePressed = false;
        });
        hit.on('pointerup', function () {
            if (!self.pausePressed) return;
            self.pausePressed = false;
            if (self.scene.isActive('Pause') || self.rewardModal || self.endOverlay) return;
            var game = self.scene.get('Game');
            if (!game || game.gameOver) return;
            if (game.stick && game.stick.active) return;
            if (window.AudioManager) AudioManager.playClick();
            if (game.stick) {
                game.stick.active = false;
                game.dir.x = 0;
                game.dir.y = 0;
            }
            self.scene.launch('Pause', { pack: self.packId, level: self.levelId });
            self.scene.pause('Game');
        });
    }

    showEndOverlay(opts) {
        opts = opts || {};
        this.hideEndOverlay();
        this._hideTutorial(true);
        this._closeRewardMenu(true);
        if (this.pauseHit && this.pauseHit.disableInteractive) {
            this.pauseHit.disableInteractive();
        }
        if (this.pauseBtn) this.pauseBtn.setVisible(false);
        if (this.adStub && this.adStub.hit && this.adStub.hit.disableInteractive) {
            this.adStub.hit.disableInteractive();
        }
        if (this.adStub) this.adStub.setVisible(false);
        if (this.stickGfx) this.stickGfx.clear();

        var W = this.scale.width;
        var H = this.scale.height;
        var self = this;
        var win = !!opts.win;
        var extra = opts.extra || {};

        var dimLayer = this.add.container(0, 0).setDepth(200).setAlpha(0);
        var dim = this.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0x0c254d, 0.78);
        dim.setInteractive();
        dimLayer.add(dim);
        this.endDim = dimLayer;

        var overlay = this.add.container(0, 0).setDepth(210).setAlpha(0);
        this.endOverlay = overlay;

        var scrapW = extra.finale ? 620 : (extra.campaignCta ? 620 : (extra.subtitle ? 600 : 560));
        var scrapH = extra.finale ? 220 : (extra.campaignCta ? 200 : (extra.subtitle ? 180 : 140));
        var scrap = this.add.graphics();
        if (window.Paper && Paper.drawScrap) {
            Paper.drawScrap(
                scrap,
                0,
                0,
                scrapW,
                scrapH,
                0xe6d8c0,
                77,
                { jag: 9, shadowX: 16, shadowY: 22, fibers: 'light' }
            );
        } else {
            scrap.fillStyle(0xe6d8c0, 1);
            scrap.fillRoundedRect(-scrapW / 2, -scrapH / 2, scrapW, scrapH, 18);
        }
        var scrapY = extra.finale ? H * 0.28 : H * 0.32;
        scrap.setPosition(W / 2, scrapY);
        overlay.add(scrap);

        var titleY = extra.finale ? H * 0.24 : (extra.campaignCta || extra.subtitle ? H * 0.3 : H * 0.32);
        var titleSize = extra.subtitle || extra.campaignCta ? '48px' : '56px';
        var titleText = this.add.text(W / 2, titleY, opts.title || '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: titleSize,
            fontStyle: 'bold',
            color: '#3d2a22',
            align: 'center',
            wordWrap: { width: 520 }
        }).setOrigin(0.5).setScale(0.72);
        overlay.add(titleText);
        if (win) this._popWinStars(overlay, W / 2, titleY - 78);
        if (win) this._startWinSerpentine();
        if (extra.subtitle) {
            overlay.add(this.add.text(W / 2, extra.finale ? H * 0.345 : H * 0.385, extra.subtitle, {
                fontFamily: 'Arial, sans-serif',
                fontSize: extra.finale ? '26px' : '28px',
                color: '#5a4638',
                align: 'center',
                wordWrap: { width: 520 }
            }).setOrigin(0.5));
        }

        var overlayButtons = [];
        var addOverlayButton = function (btn) {
            overlay.add(btn);
            overlayButtons.push(btn);
            return btn;
        };
        var go = function (fn) {
            return function () {
                var g = self.scene.get('Game');
                if (!g) return;
                fn(g);
            };
        };

        if (opts.continueOffer) {
            var offer = opts.continueOffer;
            var adBtn = addOverlayButton(new UIButton(this, W / 2, H * 0.48, offer.label, function () {
                if (!adBtn.hit.input || !adBtn.hit.input.enabled) return;
                adBtn.hit.disableInteractive();
                adBtn.setLabel('РЕКЛАМА...');
                var g = self.scene.get('Game');
                if (!g || !g._claimContinue) return;
                g._claimContinue(offer.kind).then(function (completed) {
                    if (!completed && adBtn.scene) {
                        adBtn.setLabel('РЕКЛАМА НЕДОСТУПНА');
                    }
                });
            }, { width: 570, color: 0xd28e43, fontSize: 27, interactive: false }));
        }

        var retryY = extra.campaignCta ? 0.48 : (win ? 0.5 : (opts.continueOffer ? 0.62 : 0.52));
        addOverlayButton(new UIButton(this, W / 2, H * retryY, 'ЗАНОВО', go(function (g) {
            g.scene.restart({ pack: g.packId, level: g.levelId });
        }), { width: 440, color: 0x477ab4, interactive: false }));

        if (extra.campaignCta) {
            addOverlayButton(new UIButton(this, W / 2, H * 0.62, 'ПЕРЕЙТИ К ОСНОВНОЙ КАМПАНИИ', go(function (g) {
                g.scene.start('LevelSelect', { pack: 'campaign' });
            }), { width: 620, color: 0x47a798, fontSize: 26, interactive: false }));
        } else {
            var nextLabel = extra.finale ? 'В МЕНЮ' : (win ? 'ДАЛЬШЕ' : 'В МЕНЮ');
            addOverlayButton(new UIButton(this, W / 2, H * (win ? 0.62 : (opts.continueOffer ? 0.74 : 0.64)), nextLabel, go(function (g) {
                if (win && !extra.finale) {
                    var next = LevelManager.get(g, g.levelId + 1, g.packId);
                    if (next) g.scene.start('Game', { pack: g.packId, level: next.id });
                    else g.scene.start('LevelSelect', { pack: g.packId });
                } else {
                    g.scene.start('Menu');
                }
            }), { width: 440, color: 0x47a798, interactive: false }));
        }

        this._armOverlayButtons(overlay, overlayButtons);
        this.tweens.add({
            targets: [dimLayer, overlay],
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
        if (!win) {
            this.time.delayedCall(GameSettings.reducedMotion() ? 40 : 420, function () {
                if (!self.endOverlay) return;
                self._slamLoseStamp(overlay, W / 2, scrapY - scrapH * 0.5 + 4);
            });
        }
    }

    _slamLoseStamp(overlay, cx, cy) {
        var stamp = this.add.container(cx, cy);
        overlay.add(stamp);
        var g = this.add.graphics();
        if (window.Paper && Paper.drawScrap) {
            Paper.drawScrap(g, 0, 0, 188, 64, 0xc45c48, 23, {
                jag: 7,
                shadowX: 8,
                shadowY: 10,
                fibers: true
            });
        } else {
            g.fillStyle(0xc45c48, 1);
            g.fillRoundedRect(-94, -32, 188, 64, 10);
        }
        stamp.add(g);
        stamp.add(this.add.text(0, 0, 'НЕ ВЫШЛО', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#3d2218'
        }).setOrigin(0.5));
        stamp.setAngle(-14);
        if (window.AudioManager && AudioManager.playStamp) AudioManager.playStamp();
        this._spawnLoseScraps(overlay, cx, cy);
        if (GameSettings.reducedMotion()) {
            stamp.setScale(1);
            return;
        }
        stamp.setScale(2.2);
        stamp.y = cy - 28;
        this.tweens.add({
            targets: stamp,
            scale: 1,
            y: cy,
            duration: 260,
            ease: 'Back.easeOut'
        });
        this.tweens.add({
            targets: stamp,
            angle: -9,
            duration: 380,
            ease: 'Bounce.easeOut'
        });
        this.cameras.main.shake(90, 0.006);
    }

    _spawnLoseScraps(overlay, cx, cy) {
        var n = GameSettings.reducedMotion() ? 3 : 7;
        var i;
        for (i = 0; i < n; i++) {
            var bit = this.add.graphics();
            var w = Phaser.Math.Between(18, 36);
            var h = Phaser.Math.Between(12, 22);
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(bit, 0, 0, w, h, i % 2 ? 0xe6d8c0 : 0xc9b89a, 40 + i, {
                    jag: 5,
                    shadowX: 6,
                    shadowY: 8,
                    fibers: false
                });
            } else {
                bit.fillStyle(0xe6d8c0, 1);
                bit.fillRect(-w / 2, -h / 2, w, h);
            }
            bit.setPosition(cx, cy);
            overlay.add(bit);
            if (GameSettings.reducedMotion()) {
                bit.setAlpha(0.7);
                continue;
            }
            this.tweens.add({
                targets: bit,
                x: cx + Phaser.Math.Between(-180, 180),
                y: cy + Phaser.Math.Between(40, 160),
                angle: Phaser.Math.Between(-80, 80),
                alpha: 0,
                duration: Phaser.Math.Between(520, 820),
                ease: 'Cubic.easeOut',
                onComplete: function (tw, tgt) { tgt[0].destroy(); }
            });
        }
    }

    _popWinStars(overlay, cx, cy) {
        if (!window.Paper || !Paper.drawStar) return;
        var reduced = GameSettings.reducedMotion();
        var sizes = [20, 28, 20];
        var xs = [cx - 102, cx, cx + 102];
        var self = this;
        var i;
        for (i = 0; i < 3; i++) {
            var star = this.add.graphics();
            Paper.drawStar(star, 0, 0, sizes[i], 41 + i);
            star.setPosition(xs[i], cy);
            overlay.add(star);
            if (reduced) {
                star.setScale(1);
                continue;
            }
            star.setScale(0);
            this.tweens.add({
                targets: star,
                scale: 1.32,
                duration: 280,
                delay: 160 + i * 140,
                ease: 'Back.easeOut',
                onComplete: function (tw, targets) {
                    if (!targets[0].scene) return;
                    self.tweens.add({
                        targets: targets[0],
                        scale: 1,
                        duration: 180,
                        ease: 'Back.easeOut'
                    });
                }
            });
        }
    }

    _startWinSerpentine() {
        this._stopWinSerpentine();
        this._serpentineBits = [];
        var self = this;
        var spawn = function (burst) {
            if (!self.sys || !self.sys.isActive() || !self.endOverlay) return;
            var W = self.scale.width;
            var H = self.scale.height;
            var colors = [0xde3449, 0x1f7fd7, 0xf0c107, 0x47a798, 0xd28e43, 0xf3ead8, 0x8960a0];
            var n = burst ? 10 : 3;
            var i;
            for (i = 0; i < n; i++) {
                var bit = self.add.rectangle(
                    Phaser.Math.Between(30, W - 30),
                    burst ? Phaser.Math.Between(-40, 80) : -24,
                    Phaser.Math.Between(8, 16),
                    Phaser.Math.Between(22, 46),
                    Phaser.Utils.Array.GetRandom(colors)
                ).setDepth(208).setAngle(Phaser.Math.Between(-50, 50));
                self._serpentineBits.push(bit);
                self.tweens.add({
                    targets: bit,
                    y: H + 50,
                    x: bit.x + Phaser.Math.Between(-90, 90),
                    angle: bit.angle + Phaser.Math.Between(-240, 240),
                    duration: Phaser.Math.Between(1700, 3200),
                    ease: 'Sine.easeIn',
                    onComplete: function (tw, targets) {
                        var obj = targets[0];
                        var list = self._serpentineBits;
                        if (list) {
                            var idx = list.indexOf(obj);
                            if (idx >= 0) list.splice(idx, 1);
                        }
                        obj.destroy();
                    }
                });
            }
        };
        if (GameSettings.reducedMotion()) {
            spawn(true);
            return;
        }
        spawn(true);
        this._serpentineEvent = this.time.addEvent({
            delay: 240,
            loop: true,
            callback: function () { spawn(false); }
        });
    }

    _stopWinSerpentine() {
        if (this._serpentineEvent) {
            this._serpentineEvent.remove(false);
            this._serpentineEvent = null;
        }
        if (this._serpentineBits) {
            var i;
            for (i = 0; i < this._serpentineBits.length; i++) {
                if (this._serpentineBits[i] && this._serpentineBits[i].destroy) {
                    this._serpentineBits[i].destroy();
                }
            }
            this._serpentineBits = [];
        }
    }

    hideEndOverlay() {
        this._stopWinSerpentine();
        if (this.endOverlay) {
            this.endOverlay.destroy(true);
            this.endOverlay = null;
        }
        if (this.endDim) {
            this.endDim.destroy(true);
            this.endDim = null;
        }
        if (this.pauseBtn && this.pauseBtn.scene) {
            this.pauseBtn.setVisible(true);
        }
        if (this.pauseHit && this.pauseHit.scene) {
            this.pauseHit.setInteractive({ useHandCursor: true });
        }
        if (this.adStub && this.adStub.scene) {
            this.adStub.setVisible(true);
        }
        if (this.adStub && this.adStub.hit && this.adStub.hit.scene) {
            this.adStub.hit.setInteractive({ useHandCursor: true });
        }
        var game = this.scene.get('Game');
        if (game && game._lockStickUntilRelease) game._lockStickUntilRelease();
        else if (game && game._resetStick) game._resetStick();
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
            var i;
            for (i = 0; i < buttons.length; i++) {
                if (buttons[i] && buttons[i].arm) buttons[i].arm();
            }
        };
        var anyPointerDown = function () {
            var pointers = self.input.manager.pointers;
            var i;
            for (i = 0; i < pointers.length; i++) {
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
