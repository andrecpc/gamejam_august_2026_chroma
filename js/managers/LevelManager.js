/**
 * Единый контракт уровня. Никаких захардкоженных параметров в сущностях —
 * всё читается отсюда.
 *
 * Уровни лежат в паках: campaign (игра), training (обучение), lab (лаборатория).
 */
var DEFAULT_PALETTE = {
    red: 0xff4d6d,
    blue: 0x4a9fff,
    yellow: 0xffd24a,
    green: 0x3ee6a0,
    purple: 0xb07cff,
    orange: 0xff8a3d,
    cyan: 0x2ce6d0,
    pink: 0xff5ca8,
    lime: 0x9be15d,
    tape: 0xf4ead8,
    rainbow: 0xff4d6d
};

export var LevelManager = {
    DEFAULT_PACK: 'training',

    getRoot: function (scene) {
        var root = scene.cache.json.get('levels');
        if (window.SecretPack && SecretPack.mergeInto) SecretPack.mergeInto(root);
        return root;
    },

    packs: function (scene) {
        var root = this.getRoot(scene);
        return (root && root.packs) || {};
    },

    packMeta: function (scene, packId) {
        var packs = this.packs(scene);
        return packs[packId] || {
            id: packId,
            title: packId,
            unlock: 'sequential'
        };
    },

    list: function (scene, packId) {
        var root = this.getRoot(scene);
        var levels = (root && root.levels) || [];
        if (!packId) return levels.slice();
        return levels.filter(function (level) {
            return (level.pack || 'training') === packId;
        }).sort(function (a, b) {
            return a.id - b.id;
        });
    },

    count: function (scene, packId) {
        return this.list(scene, packId).length;
    },

    get: function (scene, id, packId) {
        packId = packId || this.DEFAULT_PACK;
        var levels = this.list(scene, packId);
        for (var i = 0; i < levels.length; i++) {
            if (levels[i].id === id) {
                return this.normalize(packPalette(scene), levels[i], packId);
            }
        }
        return null;
    },

    isUnlocked: function (scene, packId, id) {
        if (window.QAMode && QAMode.enabled) return true;
        var meta = this.packMeta(scene, packId);
        if (meta.unlock === 'all') return true;
        return id <= GameSettings.unlockedInPack(packId);
    },

    normalize: function (palette, raw, packId) {
        var level = JSON.parse(JSON.stringify(raw));
        level.pack = packId || level.pack || this.DEFAULT_PACK;
        level.lives = level.lives || 3;
        level.playerSpeed = level.playerSpeed || 210;
        level.bounds = level.bounds || { x: 40, y: 130, w: 640, h: 640, frame: 28 };
        level.vials = level.vials || [];
        level.enemies = level.enemies || [];
        level.boosters = level.boosters || [];
        level.boss = level.boss || null;
        level.constraints = level.constraints || {};
        level.polygons = level.polygons || [];
        level.magneticPaths = level.magneticPaths || [];
        level.tutorials = level.tutorials || [];
        level.hint = level.hint || '';
        level.secret = level.secret || null;
        level.claimed = level.claimed || [];
        level.palette = Object.assign({}, DEFAULT_PALETTE, palette, level.palette || {});
        return level;
    }
};

function packPalette(scene) {
    var pack = scene.cache.json.get('levels');
    if (!pack || !pack.palette) return {};
    var out = {};
    Object.keys(pack.palette).forEach(function (k) {
        var v = pack.palette[k];
        out[k] = typeof v === 'number' ? v : parseInt(String(v).replace('#', ''), 16);
    });
    return out;
}
