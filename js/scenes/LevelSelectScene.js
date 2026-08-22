/*
 * LevelSelectScene — выбор уровня внутри пака (кампания, обучение, лаборатория).
 */
(function () {
    'use strict';

    var LevelSelectScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function LevelSelectScene() {
            Phaser.Scene.call(this, { key: 'LevelSelect' });
        },

        init: function (data) {
            this.packId = (data && data.pack) || 'campaign';
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;
            var self = this;
            if (window.SecretPack && SecretPack.mergeInto) {
                SecretPack.mergeInto(this.cache.json.get('levels'));
            }
            var meta = {
                campaign: { title: 'КАМПАНИЯ', subtitle: 'основные уровни' },
                training: { title: 'ОБУЧЕНИЕ', subtitle: 'знакомство с механиками' },
                lab: { title: 'ЛАБОРАТОРИЯ', subtitle: 'черновики и стенды механик' },
                secret: { title: '???', subtitle: 'сюда после кампании' }
            }[this.packId] || { title: 'УРОВНИ', subtitle: '' };

            Background.create(this);
            if (window.AudioManager && AudioManager.startMusic) {
                if (AudioManager.stopCritters) AudioManager.stopCritters();
                AudioManager.startMusic('normal');
                if (!GameSettings.get('musicOn') && AudioManager.stopMusic) {
                    AudioManager.stopMusic();
                }
            }

            this.add.text(W / 2, H * 0.08, meta.title, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '56px',
                fontStyle: 'bold',
                color: '#f3ead8'
            }).setOrigin(0.5);

            this.add.text(W / 2, H * 0.08 + 52, meta.subtitle, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#d7c4a8'
            }).setOrigin(0.5);

            var levels = this.cache.json.get('levels').levels.filter(function (level) {
                return (level.pack || 'training') === self.packId;
            }).sort(function (a, b) { return a.id - b.id; });

            var qaEnabled = window.QAMode && QAMode.enabled;
            if (this.packId === 'campaign' && !qaEnabled && !GameSettings.isCampaignUnlocked()) {
                this.scene.start('Menu');
                return;
            }
            if (this.packId === 'secret') {
                if (!window.SecretPack || !SecretPack.enabled) {
                    this.scene.start('Menu');
                    return;
                }
                if (!qaEnabled && !(GameSettings.isSecretUnlocked && GameSettings.isSecretUnlocked())) {
                    var campaignN = 0;
                    var li;
                    for (li = 0; li < this.cache.json.get('levels').levels.length; li++) {
                        if ((this.cache.json.get('levels').levels[li].pack || '') === 'campaign') {
                            campaignN++;
                        }
                    }
                    if (campaignN > 0 && GameSettings.completedInPack('campaign') >= campaignN) {
                        GameSettings.unlockSecret();
                    } else {
                        this.scene.start('Menu');
                        return;
                    }
                }
            }
            if (qaEnabled) {
                this.add.text(W / 2, H * 0.16, 'QA MODE • прогресс не изменён', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '20px',
                    fontStyle: 'bold',
                    color: '#ffb14a'
                }).setOrigin(0.5);
            }

            var COLS = levels.length > 24 ? 5 : (levels.length > 12 ? 4 : 3);
            var cell = levels.length > 24 ? 96 : (levels.length > 16 ? 112 : (levels.length > 9 ? 132 : 168));
            var spacing = levels.length > 24 ? 10 : (levels.length > 16 ? 16 : 28);
            var rows = Math.ceil(levels.length / COLS);
            var gridW = COLS * cell + (COLS - 1) * spacing;
            var gridH = rows * cell + (rows - 1) * spacing;
            var startX = W / 2 - gridW / 2 + cell / 2;
            var startY = H * (levels.length > 24 ? 0.175 : 0.22) + cell / 2;
            if (startY + gridH > H * 0.86) {
                startY = H * 0.18 + cell / 2;
            }

            for (var i = 0; i < levels.length; i++) {
                var level = levels[i];
                var col = i % COLS;
                var row = Math.floor(i / COLS);
                var x = startX + col * (cell + spacing);
                var y = startY + row * (cell + spacing);
                var unlocked = qaEnabled || this.packId === 'lab' ||
                    level.id <= GameSettings.unlockedInPack(this.packId);
                this._levelTile(x, y, cell, level, unlocked);
            }

            new UIButton(this, W / 2, H * 0.93, 'НАЗАД', function () {
                if (window.AudioManager) AudioManager.playBack();
                this.scene.start('Menu');
            }.bind(this), { width: 320, color: 0xb95c6b });
        },

        _levelTile: function (x, y, size, level, unlocked) {
            var self = this;
            var container = this.add.container(x, y);

            var bg = this.add.graphics();
            var color = unlocked ? 0x477ab4 : 0x475467;
            if (this.packId === 'lab' && unlocked) color = 0xd28e43;
            if (this.packId === 'campaign' && unlocked) color = 0x47a798;
            if (this.packId === 'secret' && unlocked) color = 0x3d2a55;
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(bg, 0, 0, size, size, color, 200 + level.id, {
                    jag: 6, shadowY: 14, fibers: true
                });
            } else {
                bg.fillStyle(0x0c101c, 0.3);
                bg.fillRoundedRect(-size / 2, -size / 2 + 5, size, size, 12);
                bg.fillStyle(color, 1);
                bg.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
            }
            container.add(bg);

            if (unlocked) {
                var num = this.add.text(0, -18, String(level.id), {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: size > 150 ? '48px' : (size > 120 ? '36px' : (size > 100 ? '28px' : '24px')),
                    fontStyle: 'bold',
                    color: '#f3ead8'
                }).setOrigin(0.5);
                container.add(num);
                var levelName = level.name || '';
                if (window.Paper && Paper.basketText) levelName = Paper.basketText(levelName);
                var name = this.add.text(0, 28, levelName, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: size > 110 ? '16px' : '13px',
                    color: '#f3ead8',
                    align: 'center',
                    wordWrap: { width: size - 16 }
                }).setOrigin(0.5, 0);
                container.add(name);
            } else {
                container.add(this.add.text(0, 0, '🔒', {
                    fontSize: '48px'
                }).setOrigin(0.5));
            }

            var hit = this.add.rectangle(0, 0, size, size, 0x000000, 0);
            hit.setInteractive({ useHandCursor: true });
            container.add(hit);

            hit.on('pointerover', function () {
                if (unlocked) container.setScale(1.05);
            });
            hit.on('pointerout', function () {
                container.setScale(1);
            });
            hit.on('pointerup', function () {
                container.setScale(1);
                if (unlocked) {
                    if (window.AudioManager) AudioManager.playClick();
                    self.scene.start('Game', {
                        pack: self.packId,
                        level: level.id
                    });
                } else if (window.AudioManager) {
                    AudioManager.playBack();
                    self.tweens.add({
                        targets: container,
                        x: x + 8,
                        duration: 60,
                        yoyo: true,
                        repeat: 3,
                        onComplete: function () { container.x = x; }
                    });
                }
            });
        }
    });

    window.LevelSelectScene = LevelSelectScene;
})();
