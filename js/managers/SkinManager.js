var SKINS = [
    {
        id: 'spark',
        name: 'Искра',
        description: 'Яркая точка — с неё начинается путь',
        requiredWins: 0,
        shape: 'circle',
        coreColor: 0xffffff,
        strokeColor: 0xfff6c8,
        glowColor: 0xffffff,
        trailColor: 0xffffff,
        dangerColor: 0xff2244,
        trailWidth: 4
    },
    {
        id: 'comet',
        name: 'Комета',
        description: 'Хвостатый клин, смотрит туда, куда едешь',
        requiredWins: 10,
        shape: 'comet',
        coreColor: 0x7dfff1,
        strokeColor: 0xe8ffff,
        glowColor: 0x2ce6d0,
        trailColor: 0x7dfff1,
        dangerColor: 0xff4f83,
        trailWidth: 6
    },
    {
        id: 'pulsar',
        name: 'Пульсар',
        description: 'Шестигранник, который медленно крутится',
        requiredWins: 20,
        shape: 'hex',
        coreColor: 0xff8a3d,
        strokeColor: 0xfff0b5,
        glowColor: 0xff5c2c,
        trailColor: 0xffc25c,
        dangerColor: 0xff143d,
        trailWidth: 5
    },
    {
        id: 'wisp',
        name: 'Блуждающий огонь',
        description: 'Полупрозрачный дух с широким следом',
        requiredWins: 30,
        shape: 'wisp',
        coreColor: 0xb07cff,
        strokeColor: 0xf2deff,
        glowColor: 0xdabaff,
        trailColor: 0xe4c7ff,
        dangerColor: 0xff356d,
        trailWidth: 7
    }
];

export var SkinManager = {
    list: function () {
        return SKINS.slice();
    },

    get: function (id) {
        for (var i = 0; i < SKINS.length; i++) {
            if (SKINS[i].id === id) return SKINS[i];
        }
        return SKINS[0];
    },

    isUnlocked: function (skin) {
        var need = skin.requiredWins || 0;
        if (need <= 0) return true;
        return GameSettings.completedInPack('campaign') >= need;
    },

    selectedId: function () {
        var id = GameSettings.get('selectedSkin') || 'spark';
        var skin = this.get(id);
        return this.isUnlocked(skin) ? skin.id : 'spark';
    },

    selected: function () {
        return this.get(this.selectedId());
    },

    select: function (id) {
        var skin = this.get(id);
        if (!this.isUnlocked(skin)) return false;
        GameSettings.set('selectedSkin', skin.id);
        return true;
    }
};
