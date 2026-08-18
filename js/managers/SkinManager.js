var SKINS = [
    {
        id: 'spark',
        name: 'Искра',
        description: 'Яркая точка — с неё начинается путь',
        requiredWins: 0,
        shape: 'circle',
        coreColor: 0xfff6ea,
        strokeColor: 0x111111,
        glowColor: 0x111111,
        trailColor: 0xffffff,
        dangerColor: 0xff2244,
        trailWidth: 4
    },
    {
        id: 'comet',
        name: 'Бензопила',
        description: 'Пила смотрит туда, куда едешь',
        requiredWins: 10,
        shape: 'saw',
        coreColor: 0x6d7480,
        strokeColor: 0xd7dde4,
        glowColor: 0x47a798,
        trailColor: 0xc5c9ce,
        dangerColor: 0xff4f83,
        trailWidth: 6
    },
    {
        id: 'pulsar',
        name: 'Меч джедая',
        description: 'Светящийся клинок по курсу движения',
        requiredWins: 20,
        shape: 'saber',
        coreColor: 0x48f0a0,
        strokeColor: 0xf3ead8,
        glowColor: 0x2ce6a0,
        trailColor: 0x7dffc4,
        dangerColor: 0xff143d,
        trailWidth: 5
    },
    {
        id: 'wisp',
        name: 'Единорог',
        description: 'Рог смотрит по курсу, сзади короткий радужный след',
        requiredWins: 30,
        shape: 'unicorn',
        rainbow: true,
        coreColor: 0xff7ad9,
        strokeColor: 0xffffff,
        glowColor: 0xffb0e8,
        trailColor: 0xff7ad9,
        dangerColor: 0xff356d,
        trailWidth: 8
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

