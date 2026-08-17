import { Vial } from '../entities/Vial.js?v=1.3.0';
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

        this.livesText = this.add.text(40, 78, '❤ ❤ ❤', {
            fontFamily: 'Arial, sans-serif', fontSize: '34px', color: '#ff5c7a'
        });
        this.effectsText = this.add.text(40, 116, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#b9fbff',
            lineSpacing: 4
        }).setDepth(34);
        this.effectsBg = this.add.graphics().setDepth(33);
        this.objectiveText = this.add.text(W / 2, 46, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5, 0);
        this.objectiveBars = this.add.graphics().setDepth(34);
        this.bossBar = this.add.graphics().setDepth(35).setVisible(false);
        this.bossText = this.add.text(W / 2, 82, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffb5df'
        }).setOrigin(0.5).setDepth(36).setVisible(false);

        this._pauseButton(W - 70, 70);

        this.vialSlots = [];
        var slotY = H - 210;
        var xs = [W / 2 - 140, W / 2, W / 2 + 140];
        for (var i = 0; i < 3; i++) {
            this.vialSlots.push(new Vial(this, xs[i], slotY, 'red', this.palette));
        }

        var hintText = (level && level.hint) || '';
        if (!hintText && this.packId !== 'campaign') {
            hintText = 'заполни пробирки, нарезая цвета';
        }
        this.hint = this.add.text(W / 2, H - 56, hintText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: '#8b93c9',
            align: 'center',
            wordWrap: { width: 480 }
        }).setOrigin(0.5);
        if (!hintText) this.hint.setVisible(false);

        this.adStub = new UIButton(this, W - 130, H - 70, '📺', function () {
            self._openRewardMenu();
        }, { width: 88, height: 72, fontSize: 32, color: 0x3a3f6a });

        this.game.events.on('game:ready', this._onReady, this);
        this.game.events.on('game:vials-changed', this._onVials, this);
        this.game.events.on('game:lives-changed', this._onLives, this);
        this.game.events.on('game:effects-changed', this._onEffects, this);
        this.game.events.on('game:booster-picked', this._onBoosterPicked, this);
        this.game.events.on('game:enemy-action', this._onEnemyAction, this);
        this.game.events.on('game:objectives-changed', this._onObjectives, this);
        this.game.events.on('game:boss-changed', this._onBoss, this);
        this.game.events.on('game:reward-granted', this._onRewardGranted, this);
        this.game.events.on('game:splash', this._onSplash, this);
        this.game.events.on('game:vial-pop', this._onVialPop, this);
        this.game.events.on('game:tutorial', this._onTutorial, this);
        this.game.events.on('game:tutorial-dismiss', this._onTutorialDismiss, this);
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
        this.game.events.off('game:splash', this._onSplash, this);
        this.game.events.off('game:vial-pop', this._onVialPop, this);
        this.game.events.off('game:tutorial', this._onTutorial, this);
        this.game.events.off('game:tutorial-dismiss', this._onTutorialDismiss, this);
        this.game.events.off('game:over', this._onGameOver, this);
        if (this.tutorialCard) {
            this.tutorialCard.destroy(true);
            this.tutorialCard = null;
        }
        this.tutorialPersist = null;
        (this.vialSlots || []).forEach(function (v) { v.destroy(); });
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
        var text = this.add.text(0, 0, data.text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 560 }
        }).setOrigin(0.5);
        var cardH = Math.max(150, text.height + 48);
        var card = this.add.container(W / 2, 210).setDepth(80);
        var bg = this.add.rectangle(0, 0, 620, cardH, 0x11142d, 0.94)
            .setStrokeStyle(3, 0x72f5ff, 0.55);
        card.add([bg, text]);
        card.setAlpha(0);
        this.tutorialCard = card;
        this.tutorialPersist = persist;
        this.tweens.add({
            targets: card,
            alpha: 1,
            y: 190,
            duration: GameSettings.reducedMotion() ? 80 : 220,
            ease: 'Quad.easeOut'
        });
    }

    _onGameOver() {
        this._hideTutorial(true);
    }

    _onTutorialDismiss(data) {
        var reason = data && data.reason;
        if (!this.tutorialCard) return;
        if (this.tutorialPersist === 'until-move' && reason === 'move') {
            this._hideTutorial(false);
        } else if (this.tutorialPersist === 'until-draw' && reason === 'draw') {
            this._hideTutorial(false);
        }
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
        var s = '';
        for (var i = 0; i < data.lives; i++) s += '❤ ';
        this.livesText.setText(s.trim() || '—');
        if (this.lastLives !== undefined && this.lastLives !== data.lives) {
            this.tweens.killTweensOf(this.livesText);
            this.livesText
                .setScale(1.35)
                .setAngle(data.lives < this.lastLives ? -5 : 5)
                .setColor(data.lives < this.lastLives ? '#ffffff' : '#72ffba');
            this.tweens.add({
                targets: this.livesText,
                scale: 1,
                angle: 0,
                duration: 360,
                ease: 'Back.easeOut',
                onComplete: function () {
                    if (this.livesText) this.livesText.setColor('#ff5c7a');
                }.bind(this)
            });
        }
        this.lastLives = data.lives;
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
        var text = this.add.text(W / 2, 190, data.label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '30px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#17203c',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: text,
            y: 155,
            alpha: 0,
            duration: 850,
            onComplete: function () { text.destroy(); }
        });
    }

    _onEnemyAction(data) {
        var W = this.scale.width;
        var text = this.add.text(W / 2, 220, data.label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '27px',
            fontStyle: 'bold',
            color: '#ffcf5c',
            stroke: '#17203c',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: text,
            y: 180,
            alpha: 0,
            duration: 900,
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
            this.objectiveText.setColor('#ffffff');
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
            var barY = 94;
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
            this.bossBar.fillRoundedRect(W / 2 - width / 2, 96, width, 16, 8);
            this.bossBar.fillStyle(ratio > 0.5 ? 0xff5ca8 : 0xff365f, 1);
            this.bossBar.fillRoundedRect(
                W / 2 - width / 2,
                96,
                Math.max(0, width * ratio),
                16,
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
        var shown = snap.displayed || [];
        for (var i = 0; i < 3; i++) {
            var slot = this.vialSlots[i];
            if (i < shown.length) {
                var previousId = slot.vialId;
                var isNewVial = slot.vialId !== shown[i].id;
                slot.vialId = shown[i].id;
                slot.setColor(shown[i].color, this.palette);
                slot.setFill(shown[i].fill, isNewVial);
                slot.setRemainingCount(shown[i].remainingOfColor);
                slot.gfx.setVisible(true);
                slot.icon.setVisible(true);
                slot.label.setVisible(true);
                if (isNewVial && previousId !== shown[i].id) {
                    slot.appear();
                }
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
        var target = this.getVialTarget(data.vial.id);
        if (!target) return;
        GameSettings.vibrate([12, 20, 18]);
        var paletteColor = this.palette[data.vial.color] || 0xffffff;
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
        this._onSplash({
            color: data.vial.color,
            x: target.x,
            y: target.y
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
            y: this.scale.height - 210
        };
        var x = target.x;
        var y = target.y;
        var dropCount = GameSettings.reducedMotion() ? 3 : 8;
        for (var i = 0; i < dropCount; i++) {
            var drop = this.add.circle(
                x + Phaser.Math.Between(-18, 18),
                y,
                Phaser.Math.Between(3, 7),
                color,
                0.9
            ).setDepth(38).setBlendMode(Phaser.BlendModes.ADD);
            var angle = Phaser.Math.FloatBetween(Math.PI * 1.12, Math.PI * 1.88);
            var distance = Phaser.Math.Between(34, 82);
            this.tweens.add({
                targets: drop,
                x: drop.x + Math.cos(angle) * distance,
                y: drop.y + Math.sin(angle) * distance,
                scale: 0.25,
                alpha: 0,
                duration: Phaser.Math.Between(280, 430),
                ease: 'Quad.easeOut',
                onComplete: function (tw, targets) { targets[0].destroy(); }
            });
        }
    }

    getVialTarget(vialId) {
        for (var i = 0; i < this.vialSlots.length; i++) {
            if (this.vialSlots[i].vialId === vialId) {
                return {
                    x: this.vialSlots[i].x,
                    y: this.vialSlots[i].y
                };
            }
        }
        return null;
    }

    _openRewardMenu() {
        if (this.rewardModal) return;
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
            W / 2, H / 2, W, H, 0x080a20, 0.88
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
    }

    _pauseButton(x, y) {
        var self = this;
        var btn = this.add.container(x, y);
        var bg = this.add.circle(0, 0, 40, 0x000000, 0.35);
        var icon = this.add.text(0, 0, '⏸', { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
        var hit = this.add.rectangle(0, 0, 90, 90, 0x000000, 0);
        hit.setInteractive({ useHandCursor: true });
        btn.add([bg, icon, hit]);
        hit.on('pointerup', function () {
            if (self.scene.isActive('Pause') || self.rewardModal) return;
            if (window.AudioManager) AudioManager.playClick();
            var game = self.scene.get('Game');
            if (!game || game.gameOver) return;
            self.scene.launch('Pause', { pack: self.packId, level: self.levelId });
            self.scene.pause('Game');
        });
    }
}
