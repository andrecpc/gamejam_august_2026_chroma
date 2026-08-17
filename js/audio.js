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

    var TEMPO = 82;                       // ударов в минуту
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
            if (GameSettings.get('musicOn')) {
                this.startMusic();
            }
        },

        // ---- Музыка ----

        startMusic: function () {
            this._ensureContext();
            if (!this.ctx || this._started) return;
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

        _scheduler: function () {
            if (!this.ctx) return;
            while (this._nextNoteTime < this.ctx.currentTime + 0.1) {
                this._scheduleStep(this._step, this._nextNoteTime);
                this._nextNoteTime += STEP;
                this._step = (this._step + 1) % TOTAL_STEPS;
            }
        },

        _scheduleStep: function (step, time) {
            var bar = Math.floor(step / STEPS_PER_BAR);
            var chord = PROGRESSION[bar];

            // В начале такта — мягкий пэд (все ноты аккорда, долго)
            if (step % STEPS_PER_BAR === 0) {
                for (var i = 0; i < chord.length; i++) {
                    this._pad(midiToFreq(chord[i]), time, SPB * 4);
                }
            }

            // Арпеджио — лёгкий «пляк» на каждой восьмой, ноты по кругу и выше на октаву
            var noteIndex = step % chord.length;
            var freq = midiToFreq(chord[noteIndex] + 12);
            // Пропускаем некоторые шаги, чтобы был воздух
            if (step % 4 !== 3) {
                this._pluck(freq, time);
            }
        },

        // Долгий пэд с плавной атакой и затуханием
        _pad: function (freq, time, dur) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            var peak = 0.12;
            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(peak, time + 0.6);           // атака
            g.gain.linearRampToValueAtTime(0.0001, time + dur);          // затухание

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + dur + 0.05);
        },

        // Короткий «пляк» арпеджио
        _pluck: function (freq, time) {
            var osc = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            g.gain.setValueAtTime(0.0001, time);
            g.gain.linearRampToValueAtTime(0.10, time + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

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

        playClick: function () { this._blip(520, 'square', 0.10, 0.25); },
        playHover: function () {
            // Наведение мыши не считается пользовательским жестом. Не создаём
            // AudioContext до первого pointerdown, чтобы Chrome не ругался.
            if (!this.ctx || this.ctx.state !== 'running') return;
            this._blip(700, 'sine', 0.06, 0.12);
        },
        playSuccess: function () {
            // Небольшой восходящий мотив
            this._blip(523, 'triangle', 0.12, 0.25);
            var self = this;
            setTimeout(function () { self._blip(784, 'triangle', 0.16, 0.25); }, 90);
        },
        playBack: function () { this._blip(320, 'square', 0.10, 0.22); },
        playCut: function () {
            this._sweep(150, 760, 'sawtooth', 0.13, 0.16);
            this._blip(980, 'triangle', 0.08, 0.13);
        },
        playPour: function () {
            this._sweep(310, 145, 'sine', 0.24, 0.2);
            var self = this;
            setTimeout(function () { self._blip(430, 'sine', 0.07, 0.11); }, 65);
            setTimeout(function () { self._blip(520, 'sine', 0.06, 0.08); }, 125);
        },
        playPork: function () {
            this._blip(140, 'square', 0.12, 0.35);
            var self = this;
            setTimeout(function () { self._blip(90, 'sawtooth', 0.16, 0.28); }, 40);
            setTimeout(function () { self._blip(520, 'triangle', 0.10, 0.2); }, 90);
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
