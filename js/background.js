/*
 * background.js
 * Тёмно-синий картон и цветные обрывки — как в коллаже PAPER CUT.
 */
(function () {
    'use strict';

    var Background = {
        create: function (scene) {
            var reducedMotion = window.GameSettings &&
                GameSettings.reducedMotion();
            if (!reducedMotion) {
                scene.cameras.main.fadeIn(180, 12, 37, 77);
            }
            if (window.Paper) {
                Paper.create(scene);
            }
        }
    };

    window.Background = Background;
})();
