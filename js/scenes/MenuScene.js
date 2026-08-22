/*
 * MenuScene — стартовое меню.
 * Обучение, кампания, скины и настройки.
 */
(function () {
    'use strict';

    function trainingLevelCount(scene) {
        var root = scene.cache.json.get('levels');
        var levels = (root && root.levels) || [];
        var n = 0;
        var i;
        for (i = 0; i < levels.length; i++) {
            if ((levels[i].pack || 'training') === 'training') n++;
        }
        return n;
    }

    function campaignOpen(scene) {
        if (GameSettings.isCampaignUnlocked()) return true;
        var need = trainingLevelCount(scene);
        if (need > 0 && GameSettings.completedInPack('training') >= need) {
            GameSettings.unlockCampaign();
            return true;
        }
        return false;
    }

    function packLevelCount(scene, packId) {
        var root = scene.cache.json.get('levels');
        var levels = (root && root.levels) || [];
        var n = 0;
        var i;
        for (i = 0; i < levels.length; i++) {
            if ((levels[i].pack || 'training') === packId) n++;
        }
        return n;
    }

    function secretEnabled() {
        return window.SecretPack && SecretPack.enabled;
    }

    function secretOpen(scene) {
        if (!secretEnabled()) return false;
        if (window.QAMode && QAMode.enabled) return true;
        if (GameSettings.isSecretUnlocked && GameSettings.isSecretUnlocked()) return true;
        var need = packLevelCount(scene, 'campaign');
        if (need > 0 && GameSettings.completedInPack('campaign') >= need) {
            GameSettings.unlockSecret();
            return true;
        }
        return false;
    }

    function menuToast(scene, msg) {
        var W = scene.scale.width;
        var t = scene.add.text(W / 2, scene.scale.height * 0.29, msg, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffd24a',
            stroke: '#0c254d',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(40);
        scene.tweens.add({
            targets: t,
            y: t.y - 24,
            alpha: 0,
            delay: 900,
            duration: 420,
            onComplete: function () { t.destroy(); }
        });
    }

    var MenuScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function MenuScene() {
            Phaser.Scene.call(this, { key: 'Menu' });
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;
            if (window.SecretPack && SecretPack.mergeInto) {
                SecretPack.mergeInto(this.cache.json.get('levels'));
            }

            Background.create(this);
            if (window.AudioManager) {
                if (AudioManager.stopFinale) AudioManager.stopFinale();
                if (AudioManager.stopCritters) AudioManager.stopCritters();
                if (AudioManager.startMusic) AudioManager.startMusic('normal');
                if (!GameSettings.get('musicOn') && AudioManager.stopMusic) {
                    AudioManager.stopMusic();
                }
            }

            if (window.Paper && Paper.cutTitle) {
                Paper.cutTitle(this, W / 2, H * 0.115, 'PAPERCUT', 78);
            } else {
                this.add.text(W / 2, H * 0.12, 'PAPERCUT', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '78px',
                    fontStyle: 'bold',
                    color: '#f7f1e4'
                }).setOrigin(0.5);
            }

            this.add.text(W / 2, H * 0.115 + 58, 'нарезай цвета • комкай в корзины', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#d8cbb4'
            }).setOrigin(0.5).setDepth(7);

            var cx = W / 2;
            var showSecret = secretEnabled();
            var startY = showSecret ? H * 0.325 : H * 0.36;
            var gap = showSecret ? 98 : 112;
            var btnH = showSecret ? 86 : 92;
            var campaignUnlocked = campaignOpen(this);
            var mysteryOpen = secretOpen(this);

            new UIButton(this, cx, startY, campaignUnlocked ? 'КАМПАНИЯ' : 'КАМПАНИЯ 🔒', function () {
                if (!campaignOpen(this)) return;
                this.scene.start('LevelSelect', { pack: 'campaign' });
            }.bind(this), {
                width: 420,
                height: btnH,
                fontSize: 38,
                color: 0x477ab4,
                enabled: campaignUnlocked
            }).setDepth(26);

            new UIButton(this, cx, startY + gap, 'ОБУЧЕНИЕ', function () {
                this.scene.start('LevelSelect', { pack: 'training' });
            }.bind(this), { width: 420, height: btnH, fontSize: 38, color: 0x47a798 }).setDepth(25);

            var extra = 0;
            if (showSecret) {
                extra = 1;
                var mysteryBtn = new UIButton(this, cx, startY + gap * 2, mysteryOpen ? '???' : '??? 🔒', function () {
                    if (!secretOpen(this)) {
                        if (window.AudioManager) AudioManager.playBack();
                        menuToast(this, 'Пройдите кампанию');
                        return;
                    }
                    this.scene.start('LevelSelect', { pack: 'secret' });
                }.bind(this), {
                    width: 420,
                    height: btnH,
                    fontSize: 38,
                    color: 0x3d2a55
                }).setDepth(24);
                if (!mysteryOpen) mysteryBtn.setAlpha(0.46);
            }

            new UIButton(this, cx, startY + gap * (2 + extra), 'СКИНЫ', function () {
                this.scene.start('SkinSelect');
            }.bind(this), { width: 420, height: btnH, fontSize: 38, color: 0x8960a0 }).setDepth(23);

            new UIButton(this, cx, startY + gap * (3 + extra), 'КАК ИГРАТЬ', function () {
                this.scene.start('HowTo');
            }.bind(this), { width: 420, height: btnH, fontSize: 38, color: 0xb95c6b }).setDepth(22);

            new UIButton(this, cx, startY + gap * (4 + extra), 'НАСТРОЙКИ', function () {
                this.scene.start('Settings');
            }.bind(this), { width: 420, height: btnH, fontSize: 38, color: 0x475467 }).setDepth(21);

            this.add.text(W / 2, H - 36, 'v1.7.40 paper cut • Phaser 3', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#9aa3c4'
            }).setOrigin(0.5);
        }
    });

    window.MenuScene = MenuScene;
})();
