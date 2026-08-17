/*
 * ui/Button.js
 * Полоска цветной бумаги с рваным краем и тенью слоя.
 *
 * ВАЖНО про ввод: интерактивным делаем НЕ контейнер, а вложенный
 * прозрачный Rectangle. У интерактивных Container в Phaser попадания
 * считаются неверно (особенно при масштабе экрана / DPR != 1), из-за чего
 * кнопки «прокликиваются» через раз. Прямоугольник-хитбокс лишён этой
 * проблемы. Анимацию нажатия применяем только к «визуалу» (фон + текст),
 * а сам хитбокс не трогаем — тогда зона клика всегда стабильна.
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
            var baseColor = options.color !== undefined ? options.color : 0x4a8adf;
            var fontSize = options.fontSize || 36;

            this._w = w;
            this._h = h;
            this._radius = radius;
            this._baseColor = baseColor;
            this._onClick = onClick;
            this._enabled = options.enabled !== false;
            this._seed = (Math.round(x) * 131 + Math.round(y) * 17 + w * 3 + (label ? label.length : 0)) >>> 0;

            this.bg = scene.add.graphics();
            this.add(this.bg);
            this._drawBg(baseColor);

            var pulpKey = scene.textures.exists('paper-kraft') ? 'paper-kraft'
                : (scene.textures.exists('paper-pulp') ? 'paper-pulp'
                    : (scene.textures.exists('paper-grain-d') ? 'paper-grain-d' : null));
            if (pulpKey && window.Paper && Paper.fillMask) {
                this.fiber = scene.add.tileSprite(0, 0, w, h, pulpKey);
                if (pulpKey === 'paper-kraft') {
                    this.fiber.setBlendMode(Phaser.BlendModes.MULTIPLY);
                    this.fiber.setAlpha(0.16);
                } else {
                    this.fiber.setBlendMode(Phaser.BlendModes.OVERLAY);
                    this.fiber.setAlpha(0.2);
                }
                this.add(this.fiber);
                this.maskGfx = scene.add.graphics();
                this.maskGfx.setVisible(false);
                this.add(this.maskGfx);
                Paper.fillMask(this.maskGfx, 0, 0, w, h, this._seed, 10, true);
                this.fiber.setMask(this.maskGfx.createGeometryMask());
            }

            this.labelLayers = [];
            this.label = scene.add.text(0, -2, label, {
                fontFamily: 'Arial, sans-serif',
                fontSize: fontSize + 'px',
                fontStyle: 'bold',
                color: '#f3ead8'
            }).setOrigin(0.5);
            this.add(this.label);
            this.labelLayers.push(this.label);

            this.hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0);
            this.add(this.hit);
            this._gotDown = false;
            if (options.interactive !== false) {
                this.hit.setInteractive({ useHandCursor: true });
            }

            this._bindEvents(scene);
            scene.add.existing(this);
            if (!this._enabled) this.setEnabled(false);
        },

        arm: function () {
            this._gotDown = false;
            if (this._enabled && this.hit && this.hit.scene) {
                this.hit.setInteractive({ useHandCursor: true });
            }
            return this;
        },

        setEnabled: function (on) {
            this._enabled = !!on;
            if (!this._enabled) {
                this.setAlpha(0.42);
                this._drawBg(0x3d4458);
                if (this.hit && this.hit.input) {
                    this.hit.input.cursor = 'default';
                }
            } else {
                this.setAlpha(1);
                this._drawBg(this._baseColor);
                if (this.hit && this.hit.scene) {
                    this.hit.setInteractive({ useHandCursor: true });
                }
            }
            return this;
        },

        _drawBg: function (color) {
            this.bg.clear();
            if (window.Paper && Paper.drawScrap) {
                Paper.drawScrap(this.bg, 0, 0, this._w, this._h, color, this._seed, {
                    jag: 11,
                    strip: true,
                    raw: true,
                    decklePad: 10,
                    shadowX: 15,
                    shadowY: 21,
                    fibers: true
                });
                return;
            }
            this.bg.fillStyle(0x0c101c, 0.35);
            this.bg.fillRoundedRect(-this._w / 2, -this._h / 2 + 8, this._w, this._h, 10);
            this.bg.fillStyle(color, 1);
            this.bg.fillRoundedRect(-this._w / 2, -this._h / 2, this._w, this._h, 10);
        },

        _setVisualScale: function (s) {
            this.bg.setScale(s);
            var i;
            for (i = 0; i < this.labelLayers.length; i++) this.labelLayers[i].setScale(s);
            if (this.fiber) this.fiber.setScale(s);
        },

        _visualTargets: function () {
            return [this.bg]
                .concat(this.labelLayers || [])
                .concat(this.fiber ? [this.fiber] : []);
        },

        _animateVisualScale: function (scene, s, duration, ease) {
            scene.tweens.killTweensOf(this._visualTargets());
            scene.tweens.add({
                targets: this._visualTargets(),
                scaleX: s,
                scaleY: s,
                duration: duration || 140,
                ease: ease || 'Quad.easeOut'
            });
        },

        _bindEvents: function (scene) {
            var self = this;

            this.hit.on('pointerover', function () {
                if (!self._enabled) return;
                self._drawBg(self._lighten(self._baseColor, 0.1));
                self._animateVisualScale(scene, 1.02, 120);
                if (window.AudioManager) AudioManager.playHover();
            });

            this.hit.on('pointerout', function () {
                self._drawBg(self._baseColor);
                self._animateVisualScale(scene, 1, 130);
            });

            this.hit.on('pointerdown', function () {
                if (!self._enabled) return;
                self._gotDown = true;
                scene.tweens.killTweensOf(self._visualTargets());
                self._setVisualScale(0.96);
                self._drawBg(self._darken(self._baseColor, 0.12));
            });

            this.hit.on('pointerup', function () {
                var pressedHere = self._gotDown;
                self._gotDown = false;
                if (!self._enabled) {
                    if (window.AudioManager) AudioManager.playBack();
                    return;
                }
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
            var i;
            for (i = 0; i < this.labelLayers.length; i++) this.labelLayers[i].setText(text);
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
