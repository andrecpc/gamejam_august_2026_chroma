/*
 * MenuScene — стартовое меню.
 * Обучение, кампания, лаборатория черновиков, скины и настройки.
 */
(function () {
    'use strict';

    var MenuScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function MenuScene() {
            Phaser.Scene.call(this, { key: 'Menu' });
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;

            Background.create(this);

            var title = this.add.text(W / 2, H * 0.12, 'CHROMA', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '96px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);
            title.setShadow(0, 6, 'rgba(0,0,0,0.4)', 8);

            this.add.text(W / 2, H * 0.12 + 70, 'нарезай цвета • лей в пробирки', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '30px',
                color: '#9aa4e0'
            }).setOrigin(0.5);

            if (window.QAMode && QAMode.enabled) {
                this.add.text(W / 2, H * 0.255, 'QA MODE • ВСЕ УРОВНИ ОТКРЫТЫ', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '24px',
                    fontStyle: 'bold',
                    color: '#ffd24a'
                }).setOrigin(0.5);
            }

            if (!GameSettings.reducedMotion()) {
                this.tweens.add({
                    targets: title,
                    scale: 1.04,
                    duration: 1600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }

            var cx = W / 2;
            var startY = (window.QAMode && QAMode.enabled) ? H * 0.335 : H * 0.355;
            var gap = 96;

            new UIButton(this, cx, startY, 'КАМПАНИЯ', function () {
                this.scene.start('LevelSelect', { pack: 'campaign' });
            }.bind(this), { width: 420, height: 92, fontSize: 38 });

            new UIButton(this, cx, startY + gap, 'ОБУЧЕНИЕ', function () {
                this.scene.start('LevelSelect', { pack: 'training' });
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x2ce6d0 });

            new UIButton(this, cx, startY + gap * 2, 'ЛАБОРАТОРИЯ', function () {
                this.scene.start('LevelSelect', { pack: 'lab' });
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0xff8a3d });

            new UIButton(this, cx, startY + gap * 3, 'СКИНЫ', function () {
                this.scene.start('SkinSelect');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x9b72ff });

            new UIButton(this, cx, startY + gap * 4, 'КАК ИГРАТЬ', function () {
                this.scene.start('HowTo');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0xff5ca8 });

            new UIButton(this, cx, startY + gap * 5, 'НАСТРОЙКИ', function () {
                this.scene.start('Settings');
            }.bind(this), { width: 420, height: 92, fontSize: 38, color: 0x3a3f6a });

            this.add.text(W / 2, H - 36, 'v1.5.7 • Phaser 3', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#6670b0'
            }).setOrigin(0.5);
        }
    });

    window.MenuScene = MenuScene;
})();
