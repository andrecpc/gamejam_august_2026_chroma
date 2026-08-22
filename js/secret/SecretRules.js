/**
 * Механики пака «???». Живут отдельно: если SecretPack выключен,
 * attach возвращает null и обычные уровни не меняются.
 */
import { pointInPolygon, polygonArea, difference } from '../utils/ClipperAdapter.js?v=1.7.40';
import { pointToSegmentDist, pointHitsPolyline } from '../utils/Geometry.js?v=1.7.40';

export var SecretRules = {
    attach: function (scene) {
        if (!window.SecretPack || !SecretPack.enabled) return null;
        var level = scene.level;
        if (!level || level.pack !== 'secret' || !level.secret) return null;
        return new SecretRuntime(scene, level.secret);
    }
};

function SecretRuntime(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.wrap = null;
    this.extras = [];
    this.orbit = null;
    this.flyers = null;
    this.flyerGfx = null;
    this.snake = null;
    this.biomeGfx = null;
    this.biomeBusy = false;
    this.unrolled = false;
    this.shuffleAt = 0;
    this._setup();
}

SecretRuntime.prototype._setup = function () {
    var field = this.scene.field;
    var cfg = this.cfg;
    if (!field) return;

    if (cfg.vialFillRatio) {
        field.vialCapacity = field.totalArea * cfg.vialFillRatio;
    }
    if (cfg.tapeGate) {
        var tape = field.colorArea('tape');
        field.vialCapacity = Math.max(80, (field.totalArea - tape) * 0.10);
    }
    if (cfg.rotate) this._setupRotate();
    if (cfg.orbitSquares) this._setupOrbit();
    if (cfg.sticker) this._setupSticker();
    if (cfg.flyers) this._setupFlyers();
    if (cfg.biome) this._setupBiome();
    if (cfg.snake) this._setupSnake();
    if (cfg.fitVials) this._fitVialCapacity();
    if (cfg.shuffleMs) {
        this.shuffleAt = this.scene.time.now + cfg.shuffleMs;
    }
};

SecretRuntime.prototype._fitVialCapacity = function () {
    var field = this.scene.field;
    var vials = (this.scene.level && this.scene.level.vials) || [];
    var i;
    var minA = Infinity;
    for (i = 0; i < vials.length; i++) {
        var a = field.colorArea(vials[i].color);
        if (a > 0 && a < minA) minA = a;
    }
    if (minA < Infinity) field.vialCapacity = Math.max(80, minA * 0.68);
};

SecretRuntime.prototype._setupFlyers = function () {
    var field = this.scene.field;
    var dirs = [
        { vx: 42, vy: 16 }, { vx: -34, vy: 24 }, { vx: 20, vy: -36 },
        { vx: -28, vy: -20 }, { vx: 32, vy: -14 }, { vx: -18, vy: 38 }
    ];
    this.flyers = [];
    var i;
    var n = 0;
    for (i = 0; i < field.colors.length; i++) {
        if ((field.colors[i].id || '').indexOf('fly_') !== 0) continue;
        var d = dirs[n % dirs.length];
        this.flyers.push({
            id: field.colors[i].id,
            vx: d.vx,
            vy: d.vy,
            r: polyRadius(field.colors[i].points)
        });
        n++;
    }
    this.flyerGfx = this.scene.add.graphics();
    this.flyerGfx.setDepth(1.9);
    this.extras.push(this.flyerGfx);
    this._separateFlyers();
    this._drawFlyerOutlines();
};

SecretRuntime.prototype._setupBiome = function () {
    var field = this.scene.field;
    var self = this;
    if (!this._origFieldDraw) {
        this._origFieldDraw = field.draw;
        field.draw = function () {
            self._origFieldDraw.call(field);
            if (self.cfg.biome) self._drawBiomeDoodles();
        };
    }
    this.biomeGfx = this.scene.add.graphics();
    this.biomeGfx.setDepth(1.84);
    this.extras.push(this.biomeGfx);
    this._drawBiomeDoodles();
};

SecretRuntime.prototype._setupSnake = function () {
    var inner = this.scene.field.innerRect();
    var n = this.cfg.snakeStart || 30;
    var r = 16;
    var segs = [];
    var i;
    var cx = inner.x + inner.w * 0.5;
    var cy = inner.y + inner.h * 0.48;
    var ang = 0;
    var rad = 26;
    for (i = 0; i < n; i++) {
        segs.push({
            x: cx + Math.cos(ang) * rad,
            y: cy + Math.sin(ang) * rad
        });
        ang += 0.4;
        rad += 2.05;
    }
    this.snake = {
        segs: segs,
        r: r,
        heading: Math.PI / 2,
        turnIn: 0.8,
        gfx: this.scene.add.graphics(),
        apples: [],
        nextAppleAt: this.scene.time.now + 500,
        maxLen: this.cfg.snakeMax || 45,
        armed: false
    };
    this.snake.gfx.setDepth(8);
    this.extras.push(this.snake.gfx);
    this._spawnApple();
    this._snakeHud();
    this._drawSnake();
};

SecretRuntime.prototype._setupRotate = function () {
    var scene = this.scene;
    var field = scene.field;
    var b = field.bounds;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    field.xf = { angle: 0, cx: cx, cy: cy };

    var wrap = scene.add.container(cx, cy);
    wrap.setDepth(1);
    this.wrap = wrap;
    this._syncWrap();

    var nail = scene.add.container(0, 0);
    var g = scene.add.graphics();
    g.fillStyle(0x1a120c, 0.45);
    g.fillCircle(1.5, 2.2, 8);
    g.fillStyle(0x2a241c, 1);
    g.fillCircle(0, 0, 7);
    g.fillStyle(0x8a8490, 1);
    g.fillCircle(0, 0, 4.4);
    g.fillStyle(0xf3ead8, 1);
    g.fillCircle(-1.4, -1.5, 1.5);
    nail.add(g);
    nail.setDepth(5);
    wrap.add(nail);
    this.extras.push(nail);
    if (field.colorGrain) field.colorGrain.setVisible(false);
    if (field.colorFiber) field.colorFiber.setVisible(false);
};

