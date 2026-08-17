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
                color: '#f3ead8'
            }).setOrigin(0.5);

            var panelW = W * 0.82;
            var panelH = H * 0.52;
            var panelX = W / 2 - panelW / 2;
            var panelY = H * 0.22;
            var panel = this.add.graphics();
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(panel, W / 2, panelY + panelH / 2, panelW, panelH, 0xe6d8c0, 91, {
                    jag: 11, shadowY: 20, fibers: true
                });
            } else {
                panel.fillStyle(0xe6d8c0, 1);
                panel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
            }

            var rules = [
                'Зажми палец — точка едет в эту сторону.',
                '',
                'С рамки заезжай в цвет и возвращайся',
                'на стену. Отрезанный кусок падает',
                'в корзину своего цвета.',
                '',
                'Не пересекай свой хвост. Враг может',
                'поджечь его — не дай огню догнать тебя.'
            ].join('\n');

            this.add.text(W / 2, panelY + panelH / 2, rules, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '30px',
                color: '#3d2a22',
                align: 'center',
                lineSpacing: 6
            }).setOrigin(0.5);

            new UIButton(this, W / 2, H * 0.86, 'НАЗАД', function () {
                if (window.AudioManager) AudioManager.playBack();
                this.scene.start('Menu');
            }.bind(this), { width: 320, color: 0xb95c6b });
        }
    });

    window.HowToScene = HowToScene;
})();
