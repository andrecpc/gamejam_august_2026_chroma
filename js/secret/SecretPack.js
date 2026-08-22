/*
 * Изолированный пак «???».
 * Чтобы спрятать раздел, поставь enabled: false — кнопка и уровни исчезнут,
 * остальные паки не затронуты.
 */
(function () {
    'use strict';

    var BOUNDS = { x: 40, y: 130, w: 640, h: 640, frame: 28 };
    var INNER = { x: 68, y: 158, w: 584, h: 584 };

    function rect(id, color, x, y, w, h) {
        return {
            id: id,
            color: color,
            points: [
                { x: x, y: y },
                { x: x + w, y: y },
                { x: x + w, y: y + h },
                { x: x, y: y + h }
            ]
        };
    }

    function claimedInner() {
        return [{
            points: [
                { x: INNER.x, y: INNER.y },
                { x: INNER.x + INNER.w, y: INNER.y },
                { x: INNER.x + INNER.w, y: INNER.y + INNER.h },
                { x: INNER.x, y: INNER.y + INNER.h }
            ]
        }];
    }

    function base(extra) {
        var level = {
            lives: 3,
            playerSpeed: 210,
            bounds: {
                x: BOUNDS.x,
                y: BOUNDS.y,
                w: BOUNDS.w,
                h: BOUNDS.h,
                frame: BOUNDS.frame
            },
            enemies: [],
            boosters: [],
            constraints: {},
            magneticPaths: [],
            tutorials: [],
            pack: 'secret'
        };
        var key;
        for (key in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, key)) {
                level[key] = extra[key];
            }
        }
        return level;
    }

    function wedges() {
        var cx = INNER.x + INNER.w / 2;
        var cy = INNER.y + INNER.h / 2;
        var pts = [
            { x: INNER.x, y: INNER.y },
            { x: cx, y: INNER.y },
            { x: INNER.x + INNER.w, y: INNER.y },
            { x: INNER.x + INNER.w, y: cy },
            { x: INNER.x + INNER.w, y: INNER.y + INNER.h },
            { x: cx, y: INNER.y + INNER.h },
            { x: INNER.x, y: INNER.y + INNER.h },
            { x: INNER.x, y: cy }
        ];
        var colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];
        var out = [];
        var i;
        for (i = 0; i < 8; i++) {
            out.push({
                id: 'wedge_' + i,
                color: colors[i],
                points: [
                    { x: cx, y: cy },
                    pts[i],
                    pts[(i + 1) % 8]
                ]
            });
        }
        return out;
    }

    function tetromino(prefix, ox, oy, cells, size) {
        var out = [];
        var i;
        for (i = 0; i < cells.length; i++) {
            out.push(rect(
                prefix + '_' + i,
                'red',
                ox + cells[i][0] * size,
                oy + cells[i][1] * size,
                size,
                size
            ));
        }
        return out;
    }

    function houseSticker() {
        return [
            rect('sun', 'yellow', 520, 168, 120, 120),
            rect('sky_l', 'blue', 68, 158, 452, 220),
            rect('sky_sun_top', 'blue', 520, 158, 132, 10),
            rect('sky_sun_right', 'blue', 640, 168, 12, 120),
            rect('sky_sun_bot', 'blue', 520, 288, 132, 90),
            rect('sky_roof_l', 'blue', 68, 378, 82, 100),
            rect('sky_roof_r', 'blue', 570, 378, 82, 100),
            rect('roof', 'red', 150, 378, 420, 100),
            rect('yard_l', 'green', 68, 478, 112, 160),
            rect('yard_r', 'green', 540, 478, 112, 160),
            rect('wall_l', 'orange', 180, 478, 130, 160),
            rect('wall_r', 'orange', 410, 478, 130, 160),
            rect('wall_mid', 'orange', 310, 478, 100, 60),
            rect('door', 'purple', 310, 538, 100, 100),
            rect('grass', 'green', 68, 638, 584, 104)
        ];
    }

    function orbitSquares() {
        var colors = ['red', 'blue', 'yellow', 'green'];
        var cx = INNER.x + INNER.w / 2;
        var cy = INNER.y + INNER.h / 2;
        var r = 175;
        var size = 148;
        var out = [];
        var i;
        for (i = 0; i < 4; i++) {
            var a = i * Math.PI / 2;
            var sx = cx + Math.cos(a) * r - size / 2;
            var sy = cy + Math.sin(a) * r - size / 2;
            out.push(rect('sq_' + i, colors[i], sx, sy, size, size));
        }
        return out;
    }

    function startTip(id, text) {
        return [{
            id: id,
            trigger: 'start',
            persist: 'until-move',
            text: text
        }];
    }

    function grid9() {
        var colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'red', 'blue', 'yellow'];
        var cw = INNER.w / 3;
        var ch = INNER.h / 3;
        var out = [];
        var i;
        for (i = 0; i < 9; i++) {
            var col = i % 3;
            var row = Math.floor(i / 3);
            out.push(rect('cell_' + i, colors[i], INNER.x + col * cw, INNER.y + row * ch, cw, ch));
        }
        return out;
    }

    var PAPER = { x: 108, y: 198, w: 504, h: 504 };
    var TAPE_OUT = 40;
    var TAPE_IN = 48;
    var TAPE_ALONG = 44;

    function tapeAndStripes() {
        var tape = [];
        var i;
        var len = TAPE_OUT + TAPE_IN;
        for (i = 0; i < 3; i++) {
            var t = (i + 1) / 4;
            var tx = PAPER.x + PAPER.w * t - TAPE_ALONG / 2;
            var ty = PAPER.y + PAPER.h * t - TAPE_ALONG / 2;
            tape.push(rect('tape_t' + i, 'tape', tx, PAPER.y - TAPE_OUT, TAPE_ALONG, len));
            tape.push(rect('tape_b' + i, 'tape', tx, PAPER.y + PAPER.h - TAPE_IN, TAPE_ALONG, len));
            tape.push(rect('tape_l' + i, 'tape', PAPER.x - TAPE_OUT, ty, len, TAPE_ALONG));
            tape.push(rect('tape_r' + i, 'tape', PAPER.x + PAPER.w - TAPE_IN, ty, len, TAPE_ALONG));
        }
        var sw = PAPER.w / 3;
        return tape.concat([
            rect('stripe_r', 'red', PAPER.x, PAPER.y, sw, PAPER.h),
            rect('stripe_b', 'blue', PAPER.x + sw, PAPER.y, sw, PAPER.h),
            rect('stripe_y', 'yellow', PAPER.x + sw * 2, PAPER.y, sw, PAPER.h)
        ]);
    }

    function circlePoly(id, color, cx, cy, r, n) {
        n = n || 14;
        var pts = [];
        var i;
        for (i = 0; i < n; i++) {
            var a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
            pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        return { id: id, color: color, points: pts };
    }

    function flyingCircles() {
        var r = 52;
        var spots = [
            { id: 'fly_0', color: 'blue', x: 170, y: 250 },
            { id: 'fly_1', color: 'red', x: 540, y: 250 },
            { id: 'fly_2', color: 'blue', x: 355, y: 430 },
            { id: 'fly_3', color: 'red', x: 170, y: 620 },
            { id: 'fly_4', color: 'blue', x: 540, y: 620 },
            { id: 'fly_5', color: 'red', x: 355, y: 250 }
        ];
        return spots.map(function (s) {
            return circlePoly(s.id, s.color, s.x, s.y, r, 16);
        });
    }

    function biomes() {
        var A = 68, B = 180, C = 310, D = 430, E = 540, F = 652;
        var P = 158, Q = 250, R = 360, S = 470, T = 600, U = 742;
        return [
            rect('bio_g0', 'green', A, P, C - A, Q - P),
            rect('bio_o0', 'orange', C, P, E - C, Q - P),
            rect('bio_g1', 'green', E, P, F - E, R - P),
            rect('bio_o1', 'orange', A, Q, B - A, S - Q),
            rect('bio_g2', 'green', B, Q, C - B, R - Q),
            rect('bio_o2', 'orange', C, Q, E - C, R - Q),
            rect('bio_g3', 'green', B, R, D - B, S - R),
            rect('bio_o3', 'orange', D, R, F - D, S - R),
            rect('bio_g4', 'green', A, S, B - A, U - S),
            rect('bio_o4', 'orange', B, S, C - B, T - S),
            rect('bio_g5', 'green', C, S, E - C, T - S),
            rect('bio_o5', 'orange', E, S, F - E, U - S),
            rect('bio_g6', 'green', B, T, D - B, U - T),
            rect('bio_o6', 'orange', D, T, E - D, U - T)
        ];
    }

    function planetArt() {
        var cx = 318;
        var cy = 468;
        var planet = circlePoly('planet', 'blue', cx, cy, 170, 24);
        var ring = [];
        var i;
        var segs = 18;
        for (i = 0; i < segs; i++) {
            var t0 = (i / segs) * Math.PI * 2;
            var t1 = ((i + 1) / segs) * Math.PI * 2;
            var rx = 236;
            var ry = 62;
            var tilt = 0.36;
            function rp(t, k) {
                var x = Math.cos(t) * rx * k;
                var y = Math.sin(t) * ry * k;
                return {
                    x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
                    y: cy + 10 + x * Math.sin(tilt) + y * Math.cos(tilt)
                };
            }
            ring.push({
                id: 'ring_' + i,
                color: 'orange',
                points: [rp(t0, 1), rp(t1, 1), rp(t1, 0.84), rp(t0, 0.84)]
            });
        }
        var rocket = [
            { id: 'rocket_body', color: 'red', points: [
                { x: 512, y: 196 }, { x: 576, y: 216 }, { x: 548, y: 348 }, { x: 484, y: 328 }
            ]},
            { id: 'rocket_nose', color: 'red', points: [
                { x: 512, y: 196 }, { x: 556, y: 128 }, { x: 576, y: 216 }
            ]},
            { id: 'rocket_fin_l', color: 'red', points: [
                { x: 484, y: 328 }, { x: 448, y: 392 }, { x: 512, y: 352 }
            ]},
            { id: 'rocket_fin_r', color: 'red', points: [
                { x: 548, y: 348 }, { x: 604, y: 404 }, { x: 572, y: 332 }
            ]},
            { id: 'rocket_window', color: 'orange', points: [
                { x: 528, y: 236 }, { x: 552, y: 244 }, { x: 544, y: 272 }, { x: 520, y: 264 }
            ]},
            { id: 'rocket_flame', color: 'orange', points: [
                { x: 496, y: 340 }, { x: 528, y: 438 }, { x: 560, y: 356 }
            ]}
        ];
        return [planet].concat(ring).concat(rocket);
    }

    var ROLL = { x: 120, y: 196, w: 480, h: 76 };

    function rollAndBase() {
        var tape = [];
        var i;
        var along = 40;
        var out = 36;
        var inn = 14;
        var len = out + inn;
        for (i = 0; i < 3; i++) {
            var t = (i + 1) / 4;
            var tx = ROLL.x + ROLL.w * t - along / 2;
            tape.push(rect('tape_t' + i, 'tape', tx, ROLL.y - out, along, len));
            tape.push(rect('tape_b' + i, 'tape', tx, ROLL.y + ROLL.h - inn, along, len));
        }
        return tape.concat([
            rect('roll_0', 'blue', ROLL.x, ROLL.y, ROLL.w, ROLL.h),
            rect('base_0', 'green', 68, 318, 584, 424)
        ]);
    }

    function buildLevels() {
        var block = 52;
        return [
            base({
                id: 1,
                name: 'Карусель',
                hint: 'заезжай в цвет и стой — поле само чертит пунктир',
                vials: [
                    { color: 'red' }, { color: 'blue' }, { color: 'yellow' },
                    { color: 'green' }, { color: 'purple' }, { color: 'orange' },
                    { color: 'cyan' }, { color: 'pink' }
                ],
                polygons: wedges(),
                tutorials: startTip('secret_spin', 'Режь как обычно, но поле будет вращаться.'),
                secret: { rotate: true }
            }),
            base({
                id: 2,
                name: 'Запретка',
                hint: 'наполни синие корзины и не режь красное',
                constraints: { note: 'Красный резать нельзя' },
                tutorials: startTip('secret_nored', 'Красный резать нельзя'),
                vials: [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
                polygons: tetromino('t', 110, 190, [[0, 0], [1, 0], [2, 0], [1, 1]], block)
                    .concat(tetromino('l', 430, 210, [[0, 0], [0, 1], [0, 2], [1, 2]], block))
                    .concat(tetromino('s', 160, 470, [[1, 0], [2, 0], [0, 1], [1, 1]], block))
                    .concat(tetromino('j', 440, 500, [[1, 0], [1, 1], [1, 2], [0, 2]], block))
                    .concat(tetromino('z', 280, 340, [[0, 0], [1, 0], [1, 1], [2, 1]], block))
                    .concat([rect('field_blue', 'blue', INNER.x, INNER.y, INNER.w, INNER.h)]),
                secret: { forbidColor: 'red' }
            }),
            base({
                id: 3,
                name: 'Стикер',
                hint: 'радужная корзина примет любой цвет',
                vials: [{ color: 'rainbow' }],
                polygons: houseSticker(),
                tutorials: startTip('secret_rainbow', 'Заполни радужную корзину любым цветом'),
                secret: { sticker: true, rainbow: true, vialFillRatio: 0.95 }
            }),
            base({
                id: 4,
                name: 'Квартет',
                hint: 'четыре квадрата едут по кругу — успей отрезать',
                vials: [
                    { color: 'red' }, { color: 'blue' },
                    { color: 'yellow' }, { color: 'green' }
                ],
                polygons: orbitSquares(),
                claimed: claimedInner(),
                tutorials: startTip('secret_orbit', 'Режь как обычно, но цвета будут двигаться.'),
                secret: { orbitSquares: true }
            }),
            base({
                id: 5,
                name: 'Хамелеон',
                hint: 'цвета прыгают, корзины — нет',
                vials: [
                    { color: 'red' }, { color: 'blue' }, { color: 'yellow' },
                    { color: 'green' }, { color: 'purple' }, { color: 'orange' }
                ],
                polygons: grid9(),
                tutorials: startTip('secret_shuffle', 'Цвета меняются'),
                secret: { shuffleMs: 3000 }
            }),
            base({
                id: 6,
                name: 'Скотч',
                hint: 'сначала обрежь скотч по краям',
                tutorials: startTip('secret_tape', 'Сначала обрежь скотч по краям'),
                vials: [{ color: 'red' }, { color: 'blue' }, { color: 'yellow' }],
                polygons: tapeAndStripes(),
                claimed: claimedInner(),
                enemies: [{ type: 'chase', x: 360, y: 430, speed: 62 }],
                secret: {
                    tapeGate: true,
                    paper: { x: PAPER.x, y: PAPER.y, w: PAPER.w, h: PAPER.h }
                }
            }),
            base({
                id: 7,
                name: 'Шары',
                hint: 'синие в корзины, красные не режь',
                constraints: { note: 'Красный резать нельзя' },
                tutorials: startTip(
                    'secret_balls',
                    'С разных сторон летят круги. Синие режь в корзины, красные трогать нельзя.'
                ),
                vials: [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
                polygons: flyingCircles(),
                claimed: claimedInner(),
                secret: { forbidColor: 'red', flyers: true }
            }),
            base({
                id: 8,
                name: 'Биомы',
                hint: 'восстанови лес на всём поле',
                tutorials: startTip(
                    'secret_biome',
                    'Отрезай куски: дыра зарастает биомом, которого больше среди соседей. Верни лес на всё поле.'
                ),
                vials: [],
                polygons: biomes(),
                claimed: claimedInner(),
                constraints: { winCondition: 'secret' },
                secret: { biome: true, forest: 'green', desert: 'orange' }
            }),
            base({
                id: 9,
                name: 'Орбита',
                hint: 'наполняй корзины как обычно',
                tutorials: startTip('secret_planet', 'наполняй корзины как обычно'),
                vials: [{ color: 'blue' }, { color: 'orange' }, { color: 'red' }],
                polygons: planetArt(),
                claimed: claimedInner(),
                secret: { sticker: true, fitVials: true }
            }),
            base({
                id: 10,
                name: 'Рулон',
                hint: 'сначала первая корзина, потом скотч и второй лист',
                tutorials: startTip(
                    'secret_roll',
                    'Заполни первую корзину, разверни второй лист, заполни вторую корзину.'
                ),
                vials: [{ color: 'green' }, { color: 'blue' }],
                polygons: rollAndBase(),
                claimed: claimedInner(),
                secret: {
                    sequentialTape: true,
                    paper: { x: ROLL.x, y: ROLL.y, w: ROLL.w, h: ROLL.h },
                    unroll: {
                        rollId: 'roll_0',
                        to: { x: 68, y: 158, w: 584, h: 200 }
                    }
                }
            }),
            base({
                id: 11,
                name: 'Змейка',
                hint: 'режи с хвоста, не касайся головы',
                tutorials: startTip(
                    'secret_snake',
                    'Отрезай змейку с хвоста, пока она не выросла до 45. Либо отрежь всю змейку целиком. Тело пересекать можно, голову — нельзя.'
                ),
                vials: [],
                polygons: [rect('field_snake', 'purple', INNER.x, INNER.y, INNER.w, INNER.h)],
                constraints: {
                    winCondition: 'secret',
                    note: 'Не дай змейке стать длины 45  •  Либо отрежь всю змейку целиком'
                },
                secret: { snake: true, snakeMax: 45, snakeStart: 30 }
            })
        ];
    }

    window.SecretPack = {
        enabled: true,
        PACK_ID: 'secret',
        TITLE: '???',
        INNER: INNER,
        ORBIT: { radius: 175, size: 148 },

        isEnabled: function () {
            return !!this.enabled;
        },

        mergeInto: function (root) {
            if (!root || root._secretMerged) return root;
            root._secretMerged = true;
            if (!this.enabled) return root;
            root.packs = root.packs || {};
            root.packs.secret = {
                id: 'secret',
                title: '???',
                unlock: 'sequential'
            };
            root.palette = Object.assign({
                orange: '#ff8a3d',
                cyan: '#2ce6d0',
                pink: '#ff5ca8',
                lime: '#9be15d',
                tape: '#f4ead8',
                rainbow: '#ff4d6d'
            }, root.palette || {});
            root.levels = (root.levels || []).concat(buildLevels());
            return root;
        }
    };
})();