SecretRuntime.prototype._syncWrap = function () {
    if (!this.wrap) return;
    var field = this.scene.field;
    var cx = field.xf.cx;
    var cy = field.xf.cy;
    var wrap = this.wrap;
    var objs = [field.sheet, field.paper, field.gfx, field.edge, field.colorGrain, field.colorFiber]
        .concat(field.colorLayers || []);
    var i;
    for (i = 0; i < objs.length; i++) {
        var o = objs[i];
        if (!o || o._secretWrapped) continue;
        wrap.add(o);
        o.x -= cx;
        o.y -= cy;
        o._secretWrapped = true;
    }
};

SecretRuntime.prototype._setupOrbit = function () {
    var field = this.scene.field;
    var inner = (window.SecretPack && SecretPack.INNER) || { x: 68, y: 158, w: 584, h: 584 };
    var spec = (window.SecretPack && SecretPack.ORBIT) || { radius: 175, size: 148 };
    var cx = inner.x + inner.w / 2;
    var cy = inner.y + inner.h / 2;
    var last = [];
    var i;
    for (i = 0; i < 4; i++) {
        var a = i * Math.PI / 2;
        last.push({
            x: cx + Math.cos(a) * spec.radius,
            y: cy + Math.sin(a) * spec.radius
        });
    }
    this.orbit = {
        ids: ['sq_0', 'sq_1', 'sq_2', 'sq_3'],
        r: spec.radius,
        angle: 0,
        omega: GameSettings.reducedMotion() ? 0.32 : 0.48,
        cx: cx,
        cy: cy,
        last: last
    };
};

SecretRuntime.prototype._setupSticker = function () {
    var scene = this.scene;
    var field = scene.field;
    var box = field.colorBounds ? field.colorBounds() : field.innerRect();
    var pad = 48;
    var w = box.w + pad;
    var h = box.h + pad;
    var cx = box.x + box.w / 2;
    var cy = box.y + box.h / 2;
    var g = scene.add.graphics();
    g.setDepth(0.62);
    if (window.Paper && Paper.drawScrap) {
        Paper.drawScrap(g, cx, cy, w, h, 0xf7f1e6, 337, {
            jag: 12,
            shadowX: 10,
            shadowY: 14,
            fibers: true
        });
    } else {
        g.fillStyle(0xf7f1e6, 1);
        g.fillRoundedRect(box.x - pad / 2, box.y - pad / 2, w, h, 18);
    }
    this.extras.push(g);
};

SecretRuntime.prototype.update = function (dt) {
    if (!this.scene || !this.scene.field) return;
    var field = this.scene.field;
    var cfg = this.cfg;

    if (cfg.rotate && field.xf) {
        var omega = GameSettings.reducedMotion() ? 0.16 : 0.26;
        field.xf.angle += omega * dt;
        this._syncWrap();
        if (this.wrap) this.wrap.rotation = field.xf.angle;
    }

    if (this.orbit) this._tickOrbit(dt);

    if (cfg.shuffleMs && this.scene.time.now >= this.shuffleAt) {
        this.shuffleAt = this.scene.time.now + cfg.shuffleMs;
        if (this._shuffleColors()) field.draw();
    }

    if (this.flyers) this._tickFlyers(dt);
    if (this.cfg.unroll && !this.unrolled) this._tryUnroll();
    if (this.snake) this._tickSnake(dt);
};

SecretRuntime.prototype._tickOrbit = function (dt) {
    var orbit = this.orbit;
    var field = this.scene.field;
    orbit.angle += orbit.omega * dt;
    var moved = false;
    var i;
    for (i = 0; i < 4; i++) {
        var a = orbit.angle + i * Math.PI / 2;
        var nx = orbit.cx + Math.cos(a) * orbit.r;
        var ny = orbit.cy + Math.sin(a) * orbit.r;
        var dx = nx - orbit.last[i].x;
        var dy = ny - orbit.last[i].y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            this._translateId(orbit.ids[i], dx, dy);
            moved = true;
        }
        orbit.last[i].x = nx;
        orbit.last[i].y = ny;
    }
    if (moved) field.draw();
};

SecretRuntime.prototype._translateId = function (id, dx, dy) {
    var colors = this.scene.field.colors;
    var i;
    var j;
    for (i = 0; i < colors.length; i++) {
        if (colors[i].id !== id) continue;
        var pts = colors[i].points;
        for (j = 0; j < pts.length; j++) {
            pts[j].x += dx;
            pts[j].y += dy;
        }
    }
};

SecretRuntime.prototype._remainingVialColors = function () {
    var vials = this.scene.vials;
    if (!vials || !vials.queue) return [];
    var seen = {};
    var out = [];
    var i;
    for (i = 0; i < vials.queue.length; i++) {
        var vial = vials.queue[i];
        if (vial.popped || vial.fill >= 1) continue;
        if (seen[vial.color]) continue;
        seen[vial.color] = 1;
        out.push(vial.color);
    }
    return out;
};

SecretRuntime.prototype._paperIsScarce = function () {
    var field = this.scene.field;
    var vials = this.scene.vials;
    if (!field || !vials) return false;
    var remain = field._sumColorArea();
    var left = 0;
    var need = 0;
    var i;
    for (i = 0; i < vials.queue.length; i++) {
        var vial = vials.queue[i];
        if (vial.popped || vial.fill >= 1) continue;
        left++;
        need += Math.max(0, 1 - vial.fill) * vials.capacity;
    }
    if (left <= 0) return false;
    return remain < field.totalArea * 0.34 || remain < need * 1.85;
};

