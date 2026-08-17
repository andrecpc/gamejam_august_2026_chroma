/*
 * PreloadScene
 * Экран загрузки. Ассетов у нас пока нет (всё рисуется кодом),
 * поэтому показываем короткую анимацию прогресс-бара и уходим в меню.
 *
 * Когда добавишь свои картинки/звуки — грузи их в preload() ниже,
 * и настоящий прогресс-бар подхватит события загрузчика.
 */
(function () {
    'use strict';

    var PreloadScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function PreloadScene() {
            Phaser.Scene.call(this, { key: 'Preload' });
        },

        preload: function () {
            var W = this.scale.width;
            var H = this.scale.height;

            this.cameras.main.setBackgroundColor('#0c254d');

            this.add.text(W / 2, H / 2 - 80, 'ЗАГРУЗКА', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '40px',
                fontStyle: 'bold',
                color: '#f6efe4'
            }).setOrigin(0.5);

            // Рамка прогресс-бара
            var barW = W * 0.6;
            var barX = (W - barW) / 2;
            var barY = H / 2;
            var box = this.add.graphics();
            box.fillStyle(0x000000, 0.4);
            box.fillRoundedRect(barX, barY, barW, 26, 13);

            var bar = this.add.graphics();

            // Реальный прогресс от загрузчика (сработает, когда появятся ассеты)
            this.load.on('progress', function (value) {
                bar.clear();
                bar.fillStyle(0x477ab4, 1);
                bar.fillRoundedRect(barX + 3, barY + 3, (barW - 6) * value, 20, 10);
            });

            this.load.image('paper-desk', 'assets/paper/desk.png?v=1.7.2');
            this.load.image('paper-kraft', 'assets/paper/kraft.png?v=1.7.1');
            this.load.json('levels', 'levels/levels.json?v=1.5.7');

            // Заглушка: имитируем короткую загрузку, чтобы бар не мигал
            this._fakeProgress = 0;
        },

        create: function () {
            if (window.Paper) Paper.generate(this);
            var W = this.scale.width;
            var H = this.scale.height;
            var barW = W * 0.6;
            var barX = (W - barW) / 2;
            var barY = H / 2;
            var bar = this.add.graphics();

            // Плавно «доезжаем» баром до конца и переходим в меню
            var self = this;
            this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: 700,
                onUpdate: function (tween) {
                    var v = tween.getValue();
                    bar.clear();
                    bar.fillStyle(0x477ab4, 1);
                    bar.fillRoundedRect(barX + 3, barY + 3, (barW - 6) * v, 20, 10);
                },
                onComplete: function () {
                    self.scene.start('Menu');
                }
            });
        }
    });

    window.PreloadScene = PreloadScene;
})();
