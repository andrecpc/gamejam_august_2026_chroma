/*
 * ui/Button.js
 * Переиспользуемая кнопка: скруглённый прямоугольник + текст.
 *
 * ВАЖНО про ввод: интерактивным делаем НЕ контейнер, а вложенный
 * прозрачный Rectangle. У интерактивных Container в Phaser попадания
 * считаются неверно (особенно при масштабе экрана / DPR != 1), из-за чего
 * кнопки «прокликиваются» через раз. Прямоугольник-хитбокс лишён этой
 * проблемы. Анимацию нажатия применяем только к «визуалу» (фон + текст),
 * а сам хитбокс не трогаем — тогда зона клика всегда стабильна.
 *
 * Использование:
 *   new UIButton(this, x, y, 'ИГРАТЬ', function () { ... });
 *   new UIButton(this, x, y, 'НАЗАД', cb, { width: 240, color: 0xff5ca8 });
 */
(function () {
    'use strict';

    var UIButton = new Phaser.Class({
        Extends: Phaser.GameObjects.Container,

        initialize: function UIButton(scene, x, y, label, onClick, options) {
            Phaser.GameObjects.Container.call(this, scene, x, y);
            options = options || {};

            var w = options.width || 360;
            var h = options.height || 96;
            var radius = options.radius || 24;
            var baseColor = options.color !== undefined ? options.color : 0x4a5cff;
            var fontSize = options.fontSize || 36;

            this._w = w;
            this._h = h;
            this._radius = radius;
            this._baseColor = baseColor;
            this._onClick = onClick;

            // Фон (скруглённый) — только визуал, без ввода
            this.bg = scene.add.graphics();
            this.add(this.bg);
            this._drawBg(baseColor);

            // Подпись
            this.label = scene.add.text(0, 0, label, {
                fontFamily: 'Arial, sans-serif',
                fontSize: fontSize + 'px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);
            this.add(this.label);

            // Прозрачный хитбокс поверх — ИМЕННО он ловит ввод
            this.hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0);
            this.add(this.hit);
            this._gotDown = false;
            if (options.interactive !== false) {
                this.hit.setInteractive({ useHandCursor: true });
            }

            this._bindEvents(scene);

            scene.add.existing(this);
        },

        // Включаем хитбокс после зажатого стика, чтобы pointerup не прожимал кнопку.
        arm: function () {
            this._gotDown = false;
            if (this.hit && this.hit.scene) {
                this.hit.setInteractive({ useHandCursor: true });
            }
            return this;
        },

        _drawBg: function (color) {
            this.bg.clear();
            // Подложка-тень снизу для объёма
            this.bg.fillStyle(0x000000, 0.25);
            this.bg.fillRoundedRect(-this._w / 2, -this._h / 2 + 6, this._w, this._h, this._radius);
            // Основной цвет
            this.bg.fillStyle(color, 1);
            this.bg.fillRoundedRect(-this._w / 2, -this._h / 2, this._w, this._h, this._radius);
            // Блик сверху
            this.bg.fillStyle(0xffffff, 0.12);
            this.bg.fillRoundedRect(-this._w / 2, -this._h / 2, this._w, this._h / 2, this._radius);
        },

        // Масштабируем только визуал (фон+текст), хитбокс оставляем как есть
        _setVisualScale: function (s) {
            this.bg.setScale(s);
            this.label.setScale(s);
        },

        _animateVisualScale: function (scene, s, duration, ease) {
            scene.tweens.killTweensOf([this.bg, this.label]);
            scene.tweens.add({
                targets: [this.bg, this.label],
                scaleX: s,
                scaleY: s,
                duration: duration || 140,
                ease: ease || 'Quad.easeOut'
            });
        },

        _bindEvents: function (scene) {
            var self = this;

            this.hit.on('pointerover', function () {
                self._drawBg(self._lighten(self._baseColor, 0.15));
                self._animateVisualScale(scene, 1.025, 120);
                if (window.AudioManager) AudioManager.playHover();
            });

            this.hit.on('pointerout', function () {
                self._drawBg(self._baseColor);
                self._animateVisualScale(scene, 1, 130);
            });

            this.hit.on('pointerdown', function () {
                self._gotDown = true;
                scene.tweens.killTweensOf([self.bg, self.label]);
                self._setVisualScale(0.94);
                self._drawBg(self._darken(self._baseColor, 0.15));
            });

            // pointerup — палец/мышь отпущены НАД кнопкой -> клик
            this.hit.on('pointerup', function () {
                var pressedHere = self._gotDown;
                self._gotDown = false;
                self._drawBg(self._baseColor);
                self._animateVisualScale(scene, 1, 220, 'Back.easeOut');
                if (!pressedHere) return;
                if (window.AudioManager) AudioManager.playClick();
                if (self._onClick) self._onClick();
            });

            this.hit.on('pointerupoutside', function () {
                self._gotDown = false;
            });
        },

        setLabel: function (text) {
            this.label.setText(text);
            return this;
        },

        _lighten: function (color, amount) {
            var c = Phaser.Display.Color.IntegerToColor(color);
            return Phaser.Display.Color.GetColor(
                Math.min(255, c.red + 255 * amount),
                Math.min(255, c.green + 255 * amount),
                Math.min(255, c.blue + 255 * amount)
            );
        },
        _darken: function (color, amount) {
            var c = Phaser.Display.Color.IntegerToColor(color);
            return Phaser.Display.Color.GetColor(
                Math.max(0, c.red - 255 * amount),
                Math.max(0, c.green - 255 * amount),
                Math.max(0, c.blue - 255 * amount)
            );
        }
    });

    window.UIButton = UIButton;
})();
