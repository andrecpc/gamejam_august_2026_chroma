/*
 * main.js — точка входа. Создаёт игру Phaser.
 *
 * Базовое «виртуальное» разрешение — 720x1280 (портрет, как у телефона).
 * Режим масштабирования FIT: игра целиком вписывается в экран с сохранением
 * пропорций и центрируется. Так одинаково хорошо и на телефоне, и в браузере
 * на десктопе (по бокам/сверху будут аккуратные тёмные поля).
 */
import { GameScene } from './scenes/GameScene.js?v=1.7.10';
import { UIScene } from './scenes/UIScene.js?v=1.7.10';
import { SkinSelectScene } from './scenes/SkinSelectScene.js?v=1.7.9';

var config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0c254d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1280
    },
    scene: [
        BootScene,
        PreloadScene,
        MenuScene,
        HowToScene,
        SettingsScene,
        LevelSelectScene,
        SkinSelectScene,
        GameScene,
        UIScene,
        PauseScene
    ]
};

var game = new Phaser.Game(config);
window.game = game;

function unlockAudio() {
    if (window.AudioManager) AudioManager.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
window.addEventListener('click', unlockAudio);
