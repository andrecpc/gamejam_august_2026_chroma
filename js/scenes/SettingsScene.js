/*
 * SettingsScene — настройки звука.
 * Переключатели «Музыка»/«Звуки» + слайдеры громкости.
 * Всё сразу сохраняется в GameSettings (localStorage) и применяется к звуку.
 */
(function () {
    'use strict';

    var SettingsScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function SettingsScene() {
            Phaser.Scene.call(this, { key: 'Settings' });
        },

        create: function () {
            var W = this.scale.width;
            var H = this.scale.height;

            Background.create(this);

            this.add.text(W / 2, H * 0.12, 'НАСТРОЙКИ', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '64px',
                fontStyle: 'bold',
                color: '#f3ead8'
            }).setOrigin(0.5);

            var cx = W / 2;
            var self = this;

            // ---- Музыка: переключатель + слайдер ----
            this._label(cx - 200, H * 0.28, 'Музыка');
            this._toggle(cx + 150, H * 0.28, GameSettings.get('musicOn'), function (on) {
                GameSettings.set('musicOn', on);
                if (window.AudioManager) AudioManager.applyMusicSetting();
            });
            new UISlider(this, cx, H * 0.345, GameSettings.get('musicVolume'), function (v) {
                GameSettings.set('musicVolume', v);
                if (window.AudioManager && GameSettings.get('musicOn') && AudioManager.musicGain) {
                    AudioManager.musicGain.gain.value = v;
                }
            }, { width: 420 });

            this._label(cx - 200, H * 0.445, 'Звуки');
            this._toggle(cx + 150, H * 0.445, GameSettings.get('sfxOn'), function (on) {
                GameSettings.set('sfxOn', on);
                if (window.AudioManager) AudioManager.applySfxSetting();
            });
            new UISlider(this, cx, H * 0.51, GameSettings.get('sfxVolume'), function (v) {
                GameSettings.set('sfxVolume', v);
                if (window.AudioManager && GameSettings.get('sfxOn') && AudioManager.sfxGain) {
                    AudioManager.sfxGain.gain.value = v;
                }
            }, { width: 420 });

            this._label(cx - 200, H * 0.60, 'Вибрация');
            this._toggle(cx + 150, H * 0.60, GameSettings.get('hapticsOn'), function (on) {
                GameSettings.set('hapticsOn', on);
                if (on) GameSettings.vibrate(18);
            });

            this._label(cx - 200, H * 0.68, 'Меньше анимаций');
            this._toggle(cx + 150, H * 0.68, GameSettings.get('reducedMotion'), function (on) {
                GameSettings.set('reducedMotion', on);
            });

            var resetArmed = false;
            var resetBtn = new UIButton(this, W / 2, H * 0.79, 'СБРОС ПРОГРЕССА', function () {
                if (!resetArmed) {
                    resetArmed = true;
                    resetBtn.setLabel('ТОЧНО СБРОСИТЬ?');
                    self.time.delayedCall(2600, function () {
                        if (!resetBtn.scene) return;
                        resetArmed = false;
                        resetBtn.setLabel('СБРОС ПРОГРЕССА');
                    });
                    return;
                }
                GameSettings.resetProgress();
                if (window.AudioManager) AudioManager.playBack();
                self.scene.start('Menu');
            }, { width: 440, color: 0xff5ca8, fontSize: 30 });

            new UIButton(this, W / 2, H * 0.91, 'НАЗАД', function () {
                if (window.AudioManager) AudioManager.playBack();
                this.scene.start('Menu');
            }.bind(this), { width: 320, color: 0xb95c6b });
        },

        _label: function (x, y, text) {
            return this.add.text(x, y, text, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '34px',
                color: '#f3ead8'
            }).setOrigin(0, 0.5);
        },

        // Простой переключатель ВКЛ/ВЫКЛ
        _toggle: function (x, y, initial, onChange) {
            var self = this;
            var state = initial;
            var w = 120, h = 60;

            var container = this.add.container(x, y);
            var bg = this.add.graphics();
            var knob = this.add.circle(0, 0, 24, 0xffffff);
            container.add(bg);
            container.add(knob);

            function redraw() {
                bg.clear();
                bg.fillStyle(state ? 0x47a798 : 0x475467, 1);
                bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
                knob.x = state ? (w / 2 - 30) : (-w / 2 + 30);
            }
            redraw();

            // Ввод — на вложенном прямоугольнике, а не на контейнере
            var hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
            hit.setInteractive({ useHandCursor: true });
            container.add(hit);
            hit.on('pointerup', function () {
                state = !state;
                redraw();
                if (window.AudioManager) AudioManager.playClick();
                if (onChange) onChange(state);
            });

            return container;
        }
    });

    window.SettingsScene = SettingsScene;
})();
