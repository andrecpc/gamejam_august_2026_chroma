/*
 * background.js
 * Динамичный фон, общий для всех экранов, чтобы игра выглядела цельно.
 *
 * Устроен так:
 *  - тёмный градиент во весь экран;
 *  - два больших размытых «пятна» света, медленно плавающих (создают глубину);
 *  - облако мелких частиц, дрейфующих вверх.
 *
 * Анимация сделана на твинах Phaser (без ручного update), поэтому просто
 * вызови Background.create(scene) в create() любой сцены.
 */
(function () {
    'use strict';

    var Background = {
        create: function (scene) {
            var W = scene.scale.width;
            var H = scene.scale.height;
            var state = { disposed: false, objects: [] };
            var reducedMotion = window.GameSettings &&
                GameSettings.reducedMotion();
            if (!reducedMotion) {
                scene.cameras.main.fadeIn(180, 13, 16, 48);
            }

            // 1) Градиентная заливка фона
            var g = scene.add.graphics();
            g.fillGradientStyle(0x141a4a, 0x141a4a, 0x0a0c22, 0x1b1140, 1);
            g.fillRect(0, 0, W, H);
            g.setDepth(-100);
            state.objects.push(g);

            // 2) Большие мягкие световые пятна
            var blobColors = [0x4a5cff, 0xff5ca8, 0x2ce6d0];
            for (var i = 0; i < 3; i++) {
                var blob = scene.add.circle(
                    Phaser.Math.Between(0, W),
                    Phaser.Math.Between(0, H),
                    Phaser.Math.Between(180, 300),
                    blobColors[i],
                    0.12
                );
                blob.setDepth(-90);
                blob.setBlendMode(Phaser.BlendModes.ADD);
                state.objects.push(blob);
                // Плавное перемещение туда-сюда
                if (!reducedMotion) {
                    scene.tweens.add({
                        targets: blob,
                        x: Phaser.Math.Between(0, W),
                        y: Phaser.Math.Between(0, H),
                        duration: Phaser.Math.Between(6000, 11000),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }

            // 3) Мелкие частицы, дрейфующие вверх
            var particles = [];
            for (var j = 0; j < (reducedMotion ? 12 : 28); j++) {
                var p = scene.add.circle(
                    Phaser.Math.Between(0, W),
                    Phaser.Math.Between(0, H),
                    Phaser.Math.Between(2, 5),
                    0xffffff,
                    Phaser.Math.FloatBetween(0.15, 0.5)
                );
                p.setDepth(-80);
                particles.push(p);
                state.objects.push(p);
                if (!reducedMotion) {
                    this._floatParticle(scene, p, W, H, state);
                }
            }

            scene.events.once('shutdown', function () {
                state.disposed = true;
                for (var k = 0; k < state.objects.length; k++) {
                    scene.tweens.killTweensOf(state.objects[k]);
                }
                state.objects = [];
            });

            return g;
        },

        // Один цикл всплытия частицы; в конце — перезапуск с новой позиции
        _floatParticle: function (scene, p, W, H, state) {
            if (state.disposed || !p.scene) return;
            var self = this;
            var duration = Phaser.Math.Between(6000, 14000);
            p.y = H + 10;
            p.x = Phaser.Math.Between(0, W);
            scene.tweens.add({
                targets: p,
                y: -10,
                x: p.x + Phaser.Math.Between(-60, 60),
                duration: duration,
                ease: 'Linear',
                onComplete: function () {
                    if (!state.disposed && p.scene) {
                        self._floatParticle(scene, p, W, H, state);
                    }
                }
            });
        }
    };

    window.Background = Background;
})();
