import { SkinManager } from '../managers/SkinManager.js?v=1.5.4';

export class SkinSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SkinSelect' });
    }

    create() {
        var W = this.scale.width;
        var H = this.scale.height;
        Background.create(this);

        this.add.text(W / 2, 105, 'СКИНЫ ТОЧКИ', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '60px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(W / 2, 170, 'первый скин свободный • остальные — за 10, 20 и 30 ур. кампании', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '21px',
            color: '#9aa4e0',
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5);

        var skins = SkinManager.list();
        var xs = [200, 520];
        var ys = [370, 680];
        for (var i = 0; i < skins.length; i++) {
            this._skinCard(
                xs[i % 2],
                ys[Math.floor(i / 2)],
                skins[i]
            );
        }

        new UIButton(this, W / 2, H - 105, 'НАЗАД', function () {
            if (window.AudioManager) AudioManager.playBack();
            this.scene.start('Menu');
        }.bind(this), { width: 320, color: 0xff5ca8 });
    }

    _skinCard(x, y, skin) {
        var unlocked = SkinManager.isUnlocked(skin);
        var selected = SkinManager.selectedId() === skin.id;
        var card = this.add.container(x, y);
        var bg = this.add.graphics();
        this._drawCard(bg, unlocked, selected);
        card.add(bg);

        var glow = this.add.circle(0, -48, 43, skin.glowColor, unlocked ? 0.18 : 0.05);
        card.add(glow);
        var preview = this._preview(skin, 0, -48);
        if (!unlocked) preview.setAlpha(0.22);
        card.add(preview);

        card.add(this.add.text(0, 20, skin.name, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '30px',
            fontStyle: 'bold',
            color: unlocked ? '#ffffff' : '#667092'
        }).setOrigin(0.5));

        card.add(this.add.text(0, 61, skin.description, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '17px',
            color: unlocked ? '#b9c2ef' : '#596078',
            align: 'center',
            wordWrap: { width: 245 }
        }).setOrigin(0.5));

        var status = selected
            ? 'ВЫБРАН'
            : (unlocked ? 'ВЫБРАТЬ' : '🔒 пройди ' + skin.requiredWins + ' ур.');
        card.add(this.add.text(0, 103, status, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: selected ? '#3ee6a0' : (unlocked ? '#ffd24a' : '#737a96')
        }).setOrigin(0.5));

        var hit = this.add.rectangle(0, 0, 280, 270, 0x000000, 0);
        hit.setInteractive({ useHandCursor: unlocked });
        card.add(hit);
        hit.on('pointerover', function () {
            if (unlocked) card.setScale(1.035);
        });
        hit.on('pointerout', function () { card.setScale(1); });
        hit.on('pointerup', function () {
            card.setScale(1);
            if (!unlocked) {
                if (window.AudioManager) AudioManager.playBack();
                this.tweens.add({
                    targets: card,
                    x: x + 7,
                    duration: 55,
                    yoyo: true,
                    repeat: 3,
                    onComplete: function () { card.x = x; }
                });
                return;
            }
            if (SkinManager.select(skin.id)) {
                if (window.AudioManager) AudioManager.playSuccess();
                this.scene.restart();
            }
        }, this);
    }

    _drawCard(g, unlocked, selected) {
        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(-140, -129, 280, 270, 26);
        g.fillStyle(unlocked ? 0x202653 : 0x171a31, 0.98);
        g.fillRoundedRect(-140, -135, 280, 270, 26);
        g.lineStyle(selected ? 5 : 2, selected ? 0x3ee6a0 : 0xffffff,
            selected ? 0.9 : 0.12);
        g.strokeRoundedRect(-140, -135, 280, 270, 26);
    }

    _preview(skin, x, y) {
        var shape;
        if (skin.shape === 'diamond') {
            shape = this.add.rectangle(x, y, 35, 35, skin.coreColor);
            shape.setAngle(45);
            shape.setStrokeStyle(4, skin.strokeColor);
        } else if (skin.shape === 'star') {
            shape = this.add.star(x, y, 5, 12, 27, skin.coreColor);
            shape.setStrokeStyle(3, skin.strokeColor);
        } else if (skin.shape === 'hex') {
            shape = this.add.star(x, y, 6, 16, 27, skin.coreColor);
            shape.setStrokeStyle(3, skin.strokeColor);
        } else if (skin.shape === 'comet') {
            shape = this.add.triangle(x, y, 0, -28, -18, 20, 18, 20, skin.coreColor);
            shape.setStrokeStyle(3, skin.strokeColor);
        } else if (skin.shape === 'wisp') {
            shape = this.add.circle(x, y, 24, skin.coreColor, 0.4);
            shape.setStrokeStyle(5, skin.strokeColor, 0.95);
            shape.setBlendMode(Phaser.BlendModes.ADD);
        } else {
            shape = this.add.circle(
                x, y, 24, skin.coreColor,
                skin.shape === 'ring' ? 0.3 : 1
            );
            shape.setStrokeStyle(
                skin.shape === 'ring' ? 8 : 4,
                skin.strokeColor
            );
        }
        return shape;
    }
}
