/*
 * Коллаж PAPER CUT.
 * Пигментированная цветная бумага, волокнистый картон, рваный край.
 */
(function () {
    'use strict';

    function mulberry32(seed) {
        var a = seed >>> 0;
        return function () {
            a += 0x6D2B79F5;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function mixRgb(color, k, toward) {
        var r = (color >> 16) & 255;
        var g = (color >> 8) & 255;
        var b = color & 255;
        r = Math.round(r + (toward - r) * k);
        g = Math.round(g + (toward - g) * k);
        b = Math.round(b + (toward - b) * k);
        return (r << 16) | (g << 8) | b;
    }

    function constructionTarget(r, g, b) {
        if (r > 160 && r >= g && r >= b) {
            if (g > 155 && b < 130) return 0xe0b24a;
            if (g > 110 && b < 105) return 0xd28e43;
            if (b > g + 18) return 0xb95c6b;
            return 0xde3449;
        }
        if (b >= r && b >= g) {
            if (g > r + 18) return 0x47a798;
            return 0x1f7fd7;
        }
        if (g >= r && g >= b) {
            if (b > 150 && r < 130) return 0x47a798;
            return 0x3cb87a;
        }
        if (r > 90 && b > 120) return 0x8960a0;
        return 0xd8c4a8;
    }

    function craftColor(color) {
        if (color === 0xff4d6d) return 0xde3449;
        if (color === 0x4a9fff) return 0x1f7fd7;
        if (color === 0xffd24a) return 0xf0c107;
        if (color === 0x3ee6a0) return 0x3cb87a;
        if (color === 0xb07cff) return 0x8960a0;
        var r = (color >> 16) & 255;
        var g = (color >> 8) & 255;
        var b = color & 255;
        var target = constructionTarget(r, g, b);
        var t = 0.82;
        r = r + (((target >> 16) & 255) - r) * t;
        g = g + (((target >> 8) & 255) - g) * t;
        b = b + ((target & 255) - b) * t;
        var avg = (r + g + b) / 3;
        r = r + (r - avg) * 0.08;
        g = g + (g - avg) * 0.08;
        b = b + (b - avg) * 0.08;
        return (Math.round(Math.max(0, Math.min(255, r))) << 16)
            | (Math.round(Math.max(0, Math.min(255, g))) << 8)
            | Math.round(Math.max(0, Math.min(255, b)));
    }

    function worldTear(x, y, seed) {
        var n = Math.sin(x * 0.067 + y * 0.051 + seed * 0.01) * 0.2
            + Math.sin(x * 0.119 - y * 0.083) * 0.14
            + Math.sin((x + y) * 0.033 + seed * 0.02) * 0.1;
        var q = ((Math.floor(x / 16) * 131) ^ (Math.floor(y / 16) * 17) ^ seed) >>> 0;
        var h = ((q * 1103515245 + 12345) >>> 16) / 65536;
        if (h > 0.9) n += 0.32 + (h - 0.9) * 2.2;
        return 0.76 + n;
    }

    function darken(color, k) {
        return mixRgb(color, k, 0);
    }

    function lighten(color, k) {
        return mixRgb(color, k, 255);
    }

    function paintNavyCardboard(ctx, w, h, rand) {
        ctx.fillStyle = '#0c254d';
        ctx.fillRect(0, 0, w, h);
        var i;
        var x;
        var y;
        for (i = 0; i < 9; i++) {
            ctx.fillStyle = 'rgba(8, 24, 52, ' + (0.08 + rand() * 0.1) + ')';
            ctx.beginPath();
            ctx.ellipse(
                rand() * w, rand() * h,
                40 + rand() * 80, 22 + rand() * 48,
                rand() * Math.PI, 0, Math.PI * 2
            );
            ctx.fill();
        }
        for (i = 0; i < 560; i++) {
            ctx.strokeStyle = 'rgba(4, 12, 32, ' + (0.06 + rand() * 0.1) + ')';
            ctx.lineWidth = 0.45 + rand() * 0.9;
            ctx.beginPath();
            x = rand() * w;
            y = rand() * h;
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rand() - 0.5) * 26, y + (rand() - 0.38) * 8);
            ctx.stroke();
        }
        for (i = 0; i < 70; i++) {
            ctx.strokeStyle = 'rgba(188, 198, 226, ' + (0.012 + rand() * 0.018) + ')';
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            x = rand() * w;
            y = rand() * h;
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rand() - 0.5) * 14, y + (rand() - 0.4) * 5);
            ctx.stroke();
        }
        for (i = 0; i < 180; i++) {
            ctx.fillStyle = 'rgba(18, 24, 44, ' + (0.08 + rand() * 0.1) + ')';
            ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand());
        }
        var img = ctx.getImageData(0, 0, w, h);
        var d = img.data;
        for (i = 0; i < d.length; i += 4) {
            var n = (rand() - 0.5) * 10;
            d[i] = Math.max(0, Math.min(255, d[i] + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7));
        }
        ctx.putImageData(img, 0, 0);
    }

    function paintPulpOverlay(ctx, w, h, rand) {
        ctx.fillStyle = '#7e7c76';
        ctx.fillRect(0, 0, w, h);
        var i;
        var x;
        var y;
        for (i = 0; i < 22; i++) {
            ctx.fillStyle = 'rgba(62, 60, 54, ' + (0.08 + rand() * 0.1) + ')';
            ctx.beginPath();
            ctx.ellipse(
                rand() * w, rand() * h,
                16 + rand() * 44, 10 + rand() * 24,
                rand() * Math.PI, 0, Math.PI * 2
            );
            ctx.fill();
        }
        for (i = 0; i < 18; i++) {
            ctx.fillStyle = 'rgba(176, 174, 166, ' + (0.08 + rand() * 0.1) + ')';
            ctx.beginPath();
            ctx.ellipse(
                rand() * w, rand() * h,
                14 + rand() * 38, 8 + rand() * 20,
                rand() * Math.PI, 0, Math.PI * 2
            );
            ctx.fill();
        }
        for (i = 0; i < 720; i++) {
            var dark = rand() > 0.45;
            ctx.strokeStyle = dark
                ? 'rgba(48, 46, 40, ' + (0.1 + rand() * 0.16) + ')'
                : 'rgba(210, 206, 196, ' + (0.1 + rand() * 0.16) + ')';
            ctx.lineWidth = 0.4 + rand() * 0.85;
            ctx.beginPath();
            x = rand() * w;
            y = rand() * h;
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rand() - 0.5) * 20, y + (rand() - 0.45) * 6);
            ctx.stroke();
        }
        for (i = 0; i < 260; i++) {
            ctx.fillStyle = rand() > 0.5
                ? 'rgba(40, 38, 34, 0.16)'
                : 'rgba(220, 216, 206, 0.16)';
            ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand());
        }
        var img = ctx.getImageData(0, 0, w, h);
        var d = img.data;
        for (i = 0; i < d.length; i += 4) {
            var n = (rand() - 0.5) * 18;
            d[i] = Math.max(0, Math.min(255, d[i] + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.92));
        }
        ctx.putImageData(img, 0, 0);
    }

    function edgeWalk(pts, x0, y0, x1, y1, nx, ny, length, amount, rand, phase) {
        var steps = Math.max(4, Math.round(length / (amount > 4 ? 22 : 46)));
        var i;
        for (i = 0; i < steps; i++) {
            var t = i / steps;
            var wave = Math.sin(t * Math.PI * 1.35 + phase) * amount * 0.18
                + Math.sin(t * Math.PI * 2.8 + phase * 1.25) * amount * 0.08;
            var nibble = (rand() - 0.5) * amount * 0.28;
            if (rand() > 0.76) nibble -= amount * (0.85 + rand() * 1.35);
            var n = wave + nibble;
            pts.push({
                x: x0 + (x1 - x0) * t + nx * n,
                y: y0 + (y1 - y0) * t + ny * n
            });
        }
    }

    function tornPoints(cx, cy, w, h, seed, jag) {
        jag = jag == null ? 7 : jag;
        var rand = mulberry32(seed);
        var hw = w / 2;
        var hh = h / 2;
        var pts = [];
        var phase = rand() * Math.PI * 2;
        edgeWalk(pts, cx - hw, cy - hh, cx + hw, cy - hh, 0, -1, w, jag, rand, phase);
        edgeWalk(pts, cx + hw, cy - hh, cx + hw, cy + hh, 1, 0, h, jag, rand, phase);
        edgeWalk(pts, cx + hw, cy + hh, cx - hw, cy + hh, 0, 1, w, jag, rand, phase);
        edgeWalk(pts, cx - hw, cy + hh, cx - hw, cy - hh, -1, 0, h, jag, rand, phase);
        return pts;
    }

    function stripPoints(cx, cy, w, h, seed, jag) {
        jag = jag == null ? 9 : jag;
        var rand = mulberry32(seed);
        var hw = w / 2;
        var hh = h / 2;
        var pts = [];
        var phase = rand() * Math.PI * 2;
        edgeWalk(pts, cx - hw, cy - hh, cx + hw, cy - hh, 0, -1, w, jag, rand, phase);
        edgeWalk(pts, cx + hw, cy - hh, cx + hw, cy + hh, 1, 0, h, jag * 0.22, rand, phase);
        edgeWalk(pts, cx + hw, cy + hh, cx - hw, cy + hh, 0, 1, w, jag, rand, phase);
        edgeWalk(pts, cx - hw, cy + hh, cx - hw, cy - hh, -1, 0, h, jag * 0.22, rand, phase);
        return pts;
    }

    function outlineOf(cx, cy, w, h, seed, jag, strip) {
        return strip
            ? stripPoints(cx, cy, w, h, seed, jag)
            : tornPoints(cx, cy, w, h, seed, jag);
    }

    function fillPts(g, pts) {
        if (!pts.length) return;
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        var i;
        for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.closePath();
        g.fillPath();
    }

    function shiftPts(pts, dx, dy) {
        var out = [];
        var i;
        for (i = 0; i < pts.length; i++) {
            out.push({ x: pts[i].x + dx, y: pts[i].y + dy });
        }
        return out;
    }

    function pulpSpecks(g, cx, cy, w, h, seed, color) {
        var area = Math.max(400, w * h);
        var step = Math.max(28, Math.round(Math.sqrt(area) / 7));
        var x0 = Math.floor((cx - w * 0.44) / step) * step;
        var y0 = Math.floor((cy - h * 0.44) / step) * step;
        var x1 = cx + w * 0.44;
        var y1 = cy + h * 0.44;
        var x;
        var y;
        for (x = x0; x < x1; x += step) {
            for (y = y0; y < y1; y += step) {
                var q = ((Math.floor(x) * 131) ^ (Math.floor(y) * 17) ^ seed) >>> 0;
                var hsh = ((q * 1103515245 + 12345) >>> 16) / 65536;
                if (hsh < 0.34) continue;
                g.fillStyle(hsh > 0.7 ? lighten(color, 0.18) : darken(color, 0.14), 0.16);
                g.fillEllipse(
                    x + (hsh - 0.5) * 9,
                    y + ((hsh * 13) % 1 - 0.5) * 9,
                    4 + hsh * 10,
                    2.5 + hsh * 7
                );
            }
        }
    }

    function paperMottle(g, cx, cy, w, h, seed, color) {
        var rand = mulberry32(seed ^ 0x9e3779b9);
        var i;
        for (i = 0; i < 7; i++) {
            g.fillStyle(darken(color, 0.08 + rand() * 0.1), 0.09);
            g.fillEllipse(
                cx + (rand() - 0.5) * w * 0.72,
                cy + (rand() - 0.5) * h * 0.72,
                12 + rand() * 30,
                8 + rand() * 18
            );
        }
        for (i = 0; i < 6; i++) {
            g.fillStyle(lighten(color, 0.1 + rand() * 0.16), 0.14);
            g.fillEllipse(
                cx + (rand() - 0.5) * w * 0.65,
                cy + (rand() - 0.5) * h * 0.65,
                12 + rand() * 26,
                8 + rand() * 16
            );
        }
    }

    function deckleWhiskers(g, pts, seed) {
        var i;
        for (i = 0; i < pts.length; i += 2) {
            var p = pts[i];
            var jag = worldTear(p.x, p.y, seed);
            if (jag < 0.98) continue;
            g.fillStyle(0xf7f1e6, 0.95);
            g.fillEllipse(p.x, p.y, 3.5 + jag * 3.5, 1.6 + jag * 1.8);
        }
    }

    function boundsOf(pts) {
        var minx = pts[0].x, maxx = pts[0].x, miny = pts[0].y, maxy = pts[0].y;
        var i;
        for (i = 1; i < pts.length; i++) {
            if (pts[i].x < minx) minx = pts[i].x;
            if (pts[i].x > maxx) maxx = pts[i].x;
            if (pts[i].y < miny) miny = pts[i].y;
            if (pts[i].y > maxy) maxy = pts[i].y;
        }
        return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
    }

    function heartPts(x, y, s) {
        var pts = [];
        var i;
        for (i = 0; i <= 24; i++) {
            var t = (i / 24) * Math.PI * 2;
            var px = 16 * Math.pow(Math.sin(t), 3);
            var py = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            pts.push({
                x: x + px * s / 16,
                y: y + py * s / 16 + s * 0.08
            });
        }
        return pts;
    }

    function discPts(x, y, r, seed) {
        var pts = [];
        var n = 22;
        var i;
        for (i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2;
            var jag = worldTear(x + Math.cos(a) * r, y + Math.sin(a) * r, seed);
            var rr = r * (0.93 + jag * 0.09);
            pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
        }
        return pts;
    }

    function expandPts(pts, x, y, pad) {
        var out = [];
        var i;
        for (i = 0; i < pts.length; i++) {
            var dx = pts[i].x - x;
            var dy = pts[i].y - y;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            out.push({
                x: x + dx / len * (len + pad),
                y: y + dy / len * (len + pad)
            });
        }
        return out;
    }

    var Paper = {
        VOID: 0xe6d8c0,
        CREAM: 0xe6d8c0,
        INK: '#f6efe4',
        INK_SOFT: '#cbbba8',
        QA: '#ffb14a',
        SHADOW: 0x061428,
        craft: craftColor,
        basketText: function (s) {
            if (!s) return s;
            return String(s)
                .replace(/Пробирку/g, 'Корзину')
                .replace(/пробирку/g, 'корзину')
                .replace(/Пробирки/g, 'Корзины')
                .replace(/пробирки/g, 'корзины')
                .replace(/пробиркам/g, 'корзинам')
                .replace(/пробиркой/g, 'корзиной')
                .replace(/пробирке/g, 'корзине')
                .replace(/Пробирка/g, 'Корзина')
                .replace(/пробирка/g, 'корзина');
        },

        generate: function (scene) {
            var rand = mulberry32(20260817);
            var size = 512;
            if (!scene.textures.exists('paper-desk-e')) {
                var navy = scene.textures.createCanvas('paper-desk-e', size, size);
                paintNavyCardboard(navy.context || navy.getContext(), size, size, rand);
                navy.refresh();
            }
            if (!scene.textures.exists('paper-pulp')) {
                var grain = scene.textures.createCanvas('paper-pulp', size, size);
                paintPulpOverlay(grain.context || grain.getContext(), size, size, mulberry32(20260821));
                grain.refresh();
            }
        },

        tornPoints: tornPoints,
        stripPoints: stripPoints,

        tearPoly: function (points, seed, dist) {
            if (!points || points.length < 3) return points || [];
            dist = dist == null ? 6 : dist;
            var inward = dist < 0;
            dist = Math.abs(dist);
            var cx = 0;
            var cy = 0;
            var i;
            for (i = 0; i < points.length; i++) {
                cx += points[i].x;
                cy += points[i].y;
            }
            cx /= points.length;
            cy /= points.length;
            var dense = [];
            for (i = 0; i < points.length; i++) {
                var a = points[i];
                var b = points[(i + 1) % points.length];
                var dx = b.x - a.x;
                var dy = b.y - a.y;
                var len = Math.sqrt(dx * dx + dy * dy) || 1;
                var steps = Math.max(2, Math.round(len / 16));
                var mx0 = (a.x + b.x) / 2;
                var my0 = (a.y + b.y) / 2;
                var nx = dy / len;
                var ny = -dx / len;
                if (nx * (cx - mx0) + ny * (cy - my0) > 0) {
                    nx = -nx;
                    ny = -ny;
                }
                if (inward) {
                    nx = -nx;
                    ny = -ny;
                }
                var s;
                for (s = 0; s < steps; s++) {
                    var t = s / steps;
                    var mx = a.x + dx * t;
                    var my = a.y + dy * t;
                    var jag = worldTear(mx, my, seed);
                    var off = Math.max(1, dist * jag);
                    dense.push({ x: mx + nx * off, y: my + ny * off });
                }
            }
            return dense;
        },

        drawColorPiece: function (g, points, color, seed) {
            if (!points || points.length < 3) return;
            seed = seed >>> 0;
            color = craftColor(color);
            var rim = this.tearPoly(points, seed, -1);
            var body = this.tearPoly(points, seed + 19, -5);
            if (!body.length || !rim.length) {
                rim = points;
                body = points;
            }
            g.fillStyle(0x061428, 0.2);
            fillPts(g, shiftPts(rim, 18, 24));
            g.fillStyle(0x061428, 0.48);
            fillPts(g, shiftPts(body, 10, 14));
            g.fillStyle(0xf4ead8, 1);
            fillPts(g, rim);
            deckleWhiskers(g, rim, seed);
            g.fillStyle(darken(color, 0.12), 1);
            fillPts(g, shiftPts(body, 2, 3));
            g.fillStyle(color, 1);
            fillPts(g, body);
            var box = boundsOf(body);
            pulpSpecks(g, box.cx, box.cy, box.w, box.h, seed, color);
            paperMottle(g, box.cx, box.cy, box.w, box.h, seed, color);
        },

        drawCrumple: function (g, x, y, r, color, seed) {
            color = craftColor(color);
            var rand = mulberry32(seed >>> 0);
            var hull = discPts(x, y, r, seed);
            var rim = expandPts(hull, x, y, 3);
            g.fillStyle(0x061428, 0.4);
            fillPts(g, shiftPts(rim, r * 0.22, r * 0.3));
            g.fillStyle(darken(color, 0.3), 1);
            fillPts(g, hull);
            g.fillStyle(color, 1);
            fillPts(g, discPts(x - r * 0.06, y - r * 0.08, r * 0.88, seed + 11));
            var i;
            for (i = 0; i < 9; i++) {
                g.fillStyle(i % 2 ? lighten(color, 0.16) : darken(color, 0.34), 0.9);
                g.fillEllipse(
                    x + (rand() - 0.5) * r * 0.92,
                    y + (rand() - 0.5) * r * 0.92,
                    r * (0.22 + rand() * 0.4),
                    r * (0.16 + rand() * 0.32)
                );
            }
            g.fillStyle(lighten(color, 0.36), 0.48);
            g.fillEllipse(x - r * 0.22, y - r * 0.28, r * 0.32, r * 0.2);
        },

        fillMask: function (g, cx, cy, w, h, seed, jag, strip) {
            g.fillStyle(0xffffff, 1);
            fillPts(g, outlineOf(cx, cy, w, h, seed, jag, strip));
        },

        isCream: function (color) {
            return color === 0xf4ead8 || color === 0xf6efe4 || color === 0xf7f1e6
                || color === 0xf0e4d0 || color === 0xe6d8c0 || color === 0xe2d4bc
                || color === 0xd8cbb4;
        },

        drawScrap: function (g, cx, cy, w, h, color, seed, opts) {
            opts = opts || {};
            var jag = opts.jag == null ? 8 : opts.jag;
            var strip = !!opts.strip;
            var pad = opts.decklePad == null ? (strip ? 10 : 10) : opts.decklePad;
            if (!this.isCream(color) && opts.raw !== true) color = craftColor(color);
            var pts = outlineOf(cx, cy, w, h, seed, jag, strip);
            var deckleOn = opts.deckle !== false;
            var deckle = deckleOn
                ? outlineOf(
                    cx,
                    cy,
                    w + (strip ? pad * 0.32 : pad),
                    h + pad,
                    seed,
                    jag + (strip ? 2 : 1),
                    strip
                )
                : pts;
            if (opts.shadow !== false) {
                g.fillStyle(0x061428, 0.16);
                fillPts(g, shiftPts(deckle, (opts.shadowX || 16) + 10, (opts.shadowY || 22) + 12));
                g.fillStyle(0x061428, opts.shadowAlpha == null ? 0.5 : opts.shadowAlpha);
                fillPts(g, shiftPts(deckle, opts.shadowX || 16, opts.shadowY || 22));
            }
            if (deckleOn) {
                g.fillStyle(this.isCream(color) ? 0xf7f1e6 : 0xf4ead8, 1);
                fillPts(g, deckle);
                deckleWhiskers(g, deckle, seed);
            }
            g.fillStyle(darken(color, 0.1), 1);
            fillPts(g, shiftPts(pts, 2, 3));
            g.fillStyle(color, opts.alpha == null ? 1 : opts.alpha);
            fillPts(g, pts);
            if (opts.fibers === 'light') {
                paperMottle(g, cx, cy, w, h, seed, color);
            } else if (opts.fibers !== false) {
                pulpSpecks(g, cx, cy, w, h, seed, color);
                paperMottle(g, cx, cy, w, h, seed, color);
            }
            return pts;
        },

        drawDisc: function (g, x, y, r, color, seed, opts) {
            opts = opts || {};
            var pts = discPts(x, y, r, seed);
            var deckle = expandPts(pts, x, y, 5);
            if (opts.shadow !== false) {
                g.fillStyle(0x061428, 0.16);
                fillPts(g, shiftPts(deckle, 10, 14));
                g.fillStyle(0x061428, 0.4);
                fillPts(g, shiftPts(deckle, 6, 9));
            }
            g.fillStyle(0xf7f1e6, 1);
            fillPts(g, deckle);
            g.fillStyle(darken(color, 0.08), 1);
            fillPts(g, shiftPts(pts, 2, 3));
            g.fillStyle(color, 1);
            fillPts(g, pts);
            pulpSpecks(g, x, y, r * 2, r * 2, seed, color);
            paperMottle(g, x, y, r * 2, r * 2, seed, color);
        },

        drawHeart: function (g, x, y, s, color, seed) {
            color = color || 0xd45a4e;
            var pts = heartPts(x, y, s);
            var deckle = heartPts(x, y, s * 1.16);
            g.fillStyle(0x061428, 0.34);
            fillPts(g, shiftPts(deckle, 5, 7));
            g.fillStyle(0xf7f1e6, 1);
            fillPts(g, deckle);
            g.fillStyle(0x8a3a36, 1);
            fillPts(g, shiftPts(pts, 2.5, 3.5));
            g.fillStyle(darken(color, 0.12), 1);
            fillPts(g, shiftPts(pts, 1.2, 1.6));
            g.fillStyle(color, 1);
            fillPts(g, pts);
            g.fillStyle(lighten(color, 0.22), 0.45);
            g.fillEllipse(x - s * 0.18, y - s * 0.22, s * 0.42, s * 0.28);
            pulpSpecks(g, x, y, s * 2.2, s * 2.2, seed || 1, color);
        },

        overlayFiber: function (scene, x, y, w, h, seed, opts) {
            opts = opts || {};
            var key = scene.textures.exists('paper-kraft') ? 'paper-kraft'
                : (scene.textures.exists('paper-pulp') ? 'paper-pulp'
                    : (scene.textures.exists('paper-grain-d') ? 'paper-grain-d' : null));
            if (!key) return null;
            var jag = opts.jag == null ? 7 : opts.jag;
            var fiber = scene.add.tileSprite(x, y, w, h, key);
            fiber.setDepth(opts.depth == null ? -89 : opts.depth);
            if (key === 'paper-kraft') {
                fiber.setBlendMode(Phaser.BlendModes.MULTIPLY);
                fiber.setAlpha(opts.alpha == null ? 0.22 : opts.alpha);
            } else {
                fiber.setBlendMode(Phaser.BlendModes.OVERLAY);
                fiber.setAlpha(opts.alpha == null ? 0.24 : opts.alpha);
            }
            if (opts.angle) fiber.setAngle(opts.angle);
            var maskG = scene.make.graphics({ x: x, y: y, add: false });
            if (opts.angle) maskG.setAngle(opts.angle);
            this.fillMask(maskG, 0, 0, w, h, seed, jag, opts.strip);
            fiber.setMask(maskG.createGeometryMask());
            return fiber;
        },

        addScrap: function (scene, x, y, w, h, color, seed, opts) {
            opts = opts || {};
            var g = scene.add.graphics();
            g.setPosition(x, y);
            g.setDepth(opts.depth == null ? -90 : opts.depth);
            if (opts.angle) g.setAngle(opts.angle);
            this.drawScrap(g, 0, 0, w, h, color, seed, opts);
            return g;
        },

        addHeart: function (scene, x, y, s, seed, depth) {
            var g = scene.add.graphics();
            g.setPosition(x, y);
            g.setDepth(depth == null ? 34 : depth);
            this.drawHeart(g, 0, 0, s, 0xde3449, seed);
            return g;
        },

        addStar: function (scene, x, y, r, seed, depth) {
            var d = depth == null ? -70 : depth;
            var g = scene.add.graphics();
            g.setDepth(d);
            var rand = mulberry32((seed || 1) >>> 0);
            var pts = [];
            var deckle = [];
            var i;
            for (i = 0; i < 10; i++) {
                var ang = -Math.PI / 2 + i * Math.PI / 5;
                var rad = (i % 2 === 0 ? r : r * 0.4) * (0.86 + rand() * 0.22);
                pts.push({ x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad });
                deckle.push({
                    x: x + Math.cos(ang) * rad * 1.14,
                    y: y + Math.sin(ang) * rad * 1.14
                });
            }
            g.fillStyle(0x061428, 0.2);
            fillPts(g, shiftPts(deckle, 12, 16));
            g.fillStyle(0x061428, 0.46);
            fillPts(g, shiftPts(deckle, 7, 10));
            g.fillStyle(0xf7f1e6, 1);
            fillPts(g, deckle);
            g.fillStyle(0xa67c06, 1);
            fillPts(g, shiftPts(pts, 2.4, 3.2));
            g.fillStyle(0xf0c107, 1);
            fillPts(g, pts);
            g.fillStyle(0xffe37a, 0.42);
            g.fillEllipse(x - r * 0.18, y - r * 0.22, r * 0.42, r * 0.28);
            pulpSpecks(g, x, y, r * 2.2, r * 2.2, seed || 1, 0xf0c107);
            return g;
        },

        addScissors: function (scene, x, y) {
            var g = scene.add.graphics();
            g.setPosition(x, y);
            g.setDepth(-56);
            g.setAngle(-30);

            function oval(cx, cy, w, h, color) {
                g.fillStyle(color, 1);
                g.fillEllipse(cx, cy, w, h);
            }

            g.fillStyle(0x1e2a44, 0.3);
            g.fillEllipse(-34, 30, 48, 34);
            g.fillEllipse(-6, 46, 48, 34);
            g.fillTriangle(10, 10, 92, -6, 16, 28);

            oval(-40, 18, 50, 38, 0xf7f1e6);
            oval(-40, 18, 42, 30, 0x2a5aaa);
            oval(-40, 18, 18, 14, 0x1a3a72);

            oval(-10, 40, 50, 38, 0xf7f1e6);
            oval(-10, 40, 42, 30, 0x2a5aaa);
            oval(-10, 40, 18, 14, 0x1a3a72);

            var bladeA = [
                { x: 8, y: -8 },
                { x: 96, y: -24 },
                { x: 104, y: -8 },
                { x: 16, y: 8 }
            ];
            var bladeB = [
                { x: 10, y: 6 },
                { x: 98, y: 22 },
                { x: 104, y: 8 },
                { x: 18, y: -6 }
            ];
            g.fillStyle(0xf7f1e6, 1);
            fillPts(g, shiftPts(bladeA, 2, 2));
            fillPts(g, shiftPts(bladeB, 2, 2));
            g.fillStyle(0xd6d2c8, 1);
            fillPts(g, bladeA);
            g.fillStyle(0xc6c2b8, 1);
            fillPts(g, bladeB);
            pulpSpecks(g, 56, -6, 90, 28, 41, 0xd6d2c8);

            oval(12, 2, 18, 18, 0xf7f1e6);
            oval(12, 2, 12, 12, 0x8a8478);
            oval(12, 2, 5, 5, 0x5a564c);
            return g;
        },

        cutTitle: function (scene, x, y, word, fontSize) {
            this.addStar(scene, x - 210, y + 8, 16, 21, 5);
            this.addStar(scene, x + 198, y - 6, 12, 22, 5);
            function titleText(tx, ty, color, depth, alpha) {
                var t = scene.add.text(tx, ty, word, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: fontSize + 'px',
                    fontStyle: 'bold',
                    color: color
                }).setOrigin(0.5).setDepth(depth);
                if (alpha != null) t.setAlpha(alpha);
                return t;
            }
            titleText(x + 8, y + 12, '#061428', 6.2, 0.4);
            titleText(x, y - 8, '#f3ead8', 7);
            this.addStar(scene, x + 48, y - 20, 14, 9, 8);
        },

        create: function (scene) {
            this.generate(scene);
            var W = scene.scale.width;
            var H = scene.scale.height;
            var objects = [];

            var deskKey = scene.textures.exists('paper-desk') ? 'paper-desk' : 'paper-desk-e';
            var navy = scene.add.tileSprite(W / 2, H / 2, W + 16, H + 16, deskKey);
            navy.setDepth(-100);
            objects.push(navy);

            var scraps = [
                { x: 70, y: 130, w: 240, h: 180, c: 0x47a798, s: 11, a: -12 },
                { x: 700, y: 70, w: 200, h: 150, c: 0xd28e43, s: 22, a: 14 },
                { x: 70, y: 1140, w: 280, h: 220, c: 0x47a798, s: 33, a: 12 },
                { x: 680, y: 1180, w: 240, h: 180, c: 0xd28e43, s: 44, a: -9 }
            ];
            var i;
            for (i = 0; i < scraps.length; i++) {
                var s = scraps[i];
                objects.push(this.addScrap(scene, s.x, s.y, s.w, s.h, s.c, s.s, {
                    depth: -90,
                    jag: 10,
                    shadowX: 16,
                    shadowY: 22,
                    angle: s.a,
                    raw: true,
                    fibers: 'light'
                }));
            }

            objects.push(this.addStar(scene, 80, 430, 22, 1, -70));
            objects.push(this.addStar(scene, 640, 500, 16, 2, -70));
            objects.push(this.addStar(scene, 120, 860, 18, 3, -70));
            objects.push(this.addStar(scene, 600, 900, 20, 4, -70));
            objects.push(this.addStar(scene, 48, 640, 14, 5, -70));
            objects.push(this.addStar(scene, 680, 720, 12, 6, -70));
            objects.push(this.addStar(scene, 360, 118, 15, 7, -70));

            scene.events.once('shutdown', function () {
                for (var k = 0; k < objects.length; k++) {
                    scene.tweens.killTweensOf(objects[k]);
                }
            });
        }
    };

    window.Paper = Paper;
})();
