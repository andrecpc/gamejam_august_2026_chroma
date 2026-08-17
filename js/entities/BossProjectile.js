export class BossProjectile extends Phaser.GameObjects.Arc {
    constructor(scene) {
        super(scene, 0, 0, 7, 0, 360, false, 0xff5c8a, 1);
        scene.add.existing(this);
        this.setDepth(12);
        this.setActive(false);
        this.setVisible(false);
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.owner = 'boss';
        this.damage = 1;
    }

    fire(cfg) {
        this.setPosition(cfg.x, cfg.y);
        this.vx = cfg.vx || 0;
        this.vy = cfg.vy || 0;
        this.life = cfg.life || 5000;
        this.owner = cfg.owner || 'boss';
        this.damage = cfg.damage || 1;
        this.setRadius(cfg.radius || 7);
        this.setFillStyle(cfg.color || 0xff5c8a, 1);
        this.setStrokeStyle(2, 0xffffff, 0.75);
        this.setActive(true);
        this.setVisible(true);
        this.setAlpha(1);
    }

    update(time, delta) {
        if (!this.active) return;
        var dt = Math.min(delta, 50) / 1000;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= delta;
        if (this.life <= 0 || this.x < 10 || this.x > 710 ||
            this.y < 110 || this.y > 790) {
            this.disable();
        }
    }

    disable() {
        this.setActive(false);
        this.setVisible(false);
    }
}
