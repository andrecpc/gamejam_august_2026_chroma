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

    var MenuScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function MenuScene() {
            Phaser.Scene.call(this, { key: 'Menu' });
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;

            Background.create(this);
            if (window.AudioManager) {
                if (AudioManager.stopFinale) AudioManager.stopFinale();
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
            var startY = H * 0.36;
            var gap = 112;
            var campaignUnlocked = campaignOpen(this);

            new UIButton(this, cx, startY, campaignUnlocked ? 'КАМПАНИЯ' : 'КАМПАНИЯ 🔒', function () {
                if (!campaignOpen(this)) return;
                this.scene.start('LevelSelect', { pack: 'campaign' });
            }.bind(this), {
                width: 420,
                height: 92,
                fontSize: 38,
                color: 0x477ab4,
                enabled: campaignUnlocked
            }).setDepth(26);

            new UIButton(this, cx, startY + gap, 'ОБУЧЕНИЕ', function () {
                this.scene.start('LevelSelect', { pack: 'training' });
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x47a798 }).setDepth(25);

            new UIButton(this, cx, startY + gap * 2, 'СКИНЫ', function () {
                this.scene.start('SkinSelect');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x8960a0 }).setDepth(23);

            new UIButton(this, cx, startY + gap * 3, 'КАК ИГРАТЬ', function () {
                this.scene.start('HowTo');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0xb95c6b }).setDepth(22);

            new UIButton(this, cx, startY + gap * 4, 'НАСТРОЙКИ', function () {
                this.scene.start('Settings');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x475467 }).setDepth(21);

            this.add.text(W / 2, H - 36, 'v1.7.20 paper cut • Phaser 3', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#9aa3c4'
            }).setOrigin(0.5);
        }
    });

    window.MenuScene = MenuScene;
})();
