/* Аудиогид: подготовка текста к озвучиванию и проигрыватель.
   Работает в браузере (глобальный объект Speech) и в Node (для проверки). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Speech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- числа словами ---------- */
  var ONES = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  var ONES_F = ONES.slice(); ONES_F[1] = 'одна'; ONES_F[2] = 'две';
  var TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  var HUND = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  var ORD_ONES = ['', 'первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый', 'десятый', 'одиннадцатый', 'двенадцатый', 'тринадцатый', 'четырнадцатый', 'пятнадцатый', 'шестнадцатый', 'семнадцатый', 'восемнадцатый', 'девятнадцатый'];
  var ORD_TENS = ['', '', 'двадцатый', 'тридцатый', 'сороковой', 'пятидесятый', 'шестидесятый', 'семидесятый', 'восьмидесятый', 'девяностый'];
  var ORD_HUND = ['', 'сотый', 'двухсотый', 'трёхсотый', 'четырёхсотый', 'пятисотый', 'шестисотый', 'семисотый', 'восьмисотый', 'девятисотый'];
  var ORD_THOU = ['', 'тысячный', 'двухтысячный', 'трёхтысячный', 'четырёхтысячный', 'пятитысячный', 'шеститысячный', 'семитысячный', 'восьмитысячный', 'девятитысячный'];

  function plural(n, f1, f2, f5) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f5;
    if (b > 1 && b < 5) return f2;
    if (b === 1) return f1;
    return f5;
  }
  function below1000(n, fem) {
    var w = [], h = Math.floor(n / 100), r = n % 100, ones = fem ? ONES_F : ONES;
    if (h) w.push(HUND[h]);
    if (r >= 20) { w.push(TENS[Math.floor(r / 10)]); if (r % 10) w.push(ones[r % 10]); }
    else if (r) w.push(ones[r]);
    return w;
  }
  function cardinal(n, fem) {
    n = Math.floor(n);
    if (n === 0) return 'ноль';
    var w = [];
    if (n >= 1000000) { var m = Math.floor(n / 1000000); w = w.concat(below1000(m, false)); w.push(plural(m, 'миллион', 'миллиона', 'миллионов')); n %= 1000000; }
    if (n >= 1000) {
      var t = Math.floor(n / 1000);
      if (t === 1) w.push('тысяча');
      else { w = w.concat(below1000(t, true)); w.push(plural(t, 'тысяча', 'тысячи', 'тысяч')); }
      n %= 1000;
    }
    if (n) w = w.concat(below1000(n, fem));
    return w.join(' ');
  }
  function ordinal(n) { // именительный падеж, мужской род, n от 1 до 9999
    var th = Math.floor(n / 1000), rest = n % 1000, h = Math.floor(rest / 100), r = rest % 100, pre = [], last;
    if (r > 0) {
      if (th) pre.push(cardinal(th * 1000));
      if (h) pre.push(HUND[h]);
      if (r < 20) last = ORD_ONES[r];
      else if (r % 10) { pre.push(TENS[Math.floor(r / 10)]); last = ORD_ONES[r % 10]; }
      else last = ORD_TENS[r / 10];
      return pre.concat([last]).join(' ');
    }
    if (h > 0) { if (th) pre.push(cardinal(th * 1000)); return pre.concat([ORD_HUND[h]]).join(' '); }
    return th < 10 ? ORD_THOU[th] : cardinal(th) + 'тысячный';
  }
  function decl(word, cs) {
    if (cs === 'nom' || cs === 'acc') return word;
    var parts = word.split(' '), last = parts.pop(), out;
    if (last === 'третий') out = { gen: 'третьего', dat: 'третьему', prep: 'третьем', prepPl: 'третьих', nomPl: 'третьи' }[cs];
    else out = last.slice(0, -2) + { gen: 'ого', dat: 'ому', prep: 'ом', prepPl: 'ых', nomPl: 'ые' }[cs];
    parts.push(out);
    return parts.join(' ');
  }
  var YEAR = { nom: 'год', acc: 'год', gen: 'года', dat: 'году', prep: 'году', nomPl: 'годы', prepPl: 'годах' };
  var CENT = { nom: 'век', acc: 'век', gen: 'века', dat: 'веку', prep: 'веке' };
  function yearPhrase(n, cs) { return decl(ordinal(n), cs) + ' ' + YEAR[cs]; }
  function roman(s) {
    var m = { I: 1, V: 5, X: 10, L: 50 }, t = 0, i, v, nx;
    for (i = 0; i < s.length; i++) { v = m[s[i]]; nx = m[s[i + 1]]; t += (nx && nx > v) ? -v : v; }
    return t;
  }
  function decimalWords(intPart, frac) {
    var n = parseInt(intPart, 10), f = parseInt(frac, 10);
    var d = frac.length === 1 ? ['десятая', 'десятых'] : frac.length === 2 ? ['сотая', 'сотых'] : ['тысячная', 'тысячных'];
    var left = cardinal(n, true) + ((n % 10 === 1 && n % 100 !== 11) ? ' целая' : ' целых');
    return left + ' ' + cardinal(f, true) + ' ' + ((f % 10 === 1 && f % 100 !== 11) ? d[0] : d[1]);
  }
  var UNITS = {
    'см': ['сантиметр', 'сантиметра', 'сантиметров'], 'мм': ['миллиметр', 'миллиметра', 'миллиметров'],
    'км': ['километр', 'километра', 'километров'], 'кг': ['килограмм', 'килограмма', 'килограммов'], 'м': ['метр', 'метра', 'метров']
  };

  /* ---------- правила подготовки текста ---------- */
  var PRE = '(^|[^А-Яа-яЁё\\d])';
  var NL = '(?![А-Яа-яЁё])';
  var PREP = '(в|В|во|Во|к|К|с|С|со|Со|от|От|до|До|после|После|около|Около|по|По|на|На|за|За)';
  var CASE_BY_PREP = { 'в': 'prep', 'во': 'prep', 'к': 'dat', 'с': 'gen', 'со': 'gen', 'от': 'gen', 'до': 'gen', 'после': 'gen', 'около': 'gen', 'по': 'acc', 'на': 'acc', 'за': 'acc' };
  var MONTHS = /(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/;

  var RULES = [
    // числа с пробелом-разделителем тысяч: «3 500» -> «3500»
    [/(^|[^\d])(\d{1,3}(?:[  ]\d{3})+)(?!\d)/g, function (m, pre, n) { return pre + n.replace(/[  ]/g, ''); }],
    // годы с диапазоном и словом «годах/гг.»
    [new RegExp(PRE + '(?:(в|В|во|Во)\\s+)?(\\d{3,4})\\s*[–—-]\\s*(\\d{3,4})\\s*(?:гг?\\.|годах|годы|годов)' + NL, 'g'), function (m, pre, prep, a, b) {
      a = +a; b = +b;
      if (prep) return pre + prep + ' ' + decl(ordinal(a), 'prep') + ' — ' + decl(ordinal(b), 'prep') + ' годах';
      return pre + ordinal(a) + ' — ' + ordinal(b) + ' годы';
    }],
    // диапазон лет без слова «год»
    [new RegExp(PRE + '(\\d{3,4})\\s*[–—-]\\s*(\\d{3,4})(?!\\d)', 'g'), function (m, pre, a, b) {
      a = +a; b = +b;
      if (a < 1000 || b > 2100 || a >= b) return m;
      return pre + 'с ' + yearPhrase(a, 'gen') + ' по ' + yearPhrase(b, 'nom');
    }],
    // год с предлогом
    [new RegExp(PRE + PREP + '\\s+(\\d{3,4})\\s*(?:г\\.|году|года|год)' + NL, 'g'), function (m, pre, prep, n) {
      return pre + prep + ' ' + yearPhrase(+n, CASE_BY_PREP[prep.toLowerCase()]);
    }],
    // год без предлога
    [new RegExp(PRE + '(\\d{3,4})\\s*(г\\.|году|года|годом|год)' + NL, 'g'), function (m, pre, n, w) {
      return pre + yearPhrase(+n, w === 'года' ? 'gen' : (w === 'году' ? 'prep' : 'nom'));
    }],
    // века
    [new RegExp(PRE + '(?:' + PREP + '\\s+)?([IVXL]+)\\s*(века|веке|веку|век|в\\.)' + NL, 'g'), function (m, pre, prep, rn, w) {
      var cs = w === 'века' ? 'gen' : w === 'веке' ? 'prep' : w === 'веку' ? 'dat' : w === 'век' ? 'nom' : (prep ? ({ prep: 'prep', dat: 'dat', gen: 'gen', acc: 'nom' }[CASE_BY_PREP[prep.toLowerCase()]]) : 'nom');
      return pre + (prep ? prep + ' ' : '') + decl(ordinal(roman(rn)), cs) + ' ' + CENT[cs];
    }],
    // размеры вида «79,5 × 79,5»
    [/(\d)\s*[×xх]\s*(\d)/g, '$1 на $2'],
    // проценты
    [new RegExp(PRE + '(\\d+)\\s*%', 'g'), function (m, pre, n) { n = +n; return pre + cardinal(n) + ' ' + plural(n, 'процент', 'процента', 'процентов'); }],
    // числа с единицами измерения
    [new RegExp(PRE + '(\\d+)(?:,(\\d+))?\\s*(мм|см|км|кг|м)' + NL, 'g'), function (m, pre, i, f, u) {
      var forms = UNITS[u];
      if (f) return pre + decimalWords(i, f) + ' ' + forms[1];
      var n = +i; return pre + cardinal(n) + ' ' + plural(n, forms[0], forms[1], forms[2]);
    }],
    // оставшиеся десятичные дроби
    [new RegExp(PRE + '(\\d+),(\\d+)(?!\\d)', 'g'), function (m, pre, i, f) { return pre + decimalWords(i, f); }],
    // сокращения
    [/(^|[^А-Яа-яЁё])т\.\s*е\./g, '$1то есть'],
    [/(^|[^А-Яа-яЁё])т\.\s*д\./g, '$1так далее'],
    [/(^|[^А-Яа-яЁё])т\.\s*п\./g, '$1тому подобное'],
    [/(^|[^А-Яа-яЁё])т\.\s*н\./g, '$1так называемый'],
    [/(^|[^А-Яа-яЁё])н\.\s*э\./g, '$1нашей эры'],
    [/(^|[^А-Яа-яЁё])и\s+др\./g, '$1и другие'],
    [/(^|[^А-Яа-яЁё])им\./g, '$1имени'],
    [/(^|[^А-Яа-яЁё])ул\./g, '$1улица'],
    [/(^|[^А-Яа-яЁё])пл\./g, '$1площадь'],
    [/(^|[^А-Яа-яЁё])просп\./g, '$1проспект'],
    [/(^|[^А-Яа-яЁё])наб\./g, '$1набережная'],
    [/(^|[^А-Яа-яЁё])св\./g, '$1святой'],
    [/(^|[^А-Яа-яЁё])ок\./g, '$1около'],
    [/(^|[^А-Яа-яЁё])напр\./g, '$1например'],
    [/(^|[^А-Яа-яЁё])тыс\./g, '$1тысяч'],
    [/(^|[^А-Яа-яЁё])млн(?![а-яё])/g, '$1миллионов'],
    [/(^|[^А-Яа-яЁё])млрд(?![а-яё])/g, '$1миллиардов'],
    [/(^|[^А-Яа-яЁё])г\.\s*(?=[А-ЯЁ])/g, '$1город '],
    [/№\s*/g, 'номер '],
    // целые числа
    [/(^|[^\d])(\d{1,9})(?!\d)/g, function (m, pre, n) { return pre + cardinal(+n); }]
  ];

  function tidy(s) {
    s = s.replace(/\[[^\]]*\]/g, '');
    s = s.replace(/\s*\(([^)]*)\)/g, function (m, inner) {
      if (/[A-Za-z]/.test(inner) || MONTHS.test(inner)) return '';
      return ', ' + inner.trim() + ',';
    });
    s = s.replace(/[«»"“”„]/g, '');
    s = s.replace(/\s[–—]\s(?=[^\d\s])/g, ', ');
    return s;
  }
  function cleanup(s) {
    return s.replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[,\s]+/, '').trim();
  }
  function prepare(text) {
    var s = tidy(String(text || ''));
    RULES.forEach(function (r) { s = s.replace(r[0], r[1]); });
    return cleanup(s);
  }

  /* ---------- деление на предложения ---------- */
  var ABBR = { 'т': 1, 'д': 1, 'е': 1, 'п': 1, 'н': 1, 'э': 1, 'г': 1, 'гг': 1, 'в': 1, 'вв': 1, 'им': 1, 'ул': 1, 'пл': 1, 'просп': 1, 'наб': 1, 'св': 1, 'др': 1, 'ок': 1, 'напр': 1, 'тыс': 1, 'рис': 1, 'стр': 1, 'ст': 1, 'гл': 1, 'р': 1, 'проф': 1, 'акад': 1 };
  function isAbbrevEnd(chunk) {
    var m = /(?:^|[\s(«"“])([A-Za-zА-Яа-яЁё]{1,6})\.$/.exec(chunk);
    if (!m) return false;
    var tok = m[1];
    if (tok.length === 1 && /[A-ZА-ЯЁ]/.test(tok)) return true;           // инициал
    var before = chunk.slice(0, chunk.length - tok.length - 1).replace(/\s+$/, '');
    if (/^(г|гг|в|вв)$/.test(tok) && /(\d|[IVXL])$/.test(before)) return false; // «1915 г.» — конец предложения
    return !!ABBR[tok.toLowerCase()];
  }
  function splitSentences(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    var re = /([.!?…]+)(["»”)]*)\s+(?=[«"“(А-ЯЁA-Z0-9])/g, m, last = 0, out = [];
    while ((m = re.exec(text))) {
      var end = m.index + m[1].length + m[2].length;
      var chunk = text.slice(last, end);
      if (m[1] === '.' && isAbbrevEnd(chunk)) continue;
      out.push(chunk.trim());
      last = re.lastIndex;
    }
    var rest = text.slice(last).trim();
    if (rest) out.push(rest);
    return out;
  }
  function chunkText(s, max) {
    if (s.length <= max) return [s];
    var toks = s.split(/([,;:])\s+/), out = [], cur = '', i, piece;
    for (i = 0; i < toks.length; i += 2) {
      piece = toks[i] + (toks[i + 1] || '');
      if (cur && (cur + ' ' + piece).length > max) { out.push(cur); cur = piece; }
      else cur = cur ? cur + ' ' + piece : piece;
    }
    if (cur) out.push(cur);
    return out;
  }
  // list: массив исходных предложений; результат: элементы для проигрывателя
  function buildItems(list) {
    var items = [];
    list.forEach(function (orig, k) {
      var spoken = prepare(orig);
      if (!spoken) return;
      if (!/[.!?…]$/.test(spoken)) spoken += '.';
      items.push({ orig: orig, src: k, chunks: chunkText(spoken, 170) });
    });
    return items;
  }

  /* ---------- голоса ---------- */
  function ruVoices() {
    if (typeof speechSynthesis === 'undefined') return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^ru/i.test(v.lang); });
  }
  function pickVoice(name) {
    var list = ruVoices(), i;
    if (!list.length) return null;
    if (name) for (i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    for (i = 0; i < list.length; i++) if (/enhanced|premium|улучш|премиум|natural/i.test(list[i].name)) return list[i];
    return list[0];
  }

  /* ---------- проигрыватель ---------- */
  // opts: voice(), rate(), pauses(), queue(), onIndex(i), onState(s)
  function Player(opts) {
    var self = { idx: 0, playing: false, items: [] }, token = 0, keep = [];
    function utter(text) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      var v = opts.voice(); if (v) u.voice = v;
      u.rate = opts.rate();
      keep.push(u); if (keep.length > 40) keep.shift();
      return u;
    }
    function finish(my) {
      if (my !== token) return;
      self.playing = false; self.idx = 0; opts.onState('stopped'); opts.onIndex(-1);
    }
    function speakItem(i, my) {
      if (my !== token) return;
      if (i >= self.items.length) return finish(my);
      self.idx = i; opts.onIndex(i);
      var chunks = self.items[i].chunks, k = 0;
      (function nextChunk() {
        if (my !== token) return;
        if (k >= chunks.length) { setTimeout(function () { speakItem(i + 1, my); }, opts.pauses() ? 380 : 0); return; }
        var u = utter(chunks[k++]);
        u.onend = function () { setTimeout(nextChunk, opts.pauses() ? 120 : 0); };
        u.onerror = function (e) { if (e && e.error !== 'interrupted' && e.error !== 'canceled') setTimeout(nextChunk, 0); };
        speechSynthesis.speak(u);
      })();
    }
    function playQueue(from, my) {
      var last = null;
      for (var j = from; j < self.items.length; j++) {
        self.items[j].chunks.forEach(function (c) {
          var u = utter(c); u._i = j;
          u.onstart = function () { if (my === token) { self.idx = u._i; opts.onIndex(u._i); } };
          last = u; speechSynthesis.speak(u);
        });
      }
      if (last) last.onend = function () { finish(my); };
    }
    self.setItems = function (items) { self.items = items; self.idx = 0; };
    self.play = function (from) {
      if (typeof speechSynthesis === 'undefined' || !self.items.length) return;
      token += 1; var my = token;
      speechSynthesis.cancel();
      self.playing = true; opts.onState('playing');
      var i = (from == null) ? self.idx : from;
      setTimeout(function () { if (my !== token) return; if (opts.queue()) playQueue(i, my); else speakItem(i, my); }, 50);
    };
    self.pause = function () {
      token += 1; speechSynthesis.cancel(); self.playing = false; opts.onState('paused');
    };
    self.toggle = function () { if (self.playing) self.pause(); else self.play(self.idx); };
    self.stop = function () {
      token += 1; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      self.playing = false; self.idx = 0; opts.onState('stopped'); opts.onIndex(-1);
    };
    self.step = function (d) {
      var i = Math.max(0, Math.min(self.items.length - 1, self.idx + d));
      self.idx = i; opts.onIndex(i);
      if (self.playing) self.play(i);
    };
    return self;
  }

  return { prepare: prepare, splitSentences: splitSentences, buildItems: buildItems, cardinal: cardinal, ordinal: ordinal, Player: Player, pickVoice: pickVoice, ruVoices: ruVoices };
});
