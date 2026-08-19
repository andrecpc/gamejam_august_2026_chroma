import { BossProjectile } from '../entities/BossProjectile.js';
import { dist, hexToInt } from '../utils/Geometry.js';
import { pointInPolygon } from '../utils/ClipperAdapter.js';

export class BossManager {
    constructor(scene, level) {
        this.scene = scene;
        this.cfg = level.boss || null;
        this.active = !!this.cfg;
        this.defeated = false;
        this.towers = [];
        this.volley = 0;
        this.lastHealth = -1;
        this.lastTowerCount = -1;
        this.projectiles = null;
        this.body = null;
        this.fieldGfx = null;
        this.coreShape = null;
        this.nodes = [];
        this.coreCaptured = false;
        this.lockPuzzle = false;
        this.lastNodesLeft = -1;
        this.lastCoreVulnerable = null;
        this.lastBarsSig = '';
        this.colorBars = [];
        this.ringGfx = null;
        this.vx = 0;
        this.vy = 0;
        this.deathAnimUntil = 0;

        if (!this.active) return;

        this.type = this.cfg.type || 'bulletHell';
        this.title = this.cfg.title || (this.type === 'fieldBoss' ? 'ПАУК' : 'БОСС');
        this.x = this.cfg.x;
        this.y = this.cfg.y;
        this.radius = this.cfg.radius || 42;
        if (this.type === 'fieldBoss') {
            this.protectCore = !!this.cfg.protectCore;
            this.coreColor = this.cfg.coreColor || 'yellow';
            this.nodes = (this.cfg.nodes || []).map(function (node, index) {
                return {
                    id: node.id || ('node_' + index),
                    x: node.x,
                    y: node.y,
                    active: true,
                    display: null
                };
            });
            this.lockPuzzle = this.protectCore;
            this.maxHealth = this.nodes.length + 1;
            this.health = this.maxHealth;
            this.palette = level.palette || {};
            this.nextAttackAt = scene.time.now +
                (this.cfg.initialDelay != null ? this.cfg.initialDelay : 1800);
            this.projectiles = scene.add.group({
                classType: BossProjectile,
                maxSize: this.cfg.maxProjectiles || 64,
                runChildUpdate: true
            });
            this._createFieldBoss();
            this._emitStatus();
            return;
        }

        if (this.type === 'colorBoss') {
            this._initColorBoss(level);
            return;
        }

        this.maxHealth = this.cfg.health || 60;
        this.health = this.maxHealth;
        this.nextAttackAt = scene.time.now +
            (this.cfg.initialDelay != null ? this.cfg.initialDelay : 1800);
        this.towerSlots = (this.cfg.towerSlots || []).slice();
        this.palette = level.palette || {};

        this.projectiles = scene.add.group({
            classType: BossProjectile,
            maxSize: this.cfg.maxProjectiles || 80,
            runChildUpdate: true
        });
        this._createBoss();
        this._emitStatus();
    }

    _createFieldBoss() {
        this.fieldGfx = this.scene.add.graphics().setDepth(10);
        this.body = this.scene.add.container(this.x, this.y).setDepth(11);
        var glow = this.scene.add.circle(0, 0, this.radius + 12, 0xb07cff, 0.18);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.coreShape = this.scene.add.circle(0, 0, this.radius, 0x32184f, 1);
        this.coreShape.setStrokeStyle(6, 0xff5ca8, 1);
        var eyeCount = 6;
        var eyes = [];
        for (var i = 0; i < eyeCount; i++) {
            var angle = Math.PI * 2 * i / eyeCount;
            eyes.push(this.scene.add.circle(
                Math.cos(angle) * 22,
                Math.sin(angle) * 22,
                5,
                0xffffff
            ));
        }
        this.body.add([glow, this.coreShape].concat(eyes));

        for (i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            node.display = this.scene.add.container(node.x, node.y).setDepth(12);
            var outer = this.scene.add.circle(0, 0, 19, 0x26143e, 1);
            outer.setStrokeStyle(4, 0xc78cff, 1);
            var inner = this.scene.add.circle(0, 0, 8, 0xffd24a, 1);
            node.display.add([outer, inner]);
        }
        this._drawFieldBoss();
        if (!GameSettings.reducedMotion()) {
            this.scene.tweens.add({
                targets: glow,
                alpha: 0.42,
                scale: 1.13,
                duration: 760,
                yoyo: true,
                repeat: -1
            });
        }
    }

