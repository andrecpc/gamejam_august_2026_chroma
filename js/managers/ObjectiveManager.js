/**
 * Цели и ограничения уровня.
 *
 * Контракт constraints:
 * - time: секунды до поражения;
 * - coverPercent: требуемый процент площади, срезанной игроком;
 * - maxCuts: максимум успешных срезов;
 * - winCondition: "vials", "coverage", "all", "boss" или "catch";
 * - catchEnemies: сколько врагов нужно отсечь контуром.
 */
export class ObjectiveManager {
    constructor(scene, level, field, vials) {
        this.scene = scene;
        this.field = field;
        this.vials = vials;
        this.cfg = level.constraints || {};
        this.timeLimit = this.cfg.time || this.cfg.timeLimit || 0;
        this.coverTarget = this.cfg.coverPercent || 0;
        this.maxCuts = this.cfg.maxCuts || 0;
        this.catchTarget = this.cfg.catchEnemies || 0;
        this.caught = 0;
        this.winCondition = this.cfg.winCondition ||
            (this.catchTarget > 0 ? 'catch' :
                (this.coverTarget > 0 ? 'coverage' : 'vials'));
        this.startedAt = scene.time.now;
        this.cuts = 0;
        this.finished = false;
        this.lastSignature = '';
    }

    _bossDone() {
        if (!this.scene.bossManager || !this.scene.bossManager.active) return true;
        return !!this.scene.bossManager.defeated;
    }

    update() {
        if (this.finished) return null;
        var snapshot = this.snapshot();
        this._emit(snapshot);
        if (this.timeLimit > 0 && snapshot.timeLeft <= 0) {
            this.finished = true;
            return { lose: true, reason: 'ВРЕМЯ ВЫШЛО', loseKind: 'time' };
        }
        return null;
    }

    onSuccessfulCut(caughtCount) {
        if (this.finished) return null;
        this.cuts++;
        this.caught += Math.max(0, caughtCount || 0);
        var result = this._evaluate();
        this._emit(this.snapshot());
        if (result) this.finished = true;
        return result;
    }

    evaluateNow() {
        if (this.finished) return null;
        var result = this._evaluate();
        this._emit(this.snapshot());
        if (result) this.finished = true;
        return result;
    }

    _evaluate() {
        var coverageDone = this.coverTarget <= 0 ||
            this.coveragePercent() >= this.coverTarget;
        var vialsDone = this.vials.allDone();
        var catchDone = this.catchTarget <= 0 || this.caught >= this.catchTarget;
        var won = false;

        if (this.winCondition === 'boss') won = this._bossDone();
        else if (this.winCondition === 'coverage') won = coverageDone;
        else if (this.winCondition === 'catch') won = catchDone;
        else if (this.winCondition === 'all') {
            won = coverageDone && vialsDone && catchDone && this._bossDone();
        }
        else won = vialsDone;

        if (won) return { win: true };
        if (this.maxCuts > 0 && this.cuts >= this.maxCuts) {
            return { lose: true, reason: 'СРЕЗЫ ЗАКОНЧИЛИСЬ', loseKind: 'cuts' };
        }
        return null;
    }

    grantExtraTime(seconds) {
        this.timeLimit += Math.max(0, seconds || 0);
        this.finished = false;
        this._emit(this.snapshot());
    }

    grantExtraCuts(n) {
        this.maxCuts += Math.max(0, n || 0);
        this.finished = false;
        this._emit(this.snapshot());
    }

    coveragePercent() {
        if (!this.field.totalArea) return 0;
        return Math.min(100,
            this.field.playerClaimedArea / this.field.totalArea * 100);
    }

    snapshot() {
        var elapsed = (this.scene.time.now - this.startedAt) / 1000;
        return {
            timeLeft: this.timeLimit > 0
                ? Math.max(0, Math.ceil(this.timeLimit - elapsed))
                : null,
            cuts: this.cuts,
            maxCuts: this.maxCuts || null,
            caught: this.caught,
            catchTarget: this.catchTarget || null,
            coverage: Math.floor(this.coveragePercent()),
            coverTarget: this.coverTarget || null,
            winCondition: this.winCondition
        };
    }

    _emit(snapshot) {
        var signature = JSON.stringify(snapshot);
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;
        this.scene.game.events.emit('game:objectives-changed', snapshot);
    }
}