SecretRuntime.prototype._shufflePool = function (fieldColors) {
    var need = this._remainingVialColors();
    if (!need.length || !this._paperIsScarce()) {
        return fieldColors.length ? fieldColors : need;
    }
    var pool = need.slice();
    var extra = null;
    var i;
    for (i = 0; i < fieldColors.length; i++) {
        if (pool.indexOf(fieldColors[i]) === -1) {
            extra = fieldColors[i];
            break;
        }
    }
    if (!extra) {
        var fallback = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];
        for (i = 0; i < fallback.length; i++) {
            if (pool.indexOf(fallback[i]) === -1) {
                extra = fallback[i];
                break;
            }
        }
    }
    if (extra) pool.push(extra);
    return pool;
};

SecretRuntime.prototype._shuffleColors = function () {
    var field = this.scene.field;
    var groups = {};
    var order = [];
    var i;
    for (i = 0; i < field.colors.length; i++) {
        var id = field.colors[i].id;
        if (!groups[id]) {
            groups[id] = [];
            order.push(id);
        }
        groups[id].push(field.colors[i]);
    }
    if (!order.length) return false;
    var fieldColors = [];
    var seen = {};
    for (i = 0; i < order.length; i++) {
        var col = groups[order[i]][0].color;
        if (!seen[col]) {
            seen[col] = 1;
            fieldColors.push(col);
        }
    }
    var palette = this._shufflePool(fieldColors);
    if (palette.length < 1) return false;
    var shift = palette.length > 1
        ? 1 + ((this.scene.time.now / 17) | 0) % (palette.length - 1)
        : 0;
    var changed = false;
    for (i = 0; i < order.length; i++) {
        var next = palette[(i + shift) % palette.length];
        var list = groups[order[i]];
        var k;
        for (k = 0; k < list.length; k++) {
            if (list[k].color !== next) {
                list[k].color = next;
                changed = true;
            }
        }
    }
    return changed;
};

SecretRuntime.prototype.handleCut = function (cut) {
    if (!cut || !cut.pieces) return false;
    var scene = this.scene;
    var cfg = this.cfg;
    var i;

    if (cfg.forbidColor) {
        for (i = 0; i < cut.pieces.length; i++) {
            if (cut.pieces[i].color === cfg.forbidColor) {
                scene._floatText(scene.player.x, scene.player.y - 28, 'Нельзя резать красное');
                scene._lose('Порезано красное');
                return true;
            }
        }
    }

    if (cfg.tapeGate && scene.field.colorArea('tape') > 240) {
        var tapePieces = [];
        var otherPolys = [];
        for (i = 0; i < cut.pieces.length; i++) {
            if (cut.pieces[i].color === 'tape') tapePieces.push(cut.pieces[i]);
            else otherPolys = otherPolys.concat(cut.pieces[i].polys || []);
        }
        if (!tapePieces.length) {
            if (otherPolys.length) scene.field.bouncePolys(otherPolys);
            scene._floatText(scene.player.x, scene.player.y - 28, 'Сначала скотч');
            if (window.AudioManager && AudioManager.playError) AudioManager.playError();
            return true;
        }
        if (otherPolys.length) scene.field.bouncePolys(otherPolys);
        cut.pieces = tapePieces;
        this._releaseTapeIfOverhangCut(cut);
    }

    if (cfg.sequentialTape) {
        var firstDone = this._firstVialDone();
        var tapeLeft = scene.field.colorArea('tape') > 240;
        if (!firstDone && tapeLeft) {
            var hasTape = false;
            var blocked = [];
            for (i = 0; i < cut.pieces.length; i++) {
                if (cut.pieces[i].color === 'tape') hasTape = true;
                else blocked = blocked.concat(cut.pieces[i].polys || []);
            }
            if (hasTape) {
                if (blocked.length) scene.field.bouncePolys(blocked);
                scene._floatText(scene.player.x, scene.player.y - 28, 'Сначала первую корзину');
                if (window.AudioManager && AudioManager.playError) AudioManager.playError();
                return true;
            }
        }
        if (firstDone && tapeLeft) {
            var onlyTape = [];
            var others = [];
            for (i = 0; i < cut.pieces.length; i++) {
                if (cut.pieces[i].color === 'tape') onlyTape.push(cut.pieces[i]);
                else others = others.concat(cut.pieces[i].polys || []);
            }
            if (onlyTape.length) {
                if (others.length) scene.field.bouncePolys(others);
                cut.pieces = onlyTape;
                this._releaseTapeIfOverhangCut(cut);
                this._carveTapeKeepRoll(cut);
                if (scene._cutJuice) scene._cutJuice(scene.player && scene.player.trail, cut.pieces);
                scene._registerSuccessfulCut();
                if (window.AudioManager && AudioManager.playCut) AudioManager.playCut();
                return true;
            }
        }
    }

    if (cfg.unroll && !this.unrolled) {
        var blockedBlue = [];
        var hasBlue = false;
        var rest = [];
        for (i = 0; i < cut.pieces.length; i++) {
            if (cut.pieces[i].color === 'blue') {
                hasBlue = true;
                blockedBlue = blockedBlue.concat(cut.pieces[i].polys || []);
            } else rest.push(cut.pieces[i]);
        }
        if (hasBlue) {
            if (blockedBlue.length) scene.field.bouncePolys(blockedBlue);
            if (!rest.length) {
                scene._floatText(scene.player.x, scene.player.y - 28, 'Сначала скотч');
                if (window.AudioManager && AudioManager.playError) AudioManager.playError();
                return true;
            }
            cut.pieces = rest;
        }
    }

    if (cfg.biome) return this._handleBiomeCut(cut);
    if (cfg.snake) return this._handleSnakeCut(cut);
    return false;
};