    _drawFieldBoss() {
        if (!this.fieldGfx) return;
        this.fieldGfx.clear();
        this.fieldGfx.lineStyle(13, 0x32184f, 1);
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (!node.active) continue;
            this.fieldGfx.lineBetween(this.x, this.y, node.x, node.y);
        }
    }

    nodesLeft() {
        return this.nodes.filter(function (node) { return node.active; }).length;
    }

    protectsColor(color) {
        if (!this.active || this.defeated || this.type !== 'fieldBoss') return false;
        if (!this.protectCore || this.nodesLeft() === 0) return false;
        return color === this.coreColor;
    }

    _updateCoreLook() {
        if (!this.coreShape) return;
        if (this.nodesLeft() === 0) {
            this.coreShape.setStrokeStyle(7, 0x3ee6a0, 1);
        }
    }

    _initColorBoss(level) {
        this.palette = level.palette || {};
        this.protectCore = false;
        var colors = (this.cfg.colors || ['red', 'blue', 'green']).slice();
        var cutPercent = this.cfg.cutPercent != null ? this.cfg.cutPercent : 0.5;
        var field = this.scene.field;
        this.colorBars = [];
        for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            var startArea = field && field.colorArea ? field.colorArea(color) : 20000;
            this.colorBars.push({
                color: color,
                health: 1,
                startArea: startArea,
                quota: Math.max(800, startArea * cutPercent),
                tint: hexToInt(this.palette[color] || 0xffffff)
            });
        }
        this.maxHealth = this.colorBars.length;
        this.health = this.maxHealth;
        this.vx = this.cfg.vx != null ? this.cfg.vx : 36;
        this.vy = this.cfg.vy != null ? this.cfg.vy : 28;
        var speed = this.cfg.moveSpeed || 50;
        var len = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
        this.vx = this.vx / len * speed;
        this.vy = this.vy / len * speed;
        this.nextAttackAt = this.scene.time.now +
            (this.cfg.initialDelay != null ? this.cfg.initialDelay : 900);
        this.projectiles = this.scene.add.group({
            classType: BossProjectile,
            maxSize: this.cfg.maxProjectiles || 64,
            runChildUpdate: true
        });
        this._createColorBoss();
        this._emitStatus();
    }

    _createColorBoss() {
        this.ringGfx = this.scene.add.graphics().setDepth(11);
        this.body = this.scene.add.container(this.x, this.y).setDepth(12);
        var glow = this.scene.add.circle(0, 0, this.radius + 14, 0xb07cff, 0.2);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        var core = this.scene.add.circle(0, 0, this.radius, 0x24143c, 1);
        core.setStrokeStyle(5, 0xffffff, 0.55);
        var eyeL = this.scene.add.circle(-13, -6, 7, 0xffffff);
        var eyeR = this.scene.add.circle(13, -6, 7, 0xffffff);
        var pupilL = this.scene.add.circle(-11, -5, 3, 0x160e29);
        var pupilR = this.scene.add.circle(15, -5, 3, 0x160e29);
        this.body.add([glow, core, eyeL, eyeR, pupilL, pupilR]);
        this._drawColorRings();
        if (!GameSettings.reducedMotion()) {
            this.scene.tweens.add({
                targets: glow,
                alpha: 0.42,
                scale: 1.12,
                duration: 780,
                yoyo: true,
                repeat: -1
            });
        }
    }

    _drawColorRings() {
        if (!this.ringGfx) return;
        this.ringGfx.clear();
        for (var i = 0; i < this.colorBars.length; i++) {
            var bar = this.colorBars[i];
            var r = this.radius + 8 + i * 8;
            this.ringGfx.lineStyle(6, bar.tint, 0.22);
            this.ringGfx.strokeCircle(this.x, this.y, r);
            if (bar.health <= 0.01) continue;
            this.ringGfx.lineStyle(6, bar.tint, 1);
            this.ringGfx.beginPath();
            this.ringGfx.arc(
                this.x,
                this.y,
                r,
                -Math.PI / 2,
                -Math.PI / 2 + Math.PI * 2 * bar.health,
                false
            );
            this.ringGfx.strokePath();
        }
    }

    _moveColorBoss(dt) {
        var b = this.scene.field && this.scene.field.bounds;
        if (!b) return;
        var pad = (b.frame || 28) + this.radius + 10;
        var minX = b.x + pad;
        var maxX = b.x + b.w - pad;
        var minY = b.y + pad;
        var maxY = b.y + b.h - pad;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < minX) { this.x = minX; this.vx = Math.abs(this.vx); }
        else if (this.x > maxX) { this.x = maxX; this.vx = -Math.abs(this.vx); }
        if (this.y < minY) { this.y = minY; this.vy = Math.abs(this.vy); }
        else if (this.y > maxY) { this.y = maxY; this.vy = -Math.abs(this.vy); }
        if (this.body) this.body.setPosition(this.x, this.y);
        this._drawColorRings();
    }

    _createBoss() {
        this.body = this.scene.add.container(this.x, this.y).setDepth(11);
        var glow = this.scene.add.circle(0, 0, this.radius + 14, 0xff3c8e, 0.2);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        var ring = this.scene.add.circle(0, 0, this.radius + 5, 0x5b164a, 1);
        ring.setStrokeStyle(5, 0xff78c8, 0.9);
        var core = this.scene.add.circle(0, 0, this.radius, 0x3d1948, 1);
        core.setStrokeStyle(3, 0xffffff, 0.45);
        var eyeL = this.scene.add.circle(-14, -5, 7, 0xffffff);
        var eyeR = this.scene.add.circle(14, -5, 7, 0xffffff);
        var pupilL = this.scene.add.circle(-12, -4, 3, 0x160e29);
        var pupilR = this.scene.add.circle(16, -4, 3, 0x160e29);
        var mark = this.scene.add.text(0, 18, 'BOSS', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffb5df'
        }).setOrigin(0.5);
        this.body.add([glow, ring, core, eyeL, eyeR, pupilL, pupilR, mark]);
        if (!GameSettings.reducedMotion()) {
            this.scene.tweens.add({
                targets: glow,
                scale: 1.2,
                alpha: 0.35,
                duration: 850,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    update(dt, player) {
        if (!this.active || this.defeated) return;
        if (this.type === 'colorBoss') {
            this._moveColorBoss(dt);
            this._syncColorBarsFromField();
            var colorNow = this.scene.time.now;
            if (colorNow >= this.nextAttackAt) {
                this._attack(player);
                var colorInterval = this.cfg.attackInterval || 2200;
                if (this.health <= this.maxHealth * 0.5) colorInterval *= 0.78;
                this.nextAttackAt = colorNow + colorInterval;
            }
            return;
        }
        if (this.type === 'fieldBoss') {
            this.body.rotation += dt * 0.08;
            var fieldNow = this.scene.time.now;
            if (fieldNow >= this.nextAttackAt) {
                this._attack(player);
                var fieldInterval = this.cfg.attackInterval || 2200;
                if (this.health <= this.maxHealth * 0.5) {
                    fieldInterval *= 0.78;
                }
                this.nextAttackAt = fieldNow + fieldInterval;
            }
            return;
        }
        var now = this.scene.time.now;
        this.body.rotation += dt * 0.12;

        if (now >= this.nextAttackAt) {
            this._attack(player);
            var interval = this.cfg.attackInterval || 1700;
            if (this.health <= this.maxHealth * 0.5) interval *= 0.72;
            this.nextAttackAt = now + interval;
        }

        for (var i = 0; i < this.towers.length; i++) {
            var tower = this.towers[i];
            if (now >= tower.nextShotAt) {
                this._fireTower(tower);
                tower.nextShotAt = now + (this.cfg.towerFireInterval || 900);
            }
        }
        this._resolveTowerHits();
    }

    _attack(player) {
        this.volley++;
        var phaseTwo = this.health <= this.maxHealth * 0.5;
        var count = (this.cfg.radialBullets || 8) + (phaseTwo ? 4 : 0);
        var speed = (this.cfg.bulletSpeed || 105) * (phaseTwo ? 1.2 : 1);
        var offset = this.volley * 0.23;
        var shotColor = phaseTwo ? 0xff356d : 0xff70bb;
        if (this.type === 'colorBoss') {
            var live = [];
            for (var b = 0; b < this.colorBars.length; b++) {
                if (this.colorBars[b].health > 0.01) live.push(this.colorBars[b]);
            }
            if (live.length) shotColor = live[this.volley % live.length].tint;
        }
        for (var i = 0; i < count; i++) {
            var angle = Math.PI * 2 * i / count + offset;
            if (!this._canFireAngle(angle)) continue;
            this._fire({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                owner: 'boss',
                color: shotColor,
                radius: 7,
                life: 5200
            });
        }

        var aimedEvery = this.cfg.aimedEvery || 2;
        if (player && this.volley % aimedEvery === 0) {
            var base = Math.atan2(player.y - this.y, player.x - this.x);
            for (i = -1; i <= 1; i++) {
                var aimed = base + i * 0.16;
                if (!this._canFireAngle(aimed)) continue;
                this._fire({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(aimed) * speed * 1.18,
                    vy: Math.sin(aimed) * speed * 1.18,
                    owner: 'boss',
                    color: 0xffd24a,
                    radius: 6,
                    life: 4800
                });
            }
        }
    }

    _canFireAngle(angle) {
        if (this.type !== 'fieldBoss') return true;
        var dx = Math.cos(angle);
        var dy = Math.sin(angle);
        var sector = quadrant(dx, dy);
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (!node.active) continue;
            if (quadrant(node.x - this.x, node.y - this.y) === sector) {
                return true;
            }
        }
        return false;
    }

    _fire(cfg) {
        var bullet = this.projectiles.get();
        if (bullet) bullet.fire(cfg);
    }

    onVialCompleted(color) {
        if (!this.active || this.defeated) return;
        if (this.type === 'fieldBoss' || this.type === 'colorBoss') return;
        if (this.type !== 'bulletHell') return;
        var slot = this.towerSlots[this.towers.length];
        if (!slot) return;
        var towerColor = hexToInt(this.palette[color] || 0xffffff);
        var container = this.scene.add.container(slot.x, slot.y).setDepth(13);
        var base = this.scene.add.circle(0, 0, 19, 0x1a1f3d, 1);
        base.setStrokeStyle(4, towerColor, 1);
        var barrel = this.scene.add.rectangle(0, -18, 8, 25, towerColor);
        var core = this.scene.add.circle(0, 0, 8, towerColor, 1);
        container.add([base, barrel, core]);
        this.towers.push({
            x: slot.x,
            y: slot.y,
            color: towerColor,
            damage: this.cfg.towerDamage || 1,
            nextShotAt: this.scene.time.now + 300,
            display: container
        });
        this.scene.game.events.emit('game:enemy-action', {
            type: 'tower',
            label: 'Пробирка стала башней!'
        });
        this._emitStatus();
    }

    _fireTower(tower) {
        var dx = this.x - tower.x;
        var dy = this.y - tower.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var speed = this.cfg.towerBulletSpeed || 300;
        tower.display.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        this._fire({
            x: tower.x,
            y: tower.y,
            vx: dx / len * speed,
            vy: dy / len * speed,
            owner: 'tower',
            color: tower.color,
            radius: 5,
            damage: tower.damage,
            life: 2500
        });
    }

    _resolveTowerHits() {
        var children = this.projectiles.getChildren();
        for (var i = 0; i < children.length; i++) {
            var bullet = children[i];
            if (!bullet.active || bullet.owner !== 'tower') continue;
            if (dist(bullet.x, bullet.y, this.x, this.y) <=
                bullet.radius + this.radius) {
                var hitX = bullet.x;
                var hitY = bullet.y;
                bullet.disable();
                this._damage(bullet.damage, hitX, hitY);
            }
        }
    }

    _syncColorBarsFromField() {
        if (this.type !== 'colorBoss' || this.defeated) return;
        var field = this.scene.field;
        if (!field || !field.colorArea) return;
        var changed = false;
        var emptied = [];
        var i;
        for (i = 0; i < this.colorBars.length; i++) {
            var bar = this.colorBars[i];
            if (bar.health <= 0) continue;
            var left = field.colorArea(bar.color);
            var cut = Math.max(0, bar.startArea - left);
            var synced = Math.max(0, 1 - cut / Math.max(1, bar.quota));
            var leftover = Math.max(1500, bar.startArea * 0.1);
            if (left <= leftover) synced = 0;
            if (synced < bar.health - 0.001) {
                if (bar.health > 0.01 && synced <= 0.01) emptied.push(bar);
                bar.health = synced;
                changed = true;
            }
        }
        if (!changed) return;
        this.health = 0;
        for (i = 0; i < this.colorBars.length; i++) this.health += this.colorBars[i].health;
        this._drawColorRings();
        for (i = 0; i < emptied.length; i++) {
            this.scene.game.events.emit('game:enemy-action', {
                type: 'colorBoss',
                label: COLOR_NAMES[emptied[i].color] + ' щит сбит!'
            });
        }
        this._emitStatus();
        if (this.health <= 0.02) {
            this.health = 0;
            this.defeated = true;
            this._defeatEffect();
            if (this.projectiles) {
                var children = this.projectiles.getChildren();
                for (i = 0; i < children.length; i++) children[i].disable();
            }
            this.scene.game.events.emit('game:boss-defeated');
        }
    }

    onColorCuts(areas) {
        if (!this.active || this.defeated || this.type !== 'colorBoss' || !areas) return;
        var hit = false;
        var emptied = [];
        for (var i = 0; i < this.colorBars.length; i++) {
            var bar = this.colorBars[i];
            var area = areas[bar.color] || 0;
            if (area <= 0 || bar.health <= 0) continue;
            var before = bar.health;
            bar.health = Math.max(0, bar.health - area / bar.quota);
            if (bar.health < before) hit = true;
            if (before > 0.01 && bar.health <= 0.01) {
                bar.health = 0;
                emptied.push(bar);
            }
        }
        if (!hit) {
            this._syncColorBarsFromField();
            return;
        }
        this.health = 0;
        for (i = 0; i < this.colorBars.length; i++) this.health += this.colorBars[i].health;
        this._drawColorRings();
        this._localBurst(this.x, this.y, 0xffffff);
        for (i = 0; i < emptied.length; i++) {
            this.scene.game.events.emit('game:enemy-action', {
                type: 'colorBoss',
                label: COLOR_NAMES[emptied[i].color] + ' щит сбит!'
            });
        }
        this._emitStatus();
        if (this.health <= 0.02) {
            this.health = 0;
            this.defeated = true;
            this._defeatEffect();
            if (this.projectiles) {
                var children = this.projectiles.getChildren();
                for (i = 0; i < children.length; i++) children[i].disable();
            }
            this.scene.game.events.emit('game:boss-defeated');
        } else if (this.body && !GameSettings.reducedMotion()) {
            this.scene.tweens.add({
                targets: this.body,
                scale: 1.12,
                duration: 70,
                yoyo: true
            });
        }
        this._syncColorBarsFromField();
    }

    onPlayerClaim(polys) {
        if (!this.active || this.defeated || this.type !== 'fieldBoss' ||
            !polys || !polys.length) return;
        var activeBefore = this.nodesLeft();
        var cutNodes = 0;
        var hitCore = insideAny(this.x, this.y, polys);

        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (!node.active || !insideAny(node.x, node.y, polys)) continue;
            node.active = false;
            cutNodes++;
            if (node.display) node.display.setVisible(false);
            this._damage(1, node.x, node.y);
        }

        if (cutNodes > 0) {
            this._drawFieldBoss();
            this.scene.game.events.emit('game:enemy-action', {
                type: 'fieldBoss',
                label: this.protectCore
                    ? 'Печать снята — сектор безопасен!'
                    : 'Лапа отсечена — сектор безопасен!'
            });
        }

        var nodesLeft = this.nodesLeft();
        if (hitCore && (!this.protectCore || nodesLeft === 0)) {
            this.coreCaptured = true;
        }
        if (activeBefore > 0 && nodesLeft === 0) {
            this._updateCoreLook();
            this.scene.game.events.emit('game:enemy-action', {
                type: 'fieldBoss',
                label: this.protectCore
                    ? 'Щит спал — отсеки ядро!'
                    : 'Ядро уязвимо — отсеки его!'
            });
            this._emitStatus();
        }

        if (nodesLeft === 0 && this.coreCaptured) {
            this._damage(1, this.x, this.y);
        }
    }

    _damage(amount, hitX, hitY) {
        if (this.defeated) return;
        this.health = Math.max(0, this.health - amount);
        this._localBurst(
            hitX === undefined ? this.x : hitX,
            hitY === undefined ? this.y : hitY,
            this.type === 'fieldBoss' ? 0xb07cff : 0xff78c8
        );
        if (this.health > 0 && !GameSettings.reducedMotion()) {
            this.scene.tweens.add({
                targets: this.body,
                scale: 1.14,
                duration: 70,
                yoyo: true
            });
        }
        this._emitStatus();
        if (this.health <= 0) {
            this.defeated = true;
            this._defeatEffect();
            for (var n = 0; n < this.nodes.length; n++) {
                if (this.nodes[n].display) {
                    this.nodes[n].display.setVisible(false);
                }
            }
            if (this.projectiles) {
                var children = this.projectiles.getChildren();
                for (var i = 0; i < children.length; i++) children[i].disable();
            }
            this.scene.game.events.emit('game:boss-defeated');
        }
    }

    _localBurst(x, y, color) {
        var count = GameSettings.reducedMotion() ? 4 : 11;
        var ring = this.scene.add.circle(x, y, 14, color, 0)
            .setStrokeStyle(4, color, 0.9)
            .setDepth(14);
        this.scene.tweens.add({
            targets: ring,
            scale: GameSettings.reducedMotion() ? 1.5 : 2.8,
            alpha: 0,
            duration: GameSettings.reducedMotion() ? 150 : 280,
            ease: 'Cubic.easeOut',
            onComplete: function () { ring.destroy(); }
        });
        for (var i = 0; i < count; i++) {
            var angle = Math.PI * 2 * i / count;
            var spark = this.scene.add.circle(x, y, 3, color, 0.95)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(14);
            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * Phaser.Math.Between(28, 62),
                y: y + Math.sin(angle) * Phaser.Math.Between(28, 62),
                alpha: 0,
                scale: 0.2,
                duration: Phaser.Math.Between(180, 320),
                ease: 'Quad.easeOut',
                onComplete: function (tw, targets) { targets[0].destroy(); }
            });
        }
    }

    _defeatEffect() {
        var scene = this.scene;
        var x = this.x;
        var y = this.y;
        var reduced = GameSettings.reducedMotion();
        this.deathAnimUntil = scene.time.now + (reduced ? 420 : 2800);
        this._localBurst(x, y, 0xffd24a);
        this._localBurst(x, y, 0xffffff);
        if (this.body) scene.tweens.killTweensOf(this.body);
        if (reduced) {
            if (this.body) this.body.setVisible(false);
            if (this.fieldGfx) this.fieldGfx.setVisible(false);
            if (this.ringGfx) this.ringGfx.setVisible(false);
            return;
        }
        if (scene.cameras && scene.cameras.main) {
            scene.cameras.main.flash(220, 255, 210, 90, true);
            scene.cameras.main.shake(480, 0.018);
        }
        var colors = [0xff3b5c, 0xffd24a, 0xffffff, 0x4a9fff, 0xb07cff, 0x3ee6a0, 0xff78c8];
        var i;
        for (i = 0; i < 9; i++) {
            scene.time.delayedCall(i * 240, function (idx) {
                if (!scene.sys || !scene.sys.isActive()) return;
                var tint = colors[idx % colors.length];
                var ring = scene.add.circle(x, y, 16, tint, 0)
                    .setStrokeStyle(10, tint, 1)
                    .setDepth(22)
                    .setBlendMode(Phaser.BlendModes.ADD);
                scene.tweens.add({
                    targets: ring,
                    scale: 6 + idx * 0.7,
                    alpha: 0,
                    duration: 980,
                    ease: 'Cubic.easeOut',
                    onComplete: function () { if (ring && ring.destroy) ring.destroy(); }
                });
                if (idx % 2 === 0 && scene.cameras && scene.cameras.main) {
                    scene.cameras.main.flash(80, 255, 170, 50, true);
                }
            }, [i]);
        }
        for (i = 0; i < 32; i++) {
            var ang = Math.PI * 2 * i / 32;
            var dist = Phaser.Math.Between(90, 260);
            var shard = scene.add.rectangle(
                x, y,
                Phaser.Math.Between(6, 16),
                Phaser.Math.Between(18, 46),
                colors[i % colors.length]
            ).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
            scene.tweens.add({
                targets: shard,
                x: x + Math.cos(ang) * dist,
                y: y + Math.sin(ang) * dist,
                angle: Phaser.Math.Between(-480, 480),
                alpha: 0,
                scale: 0.15,
                duration: Phaser.Math.Between(1100, 2100),
                ease: 'Quad.easeOut',
                onComplete: function (tw, targets) {
                    if (targets[0] && targets[0].destroy) targets[0].destroy();
                }
            });
        }
        if (scene._confetti) {
            scene._confetti(x, y, 36);
            scene.time.delayedCall(420, function () {
                if (scene._confetti) scene._confetti(x, y - 20, 28);
            });
            scene.time.delayedCall(900, function () {
                if (scene._confetti) scene._confetti(x, y + 10, 22);
            });
        }
        if (this.body) {
            scene.tweens.add({
                targets: this.body,
                scale: 1.85,
                duration: 280,
                yoyo: true,
                repeat: 3,
                ease: 'Sine.easeInOut'
            });
            scene.tweens.add({
                targets: this.body,
                alpha: 0,
                angle: this.body.angle + 38,
                duration: 1600,
                delay: 900,
                ease: 'Back.easeIn',
                onComplete: function () {
                    if (this.body && this.body.scene) this.body.setVisible(false);
                }.bind(this)
            });
        }
        if (this.fieldGfx) {
            scene.tweens.add({
                targets: this.fieldGfx,
                alpha: 0,
                duration: 900,
                onComplete: function () {
                    if (this.fieldGfx && this.fieldGfx.scene) this.fieldGfx.setVisible(false);
                }.bind(this)
            });
        }
        if (this.ringGfx) {
            scene.tweens.add({
                targets: this.ringGfx,
                alpha: 0,
                duration: 900,
                onComplete: function () {
                    if (this.ringGfx && this.ringGfx.scene) this.ringGfx.setVisible(false);
                }.bind(this)
            });
        }
    }

    hitsPlayer(player, consume) {
        if (!this.active || this.defeated || !player) return false;
        if (this.type === 'colorBoss' &&
            dist(player.x, player.y, this.x, this.y) <=
            player.hitRadius() + this.radius - 6) {
            return true;
        }
        if (!this.projectiles) return false;
        var children = this.projectiles.getChildren();
        for (var i = 0; i < children.length; i++) {
            var bullet = children[i];
            if (!bullet.active || bullet.owner !== 'boss') continue;
            if (dist(player.x, player.y, bullet.x, bullet.y) <=
                player.hitRadius() + bullet.radius) {
                if (consume !== false) bullet.disable();
                return true;
            }
        }
        return false;
    }

    _emitStatus() {
        var nodesLeft = this.nodes.filter(function (node) {
            return node.active;
        }).length;
        var coreVulnerable = this.type === 'fieldBoss' && this.nodesLeft() === 0;
        var bars = this.colorBars.map(function (bar) {
            return { color: bar.color, health: bar.health, tint: bar.tint };
        });
        var barsSig = bars.map(function (bar) {
            return bar.health.toFixed(3);
        }).join(',');
        if (this.health === this.lastHealth &&
            this.towers.length === this.lastTowerCount &&
            nodesLeft === this.lastNodesLeft &&
            coreVulnerable === this.lastCoreVulnerable &&
            barsSig === this.lastBarsSig) return;
        this.lastHealth = this.health;
        this.lastTowerCount = this.towers.length;
        this.lastNodesLeft = nodesLeft;
        this.lastCoreVulnerable = coreVulnerable;
        this.lastBarsSig = barsSig;
        this.scene.game.events.emit('game:boss-changed', {
            type: this.type,
            title: this.title,
            health: this.health,
            maxHealth: this.maxHealth,
            towers: this.towers.length,
            nodesLeft: nodesLeft,
            coreVulnerable: coreVulnerable,
            bars: bars
        });
    }

    emitStatus() {
        if (!this.active) return;
        this.lastHealth = -1;
        this.lastTowerCount = -1;
        this.lastNodesLeft = -1;
        this.lastCoreVulnerable = null;
        this.lastBarsSig = '';
        this._emitStatus();
    }

    destroy() {
        for (var i = 0; i < this.towers.length; i++) {
            if (this.towers[i].display && this.towers[i].display.scene) {
                this.towers[i].display.destroy();
            }
        }
        this.towers = [];
        if (this.body && this.body.scene) this.body.destroy();
        for (var n = 0; n < this.nodes.length; n++) {
            if (this.nodes[n].display && this.nodes[n].display.scene) {
                this.nodes[n].display.destroy();
            }
        }
        this.nodes = [];
        if (this.fieldGfx && this.fieldGfx.scene) this.fieldGfx.destroy();
        if (this.ringGfx && this.ringGfx.scene) this.ringGfx.destroy();
        if (this.projectiles && this.projectiles.children) {
            this.projectiles.clear(true, true);
        }
        this.projectiles = null;
        this.body = null;
        this.fieldGfx = null;
        this.ringGfx = null;
    }
}

function insideAny(x, y, polys) {
    for (var i = 0; i < polys.length; i++) {
        if (pointInPolygon(x, y, polys[i])) return true;
    }
    return false;
}

function quadrant(dx, dy) {
    if (dy < 0) return dx < 0 ? 'nw' : 'ne';
    return dx < 0 ? 'sw' : 'se';
}

var COLOR_NAMES = {
    red: 'Красный',
    blue: 'Синий',
    green: 'Зелёный',
    yellow: 'Жёлтый',
    purple: 'Фиолетовый'
};
