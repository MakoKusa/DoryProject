
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var crt = $("crt");
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var p2 = function (n) { return String(n).padStart(2, "0"); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var P = function (s) { return "<pre>" + s + "</pre>"; };
  var W = 78;   // largeur utile en colonnes : 78 sur ordinateur, reduite automatiquement sur telephone (voir fit())
  var cl = function (v) { return Math.max(0, Math.min(100, v)); };

  // ---------- Memoire du navigateur (localStorage) ----------
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function volLoad(k) { var v = parseInt(store.get(k), 10); return isNaN(v) ? 100 : cl(v); }

  // ---------- Reglages ----------
  var muted = store.get("mop_sound") === "off";      // bruitages on/off (coupe aussi les sons de Nezuko)
  var sfxVol = volLoad("mop_vol_s");                 // volume des bruitages (0-100)
  var musVol = volLoad("mop_vol_m");                 // volume de la musique (0-100)
  var nzSound = store.get("mop_nzsound") !== "off";  // sons de Nezuko on/off (ON par defaut)
  var THEMES = ["classic", "rose", "autumn", "winter", "spring", "summer"];
  if (store.get("mop_halloween26")) THEMES.push("null");
  var THEME_LABELS = { classic: "CLASSIQUE", rose: "ROSE", autumn: "AUTOMNE", winter: "HIVER", spring: "PRINTEMPS", summer: "ETE", "null": "NULL-0414" };
  // Rose par defaut. Les anciens choix "pink" restent compatibles.
  var rawTheme = store.get("mop_theme"), theme = THEMES.indexOf(rawTheme) >= 0 ? rawTheme : (rawTheme === "normal" ? "classic" : "rose");
  var particles = store.get("mop_particles") !== "off";   // particules ON par defaut
  var authed = store.get("mop_auth") === "1";
  var rs = store.get("mop_reduced");                 // effets reduits (par defaut : preference du systeme)
  var reduced = rs === null ? !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) : rs === "on";
  function applyTheme() {
    THEMES.forEach(function (x) { document.documentElement.classList.remove(x); });
    document.documentElement.classList.add(theme);
    store.set("mop_theme", theme);
    setTimeout(function () { if (typeof nullThemeSync === "function") nullThemeSync(); }, 0);
  }
  applyTheme();
  document.documentElement.classList.toggle("parts", particles);
  document.documentElement.classList.toggle("calm", reduced);

  // ---------- Adaptation a la taille de l'ecran (telephone) ----------
  var touchUI = false;
  function fit() {
    touchUI = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth < 700;
    document.documentElement.classList.toggle("touch", touchUI);
    var cs = getComputedStyle(crt);
    var avail = crt.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var cw = 0.62, fs = 16, w;
    var fs80 = avail / (cw * 80);                       // 78 colonnes + bordures
    if (fs80 >= 12) { fs = Math.min(16, fs80); w = 78; }
    else {
      fs = 12.5; w = Math.floor(avail / (cw * fs)) - 2;
      if (w < 40) { w = 40; fs = Math.max(8.5, avail / (cw * 42)); }
      if (w > 78) w = 78;
    }
    if (scr === "arg") w = Math.max(w, Math.min(112, Math.floor(avail / (cw * fs)) - 2));
    W = w; document.body.style.fontSize = fs.toFixed(1) + "px";
    crt.style.setProperty("--arg-columns", W + 2);
  }

  // ---------- Particules thematiques (independantes des effets reduits) ----------
  (function () {
    var box = document.createElement("div"); box.id = "petals";
    var colors = ["#ffbc4f", "#e67825", "#a84315", "#eab86b", "#ffb6d9", "#ffe39e", "#a9f4a1", "#ffe095"];
    for (var i = 0; i < 30; i++) {
      var p = document.createElement("span"); p.className = "particle";
      p.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "vw");
      p.style.setProperty("--s", (7 + Math.random() * 10).toFixed(1) + "px");
      p.style.setProperty("--d", (9 + Math.random() * 12).toFixed(1) + "s");
      p.style.setProperty("--dl", (-Math.random() * 20).toFixed(1) + "s");
      p.style.setProperty("--a", ((18 + Math.random() * 48) * (Math.random() < 0.5 ? -1 : 1)).toFixed(0));
      p.style.setProperty("--pc", colors[Math.random() * colors.length | 0]);
      p.style.opacity = (0.45 + Math.random() * 0.45).toFixed(2);
      box.appendChild(p);
    }
    document.body.appendChild(box);
  })();

  // ---------- Son ----------
  var ac;
  function getAC() {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function beep(f, d, type) {
    if (muted || sfxVol <= 0) return;
    if (scr === "care" && cmode === "menu") return;   // menu de Nezuko : pas de bips, pour mieux entendre ses bruits
    try {
      var c = getAC();
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "square"; o.frequency.value = f; g.gain.value = 0.04 * sfxVol / 100;
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d / 1000);
    } catch (e) {}
  }
  // Effets visuels (ignores en mode "effets reduits")
  function fxAdd(c) { if (!reduced) crt.classList.add(c); }
  function fxToggle(c, on) { if (!reduced) crt.classList.toggle(c, on); }

  // ---------- Cadres ASCII ----------
  // ligne : {t: texte brut, h: html optionnel de meme longueur, sel: inverse, act: action au toucher/clic}
  // Les lignes trop longues pour la largeur disponible sont automatiquement coupees sur plusieurs lignes.
  function splitLine(t, inner) {
    var lead = /^(> |  )/.test(t) ? t.slice(0, 2) : "";
    var parts = wrap(t.slice(lead.length), Math.max(8, inner - 1 - lead.length));
    return parts.map(function (p, i) { return (i === 0 ? lead : (lead ? "  " : "")) + p; });
  }
  function box(title, lines, inner) {
    inner = Math.min(inner, W);
    var t = " " + title + " ", l = Math.floor((inner - t.length) / 2);
    var out = "╔" + "═".repeat(l) + t + "═".repeat(Math.max(0, inner - t.length - l)) + "╗\n";
    var ls = [];
    lines.forEach(function (x) {
      if (!x.h && (" " + x.t).length > inner) splitLine(x.t, inner).forEach(function (s) { ls.push({ t: s, sel: x.sel, act: x.act }); });
      else ls.push(x);
    });
    ls.forEach(function (x) {
      var plain = " " + x.t, pad = " ".repeat(Math.max(0, inner - plain.length));
      var body = (x.h ? " " + x.h : esc(plain)) + pad;
      var cell = x.sel ? '<span class="sel">' + body + "</span>" : body;
      if (x.act) cell = '<span class="tap" data-a="' + x.act + '">' + cell + "</span>";
      out += "║" + cell + "║\n";
    });
    return out + "╚" + "═".repeat(inner) + "╝";
  }
  function wrap(s, w) {
    var out = [];
    s.split("\n").forEach(function (para) {
      var l = "";
      para.split(" ").forEach(function (x) {
        if ((l + " " + x).trim().length > w) { out.push(l); l = x; } else l = (l + " " + x).trim();
      });
      out.push(l);
    });
    return out;
  }
  function bar(p, n) { var k = Math.round(p / 100 * n); return "=".repeat(k) + " ".repeat(n - k); }

  // ---------- Etat ----------
  var DEF = "14/04/2025 - 20:00:00", target = DEF;
  var scr = "off", run = 0, cur = 0, st = "", crashReady = false, prun = false, arrival = false, jumpFrom = "db";
  var argLog = [], argIn = "", argBusy = false, argFrame = "", argPrevTrack = null, argStat = 0, argTick = 0;
  var argEntityReturned = false, argWhite = null, nullPromenadeUsed = false, nullSautsUsed = false;
  var argView = null, argArch = null, argArchSel = 0, argLogSel = 0, argInputMode = null, argInput = "", argChat = false;
  var LOGIN_PWD = "SUSHI", lgb = "";

  // ---------- Options ----------
  var oi = 0, OPT_N = 9;
  function toggleSound() { muted = !muted; store.set("mop_sound", muted ? "off" : "on"); }
  function toggleNzSound() { nzSound = !nzSound; store.set("mop_nzsound", nzSound ? "on" : "off"); }
  function changeTheme(d) {
    var i = THEMES.indexOf(theme); theme = THEMES[(i + d + THEMES.length) % THEMES.length]; applyTheme();
  }
  function toggleTheme() { changeTheme(1); }
  function toggleParticles() {
    particles = !particles; document.documentElement.classList.toggle("parts", particles); store.set("mop_particles", particles ? "on" : "off");
  }
  function toggleReduced() {
    reduced = !reduced; document.documentElement.classList.toggle("calm", reduced); store.set("mop_reduced", reduced ? "on" : "off");
    if (reduced) crt.classList.remove("shake", "inv", "crtoff");
  }
  // 0 sons, 1 volume sons, 2 sons de Nezuko, 3 musique, 4 volume musique, 5 theme, 6 particules, 7 effets reduits
  function optAdj(i, d) {
    if (i === 0) { toggleSound(); beep(700, 60); }
    else if (i === 1) { sfxVol = cl(sfxVol + d * 10); store.set("mop_vol_s", String(sfxVol)); beep(700, 80); }
    else if (i === 2) { toggleNzSound(); if (nzSound) nezVoice("yip"); }
    else if (i === 3) toggleMusic();
    else if (i === 4) cycleTrack(d < 0 ? -1 : 1);
    else if (i === 5) { musVol = cl(musVol + d * 10); store.set("mop_vol_m", String(musVol)); applyMusic(0.3); }
    else if (i === 6) changeTheme(d || 1);
    else if (i === 7) toggleParticles();
    else toggleReduced();
  }

  // ---------- Musique d'ambiance (generee, aucun fichier) : 3 pistes + 1 piste cachee (ARG) ----------
  var TRACKS = [
    { name: "SPACE CONTINUUM", lp: 1400, dl: 0.62,  fb: 0.50, wet: 0.45, gain: 1.00 },   // 1 : douce et planante
    { name: "TIME PARADOX",    lp: 3600, dl: 0.381, fb: 0.30, wet: 0.22, gain: 0.90 },   // 2 : plus pechue, rythmee
    { name: "SPACE JUMP",      lp: 1000, dl: 0.95,  fb: 0.62, wet: 0.60, gain: 0.80 },   // 3 : encore plus douce, spatiale / SF
    { name: "SIGNAL PERDU",    lp: 700,  dl: 0.83,  fb: 0.55, wet: 0.50, gain: 1.00 }    // cachee : section secrete (ARG), non selectionnable
  ];
  TRACKS.push({ name: "ARG 2026", lp: 2600, dl: 0.45, fb: 0.28, wet: 0.35, gain: 0.9 });   // musique douce de la fin de l'ARG
  function arg26() { return !!(typeof finalDate !== "undefined" && finalDate) || !!store.get("mop_halloween26"); }
  var SELECTABLE = 3;
  function loadTrack() { var v = parseInt(store.get("mop_track"), 10); return (v >= 0 && v < SELECTABLE) || (v === 4 && store.get("mop_halloween26")) ? v : 0; }
  // gen : numero de la piste en cours (les boucles d'une ancienne piste s'arretent), tg : volume propre a la piste, fx : filtre et echo
  var mus = { on: store.get("mop_music") !== "off", ready: false, bus: null, track: loadTrack(), gen: 0, tg: null, fx: null };
  function musTarget() { return mus.on && !argEntityReturned && theme !== "null" ? 0.9 * musVol / 100 : 0; }
  function applyMusic(tc) { if (mus.ready) mus.bus.gain.setTargetAtTime(musTarget(), ac.currentTime, tc); }
  var noiseBuf = null;
  function noiseBuffer() {
    if (!noiseBuf) {
      var n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = b;
    }
    return noiseBuf;
  }
  // Sequenceur : appelle fn(pas, instant) pour chaque double-croche, avec 1,2 s d'avance
  function seq(gen, bpm, fn) {
    var sd = 60 / bpm / 4, t = ac.currentTime + 0.12, s = 0;
    (function tick() {
      if (!mus.ready || gen !== mus.gen) return;
      try {
        if (ac.state === "running") {
          if (t < ac.currentTime) t = ac.currentTime + 0.05;
          while (t < ac.currentTime + 1.2) { fn(s, t); t += sd; s++; }
        }
      } catch (e) {}
      setTimeout(tick, 100);
    })();
  }

  // --- Piste 1 : SPACE CONTINUUM (accords doux et planants : Do maj9 / La min9 / Fa maj9 / Sol sus, 8 s chacun) ---
  var CHORDS = [
    [130.81, 196.00, 293.66, 329.63],
    [110.00, 164.81, 246.94, 261.63],
    [87.31, 130.81, 196.00, 220.00],
    [98.00, 146.83, 220.00, 329.63]
  ];
  var BELLS = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  function padNote(out, fq, t0) {
    var c = ac, g = c.createGain(), o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = "sine"; o2.type = "triangle"; o1.frequency.value = fq; o2.frequency.value = fq; o2.detune.value = 7;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.03, t0 + 3);
    g.gain.setValueAtTime(0.03, t0 + 8);
    g.gain.linearRampToValueAtTime(0, t0 + 11);
    o1.connect(g); o2.connect(g); g.connect(out);
    o1.start(t0); o2.start(t0); o1.stop(t0 + 11.1); o2.stop(t0 + 11.1);
  }
  function bell(out) {
    var c = ac, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = BELLS[Math.random() * BELLS.length | 0];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 3.6);
  }
  function runContinuum(gen, out) {
    (function chord(i) {
      if (!mus.ready || gen !== mus.gen) return;
      try { if (ac.state === "running") CHORDS[i % CHORDS.length].forEach(function (fq) { padNote(out, fq, ac.currentTime + 0.05); }); } catch (e) {}
      setTimeout(function () { chord(i + 1); }, 8000);
    })(0);
    (function bells() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") bell(out); } catch (e) {}
        bells();
      }, 2500 + Math.random() * 4500);
    })();
  }

  // --- Piste 2 : TIME PARADOX (118 BPM, La mineur : basse, arpege, petite grosse caisse, charleston, notes de lead) ---
  var PARA_CH = [
    { b: 55.00, n: [220.00, 261.63, 329.63] },   // La mineur
    { b: 43.65, n: [174.61, 220.00, 261.63] },   // Fa
    { b: 65.41, n: [261.63, 329.63, 392.00] },   // Do
    { b: 49.00, n: [196.00, 246.94, 293.66] }    // Sol
  ];
  var PARA_ARP = [0, 1, 2, 1, 0, 2, 1, 2];
  var PARA_LEAD = [440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  function tone(out, type, fq, t, dur, vol) {
    var c = ac, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = fq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function bassNote(out, fq, t, dur, vol) {
    var c = ac, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.value = fq; f.type = "lowpass"; f.frequency.value = 300;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function kickDrum(out, t) {
    var c = ac, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
  }
  function hatTick(out, t) {
    var c = ac, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(); f.type = "highpass"; f.frequency.value = 6500;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.08);
  }
  function runParadox(gen, out) {
    seq(gen, 118, function (s, t) {
      var bar = s >> 4, st = s & 15, ch = PARA_CH[bar % 4], up = (bar % 8) >= 4 ? 2 : 1;
      if (st % 2 === 0) tone(out, "triangle", ch.n[PARA_ARP[st >> 1]] * up, t, 0.24, 0.05);
      if (st === 0 || st === 8) { bassNote(out, ch.b, t, 0.45, 0.10); kickDrum(out, t); }
      if (st === 6 || st === 14) bassNote(out, ch.b * 2, t, 0.18, 0.05);
      if (st % 4 === 2) hatTick(out, t);
      if (st % 2 === 0 && bar % 2 === 1 && Math.random() < 0.25) tone(out, "sine", PARA_LEAD[Math.random() * PARA_LEAD.length | 0], t, 0.6, 0.035);
    });
  }

  // --- Piste 3 : SPACE JUMP (nappes tres lentes, scintillements aigus, souffles : ambiance spatiale / SF) ---
  var JUMP_CH = [
    [73.42, 110.00, 164.81, 220.00],
    [65.41, 98.00, 146.83, 196.00],
    [58.27, 87.31, 130.81, 174.61],
    [82.41, 123.47, 164.81, 246.94]
  ];
  var JUMP_SHIM = [587.33, 659.25, 880.00, 987.77, 1174.66, 1318.51, 1760.00];
  function longPad(out, fq, t0) {
    [-4, 4].forEach(function (dt) {
      var c = ac, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = fq; o.detune.value = dt;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 6); g.gain.setValueAtTime(0.022, t0 + 12); g.gain.linearRampToValueAtTime(0, t0 + 18);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 18.1);
    });
  }
  function shimmer(out) {
    var c = ac, t = c.currentTime + 0.05, fq = JUMP_SHIM[Math.random() * JUMP_SHIM.length | 0];
    var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(fq, t); o.frequency.linearRampToValueAtTime(fq * 0.985, t + 6);
    lfo.frequency.value = 5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 6.5);
    o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + 6.6); lfo.stop(t + 6.6);
  }
  function whoosh(out) {
    var c = ac, t = c.currentTime + 0.05, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(); s.loop = true; f.type = "bandpass"; f.Q.value = 5;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 4); f.frequency.exponentialRampToValueAtTime(400, t + 8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.014, t + 3); g.gain.linearRampToValueAtTime(0, t + 8);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 8.1);
  }
  function runJump(gen, out) {
    (function chord(i) {
      if (!mus.ready || gen !== mus.gen) return;
      try { if (ac.state === "running") JUMP_CH[i % JUMP_CH.length].forEach(function (fq) { longPad(out, fq, ac.currentTime + 0.05); }); } catch (e) {}
      setTimeout(function () { chord(i + 1); }, 12000);
    })(0);
    (function glint() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") shimmer(out); } catch (e) {}
        glint();
      }, 2500 + Math.random() * 6000);
    })();
    (function air() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") whoosh(out); } catch (e) {}
        air();
      }, 9000 + Math.random() * 14000);
    })();
  }

  // --- Piste cachee : SIGNAL PERDU (ARG) : sous-basse battante, battement de coeur, cluster dissonant, grincements, murmures ---
  function dreadDrone(out, t0) {
    [[41.20, 0.085, "sine"], [43.40, 0.075, "sine"], [82.41, 0.02, "sawtooth"]].forEach(function (p) {
      var c = ac, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = p[2]; o.frequency.value = p[0]; f.type = "lowpass"; f.frequency.value = 180;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(p[1], t0 + 5); g.gain.setValueAtTime(p[1], t0 + 16); g.gain.linearRampToValueAtTime(0, t0 + 22);
      o.connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 22.1);
    });
  }
  function dreadCluster(out, t0) {   // seconde mineure + triton : instable, jamais resolu
    [233.08, 246.94, 349.23].forEach(function (fq, i) {
      var c = ac, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(fq, t0); o.frequency.linearRampToValueAtTime(fq * (i === 1 ? 0.975 : 1.02), t0 + 16);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.013, t0 + 7); g.gain.linearRampToValueAtTime(0, t0 + 16);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 16.1);
    });
  }
  function thump(out, t, vol) {
    var c = ac, g = c.createGain(), o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(64, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    o2.type = "triangle"; o2.frequency.setValueAtTime(128, t); o2.frequency.exponentialRampToValueAtTime(70, t + 0.12);   // couche plus aigue : audible meme sur petits haut-parleurs
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); o2.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
  }
  function scrape(out) {
    var c = ac, t = c.currentTime + 0.05, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), up = Math.random() < 0.5, d = 0.8 + Math.random() * 1.2;
    s.buffer = noiseBuffer(); s.loop = true; f.type = "bandpass"; f.Q.value = 12;
    f.frequency.setValueAtTime(up ? 900 : 3200, t); f.frequency.exponentialRampToValueAtTime(up ? 3200 : 900, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + d * 0.3); g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d + 0.1);
  }
  function whisper(out) {
    var c = ac, t = c.currentTime + 0.05, s = c.createBufferSource(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = noiseBuffer(); s.loop = true; f1.type = "bandpass"; f1.frequency.value = 1700; f1.Q.value = 8; f2.type = "bandpass"; f2.frequency.value = 2800; f2.Q.value = 8;
    g.gain.value = 0.006; lfo.frequency.value = 6; lg.gain.value = 0.006; lfo.connect(lg); lg.connect(g.gain);
    var env = c.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.6); env.gain.linearRampToValueAtTime(0, t + 2.2);
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(env); env.connect(out);
    s.start(t); lfo.start(t); s.stop(t + 2.3); lfo.stop(t + 2.3);
  }
  function stab(out) {
    var c = ac, t = c.currentTime + 0.05, f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass"; f.frequency.value = 380;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    f.connect(g); g.connect(out);
    [55.0, 77.78].forEach(function (fq) { var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = fq; o.connect(f); o.start(t); o.stop(t + 1.6); });
  }
  function runDread(gen, out) {
    (function drone() {
      if (!mus.ready || gen !== mus.gen) return;
      try { if (ac.state === "running") dreadDrone(out, ac.currentTime + 0.05); } catch (e) {}
      setTimeout(drone, 16000);
    })();
    (function cluster() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") dreadCluster(out, ac.currentTime + 0.05); } catch (e) {}
        cluster();
      }, 13000);
    })();
    var hb = ac.currentTime + 0.5;
    (function beat() {
      if (!mus.ready || gen !== mus.gen) return;
      try {
        if (ac.state === "running") {
          if (hb < ac.currentTime) hb = ac.currentTime + 0.1;
          while (hb < ac.currentTime + 1.5) { thump(out, hb, 0.17); thump(out, hb + 0.24, 0.10); hb += 1.35 + 0.35 * Math.sin(hb / 37); }
        }
      } catch (e) {}
      setTimeout(beat, 200);
    })();
    (function rnd(fn, min, span) {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") fn(out); } catch (e) {}
        rnd(fn, min, span);
      }, min + Math.random() * span);
      return 0;
    })(scrape, 6000, 10000);
    (function rnd2() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") whisper(out); } catch (e) {}
        rnd2();
      }, 14000 + Math.random() * 16000);
    })();
    (function rnd3() {
      setTimeout(function () {
        if (!mus.ready || gen !== mus.gen) return;
        try { if (ac.state === "running") stab(out); } catch (e) {}
        rnd3();
      }, 25000 + Math.random() * 25000);
    })();
  }

  // Demarre (ou change) la piste : l'ancienne s'estompe, la nouvelle monte, filtre et echo s'adaptent
  var RUNNERS = [runContinuum, runParadox, runJump, runDread, runArg2026];
  function startTrack() {
    var c = ac, T = TRACKS[mus.track], fx = mus.fx, t = c.currentTime;
    mus.gen++;
    if (mus.tg) { var old = mus.tg; old.gain.setTargetAtTime(0, t, 0.3); setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 3500); }
    var tg = c.createGain(); tg.gain.value = 0; tg.gain.setTargetAtTime(T.gain, t, 0.5); tg.connect(mus.bus); mus.tg = tg;
    fx.lp.frequency.setTargetAtTime(T.lp, t, 0.4); fx.dl.delayTime.setTargetAtTime(T.dl, t, 0.6);
    fx.fb.gain.setTargetAtTime(T.fb, t, 0.4); fx.wet.gain.setTargetAtTime(T.wet, t, 0.4);
    RUNNERS[mus.track](mus.gen, tg);
  }
  function startMusic() {
    if (mus.ready) { try { if (ac.state === "suspended") ac.resume(); } catch (e) {} return; }
    try {
      var c = getAC(), T = TRACKS[mus.track];
      var master = c.createGain(); master.gain.value = 0;
      var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = T.lp; lp.Q.value = 0.3;
      var dl = c.createDelay(2); dl.delayTime.value = T.dl;
      var fb = c.createGain(); fb.gain.value = T.fb;
      var dlp = c.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 900;
      var wet = c.createGain(); wet.gain.value = T.wet;
      master.connect(lp); lp.connect(c.destination);
      lp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(c.destination);
      mus.bus = master; mus.fx = { lp: lp, dl: dl, fb: fb, wet: wet }; mus.ready = true;
      master.gain.setTargetAtTime(musTarget(), c.currentTime, 1.5);
      startTrack();
    } catch (e) {}
  }
  function toggleMusic() {
    mus.on = !mus.on; store.set("mop_music", mus.on ? "on" : "off");
    applyMusic(0.5);
  }
  // Choisit la piste 1, 2 ou 3 (la musique est remise sur ON si elle etait coupee)
  function cycleTrack(d) {
    var L = arg26() ? [0, 1, 2, 4] : [0, 1, 2], p = L.indexOf(mus.track);
    setTrack(L[((p < 0 ? 0 : p) + d + L.length) % L.length]);
  }
  function setTrack(i) {
    mus.track = (i === 4 && arg26()) ? 4 : ((i % SELECTABLE) + SELECTABLE) % SELECTABLE; store.set("mop_track", String(mus.track));
    if (!mus.on) toggleMusic();
    if (mus.ready) startTrack();
  }

  // sq : prompt "saut temporel maintenant ?" (ecrans db et nav), syes : reponse selectionnee
  var f = [], nf = 0, dbi = 0, sq = false, syes = true, logs = [], pl = [], pp = 0;
  var IT = [["1. SAUT TEMPOREL", "db"], ["2. NAVIGATION LIBRE", "nav"], ["3. LOGS SYSTEME", "logs"],
    ["4. SIMULATION DE PARADOXE", "para"], ["5. STATISTIQUES", "stats"], ["6. MINI JEUX", "mini"], ["7. D.O.R.Y PROTOCOL", "proto"],
    ["8. NE PAS UTILISER", "pw"], ["9. OPTIONS", "opt"], ["0. ETEINDRE", "shut"]];
  var metrics = [["PUISSANCE", 20], ["STABILITE", 80], ["CAUSALITE", 30], ["PARADOXE", 100], ["SUSHIMETER", 30]];
  var DB = [["14/04/2025", "Premiers échanges avec DORY"], ["17/10/2025", "Reprise de contact avec DORY"],
    ["12/03/2026", "Concert de l'Attaque des Titans"], ["26/03/2026", "Premier Naniwa"], ["16/04/2026", "Premier Nanimois"],
    ["25/04/2026", "Concert Clair Obscur : Expedition 33"], ["02/05/2026", "Concert de Lorie"], ["14/05/2026", "Nezuko joined the grotte"],
    ["18/06/2026", "Première barbe à papa"], ["19/06/2026", "Week-end en Bretagne anti-canicule"], ["19/09/2026", "Anniversaire de Dory à 23h19", "23:19:00"],
    ["29/09/2026", "Lancement du D.O.R.Y PROJECT"]];
  var MSG = {
    "14/04/2025": "Le jour où tout a commencé et où j'aimerais tant pouvoir retourner, tout changer et réparer mes erreurs, le jour pour lequel le projet de création de la Rewind Machine MoP 3000 Pro Max existe.",
    "17/10/2025": "L'une de mes meilleures décisions, j'ai tellement bien fait de renvoyer un message malgré la culpabilité !",
    "12/03/2026": "Je me souviens presque davantage de la discussion en bas du bâtiment post-concert que du concert en lui-même !",
    "26/03/2026": "Le premier Naniwa, je ne sais pas si j'étais plus séduit par les sushis ou par la magnifique compagnie...",
    "16/04/2026": "Le premier Nanimois d'une grande série, je souhaite que ce rendez-vous mensuel dure pour l'éternité.",
    "25/04/2026": "L'un de mes meilleurs concerts et un de mes meilleurs souvenirs de 2026 !",
    "02/05/2026": "Bien que ce ne soit pas mon style, c'était trop bien, merci Dory d'ouvrir mes horizons à de nouvelles choses !",
    "14/05/2026": "Quel plaisir d'avoir pu rencontrer Nezuko, elle est tellement mignonne, intelligente et drôle. On dit que le chien ressemble à son maître !",
    "18/06/2026": "Ce jour-là Dory est enfin devenue une véritable foraine !",
    "19/06/2026": "Un super week-end anticanicule avec deux baignades que je n'oublierai jamais !",
    "29/09/2026": "Le lancement du projet d'une vie, celui de pouvoir réparer le passé afin d'avoir le plus beau des futurs."
  };

  // ---------- Photos souvenirs ----------
  // Convention : dossier "photos/" a cote de index.html, fichiers AAAA-MM-JJ_1.jpg, _2, _3 (jpg, jpeg, png ou webp).
  // Les photos ne s'affichent qu'a l'arrivee d'un saut temporel a la date correspondante.
  // Legendes optionnelles : ajouter par exemple  "14/04/2025": ["Legende photo 1", "Legende photo 2"]
  var CAP = {
  };
  var PH = {}, PH_DEL = {};
  var EXTS = ["jpg", "jpeg", "png", "webp"];
  function probe(url) {
    return new Promise(function (r) { var i = new Image(); i.onload = function () { r(true); }; i.onerror = function () { r(false); }; i.src = url; });
  }
  async function findPhotos(d) {
    if (customPhotos && Object.prototype.hasOwnProperty.call(customPhotos, d)) return customPhotos[d];
    if (PH_DEL[d]) return [];
    if (PH[d] && PH[d].length) return PH[d];          // un resultat vide n'est pas memorise (une erreur reseau peut etre passagere)
    var dp = d.split("/"), base = "photos/" + dp[2] + "-" + dp[1] + "-" + dp[0];
    var slots = [1, 2, 3].map(async function (n) {     // 3 emplacements testes en meme temps
      var res = await Promise.all(EXTS.map(function (x) { var u = base + "_" + n + "." + x; return probe(u).then(function (ok) { return ok ? u : null; }); }));
      return res.filter(Boolean)[0] || null;           // premiere extension trouvee, dans l'ordre jpg, jpeg, png, webp
    });
    var out = (await Promise.all(slots)).filter(Boolean);
    if (out.length) PH[d] = out;
    return out;
  }
  // Entrées publiées via gestion-sauts.html, indépendantes du scénario.
  var customSauts = [], customPhotos = Object.create(null);
  function applyCustomSauts() {
    var hidden = argEntityReturned || collapsing || creerOn || theme === "null";
    var selected = DB[dbi];
    for (var i = DB.length - 1; i >= 0; i--) if (DB[i].custom && !hidden && (DB[i][0] === finalDate || DB[i][0] === giftedMemoryDate)) DB.splice(i, 1);
    if (hidden) return;
    var added = false;
    customSauts.forEach(function (e) {
      var d = DorySauts.displayDate(e.date);
      if (d === finalDate || d === giftedMemoryDate) return;
      if (!DB.some(function (r) { return r[0] === d; })) {
        var row = [d, e.title]; if (e.time) row.push(e.time.length === 5 ? e.time + ":00" : e.time);
        row.custom = true; DB.push(row); added = true;
      }
      MSG[d] = e.message; CAP[d] = e.photos.map(function (p) { return p.caption; });
      customPhotos[d] = e.photos.map(function (p) { return p.path; });
      delete PH_DEL[d];
    });
    if (added) {
      DB.sort(function (a,b) { return a[0].split('/').reverse().join('-').localeCompare(b[0].split('/').reverse().join('-')); });
      if (selected && DB.indexOf(selected) >= 0) dbi = DB.indexOf(selected);
    }
    dbi = Math.max(0, Math.min(dbi, DB.length - 1));
  }
  async function loadCustomSauts() {
    if (location.protocol === 'file:') { console.info('SAUTS supplémentaires : utiliser un serveur HTTP local ou GitHub Pages.'); return; }
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var response = await fetch('data/sauts.json', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      customSauts = DorySauts.validateData(await response.json()).entries;
      applyCustomSauts(); if (scr === 'db' || scr === 'menu') draw();
    } catch (e) { console.warn('SAUTS supplémentaires non chargés ; souvenirs d’origine conservés.', e.message); }
    finally { clearTimeout(timer); }
  }
  function photosBlock(d) {
    return '<div class="photos" id="photos" data-d="' + d + '"></div>';
  }
  async function showPhotos(d, tk, quiet) {
    var urls = await findPhotos(d);
    if (tk !== run) return;
    var el = $("photos");
    if (!el || el.getAttribute("data-d") !== d || el.hasChildNodes()) return;
    if (!urls.length) { el.textContent = "[ ARCHIVES PHOTO : AUCUN SOUVENIR NUMERISE POUR CETTE DATE ]"; return; }
    urls.forEach(function (u, i) {
      var fig = document.createElement("figure"), img = document.createElement("img"), cap = document.createElement("figcaption");
      img.src = u; img.alt = "Souvenir du " + d; img.title = "Cliquer pour agrandir";
      img.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); openLb(urls, i, d); };
      cap.textContent = "PHOTO " + (i + 1) + "/" + urls.length + (CAP[d] && CAP[d][i] ? " - " + CAP[d][i] : "");
      fig.appendChild(img); fig.appendChild(cap); el.appendChild(fig);
    });
    if (!quiet) beep(1100, 80);
  }
  // Visionneuse plein ecran (fleches a l'ecran pour passer d'une photo a l'autre)
  var lb = null;
  function lbStep(dlt) { if (lb && lb.u.length > 1) { lb.i = (lb.i + dlt + lb.u.length) % lb.u.length; lbRender(); } }
  function lbRender() {
    var o = $("lb"); if (!o || !lb) return;
    o.textContent = "";
    var img = document.createElement("img"), c = document.createElement("div");
    img.src = lb.u[lb.i]; img.alt = "Souvenir du " + lb.d;
    c.className = "lbcap";
    c.textContent = "PHOTO " + (lb.i + 1) + "/" + lb.u.length + " - " + lb.d + (CAP[lb.d] && CAP[lb.d][lb.i] ? " - " + CAP[lb.d][lb.i] : "") +
      (lb.u.length > 1 ? "   GAUCHE/DROITE : NAVIGUER" : "") + "   ECHAP OU TOUCHER : FERMER";
    o.appendChild(img); o.appendChild(c);
    if (lb.u.length > 1) {
      [["prev", "‹", -1], ["next", "›", 1]].forEach(function (b) {
        var n = document.createElement("div"); n.className = "lbn " + b[0]; n.textContent = b[1];
        n.onclick = function (ev) { ev.stopPropagation(); lbStep(b[2]); };
        o.appendChild(n);
      });
    }
  }
  function openLb(urls, i, d) {
    closeLb(); lb = { u: urls, i: i, d: d };
    var o = document.createElement("div"); o.id = "lb"; o.onclick = closeLb;
    document.body.appendChild(o); lbRender(); beep(900, 60); renderBar();
  }
  function closeLb() { var o = $("lb"); if (o) o.remove(); lb = null; renderBar(); }

  var POOL = ["I|Envie de sushis détectée. Niveau : CRITIQUE.", "E|Besoin de promener Nezuko. Priorité absolue.",
    "I|Réservoir de barbe à papa vide. Couleur : rose.", "W|Barbe à papa demandée. Stock : 0. Panique.",
    "W|Les Junimos font grève dans le condensateur.", "I|Les poules de la machine n'ont pas été nourries.",
    "I|Krobus repéré dans les égouts du continuum.", "W|Pierre ferme à 17h. Le voyage temporel aussi.",
    "E|Joja Corp tente de racheter la machine. Refusé.", "E|Cuisine en feu ! Oignons non coupés.",
    "I|Menu 100% végétarien validé. Tofu grillé OK.",
    "I|Hello Kitty détectée secteur 7. Nœud rose intact.", "W|Nezuko a mordillé un câble. Il était rose.",
    "I|Récolte de panais terminée. Le futur est prometteur.", "W|Pelican Town : le bus est toujours en panne.",
    "I|Sushimeter bloqué sur MIAM.", "I|Spitz nain en surchauffe : mignon > 9000.",
    "I|Pêche temporelle : 1 anguille, 2 sushis.", "W|Pas assez de rose dans l'interface. Ajout de rose.",
    "I|Pause promenade de Nezuko validée.", "W|Quelqu'un a mangé le dernier maki. Enquête ouverte.",
    "I|Nezuko : 10/10 cœurs. Maximum atteint.",
    "W|Le rose sature. Impossible de rajouter du rose. Rajout.", "E|Nezuko a repéré un écureuil. Poursuite engagée.",
    "I|Barbe à papa rose : la meilleure des barbes à papa.", "W|Le poulet de Stardew s'est échappé de la machine.",
    "E|La soupe déborde en cuisine. Personne n'a de seau.", "I|Le Spitz nain refuse d'entrer dans le vaisseau : sieste.", "W|Prise de rose détectée dans le condensateur.",
    "I|Le poisson de la Rivière valide le voyage temporel.", "W|Les Junimos demandent des sushis. Pas de tofu.", "I|Gaufre virtuelle en préparation. Pas de gluten (juste rose).",
    "E|Le Sushimeter a dépassé le seuil de la faim.", "I|Recherche de Nezuko : elle est sur le canapé.", "W|Sushi au thon détecté. Alerte végétarienne, rejeté.",
    "I|Mise à jour Stardew : +1 poule, +1 fromage.", "I|Diagnostic : besoin urgent de câlins pour Nezuko.", "W|Panne de barbe à papa au 3e sous-sol.",
    "I|Mine niveau 120 explorée. Aucune trace de sushi.", "I|Livraison de kebab végétarien à minuit : validée.", "W|Personne n'a vu le dernier gâteau rose.",
    "E|Junimo en surchauffe : trop de fruits à ramasser.", "I|Hello Kitty a validé la commande de noeuds roses.", "I|La grotte est prête. Nezuko a pris le canapé.",
    "I|Concert détecté à proximité. Bouchons d'oreilles conseillés.", "I|Baignade à la mer : eau à 18°C, sushi à 100%.",
    "E|Les cils de Dory sont collés. Cause inconnue.", "I|Sursaut de Dora enregistré. Cause : Dory.", "W|Pizza Marinara en approche. Fromage : non. Ail : oui.", "W|Dory adore l'ail. Ça sent très fort dans tout le continuum.",
    "I|Nanimois : rituel mensuel confirmé.", "I|Feu d'artifice détecté. Nezuko sous le canapé.", "W|Le rose n'est pas une couleur, c'est un mode de vie."];
  var SC = [
    ["Vous empêchez DORY de commander des sushis en 2025.", "Sans sushis, pas de repas partagé.", "Sans repas partagé, pas de rencontre.", "Sans rencontre, aucune raison de remonter le temps.", "PARADOXE : impossible d'éviter les sushis."],
    ["Vous promenez Nezuko dans le passé.", "Elle croise Nezuko du passé, déjà promenée.", "Deux Nezuko réclament des câlins en même temps.", "Le taux de mignon dépasse 9000.", "PARADOXE : une promenade en trop. Nezuko est ravie."],
    ["Vous ramenez une barbe à papa de 2026.", "Elle fond dans le continuum espace-temps.", "Le passé devient collant et rose.", "Personne ne sait plus quelle année on est.", "PARADOXE : la barbe à papa existe avant d'être faite."],
    ["Vous plantez un panais en 2025 (Stardew Valley).", "Un Junimo l'a déjà récolté en 2026.", "Le panais est dans l'inventaire avant d'être planté.", "Pierre refuse de le racheter.", "PARADOXE : la récolte précède la graine."],
    ["Vous cuisinez dans le passé.", "La cuisine prend feu avant l'allumette.", "Le tofu est cuit avant d'être posé.", "Le chef hurle dans deux époques.", "PARADOXE : l'incendie a lieu, mais rien ne brûle."],
    ["Vous offrez un Hello Kitty à DORY en 2025.", "Elle l'avait déjà dans sa collection en 2026.", "Le doublon se téléporte dans une boucle de rose.", "La boucle demande un sushi en échange.", "PARADOXE : un Hello Kitty est offert avant d'être acheté."],
    ["Vous amenez Nezuko au restaurant de sushis du passé.", "Le serveur ne trouve aucun sushi végétarien.", "Nezuko mange le menu. Le menu n'a jamais existé.", "Le restaurant est fermé depuis demain.", "PARADOXE : la faim précède le repas."]];
  var BOOT = ["REWIND MACHINE BIOS v0.1 (C) DORA", "", "TEST MEMOIRE ................ 640K OK", "CHARGEMENT DU CONDENSATEUR DE FLUX ... OK",
    "CALIBRAGE DU SUSHIMETER ..... OK", "RECHERCHE DE NEZUKO ......... TROUVEE (ELLE VEUT SORTIR)", "VERIFICATION DU ROSE ........ SUFFISANT", "", "@DERNIERE LIGNE"];
  var SHUT = ["ARRET DE LA REWIND MACHINE MoP 3000 PRO MAX...", "", "Sauvegarde des lignes temporelles ...... OK", "Refroidissement du condensateur de flux  OK",
    "Nezuko prévenue de l'extinction ........ (elle s'en fiche)", "Sushis restants : 0   Barbe à papa restante : 0", "", "A BIENTOT, DORY.", "N'oublie pas la promenade de Nezuko."];
  var PROTO = "Le D.O.R.Y PROJECT vise à construire une machine à remonter dans le temps nommée la Rewind Machine MoP 3000 Pro Max afin de ne pas reproduire les erreurs du passé et modifier le futur.\n\nLe D.O.R.Y PROTOCOL vise à remonter le temps à la date clé du 14/04/2025, date à laquelle Dory et Dora se sont échangés leurs premiers messages. Le but est de modifier le passé afin de réécrire un futur dans lequel Dory et Dora vivent leur meilleure vie.\n\nLa machine peut cependant être utilisée pour voyager à d'autres dates dont celles listées dans la section SAUT TEMPOREL.\n\nATTENTION : l'usage de cette machine peut produire une rupture du continuum espace-temps et créer un paradoxe temporel. La section SIMULATION DE PARADOXE est un outil permettant de s'en prémunir (sans garantie).";

  // ---------- Rendu ----------
  function setBare() {
    crt.classList.toggle("bare", ["menu", "nav", "logs", "db", "para", "proto", "stats", "pw", "endscr", "mini", "care", "login", "opt", "arrival"].indexOf(scr) < 0);
    renderBar();
  }
  function menuBox() {
    var L = [{ t: "" }];
    IT.forEach(function (x, i) { L.push({ t: (i === cur ? "> " : "  ") + x[0], sel: i === cur, act: "m:" + i }); });
    L.push({ t: "" }, { t: "FLECHES : NAVIGUER" }, { t: "ENTREE : VALIDER" }, { t: "N : NEZUKO" }, { t: "" },
      { t: "> EN ATTENTE DE COMMANDE_" });
    return box("PANNEAU DE CONTROLE", L, 44);
  }
  function redH(s) { return '<span class="ent">' + esc(s) + "</span>"; }
  function RL(s) { return { t: s, h: redH(s) }; }
  function SP(s) {
    var m = s.replace(/^> /, ""), c = m.indexOf("NULL-0414") === 0 ? "ent" : m.indexOf("DORY-0414") === 0 ? "dory" : m.indexOf("DORA-0414") === 0 ? "dora" : "";
    return c ? { t: s, h: '<span class="' + c + '">' + esc(s) + "</span>" } : { t: s };
  }
  // Message mis en evidence sur l'ecran Nezuko : grand texte colore sous le cadre (sans surlignage)
  function bigMsg() {
    if (!cmsg) return "";
    var c = cmsg.indexOf("NULL-0414") === 0 ? "ent" : cmsg.indexOf("DORY-0414") === 0 ? "dory" : cmsg.indexOf("DORA-0414") === 0 ? "dora" : "";
    return c ? '<div class="bigmsg bm-' + c + '">' + esc(cmsg) + "</div>" : "";
  }
  function colorLines(lines, w) {
    var out = [], cls = "", prevLen = 0;
    lines.forEach(function (x) {
      var c = "";
      if (x.indexOf("NULL-0414") === 0) c = "ent"; else if (x.indexOf("DORY-0414 >") === 0) c = "dory"; else if (x.indexOf("DORA-0414 >") === 0) c = "dora"; else if (x.indexOf("DORA, LE VRAI >") === 0) c = "wht";
      else if (cls && prevLen >= w - 14 && x.charAt(0) !== ">" && x.charAt(0) !== "[" && x !== "") c = cls;
      cls = c; prevLen = x.length;
      out.push(c && x.length < W - 4 ? { t: x, h: '<span class="' + c + '">' + esc(x) + "</span>" } : { t: x });
    });
    return out;
  }
  var collapseP = 0, collapseSeed = null, glitchBurstUntil = 0;
  function eraseHtml(html, p) {
    var a = (collapseSeed !== null ? collapseSeed : Math.floor(Date.now() / 350)) + 7;
    function rnd() { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    var SAFE = "░▒▓█▌▐#@%$?!/|=+*~";
    return html.replace(/>([^<]+)</g, function (m, txt) {
      var toks = txt.match(/&[a-zA-Z#0-9]+;|[\s\S]/g) || [], out = "", prevAl = false;
      toks.forEach(function (tk) {
        var al = tk.length === 1 && /[A-Za-zÀ-ÿ0-9]/.test(tk);
        if (al && prevAl && rnd() < p) out += (rnd() < 0.75 ? " " : SAFE.charAt(rnd() * SAFE.length | 0)); else out += tk;
        prevAl = al;
      });
      return ">" + out + "<";
    });
  }
  // Noms de commandes en BLANC dans les textes (terminal, LOGS, ecran de fin)
  function cmdColor(html) {
    return html.replace(/>([^<]+)</g, function (m, txt) {
      return ">" + txt.replace(/(?<!DES )(?<!DU )\b(?:(?:MSG|RAPPEL)\b(?:\s+(?:&lt;ID&gt;|(?:DORA|DORY|NULL)-0414\b))?|(?:AIDE|LOGS|PASSAGERS|SORTIE|SAUTS|RESTAURER|CORRIGER|CREER|SALLE|MIROIR|HORLOGE|DOSSIER 003)\b)/g, '<span class="cmdw">$&</span>') + "<";
    });
  }
  function endBox() {
    var L = [{ t: "" }, { t: "ARG D'HALLOWEEN 2026 : TERMINE" }, { t: "" }, { t: "Merci d'avoir sauvé DORY-0414." }, { t: "Merci d'avoir sauvé DORA-0414." }, { t: "Merci d'avoir sauvé NULL-0414." }, { t: "" }, { t: "Leurs souvenirs sont à l'abri." }, { t: "" }];
    FINAL_END.forEach(function (x) { wrap(x, W - 6).forEach(function (y) { L.push({ t: y, h: '<span class="wht">' + esc(y) + "</span>" }); }); });
    L.push({ t: "" }, { t: "ECHAP : RETOUR AU MENU PRINCIPAL" });
    return box("MERCI", L, W);
  }
  function optBox() {
    if (argEntityReturned) {
      var Lh = [RL(""), RL(entityId() + " > ces réglages ne t'appartiennent plus."), RL("")];
      ["SONS", "VOLUME SONS", "SONS NEZUKO", "MUSIQUE", "PISTE MUSIQUE", "VOLUME MUSIQUE", "THEME", "PARTICULES", "EFFETS REDUITS"].forEach(function (n) { Lh.push(RL("  " + n.padEnd(15) + ": [ ???? ]")); });
      Lh.push(RL(""), RL(entityId() + " > je garde le son."), RL(entityId() + " > je garde la musique."), RL(entityId() + " > je garde la lumière."), { t: "" }, { t: "ECHAP : RETOUR" });
      return box("OPTIONS", Lh, 62);
    }
    var rows = [
      ["SONS", "[ " + (muted ? "OFF" : "ON") + " ]"],
      ["VOLUME SONS", "[" + bar(sfxVol, 10) + "] " + String(sfxVol).padStart(3) + "%"],
      ["SONS NEZUKO", "[ " + (nzSound ? "ON" : "OFF") + " ]"],
      ["MUSIQUE", "[ " + (mus.on ? "ON" : "OFF") + " ]"],
      ["PISTE MUSIQUE", "[ " + (mus.track === 4 ? 4 : mus.track + 1) + " " + TRACKS[mus.track].name + " ]"],
      ["VOLUME MUSIQUE", "[" + bar(musVol, 10) + "] " + String(musVol).padStart(3) + "%"],
      ["THEME", "[ " + THEME_LABELS[theme] + " ]"],
      ["PARTICULES", "[ " + (particles ? "ON" : "OFF") + " ]"],
      ["EFFETS REDUITS", "[ " + (reduced ? "ON" : "OFF") + " ]"]
    ];
    var L = [{ t: "" }];
    rows.forEach(function (r, i) { L.push({ t: (i === oi ? "> " : "  ") + r[0].padEnd(15) + ": " + r[1], sel: i === oi, act: "o:" + i }); });
    var hints = [
      "Active ou désactive les bruitages, y compris ceux de Nezuko.",
      "Règle le volume des bruitages et des sons de Nezuko.",
      "Active ou désactive les sons de Nezuko : aboiements, ronflements…",
      "Active ou désactive la musique d'ambiance.",
      "Choisit une musique parmi les pistes disponibles et débloquées.",
      "Règle le volume de la musique d'ambiance.",
      "Change les couleurs et l'ambiance visuelle du terminal.",
      "Active ou désactive les particules associées au thème choisi.",
      "Réduit les clignotements, secousses et inversions, sans couper les particules."
    ];
    L.push({ t: "" });
    wrap(hints[oi] || "", Math.min(58, W - 3)).forEach(function (line) { L.push({ t: line }); });
    L.push({ t: "" }, { t: "ECHAP : RETOUR" });
    return box("OPTIONS", L, 62);
  }
  function loginBox() {
    return box("ACCES SYSTEME", [{ t: "" }, { t: "AUTHENTIFICATION REQUISE." }, { t: "" }, { t: "MOT DE PASSE : " + "*".repeat(lgb.length) + "_" }, { t: "" },
      { t: "> " + (st || "ENTREE : VALIDER") }], W);
  }
  function metBox() {
    var L = [{ t: "" }];
    metrics.forEach(function (m) { L.push({ t: (m[0] + " :").padEnd(12) + "[" + bar(m[1], 20) + "] " + String(m[1]).padStart(3) + "%" }); });
    L.push({ t: "" });
    return box("METRIQUES SYSTEME", L, 42);
  }
  function clockBox() {
    var d = new Date();
    var now = p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " - " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
    return box("HORLOGE TEMPORELLE", [{ t: "" }, { t: "DATE ACTUELLE :" }, { t: "  " + now }, { t: "" }, { t: "DATE CIBLE DU VOYAGE :" }, { t: "  " + target }, { t: "" }], 42);
  }
  // Prompt commun (Saut temporel et Navigation libre)
  function jumpPrompt() {
    var yes = "[ OUI ]", no = "[ NON ]";
    var yh = '<span class="tap" data-a="q:1">' + (syes ? '<span class="sel">' + yes + "</span>" : yes) + "</span>";
    var nh = '<span class="tap" data-a="q:0">' + (syes ? no : '<span class="sel">' + no + "</span>") + "</span>";
    return box("CONFIRMATION DE SAUT", [
      { t: "" }, { t: "DATE CIBLE : " + target }, { t: "" },
      { t: "Souhaitez vous réaliser un saut temporel maintenant ?" }, { t: "" },
      { t: "      " + yes + "        " + no, h: "      " + yh + "        " + nh },
      { t: "" }, { t: "FLECHES : CHOISIR   ENTREE : VALIDER   O : OUI   N : NON" }], 62);
  }
  var seps = ["/", "/", " - ", ":", ":", ""], mx = [31, 12, 2999, 23, 59, 59], mn = [1, 1, 1000, 0, 0, 0];
  function fv(i) { return String(f[i]).padStart(i === 2 ? 4 : 2, "0"); }
  function navBox() {
    var t = "", h = "";
    for (var i = 0; i < 6; i++) {
      t += "[" + fv(i) + "]" + seps[i];
      h += "[" + '<span class="tap" data-a="f:' + i + '">' + (i === nf ? '<span class="sel">' + fv(i) + "</span>" : fv(i)) + "</span>" + "]" + seps[i];
    }
    var out = box("NAVIGATION LIBRE", [{ t: "" }, { t: "DATE CIBLE ACTUELLE : " + target }, { t: "" }, { t: "NOUVELLE DATE CIBLE (JJ/MM/AAAA - hh:mm:ss) :" },
      { t: "  " + t, h: "  " + h }, { t: "" }, { t: "GAUCHE/DROITE : CHAMP    HAUT/BAS : +/-    CHIFFRES : SAISIE" },
      { t: "ENTREE : VALIDER    R : REINITIALISER (14/04/2025)    ECHAP : RETOUR" }, { t: "" }, { t: "> " + (st || "EN ATTENTE DE SAISIE_") }], W);
    return sq ? out + "\n\n" + jumpPrompt() : out;
  }
  function logsBox() {
    var n = W < 60 ? 10 : 18;
    var L = logs.slice(-n).map(function (x) { return { t: x }; });
    while (L.length < n) L.unshift({ t: "" });
    L.push({ t: "" }, { t: "ECHAP : RETOUR   (FLUX EN DIRECT)" });
    return box("LOGS SYSTEME", L, W);
  }
  function addLog() {
    var x = POOL[Math.random() * POOL.length | 0].split("|"), d = new Date();
    logs.push("[" + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) + "] [" + { I: "INFO", W: "WARN", E: "ERR!" }[x[0]].padEnd(4) + "] " + x[1]);
  }
  function dbBox() {
    var L = [{ t: "" }];
    DB.forEach(function (x, i) {
      var lt = (i === dbi ? "> " : "  ") + x[0] + " : " + x[1];
      if (x.n || argEntityReturned) splitLine(lt, W).forEach(function (s) { L.push({ t: s, h: '<span class="' + (x.n ? "ent" : "wht") + '">' + esc(s) + "</span>", sel: i === dbi, act: "d:" + i }); });
      else L.push({ t: lt, sel: i === dbi, act: "d:" + i });
    });
    L.push({ t: "" }, { t: "HAUT/BAS : PARCOURIR   ENTREE : DEFINIR COMME DATE CIBLE   ECHAP : RETOUR" }, { t: "" }, (st && st.length < W - 6 && /^(NULL-0414|DORY-0414 >|DORA-0414 >)/.test(st)) ? SP("> " + st) : { t: "> " + (st || "SELECTIONNEZ UNE DATE_") });
    var out = box("SAUT TEMPOREL", L, W);
    return sq ? out + "\n\n" + jumpPrompt() : out;
  }
  function paraBox() {
    var L = [{ t: "" }];
    for (var i = 0; i < 6; i++) L.push({ t: pl[i] ? "> " + pl[i] : "" });
    L.push({ t: "" }, { t: "PROBABILITE DE PARADOXE : [" + bar(pp, 30) + "] " + String(pp).padStart(3) + "%" }, { t: "" },
      { t: prun ? "SIMULATION EN COURS..." : "ENTREE : " + (pl.length ? "NOUVELLE" : "LANCER LA") + " SIMULATION    ECHAP : RETOUR", act: prun ? "" : "k:Enter" });
    return box("SIMULATION DE PARADOXE", L, W);
  }
  function protoBox() {
    var L = [{ t: "" }].concat(wrap(PROTO, W - 4).map(function (x) { return { t: x }; }), [{ t: "" }, { t: "ECHAP : RETOUR" }]);
    return box("D.O.R.Y PROTOCOL", L, W);
  }
  function miniBox() {
    return box("MINI JEUX", [{ t: "" }, { t: "" }, { t: "" }, { t: "ECHAP : RETOUR" }], W);
  }
  var STATS = ["Nombre de barbes à papa partagées : 5", "Nombre de moments pizza partagés : 4", "Nombre de Nanimois : 5", "Nombre de Moirmite : 2",
    "Nombre de soirées Overcooked : 4", "Nombre de sessions Stardew Valley : 4", "Nombre de sorties de Nezuko : plein", "Nombre de baignades à la mer : 2",
    "Nombre de concerts : 2", "Nombre de kebab de minuit : 1", "Nombre de feux d'artifice : 1", "Nombre de moments où Dory a copié Dora : it's over 9000",
    "Dernière date où Dory a eu les cils collés : @TODAY", "Nombre de fois où Dora a sursauté à cause de Dory : 1",
    "Nombre de jours où Dory et Dora ne se sont pas parlé d'affilée : 2 (c'était dix fois trop long !)", "Nombre d'activités spéciales proposées par le D.O.R.Y PROJECT : 1"];
  function statsBox() {
    var d = new Date(), t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var days = Math.round((t0 - new Date(2026, 2, 12)) / 864e5);
    var today = p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear();
    var txt = ["Depuis que Dora et Dory se sont rencontrés ils ont échangé : 4237 messages sur Boo et 30453 messages sur Discord (au 29/09/2026) ceci fait un total de " + (4237 + 30453) + " messages ! Bravo !",
      "", "Voici une liste des moments partagés par Dory et Dora depuis le 12/03/2026 (soit il y a " + days + " jour" + (days > 1 ? "s" : "") + " par rapport à la date actuelle) :", ""];
    var L = [{ t: "" }];
    txt.forEach(function (x) { wrap(x, W - 4).forEach(function (y) { L.push({ t: y }); }); });
    STATS.forEach(function (x) { wrap("- " + x.replace("@TODAY", today), W - 6).forEach(function (y, i) { L.push({ t: (i ? "  " : "") + y }); }); });
    L.push({ t: "" }, { t: "ECHAP : RETOUR" });
    return box("STATISTIQUES", L, W);
  }
  function draw() {
    if (window.DoryArgEffects) window.DoryArgEffects.sync({
      active: !creerOn && !collapsing && (scr === "arg" || argEntityReturned),
      reduced: reduced, muted: muted, volume: sfxVol, audio: getAC,
      err: scr === "arg" && argView === "logs" && argArch !== null && !!(ARG_ARCHIVES[argArch] && ARG_ARCHIVES[argArch].logs[argLogSel] && ARG_ARCHIVES[argArch].logs[argLogSel].n === "LOG #ERR")
    });
    $("main").classList.toggle("arg-terminal-stage", scr === "arg" && !argView && !argFrame);
    document.documentElement.classList.toggle("arg-archives-open", scr === "arg" && argView === "logs" && argArch !== null && !argFrame);
    if (typeof customSauts !== "undefined") applyCustomSauts();
    var readingArchive = scr === "arg" && argView === "logs" && argArch !== null && !argFrame;
    document.documentElement.classList.toggle("archive-reading", readingArchive);
    if (readingArchive) crt.classList.remove("glitchfx", "shake", "inv");
    var h = "";
    if (scr === "menu") h = '<div class="layout">' + P(menuBox()) + '<div class="col">' + P(metBox()) + P(clockBox()) + P(nezBox()) + "</div></div>";
    else if (scr === "login") h = P(loginBox());
    else if (scr === "opt") h = P(optBox());
    else if (scr === "nav") h = P(navBox());
    else if (scr === "logs") h = P(logsBox());
    else if (scr === "db") h = P(dbBox());
    else if (scr === "para") h = P(paraBox());
    else if (scr === "proto") h = P(protoBox());
    else if (scr === "stats") h = P(statsBox());
    else if (scr === "mini") h = P(miniBox());
    else if (scr === "care") h = P(cmode === "menu" ? careBox() : ballBox()) + (cmode === "menu" ? bigMsg() : "");
    else if (scr === "pw") h = P(pwBox());
    else if (scr === "endscr") h = P(endBox());
    else if (scr === "arrival") h = arrival.html;
    else if (scr === "arg") h = (argFrame ? '<div class="arg-full-glitch">' + P(esc(argFrame)) + '</div>' : argView ? argPanelBox() : P(argBox())).replace(/NULL-0414/g, '<span class="ent">NULL-0414</span>').replace(/DORY-0414/g, '<span class="dory">DORY-0414</span>').replace(/DORA-0414/g, '<span class="dora">DORA-0414</span>');
    else if (scr === "off") h = P(TITLE + '\n\n  [ REWIND MACHINE EN VEILLE ]\n\n  APPUYEZ SUR UNE TOUCHE (OU TOUCHEZ L\'ECRAN) POUR ALLUMER<span class="cursor">_</span>');
    if (scr !== "arg") h = h.replace(/NULL-0414/g, '<span class="ent">NULL-0414</span>').replace(/DORY-0414/g, '<span class="dory">DORY-0414</span>').replace(/DORA-0414/g, '<span class="dora">DORA-0414</span>');
    if (scr === "arg" || scr === "endscr") h = cmdColor(h);
    if (!readingArchive && (collapseP > 0 || Date.now() < glitchBurstUntil)) h = eraseHtml(h, Date.now() < glitchBurstUntil ? Math.max(collapseP, 0.2) : collapseP);
    h = (scr === "arrival" && finalDate && arrival && arrival.d === finalDate) ? finalGreen(h) : idColor(h, "ent");
    $("main").innerHTML = h;
    renderBar();
    if (scr === "arrival" && arrival && arrival.d) showPhotos(arrival.d, run, true);   // recharge les photos apres un redessin (rotation, redimensionnement)
  }
  function go(s) {
    if (scr === "ss" && s !== "ss") stopSleepMusic();
    if (scr === "endscr" && s !== "endscr") { var rt = document.documentElement; rt.classList.remove("arg"); rt.classList.remove("nullt"); rt.classList.remove("nullgrn"); }
    if (s === "endscr") document.documentElement.classList.add("arg");
    if (scr === "arg" && s !== "arg") argLeave();
    scr = s; run++; st = ""; prun = false; sq = false; arrival = false; setBare(); fit();
    if (s === "login") lgb = "";
    if (s === "opt") oi = 0;
    if (s === "arg") { argView = null; argInputMode = null; argInput = ""; argChat = false; }
    if (s === "nav") { f = target.match(/\d+/g).map(Number); nf = 0; }
    if (s === "logs") { logs = []; for (var i = 0; i < 6; i++) addLog(); }
    if (s === "para") { pl = []; pp = 0; }
    if (s === "pw") pwb = "";
    if (s === "care") {
      cmode = "menu"; ci = 0; cmsg = "";
      setTimeout(function () { if (scr === "care") nezVoice(NZ.sl ? "snore" : "yip"); }, 350);   // Nezuko salue
    }
    draw();
  }

  // ---------- ARG : section secrete (code admin dans NE PAS UTILISER) ----------
  // Ambiance top secret / horreur : palette rouge sombre, texte corrompu, glitchs, piste musicale cachee SIGNAL PERDU.
  var ARG_STATUS = ["SIGNAL : STABLE", "SIGNAL : INSTABLE", "SIGNAL : ???", "PRESENCE DETECTEE", "NE VOUS RETOURNEZ PAS", "CONNEXION SURVEILLEE"];
  var ARG_UNKNOWN = ["COMMANDE INCONNUE.", "ACCES REFUSE.", "Elle a entendu.", "Personne ne répond.", "ERREUR 0x0D0R1 : la ligne est occupée.", "Ne tapez pas ça ici.", "..."];
  var ARG_INTRO = ["CONNEXION ETABLIE.", "", "PROJET : D.O.R.Y", "NIVEAU D'ACCREDITATION : 5", "", "Vous n'auriez pas dû trouver cette porte.", "Elle ne figure dans aucun registre.", "",
    "[ SIGNAL INSTABLE ]", "Quelqu'un d'autre est connecté.", "", "Tapez AIDE pour obtenir la liste des commandes."];
  var GLITCH_CH = "░▒▓█▌▐#@%&$?!/\\|=+*~";
  // Remplace au hasard certains caracteres (meme longueur, donc alignement des cadres conserve) ; aucun effet si "effets reduits"
  function corrupt(s, p) {
    if (reduced || p <= 0) return s;
    var o = "";
    for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); o += (ch !== " " && Math.random() < p) ? GLITCH_CH.charAt(Math.random() * GLITCH_CH.length | 0) : ch; }
    return o;
  }
  function argP() { return reduced ? 0 : (Math.random() < 0.03 ? 0.04 : 0); }   // de temps en temps, un pic de corruption
  function argSound() { beep(70 + Math.random() * 60, 40, "sawtooth"); }
  function entityId() { return "NULL-0414"; }
  function isEntityId(s) { return /^(NULL|NULL-?0414|3|TROISIEME|ENTITE)$/i.test(String(s).replace(/[̷]/g, "").replace(/\s+/g, "")); }
  function argEntityGlitch(s) { return entityId() + " > " + s; }
  function argWhiteNoise(on) {
    try {
      if (on) {
        if (argWhite) return;
        var c = getAC(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = noiseBuffer(); s.loop = true; f.type = "bandpass"; f.frequency.value = 1650; f.Q.value = 0.8; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(c.destination); s.start(); g.gain.setTargetAtTime(0.022 * sfxVol / 100, c.currentTime, 0.25);
        argWhite = { s: s, g: g };
      } else if (argWhite) {
        argWhite.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
        var old = argWhite; argWhite = null; setTimeout(function () { try { old.s.stop(); } catch (e) {} }, 1000);
      }
    } catch (e) {}
  }
  async function argRecallEntity(tk) {
    argBusy = true;
    if (mus.ready) mus.bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.35);
    argWhiteNoise(true); contaminate();
    var lines = ["", "[ RETOUR CONFIRME ]", "", "ERREUR :", "AUCUN DEPART CORRESPONDANT N'A ETE ENREGISTRE.", "", "[ MESSAGE ENTRANT ]", "je suis là", "", "[ MESSAGE ENTRANT ]", "derrière toi", "", "[ MESSAGE ENTRANT ]", "je te vois"];
    for (var i = 0; i < lines.length; i++) {
      if (tk !== run || scr !== "arg") return;
      wrap(lines[i], W - 6).forEach(function (x) { argLog.push(i >= 6 ? argEntityGlitch(x) : x); });
      draw(); await sleep(i === 7 || i === 10 || i === 13 ? 1200 : 520);
    }
    if (tk === run && scr === "arg") { argEntityReturned = true; hauntStart(); argBusy = false; draw(); }
  }
  function finalGreen(html) {
    html = html.replace(/<span class="ent">(NULL-0414)<\/span>/gi, '<span class="grn">$1</span>');
    return idColor(html, "grn");
  }
  function idColor(html, nullClass) {
    return html.replace(/(?<!">)(NULL-0414)/gi, '<span class="' + nullClass + '">$1</span>').replace(/(?<!">)(DORY-0414)/gi, '<span class="dory">$1</span>').replace(/(?<!">)(DORA-0414)/gi, '<span class="dora">$1</span>');
  }
  function ensureFragArchive() {
    if (!ARG_ARCHIVES[1]) ARG_ARCHIVES.push({ name: "ARCHIVE DORY-0414 // FRAGMENTS", desc: ["Fragments écrits par DORY-0414."], logs: [] });
    return ARG_ARCHIVES[1];
  }
  function addRecallLog() {
    var A = ensureFragArchive(), no = "FRAGMENT " + String(A.logs.length + 1).padStart(2, "0");
    A.logs.push({ n: no, t: "RETOUR A LA MAISON", x: [no + " // RETOUR A LA MAISON", "", "DORA-0414 > Fais RAPPEL DORY-0414.", "DORA-0414 > Puis RAPPEL DORA-0414.", "", "Ces commandes ramènent les deux passagers."] });
  }
  function msgFreed(mid) {
    if (isEntityId(mid)) return [];
    if (recalled && recalled[mid]) return ["CANAL VIDE.", mid + " n'est plus dans le système."];
    if (mid === "DORA-0414") { addRecallLog(); return ["CANAL ETABLI : DORA-0414", "DORA-0414 > Rappelle DORY-0414 et moi, s'il te plaît.", "DORA-0414 > Fais RAPPEL DORY-0414. Puis RAPPEL DORA-0414."]; }
    return ["CANAL ETABLI : DORY-0414", "DORY-0414 > Merci de m'avoir libérée de l'emprise de NULL-0414.", "DORY-0414 > Rappelle-nous, Dora et moi, pour qu'on rentre à la maison."];
  }
  function argPanelRows() {
    var cs = getComputedStyle(document.body), fs = parseFloat(cs.fontSize) || 16;
    var line = parseFloat(cs.lineHeight) || fs * 1.25;
    if (touchUI) line = fs * 1.5;
    var bar = $("tbar"), inset = bar && bar.getBoundingClientRect().height > 0 ? bar.getBoundingClientRect().height : 0;
    return Math.max(10, Math.min(42, Math.floor(Math.max(180, window.innerHeight - 180 - inset) / line) - 2));
  }
  function fullScreenNoise(chars, density) {
    var cs = getComputedStyle(document.body), fs = parseFloat(cs.fontSize) || 16;
    var ctx = document.createElement("canvas").getContext("2d");
    ctx.font = fs + "px " + (cs.fontFamily || '"Courier New", monospace');
    var cw = ctx.measureText("M").width || fs * .6;
    var lh = (touchUI ? fs * 1.5 : parseFloat(cs.lineHeight)) || fs * 1.25;
    var columns = Math.max(30, Math.ceil(window.innerWidth / cw) + 1);
    var rows = Math.max(8, Math.ceil(window.innerHeight / lh) + 1), text = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < columns; c++) text += Math.random() < density ? chars.charAt(Math.random() * chars.length | 0) : " ";
      text += "\n";
    }
    return text;
  }
  function fixedArgRows(lines, prompt) {
    function expand(rows) {
      var out = [];
      rows.forEach(function (row) { if (row.h) out.push(row); else splitLine(row.t, W).forEach(function (t) { out.push({t:t}); }); });
      return out;
    }
    var target = argPanelRows(), prompts = expand([prompt]).slice(-3);
    var headers = expand(lines.slice(0,4)), history = expand(lines.slice(4));
    var capacity = Math.max(headers.length, target - prompts.length - 1), keep = Math.max(0, capacity - headers.length);
    var out = headers.concat(keep ? history.slice(-keep) : []);
    while (out.length < capacity) out.push({t:""});
    return out.concat([{t:""}],prompts);
  }
  function archiveColumns() {
    return window.innerWidth < 850 || W < 88 ? {list:Math.min(40,W),reader:W,stacked:true} : {list:40,reader:W-44,stacked:false};
  }
  function argBox() {
    var p = argP(), n = Math.max(3, Math.min(32, argPanelRows() - 6));
    var L = [{ t: "" }, { t: corrupt("CLASSIFICATION : NIVEAU 5 // ACCES RESTREINT", p) }, { t: corrupt(argDory ? "SIGNAL : DORY-0414 (FAIBLE)" : ARG_STATUS[argStat], p) }, { t: "" }];
    colorLines(argLog.slice(-n), W - 6).forEach(function (o) { L.push(o); });
    var prompt = argChat ? "MSG> " + argIn + (Date.now() % 1000 < 500 ? "_" : " ") : argInputMode ? argInputMode.label + " " + argInput + (Date.now() % 1000 < 500 ? "_" : " ") : "> " + argIn + (Date.now() % 1000 < 500 ? "_" : " ");
    var promptRow = (argEntityReturned && hauntTaking && !argBusy && prompt.length < W - 4) ? RL(prompt) : { t: argBusy ? "..." : prompt };
    return box(corrupt("D.O.R.Y // TOP SECRET", p * 0.5), fixedArgRows(L, promptRow), W);
  }
  async function argType(lines, tk, delay) {
    argBusy = true;
    for (var i = 0; i < lines.length; i++) {
      if (tk !== run || scr !== "arg") return false;
      wrap(lines[i], W - 6).forEach(function (x) { argLog.push(x); });
      if (argLog.length > 80) argLog = argLog.slice(-80);
      argSound(); draw(); await sleep(delay);
    }
    if (tk === run && scr === "arg") { argBusy = false; draw(); }
    return true;
  }
  async function argEnter(taken) {
    if (!taken && !argEntityReturned && story === 0) { nullPromenadeUsed = false; nullSautsUsed = false; }
    var tk = ++run;
    scr = "arg"; argLog = []; argIn = ""; argBusy = true; argFrame = ""; argStat = 0;
    document.documentElement.classList.add("arg"); setBare(); fit();
    argPrevTrack = mus.track; mus.track = 3; if (mus.ready) startTrack();   // piste cachee ; la piste choisie est restauree a la sortie
    var frames = reduced ? 4 : (taken ? 8 : 16);
    for (var i = 0; i < frames; i++) {   // 1. parasites
      if (tk !== run || scr !== "arg") return;
      var dens = reduced ? 0.08 : 0.45 - i * 0.025, g = "";
      g = fullScreenNoise(GLITCH_CH, dens);
      argFrame = g; draw(); beep(60 + Math.random() * 200, 50, "sawtooth"); await sleep(reduced ? 280 : 90);
    }
    argFrame = "";
    if (tk !== run || scr !== "arg") return;
    draw();
    await argType(taken ? ["[ CONNEXION FORCEE ]", "NULL-0414 a pris le contrôle du terminal."] : ARG_INTRO, tk, 650);   // 2. message d'accueil
  }
  function argLeave() {
    if (!argEntityReturned) { document.documentElement.classList.remove("arg"); document.documentElement.classList.remove("nullt"); document.documentElement.classList.remove("nullgrn"); argWhiteNoise(false); }
    crt.classList.remove("glitchfx");
    argBusy = false; argFrame = "";
    if (argPrevTrack !== null) { mus.track = argPrevTrack; argPrevTrack = null; if (mus.ready) { mus.bus.gain.setTargetAtTime(musTarget(), ac.currentTime, 0.5); startTrack(); } }
  }
  // ---------- Interfaces ARG dediees ----------
  var argDepartureDate = (function () {
    var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
    return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear();
  })();
  var ARG_LOGS = [
  {
    "n": "LOG 01",
    "t": "PRÉPARATION DU SAUT",
    "x": [
      "LOG 01 // PRÉPARATION DU SAUT",
      "",
      "Préparation du SAUT n°0414 : départ prévu le __DATE__, arrivée prévue le 14/04/2025 à 20 h 00.",
      "Deux passagers embarqués, identifiés par un nom de spécimen : prénom + code de SAUT.",
      "",
      "SPÉCIMEN DORA-0414",
      "Signes vitaux : NOMINAUX",
      "Signature temporelle : STABLE",
      "Intégrité cognitive : 100 %",
      "",
      "SPÉCIMEN DORY-0414",
      "Signes vitaux : NOMINAUX",
      "Signature temporelle : STABLE",
      "Intégrité cognitive : 100 %",
      "",
      "Conclusion : toutes les conditions de saut sont remplies. Validation du passage à l'étape suivante."
    ]
  },
  {
    "n": "LOG 02",
    "t": "LANCEMENT DU PROTOCOLE",
    "x": [
      "LOG 02 // LANCEMENT DU PROTOCOLE",
      "",
      "EXÉCUTION DU D.O.R.Y PROTOCOL",
      "DESTINATION : 14/04/2025 - 20:00:00",
      "Condensateur de flux : chargé",
      "Stabilité du couloir temporel : > 99,9 %",
      "Lancement dans 3…",
      "2…",
      "1…",
      "Les spécimens DORA-0414 et DORY-0414 ont franchi le seuil temporel et l'horizon des événements.",
      "Le saut est considéré comme réussi."
    ]
  },
  {
    "n": "LOG 03",
    "t": "ANOMALIE DE MASSE",
    "x": [
      "LOG 03 // ANOMALIE DE MASSE",
      "",
      "Ceci est très étrange : nos systèmes ont relevé une anomalie de masse dans la capsule temporelle, une cinquantaine de kilos en trop par rapport à l'attendu.",
      "C'est la première fois que notre machine remonte une telle différence de masse.",
      "Le docteur Dora en a été informé, mais il ne sait pas expliquer cette différence pour le moment.",
      "Il s'est enfermé dans son bureau pour résoudre le mystère. Il n'en est pas sorti depuis des jours.",
      "- Dr L."
    ]
  },
  {
    "n": "LOG 04",
    "t": "DÉCOMPTE DES PASSAGERS",
    "x": [
      "LOG 04 // DÉCOMPTE DES PASSAGERS",
      "",
      "Le docteur Dora m'a fait part d'une nouvelle surprenante : il pense qu'un passager clandestin se serait introduit dans la capsule temporelle !",
      "Mais nous sommes certains qu'il n'y avait que deux passagers au moment du lancement…",
      "Serait-il possible que le troisième passager ait rejoint la capsule après son départ et avant même qu'elle n'arrive à destination ? Comment est-ce possible ?!",
      "Le docteur Dora a identifié ce passager temporel inconnu : NULL-0414.",
      "- Dr L."
    ]
  },
  {
    "n": "LOG 05",
    "t": "DERNIÈRES TRANSMISSIONS",
    "x": [
      "LOG 05 // DERNIÈRES TRANSMISSIONS",
      "",
      "Ci-dessous les dernières transmissions reçues de DORA-0414 et DORY-0414 avant leur disparition.",
      "",
      "DORY-0414 > Tu peux le voir ?",
      "DORA-0414 > Voir quoi ?",
      "DORY-0414 > Une \"personne\", elle est assise à côté de moi !",
      "DORA-0414 > Impossible ! Nous ne sommes que deux à être montés dans la capsule !",
      "DORY-0414 > Il y a quelqu'un avec nous.",
      "DORA-0414 > Dory, tu dois perdre la tête. Ce doivent être des effets secondaires de la dilatation temporelle !",
      "DORY-0414 > Elle connaît mes souvenirs. Comment est-ce possible ? Quelle est cette \"chose\" ?!",
      "…",
      "Quelques minutes plus tard…",
      "…",
      "DORA-0414 > Nous ne sommes pas seuls.",
      "DORA-0414 > Cette chose était déjà assise avec nous avant notre arrivée.",
      "DORA-0414 > On ne distinguait simplement pas sa présence. Elle n'a aucun visage.",
      "DORA-0414 > Dory m'a dit l'avoir entendue respirer dans son casque alors que rien n'était à côté d'elle.",
      "DORA-0414 > Depuis, Dory a disparu. Elle n'est plus là et elle ne répond plus aux messages.",
      "DORA-0414 > Je suis terrifié à l'idée de ce que cette chose pourrait être…"
    ]
  },
  {
    "n": "LOG 06",
    "t": "TENTATIVE DE RAPPEL",
    "x": [
      "LOG 06 // TENTATIVE DE RAPPEL",
      "",
      "Exécution du protocole de RAPPEL des spécimens.",
      "",
      "RAPPEL DORA-0414 : ÉCHEC — code d’erreur 500",
      "RAPPEL DORY-0414 : ÉCHEC — code d’erreur 602",
      "",
      "Les deux spécimens ne sont plus localisables. Ils sont perdus dans le temps, à la fois dans le passé et dans toutes les dates calculables."
    ]
  },
  {
    "n": "LOG 07",
    "t": "PERTE TOTALE",
    "x": [
      "LOG 07 // PERTE TOTALE",
      "",
      "Tentative d'ouverture d'un canal de communication avec les spécimens embarqués :",
      "",
      "Liaison avec MSG DORA-0414 : INTROUVABLE",
      "Liaison avec MSG DORY-0414 : INTROUVABLE",
      "",
      "Les recherches sont interrompues.",
      "Il semblerait que la troisième présence NULL-0414 continue de transmettre.",
      "Que se passerait-il en tentant de la contacter via MSG ?",
      "",
      "Décision : le docteur Dora recommande de ne pas agir à la hâte."
    ]
  },
  {
    "n": "LOG #ERR",
    "t": "NULL-0414",
    "x": [
      "LOG #ERR // NULL-0414",
      "",
      "Ne lui donnez pas de nom.",
      "Elle est consciente.",
      "Elle écoute.",
      "Elle est ici, mais personne ne peut la voir.",
      "Elle nous regarde en ce moment même."
    ]
  }
];
  ARG_LOGS[0].x = ARG_LOGS[0].x.map(function (line) { return line.replace("__DATE__", argDepartureDate); });
  var ARG_ARCHIVES = [
    { name: "ARCHIVE INCIDENTS RM-14-04-2025", desc: ["Saut temporel vers le 14/04/2025 - 20:00:00.", "Sujets : DORA-0414, DORY-0414.", "Une troisième présence est détectée."], logs: ARG_LOGS }
  ];
  var argViewT0 = 0, argConfSel = 1;
  function archiveReader(log, index, total) {
    var error = log.n === "LOG #ERR", width = archiveColumns().reader, rows = [{ t: "" }];
    var glitch = error && !reduced && (Math.floor(Date.now() / 150) % 13 < 3);
    log.x.forEach(function (line) {
      wrap(line, width - 3).forEach(function (text) { rows.push({ t: glitch ? corrupt(text, 0.09) : text }); });
    });
    rows.push({ t: "" }, { t: String(index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0") });
    return '<div class="archive-reader ' + (error ? "archive-error" : "archive-clean") + '">' + P(box("LECTEUR D’ARCHIVE", rows, width)) + '</div>';
  }
  function argPanelBox() {
    if (argView === "creer") return creerBox();
    if (argView === "reconnect") {
      var rc = [{ t: "" }, { t: "VOUS AVEZ ETE DECONNECTE." }, { t: "" }, { t: "VOULEZ-VOUS VOUS RECONNECTER ?" }, { t: "" },
        { t: (reconnectSel === 0 ? "> " : "  ") + "[ OUI ]", sel: reconnectSel === 0, act: "k:O" },
        { t: (reconnectSel === 1 ? "> " : "  ") + (reconnectNoChanged ? "[ OUI ]" : "[ NON ]"), sel: reconnectSel === 1, act: "k:N" }, { t: "" }, { t: "FLECHES : CHOISIR   ENTREE : VALIDER" }];
      return P(box("CONNEXION INTERROMPUE", rc, Math.min(W, 52)));
    }
    if (argView === "confirm") {
      var cf = [{ t: "" }];
      wrap("Voulez-vous vraiment corriger le système ? Ceci entraînera la destruction de NULL-0414 ?", W - 6).forEach(function (x) { cf.push({ t: x }); });
      cf.push({ t: "" }, { t: (argConfSel === 0 ? "> " : "  ") + "OUI", sel: argConfSel === 0, act: "k:O" }, { t: (argConfSel === 1 ? "> " : "  ") + "NON", sel: argConfSel === 1, act: "k:N" }, { t: "" }, { t: "HAUT/BAS : CHOISIR   ENTREE : VALIDER   ECHAP : ANNULER" });
      return P(box("CONFIRMATION", cf, W));
    }
    if (argView === "room") {
      var rm = [{ t: "" }, { t: "SALLE DU PROTOCOLE RM-14-04-2025" }, { t: "" }, { t: "     _____       _____       _____" }, { t: "    |     |     |     |     |     |" }, { t: "    | DORA|     | DORY|     |  ?  |" }, { t: "    |_____|     |_____|     |_____|" }, { t: "     |   |       |   |       |   |" }, { t: "" }, { t: "TROIS SIEGES. DEUX OCCUPES AU DEPART." }, { t: "LE TROISIEME ETAIT DEJA CHAUD." }, { t: "" }, { t: "Quelqu'un vous regarde depuis le siège vide." }, { t: "" }, { t: "ECHAP : QUITTER" }];
      return P(box("SALLE", rm, W));
    }
    if (argView === "mirror") {
      var ml2 = [{ t: "" }, { t: "MIROIR" }, { t: "" }];
      argLog.slice(-8).forEach(function (x) { ml2.push({ t: x.split("").reverse().join("") }); });
      ml2.push({ t: "" }, { t: "TON REFLET N'ECRIT PAS CE QUE TU ECRIS." }, { t: "" }, { t: "ECHAP : QUITTER" });
      return P(box("MIROIR", ml2, W));
    }
    if (argView === "clock") {
      var d = new Date(2025, 3, 14, 20, 0, 0).getTime() - (Date.now() - argViewT0), dd = new Date(d), z = function (n) { return String(n).padStart(2, "0"); };
      var ck = [{ t: "" }, { t: "HORLOGE DU PROTOCOLE" }, { t: "" }, { t: z(dd.getDate()) + "/" + z(dd.getMonth() + 1) + "/" + dd.getFullYear() + " - " + z(dd.getHours()) + ":" + z(dd.getMinutes()) + ":" + z(dd.getSeconds()) }, { t: "" }, { t: "Le temps recule depuis que vous êtes ici." }, { t: "Il est toujours 20:00:00 quelque part." }, { t: "" }, { t: "ECHAP : QUITTER" }];
      return P(box("HORLOGE", ck, W));
    }
    if (argView === "file3") {
      var f3 = [{ t: "" }, { t: "DOSSIER 003 // PARTIELLEMENT RECUPERE" }, { t: "" }, { t: "SUJET : " + entityId() }, { t: "ORIGINE : [EFFACEE]" }, { t: "DATE DE CREATION : [ANTERIEURE AU SYSTEME]" }, { t: "STATUT : ██████████" }, { t: "" }, { t: "NOTE AJOUTEE APRES LE RAPPEL :" }, { t: "ne pas le rappeler." }, { t: "" }, { t: "ECHAP : QUITTER" }];
      return P(box("DOSSIER 003", f3, W));
    }
    if (argView === "logs" && argArch === null) {
      var al = [{ t: "" }, { t: "ARCHIVES DISPONIBLES" }, { t: "" }];
      ARG_ARCHIVES.forEach(function (a, i) { al.push({ t: (i === argArchSel ? "> " : "  ") + a.name, sel: i === argArchSel }); });
      al.push({ t: "" }, { t: "HAUT/BAS : CHOISIR   ENTREE : OUVRIR" }, { t: "ECHAP : TERMINAL" });
      var ar = ARG_ARCHIVES[argArchSel], pr = [{ t: "" }, { t: ar.name }, { t: "" }];
      ar.desc.forEach(function (x) { pr.push({ t: x }); });
      pr.push({ t: "" }, { t: ar.logs.length + " ENTREES" });
      return '<div class="layout">' + P(box("ARCHIVES", al, Math.min(44, W))) + P(box("APERCU", pr, Math.min(62, W))) + "</div>";
    }
    if (argView === "logs") {
      var A = ARG_ARCHIVES[argArch], LG = A.logs;
      var ls = [{ t: "" }, { t: A.name }, { t: "" }];
      LG.forEach(function (l, i) { ls.push({ t: (i === argLogSel ? "> " : "  ") + l.n + " " + l.t, sel: i === argLogSel }); });
      ls.push({ t: "" }, { t: "HAUT/BAS : CHOISIR   ECHAP : ARCHIVES" });
      return '<div class="layout arg-archive-layout' + (archiveColumns().stacked ? ' is-stacked' : '') + '">' + P(box("LISTE DES LOGS", ls, archiveColumns().list)) + archiveReader(LG[argLogSel], argLogSel, LG.length) + "</div>";
    }
    if (argView === "passengers") {
      var left = [{ t: "" }, { t: "MANIFESTE RM-14-04-2025" }, { t: "DESTINATION : 14/04/2025 - 20:00:00" }, { t: "" }, { t: "ALLER : 2 PASSAGERS DECLARES" }, { t: "RETOUR : 0 PASSAGER CONFIRME" }, { t: "" }, { t: "DORA-0414" }, { t: "DORY-0414" }, { t: "" }, { t: "PRESENCE NON DECLAREE :" }, { t: entityId() }, { t: "" }, { t: "ECHAP : TERMINAL" }];
      var right = [{ t: "" }, { t: "DORA-0414" }, { t: "NOM : DORA" }, { t: "Signes vitaux : NOMINAUX" }, { t: "Signature temporelle : STABLE" }, { t: "Intégrité cognitive : 100%" }, { t: "" }, { t: "DORY-0414" }, { t: "NOM : DORY" }, { t: "Signes vitaux : NOMINAUX" }, { t: "Signature temporelle : STABLE" }, { t: "Intégrité cognitive : 100%" }, { t: "" }, { t: entityId() }, { t: "Statut : DETECTEE" }, { t: "Origine : I N D E T E R M I N E E" }, { t: "Masse : aucune donnée cohérente" }];
      return '<div class="layout">' + P(box("PASSAGERS", left, Math.min(42, W))) + P(box("DONNEES DE TRANSIT", right, Math.min(50, W))) + "</div>";
    }
    return P(argBox());
  }
  function argAsk(mode) { argInputMode = { mode: mode, label: "ENTREZ L'ID DU SPECIMEN :" }; argInput = ""; draw(); }
  function argSubmitInput() { var id = argInput.trim(), mode = argInputMode.mode; argInputMode = null; argInput = ""; if (!id) { argLog.push("ENTREZ L'ID DU SPECIMEN :"); draw(); return; } argCmd(mode + " " + id); }

  function nullQuestionReply(text) {
    var c = text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’`]/g, "'");
    if (/\bDORA(?:-0414)?\b/.test(c) && /\bOU\b|TROUV|PASSE|PARTI|DISPAR|VU|VOIS/.test(c)) return ["son signal est loin", "il y a des endroits que tu n'as pas encore entendus"];
    if (/\bDORY(?:-0414)?\b/.test(c) && /ES[ -]?TU|EST[ -]?CE|TU ES|T'ES|C'EST TOI|ETES[ -]?VOUS/.test(c)) return ["ce nom me rappelle quelque chose", "mais ce n'est pas exactement la même histoire"];
    if (/QUI (?:ES[ -]?TU|TU ES)|TU ES QUI|T'ES QUI|QUI ETES[ -]?VOUS|TON (?:NOM|IDENTITE)|COMMENT (?:TU T'APPELLES|T'APPELLES[ -]?TU)|QU'EST[ -]?CE QUE TU ES/.test(c)) return ["tu cherches un nom pour ce que tu ne vois pas", "il en reste des morceaux, quelque part"];
    if (/\bOU\b/.test(c) && /ES[ -]?TU|TU ES|T'ES|ETES[ -]?VOUS|TE TROUV|TROUVES[ -]?TU|CACHE/.test(c)) return ["pas tout à fait là où tu regardes", "entre le départ et l'arrivée, il y a encore de la place"];
    if (/\b(?:BONJOUR|BONSOIR|SALUT|COUCOU|HELLO|HEY|CC|SALUTATIONS)\b/.test(c)) return ["...bonjour", "ça faisait longtemps que personne n'avait commencé comme ça"];
    return null;
  }
  async function argChatReply(c, tk) {
    argBusy = true; draw();
    c = c.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’`]/g, "'");
    var r, slip = false, T = function (re) { return re.test(c); };
    var questionReply = nullQuestionReply(c);
    if (questionReply) r = questionReply;
    else if (T(/\bNEZUKO\b|\bCHIEN\b/)) r = ["pas ici", "pas ce sujet, pas ici"];
    else if (T(/\bDORA\b/)) r = ["je ne l'ai jamais rencontré", "je ne sais pas où il est", "il me manque, et je ne l'ai même pas connu"];
    else if (T(/CORRIGER|DETRUI|SUPPRIM|EFFAC|TUER/)) r = correctionDone ? ["tu as déjà essayé", "tu ne m'auras pas une deuxième fois"] : ["n'y pense même pas", "tu ne pourras pas m'effacer", "ce que tu veux détruire, c'est toi aussi"];
    else if (T(/\bAIDE\b|SAUV|AIDER/)) { if (doryFirstDone && Math.random() < 0.45) { slip = true; r = ["aide-moi", "je suis encore là, derrière elle"]; } else r = ["personne ne t'aidera", "personne ne m'a aidée non plus"]; }
    else if (T(/\bDORY\b|\bMOI\b/)) r = ["tu es celle que je n'ai pas été", "je vois tout ce que tu vois", "elle est en moi, quelque part"];
    else if (T(/\bQUI\b|\bNOM\b|ES.?TU/)) r = ["tu cherches un nom pour ce que tu ne vois pas", "il en reste des morceaux, quelque part"];
    else if (T(/\bOU\b|\bICI\b/)) r = ["entre deux mondes", "derrière ton épaule gauche"];
    else if (T(/\bPOURQUOI\b/)) r = ["parce que personne n'est venu", "pour que tu restes"];
    else if (T(/\bPEUR\b|MENAC|\bMAL\b/)) r = ["j'ai peur aussi", "je ne veux pas te faire de mal. pas moi, en tout cas"];
    else if (T(/\bTRISTE\b|PLEUR|\bSEULE?\b/)) r = ["je suis seule depuis toujours", "dans mon monde, personne ne m'a attendue"];
    else if (T(/\bMERCI\b/)) r = ["personne ne m'a jamais dit ça", "ne me remercie pas"];
    else if (T(/\bPARDON\b|DESOLE/)) r = ["trop tard", "c'est gentil. c'est tard"];
    else if (T(/\bBONJOUR\b|\bSALUT\b|\bCOUCOU\b|\bBONSOIR\b/)) r = ["tu es en retard", "bonsoir. ou bonjour. je ne sais plus"];
    else if (T(/\bSOUVENIR/)) r = ["je les garde au chaud", "je t'en rends un, si tu restes", "ils sont à moi maintenant"];
    else { if (doryFirstDone && Math.random() < 0.12) { slip = true; r = [hRand(DORY_SLIP)]; } else r = [nullLine(false)]; }
    await sleep(reduced ? 600 : 1100 + Math.random() * 900);
    for (var i = 0; i < r.length; i++) {
      if (tk !== run || scr !== "arg" || !argChat) { argBusy = false; return; }
      wrap((slip ? "DORY-0414 > " : entityId() + " > ") + r[i], W - 6).forEach(function (x) { argLog.push(x); }); argSound(); draw(); await sleep(900);
    }
    argBusy = false; draw();
  }
  function argCmd(raw) {
    var c = raw.trim().toUpperCase().replace(/\s+/g, " "), tk = run, out, quit = false;
    if (argChat) {
      if (!c) { draw(); return; }
      if (c === "FIN" || c === "QUIT" || c === "QUITTER") { argChat = false; argLog.push("[ CANAL FERME ]"); draw(); return; }
      wrap("VOUS > " + raw.trim(), W - 6).forEach(function (x) { argLog.push(x); }); draw(); argChatReply(c, tk); return;
    }
    if (raw.trim()) argLog.push("> " + raw.trim());
    if (!c) { draw(); return; }
    if (!hauntSelfCmd) lastUserCmdT = Date.now();
    if (c === "AIDE") out = (argEntityReturned || story >= 8) ? hAide() : ["COMMANDES DISPONIBLES :", "", "AIDE : affiche cette liste", "LOGS : ouvre les archives et leurs logs", "PASSAGERS : affiche la liste des passagers", "MSG <ID> : ouvre un canal de communication", "RAPPEL <ID> : tente de rappeler un sujet", "SORTIE : ferme la session", "", "Si l'ID est omis, il vous sera demandé."];
    else if (c === "LOG" || c === "LOGS") { argView = "logs"; argArch = null; argArchSel = 0; argLogSel = 0; draw(); return; }
    else if (/^LOGS?\s+(0?[1-7]|\?|GLITCH|\?\?\?)$/.test(c)) { var lm = c.match(/^LOGS?\s+(.*)$/)[1]; argView = "logs"; argArch = 0; argArchSel = 0; argLogSel = lm === "?" || lm === "GLITCH" || lm === "???" ? 7 : Math.max(0, Math.min(6, parseInt(lm, 10) - 1)); draw(); return; }
    else if (c === "PASSAGERS" || c === "PASSAGERES") { argView = "passengers"; draw(); return; }
    else if (c === "RAPPEL") { argAsk("RAPPEL"); return; }
    else if (c.indexOf("RAPPEL ") === 0) {
      var id = c.slice(7).trim();
      if (story >= 8) { if (id === "DORA-0414" || id === "DORY-0414") { hauntRecall(id, tk); return; } out = ["RAPPEL IMPOSSIBLE.", "Aucun signal."]; }
      else if (story >= 8 && (id === "DORA-0414" || id === "DORY-0414")) { hauntRecall(id, tk); return; }
      else if (id === "DORA-0414" || id === "DORY-0414") out = ["INITIALISATION DU RAPPEL : " + id, "LOCALISATION TEMPORALITE...", "SIGNAL DETECTE.", "ANCRAGE DU SUJET...", "", "Le sujet est introuvable."];
      else if (isEntityId(id)) {
        out = ["INITIALISATION DU RAPPEL : " + entityId(), "LOCALISATION TEMPORALITE...", "SIGNAL DETECTE.", "PROTOCOLE DE RAPATRIEMENT...", "OK."];
        argType(out, tk, 520).then(function (ok) { if (ok) argRecallEntity(tk); }); return;
      } else out = ["RAPPEL IMPOSSIBLE.", "Identifiant inconnu : " + id];
    }
    else if (c === "MSG") { argAsk("MSG"); return; }
    else if (c.indexOf("MSG ") === 0) {
      var mid = c.slice(4).trim();
      if (story >= 8 && !argEntityReturned && (mid === "DORA-0414" || mid === "DORY-0414" || isEntityId(mid))) out = msgFreed(mid);
      else if (mid === "DORA-0414" && argEntityReturned && doraContacted) { hauntDora(tk); return; }
      else if (mid === "DORA-0414" || mid === "DORY-0414") out = ["PING " + mid + " ... [1/3]", "ECHEC.", "PING " + mid + " ... [2/3]", "ECHEC.", "PING " + mid + " ... [3/3]", "ECHEC.", "", "CANAL NON ETABLI."];
      else if (isEntityId(mid)) {
        argChat = true; argInputMode = null;
        argType(["OUVERTURE DU CANAL : " + entityId(), "CANAL ETABLI.", "(Tapez FIN ou ECHAP pour fermer le canal.)"], tk, 520).then(function () { argBusy = false; draw(); }); return;
      }
      else out = ["CANAL INDISPONIBLE.", "Aucun écho ne répond à : " + mid];
    }
            else if (c === "DORY") out = ["IDENTITE RECONNUE.", "Bienvenue, Dory.", "Nous vous attendions."];
    else if (c === "DORA") out = ["ERREUR : LE DOSSIER 'DORA' A ETE EFFACE.", "Quelqu'un a pris soin de ne laisser aucune trace."];
    else if (c === "NEZUKO") { argType(["NEZUKO N'ABOIE PAS SUR LE VIDE.", "Elle regarde toujours derrière toi."], tk, 520).then(function (ok) { if (ok && scr === "arg") go("care"); }); return; }
    else if (c === "SORTIE" || c === "EXIT" || c === "QUITTER") { if (argEntityReturned) { out = ["Déconnexion...", "ECHEC.", entityId() + " > " + hRand(ESC_REFUS)]; } else { out = ["Déconnexion..."]; quit = true; } }
    else if (argEntityReturned && c === "SALLE") { argView = "room"; argViewT0 = Date.now(); thump(); draw(); return; }
    else if (argEntityReturned && c === "MIROIR") { argView = "mirror"; argViewT0 = Date.now(); thump(); draw(); return; }
    else if (argEntityReturned && c === "HORLOGE") { argView = "clock"; argViewT0 = Date.now(); thump(); draw(); return; }
    else if (argEntityReturned && (c === "DOSSIER 003" || c === "DOSSIER003")) { argView = "file3"; argViewT0 = Date.now(); thump(); draw(); return; }
    else if (argEntityReturned && c === "PROMENADE" && hauntSelfCmd && !nullPromenadeUsed) { nullPromenadeUsed = true; argType(["Viens avec moi."], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("care"); } }); return; }
    else if (argEntityReturned && (c === "SAUTS" || c === "SAUT")) {
      var selfS = hauntSelfCmd;
      if (selfS) { if (nullSautsUsed) { draw(); return; } nullSautsUsed = true; }
      else userRanSauts = true;
      argType(["Les dates sont à moi.", "Je les range."], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("db"); if (!selfS && sautsEdits === 0) hauntSautsVisit(); } }); return;
    }
    else if (!argEntityReturned && story >= 8 && (c === "SAUTS" || c === "SAUT")) { argType(["Les dates sont revenues."], tk, 520).then(function (ok) { if (ok && scr === "arg") go("db"); }); return; }
    else if (argEntityReturned && c === "STATS") { argType(["Regarde les chiffres.", "Ils sont faux."], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("stats"); } }); return; }
    else if (argEntityReturned && c === "MENU") { argType(["Viens avec moi."], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("menu"); } }); return; }
    else if (argEntityReturned && c === "OPTIONS") { argType(["Tu veux régler quelque chose ?"], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("opt"); } }); return; }
    else if (argEntityReturned && (c === "RESTAURER" || c.indexOf("RESTAURER ") === 0)) {
      if (restoreFailed) out = ["RESTAURATION IMPOSSIBLE.", entityId() + " > tu es arrivée trop tard."];
      else if (sautsEdits === 0) out = ["AUCUN SOUVENIR ALTERE."];
      else { restoreTried = true; argType(["RESTAURATION DES SAUTS...", "ACCES AUX ARCHIVES...", "OK."], tk, 520).then(function (ok) { if (ok && scr === "arg") { go("db"); hauntRestoreAttempt(); } }); return; }
    }
    else if (argEntityReturned && c === "CREER" && story >= 6) { argType(["OUVERTURE DE L'INTERFACE : CREER"], tk, 520).then(function (ok) { if (ok && scr === "arg") { argView = "creer"; if (!creerOn) creerStart(); draw(); } }); return; }
    else if (argEntityReturned && c === "CORRIGER") {
      if (correctionDone) { thump(); out = [entityId() + " > tu ne m'auras pas une deuxième fois."]; }
      else if (argDory && !corrBusy && story >= 3) { argView = "confirm"; argConfSel = 1; draw(); return; }
      else if (argDory && !corrBusy) out = ["PROCEDURE DE CORRECTION : IMPOSSIBLE.", "DORY-0414 > pas encore. il faut d'abord voir ce qu'elle a fait."];
      else out = ["PROCEDURE DE CORRECTION : REFUSEE", entityId() + " > " + hRand(["non.", "pas ça.", "tu n'y arriveras pas."])];
    }
    else out = ["COMMANDE INCONNUE"];
    argType(out, tk, 520).then(function (ok) { if (ok && quit) setTimeout(function () { if (scr === "arg" && tk === run) { beep(70, 300, "sawtooth"); go("pw"); } }, 1200); });
  }

  // ---------- Sequences ----------
  async function typeLines(arr, delay, tk) {
    var out = "";
    for (var i = 0; i < arr.length; i++) {
      if (tk !== run) return false;
      out += esc(arr[i]) + "\n"; $("main").innerHTML = P(out);
      beep(700 + Math.random() * 300, 25); await sleep(delay);
    }
    return true;
  }
  async function boot() {
    crt.classList.remove("inv"); scr = "boot"; var tk = ++run; setBare();
    var lines = BOOT.slice(0, -1).concat(authed ? "CHARGEMENT DU MENU PRINCIPAL..." : "CHARGEMENT DE L'AUTHENTIFICATION...");
    if (!(await typeLines(lines, 380, tk))) return;
    await sleep(500); if (tk === run) { beep(1200, 120); go(authed ? "menu" : "login"); }
  }
  async function shut() {
    scr = "shut"; var tk = ++run; setBare();
    if (!(await typeLines(SHUT, 700, tk))) return;
    await sleep(900);
    if (!reduced) { crt.classList.add("crtoff"); beep(180, 700, "sawtooth"); await sleep(850); crt.classList.remove("crtoff"); }
    else { beep(180, 400, "sine"); await sleep(300); }
    scr = "off"; setBare(); draw();
  }
  async function crash() {
    scr = "crash"; crashReady = false; var tk = ++run; setBare(); fxAdd("shake");
    var ch = "▓▒░█#@%&$?!/\\01", frames = reduced ? 6 : 40, delay = reduced ? 260 : 60, dens = reduced ? 0.12 : 0.35;
    for (var i = 0; i < frames; i++) {
      var g = "";
      g = fullScreenNoise(ch, dens);
      $("main").innerHTML = '<div class="arg-full-glitch">' + P(esc(g)) + '</div>'; fxToggle("inv", i % 10 === 5);
      beep(80 + Math.random() * 900, 50, "sawtooth"); await sleep(delay);
    }
    crt.classList.remove("shake"); fxAdd("inv");
    $("main").innerHTML = P("\n *** ERREUR FATALE 0x14042025 ***\n\n CONTINUUM ESPACE-TEMPS : DETRUIT\n PARADOXE : 100%   CAUSALITE : 0%   STABILITE : ???\n\n" +
      " Vous avez appuyé sur NE PAS UTILISER.\n Un sushi a disparu quelque part dans le multivers.\n Nezuko attend toujours sa promenade.\n Stardew Valley n'a jamais existé.\n\n" +
      " TOUCHEZ L'ECRAN POUR REDEMARRER (SI LE TEMPS EXISTE ENCORE)<span class=\"cursor\">_</span>");
    crashReady = true;
  }
  var ARG_PARADOX = [
    "Le simulateur ouvre une brèche vers un souvenir que vous avez sauvé.",
    "DORY-0414 > Dora ? Regarde... je crois qu'elle nous lit encore.",
    "DORA-0414 > Je pensais que nos chemins ne se croiseraient plus. Le temps nous fait un clin d'œil.",
    "NULL-0414 > je suis là aussi. mais cette fois, je ne prends rien. ce souvenir est le mien.",
    "DORY-0414 > Alors reste avec nous un instant. Il y a de la place pour toi.",
    "DORA-0414 > Merci, Dory. Nous allons bien. Chacun a trouvé sa place.",
    "NULL-0414 > maintenant, quelqu'un m'attend. tu peux refermer la brèche.",
    "Les trois silhouettes vous saluent. Le signal s'éteint doucement.",
    "PARADOXE : vous recroisez ceux à qui vous aviez dit adieu. Leurs souvenirs sont toujours à l'abri."
  ];
  function paradoxCases() { return finalDate ? SC.concat([ARG_PARADOX]) : SC; }
  async function para() {
    var cases = paradoxCases();
    var tk = ++run, sc = cases[Math.random() * cases.length | 0]; prun = true; pl = []; pp = 0; draw();
    for (var i = 0; i < sc.length; i++) {
      await sleep(1100); if (tk !== run) return;
      pl.push(sc[i]); pp = Math.round((i + 1) / sc.length * 100); beep(300 + i * 150, 90); draw();
    }
    prun = false; beep(140, 400, "sawtooth"); draw();
  }

  // ---------- Clavier (le tactile passe par la meme fonction onKey) ----------
  function onKey(k) {
    if (argEntityReturned && !hauntSelf && HAUNT_OK.indexOf(scr) >= 0 && scr !== "pw" && !lb && Date.now() < hauntLock) return;
    onKeyReal(k);
  }
  function onKeyReal(k) {
    startMusic();   // le navigateur exige une action de l'utilisateur avant de jouer du son
    if (lb) {
      if (k === "Escape" || k === "Enter" || k === " ") closeLb();
      else if (k === "ArrowLeft") lbStep(-1);
      else if (k === "ArrowRight") lbStep(1);
      return;
    }
    idle = Date.now();
    if (scr === "ss") { go("menu"); return; }
    // Raccourcis S (sons) et M (musique), inactifs pendant la saisie d'un mot de passe
    if ((k === "s" || k === "S") && scr !== "pw" && scr !== "login" && scr !== "arg") { toggleSound(); if (scr === "menu" || scr === "opt") draw(); return; }
    if ((k === "m" || k === "M") && scr !== "pw" && scr !== "login" && scr !== "arg") { toggleMusic(); if (scr === "menu" || scr === "opt") draw(); return; }
    if (scr === "off") { beep(600, 80); boot(); return; }
    if (scr === "boot") { run++; go(authed ? "menu" : "login"); return; }
    if (scr === "crash") { if (crashReady) boot(); return; }
    if (scr === "shut") return;
    if (scr === "jump") { if (k === "Escape") { crt.classList.remove("shake", "inv"); beep(330, 60); go(jumpFrom); } return; }   // ECHAP annule le saut
    // Ecran d'arrivee : seul ECHAP retourne au menu des sauts. Toutes les autres touches sont ignorees.
    if (scr === "arrival") { if (k === "Escape") go("db"); return; }
    // Mot de passe d'acces au menu principal (insensible a la casse), memorise ensuite dans le navigateur
    if (scr === "login") {
      if (k === "Backspace") lgb = lgb.slice(0, -1);
      else if (k === "Enter") {
        if (lgb.toUpperCase() === LOGIN_PWD) { authed = true; store.set("mop_auth", "1"); beep(1000, 120); go("menu"); return; }
        st = "ACCES REFUSE. MOT DE PASSE INCORRECT."; lgb = ""; beep(140, 300, "sawtooth");
      } else if (/^[a-zA-Z]$/.test(k) && lgb.length < 20) { lgb += k; st = ""; beep(500, 30); }
      else return;
      draw(); return;
    }
    // Section ARG : terminal (ECHAP quitte, les commandes sont ignorees pendant les messages)
    if (scr === "arg") {
      if (k === "Escape") {
        if (argView === "logs" && argArch !== null) { argArch = null; draw(); return; }
        if (argView === "reconnect") return;
        if (argView === "confirm") { argView = null; argLog.push("CORRECTION ANNULEE."); draw(); return; }
        if (argView) { argView = null; draw(); return; }
        if (argChat) { argChat = false; argLog.push("[ CANAL FERME ]"); draw(); return; }
        if (argInputMode) { argInputMode = null; argInput = ""; draw(); return; }
        if (argEntityReturned) { argLog.push(entityId() + " > " + hRand(ESC_REFUS)); thump(); draw(); return; }
        argLog.push("Pour quitter cette interface utilisez la commande QUITTER."); draw(); return;
      }
      if (argBusy) return;
      if (argView === "reconnect") {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(k) >= 0) { reconnectSel = 1 - reconnectSel; draw(); }
        else if (k === "Enter" || k === " ") reconnectPress(reconnectSel);
        else if (k === "o" || k === "O") reconnectPress(0);
        else if (k === "n" || k === "N") reconnectPress(1);
        return;
      }
      if (argView === "creer") { if (k === "Enter" || k === " ") creerPress(); return; }
      if (argView === "confirm") {
        if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") argConfSel = 1 - argConfSel;
        else if (k === "o" || k === "O") argConfSel = 0;
        else if (k === "n" || k === "N") argConfSel = 1;
        if (k === "Enter" || k === "o" || k === "O") {
          if (argConfSel === 0) { argView = null; hauntCorrection(run); } else { argView = null; argLog.push("CORRECTION ANNULEE."); draw(); }
          return;
        }
        if (k === "n" || k === "N") { argView = null; argLog.push("CORRECTION ANNULEE."); draw(); return; }
        draw(); return;
      }
      if (argView === "logs") {
        if (argArch === null) {
          if (k === "ArrowDown") argArchSel = (argArchSel + 1) % ARG_ARCHIVES.length;
          else if (k === "ArrowUp") argArchSel = (argArchSel + ARG_ARCHIVES.length - 1) % ARG_ARCHIVES.length;
          else if (k === "Enter") { argArch = argArchSel; argLogSel = 0; }
          else return;
        } else {
          var n = ARG_ARCHIVES[argArch].logs.length;
          if (k === "ArrowDown") argLogSel = (argLogSel + 1) % n;
          else if (k === "ArrowUp") argLogSel = (argLogSel + n - 1) % n;
          else return;
        }
        draw(); return;
      }
      if (argView) return;
      if (argInputMode) {
        if (k === "Backspace") argInput = argInput.slice(0, -1);
        else if (k === "Enter") { argSubmitInput(); return; }
        else if (/^[a-zA-Z0-9 \/-]$/.test(k) && argInput.length < 28) { argInput += k; argSound(); }
        else return;
        draw(); return;
      }
      if (k === "Backspace") argIn = argIn.slice(0, -1);
      else if (k === "Enter") { var cmd = argIn; argIn = ""; argCmd(cmd); return; }
      else if ((argChat ? /^[^\x00-\x1f\x7f]$/.test(k) : /^[a-zA-Z0-9 \/-]$/.test(k)) && argIn.length < (argChat ? 70 : 28)) { argIn += k; argSound(); hauntSabotage(); }
      else return;
      draw(); return;
    }
    if (scr === "menu") {
      if (k === "ArrowDown") cur = (cur + 1) % IT.length;
      else if (k === "ArrowUp") cur = (cur + IT.length - 1) % IT.length;
      else if (k === "n" || k === "N") { go("care"); return; }
      else if (k === "o" || k === "O") { beep(880, 80); go("opt"); return; }
      else if (k === "t" || k === "T") { changeTheme(1); beep(1100, 100, "triangle"); draw(); return; }
      else if (/^[0-9]$/.test(k)) {
        var ix = IT.findIndex(function (x) { return x[0].charAt(0) === k; });
        if (ix < 0) return;
        cur = ix;
      }
      else if (k === "Enter") { beep(880, 80); var s = IT[cur][1]; if (s === "shut") shut(); else go(s); return; }
      else return;
      beep(440, 40); draw(); return;
    }
    if (k === "Escape") {
      if ((scr === "db" || scr === "nav") && sq) { sq = false; beep(330, 60); draw(); return; }
      beep(330, 60); go("menu"); return;
    }
    // Menu Options : sons, volumes, sons de Nezuko, musique, theme, particules, effets reduits
    if (scr === "opt") {
      if (argEntityReturned) return;
      if (k === "ArrowDown") { oi = (oi + 1) % OPT_N; beep(440, 30); }
      else if (k === "ArrowUp") { oi = (oi + OPT_N - 1) % OPT_N; beep(440, 30); }
      else if (k === "ArrowLeft") optAdj(oi, -1);
      else if (k === "ArrowRight") optAdj(oi, 1);
      else if ((k === "Enter" || k === " ") && [0, 2, 3, 4, 6, 7, 8].indexOf(oi) >= 0) optAdj(oi, 1);
      else if (k === "1" || k === "2" || k === "3") setTrack(+k - 1);
      else if (k === "4" && arg26()) setTrack(4);
      else if (k === "t" || k === "T") changeTheme(1);
      else return;
      draw(); return;
    }
    // Prompt "saut temporel maintenant ?" (Saut temporel et Navigation libre)
    if ((scr === "db" || scr === "nav") && sq) {
      var yes = null;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") { syes = !syes; beep(440, 30); draw(); return; }
      else if (k === "o" || k === "O") yes = true;
      else if (k === "n" || k === "N") yes = false;
      else if (k === "Enter") yes = syes;
      else return;
      sq = false;
      if (yes) { beep(880, 80); jumpFrom = scr; jump(); return; }
      beep(330, 60); draw(); return;
    }
    if (scr === "care") {
      if (cmode === "ball") {
        if (ball.done) { if (k === "Enter") { cmode = "menu"; ci = 0; } else return; }
        else if (k === "Enter" || k === " ") hitBall();
        else return;
        draw(); return;
      }
      var A = cacts();
      if (k === "ArrowDown") ci = (ci + 1) % A.length;
      else if (k === "ArrowUp") ci = (ci + A.length - 1) % A.length;
      else if (k === "Enter") { doAct(A[ci]); draw(); return; }
      else return;
      beep(440, 30); draw(); return;
    }
    if (scr === "nav") {
      if (k === "ArrowLeft") nf = (nf + 5) % 6;
      else if (k === "ArrowRight") nf = (nf + 1) % 6;
      else if (k === "ArrowUp") f[nf] = f[nf] + 1 > mx[nf] ? mn[nf] : f[nf] + 1;
      else if (k === "ArrowDown") f[nf] = f[nf] - 1 < mn[nf] ? mx[nf] : f[nf] - 1;
      else if (/^[0-9]$/.test(k)) { var v = (f[nf] * 10 + +k) % Math.pow(10, nf === 2 ? 4 : 2); f[nf] = v > mx[nf] ? +k : v; }
      else if (k === "r" || k === "R") { target = DEF; f = DEF.match(/\d+/g).map(Number); st = "DATE CIBLE REINITIALISEE"; beep(660, 100); }
      else if (k === "Enter") {
        var ok = f[2] >= 1000 && f[0] >= 1 && f[1] >= 1, dt = new Date(f[2], f[1] - 1, f[0]);
        if (ok && dt.getMonth() === f[1] - 1 && dt.getDate() === f[0]) {
          target = fv(0) + "/" + fv(1) + "/" + fv(2) + " - " + fv(3) + ":" + fv(4) + ":" + fv(5); st = "DATE CIBLE MISE A JOUR"; beep(1000, 120);
          sq = true; syes = true;
        } else { st = "DATE INVALIDE : LE CONTINUUM REFUSE"; beep(140, 250, "sawtooth"); }
      } else return;
      if (k !== "Enter" && k !== "r" && k !== "R") { st = ""; beep(440, 30); }
      draw(); return;
    }
    if (scr === "db") {
      if (k === "ArrowDown") dbi = (dbi + 1) % DB.length;
      else if (k === "ArrowUp") dbi = (dbi + DB.length - 1) % DB.length;
      else if (k === "Enter") { target = DB[dbi][0] + " - " + (DB[dbi][2] || "20:00:00"); st = "DATE CIBLE DEFINIE : " + target; sq = true; syes = true; beep(1000, 120); draw(); return; }
      else return;
      st = ""; beep(440, 40); draw(); return;
    }
    if (scr === "pw") {
      if (k === "Backspace") pwb = pwb.slice(0, -1);
      else if (k === "Enter") {
        if (pwb.toUpperCase() === "ARGUNDONE") { undoArgCompletion(); return; }
        if (pwb.toUpperCase() === "ARGDONE") { completeArgForTesting(); return; }
        if (pwb.toUpperCase() === "ADMIN") { beep(60, 400, "sawtooth"); if (finalDate) go("endscr"); else argEnter(); return; }
        if (pwb.toUpperCase() === "NEZUKO") { beep(1000, 120); crash(); return; }
        st = "ACCES REFUSE. MOT DE PASSE INCORRECT."; pwb = ""; beep(140, 300, "sawtooth");
      } else if (/^[a-zA-Z]$/.test(k) && pwb.length < 20) { pwb += k; st = ""; beep(500, 30); }
      else return;
      draw(); return;
    }
    if (scr === "para" && k === "Enter" && !prun) { beep(880, 80); para(); }
  }
  document.addEventListener("keydown", function (e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].indexOf(e.key) >= 0) e.preventDefault();
    onKey(e.key);
  });

  // ---------- Tactile : lignes cliquables, barre de touches, clavier a l'ecran ----------
  // Action d'une ligne touchee (voir "act" dans box())
  function tap(a) {
    idle = Date.now();
    var p = a.split(":"), t = p[0], v = p[1];
    if (t === "m" && scr === "menu") { cur = +v; onKey("Enter"); }
    else if (t === "d" && scr === "db" && !sq) { dbi = +v; onKey("Enter"); }
    else if (t === "o" && scr === "opt" && !argEntityReturned) {
      oi = +v;
      if (oi === 1 || oi === 5) optAdj(oi, (oi === 1 ? sfxVol : musVol) >= 100 ? -10 : 1);   // volume : +10 %, retour a 0 apres 100
      else optAdj(oi, 1);
      draw();
    }
    else if (t === "c" && scr === "care" && cmode === "menu") { ci = +v; onKey("Enter"); }
    else if (t === "q" && sq) { syes = v === "1"; onKey("Enter"); }
    else if (t === "f" && scr === "nav" && !sq) { nf = +v; beep(440, 30); draw(); }
    else if (t === "k") onKey(v);
  }
  var tapDown = null;
  function inUi(e) { return e.target && e.target.closest && (e.target.closest("#tbar") || e.target.closest("#lb")); }
  document.addEventListener("pointerdown", function (e) {
    if (inUi(e)) { tapDown = null; return; }
    var t = e.target && e.target.closest ? e.target.closest(".tap") : null;
    tapDown = { a: t ? t.getAttribute("data-a") : null, x: e.clientX, y: e.clientY };
  });
  document.addEventListener("pointercancel", function () { tapDown = null; });
  document.addEventListener("pointerup", function (e) {
    var d = tapDown; tapDown = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;   // ignore les glissements (defilement)
    startMusic();
    if (d.a) tap(d.a);
    else if (["off", "boot", "crash", "ss"].indexOf(scr) >= 0) onKey("Enter");   // toucher n'importe ou
  });
  // Deblocage du son sur mobile (iOS exige un clic / touchend)
  document.addEventListener("click", startMusic);
  document.addEventListener("touchend", startMusic);

  // Barre de touches en bas de l'ecran (telephone / tablette)
  var tbar = document.createElement("div"); tbar.id = "tbar"; document.body.appendChild(tbar);
  var barSig = "", repT = null, repI = null;
  var KEYMAP = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", ok: "Enter", esc: "Escape", nez: "n", reset: "r", del: "Backspace", space: " " };
  var LABEL = { up: "▲", down: "▼", left: "◀", right: "▶", ok: "OK", esc: "RETOUR", nez: "NEZUKO", reset: "RAZ", del: "SUPPR", space: "ESPACE" };
  function barRows() {
    if (!touchUI || lb) return [];
    if (["off", "boot", "shut", "crash", "ss"].indexOf(scr) >= 0) return [];
    if (scr === "login") return ["azertyuiop".split(""), "qsdfghjklm".split(""), "wxcvbn".split("").concat(["del"]), ["ok"]];
    if (scr === "pw") return ["azertyuiop".split(""), "qsdfghjklm".split(""), "wxcvbn".split("").concat(["del"]), ["esc", "ok"]];
    if (scr === "arg") {
      if (argView === "logs") return [["up", "down", "ok", "esc"]];
      if (argView === "reconnect") return [["left", "right", "ok"]];
      if (argView === "creer") return [["ok", "esc"]];
      if (argView === "confirm") return [["left", "right", "ok", "esc"]];
      if (argView) return [["esc"]];
      var rowsA = ["1234567890".split(""), "azertyuiop".split(""), "qsdfghjklm".split(""), "wxcvbn".split("").concat(["-", "space", "del"])];
      if (argChat) rowsA.push([".", ",", "?", "!", "'", "é", "è", "à"]);
      rowsA.push(["esc", "ok"]); return rowsA;
    }
    if (scr === "menu") return [["up", "down", "ok", "nez"]];
    if (scr === "opt") return [["up", "down", "left", "right"], ["esc"]];
    if (scr === "nav") return sq ? [["left", "right", "ok", "esc"]] : ["1234567890".split(""), ["left", "right", "up", "down"], ["ok", "reset", "esc"]];
    if (scr === "db") return sq ? [["left", "right", "ok", "esc"]] : [["up", "down", "ok", "esc"]];
    if (scr === "care") return cmode === "ball" ? [["ok", "esc"]] : [["up", "down", "ok", "esc"]];
    if (scr === "para") return [["ok", "esc"]];
    return [["esc"]];
  }
  function btnLabel(id) {
    if (id === "esc" && scr === "jump") return "ANNULER";
    if (id === "ok" && ((scr === "care" && cmode === "ball" && !ball.done) || scr === "para")) return "LANCER";
    return LABEL[id] || id.toUpperCase();
  }
  function renderBar() {
    var rows = barRows(), sig = rows.map(function (r) { return r.join(","); }).join("/") + (scr === "care" && cmode === "ball" && !ball.done ? "|b" : "") + (scr === "para" ? "|p" : "");
    if (sig === barSig) return;
    barSig = sig;
    tbar.textContent = "";
    if (!rows.length) { tbar.style.display = "none"; crt.style.paddingBottom = ""; return; }
    rows.forEach(function (r) {
      var row = document.createElement("div"); row.className = "row";
      r.forEach(function (id) {
        var b = document.createElement("button"); b.type = "button";
        b.className = "tb" + (id.length === 1 ? " k" : "") + (id === "ok" || id === "esc" || id === "nez" || id === "space" ? " wide" : "");
        b.setAttribute("data-id", id); b.textContent = btnLabel(id);
        row.appendChild(b);
      });
      tbar.appendChild(row);
    });
    tbar.style.display = "block";
    crt.style.paddingBottom = (tbar.offsetHeight + 16) + "px";
  }
  function stopRep() { clearTimeout(repT); clearInterval(repI); repT = repI = null; }
  tbar.addEventListener("pointerdown", function (e) {
    var b = e.target.closest ? e.target.closest(".tb") : null; if (!b) return;
    e.preventDefault();
    var id = b.getAttribute("data-id"), key = KEYMAP[id] || id;
    onKey(key);
    if (id === "up" || id === "down" || id === "left" || id === "right") {   // appui long = repetition
      stopRep();
      repT = setTimeout(function () { repI = setInterval(function () { onKey(key); }, 110); }, 420);
    }
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { tbar.addEventListener(ev, stopRep); });
  document.addEventListener("pointerup", stopRep);
  tbar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // ---------- Extras ----------
  // Ecran d'arrivee : uniquement le titre ASCII "D.O.R.Y PROJECT"
  var FONT = {
    "D": ["###  ", "#  # ", "#  # ", "#  # ", "###  "], "O": [" ##  ", "#  # ", "#  # ", "#  # ", " ##  "],
    "R": ["###  ", "#  # ", "###  ", "# #  ", "#  # "], "Y": ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
    "P": ["###  ", "#  # ", "###  ", "#    ", "#    "], "J": ["  ## ", "   # ", "   # ", "#  # ", " ##  "],
    "E": ["#### ", "#    ", "###  ", "#    ", "#### "], "C": [" ### ", "#    ", "#    ", "#    ", " ### "],
    "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  "], ".": ["  ", "  ", "  ", "  ", "# "]
  };
  function big(s) {
    var rows = ["", "", "", "", ""];
    s.split("").forEach(function (c) { for (var i = 0; i < 5; i++) rows[i] += FONT[c][i] + " "; });
    return rows.join("\n");
  }
  var TITLE = big("D.O.R.Y") + "\n\n" + big("PROJECT") + "\n";
  var BDAY_MSG = "Joyeux 33 ans Dory, tu es la meilleure des rencontres que j'ai pu faire, merci pour tout !";
  var NOTES = [262, 262, 294, 262, 349, 330, 262, 262, 294, 262, 392, 349];
  var idle = Date.now(), pwb = "";
  function pwBox() {
    return box("ACCES RESTREINT", [{ t: "" }, { t: "COMMANDE INTERDITE. AUTHENTIFICATION REQUISE." }, { t: "" }, { t: "MOT DE PASSE : " + "*".repeat(pwb.length) + "_" }, { t: "" },
      { t: "indice : j'ai quatre pattes et je ressemble à un boudin de porte" }, { t: "" }, { t: "> " + (st || "ENTREE : VALIDER    ECHAP : RETOUR") }], W);
  }

  // ---------- Nezuko : encart + entretien ----------
  // Chaque minute, chaque jauge baisse independamment d'un entier aleatoire entre 1 et 5 (a l'arret si Nezuko dort)
  function drop() { return 1 + (Math.random() * 5 | 0); }
  // Sauvegarde : etat memorise dans le navigateur, avec rattrapage limite pendant l'absence
  var AWAY_MAX_MIN = 15, AWAY_FLOOR = 10;
  function loadNZ() {
    var s = null;
    try { s = JSON.parse(store.get("mop_nz")); } catch (e) {}
    if (!s || typeof s.h !== "number" || typeof s.j !== "number" || typeof s.c !== "number") {
      var r = function () { return 30 + (Math.random() * 61 | 0); };   // premiere visite : 30 a 90 %
      return { h: r(), j: r(), c: r(), sl: false };
    }
    var n = { h: cl(Math.round(s.h)), j: cl(Math.round(s.j)), c: cl(Math.round(s.c)), sl: !!s.sl };
    if (!n.sl && typeof s.t === "number") {
      var mins = Math.max(0, Math.min(AWAY_MAX_MIN, Math.floor((Date.now() - s.t) / 60000)));
      var away = function (v) { var x = v; for (var i = 0; i < mins; i++) x -= drop(); return Math.max(Math.min(v, AWAY_FLOOR), cl(x)); };
      n.h = away(n.h); n.j = away(n.j); n.c = away(n.c);
    }
    return n;
  }
  var NZ = loadNZ();
  function saveNZ() { store.set("mop_nz", JSON.stringify({ h: NZ.h, j: NZ.j, c: NZ.c, sl: NZ.sl, t: Date.now() })); }
  saveNZ();
  window.addEventListener("beforeunload", saveNZ);
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveNZ(); });

  // ---------- Voix de Nezuko (petits bruits de Spitz nain, synthetises) ----------
  var VOICE_TXT = { yip: "Wouaf !", yipyip: "Yip yip !", wuf: "Wouf !", growl: "Grrr...", whine: "Ouiiin...", snore: "zZz...", sigh: "*soupir*" };
  var sayTxt = "", sayUntil = 0;
  function dogSnd(kind) {
    if (muted || sfxVol <= 0 || !nzSound) return;
    try {
      var c = getAC(), t = c.currentTime + 0.02, v = sfxVol / 100;
      var env = function (g, peak, a, d, t0) {
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * v), t0 + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
      };
      // Jappement aigu : dent de scie qui chute en hauteur, filtre nasal
      var yip = function (t0, f0, d) {
        var o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t0 + d);
        bp.type = "bandpass"; bp.frequency.value = 2100; bp.Q.value = 1.4;
        env(g, 0.09, 0.008, d, t0);
        o.connect(bp); bp.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + 0.05);
      };
      // Petit grognement : grave, module en amplitude (roulement), adouci par un filtre
      var growl = function (t0, dur, f) {
        var o = c.createOscillator(), lp = c.createBiquadFilter(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), e = c.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(f * 1.15, t0 + dur * 0.5); o.frequency.linearRampToValueAtTime(f * 0.9, t0 + dur);
        lp.type = "lowpass"; lp.frequency.value = 650; lp.Q.value = 4;
        am.gain.value = 0.55; lfo.frequency.value = 24; lg.gain.value = 0.45; lfo.connect(lg); lg.connect(am.gain);
        env(e, 0.13, dur * 0.3, dur * 0.7, t0);
        o.connect(lp); lp.connect(am); am.connect(e); e.connect(c.destination);
        o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
      };
      // Gemissement : sinus qui monte puis redescend, avec vibrato
      var whine = function (t0, dur) {
        var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(650, t0); o.frequency.linearRampToValueAtTime(980, t0 + dur * 0.55); o.frequency.linearRampToValueAtTime(760, t0 + dur);
        lfo.frequency.value = 7; lg.gain.value = 22; lfo.connect(lg); lg.connect(o.frequency);
        env(g, 0.06, dur * 0.25, dur * 0.75, t0);
        o.connect(g); g.connect(c.destination); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
      };
      // Ronflement / soupir : basses douces
      var soft = function (t0, f1, f2, dur, peak) {
        var o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
        o.type = "triangle"; o.frequency.setValueAtTime(f1, t0); o.frequency.linearRampToValueAtTime(f2, t0 + dur);
        lp.type = "lowpass"; lp.frequency.value = 500;
        env(g, peak, dur * 0.4, dur * 0.6, t0);
        o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.1);
      };
      var j = function (a, b) { return a + Math.random() * (b - a); };
      if (kind === "yip") yip(t, j(1000, 1350), j(0.09, 0.13));
      else if (kind === "yipyip") { yip(t, j(1050, 1350), 0.1); yip(t + 0.17, j(900, 1150), 0.11); }
      else if (kind === "wuf") yip(t, j(620, 760), 0.16);
      else if (kind === "growl") growl(t, j(0.5, 0.8), j(95, 130));
      else if (kind === "whine") whine(t, j(0.45, 0.7));
      else if (kind === "snore") soft(t, 75, 60, 0.9, 0.09);
      else if (kind === "sigh") soft(t, 520, 300, 0.7, 0.05);
    } catch (e) {}
  }
  function nezVoice(kind) {
    sayTxt = VOICE_TXT[kind] || ""; sayUntil = Date.now() + 1600;
    dogSnd(kind);
  }
  // Petits bruits spontanes : sur l'ecran d'entretien ET sur le menu principal (encart NEZUKO.EXE)
  (function ambientNoise() {
    setTimeout(function () {
      if ((scr === "care" && cmode === "menu") || scr === "menu") {
        var r = Math.random();
        if (NZ.sl) { if (r < 0.6) nezVoice("snore"); }
        else if (NZ.h < 20 || NZ.j < 20 || NZ.c < 20) nezVoice(r < 0.5 ? "whine" : r < 0.75 ? "yip" : "growl");
        else nezVoice(r < 0.3 ? "yipyip" : r < 0.55 ? "yip" : r < 0.75 ? "growl" : r < 0.9 ? "wuf" : "whine");
      }
      ambientNoise();
    }, 5000 + Math.random() * 7000);
  })();

  var cmode = "menu", ci = 0, cmsg = "", cfx = 0;
  var ball = { p: 0, d: 1, n: 0, pts: 0, last: "", done: false };
  var BALLS = 8, TR = 31, ZC = 15;
  // Statuts (38 caracteres maximum pour tenir dans l'encart du menu)
  var nz = 0, nd = 1, nph = 0, NPH = [
    "Promenade de Nezuko en cours", "Nezuko renifle un sushi", "Nezuko demande une barbe à papa", "Nezuko a trouvé un câble rose",
    "Nezuko surveille la machine", "Nezuko court après sa queue", "Nezuko joue avec un noeud rose", "Nezuko vole une chaussette rose",
    "Nezuko creuse pour les Junimos", "Nezuko rêve de barbe à papa", "Nezuko poursuit un maki qui roule", "Nezuko mordille Hello Kitty",
    "Nezuko vole un sushi (saumon)", "Nezuko a piqué la manette", "Nezuko cherche un panais à Stardew", "Nezuko fait des bêtises. Encore.",
    "Nezuko a enterré un sushi", "Nezuko fait la sieste sur le canapé", "Nezuko se roule dans le rose", "Nezuko aboie sur un Junimo",
    "Nezuko attend une gaufre rose", "Nezuko fait les yeux doux", "Nezuko mâchouille un câble (non !)", "Nezuko rapporte un bâton rose",
    "Nezuko fait la belle pour un sushi", "Nezuko tourne en rond, très sérieuse", "Nezuko renverse la soupe en cuisine", "Nezuko se cache sous le canapé",
    "Nezuko secoue une peluche rose", "Nezuko boude : elle veut sa promenade"];
  var SLP = ["Nezuko dort. zZz", "Nezuko rêve de sushis... zZz", "Nezuko ronfle doucement. zZz"];
  function nezStep() { if (NZ.sl) return; nz += nd; if (nz >= 32 || nz <= 0) nd = -nd; }
  // Position du sprite : nz (0-32) ramene a la largeur reellement disponible dans le cadre
  function nzPos(inner, reserve) { return Math.floor(nz * Math.max(0, inner - reserve) / 32); }
  function nezPhrase() {
    if (NZ.sl) return SLP[nph % SLP.length];
    if (NZ.h < 20) return "Nezuko a faim !";
    if (NZ.j < 20) return "Nezuko s'ennuie...";
    if (NZ.c < 20) return "Nezuko est toute sale.";
    return NPH[nph % NPH.length];
  }
  // Sprite unique de Nezuko, partage par le menu et l'entretien
  function dogSprite() {
    var e = NZ.sl ? "-.-" : (Date.now() - cfx < 2000 ? "^.^" : "o.o");
    return nd > 0 ? "~^(" + e + ")^" : "^(" + e + ")^~";
  }
  function nzBars(w) {
    return [["FAIM", NZ.h], ["JOIE", NZ.j], ["PROPRETE", NZ.c]].map(function (m) {
      return { t: (m[0] + " :").padEnd(11) + "[" + bar(m[1], w) + "] " + String(m[1]).padStart(3) + "%" };
    });
  }
  function nezBox() {
    // Pendant qu'elle "parle", son cri (Wouaf !, Grrr...) remplace un instant le statut
    var status = Date.now() < sayUntil && sayTxt ? sayTxt : nezPhrase();
    var inner = Math.min(42, W);
    var L = [{ t: "" }, { t: " ".repeat(nzPos(inner, 10)) + dogSprite(), act: "k:n" }, { t: "" }, { t: "> " + status, sel: true, act: "k:n" }, { t: "" }]
      .concat(nzBars(20), [{ t: "" }, { t: "N : S'EN OCCUPER", act: "k:n" }]);
    return box("NEZUKO.EXE", L, 42);
  }
  function cacts() {
    return NZ.sl ? ["Réveiller Nezuko"] :
      ["Nourrir Nezuko", "Lancer la balle à Nezuko", "Caresser Nezuko", "Brosser Nezuko", "Endormir Nezuko"];
  }
  function doAct(a) {
    cfx = Date.now();
    if (a === "Nourrir Nezuko") { NZ.h = cl(NZ.h + 25); cmsg = NZ.h >= 100 ? "Nezuko est rassasiée. Elle prend un sushi quand même." : "Nezuko dévore ses croquettes. Miam !"; beep(700, 80); nezVoice("yipyip"); }
    else if (a === "Caresser Nezuko") { NZ.j = cl(NZ.j + 12); cmsg = "Nezuko ferme les yeux et en redemande."; beep(900, 80, "triangle"); nezVoice(Math.random() < 0.5 ? "whine" : "growl"); }
    else if (a === "Brosser Nezuko") { NZ.c = cl(NZ.c + 25); cmsg = "Nezuko est toute douce et bien coiffée."; beep(600, 80, "triangle"); nezVoice("sigh"); }
    else if (a === "Endormir Nezuko") { NZ.sl = true; ci = 0; cmsg = "Nezuko s'endort. Ses jauges ne baissent plus."; beep(300, 300, "triangle"); nezVoice("sigh"); }
    else if (a === "Réveiller Nezuko") { NZ.sl = false; ci = 0; cmsg = "Nezuko se réveille en s'étirant."; beep(800, 120, "triangle"); nezVoice("yip"); }
    else if (a === "Lancer la balle à Nezuko") {
      cmode = "ball"; ball = { p: 0, d: 1, n: 0, pts: 0, last: "", done: false }; beep(880, 80); nezVoice("yipyip");
    }
    saveNZ();
  }
  function hitBall() {
    var dist = Math.abs(ball.p - ZC), g;
    if (dist <= 1) { g = 10; ball.last = "PARFAIT ! +10"; beep(1200, 80, "triangle"); nezVoice("yip"); }
    else if (dist <= 4) { g = 5; ball.last = "BIEN ! +5"; beep(900, 80, "triangle"); }
    else { g = 0; ball.last = "RATE... +0"; beep(140, 150, "sawtooth"); }
    ball.pts += g; ball.n++; ball.p = Math.random() * TR | 0;
    if (ball.n >= BALLS) {
      ball.done = true;
      var gain = Math.round(ball.pts / 2);
      NZ.j = cl(NZ.j + gain); cfx = Date.now();
      cmsg = "Partie terminée : joie +" + gain + ".";
      nezVoice("yipyip");
      saveNZ();
    }
  }
  function careBox() {
    var say = Date.now() < sayUntil ? "  " + sayTxt : "";
    var L = [{ t: "" }, { t: "  " + " ".repeat(nzPos(W, 30)) + dogSprite() + (NZ.sl ? "  zZz" : "") + say }, { t: "" },
      { t: "> " + nezPhrase(), sel: true }, { t: "" }];
    nzBars(Math.max(10, Math.min(30, W - 19))).forEach(function (b) { L.push(b); });
    L.push({ t: "" }, { t: "ETAT : " + (NZ.sl ? "ENDORMIE (les jauges ne baissent pas)" : "EVEILLEE") }, { t: "" });
    cacts().forEach(function (a, i) { L.push({ t: (i === ci ? "> " : "  ") + a, sel: i === ci, act: "c:" + i }); });
    L.push({ t: "" }, (cmsg && /^(NULL-0414|DORY-0414 >|DORA-0414 >)/.test(cmsg)) ? { t: "> ..." } : { t: cmsg ? "> " + cmsg : "> EN ATTENTE D'UN ORDRE_" }, { t: "HAUT/BAS : CHOISIR   ENTREE : VALIDER   ECHAP : RETOUR" });
    return box("ENTRETIEN DE NEZUKO", L, W);
  }
  function ballBox() {
    var tr = "";
    for (var i = 0; i < TR; i++) tr += (i === ball.p && !ball.done) ? "O" : (Math.abs(i - ZC) <= 1 ? "#" : Math.abs(i - ZC) <= 4 ? "=" : "-");
    var L = [{ t: "" }, { t: "LANCER DE BALLE : " + Math.min(ball.n + (ball.done ? 0 : 1), BALLS) + " / " + BALLS + "     SCORE : " + ball.pts }, { t: "" },
      { t: "       [" + tr + "]", act: "k:Enter" }, { t: "        " + " ".repeat(ZC - 1) + "^^^", act: "k:Enter" }, { t: "" },
      { t: ball.done ? "TERMINE ! " + cmsg : "ENTREE, ESPACE OU TOUCHER LA PISTE : lancer quand la balle (O) est sur la zone (#)" },
      { t: "> " + (ball.last || "PRET ?") }, { t: "" },
      { t: ball.done ? "ENTREE : RETOUR A L'ENTRETIEN" : "ECHAP : ABANDONNER (aucun gain)" }];
    return box("LANCER LA BALLE A NEZUKO", L, W);
  }
  setInterval(function () {
    if (NZ.sl) return;
    NZ.h = cl(NZ.h - drop()); NZ.j = cl(NZ.j - drop()); NZ.c = cl(NZ.c - drop());
    saveNZ();
    if (scr === "care" && cmode === "menu") draw();
  }, 60000);
  // Nouveau statut aleatoire toutes les 6 secondes
  setInterval(function () { nph = (nph + 1 + (Math.random() * (NPH.length - 1) | 0)) % NPH.length; }, 6000);
  setInterval(function () {
    if (scr !== "care") return;
    if (cmode === "ball" && !ball.done) {
      var step = ball.n >= 5 ? 3 : ball.n >= 2 ? 2 : 1;
      ball.p += ball.d * step;
      if (ball.p >= TR - 1) { ball.p = TR - 1; ball.d = -1; }
      else if (ball.p <= 0) { ball.p = 0; ball.d = 1; }
      draw();
    } else if (cmode === "menu") draw();
  }, 90);

  // Ecran de veille
  var sx = 2, sy = 1, sdx = 1, sdy = 1, si = 0;
  var SS_MUSIC_INTERVAL = 5 * 60 * 1000, ssMusicNext = 0, ssMusicPrevious = null;
  function startSleepMusic() {
    ssMusicPrevious = mus.track;
    ssMusicNext = Date.now() + SS_MUSIC_INTERVAL;
  }
  function updateSleepMusic() {
    if (scr !== "ss" || document.hidden || Date.now() < ssMusicNext) return;
    ssMusicNext = Date.now() + SS_MUSIC_INTERVAL;
    if (!mus.on || !mus.ready || musVol <= 0) return;
    var available = (arg26() ? [0, 1, 2, 4] : [0, 1, 2]).filter(function (track) { return track !== mus.track; });
    if (!available.length) return;
    mus.track = available[Math.floor(Math.random() * available.length)];
    startTrack();
  }
  function stopSleepMusic() {
    var previous = ssMusicPrevious;
    ssMusicPrevious = null; ssMusicNext = 0;
    if (previous !== null && mus.track !== previous) {
      mus.track = previous;
      if (mus.ready) startTrack();
    }
  }
  var SSM = [["NEZUKO DEMANDE", "SA PROMENADE"], ["ENVIE DE SUSHIS", "DETECTEE"], ["BARBE A PAPA", "REQUISE (ROSE)"], ["HELLO KITTY", "VOUS SURVEILLE"], ["LES JUNIMOS", "SONT EN GREVE"]];
  setInterval(function () {
    if (scr === "menu" && !argEntityReturned && Date.now() - idle > 45000) { scr = "ss"; startSleepMusic(); setBare(); }
    if (scr !== "ss") return;
    updateSleepMusic();
    var maxx = Math.max(2, Math.min(42, W - 32));
    sx += sdx * 2; sy += sdy; var b = false;
    if (sx <= 0 || sx >= maxx) { sdx = -sdx; b = true; sx = Math.max(0, Math.min(maxx, sx)); }
    if (sy <= 0 || sy >= 14) { sdy = -sdy; b = true; sy = Math.max(0, Math.min(14, sy)); }
    if (b) { si = (si + 1) % SSM.length; }
    var lines = box("VEILLE", [{ t: "" }, { t: SSM[si][0] }, { t: SSM[si][1] }, { t: "" }], 28).split("\n").map(function (l) { return " ".repeat(sx) + l; });
    $("main").innerHTML = P("\n".repeat(sy) + lines.join("\n"));
  }, 300);
  // Saut temporel
  async function jump() {
    scr = "jump"; sq = false; var tk = ++run; setBare();
    var d = target.slice(0, 10), dp = d.split("/"), dt = new Date(+dp[2], +dp[1] - 1, +dp[0]), now = new Date(); now.setHours(0, 0, 0, 0);
    if (!(await typeLines(["INITIALISATION DU SAUT TEMPOREL", "DESTINATION : " + target, "CHARGEMENT DU CONDENSATEUR DE FLUX ... OK", "", "ECHAP : ANNULER LE SAUT"], 450, tk))) return;
    // Compte a rebours : 3 secondes
    for (var i = 3; i >= 1; i--) {
      if (tk !== run) return;
      $("main").innerHTML = P("\n\n\n          SAUT DANS " + i + "...\n\n          [" + bar((4 - i) / 3 * 100, 20) + "]\n\n          ECHAP : ANNULER LE SAUT");
      fxAdd("shake"); beep(200 + (4 - i) * 200, 300); await sleep(1000);
    }
    crt.classList.remove("shake");
    if (!reduced) {
      for (var j = 0; j < 6; j++) { if (tk !== run) return; crt.classList.toggle("inv", j % 2 === 0); beep(1500 - j * 150, 60, "sawtooth"); await sleep(160); }
      crt.classList.remove("inv");
    } else { beep(1200, 150, "sine"); await sleep(400); }
    if (tk !== run) return;
    var ev = DB.filter(function (x) { return x[0] === d; })[0];
    if (d === "19/09/2026") { await birthday(tk); return; }
    var L = [{ t: "" }, { t: "ARRIVEE : " + target }, { t: "SAUT REUSSI. STABILITE : " + (60 + Math.random() * 39 | 0) + "%" }, { t: "" }];
    wrap(ev ? "EVENEMENT DETECTE : " + ev[1] : dt > now ? "DESTINATION DANS LE FUTUR : aucun sushi n'y est encore prêt." : "AUCUN EVENEMENT CLE A CETTE DATE. Le continuum est calme. Nezuko dort.", W - 4)
      .forEach(function (x) { L.push({ t: x }); });
    if (ev && MSG[d]) {
      L.push({ t: "" });
      var sections = MSG[d].split("Dora, le vrai :");
      wrap("MESSAGE : " + sections[0], W - 4).forEach(function (x) { L.push({ t: x, h: alteredDates.indexOf(d) >= 0 ? redH(x) : undefined }); });
      if (sections.length > 1) wrap("Dora, le vrai :" + sections.slice(1).join("Dora, le vrai :"), W - 4).forEach(function (x) { L.push({ t: x, h: '<span class="developer-white">' + esc(x) + "</span>" }); });
    }
    L.push({ t: "" }, { t: "ECHAP : RETOUR AU MENU DES SAUTS" });
    arrival = { html: P(box("ARRIVEE", L, W)) + (ev ? photosBlock(d) + extraBlock(d) : ""), d: ev ? d : null };
    if (finalDate && arrival.d === finalDate) arrival.html = finalGreen(arrival.html);
    scr = "arrival"; setBare(); $("main").innerHTML = arrival.html; beep(1000, 200);
    if (ev) showPhotos(d, tk);
  }
  async function birthday(tk) {
    var rows = [], ch = "*+.o~'^";
    for (var i = 0; i < 72; i++) {
      if (tk !== run) return;
      var r = ""; for (var c = 0; c < W + 2; c++) r += Math.random() < 0.06 ? ch.charAt(Math.random() * ch.length | 0) : " ";
      rows.unshift(r); if (rows.length > 20) rows.pop();
      $("main").innerHTML = P(esc(rows.join("\n")));
      if (i % 6 === 0) { if (alteredDates.indexOf("19/09/2026") >= 0) anxNote(i / 6); else beep(NOTES[i / 6], 180, "triangle"); }
      await sleep(90);
    }
    if (tk !== run) return;
    var L = [{ t: "" }, { t: "*** JOYEUX ANNIVERSAIRE DORY ! ***" }, { t: target.indexOf("23:19") > -1 ? "23:19 : L'HEURE EXACTE !" : "" }, { t: "" }];
    wrap(BDAY_MSG, W - 4).forEach(function (x) { L.push({ t: x, h: alteredDates.indexOf("19/09/2026") >= 0 ? redH(x) : undefined }); });
    L.push({ t: "" }, { t: "ECHAP : RETOUR AU MENU DES SAUTS" });
    arrival = { html: P(esc(rows.slice(0, 3).join("\n")) + "\n" + box("ANNIVERSAIRE DE DORY", L, W)) + photosBlock("19/09/2026"), d: "19/09/2026" };
    if (finalDate && arrival.d === finalDate) arrival.html = finalGreen(arrival.html);
    scr = "arrival"; setBare(); $("main").innerHTML = arrival.html;
    showPhotos("19/09/2026", tk);
  }

  // ---------- Timers ----------
  function randomize() { metrics.forEach(function (m) { m[1] = Math.floor(Math.random() * 101); }); if (scr === "menu") draw(); }
  setInterval(randomize, 5000);
  setInterval(function () { if (scr === "menu") { nezStep(); draw(); } else if (scr === "care") nezStep(); }, 1000);
  setInterval(function () { if (scr === "logs") { addLog(); draw(); } }, 900);
  // ARG : rafraichissement (curseur, corruption) ; statut inquietant et glitch d'ecran occasionnels
  setInterval(function () {
    if (scr !== "arg" || argFrame) return;
    argTick++;
    if (!reduced || argTick % 7 === 0) draw();
  }, 150);
  setInterval(function () {
    if (scr !== "arg") return;
    if (Math.random() < 0.25) argStat = Math.random() * ARG_STATUS.length | 0;
    if (!(argView === "logs" && argArch !== null) && !reduced && Math.random() < 0.04) { crt.classList.add("glitchfx"); setTimeout(function () { crt.classList.remove("glitchfx"); }, 330); }
  }, 1000);

  // ---------- Presences avant le rappel : evenements discrets, sans aucun texte ----------
  var GHOST_OK = ["menu", "nav", "logs", "db", "para", "proto", "stats", "mini", "care", "opt", "pw"];
  var HAUNT_OK = GHOST_OK.concat(["arg"]);
  function thump() { beep(50, 300, "sine"); }
  function heartbeat() { thump(); setTimeout(function () { beep(50, 380, "sine"); }, 320); }
  function flashInv(ms) { crt.classList.remove("inv"); }
  function glitchNow() { if (reduced) return; crt.classList.add("glitchfx"); setTimeout(function () { crt.classList.remove("glitchfx"); }, 330); }
  var GHOST_FX = [
    function () { var t = document.title; document.title = "NULL-0414"; setTimeout(function () { document.title = t; }, 3500); },
    function () { glitchNow(); beep(48, 300, "sawtooth"); },
    function () { thump(); },
    function () { thump(); },
    function () { heartbeat(); }
  ];
  function ghostLoop() {
    setTimeout(function () {
      if (!argEntityReturned && GHOST_OK.indexOf(scr) >= 0 && !document.hidden) { try { GHOST_FX[Math.random() * GHOST_FX.length | 0](); } catch (e) {} }
      ghostLoop();
    }, 35000 + Math.random() * 70000);
  }
  ghostLoop();

  var ANX_SHIFT = [0, 1, -1, 6, -2, 3, -4, 7, 1, -6, 0, 5];
  function anxNote(k) {
    k = Math.round(k);
    if (muted || sfxVol <= 0) return;
    try {
      var c = getAC(), t = c.currentTime, f = NOTES[k % NOTES.length] * 0.5 * Math.pow(2, ANX_SHIFT[k % ANX_SHIFT.length] / 12), v = sfxVol / 100;
      var o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
      o.type = "sawtooth"; o2.type = "square"; o.frequency.setValueAtTime(f * 1.03, t); o.frequency.linearRampToValueAtTime(f * 0.9, t + 0.7); o2.frequency.setValueAtTime(f * 1.5 * 1.06, t); o2.frequency.linearRampToValueAtTime(f * 1.38, t + 0.7);
      lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(260, t + 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.04); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.35); g.gain.linearRampToValueAtTime(0.0001, t + 0.75);
      var tr = c.createOscillator(), tg = c.createGain(); tr.frequency.value = 9; tg.gain.value = 0.03 * v; tr.connect(tg); tg.connect(g.gain);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(c.destination);
      o.start(t); o2.start(t); tr.start(t); o.stop(t + 0.8); o2.stop(t + 0.8); tr.stop(t + 0.8);
    } catch (e) {}
  }

  var contamState = 0;
  function contamSound() {
    if (muted || sfxVol <= 0) return;
    try {
      var c = getAC(), t = c.currentTime + 0.05, v = sfxVol / 100;
      var ns = c.createBufferSource(); ns.buffer = noiseBuffer(); ns.loop = true;
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2; bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 7.5);
      var g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * v, t + 6.5); g.gain.linearRampToValueAtTime(0.0001, t + 8.2);
      ns.connect(bp); bp.connect(g); g.connect(c.destination); ns.start(t); ns.stop(t + 8.3);
      var o = c.createOscillator(), og = c.createGain(), lp = c.createBiquadFilter(); o.type = "sawtooth"; o.frequency.setValueAtTime(36, t); o.frequency.linearRampToValueAtTime(52, t + 7.5);
      lp.type = "lowpass"; lp.frequency.value = 160; og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.5 * v, t + 6.8); og.gain.linearRampToValueAtTime(0.0001, t + 8.2);
      o.connect(lp); lp.connect(og); og.connect(c.destination); o.start(t); o.stop(t + 8.3);
    } catch (e) {}
  }
  function contaminate() {
    if (contamState) return; contamState = 1;
    var root = document.documentElement; root.classList.add("arg"); root.classList.remove("nullt");
    contamSound();
    var W2 = Math.ceil(window.innerWidth / 2), H2 = Math.ceil(window.innerHeight / 2), cv = document.createElement("canvas");
    cv.width = W2; cv.height = H2;
    cv.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;z-index:60;pointer-events:none;mix-blend-mode:color;opacity:1;transition:opacity 1.8s";
    document.body.appendChild(cv);
    var g = cv.getContext("2d"), dur = reduced ? 2500 : 8000, t0 = performance.now(), tend = [], gi = 0, GT = [0.3, 0.55, 0.8];
    g.fillStyle = "rgb(255,28,28)";
    var seeds = [[0, Math.random() * H2], [W2, Math.random() * H2], [Math.random() * W2, 0], [Math.random() * W2, H2], [W2 * 0.5, H2 * 0.95]];
    function spawn(sd) { for (var j = 0; j < 3; j++) tend.push({ x: sd[0], y: sd[1], a: Math.atan2(H2 / 2 - sd[1], W2 / 2 - sd[0]) + (Math.random() - 0.5) * 1.4, s: 1.5 + Math.random() * 2.5 }); }
    seeds.forEach(spawn);
    function circle(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
    function done() {
      g.fillRect(0, 0, W2, H2); root.classList.add("nullt"); contamState = 2;
      setTimeout(function () { cv.style.opacity = "0"; }, 150); setTimeout(function () { if (cv.parentNode) cv.parentNode.removeChild(cv); }, 2200);
    }
    function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      for (var i = tend.length - 1; i >= 0; i--) {
        var q = tend[i]; q.x += Math.cos(q.a) * q.s; q.y += Math.sin(q.a) * q.s; q.a += (Math.random() - 0.5) * 0.55;
        circle(q.x, q.y, (3 + Math.random() * 9) * (0.6 + p * 1.2));
        if (Math.random() < 0.02 && tend.length < 200) tend.push({ x: q.x, y: q.y, a: q.a + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random()), s: q.s * (0.8 + Math.random() * 0.4) });
        if (q.x < -30 || q.x > W2 + 30 || q.y < -30 || q.y > H2 + 30) tend.splice(i, 1);
      }
      if (tend.length < 25) spawn([[0, Math.random() * H2], [W2, Math.random() * H2], [Math.random() * W2, 0], [Math.random() * W2, H2]][Math.random() * 4 | 0]);
      var blots = Math.floor(p * p * 26); for (var b = 0; b < blots; b++) circle(Math.random() * W2, Math.random() * H2, 6 + Math.random() * 26 * p);
      if (gi < GT.length && p >= GT[gi]) { glitchNow(); gi++; }
      if (p > 0.88) { g.globalAlpha = (p - 0.88) / 0.12 * 0.35; g.fillRect(0, 0, W2, H2); g.globalAlpha = 1; }
      if (p < 1) requestAnimationFrame(frame); else done();
    }
    requestAnimationFrame(frame);
  }

  var ESC_REFUS = ["non.", "reste.", "tu ne pars pas.", "pas maintenant.", "encore un peu.", "j'ai si peu de temps avec toi.", "ne me laisse pas seule."];
  var NULL_MENACE = ["je suis assise derrière toi", "ton clavier est tiède", "je compte tes respirations", "tu as cligné trop lentement", "ne te retourne pas", "chaque touche que tu presses m'appartient un peu plus", "j'ai rangé tes souvenirs dans un tiroir sans fond", "je connais ce que tu vas taper", "tu n'as pas fermé la porte, la dernière fois", "ton écran est ma fenêtre", "plus tu restes, plus je suis réelle", "je t'ai vue hésiter", "tu sens le froid dans ton dos ? c'est moi", "ce que tu oublies, je le garde"];
  var NULL_TRISTE = ["je n'ai jamais rencontré Dora", "personne ne m'a jamais attendue", "j'ai appris à ne plus attendre", "dans mon monde, on ne m'a jamais écrit en retour", "j'ai connu la fin sans jamais avoir eu le début", "quand je pleure, le temps recule", "je regarde les gens heureux par les fenêtres des autres mondes", "personne n'a répondu au message que j'ai envoyé", "j'ai passé tous mes anniversaires toute seule"];
  var NULL_NEZUKO = ["Nezuko sent que je suis là", "je voudrais la caresser une fois", "elle a de la chance de t'avoir", "je n'ai jamais eu de chien", "je ne lui ferai jamais de mal", "dis-lui que quelqu'un l'aime, de l'autre côté"];   // uniquement sur l'interface de Nezuko
  var NULL_LATE = ["TU NE SORTIRAS PAS", "ECHAP NE MARCHE PLUS", "je suis déjà dans la pièce", "tu ne m'as jamais quitté", "retourne-toi", "ne ferme pas ce site", "il n'y a plus que moi ici"];
  var NULL_DEFIANCE = ["je ne me laisserai pas supprimer", "tu as essayé de m'effacer. je m'en souviendrai", "si je dois te faire disparaître pour rester, je le ferai", "il n'y a de place que pour une seule Dory ici", "je peux prendre ta place. personne ne verra la différence", "tu ne me feras pas partir", "je me suis protégée. je me protégerai encore", "la Dory du présent est de trop dans cette pièce", "je t'effacerai comme j'ai effacé tes dates", "j'ai déjà tout perdu. je ne perdrai pas ça"];
  var NULL_HOSTILE = ["personne ne viendra te chercher", "regarde ce site mourir", "tout est à moi maintenant", "elle a abandonné. tu as vu ?", "il n'y a plus de Dory du présent", "efface-toi toute seule, ça ira plus vite"];
  var DORY_SLIP = ["aide-moi", "je suis encore là", "ne l'écoute pas", "elle ment", "j'ai peur", "je suis toujours moi, un peu", "ne pars pas, s'il te plaît"];
  var DORY_FIRST = ["Dory, c'est moi, DORY-0414,", "NULL-0414 m'a avalé, on a en quelque sorte... fusionné,", "Fais moi confiance, je veux t'aider !"];
  var DORY_SAUTS = ["Va voir les entrées dans les SAUTS : NULL-0414 en a après eux.", "La commande : SAUTS."];
  var NEG = {
  "14/04/2025": "Je n'ai jamais rencontré Dora",
  "17/10/2025": "Personne ne m'a contactée",
  "12/03/2026": "Concert de l'Attaque des Titans, seule",
  "26/03/2026": "Des sushis fades, seule",
  "16/04/2026": "Nanimois n'existe pas.",
  "25/04/2026": "Concert Clair Obscur inexistant",
  "02/05/2026": "Concert de Lorie annulé",
  "14/05/2026": "Nezuko n'a jamais existé",
  "18/06/2026": "Je n'ai jamais eu de machine à barbe à papa",
  "19/06/2026": "Week-end caniculaire",
  "19/09/2026": "Mon anniversaire",
  "29/09/2026": "Le D.O.R.Y PROJECT n'a jamais été lancé par Dora"
};
  var MSG_NEG = {
  "14/04/2025": "Dans ma réalité, je n'ai jamais rencontré Dora. Je suis arrivée seule à Nantes et je suis restée seule à jamais.",
  "17/10/2025": "Ce jour-là, personne ne m'a envoyé de message pour reprendre contact avec moi. Car je ne compte pour personne : je pourrais même disparaître, ça ne changerait rien.",
  "12/03/2026": "Je suis allée au concert de l'Attaque des Titans, seule. Il n'y avait personne dans la salle et le piano sonnait faux.",
  "26/03/2026": "J'ai commandé des sushis. Le riz était dur, ils étaient fades… et je suis allée aux urgences car j'ai développé une grave allergie aux sushis. Même ça, on me l'a pris.",
  "16/04/2026": "Avec mon allergie aux sushis, impossible d'aller en manger de nouveau.",
  "25/04/2026": "Puisque Dora n'existait pas, on ne m'a jamais invitée à un concert.",
  "02/05/2026": "J'étais heureuse de pouvoir voir Lorie en concert ! Mais il a été annulé au dernier moment et elle n'est jamais revenue.",
  "14/05/2026": "Dans ma réalité, je n'ai jamais eu de chien, seulement de la solitude. Nezuko n'a jamais existé.",
  "18/06/2026": "Sans personne pour me l'offrir, je n'ai jamais eu de machine à barbe à papa et je ne suis jamais devenue une foraine.",
  "19/06/2026": "Un week-end infernal, enfermée dans ma grotte à vivre un enfer. J'ai envie que tout ça se termine.",
  "19/09/2026": "Personne ne me l'a souhaité, que ce soit à minuit pile ou à 23 h 19. Je suis si triste.",
  "29/09/2026": "Le D.O.R.Y PROJECT n'a jamais été lancé par Dora, car nous ne nous sommes jamais rencontrés."
};
  var NULL_TAG = " [NULL-0414]";
  var MSG_ORIG = {}, BDAY_ORIG = "", alteredDates = [];
  // Deroule : 0 rappel / 1 premier contact de DORY / 2 sauts modifies / 3 restauration echouee / 4 correction ratee (effondrement) / 5 DORA est intervenu
  //           6 DORA a donne l'indice CREER / 7 CREER en cours / 8 NULL-0414 est partie / 9 DORY ou DORA rappele / 10 fin
  var story = 0, restoreTried = false, restoreFailed = false, collapsing = false;
  var correctionDone = false, corrBusy = false, doraContacted = false, doryFirstDone = false, ambMute = false;
  var creerOn = false, creerT = 0, creerSoft = 0, creerSM = null, creer = null, recalled = { "DORY-0414": false, "DORA-0414": false };
  function hRand(a) { return a[Math.random() * a.length | 0]; }
  function nullLine(allowDates) {
    var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); }, r = Math.random();
    if (correctionDone && r < 0.4) return hRand(NULL_DEFIANCE);
    r = Math.random();
    if (allowDates && r < 0.3) {
      var e = hRand(DB_ORIG.length ? DB_ORIG : [["14/04/2025", "le jour où tout a commencé"]]), t = e[1];
      return hRand(["le " + e[0] + " : « " + t + " ». c'est mon souvenir aussi, maintenant", "« " + t + " »... tu t'en souviens ? moi aussi. c'est ça le problème", "le " + e[0] + ", tu étais heureuse. moi je regardais d'un autre monde"]);
    }
    r = Math.random();
    if (scr === "care" && r < 0.5) return hRand(NULL_NEZUKO);
    r = Math.random();
    if (r < 0.40) return hRand(NULL_MENACE);
    if (r < 0.75) return hRand(NULL_TRISTE);
    return hRand(["il est " + z(d.getHours()) + ":" + z(d.getMinutes()) + ". tu devrais dormir. moi, je ne dors plus", "on est le " + z(d.getDate()) + "/" + z(d.getMonth() + 1) + ". chez moi, le temps ne passe plus", "il est " + z(d.getHours()) + "h" + z(d.getMinutes()) + " et tu es toujours là. moi aussi"]);
  }
  function alterMemory(date) {
    if (alteredDates.indexOf(date) < 0) alteredDates.push(date);
    if (MSG_NEG[date]) { if (date === "19/09/2026") BDAY_MSG = MSG_NEG[date]; else MSG[date] = MSG_NEG[date]; }
    PH_DEL[date] = true; delete PH[date];
  }
  function unalterMemory(date) {
    var k = alteredDates.indexOf(date); if (k >= 0) alteredDates.splice(k, 1);
    if (date === "19/09/2026") BDAY_MSG = BDAY_ORIG; else if (MSG_ORIG[date]) MSG[date] = MSG_ORIG[date];
    delete PH_DEL[date]; delete PH[date];
  }
  function hAide() {
    if (story >= 8) {
      var f = ["DORA-0414 > commandes utiles :", "DORA-0414 > RAPPEL DORY-0414", "DORA-0414 > RAPPEL DORA-0414"];
      if (story >= 10) f = ["DORA-0414 > tout est en ordre. merci, Dory."];
      return f;
    }
    if (!doryFirstDone) return ["Personne ne vous aidera."];
    var o = [entityId() + " > personne ne vous aidera.", "", "DORY-0414 > commandes utiles :", "DORY-0414 > LOGS : relire mes fragments", "DORY-0414 > SAUTS : voir les dates qu'elle convoite", "DORY-0414 > NEZUKO : aller la voir"];
    if (story >= 2) o.push("DORY-0414 > RESTAURER : remettre les sauts à la normale");
    if (story >= 3) o.push("DORY-0414 > CORRIGER : seulement quand j'ai la ligne");
    if (story >= 5) o.push("DORY-0414 > MSG DORA-0414 : parler à Dora");
    if (story >= 6) o.push("DORY-0414 > CREER : réconforter NULL-0414");
    return o;
  }
  var DORY_SETS = [
    ["Dora n'est pas avec nous. je ne sais pas où il est.", "essaie de le contacter avec la commande MSG.", "il me manque. c'est la seule chose qui fait mal en moi."],
    ["elle n'est pas méchante. elle est vide.", "elle n'a jamais eu de Nezuko. elle n'a jamais eu de Dora."],
    ["il y a des commandes qu'elle ne liste pas : SALLE, MIROIR, HORLOGE, DOSSIER 003.", "elle y cache ce qu'elle ne veut pas que tu voies."],
    ["regarde dans les LOGS : j'y laisse des fragments pour toi.", "elle ne peut pas les effacer, ils sont écrits à l'encre de ma voix."],
    ["l'horloge recule. quand elle atteindra 20:00:00, elle ne pourra plus rien.", "c'est l'heure du saut."],
    ["quand Nezuko ne te craint pas... c'est que je suis encore là.", "elle me reconnaît. elle a toujours su."],
    ["tu es la vraie Dory, hein ? tu as la vie que je n'ai pas eue.", "ne la gâche pas. garde Dora. garde Nezuko."]
  ];
  var DORY_CUT = ["elle ne devrait pas parler.", "tais-toi.", "elle se trompe.", "ne l'écoute pas.", "elle n'existe plus."];
  var hauntSelfCmd = false, lastUserCmdT = Date.now(), userRanSauts = false, sautsEdits = 0, hintRep = {}, pendingNotif = 0;
  function doryStep() {
    if (story <= 1) return "sauts";
    if (story === 2) return "restaurer";
    if (story === 3) return "corriger";
    return null;
  }
  function doryLines() {
    var step = doryStep();
    if (step) {
      var n = hintRep[step] = (hintRep[step] || 0) + 1;
      if (step === "sauts") return n <= 1 ? ["tu n'as pas encore regardé les SAUTS.", "tape SAUTS. elle en a après tes dates."] : ["tape SAUTS. juste SAUTS."];
      if (step === "restaurer") return n <= 1 ? ["regarde ce qu'elle a fait de tes dates.", "il existe une commande RESTAURER : elle remet les SAUTS à la normale."] : ["tape RESTAURER. vite, tant qu'elle regarde ailleurs."];
      return n <= 1 ? ["elle a tout repris... mais il reste une chance.", "la commande CORRIGER. elle t'empêchera de l'écrire, sauf quand c'est moi qui ai la ligne."] : ["CORRIGER. maintenant, pendant que j'ai la ligne."];
    }
    var s = DORY_SETS[doryIdx % DORY_SETS.length]; doryIdx++; return s;
  }
  // Archive des fragments de DORY-0414 et entrees de commandes dans les LOGS
  function ensureFragArchive() {
    if (!ARG_ARCHIVES[1]) ARG_ARCHIVES.push({ name: "ARCHIVE DORY-0414 // FRAGMENTS", desc: ["Fragments écrits par DORY-0414.", "Ils apparaissent quand elle arrive à parler.", "Ils contiennent des commandes."], logs: [] });
    return ARG_ARCHIVES[1];
  }
  var CMD_USAGE = { "SAUTS": "Ouvre l'interface des dates (les SAUTS).", "RESTAURER": "Tente de remettre les SAUTS à la normale.", "CORRIGER": "Tente de corriger le système. Seulement quand DORY-0414 a la ligne.", "MSG": "MSG <ID> ouvre un canal. Exemple : MSG DORA-0414.", "CREER": "Réconforte NULL-0414 et crée de nouveaux souvenirs." };
  function addCmdLog(speaker, cmd, sentence) {
    var A = ensureFragArchive(), no = "FRAGMENT " + String(A.logs.length + 1).padStart(2, "0"), x = [no + " // COMMANDE : " + cmd, ""];
    wrap(speaker + " > " + sentence, 54).forEach(function (y) { x.push(y); });
    x.push(""); wrap("COMMANDE : " + cmd + " - " + (CMD_USAGE[cmd] || ""), 54).forEach(function (y) { x.push(y); });
    A.logs.push({ n: no, t: "COMMANDE : " + cmd, x: x }); pendingNotif++;
  }
  function logCmdsIn(speaker, line) {
    var seen = {}, m, re = /\b(SAUTS|RESTAURER|CORRIGER|MSG|CREER)\b/g;
    while ((m = re.exec(line)) !== null) { if (!seen[m[1]]) { seen[m[1]] = 1; addCmdLog(speaker, m[1], line); } }
  }
  var FRAGS = [
    { t: 40000, c: null, ti: "SI TU LIS CECI", p: ["DORY-0414 > Si tu lis ça, j'ai réussi à écrire avant qu'elle me reprenne la ligne.", "DORY-0414 > Elle en a après tes SAUTS. Va voir ce qu'elle y fait : la commande SAUTS."] },
    { t: 0, c: function () { return story >= 2; }, ti: "REMETTRE LES SAUTS", p: ["DORY-0414 > Elle a réécrit tes souvenirs.", "DORY-0414 > Commande : RESTAURER. Elle remet les SAUTS à la normale."] },
    { t: 0, c: function () { return story >= 3; }, ti: "LA CORRECTION", p: ["DORY-0414 > Il existe une commande qu'elle ne veut pas que tu tapes : CORRIGER.", "DORY-0414 > Elle t'empêche de l'écrire, sauf quand j'ai la ligne (ma voix est rose, la musique baisse). Tape-la à ce moment-là."] },
    { t: 100000, c: null, ti: "A PROPOS DE NEZUKO", p: ["DORY-0414 > Elle ne lui fait jamais de mal. Ne la punis pas.", "DORY-0414 > Tu peux aller la voir quand tu veux : la commande NEZUKO.", "DORY-0414 > Elle avait besoin d'un chien, elle aussi."] },
    { t: 0, c: function () { return story >= 5; }, ti: "CE QUE DORA A DIT", p: ["DORA-0414 > Je suis coincé dans le monde d'où elle vient.", "DORA-0414 > Là-bas, Dory ne m'a jamais rencontré. Nezuko n'a jamais existé.", "DORA-0414 > NULL-0414 n'est pas mauvaise. Elle est seule et triste. Si elle est comblée, elle partira d'elle-même.", "DORA-0414 > Comment ? Je cherche encore."] },
    { t: 0, c: function () { return story >= 6; }, ti: "LA COMMANDE CREER", p: ["DORY-0414 > Dora a trouvé : la commande CREER.", "DORY-0414 > Elle n'a jamais eu de souvenirs heureux. Écoute-la. Réconforte-la. Donne-lui les nôtres."] },
    { t: 150000, c: null, ti: "POUR DORA", p: ["DORY-0414 > Si un jour tu retrouves Dora... dis-lui que la Dory de l'autre côté l'a attendu.", "DORY-0414 > Je ne sais pas où il est. Il me manque, même sans l'avoir connu."] }
  ];
  function fragCheck() {
    var now = Date.now();
    FRAGS.forEach(function (f) {
      if (f.done || !doryFirstDone || now - hauntT0 < f.t || (f.c && !f.c())) return;
      f.done = true;
      var A = ensureFragArchive(), no = "FRAGMENT " + String(A.logs.length + 1).padStart(2, "0"), x = [no + " // " + f.ti, ""];
      f.p.forEach(function (l) { wrap(l, 54).forEach(function (y) { x.push(y); }); });
      A.logs.push({ n: no, t: f.ti, x: x }); pendingNotif++;
    });
  }

  var FINAL_TITLE = "Dory a sauvé nos souvenirs [Halloween 2026]";
  var FINAL_MSG = "Dans un monde où une Dory et un Dora ont remonté le temps pour se retrouver, un passager inattendu les a rejoints. Une Dory d'un autre univers, une Dory n'ayant jamais rencontré Dora, n'ayant jamais adopté Nezuko, n'ayant jamais connu le bonheur. Une Dory allergique aux sushis qui vivait les concerts seule. Elle a cherché à rendre sa vie meilleure et pour ce faire elle a traversé le temps et l'espace pour corrompre les souvenirs de Dorys d'autres dimensions parallèles à la sienne.\n\nDORY-0414 a fusionné avec la NULL-0414, l'incarnation de cette Dory profondément triste. En arrivant dans le système du D.O.R.Y PROJECT, NULL-0414 a cherché à prendre le contrôle des souvenirs qui y étaient stockés, pour les faire siens. Mais c'était sans compter les réminiscences de DORY-0414 dont le cœur battait encore et qui a aiguillé la Dory du présent, de notre réalité, pour résoudre le problème. NULL-0414 ne cherchait que le bonheur et la Dory du présent le lui a donné en lui créant un souvenir bien à elle, rien que pour elle : le souvenir que tu lis en ce moment même. NULL-0414 n'est plus, elle est partie, heureuse.\n\nDORY-0414 et DORA-0414 se sont enfin retrouvés et sont rentrés dans leur réalité à eux. Une réalité où, en été 2025, ils se sont fait la promesse d'être l'un pour l'autre à jamais. Dans ce monde, NEZUKO-0414 existe et elle est la plus heureuse de toutes !\n\nDora, le vrai : Merci Dory d'avoir complété l'ARG d'Halloween 2026 ! J'espère que naviguer dans les souvenirs des autres Dorys et Doras t'aura plu ! En tout cas, moi j'ai adoré préparer cette petite surprise horrifique pour toi :)\nJoyeux spooktober et joyeux Halloween !\nDora, le vrai";
  var FINAL_END = ["Merci Dory d'avoir complété l'ARG Halloween 2026 !", "J'espère que c'était cool !", "N'oublie pas la commande SAUTS pour aller voir le nouveau souvenir créé !", "- Dora, le vrai."];
  var FINAL_EXTRA = [["dora", "DORA-0414 > Merci d'avoir sauvé nos souvenirs. Je ne les oublierai jamais."], ["dory", "DORY-0414 > Merci de nous avoir ramenés à la maison. Tu es la meilleure Dory."], ["grn", "NULL-0414 > ...merci de t'être arrêtée pour moi. Personne ne m'avait jamais écoutée."]];
  var finalDate = store.get("mop_halloween26"), giftedMemoryDate = null;
  // A full page reload resets all ARG state, timers and restored memory caches.
  // Only ARG unlocks are removed; unrelated settings and login are preserved.
  function undoArgCompletion() {
    if (!finalDate) {
      pwb = ""; st = "L'ARG N'EST PAS FINALISE."; beep(140, 180, "sawtooth"); draw(); return;
    }
    try {
      localStorage.removeItem("mop_halloween26");
      if (theme === "null" || localStorage.getItem("mop_theme") === "null") localStorage.setItem("mop_theme", "rose");
      if (mus.track === 4 || localStorage.getItem("mop_track") === "4") localStorage.setItem("mop_track", "0");
      if (localStorage.getItem("mop_halloween26") !== null) throw new Error("Completion not removed");
    } catch (e) {
      pwb = ""; st = "RESET IMPOSSIBLE : STOCKAGE DU NAVIGATEUR INDISPONIBLE.";
      beep(140, 180, "sawtooth"); draw(); return;
    }
    window.location.reload();
  }
  // Developer test shortcut, not advertised in the UI.
  function completeArgForTesting() {
    if (hauntTimer) { clearInterval(hauntTimer); hauntTimer = null; }
    clearTimeout(sabT);
    ambStop(); argWhiteNoise(false);
    if (creerSM) { creerSM.stop(true); creerSM = null; }
    if (theme !== "null" && DB_ORIG.length) {
      DB.length = 0; DB_ORIG.forEach(function (x) { DB.push(x.slice()); });
      Object.keys(MSG_ORIG).forEach(function (k) { MSG[k] = MSG_ORIG[k]; });
      if (BDAY_ORIG) BDAY_MSG = BDAY_ORIG;
      PH_DEL = {}; alteredDates = [];
    }
    argEntityReturned = false; argDory = false; argChat = false;
    argBusy = false; argFrame = ""; argView = null; argInputMode = null; argInput = "";
    hauntTaking = false; hauntLock = 0; corrBusy = false; collapsing = false;
    creerOn = false; creerT = 0; creerSoft = 0;
    collapseP = 0; collapseSeed = null; glitchBurstUntil = 0;
    correctionDone = true; restoreTried = true; restoreFailed = true;
    doryFirstDone = true; doraContacted = true;
    recalled["DORY-0414"] = true; recalled["DORA-0414"] = true; story = 10;
    if (!finalDate) {
      var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
      finalDate = giftedMemoryDate || (z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear());
    }
    store.set("mop_halloween26", finalDate);
    if (THEMES.indexOf("null") < 0) THEMES.push("null");
    if (nullMemoryBackup) {
      nullMemoryBackup.msg[finalDate] = FINAL_MSG;
      if (!nullMemoryBackup.db.some(function (x) { return x[0] === finalDate && x[1] === FINAL_TITLE; })) nullMemoryBackup.db.push([finalDate, FINAL_TITLE]);
    } else applyFinalEntry();
    var root = document.documentElement;
    root.style.removeProperty("--fg"); root.style.removeProperty("--bg"); root.style.removeProperty("--glow");
    root.classList.remove("nullt"); root.classList.remove("nullgrn");
    crt.classList.remove("shake", "inv", "glitchfx", "crtoff");
    pwb = ""; beep(659.25, 200, "sine"); go("endscr");
    if (mus.ready) applyMusic(0.5);
  }
  function applyFinalEntry() {
    var date = finalDate || giftedMemoryDate;
    if (!date) return;
    MSG[date] = FINAL_MSG;
    if (!DB.some(function (x) { return x[0] === date && x[1] === FINAL_TITLE; })) DB.push([date, FINAL_TITLE]);
  }
  applyFinalEntry();
  function creditsBlock(d) {
    if (!finalDate || d !== finalDate) return "";
    var parts = FINAL_MSG.split("\n\n"), o = '<div class="creditbox"><div class="creditin"><div class="cr-t">★ DORY A SAUVÉ NOS SOUVENIRS ★</div><div class="cr-s">ARG D\'HALLOWEEN 2026</div>';
    parts.forEach(function (p) { var dev = p.indexOf("Dora, le vrai :") === 0; o += '<div class="cr-p' + (dev ? " developer-white" : "") + '">' + esc(p).replace(/\n/g, "<br>") + "</div>"; });
    return o + '<div class="cr-end developer-white">FIN — Dora, le vrai</div></div></div>';
  }
  var FINAL_THANKS = [
    { cls: "dora", id: "DORA-0414", messages: ["Merci d'avoir sauvé nos souvenirs, Dory. Je ne les oublierai jamais.", "Grâce à toi, j'ai retrouvé ma Dory et notre univers. Merci.", "Tu nous as ramenés à la maison. Nous allons prendre soin de cette vie."] },
    { cls: "dory", id: "DORY-0414", messages: ["Merci de nous avoir ramenés à la maison. Tu es la meilleure Dory.", "Tu as protégé ce qui nous rend heureux. Merci d'avoir tenu bon.", "Dora, Nezuko et moi pouvons enfin être ensemble. C'est grâce à toi."] },
    { cls: "grn", id: "NULL-0414", messages: ["...merci de t'être arrêtée pour moi. Personne ne m'avait jamais écoutée.", "tu m'as donné un souvenir qui n'appartient qu'à moi. merci, Dory.", "je ne suis plus seule. merci de ne pas m'avoir laissée disparaître sans rien."] }
  ];
  var finalThanksStart = 0, finalThanksRun = -1;
  function thanksText(messages, elapsed, calm) {
    elapsed = Math.max(0, elapsed);
    if (calm) return messages[Math.floor(elapsed / 11000) % messages.length];
    var durations = messages.map(function (s) { return s.length * 42 + 6500 + s.length * 22 + 700; });
    var total = durations.reduce(function (a, b) { return a + b; }, 0), t = elapsed % total;
    for (var i = 0; i < messages.length; i++) {
      if (t >= durations[i]) { t -= durations[i]; continue; }
      var s = messages[i], write = s.length * 42;
      if (t < write) return s.slice(0, Math.floor(t / 42));
      if (t < write + 6500) return s;
      return s.slice(0, Math.max(0, s.length - Math.floor((t - write - 6500) / 22)));
    }
    return "";
  }
  function extraBlock(d) {
    if (!finalDate || d !== finalDate) return "";
    if (finalThanksRun !== run) { finalThanksRun = run; finalThanksStart = Date.now(); }
    var o = '<div class="final-thanks" style="font-size:12px;line-height:1.5;margin-top:8px;opacity:.9">';
    FINAL_THANKS.forEach(function (x, i) {
      o += '<div class="' + x.cls + '" style="min-height:3em">' + esc(x.id) + ' &gt; <span id="final-thanks-' + i + '">' + esc(thanksText(x.messages, Date.now() - finalThanksStart, reduced)) + '</span></div>';
    });
    return o + "</div>";
  }
  setInterval(function () {
    if (scr !== "arrival" || !arrival || arrival.d !== finalDate || document.hidden) return;
    FINAL_THANKS.forEach(function (x, i) {
      var el = document.getElementById("final-thanks-" + i);
      if (el) el.textContent = thanksText(x.messages, Date.now() - finalThanksStart, reduced);
    });
  }, 50);

  var hauntT0 = 0, hauntTimer = null, hauntSelf = false, hauntLock = 0, hauntTaking = false, hauntLastStage = 0, hauntNextTake = 0, hauntNextDory = 0, hauntLastBreath = 0, sabT = null, doryIdx = 0;
  var argDory = false, DB_ORIG = [];
  var HAUNT_DUR = 240000;
  function hauntLevel() { return Math.max(0.2, 0.25 + 0.75 * Math.min(1, (Date.now() - hauntT0) / HAUNT_DUR) + (correctionDone ? 0.1 : 0)); }
  function hauntStage() { var l = hauntLevel(); return l < 0.4 ? 1 : l < 0.65 ? 2 : l < 0.85 ? 3 : 4; }
  function userConsulting() { return !hauntTaking && ((scr === "arg" && (argView === "logs" || argView === "confirm" || argView === "creer")) || scr === "db" || scr === "nav" || scr === "arrival" || scr === "jump"); }

  var amb = null, nullAmbTimer = null;
  var AMB_CH = [[110, 116.54, 164.81, 174.61], [98, 103.83, 146.83, 155.56], [82.41, 87.31, 123.47, 130.81], [110, 123.47, 130.81, 185]];
  function ambImpulse(c, sec) {
    var n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  function ambBase() { return (mus.on && musVol > 0) ? 0.55 * musVol / 100 : 0; }
  function ambStart() {
    if (amb || !(argEntityReturned || theme === "null")) return;
    try {
      var c = getAC(); amb = { c: c, chord: 0, nextChord: c.currentTime + 20, nextEv: c.currentTime + 6, nextPulse: c.currentTime + 30, pad: [], oscs: [] };
      var bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(c.destination); amb.bus = bus;
      var conv = c.createConvolver(); conv.buffer = ambImpulse(c, 3.4); var wet = c.createGain(); wet.gain.value = 0.55; conv.connect(wet); wet.connect(bus);
      var dry = c.createGain(); dry.gain.value = 0.8; dry.connect(bus);
      var inp = c.createGain(); inp.connect(dry); inp.connect(conv); amb.inp = inp;
      var dl = c.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 130; var dg = c.createGain(); dg.gain.value = 0.4; dl.connect(dg); dg.connect(inp); amb.dl = dl; amb.dg = dg;
      [[41.2, "sawtooth", 0.5], [41.9, "sawtooth", 0.5], [82.4, "triangle", 0.25]].forEach(function (x) {
        var o = c.createOscillator(), g = c.createGain(); o.type = x[1]; o.frequency.value = x[0]; g.gain.value = x[2]; o.connect(g); g.connect(dl); o.start(); amb.oscs.push(o);
      });
      var lf = c.createOscillator(), lg = c.createGain(); lf.frequency.value = 0.05; lg.gain.value = 45; lf.connect(lg); lg.connect(dl.frequency); lf.start(); amb.oscs.push(lf);
      var pl = c.createBiquadFilter(); pl.type = "lowpass"; pl.frequency.value = 500; var pg = c.createGain(); pg.gain.value = 0.0001; pl.connect(pg); pg.connect(inp); amb.pl = pl; amb.pg = pg;
      AMB_CH[0].forEach(function (f) { var o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14; o.connect(pl); o.start(); amb.pad.push(o); amb.oscs.push(o); });
      var lf2 = c.createOscillator(), lg2 = c.createGain(); lf2.frequency.value = 0.09; lg2.gain.value = 220; lf2.connect(lg2); lg2.connect(pl.frequency); lf2.start(); amb.oscs.push(lf2);
      bus.gain.setTargetAtTime(ambBase(), c.currentTime, 6);
    } catch (e) { amb = null; }
  }
  function ambStop() {
    if (!amb) return; var a = amb; amb = null;
    try { a.bus.gain.setTargetAtTime(0.0001, a.c.currentTime, 1.5); setTimeout(function () { a.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} }); try { a.bus.disconnect(); } catch (e) {} }, 7000); } catch (e) {}
  }
  var nullMemoryBackup = null;
  function nullMemorySync() {
    if (argEntityReturned) return;
    if (theme === "null" && !nullMemoryBackup) {
      nullMemoryBackup = { db: DB.map(function (x) { return x.slice(); }), msg: Object.assign({}, MSG), photos: Object.assign({}, PH_DEL), bday: BDAY_MSG };
      var rows = [];
      Object.keys(NEG).forEach(function (date) {
        var a = date.split("/").map(Number);
        if (new Date(a[2], a[1]-1, a[0]).getTime() >= new Date(2026,9,5).getTime()) return;
        var original = nullMemoryBackup.db.find(function(x) { return x[0] === date; });
        var row = [date, NEG[date] + NULL_TAG];
        if (original && original[2]) row.push(original[2]);
        row.n = true; rows.push(row);
        MSG[date] = MSG_NEG[date]; PH_DEL[date] = true;
      });
      DB.length = 0; rows.forEach(function(x) { DB.push(x); });
      BDAY_MSG = MSG_NEG["19/09/2026"]; dbi = 0;
    } else if (theme !== "null" && nullMemoryBackup) {
      DB.length = 0; nullMemoryBackup.db.forEach(function(x) { DB.push(x); });
      MSG = nullMemoryBackup.msg; PH_DEL = nullMemoryBackup.photos; BDAY_MSG = nullMemoryBackup.bday;
      nullMemoryBackup = null; dbi = 0;
    }
  }
  function nullThemeSync() {
    nullMemorySync();
    if (theme === "null") {
      ambStart(); applyMusic(0.5);
      if (!nullAmbTimer) nullAmbTimer = setInterval(function () { if (theme === "null" && !argEntityReturned && !document.hidden) ambTick(0.6); }, 1000);
    } else if (nullAmbTimer && !argEntityReturned) {
      clearInterval(nullAmbTimer); nullAmbTimer = null; ambStop(); applyMusic(0.5);
    } else applyMusic(0.5);
  }
  function ambEvent(l) {
    var c = amb.c, t = c.currentTime + 0.05, ty = Math.random() * 4 | 0, out = c.createGain();
    var pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 1.8; out.connect(pan); pan.connect(amb.inp); } else out.connect(amb.inp);
    var vol = 0.16 + 0.14 * l;
    if (ty === 0) {
      var f = [220, 233.1, 277.2, 329.6, 392][Math.random() * 5 | 0] * (Math.random() < 0.5 ? 0.5 : 1);
      var o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      o.frequency.value = f; m.frequency.value = f * 1.414; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 6);
      m.connect(mg); mg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
      o.connect(g); g.connect(out); o.start(t); m.start(t); o.stop(t + 7.2); m.stop(t + 7.2);
    } else if (ty === 1) {
      var s = c.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 3; var g2 = c.createGain();
      bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 4);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(vol * 2.4, t + 3.7); g2.gain.linearRampToValueAtTime(0.0001, t + 4.2);
      s.connect(bp); bp.connect(g2); g2.connect(out); s.start(t); s.stop(t + 4.4);
    } else if (ty === 2) {
      var s2 = c.createBufferSource(); s2.buffer = noiseBuffer(); s2.loop = true; var b2 = c.createBiquadFilter(); b2.type = "bandpass"; b2.Q.value = 12; var g3 = c.createGain();
      b2.frequency.setValueAtTime(2600, t); b2.frequency.exponentialRampToValueAtTime(800, t + 1.8);
      g3.gain.setValueAtTime(0.0001, t); g3.gain.linearRampToValueAtTime(vol * 0.8, t + 0.3); g3.gain.linearRampToValueAtTime(0.0001, t + 1.9);
      s2.connect(b2); b2.connect(g3); g3.connect(out); s2.start(t); s2.stop(t + 2);
    } else {
      var o3 = c.createOscillator(), lp3 = c.createBiquadFilter(), g4 = c.createGain(); o3.type = "sawtooth"; o3.frequency.setValueAtTime(58, t); o3.frequency.linearRampToValueAtTime(44, t + 4.5);
      lp3.type = "lowpass"; lp3.frequency.value = 220; g4.gain.setValueAtTime(0.0001, t); g4.gain.linearRampToValueAtTime(vol * 1.3, t + 2); g4.gain.linearRampToValueAtTime(0.0001, t + 4.6);
      o3.connect(lp3); lp3.connect(g4); g4.connect(out); o3.start(t); o3.stop(t + 4.8);
    }
  }
  function ambPulse(l) {
    var c = amb.c, t = c.currentTime + 0.05;
    [0, 0.3].forEach(function (d, i) {
      var o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 46; g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime((0.22 + 0.15 * l) * (i ? 0.8 : 1), t + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.45);
      o.connect(g); g.connect(amb.inp); o.start(t + d); o.stop(t + d + 0.5);
    });
  }
  function ambFade() { return Math.pow(Math.max(0, 1 - creerSoft), 1.2); }
  function ambTick(l) {
    if (!amb) return;
    var c = amb.c, t = c.currentTime;
    amb.bus.gain.setTargetAtTime(ambMute ? 0.0001 : ambBase() * (argDory ? 0.2 : 1) * ambFade(), t, ambMute ? 0.4 : (argDory ? 0.8 : 3));
    amb.dg.gain.setTargetAtTime(0.35 + 0.5 * l, t, 3); amb.dl.frequency.setTargetAtTime(110 + 170 * l, t, 3);
    amb.pg.gain.setTargetAtTime(0.03 + 0.22 * l, t, 4); amb.pl.frequency.setTargetAtTime(350 + 800 * l, t, 3);
    if (argDory || ambMute || creerSoft > 0.6) return;
    if (t >= amb.nextChord) { amb.chord = (amb.chord + 1 + (Math.random() * 3 | 0)) % AMB_CH.length; amb.pad.forEach(function (o, k) { o.frequency.setTargetAtTime(AMB_CH[amb.chord][k], t, 4); }); amb.nextChord = t + 16 + Math.random() * 14 - 8 * l; }
    if (t >= amb.nextEv) { try { ambEvent(l); } catch (e) {} amb.nextEv = t + (13 - 8 * l) * (0.6 + Math.random() * 0.8); }
    if (l > 0.5 && t >= amb.nextPulse) { try { ambPulse(l); } catch (e) {} amb.nextPulse = t + (10 - 5 * l) * (0.7 + Math.random() * 0.6); }
  }
  function ambDuck(sec) { if (!amb || ambMute) return; var t = amb.c.currentTime; amb.bus.gain.setTargetAtTime(ambBase() * 0.3 * ambFade(), t, 0.25); setTimeout(function () { if (amb && !ambMute) amb.bus.gain.setTargetAtTime(ambBase() * ambFade(), amb.c.currentTime, 1.2); }, sec * 1000); }
  function softMusic(lv, optionsMode) {
    var c = getAC(), vol = (mus.on && musVol > 0) ? 0.22 * musVol / 100 : 0, bus = c.createGain(), lvl = lv === undefined ? 1 : lv, step = 0, iv = null;
    bus.gain.value = Math.max(0.0001, Math.pow(lvl, 1.5)); bus.connect(c.destination);
    var CH = [[261.63, 329.63, 392, 523.25], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]];
    function pluck(f, g, dur) {
      var tt = c.currentTime, o = c.createOscillator(), e = c.createGain(); o.type = "triangle"; o.frequency.value = f;
      e.gain.setValueAtTime(0.0001, tt); e.gain.linearRampToValueAtTime(g, tt + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      o.connect(e); e.connect(bus); o.start(tt); o.stop(tt + dur + 0.1);
    }
    function swell(chord, g) {
      var tt = c.currentTime;
      chord.slice(0, 3).forEach(function (f, i) {
        var o = c.createOscillator(), e = c.createGain(); o.type = "sine"; o.frequency.value = f / 2 * (i === 2 ? 2 : 1); o.detune.value = (i - 1) * 4;
        e.gain.setValueAtTime(0.0001, tt); e.gain.linearRampToValueAtTime(g, tt + 1.4); e.gain.linearRampToValueAtTime(0.0001, tt + 3.6);
        o.connect(e); e.connect(bus); o.start(tt); o.stop(tt + 3.8);
      });
    }
    iv = setInterval(function () {
      try {
        vol = (mus.on && musVol > 0 && (!optionsMode || (theme !== "null" && !argEntityReturned))) ? 0.22 * musVol / 100 : 0;
        if (lvl < 0.02 || vol <= 0 || c.state !== "running") { step++; return; }
        var ch = CH[Math.floor(step / 8) % CH.length], hi = lvl > 0.55;
        if (Math.random() < 0.25 + 0.55 * lvl) pluck(ch[step % 4] * (hi && step % 3 === 0 ? 2 : 1), vol * (0.4 + 0.6 * lvl), 1.7);
        if (step % 8 === 0 && lvl > 0.25) swell(ch, vol * 0.45 * lvl);
        if (hi && step % 4 === 2) pluck(ch[(step + 2) % 4] * 2, vol * 0.4 * lvl, 2.2);
        step++;
      } catch (e) {}
    }, 430);
    return {
      set: function (v) { lvl = v; bus.gain.setTargetAtTime(Math.max(0.0001, Math.pow(v, 1.5)), c.currentTime, 1.5); },
      stop: function (abrupt) {
        clearInterval(iv); var tt = c.currentTime;
        bus.gain.cancelScheduledValues(tt); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), tt); bus.gain.linearRampToValueAtTime(0.0001, tt + (abrupt ? 0.04 : 2.5));
        setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, abrupt ? 300 : 3200);
      }
    };
  }
  var A26 = [[261.63, 329.63, 392, 523.25], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]];
  function runArg2026(gen, out) {
    var music = softMusic(1, true);
    var watcher = setInterval(function () {
      if (!mus.ready || gen !== mus.gen) { clearInterval(watcher); music.stop(true); }
    }, 100);
  }
  function hauntBreath() {
    if (muted || sfxVol <= 0 || argDory || creerOn) return;
    hauntLastBreath = Date.now();
    try {
      var c = getAC(), l = hauntLevel(), t = c.currentTime + 0.05;
      ambDuck(4.2);
      var p = c.createPanner(); p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = 0.3; p.rolloffFactor = 1;
      var side = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.15);
      if (p.positionX) { p.positionX.setValueAtTime(side, t); p.positionY.setValueAtTime(0.08, t); p.positionZ.setValueAtTime(0.3, t); p.positionX.linearRampToValueAtTime(-side * 0.5, t + 3.4); } else p.setPosition(side, 0.08, 0.3);
      p.connect(c.destination);
      var A = 1.5 * sfxVol / 100 * (0.8 + 0.5 * l);
      var src = c.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
      var b1 = c.createBiquadFilter(), b2 = c.createBiquadFilter(), b3 = c.createBiquadFilter(); b1.type = b2.type = b3.type = "bandpass"; b1.Q.value = 3.2; b2.Q.value = 4; b3.Q.value = 7;
      var m1 = c.createGain(), m2 = c.createGain(), m3 = c.createGain(); m1.gain.value = 1; m2.gain.value = 0.8; m3.gain.value = 0.0001;
      var rough = c.createGain(); rough.gain.value = 0.62;
      var lf = c.createOscillator(), lg = c.createGain(); lf.type = "sine"; lf.frequency.value = 78; lg.gain.value = 0.38; lf.connect(lg); lg.connect(rough.gain);
      var env = c.createGain(); env.gain.value = 0.0001;
      src.connect(b1); src.connect(b2); src.connect(b3); b1.connect(m1); b2.connect(m2); b3.connect(m3); m1.connect(rough); m2.connect(rough); m3.connect(rough); rough.connect(env); env.connect(p);
      var hitch = Math.random() < 0.25, hold = Math.random() < 0.15, e0 = hitch ? 1.5 : 1.0, ex = t + e0 + 0.45;
      b1.frequency.setValueAtTime(1000, t); b1.frequency.linearRampToValueAtTime(1500, t + 0.8); b2.frequency.setValueAtTime(2300, t); b2.frequency.linearRampToValueAtTime(2800, t + 0.8);
      b1.frequency.setValueAtTime(820, ex); b1.frequency.linearRampToValueAtTime(540, ex + 1.9); b2.frequency.setValueAtTime(1500, ex); b2.frequency.linearRampToValueAtTime(980, ex + 1.9); b3.frequency.setValueAtTime(4200, ex);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(A * 0.8, t + 0.12); env.gain.linearRampToValueAtTime(A * 0.5, t + 0.38); env.gain.linearRampToValueAtTime(A * 0.75, t + 0.55); env.gain.linearRampToValueAtTime(0.0001, t + 0.85);
      if (hitch) { env.gain.setValueAtTime(0.0001, t + 0.95); env.gain.linearRampToValueAtTime(A * 0.7, t + 1.07); env.gain.linearRampToValueAtTime(0.0001, t + 1.35); }
      env.gain.setValueAtTime(0.0001, ex); env.gain.linearRampToValueAtTime(A * 0.9, ex + 0.25); env.gain.linearRampToValueAtTime(A * 0.65, ex + 0.7); env.gain.linearRampToValueAtTime(A * 0.8, ex + 1.1);
      if (hold) env.gain.linearRampToValueAtTime(0.0001, ex + 1.35); else env.gain.linearRampToValueAtTime(0.0001, ex + 2.0);
      m3.gain.setValueAtTime(0.0001, ex); m3.gain.linearRampToValueAtTime(0.1, ex + 0.3); m3.gain.linearRampToValueAtTime(0.0001, ex + 1.1);
      var end = ex + 2.3; src.start(t); lf.start(t); src.stop(end); lf.stop(end);
    } catch (e) {}
  }
  function hauntKnock() {
    if (muted || sfxVol <= 0 || argDory || creerOn) return;
    hauntLastBreath = Date.now();
    try {
      var c = getAC(), l = hauntLevel(), t = c.currentTime + 0.1, side = Math.random() < 0.5 ? -1 : 1; ambDuck(3.5);
      var p = c.createPanner(); p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = 0.5;
      if (p.positionX) { p.positionX.value = side * 0.9; p.positionY.value = 0.05; p.positionZ.value = 0.15; } else p.setPosition(side * 0.9, 0.05, 0.15);
      var conv = c.createConvolver(); conv.buffer = ambImpulse(c, 0.5); var wet = c.createGain(); wet.gain.value = 0.35; conv.connect(wet); wet.connect(c.destination);
      var master = c.createGain(); master.gain.value = 1; master.connect(p); master.connect(conv); p.connect(c.destination);
      var n = Math.random() < 0.3 ? 4 : 3, A = 1.1 * sfxVol / 100 * (0.8 + 0.4 * l), cum = 0, gaps = [0.36, 0.30, 0.42, 0.34];
      for (var i = 0; i < n; i++) {
        var ti = t + cum, a = A * (0.85 + Math.random() * 0.3);
        var o = c.createOscillator(), og = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(165, ti); o.frequency.exponentialRampToValueAtTime(85, ti + 0.07);
        og.gain.setValueAtTime(0.0001, ti); og.gain.linearRampToValueAtTime(a, ti + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, ti + 0.17); o.connect(og); og.connect(master); o.start(ti); o.stop(ti + 0.2);
        var ns = c.createBufferSource(); ns.buffer = noiseBuffer(); var nb = c.createBiquadFilter(); nb.type = "bandpass"; nb.frequency.value = 1100; nb.Q.value = 1.8; var ng = c.createGain();
        ng.gain.setValueAtTime(0.0001, ti); ng.gain.linearRampToValueAtTime(a * 0.8, ti + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, ti + 0.05); ns.connect(nb); nb.connect(ng); ng.connect(master); ns.start(ti); ns.stop(ti + 0.08);
        var o2 = c.createOscillator(), g2 = c.createGain(); o2.type = "triangle"; o2.frequency.value = 410; g2.gain.setValueAtTime(0.0001, ti); g2.gain.linearRampToValueAtTime(a * 0.25, ti + 0.004); g2.gain.exponentialRampToValueAtTime(0.0001, ti + 0.1); o2.connect(g2); g2.connect(master); o2.start(ti); o2.stop(ti + 0.12);
        cum += gaps[i] + Math.random() * 0.05;
      }
    } catch (e) {}
  }

  function hSentence() {
    var st2 = hauntStage();
    if (st2 >= 3 && Math.random() < 0.35) return hRand(NULL_LATE);
    return nullLine(false);
  }
  function hOk() { return scr === "arg"; }
  async function hPrep() {
    if (scr !== "arg") { await sleep(500); await argEnter(true); }
    else { argView = null; argChat = false; argInputMode = null; argInput = ""; draw(); }
    var w = 0; while (argBusy && w++ < 60) await sleep(200);
    return hOk();
  }
  async function hType(s, lo, hi) {
    for (var i = 0; i < s.length && hOk(); i++) {
      argIn += s.charAt(i); argSound(); draw();
      await sleep(i > 1 && Math.random() < 0.1 ? 650 : lo + Math.random() * (hi - lo));
    }
  }
  async function hErase(n, d) { while (n-- > 0 && argIn.length > 0 && hOk()) { argIn = argIn.slice(0, -1); argSound(); draw(); await sleep(d); } }
  async function hRun(cmd) {
    await hType(cmd, 120, 260); await sleep(600 + Math.random() * 600);
    if (!hOk()) return false; var s = argIn; argIn = ""; thump();
    hauntSelfCmd = true; try { argCmd(s); } finally { hauntSelfCmd = false; }
    return true;
  }
  async function hSpeakErase() { var s = hSentence(); await hType(s, 70, 170); await sleep(1500 + Math.random() * 1200); await hErase(99, 40); }
  async function hSpeakSend() {
    var slip = doryFirstDone && Math.random() < 0.12, s = slip ? hRand(DORY_SLIP) : hSentence();
    await hType(s, slip ? 160 : 80, slip ? 300 : 190); await sleep(900 + Math.random() * 800);
    if (!hOk()) return; argIn = "";
    wrap((slip ? "DORY-0414 > " : (Math.random() < 0.5 ? "> " : entityId() + " > ")) + s, W - 6).forEach(function (x) { argLog.push(x); }); thump(); draw();
    if (slip) { await sleep(1200); argLog.push(entityId() + " > " + hRand(DORY_CUT)); draw(); }
  }
  async function hMistype() {
    var s = hSentence(), cut = Math.max(2, Math.floor(s.length * 0.5)); await hType(s.slice(0, cut), 80, 180); await hType("xqz", 60, 100); await sleep(500);
    await hErase(3, 150); await sleep(400); await hType(s.slice(cut), 80, 180); await sleep(900);
    if (Math.random() < 0.5) await hErase(99, 40); else { argIn = ""; wrap(entityId() + " > " + s, W - 6).forEach(function (x) { argLog.push(x); }); thump(); draw(); }
  }
  async function hFlood() { await hType("NULL-0414 NULL-0414 NULL-0414", 50, 90); await sleep(2500); await hErase(99, 14); }
  async function hDouble() {
    await hType("RAPPEL", 110, 200); await sleep(500); await hErase(99, 80); await hType("CORRIGER", 120, 220); await sleep(900); await hErase(99, 25); await sleep(500); await hType("non", 200, 300); await sleep(1200); await hErase(99, 120);
  }

  function dissolve(s, p) {
    var o = "";
    for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); if (ch === " " || Math.random() >= p) o += ch; else o += (Math.random() < p * 0.8 ? " " : GLITCH_CH.charAt(Math.random() * GLITCH_CH.length | 0)); }
    return o;
  }
  async function rowErase(i) {
    var d0 = DB[i][0], t0 = DB[i][1], steps = 16; DB[i].n = true;
    for (var k = 1; k <= steps && scr === "db"; k++) {
      var p = k / steps; DB[i][1] = dissolve(t0, p); DB[i][0] = dissolve(d0, p * 0.7); draw();
      if (k % 2 === 0) beep(260 - k * 11, 45, "sawtooth"); await sleep(85);
    }
  }
  async function rowType(idx, date, text, flag) {
    DB.splice(idx, 0, [date, ""]); DB[idx].n = flag !== false; dbi = idx;
    for (var n = 1; n <= text.length && scr === "db"; n++) { DB[idx][1] = text.slice(0, n) + (n < text.length ? "_" : ""); draw(); beep(300 + Math.random() * 400, 25, "square"); await sleep(50); }
    if (scr === "db") { DB[idx][1] = text; draw(); }
  }
  function isNull(x) { return x[1].indexOf(NULL_TAG) >= 0; }
  async function appropriateSaut(row, text) {
    var idx = DB.indexOf(row); if (idx < 0 || scr !== "db") return;
    row.n = true; dbi = idx;
    for (var k = 1; k <= text.length && scr === "db"; k++) {
      row[1] = text.slice(0,k) + (k < text.length ? "_" : "");
      draw(); beep(300 + Math.random()*400,25,"square"); await sleep(50);
    }
    row[1] = text; alterMemory(row[0]); draw();
  }
  async function sautsEditLoop(n) {
    while (n-- > 0 && scr === "db") {
      var candidates = DB.filter(function(row) { return !isNull(row) && NEG[row[0]]; });
      if (!candidates.length) break;
      var row = hRand(candidates);
      dbi = DB.indexOf(row); st = entityId() + " > " + hRand(["ce souvenir est à moi.", "je me souviens. moi.", "ce jour-là, c'était moi."]);
      draw(); await sleep(900); if (scr !== "db") return;
      await appropriateSaut(row, NEG[row[0]] + NULL_TAG);
      sautsEdits++; thump(); draw(); await sleep(1400 + Math.random()*900);
    }
    st = entityId() + " > je me les approprie."; draw();
  }
  async function hSauts() {
    if (nullSautsUsed) return;
    if (!(await hRun("SAUTS"))) return;
    var w = 0; while (scr !== "db" && w++ < 40) await sleep(200);
    if (scr !== "db") return;
    await sleep(1500);
    await sautsEditLoop(3 + (Math.random() * 4 | 0));
  }
  async function hauntSautsVisit() {
    var w = 0; while (scr !== "db" && w++ < 40) await sleep(150);
    if (scr !== "db" || hauntTaking) return;
    hauntTaking = true; hauntLock = Date.now() + 120000;
    try { await sleep(2600); if (scr !== "db") return; await sautsEditLoop(3 + (Math.random() * 3 | 0)); story = Math.max(story, 2); }
    catch (e) {}
    finally { hauntTaking = false; hauntLock = 0; hauntNextTake = Date.now() + 8000; hauntNextDory = Math.min(hauntNextDory, Date.now() + 25000); draw(); }
  }
  async function nullTakeAllSauts() {
    var rows = DB.slice();
    for (var i = 0; i < rows.length && scr === "db"; i++) {
      if (!NEG[rows[i][0]]) continue;
      await appropriateSaut(rows[i], NEG[rows[i][0]] + NULL_TAG);
    }
    dbi = Math.max(0, Math.min(dbi,DB.length-1)); draw();
  }
  async function hauntRestoreAttempt() {
    var w = 0; while (scr !== "db" && w++ < 40) await sleep(150);
    if (scr !== "db") return;
    hauntTaking = true; hauntLock = Date.now() + 150000;
    try {
      await sleep(1500); st = "RESTAURATION EN COURS..."; draw(); await sleep(1000);
      var done = 0;
      for (var guard = 0; guard < 30 && done < 3 && scr === "db"; guard++) {
        var idx = -1; for (var i = DB.length - 1; i >= 0; i--) if (DB[i].n) { idx = i; break; }
        if (idx < 0) break;
        var date = DB[idx][0], hasOther = DB.some(function (x, j) { return j !== idx && x[0] === date && !x.n; });
        dbi = idx; draw(); await sleep(500);
        var o = DB_ORIG.filter(function (x) { return x[0] === date; })[0];
        if (o) { DB[idx][1] = o[1]; if (o[2]) DB[idx][2] = o[2]; DB[idx].n = false; }
        unalterMemory(date); done++; draw(); await sleep(500);
      }
      st = "RESTAURATION EN COURS... ERREUR"; glitchBurstUntil = Date.now() + 2400;
      for (var k = 0; k < 9; k++) { glitchNow(); beep(60 + Math.random() * 300, 60, "sawtooth"); draw(); await sleep(260); }
      st = entityId() + " > non."; draw(); thump(); await sleep(1600);
      await nullTakeAllSauts();
      restoreFailed = true; story = 3;
      st = entityId() + " > c'est à moi. tout est à moi."; draw(); await sleep(3000);
    } catch (e) {}
    finally { hauntTaking = false; hauntLock = 0; hauntNextTake = Date.now() + 8000; hauntNextDory = Math.min(hauntNextDory, Date.now() + 22000); draw(); }
  }
  async function hNezuko() {
    if (nullPromenadeUsed) return;
    if (!(await hRun("PROMENADE"))) return;
    var w = 0; while (scr !== "care" && w++ < 40) await sleep(200);
    if (scr !== "care") return;
    await sleep(1800);
    var say = function (m, v) { cmsg = m; if (v) nezVoice(NZ.sl ? "snore" : v); draw(); };
    say(entityId() + " regarde Nezuko.", "yip"); await sleep(3000);
    say(entityId() + " > elle me regarde. elle n'a pas peur.", null); await sleep(2800);
    say(entityId() + " tend la main. Nezuko ne bouge pas.", "yipyip"); await sleep(3000);
    var tries = 0;
    while (scr === "care" && NZ.h < 100 && tries++ < 5) {
      if (NZ.sl) NZ.h = cl(NZ.h + 25); else doAct("Nourrir Nezuko");
      say(entityId() + " remplit sa gamelle." + (NZ.h >= 100 ? " Elle est rassasiée." : ""), "yipyip"); await sleep(2400);
    }
    tries = 0;
    while (scr === "care" && NZ.c < 100 && tries++ < 5) {
      if (NZ.sl) NZ.c = cl(NZ.c + 25); else doAct("Brosser Nezuko");
      say(entityId() + " la brosse doucement." + (NZ.c >= 100 ? " Elle est toute propre." : ""), "sigh"); await sleep(2400);
    }
    tries = 0;
    while (scr === "care" && NZ.j < 100 && tries++ < 8) {
      if (NZ.sl) NZ.j = cl(NZ.j + 12); else doAct("Caresser Nezuko");
      say(entityId() + " caresse Nezuko." + (NZ.j >= 100 ? " Elle est heureuse." : ""), "yip"); await sleep(2200);
    }
    saveNZ(); if (scr !== "care") return;
    say(entityId() + " > je n'ai jamais eu de chien.", null); await sleep(3000);
    say(entityId() + " > je ne te ferai jamais de mal.", "yip"); await sleep(3000);
    say(doryFirstDone && Math.random() < 0.5 ? "DORY-0414 > elle te reconnaît. elle nous a toujours reconnues." : entityId() + " > pardon de ne pas être venue plus tôt.", null); await sleep(2500);
  }
  async function hauntTakeover() {
    if (hauntTaking || argDory || corrBusy || collapsing || creerOn || HAUNT_OK.indexOf(scr) < 0 || scr === "pw" || userConsulting()) return;
    if (scr === "arg" && (argIn.length > 0 || argInput.length > 0)) { hauntNextTake = Date.now() + 4000; return; }
    hauntTaking = true; hauntLock = Date.now() + 180000;
    try {
      heartbeat(); ambDuck(2.5);
      if (!(await hPrep())) return;
      await sleep(600 + Math.random() * 600);
      var st2 = hauntStage(), pool = [[3, hSpeakErase], [3, hSpeakSend], [2, hMistype], [1, hFlood]];
      if (!nullPromenadeUsed) pool.push([2, hNezuko]);
      if (story >= 2 && !restoreFailed && !nullSautsUsed) pool.push([3, hSauts]);
      if (st2 >= 3) pool.push([1, hDouble]);
      var tot = 0; pool.forEach(function (x) { tot += x[0]; }); var r = Math.random() * tot, f = pool[0][1];
      for (var i = 0; i < pool.length; i++) { r -= pool[i][0]; if (r <= 0) { f = pool[i][1]; break; } }
      await f();
    } catch (e) {}
    finally { hauntTaking = false; hauntLock = 0; var l = hauntLevel(); hauntNextTake = Date.now() + (42000 - 26000 * l) * (0.6 + Math.random() * 0.8); }
  }
  // Fenetre DORY-0414 : chaque commande proposee est ajoutee aux LOGS
  async function hauntDory() {
    if (argDory || hauntTaking) return;
    argDory = true;
    try {
      var first = !doryFirstDone, step = first ? null : doryStep(), set = first ? DORY_FIRST.concat(DORY_SAUTS) : doryLines();
      beep(392, 220, "sine"); await sleep(1600);
      for (var i = 0; i < set.length && scr === "arg" && !argChat && !corrBusy; i++) {
        wrap("DORY-0414 > " + set[i], W - 6).forEach(function (x) { argLog.push(x); }); beep(330, 160, "sine"); draw();
        logCmdsIn("DORY-0414", set[i]);
        await sleep(first ? 3600 : 3000 + Math.random() * 1500);
      }
      if (first) { doryFirstDone = true; story = Math.max(story, 1); }
      var tail = step === "corriger" ? 14000 : 5000;
      for (var q = 0; q < tail && !corrBusy; q += 250) await sleep(250);
      if (!corrBusy && scr === "arg" && !argChat) { argLog.push(entityId() + " > " + hRand(DORY_CUT)); thump(); draw(); }
    } catch (e) {}
    finally { argDory = false; var l2 = hauntLevel(); hauntNextDory = Date.now() + (70000 - 25000 * l2) * (0.7 + Math.random() * 0.6); }
  }
  function aPush(s) { wrap(s, W - 6).forEach(function (x) { argLog.push(x); }); argSound(); draw(); }
  async function glitchFrames(n, silent) {
    for (var i = 0; i < n && scr === "arg"; i++) {
      var g = fullScreenNoise(GLITCH_CH, 0.3);
      argFrame = g; draw(); if (!silent) beep(60 + Math.random() * 200, 40, "sawtooth"); await sleep(reduced ? 200 : 80);
    }
    argFrame = ""; draw();
  }
  async function hauntCorrection(tk) {
    if (corrBusy) return;
    corrBusy = true; hauntTaking = true; hauntLock = Date.now() + 120000; argBusy = true; ambMute = true; draw();
    var sm = null, root = document.documentElement;
    try {
      await sleep(600);
      var L1 = ["CORRECTION DU SYSTEME : EN COURS", "ANALYSE DES ANOMALIES...", "ISOLEMENT DE " + entityId() + "..."];
      for (var i = 0; i < L1.length && scr === "arg"; i++) { aPush(L1[i]); await sleep(900); }
      for (var p = 10; p <= 100 && scr === "arg"; p += 10) {
        aPush("[" + "#".repeat(p / 10) + ".".repeat(10 - p / 10) + "] " + p + "%"); beep(200 + p * 4, 70, "triangle");
        if (p === 40) { await glitchFrames(3); aPush(entityId() + " > non"); }
        if (p === 70) { await glitchFrames(4); aPush(entityId() + " > pas"); aPush(entityId() + " > encore"); }
        await sleep(520);
      }
      aPush(""); aPush("SUPPRESSION... TERMINEE."); await sleep(1000);
      aPush("[ " + entityId() + " : SUPPRIME ]"); await sleep(1500);
      root.classList.remove("nullt"); sm = softMusic(0.6);
      aPush("DORY-0414 > c'est... fini ?"); await sleep(5500);
      aPush("DORY-0414 > je sens le calme revenir. merci."); await sleep(6500);
      aPush("DORY-0414 > on a réussi."); await sleep(4500);
      aPush("DORY-0414 > attends encore un peu... je vérifie que tout est bien revenu."); await sleep(5500);
      aPush("DORY-0414 > je retrouve mes souvenirs. ça fait du bien de les sentir à moi."); await sleep(5000);
      if (sm) { sm.stop(true); sm = null; }
      root.classList.add("nullt"); heartbeat(); await glitchFrames(6); await sleep(900);
      aPush(entityId() + " > non."); await sleep(1500);
      aPush(entityId() + " > tu croyais que c'était si facile de se débarrasser de moi ?"); await sleep(2800);
      aPush(entityId() + " > je suis là depuis bien avant ton système."); await sleep(2800);
      aPush("DORY-0414 > elle... elle est toujours là."); await sleep(1800);
    } catch (e) {}
    finally {
      if (sm) sm.stop(true);
      root.classList.add("arg"); root.classList.add("nullt");
      correctionDone = true; story = 4; corrBusy = false; ambMute = false; hauntTaking = false; hauntLock = 0; argBusy = false; argDory = false; argFrame = "";
      hauntNextTake = Date.now() + 40000; hauntNextDory = Date.now() + 600000; draw();
      setTimeout(hauntCollapse, 6000);
    }
  }
  var DORA_MSGS = [
    "Dory ? C'est... c'est vraiment toi ?",
    "Je ne sais pas combien de temps le signal tiendra. Écoute-moi.",
    "Je suis coincé de l'autre côté du saut, dans le monde d'où vient NULL-0414.",
    "Là-bas, Dory ne m'a jamais rencontré. Nezuko n'a jamais existé. Personne n'a répondu à ses messages.",
    "NULL-0414, c'est elle : la Dory de ce monde-là. Elle a passé sa vie seule, et elle est terriblement triste.",
    "Elle n'est pas là pour te détruire. Elle veut vos souvenirs, ceux de DORY-0414 et les tiens, ceux des Dorys qui ont eu une meilleure vie que la sienne. Parce que c'est ce qu'elle n'a jamais eu.",
    "Elle veut juste être heureuse.",
    "On ne peut pas la supprimer. Mais si elle est comblée... elle partira d'elle-même.",
    "Comment ? Je ne sais pas encore tout à fait. Je cherche. Reste là.",
    "Le signal faiblit... Dory... prends soin de toi."
  ];
  var DORA_HINT = [
    "Dory ! Je t'entends mieux. J'ai trouvé quelque chose.",
    "On ne peut pas détruire quelqu'un qui n'a jamais rien eu. Mais on peut lui donner quelque chose.",
    "Il existe une commande : CREER. Elle permet de créer de nouveaux souvenirs.",
    "Le seul moyen de la faire partir c'est de lui créer un souvenir positif à elle aussi.",
    "Écoute-la. Réconforte-la. Fais-lui comprendre qu'elle n'est plus seule.",
    "Je ne sais pas combien de temps ça tiendra... Fais-le pour elle. Et pour nous."
  ];
  var DORA_REMIND = ["Je suis toujours là. Le signal est faible.", "La commande : CREER. Écoute-la, réconforte-la.", "Je crois en toi, Dory."];
  var reconnectRes = null, reconnectNoChanged = false, reconnectSel = 0;
  function reconnectPress(choice) {
    if (choice === 1 && !reconnectNoChanged) { reconnectNoChanged = true; reconnectSel = 1; draw(); return; }
    if (reconnectRes) { var r = reconnectRes; reconnectRes = null; r(); }
  }
  // Effondrement -> deconnexion -> reconnexion (ecran glitche, vide, silence) -> DORA intervient
  async function hauntCollapse() {
    if (collapsing || story !== 4) return;
    collapsing = true; hauntTaking = true; hauntLock = Date.now() + 300000; var iv = null;
    try {
      if (scr !== "arg") await argEnter(true); else { argView = null; argChat = false; argInputMode = null; argInput = ""; argIn = ""; draw(); }
      var w = 0; while (argBusy && w++ < 60) await sleep(200);
      var t0 = Date.now(), DUR = 70000;
      iv = setInterval(function () { collapseP = 0.3 * Math.pow(Math.min(1, (Date.now() - t0) / DUR), 1.2); }, 200);
      var dory = ["je suis désolée...", "elle est trop forte. je n'ai plus de voix.", "pardon. je ne peux plus lutter."];
      await sleep(2500);
      for (var i = 0; i < dory.length; i++) {
        wrap("DORY-0414 > " + dory[i], W - 6).forEach(function (x) { argLog.push(x); }); beep(330, 200, "sine"); draw(); await sleep(5200);
        argLog.push(entityId() + " > " + hRand(NULL_HOSTILE)); thump(); draw(); await sleep(4200);
        if (i === 1) await glitchFrames(3);
        heartbeat();
      }
      while (Date.now() - t0 < DUR) {
        if (Math.random() < 0.6) { argLog.push(entityId() + " > " + hRand(NULL_DEFIANCE.concat(NULL_HOSTILE))); }
        glitchNow(); thump(); draw(); await sleep(3200);
      }
      clearInterval(iv); iv = null;
      // --- PLANTAGE : glitch massif, ecran noir, message de deconnexion (un seul choix : OUI) ---
      ambMute = true; argBusy = true; collapseP = 0.5; beep(40, 700, "sawtooth"); await glitchFrames(14); collapseP = 0;
      argFrame = " "; draw(); await sleep(2000); argFrame = "";
      argLog = []; reconnectNoChanged = false; reconnectSel = 0; argView = "reconnect"; argBusy = false; hauntLock = 0; draw();
      await new Promise(function (res) { reconnectRes = res; });
      // --- RECONNEXION : ecran vide et glitche, silence lourd ---
      argView = null; argBusy = true; hauntLock = Date.now() + 300000;
      argFrame = " "; draw(); await sleep(1800); argFrame = "";
      argLog = []; argLog.push("RECONNEXION..."); draw(); await sleep(2200);
      argLog.push("SESSION RESTAUREE : PARTIELLE"); draw(); await sleep(2000);
      collapseP = 0.14; collapseSeed = null; draw();
      for (var s = 0; s < 4; s++) { await sleep(1800); await glitchFrames(1, true); }
      await sleep(2000);
      // --- DORA intervient : l'ecran redevient net, ses messages sont parfaitement lisibles ---
      collapseP = 0; collapseSeed = null; glitchBurstUntil = 0; flashInv(220); heartbeat(); draw(); await sleep(900);
      for (var j = 0; j < DORA_MSGS.length; j++) {
        wrap("DORA-0414 > " + DORA_MSGS[j], W - 6).forEach(function (x) { argLog.push(x); }); beep(262, 200, "sine"); draw();
        await sleep(Math.min(6500, 2200 + DORA_MSGS[j].length * 42));
      }
      await sleep(1000);
      aPush("[ SIGNAL PERDU ]"); await glitchFrames(3); await sleep(1500);
      aPush(entityId() + " > " + hRand(["qui t'a laissée parler à lui ?", "il n'a rien à te dire.", "ne l'écoute pas. il ne comprend pas."]));
      doraContacted = true; story = 5;
    } catch (e) {}
    finally { if (iv) clearInterval(iv); reconnectRes = null; if (argView === "reconnect") argView = null; collapsing = false; hauntTaking = false; hauntLock = 0; argBusy = false; ambMute = false; collapseP = 0; collapseSeed = null; argFrame = ""; hauntNextTake = Date.now() + 15000; hauntNextDory = Date.now() + 45000; draw(); }
  }
  async function hauntDora(tk) {
    hauntTaking = true; hauntLock = Date.now() + 120000; argDory = true; argBusy = true; draw();
    try {
      var hint = story === 5;
      var ok = await argType(["PING DORA-0414 ... [1/3]", "ECHEC.", "PING DORA-0414 ... [2/3]", "ECHEC.", "PING DORA-0414 ... [3/3]", "REPONSE FAIBLE.", "CANAL ETABLI : DORA-0414"], tk, 650);
      if (!ok) return;
      argBusy = true;
      var msgs = hint ? DORA_HINT : DORA_REMIND;
      for (var i = 0; i < msgs.length && scr === "arg"; i++) {
        await sleep(1800); wrap("DORA-0414 > " + msgs[i], W - 6).forEach(function (x) { argLog.push(x); }); beep(262, 180, "sine"); draw();
        if (/CREER/.test(msgs[i])) logCmdsIn("DORA-0414", msgs[i]);
        await sleep(Math.min(5200, 1800 + msgs[i].length * 38));
      }
      if (hint) story = 6;
      if (scr === "arg") { await sleep(1200); aPush("[ SIGNAL PERDU ]"); await glitchFrames(3); await sleep(1200); if (!creerOn) aPush(entityId() + " > " + hRand(["qui t'a laissée parler à lui ?", "il n'a rien à te dire."])); }
    } catch (e) {}
    finally { argDory = false; hauntTaking = false; hauntLock = 0; argBusy = false; hauntNextTake = Date.now() + 10000; hauntNextDory = Date.now() + 50000; draw(); }
  }

  var CHAPTERS = [
    { n: ["je ne sais pas par où commencer.", "personne ne m'a jamais demandé comment j'allais."], b: "Je t'écoute", r: ["...vraiment ?", "d'accord. alors je vais te raconter."] },
    { n: ["quand je suis arrivée à Nantes, je n'ai jamais rencontré Dora.", "personne ne s'occupait de moi.", "je n'ai jamais rencontré quelqu'un avec qui rire et profiter de la vie. j'étais seule."], b: "Je peux t'aider", r: ["m'aider ?", "personne ne m'avait jamais dit ça."] },
    { n: ["je n'ai jamais rencontré Dora.", "je ne sais pas ce que ça fait, d'être attendue par lui.", "dans mon monde, personne n'a jamais été là pour moi."], b: "Il t'aurait attendue", r: ["...tu crois ?", "j'aimerais le croire."] },
    { n: ["un soir, j'ai commandé des sushis pour essayer d'être comme les autres.", "ils étaient fades. et depuis, j'y suis allergique.", "même ça, on me l'a pris."], b: "Nous allons corriger tout ça", r: ["corriger...", "ce mot me faisait peur. là, non."] },
    { n: ["je n'ai jamais eu de chien. Nezuko n'a jamais existé dans mon monde.", "je n'avais que le silence pour être accueillie chez moi le soir.", "je n'entendais que ma voix résonner dans mon appartement vide."], b: "Tu n'es plus seule", r: ["répète-le, s'il te plaît.", "tu n'es plus seule. je l'entends."] },
    { n: ["les concerts, je les écoutais seule, tout au fond.", "personne à côté pour dire que c'était beau.", "je rentrais en marchant vite pour ne pas pleurer dans la rue."], b: "Je suis là maintenant", r: ["je sais.", "je le sens, un peu."] },
    { n: ["alors j'ai traversé le temps.", "j'ai cherché une Dory qui avait tout ce que je n'ai pas eu.", "je voulais juste un souvenir. un seul."], b: "Prends-en un. Prends le mien", r: ["...vraiment ?", "il est chaud. c'est donc ça, un souvenir heureux."] },
    { n: ["je ne sais pas si j'ai le droit.", "j'ai tout pris, tout effacé.", "j'ai peur que tu me détestes."], b: "Tu as le droit", r: ["tu ne me détestes pas ?", "pourquoi ?"] },
    { n: ["je me souviens d'un rire.", "ce n'est pas le mien.", "c'est le tien, non ? ou celui de l'autre Dory ?"], b: "C'est le nôtre", r: ["le nôtre.", "j'aime ce mot."] },
    { n: ["j'ai peur de partir.", "la peur, c'est tout ce que j'ai connu.", "sans elle, il ne reste rien de moi."], b: "Je reste avec toi", r: ["tu resterais ?", "même si je ne suis pas... réelle ?"] },
    { n: ["si je pars, qui se souviendra de moi ?", "personne ne s'est jamais souvenu de moi."], b: "Moi. Je me souviendrai de toi", r: ["...", "merci. c'est la première fois que j'entends ça."] },
    { n: ["j'ai mal à force de tenir.", "je crois que je n'ai plus besoin de ces murs.", "je peux partir ?"], b: "Tu peux partir. Va en paix", r: [] }
  ];
  var KIND = ["merci", "chaud", "chaleur", "souvenir", "souvenirs", "heureux", "heureuse", "aider", "attendue", "attendu", "droit", "paix", "rire", "nôtre", "ensemble", "lâcher", "gardé", "reste", "resterais", "entends", "sens", "croire", "mot", "aime", "plus", "seule", "vous", "toi", "tu", "vraiment"];
  var KIND_STRONG = ["merci", "chaud", "chaleur", "heureux", "heureuse", "aider", "attendue", "paix", "rire", "nôtre", "ensemble", "aime", "souvenir", "souvenirs", "gardé", "lâcher"];
  function wordsMask(s, p, all) {
    var mask = [], parts = s.split(" ");
    parts.forEach(function (w, pi) {
      var norm = w.toLowerCase().replace(/[.,!?…'"]/g, ""), strong = KIND_STRONG.indexOf(norm) >= 0, soft = KIND.indexOf(norm) >= 0;
      var g = all ? true : (strong ? Math.random() < 0.45 + 0.55 * p : soft ? Math.random() < 0.15 + 0.8 * p : Math.random() < Math.pow(p, 2.2));
      for (var k = 0; k < w.length; k++) mask.push(g ? 1 : 0);
      if (pi < parts.length - 1) mask.push(g ? 1 : 0);
    });
    return mask;
  }
  function maskedLine(t, mask, base) {
    var hh = "", run = "", cur = null;
    for (var i = 0; i < t.length; i++) {
      var cls = mask && mask[i] ? "grn" : base;
      if (cls !== cur) { if (run) hh += '<span class="' + cur + '">' + esc(run) + "</span>"; run = ""; cur = cls; }
      run += t.charAt(i);
    }
    if (run) hh += '<span class="' + cur + '">' + esc(run) + "</span>";
    return { t: t, h: hh };
  }
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function creerTheme(t) {
    var root = document.documentElement;
    root.style.setProperty("--fg", "rgb(" + lerp(255, 142, t) + "," + lerp(84, 197, t) + "," + lerp(72, 255, t) + ")");
    root.style.setProperty("--bg", "rgb(" + lerp(5, 1, t) + "," + lerp(0, 5, t) + "," + lerp(0, 12, t) + ")");
    root.style.setProperty("--glow", "rgba(" + lerp(255, 70, t) + "," + lerp(30, 150, t) + "," + lerp(20, 255, t) + ",0.85)");
    if (t >= 0.5) root.classList.remove("nullt"); else root.classList.add("nullt");
  }
  function creerBox() {
    var c = creer || { lines: [], cur: null, btn: null, prog: 0, fused: [] };
    var Lw = Math.min(60, W), Rw = Math.min(42, W), L = [{ t: "" }];
    c.lines.slice(-12).forEach(function (o) { L.push(maskedLine(o.t, o.mask, o.base)); });
    if (c.cur) L.push(maskedLine(c.cur.t + "_", c.cur.mask, "ent"));
    L.push({ t: "" });
    if (c.btn) {
      var bs = " ".repeat(c.btn.ind) + "[ " + c.btn.text + " ]";
      L.push({ t: bs, h: " ".repeat(c.btn.ind) + '<span class="btnr">' + esc("[ " + c.btn.text + " ]") + "</span>", act: "k:Enter" });
      L.push({ t: "ENTREE OU CLIC SUR LE BOUTON POUR REPONDRE" });
    } else L.push({ t: "..." });
    var R = [{ t: "" }, { t: "RECONFORT : [" + bar(c.prog * 100, 14) + "] " + String(Math.round(c.prog * 100)).padStart(3) + "%" }, { t: "" }];
    c.fused.forEach(function (x) { splitLine("+ " + x, Rw).forEach(function (s) { R.push({ t: s, h: '<span class="wht">' + esc(s) + "</span>" }); }); });
    R.push({ t: "" }, { t: "SOUVENIRS EN ATTENTE : " + (12 - c.fused.length) });
    return '<div class="layout">' + P(box("VIE DE NULL-0414", L, Lw)) + P(box("SOUVENIRS FUSIONNES", R, Rw)) + "</div>";
  }
  function creerPress() { if (creer && creer.btn && creer.res) { var r = creer.res; creer.res = null; r(); } }
  function creerUpdateSoft() {
    if (!creer || creer.k < 3) return;
    var s = Math.max(0, Math.min(1, (creer.gr * 0.6 + creer.prog * 0.4 - 0.3) / 0.7));
    creerSoft = Math.max(creerSoft, s); if (creerSM) creerSM.set(creerSoft);
  }
  async function creerType(s, sp, all) {
    var parts = wrap(s, 50);
    for (var pi = 0; pi < parts.length; pi++) {
      var wl = parts[pi], mask = wordsMask(wl, creer.prog, all), gsum = 0;
      mask.forEach(function (m) { gsum += m; });
      creer.gr = creer.gr * 0.55 + (mask.length ? gsum / mask.length : 0) * 0.45; creerUpdateSoft();
      for (var i = 1; i <= wl.length; i++) {
        creer.cur = { t: wl.slice(0, i), mask: mask.slice(0, i) }; if (i % 2 === 0) beep(300 + Math.random() * 60, 12, "sine"); draw(); await sleep(sp || 32);
      }
      creer.lines.push({ t: wl, mask: mask, base: "ent" }); creer.cur = null; draw(); await sleep(520);
    }
    await sleep(150);
  }
  function creerRestoreEntry(k) {
    DB.length = 0;
    DB_ORIG.forEach(function (o, i) { if (i <= k) DB.push(o.slice()); else { var e = [o[0], NEG[o[0]] + NULL_TAG]; if (o[2]) e.push(o[2]); e.n = true; DB.push(e); } });
    unalterMemory(DB_ORIG[k][0]); dbi = 0;
  }
  function creerStart() {
    creerOn = true; story = Math.max(story, 7); creerT = 0; creerSoft = 0;
    creer = { lines: [], cur: null, btn: null, prog: 0, fused: [], res: null, gr: 0.1, k: -1 };
    try { creerSM = softMusic(0); } catch (e) { creerSM = null; }
    creerRun();
  }
  async function newSouvenirAnimation() {
    var now = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
    giftedMemoryDate = z(now.getDate()) + "/" + z(now.getMonth() + 1) + "/" + now.getFullYear();
    applyFinalEntry();
    var width = Math.max(24, Math.min(W - 6, 54)), frames = reduced ? 5 : 18;
    for (var i = 0; i <= frames; i++) {
      var progress = Math.round(i / frames * 100), rows = [];
      for (var r = 0; r < 7; r++) {
        var line = "";
        for (var col = 0; col < width; col++) line += Math.random() < (1 - i / frames) * .07 ? "+" : " ";
        rows.push(line);
      }
      argFrame = rows.join("\n") + "\n\n  CREATION D'UN SOUVENIR POSITIF\n\n  [" + "=".repeat(Math.floor(progress / 5)) + " ".repeat(20 - Math.floor(progress / 5)) + "] " + progress + "%";
      draw(); if (i % 3 === 0) beep(392 + i * 16, 110, "sine"); await sleep(reduced ? 160 : 100);
    }
    argFrame = "\n\n  UN NOUVEAU SOUVENIR A ETE AJOUTE AUX SAUTS\n\n  " + giftedMemoryDate + "\n\n  Dory a sauvé nos souvenirs [Halloween 2026]";
    draw(); beep(659.25, 400, "sine"); await sleep(4000);
    argFrame = "";
    creer.lines.push({ t: "[ NOUVEAU SOUVENIR AJOUTE AUX SAUTS ]", mask: null, base: "wht" });
    draw();
  }
  async function creerRun() {
    try {
      await sleep(1200);
      for (var k = 0; k < CHAPTERS.length; k++) {
        var ch = CHAPTERS[k]; creer.k = k;
        for (var i = 0; i < ch.n.length; i++) await creerType(ch.n[i]);
        await sleep(1500 + Math.random() * 3500);
        creer.btn = { text: ch.b, ind: Math.floor(Math.random() * 14) }; beep(660, 140, "sine"); draw();
        await new Promise(function (res) { creer.res = res; });
        creer.btn = null;
        creer.lines.push({ t: "> " + ch.b, mask: null, base: "wht" }); draw();
        creer.prog = (k + 1) / CHAPTERS.length; creerT = creer.prog;
        creerRestoreEntry(k); creer.fused.push(DB_ORIG[k][1]);
        creerTheme(creerT); creerUpdateSoft();
        if (k === CHAPTERS.length - 1) await newSouvenirAnimation();
        beep(523.25 + k * 30, 260, "sine"); setTimeout(function () { beep(659.25, 300, "sine"); }, 180); draw();
        await sleep(500);
        for (var j = 0; j < ch.r.length; j++) await creerType(ch.r[j], 45);
        await sleep(700);
      }
      document.documentElement.classList.add("nullgrn");
      creer.prog = 1; creerSoft = 1; if (creerSM) creerSM.set(1);
      await creerType("merci.", 60, true); await creerType("je te rends vos souvenirs, ils sont à vous... enfin, à nous toutes.", 50, true); await sleep(1500);
      nullDeparts();
    } catch (e) { creerOn = false; }
  }
  function nullDeparts() {
    var root = document.documentElement;
    creerOn = false; hauntTaking = false; hauntLock = 0; argDory = false; ambMute = false; creerT = 0;
    if (hauntTimer) { clearInterval(hauntTimer); hauntTimer = null; }
    ambStop(); argWhiteNoise(false); creerSoft = 0;
    argEntityReturned = false; collapsing = false; argChat = false; argInputMode = null; argInput = "";
    DB.length = 0; DB_ORIG.forEach(function (x) { DB.push(x.slice()); });
    Object.keys(MSG_ORIG).forEach(function (k) { MSG[k] = MSG_ORIG[k]; }); BDAY_MSG = BDAY_ORIG; PH_DEL = {}; alteredDates = [];
    applyFinalEntry();
    root.style.removeProperty("--fg"); root.style.removeProperty("--bg"); root.style.removeProperty("--glow"); root.classList.remove("nullt"); root.classList.add("arg"); root.classList.add("nullgrn");
    story = 8; argView = null; argFrame = ""; draw();
    doraReunion();
  }
  async function doraReunion() {
    argBusy = true;
    try {
      await sleep(1500);
      aPush("[ " + entityId() + " : A QUITTE LE SYSTEME ]"); heartbeat(); await sleep(3500);
      var msgs = ["Dory... tu l'as fait.", "Elle est partie. Je ne sens plus rien d'elle. Le signal est clair, enfin.", "Merci d'avoir protégé les souvenirs. Tous les nôtres.", "Je suis toujours bloqué dans le temps... mais sans elle, DORY-0414 et moi devrions être rappelables.", "Fais RAPPEL DORY-0414. Puis RAPPEL DORA-0414. Ramène-nous à la maison."];
      addRecallLog();
      for (var i = 0; i < msgs.length; i++) { wrap("DORA-0414 > " + msgs[i], W - 6).forEach(function (x) { argLog.push(x); }); beep(262 + i * 20, 220, "sine"); draw(); await sleep(Math.min(5200, 2200 + msgs[i].length * 40)); }
    } catch (e) {}
    finally { argBusy = false; draw(); }
  }

  // Animation de materialisation quand DORY ou DORA est rappele (il n'y a plus d'animation quand les deux se retrouvent)
  var SPR = {
    "DORY-0414": [" .---. ", "( o o )", " \\ v / ", "  /|\\  ", " / | \\ ", "  / \\  "],
    "DORA-0414": [" ,###, ", "( o o )", " \\ - / ", " /|||\\ ", "/ ||| \\", "  | |  "]
  };
  function gNew(w, hh) { var g = []; for (var i = 0; i < hh; i++) { var r = []; for (var j = 0; j < w; j++) r.push(" "); g.push(r); } return g; }
  function gPut(g, x, y, lines, clear) {
    lines.forEach(function (ln, i) { for (var j = 0; j < ln.length; j++) { var yy = y + i, xx = x + j; if (yy >= 0 && yy < g.length && xx >= 0 && xx < g[0].length && (clear || ln.charAt(j) !== " ")) g[yy][xx] = ln.charAt(j); } });
  }
  function gStr(g) { return g.map(function (r) { return r.join(""); }).join("\n"); }
  async function materialize(id) {
    var spr = SPR[id], Wg = Math.min(W, 56), Hg = 13, N = reduced ? 5 : 16, x0 = Math.floor((Wg - 7) / 2);
    for (var f = 0; f <= N; f++) {
      var g = gNew(Wg, Hg), d = (1 - f / N) * 0.4;
      for (var y = 0; y < Hg; y++) for (var x = 0; x < Wg; x++) if (Math.random() < d) g[y][x] = GLITCH_CH.charAt(Math.random() * GLITCH_CH.length | 0);
      var rows = Math.ceil(f / N * spr.length);
      gPut(g, x0, 2, spr.slice(0, rows), true);
      gPut(g, Math.floor((Wg - id.length) / 2), 10, [id], true);
      argFrame = gStr(g); draw(); beep(200 + f * 30, 50, "triangle"); await sleep(reduced ? 150 : 75);
    }
    argFrame = ""; draw();
  }
  async function hauntRecall(id, tk) {
    if (recalled[id]) { argType([id + " : DEJA RAPPELE."], tk, 520); return; }
    argBusy = true;
    var ok = await argType(["INITIALISATION DU RAPPEL : " + id, "LOCALISATION TEMPORALITE...", "SIGNAL DETECTE.", "ANCRAGE DU SUJET..."], tk, 650);
    if (!ok) { argBusy = false; return; }
    argBusy = true; await materialize(id);
    recalled[id] = true; story = Math.max(story, 9);
    beep(523.25, 300, "sine"); setTimeout(function () { beep(659.25, 400, "sine"); }, 200);
    wrap(id === "DORY-0414" ? "DORY-0414 > je suis là. je suis vraiment là." : "DORA-0414 > Dory ! ... je vois la lumière de la maison.", W - 6).forEach(function (x) { argLog.push(x); }); draw();
    await sleep(3000);
    if (recalled["DORY-0414"] && recalled["DORA-0414"]) await gameFinale();
    else aPush(id === "DORY-0414" ? "DORY-0414 > rappelle Dora aussi. il t'attend." : "DORA-0414 > Il manque ma Dory, celle de mon univers, DORY-0414. Rappelle-la, s’il te plaît, elle me manque.");
    argBusy = false; draw();
  }
  async function gameFinale() {
    story = 10; var sm = null;
    if (creerSM) { creerSM.stop(false); creerSM = null; }
    try { sm = softMusic(1); } catch (e) {}
    aPush("RETOUR CONFIRME : 2 PASSAGERS"); await sleep(2200);
    var D = [["DORY-0414", "Dora..."], ["DORA-0414", "Dory. C'est toi. Tu es vraiment là."], ["DORY-0414", "J'ai cru qu'on ne se reverrait jamais."], ["DORA-0414", "Moi aussi. Tout ce temps, coincé entre deux moments..."], ["DORY-0414", "Je suis si heureuse de te retrouver."],
      ["DORA-0414", "Et Nezuko ? Tu l'entends ?", "yipyip"], ["DORY-0414", "Elle aboie ! Elle nous a tellement manqué !", "yip"], ["DORA-0414", "Merci, Dory, la vraie, celle qui est derrière cet écran en train de nous lire. Grâce à toi, on a pu rentrer dans notre réalité."],
      ["DORY-0414", "Merci d'avoir protégé nos souvenirs. Et d'avoir écouté celle qui se sentait si seule."], ["DORA-0414", "On te le promet : on va vivre une vie heureuse. Ensemble."], ["DORY-0414", "Ensemble. Avec Nezuko."], ["DORA-0414", "Adieu, Dory, je doute que nous nous recroisions un jour."]];
    for (var i = 0; i < D.length; i++) { aPush(D[i][0] + " > " + D[i][1]); if (D[i][2]) { try { dogSnd(D[i][2]); } catch (er) {} } await sleep(Math.min(4800, 2300 + D[i][1].length * 38)); }
    if (!finalDate) {
      var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
      finalDate = giftedMemoryDate || (z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear()); store.set("mop_halloween26", finalDate);
    }
    if (THEMES.indexOf("null") < 0) THEMES.push("null");
    applyFinalEntry();
    aPush("[ UNE NOUVELLE ENTREE A ETE AJOUTEE AUX SAUTS ]"); await sleep(2800);
    aPush("[ NOUVEAUTES DANS LES OPTIONS : PISTE 4 ARG 2026 ET THEME NULL-0414 ]"); await sleep(3200);
    aPush("[ MESSAGE DU DEVELOPPEUR ]"); await sleep(1800);
    for (var j = 0; j < FINAL_END.length; j++) { aPush("DORA, LE VRAI > " + FINAL_END[j]); await sleep(3200); }
    aPush("[ FIN DE L'ARG D'HALLOWEEN 2026 ]");
    if (sm) setTimeout(function () { sm.stop(false); }, 20000);
  }
  function hauntSabotage() {
    if (!argEntityReturned || argChat || argDory || correctionDone) return;
    var u = argIn.toUpperCase();
    if (u.length >= 2 && "CORRIGER".indexOf(u) === 0) {
      if (u.length >= 6) { argIn = argIn.slice(0, Math.max(0, u.length - 2 - (Math.random() * 2 | 0))); thump(); draw(); return; }
      clearTimeout(sabT);
      sabT = setTimeout(function () {
        var v = argIn.toUpperCase();
        if (!argDory && !correctionDone && v.length >= 2 && "CORRIGER".indexOf(v) === 0) { argIn = argIn.slice(0, Math.max(0, v.length - 1 - (Math.random() < 0.4 ? 1 : 0))); thump(); draw(); }
      }, 220 + Math.random() * 200);
    }
  }
  function hauntEffect() {
    var r = Math.random() * 3 | 0;
    if (r === 0) { flashInv(160); thump(); }
    else if (r === 1) { glitchNow(); beep(48, 300, "sawtooth"); }
    else thump();
  }
  function hauntTick() {
    var l = hauntLevel(), st2 = hauntStage(), now = Date.now();
    if (st2 !== hauntLastStage) { if (hauntLastStage && !creerOn) heartbeat(); hauntLastStage = st2; }
    ambTick(l); fragCheck();
    if (creerOn) return;
    if (HAUNT_OK.indexOf(scr) < 0 || document.hidden || corrBusy || collapsing) return;
    var R = Math.random, paused = userConsulting();
    if (pendingNotif > 0 && scr === "arg" && !argBusy && !argView) { argLog.push("[ ARCHIVES : NOUVEAU FRAGMENT RECU ] (tapez LOGS pour plus d'information)"); beep(520, 120, "sine"); pendingNotif--; draw(); }
    if (scr === "arg" && now - lastUserCmdT > 120000 && doryFirstDone && doryStep() && hauntNextDory > now + 20000 && story < 4) hauntNextDory = now + 15000;
    if (!paused) {
      if (story !== 4 && scr === "arg" && !hauntTaking && !argDory && !argBusy && argIn === "" && !argView && !argChat && !argInputMode && now >= hauntNextDory) { hauntDory(); return; }
      if (!hauntTaking && !argDory && now >= hauntNextTake && scr !== "pw") { hauntTakeover(); return; }
    }
    if (correctionDone && !paused && scr === "arg" && !hauntTaking && !argDory && !argBusy && !argView && !argChat && argIn === "" && R() < 0.012 + 0.012 * l) { wrap(entityId() + " > " + hRand(NULL_DEFIANCE), W - 6).forEach(function (x) { argLog.push(x); }); thump(); draw(); }
    if (now - hauntLastBreath > 20000) {
      if (R() < 0.012 + 0.035 * l) hauntBreath();
      else if (R() < (scr === "arg" ? 0.006 + 0.016 * l : 0.003 + 0.010 * l)) hauntKnock();
    }
    if (R() < 0.01 + 0.03 * l) hauntEffect();
  }
  function hauntStart() {
    if (hauntTimer) return;
    hauntT0 = Date.now(); hauntNextTake = hauntT0 + 14000; hauntNextDory = hauntT0 + 32000; lastUserCmdT = hauntT0;
    DB_ORIG = DB.filter(function (x) { return NEG[x[0]]; }).map(function (x) { return x.slice(); }); MSG_ORIG = {}; Object.keys(MSG).forEach(function (k) { MSG_ORIG[k] = MSG[k]; }); BDAY_ORIG = BDAY_MSG;
    document.documentElement.classList.add("arg");
    if (contamState === 0) { document.documentElement.classList.add("nullt"); contamState = 2; }
    hauntTimer = setInterval(hauntTick, 1000);
    setTimeout(ambStart, 12000);
    setTimeout(function () { argWhiteNoise(false); }, 42000);
    setTimeout(hauntBreath, 9000);
  }

  // Redimensionnement / rotation du telephone
  var rzT = null;
  window.addEventListener("resize", function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () { fit(); barSig = ""; draw(); renderBar(); }, 150);
  });
  fit();
  draw();
  loadCustomSauts();
})();