SecretRuntime.prototype.isWon = function () {
    var field = this.scene && this.scene.field;
    if (!field) return false;
    if (this.cfg.biome) {
        var desert = this.cfg.desert || 'orange';
        var forest = this.cfg.forest || 'green';
        return field.colorArea(desert) < 400 && field.colorArea(forest) > 800;
    }
    if (this.cfg.snake) {
        return !!(this.snake && this.snake.segs && this.snake.segs.length === 0);
    }
    return false;
};

SecretRuntime.prototype._firstVialDone = function () {
    var vials = this.scene.vials;
    if (!vials || !vials.queue || !vials.queue.length) return false;
    var first = vials.queue[0];
    return !!(first.popped || first.fill >= 1);
};

SecretRuntime.prototype._outsidePaper = function (pt, paper, pad) {
    pad = pad || 4;
    return pt.x < paper.x + pad ||
        pt.x > paper.x + paper.w - pad ||
        pt.y < paper.y + pad ||
        pt.y > paper.y + paper.h - pad;
};

SecretRuntime.prototype._releaseTapeIfOverhangCut = function (cut) {
    var paper = this.cfg.paper;
    if (!paper || !cut.captured || !cut.captured.length) return;
    var field = this.scene.field;
    var released = {};
    var i;
    var j;
    var k;
    for (i = 0; i < field.colors.length; i++) {
        var col = field.colors[i];
        if (col.color !== 'tape') continue;
        for (j = 0; j < cut.captured.length; j++) {
            var cap = cut.captured[j];
            if (!cap || !cap.length) continue;
            var hit = false;
            var outside = false;
            for (k = 0; k < cap.length; k++) {
                if (!pointInPolygon(cap[k].x, cap[k].y, col.points)) continue;
                hit = true;
                if (this._outsidePaper(cap[k], paper, 6)) outside = true;
            }
            var cx = 0;
            var cy = 0;
            for (k = 0; k < cap.length; k++) {
                cx += cap[k].x;
                cy += cap[k].y;
            }
            cx /= cap.length;
            cy /= cap.length;
            if (pointInPolygon(cx, cy, col.points)) {
                hit = true;
                if (this._outsidePaper({ x: cx, y: cy }, paper, 6)) outside = true;
            }
            if (hit && outside) released[col.id] = true;
        }
    }
    var extra = [];
    var add = 0;
    for (i = 0; i < field.colors.length; i++) {
        if (!released[field.colors[i].id]) continue;
        extra.push(field.colors[i].points);
        add += polygonArea(field.colors[i].points);
    }
    if (!extra.length) return;
    cut.captured = cut.captured.concat(extra);
    for (i = 0; i < cut.pieces.length; i++) {
        if (cut.pieces[i].color !== 'tape') continue;
        cut.pieces[i].polys = cut.pieces[i].polys.concat(extra);
        cut.pieces[i].area += add;
    }
};

SecretRuntime.prototype._isDrawing = function () {
    return !!(this.scene.player && this.scene.player.drawing);
};

SecretRuntime.prototype._carveTapeKeepRoll = function (cut) {
    var field = this.scene.field;
    var captured = cut.captured || [];
    if (!captured.length) return;
    var next = [];
    var i;
    var r;
    for (i = 0; i < field.colors.length; i++) {
        var col = field.colors[i];
        if (col.color !== 'tape') {
            next.push(col);
            continue;
        }
        var remain = difference([col.points], captured, true);
        for (r = 0; r < remain.length; r++) {
            if (polygonArea(remain[r]) < 80) continue;
            next.push({ id: col.id, color: 'tape', points: remain[r] });
        }
    }
    field.colors = next;
    this._healRoll();
    field.draw();
};

SecretRuntime.prototype._healRoll = function () {
    if (this.unrolled) return;
    var paper = this.cfg.paper;
    var rollId = this.cfg.unroll && this.cfg.unroll.rollId;
    if (!paper || !rollId) return;
    var field = this.scene.field;
    var i;
    for (i = 0; i < field.colors.length; i++) {
        if (field.colors[i].id !== rollId) continue;
        field.colors[i].points = [
            { x: paper.x, y: paper.y },
            { x: paper.x + paper.w, y: paper.y },
            { x: paper.x + paper.w, y: paper.y + paper.h },
            { x: paper.x, y: paper.y + paper.h }
        ];
        return;
    }
};

SecretRuntime.prototype._colorById = function (id) {
    var colors = this.scene.field.colors;
    var i;
    for (i = 0; i < colors.length; i++) {
        if (colors[i].id === id) return colors[i];
    }
    return null;
};

SecretRuntime.prototype._pruneFlyers = function () {
    var kept = [];
    var i;
    for (i = 0; i < this.flyers.length; i++) {
        var col = this._colorById(this.flyers[i].id);
        if (col && col.points && col.points.length) kept.push(this.flyers[i]);
    }
    this.flyers = kept;
};

