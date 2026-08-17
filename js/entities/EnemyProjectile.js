export class EnemyProjectile extends Phaser.GameObjects.Arc {
    constructor(scene) {
        super(scene, 0, 0, 7, 0, 360, false, 0xffd35c, 1);
        scene.add.existing(this);
        this.setDepth(8);
        this.setStrokeStyle(2, 0xffffff, 0.8);
        this.setActive(false);
        this.setVisible(false);
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
    }

    fire(x, y, vx, vy, life) {
        this.setPosition(x, y);
        this.vx = vx;
        this.vy = vy;
        this.life = life || 4000;
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
        if (this.life <= 0 || this.x < 20 || this.x > 700 ||
            this.y < 100 || this.y > 790) {
            this.disable();
        }
    }

    disable() {
        this.setActive(false);
        this.setVisible(false);
    }
}
