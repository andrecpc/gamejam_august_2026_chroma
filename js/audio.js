/*
 * audio.js
 * Процедурный звук на Web Audio API — БЕЗ внешних аудиофайлов.
 * Почему так: не нужно тащить mp3/ogg с чужой лицензией, ноль веса,
 * и никаких проблем с автозапуском звука в браузере.
 *
 * - Фоновая музыка: спокойный зацикленный синти-пэд + арпеджио.
 * - Звуки интерфейса: клик, наведение, «успех».
 *
 * Браузеры не дают запускать звук до первого касания/клика пользователя,
 * поэтому реальный AudioContext создаётся лениво — в resume(), который
 * мы вызываем по первому pointerdown (см. main.js).
 */
(function () {
    'use strict';

    // MIDI-номер ноты -> частота в Гц
    function midiToFreq(m) {
        return 440 * Math.pow(2, (m - 69) / 12);
    }

    // Прогрессия аккордов (по одному такту на аккорд): Am – F – C – G
    // Каждый аккорд — массив MIDI-нот (трезвучие).
    var PROGRESSION = [
        [57, 60, 64], // Am
        [53, 57, 60], // F
        [48, 52, 55], // C
        [55, 59, 62]  // G
    ];

    var BOSS_PROGRESSION = [
        [45, 48, 51], // мрачный Am
        [41, 44, 48], // F низко
        [43, 46, 50], // Gdim-ish
        [38, 41, 45]  // E низко
    ];

    var TEMPO = 82;                       // ударов в минуту
    var BOSS_TEMPO = 112;
    var SPB = 60 / TEMPO;                 // секунд на удар
    var STEP = SPB / 2;                   // восьмая нота — шаг арпеджио
    var STEPS_PER_BAR = 8;                // восьмых в такте
    var TOTAL_STEPS = STEPS_PER_BAR * PROGRESSION.length; // длина петли в шагах

    var AudioManager = {
        ctx: null,
        musicGain: null,   // общий регулятор громкости музыки
        sfxGain: null,     // общий регулятор громкости звуков
        _schedulerId: null,
        _nextNoteTime: 0,
        _step: 0,
        _started: false,   // играет ли музыка сейчас
        _musicMode: 'normal',
        _desiredMode: 'normal',

        // Создаёт AudioContext (только после жеста пользователя!)
        _ensureContext: function () {
            if (this.ctx) return;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = GameSettings.get('musicOn') ? GameSettings.get('musicVolume') : 0;
            this.musicGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = GameSettings.get('sfxOn') ? GameSettings.get('sfxVolume') : 0;
            this.sfxGain.connect(this.ctx.destination);
        },

        // Вызывается по первому касанию — «будит» звук и стартует музыку
        resume: function () {
            this._ensureContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.unlockHtmlAudio();
            this.preloadFinale();
            if (this._wantFinale || this._finaleSource || this._finaleEl) {
                this._playFinaleNow();
                return;
            }
            if (GameSettings.get('musicOn')) {
                if (this._started && this.ctx) {
                    this._nextNoteTime = this.ctx.currentTime + 0.05;
                }
                this.startMusic();
            }
        },

        unlockHtmlAudio: function () {
            if (this._htmlUnlocked) return;
            var self = this;
            try {
                var el = this._htmlUnlockEl || new Audio('assets/audio/papercut.mp3');
                el.preload = 'auto';
                el.loop = true;
                el.setAttribute('playsinline', 'true');
                el.setAttribute('webkit-playsinline', 'true');
                el.volume = 0;
                el.muted = true;
                this._htmlUnlockEl = el;
                var p = el.play();
                var done = function () {
                    try { el.pause(); el.currentTime = 0; } catch (e) {}
                    el.muted = false;
                    el.volume = 1;
                    self._htmlUnlocked = true;
                };
                if (p && p.then) p.then(done).catch(function () {});
                else done();
            } catch (e) {}
        },

        preloadFinale: function (done) {
            var self = this;
            if (this._finaleBuffer) {
                if (done) done();
                return;
            }
            if (this._finaleLoading) {
                if (done) this._finaleWaiters.push(done);
                return;
            }
            this._finaleWaiters = done ? [done] : [];
            this._finaleLoading = true;
            this._ensureContext();
            if (!this.ctx || !window.fetch) {
                this._finaleLoading = false;
                if (done) done();
                return;
            }
            fetch('assets/audio/papercut.mp3').then(function (res) {
                if (!res.ok) throw new Error('finale http');
                return res.arrayBuffer();
            }).then(function (buf) {
                return self.ctx.decodeAudioData(buf);
            }).then(function (decoded) {
                self._finaleBuffer = decoded;
                self._finaleLoading = false;
                var waiters = self._finaleWaiters || [];
                self._finaleWaiters = [];
                for (var i = 0; i < waiters.length; i++) waiters[i]();
            }).catch(function () {
                self._finaleLoading = false;
                var waiters = self._finaleWaiters || [];
                self._finaleWaiters = [];
                for (var i = 0; i < waiters.length; i++) waiters[i]();
            });
        },

        // ---- Музыка ----

        startMusic: function (mode) {
            this._ensureContext();
            if (!this.ctx) return;
            if (this._wantFinale || this._finaleSource || this._finaleEl) return;
            if (mode) this._desiredMode = mode;
            var next = this._desiredMode || 'normal';
            if (this._started && this._musicMode === next) {
                this._nextNoteTime = Math.max(this._nextNoteTime || 0, this.ctx.currentTime + 0.05);
                return;
            }
            this.stopMusic();
            this._musicMode = next;
            this._started = true;
            this._step = 0;
            this._nextNoteTime = this.ctx.currentTime + 0.1;
            var self = this;
            // Планировщик с «заглядыванием вперёд»: раз в 25 мс подкидываем
            // ноты, которые должны прозвучать в ближайшие 100 мс.
            this._schedulerId = setInterval(function () {
                self._scheduler();
            }, 25);
        },

        stopMusic: function () {
            this._started = false;
            if (this._schedulerId) {
                clearInterval(this._schedulerId);
                this._schedulerId = null;
            }
        },

        _stepDuration: function () {
            var tempo = this._musicMode === 'boss' ? BOSS_TEMPO : TEMPO;
            return (60 / tempo) / 2;
        },

        _scheduler: function () {
            if (!this.ctx) return;
            var stepDur = this._stepDuration();
            var loop = this._musicMode === 'boss'
                ? STEPS_PER_BAR * BOSS_PROGRESSION.length
                : TOTAL_STEPS;
            while (this._nextNoteTime < this.ctx.currentTime + 0.1) {
                this._scheduleStep(this._step, this._nextNoteTime);
                this._nextNoteTime += stepDur;
                this._step = (this._step + 1) % loop;
            }
        },

        _scheduleStep: function (step, time) {
            var boss = this._musicMode === 'boss';
            var progression = boss ? BOSS_PROGRESSION : PROGRESSION;
            var bar = Math.floor(step / STEPS_PER_BAR) % progression.length;
            var chord = progression[bar];
            var spb = boss ? (60 / BOSS_TEMPO) : SPB;

            // В начале такта — мягкий пэд (все ноты аккорда, долго)
            if (step % STEPS_PER_BAR === 0) {
                for (var i = 0; i < chord.length; i++) {
                    this._pad(midiToFreq(chord[i]), time, spb * 4, boss);
                }
            }

            // Арпеджио — лёгкий «пляк» на каждой восьмой, ноты по кругу и выше на октаву
            var noteIndex = step % chord.length;
            var freq = midiToFreq(chord[noteIndex] + (boss ? 0 : 12));
            if (boss) {
                if (step % 2 === 0) this._pluck(freq, time, true);
                if (step % STEPS_PER_BAR === 0) {
                    this._pluck(midiToFreq(chord[0] - 12), time, true);
                }
            } else if (step % 4 !== 3) {
                this._pluck(freq, time, false);
            }
        },

        // Долгий пэд с плавной атакой и затуханием
        _pad: function (freq, time, dur, tense) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = tense ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;

            var peak = tense ? 0.09 : 0.22;
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(peak, time + (tense ? 0.22 : 0.6));
            g.gain.linearRampToValueAtTime(0.0001, time + dur);

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + dur + 0.05);
        },

        // Короткий «пляк» арпеджио
        _pluck: function (freq, time, tense) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = tense ? 'square' : 'triangle';
            osc.frequency.value = freq;

            var peak = tense ? 0.07 : 0.18;
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(peak, time + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, time + (tense ? 0.22 : 0.35));

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + 0.4);
        },

        // ---- Звуки интерфейса ----

        _blip: function (freq, type, dur, vol) {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol || 0.3, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + (dur || 0.12) + 0.02);
        },

        _sweep: function (from, to, type, dur, vol) {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(Math.max(20, from), t);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + dur + 0.03);
        },

        _noiseBuffer: function () {
            if (this._noise) return this._noise;
            var sr = this.ctx.sampleRate;
            var n = Math.floor(sr * 0.35);
            var buf = this.ctx.createBuffer(1, n, sr);
            var data = buf.getChannelData(0);
            var i;
            for (i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
            this._noise = buf;
            return buf;
        },

        _noiseBurst: function (time, dur, freq, q, vol) {
            var src = this.ctx.createBufferSource();
            src.buffer = this._noiseBuffer();
            var filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = freq;
            filter.Q.value = q == null ? 1.1 : q;
            var g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(vol, time + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            src.connect(filter);
            filter.connect(g);
            g.connect(this.sfxGain);
            src.start(time);
            src.stop(time + dur + 0.02);
        },

        playClick: function () {
            this._blip(midiToFreq(72), 'sine', 0.16, 0.055);
            var self = this;
            setTimeout(function () { self._blip(midiToFreq(76), 'triangle', 0.14, 0.035); }, 28);
        },
        playHover: function () {
            if (!this.ctx || this.ctx.state !== 'running') return;
            this._blip(midiToFreq(79), 'sine', 0.08, 0.04);
        },
        playSuccess: function () {
            this._blip(523, 'triangle', 0.12, 0.18);
            var self = this;
            setTimeout(function () { self._blip(784, 'triangle', 0.16, 0.18); }, 90);
        },
        playWin: function () {
            var self = this;
            var notes = [60, 64, 67, 72, 79];
            var i;
            for (i = 0; i < notes.length; i++) {
                (function (midi, delay) {
                    setTimeout(function () {
                        self._blip(midiToFreq(midi), 'triangle', 0.32, 0.16);
                        self._blip(midiToFreq(midi + 12), 'sine', 0.36, 0.07);
                    }, delay);
                })(notes[i], i * 115);
            }
        },
        playFinale: function () {
            this._wantFinale = true;
            this._ensureContext();
            this.stopMusic();
            this.preloadFinale();
            this._playFinaleNow();
        },
        _playFinaleNow: function () {
            if (!this._wantFinale) return;
            if (this._finaleSource || (this._finaleEl && !this._finaleEl.paused)) {
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                if (this._finaleEl && this._finaleEl.paused) {
                    var keep = this._finaleEl.play();
                    if (keep && keep.catch) keep.catch(function () {});
                }
                return;
            }
            if (this._finaleBuffer && this.ctx) {
                this._playFinaleBuffer();
                return;
            }
            this._playFinaleElement();
            var self = this;
            this.preloadFinale(function () {
                if (!self._wantFinale) return;
                if (self._finaleBuffer && self.ctx && !self._finaleSource) {
                    self.stopFinale(true);
                    self._wantFinale = true;
                    self._playFinaleBuffer();
                }
            });
        },
        _finaleVolume: function () {
            var vol = GameSettings.get('musicOn') ? (GameSettings.get('musicVolume') || 0.9) : 0;
            return Math.max(0, Math.min(1, vol * 0.42));
        },
        _playFinaleBuffer: function () {
            if (!this.ctx || !this._finaleBuffer) return;
            this.stopFinale(true);
            this._wantFinale = true;
            try {
                var src = this.ctx.createBufferSource();
                src.buffer = this._finaleBuffer;
                src.loop = true;
                var g = this.ctx.createGain();
                g.gain.value = this._finaleVolume();
                src.connect(g);
                g.connect(this.musicGain || this.ctx.destination);
                src.start(0);
                this._finaleSource = src;
                this._finaleGain = g;
            } catch (e) {
                if (!this._finaleEl) this._playFinaleElement();
            }
        },
        _playFinaleElement: function () {
            var self = this;
            this.stopFinale(true);
            this._wantFinale = true;
            var el = this._htmlUnlockEl || new Audio('assets/audio/papercut.mp3');
            this._htmlUnlockEl = el;
            el.loop = true;
            el.preload = 'auto';
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            try { el.currentTime = 0; } catch (e) {}
            el.volume = this._finaleVolume();
            this._finaleEl = el;
            var playFail = function () {
                if (self._finaleEl !== el) return;
                if (self._finaleBuffer && self.ctx) {
                    self._playFinaleBuffer();
                    return;
                }
                if (self._finaleLoading) return;
                self.stopFinale();
                self.playWin();
            };
            el.addEventListener('error', playFail);
            var p = el.play();
            if (p && p.catch) p.catch(playFail);
        },
        stopFinale: function (keepWant) {
            if (!keepWant) this._wantFinale = false;
            if (this._finaleSource) {
                try { this._finaleSource.stop(); } catch (e) {}
                try { this._finaleSource.disconnect(); } catch (e2) {}
                this._finaleSource = null;
            }
            if (this._finaleGain) {
                try { this._finaleGain.disconnect(); } catch (e3) {}
                this._finaleGain = null;
            }
            if (!this._finaleEl) return;
            try { this._finaleEl.pause(); } catch (e4) {}
            if (this._finaleEl !== this._htmlUnlockEl) {
                try { this._finaleEl.src = ''; } catch (e5) {}
            }
            this._finaleEl = null;
        },
        playBack: function () { this._blip(midiToFreq(64), 'sine', 0.12, 0.07); },
        playCut: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            this._noiseBurst(t, 0.07, 1800, 0.8, 0.2);
            this._noiseBurst(t + 0.03, 0.09, 1100, 1.0, 0.18);
            this._noiseBurst(t + 0.06, 0.11, 640, 0.9, 0.16);
            this._sweep(420, 160, 'triangle', 0.12, 0.05);
        },
        playPour: function () {
            this._sweep(310, 145, 'sine', 0.24, 0.2);
            var self = this;
            setTimeout(function () { self._blip(430, 'sine', 0.07, 0.11); }, 65);
            setTimeout(function () { self._blip(520, 'sine', 0.06, 0.08); }, 125);
        },
        playPork: function () {
            this.playRustle();
        },
        playRustle: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            this._noiseBurst(t, 0.045, 2400, 1.4, 0.16);
            this._noiseBurst(t + 0.03, 0.05, 1500, 1.1, 0.14);
            this._noiseBurst(t + 0.055, 0.06, 900, 0.9, 0.1);
        },
        playError: function () { this._blip(160, 'square', 0.14, 0.22); },
        playHit: function () {
            this._sweep(145, 42, 'sawtooth', 0.24, 0.32);
            this._blip(70, 'square', 0.16, 0.22);
        },
        playZap: function () {
            this._sweep(1100, 210, 'square', 0.11, 0.14);
            this._blip(240, 'sawtooth', 0.12, 0.16);
        },

        // ---- Реакция на изменение настроек ----

        applyMusicSetting: function () {
            var on = GameSettings.get('musicOn');
            if (this.musicGain) {
                this.musicGain.gain.value = on ? GameSettings.get('musicVolume') : 0;
            }
            if (this._finaleGain) {
                this._finaleGain.gain.value = on ? this._finaleVolume() : 0;
            }
            if (this._finaleEl) {
                this._finaleEl.volume = on ? this._finaleVolume() : 0;
            }
            if (this._wantFinale) return;
            if (on) { this.startMusic(); } else { this.stopMusic(); }
        },
        applySfxSetting: function () {
            if (this.sfxGain) {
                this.sfxGain.gain.value = GameSettings.get('sfxOn') ? GameSettings.get('sfxVolume') : 0;
            }
        }
    };

    window.AudioManager = AudioManager;
})();
