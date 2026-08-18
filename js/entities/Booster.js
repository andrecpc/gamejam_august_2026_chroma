import { hexToInt } from '../utils/Geometry.js';

var ICONS = {
    speed: '⚡',
    slow: '🐌',
    life: '❤',
    hurt: '💔',
    shield: '◆',
    enemySlow: '❄',
    removeEnemy: '✦',
    mystery: '?'
};

var COLORS = {
    speed: 0xffd24a,
    slow: 0x9c6bff,
    life: 0xff5c7a,
    hurt: 0xb95c6b,
    shield: 0x55eaff,
    enemySlow: 0x7bc8ff,
    removeEnemy: 0xff8a3d,
    mystery: 0xffffff
};

export class Booster {
    constructor(scene, cfg) {
        this.scene = scene;
        this.cfg = cfg;
        this.type = cfg.type || 'mystery';
        this.x = cfg.x;
        this.y = cfg.y;
        this.radius = cfg.radius || 22;
        this.active = false;
        this.collected = false;

        this.container = scene.add.container(this.x, this.y);
        this.container.setDepth(10);
        this.glow = scene.add.circle(0, 0, this.radius + 10,
            hexToInt(cfg.color || COLORS[this.type] || 0xffffff), 0.18);
        this.body = scene.add.circle(0, 0, this.radius,
            hexToInt(cfg.color || COLORS[this.type] || 0xffffff), 0.92);
        this.body.setStrokeStyle(3, 0xffffff, 0.9);
        this.icon = scene.add.text(0, 0, cfg.icon || ICONS[this.type] || '?', {
            fontFamily: 'Arial, sans-serif',
            fontSize: (this.type === 'mystery' ? 30 : 24) + 'px',
            fontStyle: 'bold',
            color: '#14203a'
        }).setOrigin(0.5);
        this.container.add([this.glow, this.body, this.icon]);
        this.container.setVisible(false);

        this.pulseTween = scene.tweens.add({
            targets: this.glow,
            scale: 1.35,
            alpha: 0.04,
            duration: 650,
            yoyo: true,
            repeat: -1,
            paused: true
        });
    }

    show() {
        if (this.collected) return;
        this.active = true;
        this.container.setVisible(true);
        if (GameSettings.reducedMotion()) {
            this.container.setScale(1);
            return;
        }
        this.container.setScale(0);
        this.pulseTween.resume();
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut'
        });
    }

    despawn() {
        if (this.collected) return;
        this.active = false;
        this.collected = true;
        if (this.pulseTween) this.pulseTween.pause();
        this.container.setVisible(false);
    }

    collect(onComplete) {
        if (!this.active || this.collected) return;
        this.active = false;
        this.collected = true;
        this.pulseTween.pause();
        if (GameSettings.reducedMotion()) {
            this.container.setVisible(false);
            if (onComplete) onComplete();
            return;
        }
        this.scene.tweens.add({
            targets: this.container,
            scale: 1.7,
            alpha: 0,
            duration: 180,
            ease: 'Cubic.easeOut',
            onComplete: function () {
                this.container.setVisible(false);
                if (onComplete) onComplete();
            }.bind(this)
        });
    }

    destroy() {
        if (this.pulseTween) this.pulseTween.stop();
        this.container.destroy();
    }
}
