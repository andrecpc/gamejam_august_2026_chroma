/*
 * PauseScene — меню паузы.
 * Запускается ПОВЕРХ игровой сцены (scene.launch), пока GameScene на паузе.
 * Кнопки: Продолжить, Рестарт, к выбору уровня, Выход в меню.
 */
(function () {
    'use strict';

    var PauseScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function PauseScene() {
            Phaser.Scene.call(this, { key: 'Pause' });
        },

        init: function (data) {
            this.pack = (data && data.pack) || 'training';
            this.level = (data && data.level) || 1;
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;
            var self = this;
            if (!GameSettings.reducedMotion()) {
                this.cameras.main.fadeIn(140, 0, 0, 0);
            }

            if (window.Paper) Paper.create(this);
            this.add.rectangle(W / 2, H / 2, W, H, 0x061428, 0.22)
                .setInteractive();

            if (window.Paper && Paper.addScrap) {
                Paper.addScrap(this, W / 2, H * 0.22, 420, 120, 0xe6d8c0, 88, {
                    depth: 8, jag: 8, shadowY: 18
                });
            }
            this.add.text(W / 2, H * 0.22, 'ПАУЗА', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '72px',
                fontStyle: 'bold',
                color: '#2a3348'
            }).setOrigin(0.5).setDepth(9);

            var cx = W / 2;
            var startY = H * 0.4;
            var gap = 108;

            new UIButton(this, cx, startY, 'ПРОДОЛЖИТЬ', function () {
                self.scene.resume('Game');
                self.scene.stop();
            }, { width: 440, height: 92, fontSize: 36, color: 0x477ab4 }).setDepth(16);

            new UIButton(this, cx, startY + gap, 'РЕСТАРТ', function () {
                if (window.AudioManager) AudioManager.playClick();
                self.scene.start('Game', { pack: self.pack, level: self.level });
            }, { width: 440, height: 92, fontSize: 36, color: 0xb95c6b }).setDepth(15);

            new UIButton(this, cx, startY + gap * 2, 'К УРОВНЯМ', function () {
                if (window.AudioManager) AudioManager.playBack();
                self.scene.stop('UI');
                self.scene.stop('Game');
                self.scene.start('LevelSelect', { pack: self.pack });
            }, { width: 440, height: 92, fontSize: 36, color: 0xd28e43 }).setDepth(14);

            new UIButton(this, cx, startY + gap * 3, 'В МЕНЮ', function () {
                if (window.AudioManager) AudioManager.playBack();
                self.scene.stop('UI');
                self.scene.stop('Game');
                self.scene.start('Menu');
            }, { width: 440, height: 92, fontSize: 36, color: 0x47a798 }).setDepth(13);
        }
    });

    window.PauseScene = PauseScene;
})();
