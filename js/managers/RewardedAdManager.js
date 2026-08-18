var REWARDS = [
    { id: 'life', type: 'life', label: '+1 жизнь', color: 0xa14b5c },
    { id: 'removeEnemy', type: 'removeEnemy', label: '−1 враг', color: 0x7a3d52 },
    { id: 'randomBooster', type: 'randomBooster', label: 'Случайный бустер на поле', color: 0x4e4a78 },
    { id: 'speedBooster', type: 'specificBooster', booster: 'speed', label: 'Ускорение на поле', color: 0x3d5f86 },
    { id: 'shieldBooster', type: 'specificBooster', booster: 'shield', label: 'Щит на поле', color: 0x2d6b78 },
    { id: 'slowEnemyBooster', type: 'specificBooster', booster: 'enemySlow', label: 'Заморозка врагов на поле', color: 0x3a6180 },
    { id: 'fillVial', type: 'fillVial', label: 'Заполнить случайную корзину', color: 0x2d7a5e }
];

export class RewardedAdManager {
    constructor(scene, adapter) {
        this.scene = scene;
        this.adapter = adapter || new TestRewardedAdapter();
        this.options = null;
        this.reviveUsed = false;
        this.watching = false;
    }

    getOptions(context) {
        if (this.options) return this.options.slice();
        var pool = REWARDS.filter(function (reward) {
            if (reward.type === 'life' && !context.canAddLife) return false;
            if (reward.type === 'removeEnemy' && !context.hasEnemies) return false;
            if (reward.booster === 'enemySlow' && !context.hasEnemies) {
                return false;
            }
            if (reward.type === 'fillVial' && !context.hasVials) return false;
            return true;
        });
        if (!pool.length) pool = REWARDS.filter(function (reward) {
            return reward.type === 'randomBooster' ||
                reward.type === 'specificBooster';
        });

        this.options = [];
        for (var i = 0; i < 3; i++) {
            var picked = pool[Math.floor(Math.random() * pool.length)];
            this.options.push(Object.assign({}, picked, {
                offerId: picked.id + '_' + i + '_' + Date.now()
            }));
        }
        return this.options.slice();
    }

    claim(offerId) {
        if (this.watching || !this.options) return Promise.resolve(null);
        var option = null;
        for (var i = 0; i < this.options.length; i++) {
            if (this.options[i].offerId === offerId) {
                option = this.options[i];
                break;
            }
        }
        if (!option) return Promise.resolve(null);

        this.watching = true;
        return this._showWithTimeout('bonus_choice').then(function (completed) {
            this.watching = false;
            if (!completed) return null;
            this.options = null;
            return option;
        }.bind(this), function () {
            this.watching = false;
            return null;
        }.bind(this));
    }

    canRevive() {
        return !this.reviveUsed && !this.watching;
    }

    claimRevive() {
        if (!this.canRevive()) return Promise.resolve(false);
        this.watching = true;
        return this._showWithTimeout('revive').then(function (completed) {
            this.watching = false;
            if (completed) this.reviveUsed = true;
            return !!completed;
        }.bind(this), function () {
            this.watching = false;
            return false;
        }.bind(this));
    }

    _showWithTimeout(placement) {
        var timeoutMs = 15000;
        return new Promise(function (resolve) {
            var settled = false;
            var timer = window.setTimeout(function () {
                if (settled) return;
                settled = true;
                resolve(false);
            }, timeoutMs);

            Promise.resolve(this.adapter.show(placement)).then(
                function (completed) {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timer);
                    resolve(!!completed);
                },
                function () {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timer);
                    resolve(false);
                }
            );
        }.bind(this));
    }
}

class TestRewardedAdapter {
    show() {
        return new Promise(function (resolve) {
            window.setTimeout(function () { resolve(true); }, 1400);
        });
    }
}
