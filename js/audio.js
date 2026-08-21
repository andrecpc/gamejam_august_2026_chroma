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

    // Таймерный слой: тот же paper-cut характер, чуть быстрее и светлее.
    var TIMED_PROGRESSION = [
        [60, 64, 67], // C
        [64, 67, 71], // E
        [57, 60, 64], // Am
        [55, 59, 62]  // G
    ];

    var TEMPO = 82;                       // ударов в минуту
    var TIMED_TEMPO = 100;
    var BOSS_TEMPO = 112;
    var DESTROY_TEMPO = 156;
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

        // Будит AudioContext. Не перезапускает музыку — иначе клики
        // наслаивают пэды и арпеджио друг на друга.
        resume: function () {
            this._ensureContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.unlockHtmlAudio();
            if (this._wantFinale) {
                this.preloadFinale();
                this._playFinaleNow();
                return;
            }
            if (GameSettings.get('musicOn') && !this._started) {
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
            if (this._started && this._schedulerId && this._musicMode === next) {
                return;
            }
            this.stopMusic();
            this._cutMusicTail();
            this._musicMode = next;
            this._started = true;
            this._step = 0;
            this._nextNoteTime = this.ctx.currentTime + (next === 'destroy' ? 0.16 : 0.1);
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

        _cutMusicTail: function () {
            if (!this.musicGain || !this.ctx) return;
            var t = this.ctx.currentTime;
            var vol = GameSettings.get('musicOn') ? (GameSettings.get('musicVolume') || 0) : 0;
            try {
                this.musicGain.gain.cancelScheduledValues(t);
                this.musicGain.gain.setValueAtTime(Math.max(0.0001, this.musicGain.gain.value), t);
                this.musicGain.gain.linearRampToValueAtTime(0.0001, t + 0.07);
                this.musicGain.gain.linearRampToValueAtTime(Math.max(0.0001, vol), t + 0.18);
            } catch (e) {}
        },

        _stepDuration: function () {
            var tempo = TEMPO;
            if (this._musicMode === 'timed') tempo = TIMED_TEMPO;
            else if (this._musicMode === 'boss') tempo = BOSS_TEMPO;
            else if (this._musicMode === 'destroy') tempo = DESTROY_TEMPO;
            return (60 / tempo) / 2;
        },

        _scheduler: function () {
            if (!this.ctx) return;
            var stepDur = this._stepDuration();
            var loop = TOTAL_STEPS;
            if (this._musicMode === 'timed') {
                loop = STEPS_PER_BAR * TIMED_PROGRESSION.length;
            } else if (this._musicMode === 'boss') {
                loop = STEPS_PER_BAR * BOSS_PROGRESSION.length;
            } else if (this._musicMode === 'destroy') {
                loop = 16;
            }
            if (this._nextNoteTime < this.ctx.currentTime - 0.02) {
                this._nextNoteTime = this.ctx.currentTime;
            }
            while (this._nextNoteTime < this.ctx.currentTime + 0.1) {
                this._scheduleStep(this._step, this._nextNoteTime);
                this._nextNoteTime += stepDur;
                this._step = (this._step + 1) % loop;
            }
        },

        _scheduleStep: function (step, time) {
            if (this._musicMode === 'destroy') {
                this._scheduleDestroy(step, time);
                return;
            }
            var boss = this._musicMode === 'boss';
            var timed = this._musicMode === 'timed';
            var progression = boss ? BOSS_PROGRESSION : (timed ? TIMED_PROGRESSION : PROGRESSION);
            var bar = Math.floor(step / STEPS_PER_BAR) % progression.length;
            var chord = progression[bar];
            var spb = boss ? (60 / BOSS_TEMPO) : (timed ? (60 / TIMED_TEMPO) : SPB);
            var mood = boss ? 'boss' : (timed ? 'timed' : 'normal');

            // В начале такта — мягкий пэд (все ноты аккорда, долго)
            if (step % STEPS_PER_BAR === 0) {
                for (var i = 0; i < chord.length; i++) {
                    this._pad(midiToFreq(chord[i]), time, spb * 4, mood);
                }
            }

            // Арпеджио — лёгкий «пляк» на каждой восьмой, ноты по кругу и выше на октаву
            var noteIndex = step % chord.length;
            var freq = midiToFreq(chord[noteIndex] + (boss ? 0 : 12));
            if (boss) {
                if (step % 2 === 0) this._pluck(freq, time, 'boss');
                if (step % STEPS_PER_BAR === 0) {
                    this._pluck(midiToFreq(chord[0] - 12), time, 'boss');
                }
            } else if (timed) {
                this._pluck(freq, time, 'timed');
                if (step % 4 === 0) {
                    this._clockTick(time);
                }
            } else if (step % 4 !== 3) {
                this._pluck(freq, time, 'normal');
            }
        },

        _scheduleDestroy: function (step, time) {
            var beat = step % 8;
            var from = 1280 + (step % 6) * 220;
            var to = 180 + (step % 4) * 55;
            if (beat % 2 === 0) {
                this._musicSweep(from, to, 'sawtooth', 0.12, 0.075, time);
            } else {
                this._musicSweep(from * 0.72, to + 80, 'square', 0.08, 0.045, time);
            }
            if (beat === 0 || beat === 3 || beat === 6) {
                this._musicBoom(time, 0.16, 720 + (step % 3) * 160, 0.11);
            }
            if (beat === 2 || beat === 5) {
                this._pluck(midiToFreq(84 + (step % 4)), time, 'boss');
            }
        },

        _musicSweep: function (from, to, type, dur, vol, time) {
            if (!this.ctx || !this.musicGain) return;
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = type || 'sawtooth';
            osc.frequency.setValueAtTime(Math.max(40, from), time);
            osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), time + dur);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(vol, time + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + dur + 0.03);
        },

        _musicBoom: function (time, dur, freq, vol) {
            if (!this.ctx || !this.musicGain) return;
            var src = this.ctx.createBufferSource();
            src.buffer = this._noiseBuffer();
            var hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 420;
            var bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = freq;
            bp.Q.value = 0.7;
            var g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(vol, time + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            src.connect(hp);
            hp.connect(bp);
            bp.connect(g);
            g.connect(this.musicGain);
            src.start(time);
            src.stop(time + dur + 0.02);
        },

        // Долгий пэд с плавной атакой и затуханием
        _pad: function (freq, time, dur, mood) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            var tense = mood === 'boss' || mood === true;
            var timed = mood === 'timed';
            osc.type = tense ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;

            var peak = tense ? 0.09 : (timed ? 0.16 : 0.22);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(peak, time + (tense ? 0.22 : (timed ? 0.32 : 0.6)));
            g.gain.linearRampToValueAtTime(0.0001, time + dur);

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + dur + 0.05);
        },

        // Короткий «пляк» арпеджио
        _pluck: function (freq, time, mood) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            var tense = mood === 'boss' || mood === true;
            var timed = mood === 'timed';
            osc.type = tense ? 'square' : 'triangle';
            osc.frequency.value = freq;

            var peak = tense ? 0.07 : (timed ? 0.14 : 0.18);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(peak, time + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, time + (tense ? 0.22 : (timed ? 0.24 : 0.35)));

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + 0.4);
        },

        _clockTick: function (time) {
            if (!this.ctx || !this.musicGain) return;
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1320;
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(0.028, time + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + 0.09);
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

        _noiseBuffer: function (seconds) {
            var key = seconds > 0.5 ? '_noiseLong' : '_noise';
            if (this[key]) return this[key];
            var sr = this.ctx.sampleRate;
            var n = Math.floor(sr * (seconds || 0.35));
            var buf = this.ctx.createBuffer(1, n, sr);
            var data = buf.getChannelData(0);
            var i;
            var prev = 0;
            for (i = 0; i < n; i++) {
                var white = Math.random() * 2 - 1;
                prev = prev * 0.32 + white * 0.68;
                data[i] = white * 0.72 + prev * 0.28;
            }
            this[key] = buf;
            return buf;
        },

        _noiseBurst: function (time, dur, freq, q, vol, rate) {
            var src = this.ctx.createBufferSource();
            src.buffer = this._noiseBuffer();
            src.playbackRate.value = rate || 1;
            var hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 900;
            var filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = freq;
            filter.Q.value = q == null ? 1.1 : q;
            var g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(vol, time + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            src.connect(hp);
            hp.connect(filter);
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
            this._cutMusicTail();
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
            el.muted = false;
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
        playCut: function (opts) {
            this._ensureContext();
            if (!this.ctx) return;
            var combo = !!(opts && opts.combo);
            var t = this.ctx.currentTime;
            var pitch = (0.92 + Math.random() * 0.16) * (combo ? 1.2 : 1);
            this._noiseBurst(t, 0.038, 4800 * pitch, 1.7, combo ? 0.28 : 0.24, pitch);
            this._noiseBurst(t + 0.014, 0.05, 2800 * pitch, 1.35, 0.18, pitch);
            this._blip(2100 * pitch, 'triangle', 0.045, combo ? 0.09 : 0.07);
            this._sweep(2600 * pitch, 980 * pitch, 'sine', 0.07, 0.045);
            if (combo) this._blip(1560, 'sine', 0.09, 0.09);
        },
        playPour: function () {
            this.playBasketLand();
        },
        playBasketLand: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            var pitch = 0.93 + Math.random() * 0.14;
            this._noiseBurst(t, 0.06, 1400 * pitch, 1.2, 0.2, pitch);
            this._noiseBurst(t + 0.02, 0.08, 900 * pitch, 0.9, 0.14, pitch);
            this._blip(620 * pitch, 'sine', 0.07, 0.06);
        },
        playPork: function () {
            this.playRustle();
        },
        playRustle: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            var pitch = 0.92 + Math.random() * 0.16;
            this._noiseBurst(t, 0.05, 3400 * pitch, 1.5, 0.18, pitch);
            this._noiseBurst(t + 0.028, 0.07, 2100 * pitch, 1.15, 0.14, pitch);
            this._noiseBurst(t + 0.05, 0.08, 1250 * pitch, 0.95, 0.1, pitch);
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
        playCatch: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            this._noiseBurst(t, 0.045, 3400, 0.7, 0.34, 1.15);
            this._noiseBurst(t + 0.018, 0.04, 2200, 0.85, 0.18, 1.05);
            this._sweep(2100, 980, 'sine', 0.07, 0.2);
            this._blip(1560, 'sine', 0.05, 0.14);
        },
        playDunk: function () {
            this.playSwish();
        },
        playSwish: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            this._noiseBurst(t, 0.08, 720, 0.85, 0.16, 0.85);
            var i;
            for (i = 0; i < 11; i++) {
                this._noiseBurst(
                    t + 0.04 + i * 0.058 + Math.random() * 0.03,
                    0.055,
                    620 + Math.random() * 420,
                    0.8,
                    0.045 + Math.random() * 0.03,
                    0.75 + Math.random() * 0.15
                );
            }
        },
        playStamp: function () {
            this._ensureContext();
            if (!this.ctx) return;
            var t = this.ctx.currentTime;
            this._noiseBurst(t, 0.09, 180, 0.7, 0.28, 0.7);
            this._blip(90, 'sine', 0.16, 0.22);
            this._noiseBurst(t + 0.04, 0.07, 1400, 1.1, 0.12, 1);
        },

        setCritters: function (count) {
            this._ensureContext();
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            var n = Math.max(0, count || 0);
            this._critterCount = n;
            if (n <= 0) {
                if (this._critterId) {
                    clearInterval(this._critterId);
                    this._critterId = null;
                }
                return;
            }
            if (this._critterId) return;
            var self = this;
            this._critterStep = 0;
            this._critterId = setInterval(function () {
                self._critterTick();
            }, 240);
            this._critterTick();
        },
        stopCritters: function () {
            this.setCritters(0);
        },
        _critterTick: function () {
            if (!this.ctx || !this.sfxGain || !this._critterCount) return;
            if (!GameSettings.get('sfxOn')) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            var voices = [
                [67, 69, 72, 74, 76],
                [60, 64, 67, 71, 72],
                [72, 76, 79, 74, 67]
            ];
            var step = this._critterStep || 0;
            this._critterStep = step + 1;
            var voice = voices[step % voices.length];
            var midi = voice[step % voice.length];
            var t = this.ctx.currentTime;
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = step % 2 === 0 ? 'triangle' : 'sine';
            osc.frequency.value = midiToFreq(midi);
            var vol = 0.12 + (step % 3) * 0.02;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.42);
            var osc2 = this.ctx.createOscillator();
            var g2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = midiToFreq(midi + 7);
            g2.gain.setValueAtTime(0.0001, t + 0.02);
            g2.gain.linearRampToValueAtTime(vol * 0.55, t + 0.07);
            g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            osc2.connect(g2);
            g2.connect(this.sfxGain);
            osc2.start(t + 0.02);
            osc2.stop(t + 0.36);
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