SecretRuntime.prototype._bounceFlyerWalls = function (fly) {
    var col = this._colorById(fly.id);
    if (!col || !col.points.length) return;
    var inner = this.scene.field.innerRect();
    var r = (fly.r || 52) + 6;
    var c = polyCenter(col.points);
    var dx = 0;
    var dy = 0;
    if (c.x < inner.x + r) {
        dx = inner.x + r - c.x;
        fly.vx = Math.abs(fly.vx);
    } else if (c.x > inner.x + inner.w - r) {
        dx = inner.x + inner.w - r - c.x;
        fly.vx = -Math.abs(fly.vx);
    }
    if (c.y < inner.y + r) {
        dy = inner.y + r - c.y;
        fly.vy = Math.abs(fly.vy);
    } else if (c.y > inner.y + inner.h - r) {
        dy = inner.y + inner.h - r - c.y;
        fly.vy = -Math.abs(fly.vy);
    }
    if (dx || dy) this._translateId(fly.id, dx, dy);
};

SecretRuntime.prototype._separateFlyers = function () {
    var i;
    var j;
    for (i = 0; i < this.flyers.length; i++) {
        var a = this.flyers[i];
        var ca = this._colorById(a.id);
        if (!ca) continue;
        var pa = polyCenter(ca.points);
        for (j = i + 1; j < this.flyers.length; j++) {
            var b = this.flyers[j];
            var cb = this._colorById(b.id);
            if (!cb) continue;
            var pb = polyCenter(cb.points);
            var dx = pb.x - pa.x;
            var dy = pb.y - pa.y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
            var minD = (a.r || 52) + (b.r || 52) + 14;
            if (dist >= minD) continue;
            var nx = dx / dist;
            var ny = dy / dist;
            var push = (minD - dist) / 2;
            this._translateId(a.id, -nx * push, -ny * push);
            this._translateId(b.id, nx * push, ny * push);
            pa.x -= nx * push;
            pa.y -= ny * push;
            var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rvn < 0) {
                a.vx += rvn * nx;
                a.vy += rvn * ny;
                b.vx -= rvn * nx;
                b.vy -= rvn * ny;
            }
            clampFlyerSpeed(a, 38);
            clampFlyerSpeed(b, 38);
        }
    }
};

SecretRuntime.prototype._tickFlyers = function (dt) {
    this._pruneFlyers();
    if (!this.flyers.length) return;
    var field = this.scene.field;
    var drawing = !!(this.scene.player && this.scene.player.drawing);
    if (drawing) {
        this._drawFlyerOutlines();
        return;
    }
    var i;
    for (i = 0; i < this.flyers.length; i++) {
        var fly = this.flyers[i];
        clampFlyerSpeed(fly, 38);
        this._translateId(fly.id, fly.vx * dt, fly.vy * dt);
        this._bounceFlyerWalls(fly);
    }
    this._separateFlyers();
    for (i = 0; i < this.flyers.length; i++) this._bounceFlyerWalls(this.flyers[i]);
    field.draw();
    this._drawFlyerOutlines();
};

SecretRuntime.prototype._drawFlyerOutlines = function () {
    if (!this.flyerGfx) return;
    var g = this.flyerGfx;
    g.clear();
    var field = this.scene.field;
    var i;
    for (i = 0; i < field.colors.length; i++) {
        var col = field.colors[i];
        if ((col.id || '').indexOf('fly_') !== 0) continue;
        var deckle = col.points;
        if (window.Paper && Paper.tearPoly) {
            deckle = Paper.tearPoly(col.points, 90 + i * 13, 5);
        }
        g.lineStyle(7, 0xf7f1e6, 0.95);
        if (!deckle.length) continue;
        g.beginPath();
        g.moveTo(deckle[0].x, deckle[0].y);
        var k;
        for (k = 1; k < deckle.length; k++) g.lineTo(deckle[k].x, deckle[k].y);
        g.closePath();
        g.strokePath();
    }
};

SecretRuntime.prototype._tryUnroll = function () {
    if (!this._firstVialDone()) return;
    if (this.scene.field.colorArea('tape') > 240) return;
    var spec = this.cfg.unroll;
    var field = this.scene.field;
    var i;
    for (i = 0; i < field.colors.length; i++) {
        if (field.colors[i].id !== spec.rollId) continue;
        var t = spec.to;
        field.colors[i].points = [
            { x: t.x, y: t.y },
            { x: t.x + t.w, y: t.y },
            { x: t.x + t.w, y: t.y + t.h },
            { x: t.x, y: t.y + t.h }
        ];
        this.unrolled = true;
        field.draw();
        this.scene._floatText(
            this.scene.scale.width / 2,
            this.scene.scale.height * 0.28,
            'Лист развернулся!'
        );
        return;
    }
};

SecretRuntime.prototype._handleBiomeCut = function (cut) {
    var scene = this.scene;
    var field = scene.field;
    var forest = this.cfg.forest || 'green';
    var desert = this.cfg.desert || 'orange';
    var captured = cut.captured || [];
    if (!captured.length) return true;
    if (this.biomeBusy) {
        field.bouncePolys(captured);
        return true;
    }
    var neighborArea = {};
    neighborArea[forest] = 0;
    neighborArea[desert] = 0;
    var i;
    for (i = 0; i < field.colors.length; i++) {
        var col = field.colors[i];
        if (col.color !== forest && col.color !== desert) continue;
        if (polysTouch(col.points, captured, 10)) {
            neighborArea[col.color] += polygonArea(col.points);
        }
    }
    var fill = neighborArea[forest] >= neighborArea[desert] ? forest : desert;
    if (neighborArea[forest] <= 0 && neighborArea[desert] <= 0) fill = forest;
    var trail = scene.player && scene.player.trail;
    if (scene._cutJuice) scene._cutJuice(trail, cut.pieces);
    field.bouncePolys(captured);
    var delay = GameSettings.reducedMotion() ? 40 : 220;
    this.biomeBusy = true;
    var self = this;
    scene.time.delayedCall(delay, function () {
        if (!self.scene || !self.scene.field) return;
        self.scene.field.carveAndFill(captured, fill, 'bio');
        self._playBiomeGrow(captured, fill);
        self.scene._registerSuccessfulCut();
        if (window.AudioManager && AudioManager.playCut) AudioManager.playCut();
        var result = self.scene.objectives && self.scene.objectives.onSuccessfulCut(0);
        self.scene._handleObjectiveResult(result);
        self.biomeBusy = false;
    });
    return true;
};

