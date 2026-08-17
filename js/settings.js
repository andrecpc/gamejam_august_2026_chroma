/*
 * settings.js
 * Хранилище настроек игры. Сохраняется в localStorage браузера,
 * поэтому переживает перезагрузку страницы.
 *
 * Тут же лежит прогресс по уровням (какой уровень последний открыт).
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'gj_settings_v1';

    // Значения по умолчанию (при первом запуске)
    var defaults = {
        musicOn: true,
        sfxOn: true,
        musicVolume: 0.5, // 0..1
        sfxVolume: 0.7,   // 0..1
        hapticsOn: true,
        reducedMotion: false,
        maxUnlockedLevel: 1,
        unlockedPacks: { training: 1, campaign: 1 },
        completedPacks: { training: 0, campaign: 0 },
        seenTutorials: [],
        selectedSkin: 'spark'
    };

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return Object.assign({}, defaults);
            var parsed = JSON.parse(raw);
            // Подмешиваем дефолты — на случай если добавятся новые поля
            return Object.assign({}, defaults, parsed);
        } catch (e) {
            return Object.assign({}, defaults);
        }
    }

    var state = load();
    state.unlockedPacks = Object.assign({ training: 1, campaign: 1 }, state.unlockedPacks || {});
    state.completedPacks = Object.assign({ training: 0, campaign: 0 }, state.completedPacks || {});
    if (!state.completedPacks.campaign && (state.unlockedPacks.campaign || 1) > 1) {
        state.completedPacks.campaign = Math.max(0, (state.unlockedPacks.campaign || 1) - 1);
    }
    if (!Array.isArray(state.seenTutorials)) state.seenTutorials = [];

    var GameSettings = {
        // Прочитать значение
        get: function (key) {
            return state[key];
        },
        // Записать значение и сразу сохранить
        set: function (key, value) {
            state[key] = value;
            this.save();
        },
        vibrate: function (pattern) {
            if (!state.hapticsOn || !window.navigator || !navigator.vibrate) {
                return false;
            }
            navigator.vibrate(pattern);
            return true;
        },
        reducedMotion: function () {
            return !!state.reducedMotion;
        },
        unlockedInPack: function (packId) {
            var packs = state.unlockedPacks || {};
            if (packId === 'lab') return 99;
            return packs[packId] || 1;
        },
        completedInPack: function (packId) {
            var packs = state.completedPacks || {};
            return packs[packId] || 0;
        },
        completeLevel: function (levelId, packId) {
            packId = packId || 'training';
            if (!state.completedPacks) state.completedPacks = { training: 0, campaign: 0 };
            if (levelId > (state.completedPacks[packId] || 0)) {
                state.completedPacks[packId] = levelId;
            }
            this.unlockLevel(levelId + 1, packId);
        },
        unlockLevel: function (levelNumber, packId) {
            packId = packId || 'training';
            if (!state.unlockedPacks) state.unlockedPacks = { training: 1, campaign: 1 };
            if (levelNumber > (state.unlockedPacks[packId] || 1)) {
                state.unlockedPacks[packId] = levelNumber;
            }
            if ((packId === 'training' || packId === 'campaign') &&
                levelNumber > state.maxUnlockedLevel) {
                state.maxUnlockedLevel = levelNumber;
            }
            this.save();
        },
        resetProgress: function () {
            state.maxUnlockedLevel = 1;
            state.unlockedPacks = { training: 1, campaign: 1 };
            state.completedPacks = { training: 0, campaign: 0 };
            state.seenTutorials = [];
            state.selectedSkin = 'spark';
            this.save();
        },
        hasSeenTutorial: function (id) {
            return (state.seenTutorials || []).indexOf(id) !== -1;
        },
        markTutorialSeen: function (id) {
            if (!state.seenTutorials) state.seenTutorials = [];
            if (state.seenTutorials.indexOf(id) === -1) {
                state.seenTutorials.push(id);
                this.save();
            }
        },
        save: function () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                // localStorage может быть недоступен (приватный режим) — просто игнорируем
            }
        },
        // Сбросить всё к дефолтам (удобно для отладки)
        reset: function () {
            state = Object.assign({}, defaults);
            this.save();
        }
    };

    // Делаем доступным глобально
    window.GameSettings = GameSettings;
})();
