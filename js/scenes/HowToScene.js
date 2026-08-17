/*
 * HowToScene — экран «Как играть».
 * Простой текстовый экран с правилами и кнопкой «Назад».
 */
(function () {
    'use strict';

    var HowToScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function HowToScene() {
            Phaser.Scene.call(this, { key: 'HowTo' });
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;

            Background.create(this);

            this.add.text(W / 2, H * 0.12, 'КАК ИГРАТЬ', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '64px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);

            // Панель с правилами
            var panelW = W * 0.82;
            var panelH = H * 0.52;
            var panelX = W / 2 - panelW / 2;
            var panelY = H * 0.22;
            var panel = this.add.graphics();
            panel.fillStyle(0x000000, 0.3);
            panel.fillRoundedRect(panelX, panelY, panelW, panelH, 28);

            var rules = [
                'Зажми палец — точка едет в эту сторону.',
                '',
                'С рамки заезжай в цвет и возвращайся',
                'на стену. Отрезанный кусок падает',
                'в пробирку своего цвета.',
                '',
                'Не пересекай свой хвост. Враг может',
                'поджечь его — не дай огню догнать тебя.'
            ].join('\n');

            this.add.text(W / 2, panelY + panelH / 2, rules, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '30px',
                color: '#dfe4ff',
                align: 'center',
                lineSpacing: 6
            }).setOrigin(0.5);

            new UIButton(this, W / 2, H * 0.86, 'НАЗАД', function () {
                if (window.AudioManager) AudioManager.playBack();
                this.scene.start('Menu');
            }.bind(this), { width: 320, color: 0xff5ca8 });
        }
    });

    window.HowToScene = HowToScene;
})();