SecretRuntime.prototype._playBiomeGrow = function (captured, fill) {
    if (GameSettings.reducedMotion() || !captured || !captured.length) return;
    var scene = this.scene;
    var pal = (scene.level && scene.level.palette) || {};
    var tint = hexColor(pal[fill] || (fill === 'green' ? '#3cb87a' : '#ff8a3d'));
    var g = scene.add.graphics();
    g.setDepth(7.2);
    var state = { k: 0 };
    scene.tweens.add({
        targets: state,
        k: 1,
        duration: 420,
        ease: 'Cubic.Out',
        onUpdate: function () {
            g.clear();
            g.fillStyle(tint, 0.2 + 0.55 * state.k);
            var i;
            var j;
            for (i = 0; i < captured.length; i++) {
                var pts = captured[i];
                if (!pts || pts.length < 3) continue;
                var c = polyCenter(pts);
                var s = 0.22 + 0.78 * state.k;
                g.beginPath();
                g.moveTo(c.x + (pts[0].x - c.x) * s, c.y + (pts[0].y - c.y) * s);
                for (j = 1; j < pts.length; j++) {
                    g.lineTo(c.x + (pts[j].x - c.x) * s, c.y + (pts[j].y - c.y) * s);
                }
                g.closePath();
                g.fillPath();
            }
        },
        onComplete: function () { g.destroy(); }
    });
};

SecretRuntime.prototype._drawBiomeDoodles = function () {
    if (!this.biomeGfx) return;
    var g = this.biomeGfx;
    g.clear();
    var field = this.scene.field;
    var forest = this.cfg.forest || 'green';
    var desert = this.cfg.desert || 'orange';
    var i;
    for (i = 0; i < field.colors.length; i++) {
        var col = field.colors[i];
        if (col.color === forest) this._doodleTrees(g, col.points, i);
        else if (col.color === desert) this._doodleWaves(g, col.points, i);
    }
};

SecretRuntime.prototype._doodleTrees = function (g, pts, seed) {
    if (!pts || pts.length < 3) return;
    var box = polyBox(pts);
    var x;
    var y;
    var n = 0;
    for (y = box.y + 22; y < box.y + box.h - 10; y += 54) {
        for (x = box.x + 18; x < box.x + box.w - 12; x += 48) {
            var ox = x + ((seed * 13 + n * 17) % 11) - 5;
            var oy = y + ((seed * 7 + n * 11) % 9) - 4;
            if (!pointInPolygon(ox, oy, pts)) { n++; continue; }
            drawPencilTree(g, ox, oy, 0.85 + ((n + seed) % 4) * 0.12);
            n++;
        }
    }
};

SecretRuntime.prototype._doodleWaves = function (g, pts, seed) {
    if (!pts || pts.length < 3) return;
    var box = polyBox(pts);
    g.lineStyle(1.7, 0x8a4a20, 0.42);
    var y;
    var x;
    for (y = box.y + 12; y < box.y + box.h - 8; y += 18) {
        var started = false;
        for (x = box.x; x < box.x + box.w; x += 7) {
            var yy = y + Math.sin(x * 0.085 + seed * 0.7) * 3.4;
            if (pointInPolygon(x, yy, pts)) {
                if (!started) {
                    g.beginPath();
                    g.moveTo(x, yy);
                    started = true;
                } else {
                    g.lineTo(x, yy);
                }
            } else if (started) {
                g.strokePath();
                started = false;
            }
        }
        if (started) g.strokePath();
    }
};

SecretRuntime.prototype._tickSnake = function (dt) {
    var snake = this.snake;
    var scene = this.scene;
    if (!snake.segs.length) {
        this._drawSnake();
        return;
    }
    if (!snake.armed && scene._hasMoved) snake.armed = true;
    this._tickApples();
    if (snake.armed) {
        var head = snake.segs[0];
        snake.turnIn -= dt;
        if (snake.turnIn <= 0) {
            snake.heading += (Math.random() - 0.5) * 1.35;
            snake.turnIn = 0.65 + Math.random() * 1.15;
        }
        var nearest = this._nearestApple(head);
        if (nearest) {
            var adx = nearest.x - head.x;
            var ady = nearest.y - head.y;
            snake.heading = Math.atan2(ady, adx) * 0.35 + snake.heading * 0.65;
        }
        var speed = GameSettings.reducedMotion() ? 32 : 46;
        var nx = head.x + Math.cos(snake.heading) * speed * dt;
        var ny = head.y + Math.sin(snake.heading) * speed * dt;
        var box = scene.field.innerRect();
        var pad = 22;
        if (nx < box.x + pad) {
            nx = box.x + pad;
            snake.heading = Math.PI - snake.heading;
        } else if (nx > box.x + box.w - pad) {
            nx = box.x + box.w - pad;
            snake.heading = Math.PI - snake.heading;
        }
        if (ny < box.y + pad) {
            ny = box.y + pad;
            snake.heading = -snake.heading;
        } else if (ny > box.y + box.h - pad) {
            ny = box.y + box.h - pad;
            snake.heading = -snake.heading;
        }
        var prev = { x: head.x, y: head.y };
        head.x = nx;
        head.y = ny;
        var i;
        var spacing = snake.r * 1.85;
        for (i = 1; i < snake.segs.length; i++) {
            var seg = snake.segs[i];
            var ox = seg.x;
            var oy = seg.y;
            var ddx = prev.x - seg.x;
            var ddy = prev.y - seg.y;
            var dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            if (dlen > spacing) {
                seg.x += ddx / dlen * (dlen - spacing);
                seg.y += ddy / dlen * (dlen - spacing);
            }
            prev = { x: ox, y: oy };
        }
        this._eatApples();
    }
    this._snakeHud();
    this._checkSnakeHeadHit();
    this._drawSnake();
};

