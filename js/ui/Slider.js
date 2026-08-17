/*
 * ui/Slider.js
 * Горизонтальный слайдер громкости 0..1. Тянется мышью или пальцем.
 *
 * Как и в кнопке, ввод ловит вложенный Rectangle-хитбокс, а не контейнер
 * (у интерактивных Container неверно считаются попадания при DPR != 1).
 *
 * Использование:
 *   new UISlider(this, x, y, 0.5, function (value) { ... });
 */
(function () {
    'use strict';

    var UISlider = new Phaser.Class({
        Extends: Phaser.GameObjects.Container,

        initialize: function UISlider(scene, x, y, value, onChange, options) {
            Phaser.GameObjects.Container.call(this, scene, x, y);
            options = options || {};

            this._w = options.width || 360;
            this._onChange = onChange;
            this._value = Phaser.Math.Clamp(value, 0, 1);

            // Дорожка (фон)
            this.track = scene.add.graphics();
            this.add(this.track);

            // Заполненная часть
            this.fill = scene.add.graphics();
            this.add(this.fill);

            // Ползунок
            this.knob = scene.add.circle(0, 0, 22, 0xffffff);
            this.knob.setStrokeStyle(4, 0x4a5cff);
            this.add(this.knob);

            this._redraw();

            // Хитбокс на всю ширину (с запасом по высоте, чтобы удобно попадать пальцем)
            this.hit = scene.add.rectangle(0, 0, this._w + 44, 64, 0x000000, 0);
            this.hit.setInteractive({ useHandCursor: true });
            this.add(this.hit);

            var self = this;
            this._dragging = false;

            this.hit.on('pointerdown', function (pointer) {
                self._dragging = true;
                self._updateFromPointer(pointer);
            });
            scene.input.on('pointermove', function (pointer) {
                if (self._dragging) self._updateFromPointer(pointer);
            });
            scene.input.on('pointerup', function () {
                self._dragging = false;
            });

            scene.add.existing(this);
        },

        _updateFromPointer: function (pointer) {
            // pointer.x — уже в игровых координатах (Scale Manager всё пересчитал)
            var localX = pointer.x - this.x;
            var t = (localX + this._w / 2) / this._w;
            this.setValue(Phaser.Math.Clamp(t, 0, 1));
            if (this._onChange) this._onChange(this._value);
        },

        setValue: function (v) {
            this._value = Phaser.Math.Clamp(v, 0, 1);
            this._redraw();
            return this;
        },

        getValue: function () {
            return this._value;
        },

        _redraw: function () {
            var half = this._w / 2;
            var knobX = -half + this._value * this._w;

            this.track.clear();
            this.track.fillStyle(0x000000, 0.4);
            this.track.fillRoundedRect(-half, -6, this._w, 12, 6);

            this.fill.clear();
            this.fill.fillStyle(0x4a5cff, 1);
            this.fill.fillRoundedRect(-half, -6, this._value * this._w, 12, 6);

            this.knob.x = knobX;
        }
    });

    window.UISlider = UISlider;
})();
