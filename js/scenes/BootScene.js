/*
 * BootScene
 * Самая первая сцена. Здесь можно было бы грузить шрифты/конфиги,
 * но у нас всё процедурное, поэтому просто переходим к Preload.
 */
(function () {
    'use strict';

    var BootScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function BootScene() {
            Phaser.Scene.call(this, { key: 'Boot' });
        },
        create: function () {
            this.scene.start('Preload');
        }
    });

    window.BootScene = BootScene;
})();