SecretRuntime.prototype._snakeHud = function () {
    var snake = this.snake;
    var scene = this.scene;
    if (!scene.objectives) return;
    var n = snake.segs.length;
    var max = snake.maxLen || 15;
    scene.objectives.note = 'Не дай змейке стать длины ' + max +
        '  •  Либо отрежь всю змейку целиком  •  ' + n + '/' + max;
};

SecretRuntime.prototype._checkSnakeHeadHit = function () {
    var snake = this.snake;
    var scene = this.scene;
    var player = scene.player;
    if (!snake.segs.length || !player) return;
    if (scene.time && scene.invulnUntil && scene.time.now < scene.invulnUntil) return;
    var head = snake.segs[0];
    var hr = snake.r + 3;
    if (Math.hypot(player.x - head.x, player.y - head.y) < hr + player.hitRadius() - 1) {
        scene._hurt('голова змейки');
        return;
    }
    if (player.drawing && player.trail && player.trail.length > 1) {
        if (pointHitsPolyline(head.x, head.y, player.trail, hr + 5) >= 0) {
            scene._hurt('голова змейки');
        }
    }
};

SecretRuntime.prototype._tickApples = function () {
    var snake = this.snake;
    if (snake.apples.length >= 2) return;
    if (this.scene.time.now < snake.nextAppleAt) return;
    this._spawnApple();
    snake.nextAppleAt = this.scene.time.now + 1600 + Math.random() * 1000;
};

SecretRuntime.prototype._spawnApple = function () {
    var snake = this.snake;
    if (!snake || snake.apples.length >= 2) return;
    var box = this.scene.field.innerRect();
    var tries = 0;
    while (tries < 18) {
        var x = box.x + 40 + Math.random() * (box.w - 80);
        var y = box.y + 40 + Math.random() * (box.h - 80);
        var ok = true;
        var i;
        for (i = 0; i < snake.segs.length; i++) {
            if (Math.hypot(snake.segs[i].x - x, snake.segs[i].y - y) < 46) {
                ok = false;
                break;
            }
        }
        for (i = 0; i < snake.apples.length; i++) {
            if (Math.hypot(snake.apples[i].x - x, snake.apples[i].y - y) < 70) {
                ok = false;
                break;
            }
        }
        if (ok) {
            snake.apples.push({ x: x, y: y });
            return;
        }
        tries++;
    }
};

SecretRuntime.prototype._nearestApple = function (head) {
    var apples = this.snake.apples;
    var best = null;
    var bestD = 160;
    var i;
    for (i = 0; i < apples.length; i++) {
        var d = Math.hypot(apples[i].x - head.x, apples[i].y - head.y);
        if (d < bestD) {
            bestD = d;
            best = apples[i];
        }
    }
    return best;
};

SecretRuntime.prototype._eatApples = function () {
    var snake = this.snake;
    var head = snake.segs[0];
    var kept = [];
    var i;
    for (i = 0; i < snake.apples.length; i++) {
        var a = snake.apples[i];
        if (Math.hypot(head.x - a.x, head.y - a.y) < snake.r + 12) {
            var tail = snake.segs[snake.segs.length - 1];
            snake.segs.push({ x: tail.x, y: tail.y });
            this.scene._floatText(a.x, a.y - 16, '+1');
            if (snake.segs.length >= (snake.maxLen || 45)) {
                this.scene._lose('Змейка слишком длинная', 'secret');
            }
        } else {
            kept.push(a);
        }
    }
    snake.apples = kept;
};

SecretRuntime.prototype._handleSnakeCut = function (cut) {
    var scene = this.scene;
    var snake = this.snake;
    var captured = cut.captured || [];
    if (!snake.segs.length) return true;
    var tail = snake.segs[snake.segs.length - 1];
    var tailIn = false;
    var i;
    for (i = 0; i < captured.length; i++) {
        if (pointInPolygon(tail.x, tail.y, captured[i])) { tailIn = true; break; }
    }
    if (!tailIn) {
        scene.field.bouncePolys(captured);
        scene._floatText(scene.player.x, scene.player.y - 28, 'Нужен хвост');
        if (window.AudioManager && AudioManager.playError) AudioManager.playError();
        return true;
    }
    var keep = [];
    for (i = 0; i < snake.segs.length; i++) {
        var seg = snake.segs[i];
        var hit = false;
        var k;
        for (k = 0; k < captured.length; k++) {
            if (pointInPolygon(seg.x, seg.y, captured[k])) { hit = true; break; }
        }
        if (!hit) keep.push(seg);
    }
    snake.segs = keep;
    scene.field.bouncePolys(captured);
    scene._registerSuccessfulCut();
    if (window.AudioManager && AudioManager.playCut) AudioManager.playCut();
    scene._floatText(tail.x, tail.y - 18, 'Хвост!');
    var result = scene.objectives && scene.objectives.onSuccessfulCut(0);
    scene._handleObjectiveResult(result);
    this._drawSnake();
    return true;
};

