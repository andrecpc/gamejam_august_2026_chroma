/**
 * Очередь пробирок. На экране не больше 3.
 * Overflow: излишек идёт в следующую УЖЕ выставленную пробирку того же цвета.
 */
export class VialManager {
    constructor(level, capacity) {
        this.capacity = capacity;
        this.queue = (level.vials || []).map(function (v, i) {
            return { id: i, color: v.color, fill: 0, popped: false };
        });
        this._validateSupply(level);
    }

    displayed() {
        var out = [];
        for (var i = 0; i < this.queue.length && out.length < 3; i++) {
            if (!this.queue[i].popped && this.queue[i].fill < 1) out.push(this.queue[i]);
        }
        return out;
    }

    remainingOf(color) {
        return this.queue.filter(function (v) {
            return !v.popped && v.color === color && v.fill < 1;
        });
    }

    requiredArea(color) {
        var total = 0;
        for (var i = 0; i < this.queue.length; i++) {
            var vial = this.queue[i];
            if (!vial.popped && vial.color === color) {
                total += Math.max(0, 1 - vial.fill) * this.capacity;
            }
        }
        return total;
    }

    displayedRoom(color) {
        var shown = this.displayed();
        var room = 0;
        for (var i = 0; i < shown.length; i++) {
            if (shown[i].color === color) {
                room += Math.max(0, 1 - shown[i].fill) * this.capacity;
            }
        }
        return room;
    }

    wouldExhaustColor(color, cutArea, availableArea) {
        if (!this.hasAnyOf(color)) return false;
        var accepted = Math.min(cutArea, this.displayedRoom(color));
        var requiredAfter = Math.max(0, this.requiredArea(color) - accepted);
        if (requiredAfter <= 1) return false;
        var remainingAfter = Math.max(0, availableArea - cutArea);
        var shortageBefore = Math.max(
            0,
            this.requiredArea(color) - availableArea
        );
        var shortageAfter = Math.max(0, requiredAfter - remainingAfter);
        return shortageAfter > shortageBefore + 1;
    }

    hasAnyOf(color) {
        return this.remainingOf(color).length > 0;
    }

    hasDisplayed(color) {
        return this.displayed().some(function (v) { return v.color === color; });
    }

    canClaim(color) {
        if (this.hasDisplayed(color)) return 'pour';
        if (!this.hasAnyOf(color)) return 'vanish';
        return 'blocked';
    }

    completedOf(color) {
        var n = 0;
        for (var i = 0; i < this.queue.length; i++) {
            if (this.queue[i].color === color &&
                (this.queue[i].popped || this.queue[i].fill >= 1)) {
                n++;
            }
        }
        return n;
    }

    completedMap() {
        var map = {};
        for (var i = 0; i < this.queue.length; i++) {
            var vial = this.queue[i];
            if (vial.popped || vial.fill >= 1) {
                map[vial.color] = (map[vial.color] || 0) + 1;
            }
        }
        return map;
    }

    allDone() {
        return this.queue.every(function (v) { return v.popped || v.fill >= 1; });
    }

    /**
     * @returns {{ acceptedArea: number, events: Array, vanishRest: boolean }}
     */
    pour(color, area) {
        var events = [];
        if (area <= 0) return { acceptedArea: 0, events: events, vanishRest: false };

        var remainingVials = this.remainingOf(color);
        if (!remainingVials.length) {
            return { acceptedArea: 0, events: events, vanishRest: true };
        }

        var shown = this.displayed().filter(function (v) { return v.color === color; });
        if (!shown.length) {
            return { acceptedArea: 0, events: events, vanishRest: false };
        }

        var left = area;
        var accepted = 0;
        for (var i = 0; i < shown.length && left > 0; i++) {
            var vial = shown[i];
            var room = (1 - vial.fill) * this.capacity;
            if (room <= 0) continue;
            var take = Math.min(room, left);
            vial.fill += take / this.capacity;
            left -= take;
            accepted += take;
            events.push({ type: 'fill', vial: vial, amount: take });
            if (vial.fill >= 0.999) {
                vial.fill = 1;
                vial.popped = true;
                events.push({ type: 'pop', vial: vial });
            }
        }

        return { acceptedArea: accepted, events: events, vanishRest: false };
    }

    completeRandomDisplayed() {
        var shown = this.displayed();
        if (!shown.length) return null;
        var vial = shown[Math.floor(Math.random() * shown.length)];
        var previousFill = vial.fill;
        vial.fill = 1;
        vial.popped = true;
        return {
            vial: vial,
            events: [
                {
                    type: 'fill',
                    vial: vial,
                    amount: Math.max(0, 1 - previousFill) * this.capacity
                },
                { type: 'pop', vial: vial }
            ]
        };
    }

    snapshot() {
        var shown = this.displayed();
        var shownIds = shown.map(function (v) { return v.id; });
        var hiddenByColor = {};
        this.queue.forEach(function (v) {
            if (!v.popped && v.fill < 1 && shownIds.indexOf(v.id) === -1) {
                hiddenByColor[v.color] = (hiddenByColor[v.color] || 0) + 1;
            }
        });
        var firstShownByColor = {};
        return {
            displayed: shown.map(function (v) {
                var count = 1;
                if (!firstShownByColor[v.color]) {
                    firstShownByColor[v.color] = true;
                    count += hiddenByColor[v.color] || 0;
                }
                return {
                    id: v.id,
                    color: v.color,
                    fill: v.fill,
                    remainingOfColor: count
                };
            }),
            remaining: this.queue.filter(function (v) { return !v.popped; }).length,
            total: this.queue.length
        };
    }

    _validateSupply(level) {
        var areas = {};
        (level.polygons || []).forEach(function (poly) {
            var area = polygonArea(poly.points || []);
            areas[poly.color] = (areas[poly.color] || 0) + area;
        });
        var counts = {};
        this.queue.forEach(function (vial) {
            counts[vial.color] = (counts[vial.color] || 0) + 1;
        });
        var colors = Object.keys(counts);
        for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            var requiredWithMargin = counts[color] * this.capacity * 1.05;
            if ((areas[color] || 0) < requiredWithMargin) {
                console.warn(
                    'Level ' + level.id + ': мало цвета "' + color +
                    '" для ' + counts[color] + ' пробирок с запасом 5%'
                );
            }
        }
    }
}

function polygonArea(points) {
    var sum = 0;
    for (var i = 0; i < points.length; i++) {
        var a = points[i];
        var b = points[(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}