SecretRuntime.prototype._drawSnake = function () {
    var snake = this.snake;
    if (!snake || !snake.gfx) return;
    var g = snake.gfx;
    g.clear();
    var i;
    for (i = 0; i < snake.apples.length; i++) {
        var a = snake.apples[i];
        g.fillStyle(0xf7f1e6, 1);
        g.fillCircle(a.x + 1, a.y + 1, 12);
        g.fillStyle(0xde3449, 1);
        g.fillCircle(a.x, a.y, 9);
        g.lineStyle(2, 0x3a2a18, 0.8);
        g.beginPath();
        g.moveTo(a.x, a.y - 8);
        g.lineTo(a.x + 2, a.y - 15);
        g.strokePath();
        g.fillStyle(0x3cb87a, 1);
        g.fillTriangle(a.x + 2, a.y - 14, a.x + 10, a.y - 12, a.x + 4, a.y - 8);
    }
    var segs = snake.segs;
    if (!segs.length) return;
    for (i = 0; i < segs.length; i++) {
        var s = segs[i];
        var isHead = i === 0;
        var isTail = i === segs.length - 1;
        var r = isHead ? snake.r + 3 : (isTail ? snake.r + 1 : snake.r);
        g.fillStyle(0xf7f1e6, 1);
        g.fillCircle(s.x + 1, s.y + 1, r + 4);
        g.fillStyle(isHead ? 0xde3449 : (isTail ? 0x47a798 : 0x7c4dff), 1);
        g.fillCircle(s.x, s.y, r);
        if (isHead) {
            g.fillStyle(0x1a120c, 1);
            g.fillCircle(s.x + 4, s.y - 3, 3);
            g.fillCircle(s.x - 3, s.y - 3, 3);
        }
        if (isTail) {
            g.fillStyle(0xf3ead8, 1);
            g.fillCircle(s.x, s.y, 5);
        }
    }
};

function polyCenter(pts) {
    var x = 0;
    var y = 0;
    var i;
    for (i = 0; i < pts.length; i++) {
        x += pts[i].x;
        y += pts[i].y;
    }
    return { x: x / pts.length, y: y / pts.length };
}

function polyRadius(pts) {
    var c = polyCenter(pts);
    var r = 0;
    var i;
    for (i = 0; i < pts.length; i++) {
        var d = Math.hypot(pts[i].x - c.x, pts[i].y - c.y);
        if (d > r) r = d;
    }
    return r;
}

function polyBox(pts) {
    var minX = pts[0].x;
    var minY = pts[0].y;
    var maxX = minX;
    var maxY = minY;
    var i;
    for (i = 1; i < pts.length; i++) {
        if (pts[i].x < minX) minX = pts[i].x;
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].x > maxX) maxX = pts[i].x;
        if (pts[i].y > maxY) maxY = pts[i].y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function hexColor(hex) {
    if (typeof hex === 'number') return hex;
    return parseInt(String(hex).replace('#', ''), 16) || 0x3cb87a;
}

function clampFlyerSpeed(fly, max) {
    var s = Math.hypot(fly.vx, fly.vy);
    if (s > max && s > 0.01) {
        fly.vx *= max / s;
        fly.vy *= max / s;
        return;
    }
    if (s < 24) {
        if (s < 1) {
            fly.vx = 30;
            fly.vy = 16;
        } else {
            fly.vx *= 24 / s;
            fly.vy *= 24 / s;
        }
    }
}

function drawPencilTree(g, x, y, s) {
    g.lineStyle(2.1 * s, 0x4a3420, 0.62);
    g.beginPath();
    g.moveTo(x, y + 11 * s);
    g.lineTo(x + 0.6 * s, y);
    g.strokePath();
    g.lineStyle(1.7 * s, 0x1e3a22, 0.58);
    g.beginPath();
    g.moveTo(x, y - 14 * s);
    g.lineTo(x - 9 * s, y + 2 * s);
    g.lineTo(x - 3 * s, y);
    g.lineTo(x - 11 * s, y + 10 * s);
    g.lineTo(x + 1 * s, y + 3 * s);
    g.lineTo(x + 10 * s, y + 11 * s);
    g.lineTo(x + 3 * s, y);
    g.lineTo(x + 8 * s, y + 1 * s);
    g.closePath();
    g.strokePath();
}

function polysTouch(a, capturedList, pad) {
    var c;
    var i;
    for (c = 0; c < capturedList.length; c++) {
        if (polyTouches(a, capturedList[c], pad)) return true;
    }
    for (i = 0; i < a.length; i++) {
        for (c = 0; c < capturedList.length; c++) {
            if (pointInPolygon(a[i].x, a[i].y, capturedList[c])) return true;
        }
    }
    return false;
}

function polyTouches(a, b, pad) {
    var i;
    var j;
    if (!a || !b || a.length < 2 || b.length < 2) return false;
    for (i = 0; i < a.length; i++) {
        var a0 = a[i];
        var a1 = a[(i + 1) % a.length];
        for (j = 0; j < b.length; j++) {
            if (pointToSegmentDist(b[j].x, b[j].y, a0.x, a0.y, a1.x, a1.y) <= pad) return true;
            var b0 = b[j];
            var b1 = b[(j + 1) % b.length];
            if (pointToSegmentDist(a0.x, a0.y, b0.x, b0.y, b1.x, b1.y) <= pad) return true;
        }
    }
    return false;
}

SecretRuntime.prototype.destroy = function () {
    var i;
    if (this.wrap) {
        this.wrap.removeAll(false);
        this.wrap.destroy();
        this.wrap = null;
    }
    if (this._origFieldDraw && this.scene && this.scene.field) {
        this.scene.field.draw = this._origFieldDraw;
        this._origFieldDraw = null;
    }
    for (i = 0; i < this.extras.length; i++) {
        if (this.extras[i] && this.extras[i].destroy) this.extras[i].destroy();
    }
    this.extras = [];
    if (this.scene && this.scene.field) this.scene.field.xf = null;
};
