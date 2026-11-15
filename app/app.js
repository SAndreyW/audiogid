/* Аудиогид — экраны приложения (пробная версия, оформление «Галерейный журнал») */
(function () {
  'use strict';
  var VERSION = 'пробная версия 0.1, 15.11.2026';
  var NF = 'Сведения не найдены';
  var $view = document.getElementById('view');
  var $tabs = document.getElementById('tabs');
  var S = Store.settings();
  var state = { snap: null, zoom: 1, stream: null, candidates: [], method: 'search', card: null, player: null, preview: null, runToken: 0, camToken: 0, notice: '', cardFrom: 'camera', histFilter: 'all' };

  var I = {
    cam: '<svg class="i" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8h5.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>',
    hist: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    set: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h9M18 7h1M5 17h1M10 17h9"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    play: '<svg class="i fill" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg class="i fill" viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    prev: '<svg class="i" viewBox="0 0 24 24"><path d="M7 6v12M18 6.5v11L10 12z"/></svg>',
    next: '<svg class="i" viewBox="0 0 24 24"><path d="M17 6v12M6 6.5v11L14 12z"/></svg>',
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    heart: '<svg class="i" viewBox="0 0 24 24"><path d="M12 19.5s-7-4.3-7-9.4A4 4 0 0 1 12 7.8a4 4 0 0 1 7 2.3c0 5.1-7 9.4-7 9.4z"/></svg>',
    heartOn: '<svg class="i fill" viewBox="0 0 24 24"><path d="M12 19.5s-7-4.3-7-9.4A4 4 0 0 1 12 7.8a4 4 0 0 1 7 2.3c0 5.1-7 9.4-7 9.4z"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    img: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 5-4.5 3.5 3L16 13l3 3"/></svg>'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.getElementById('app').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function standalone() { return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
  function save() { Store.save(S); }
  function fmtDate(ts) {
    var d = new Date(ts), n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if (d.toDateString() === n.toDateString()) return 'Сегодня, ' + hm;
    var y = new Date(n.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return 'Вчера, ' + hm;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + hm;
  }

  /* ---------- камера ---------- */
  function stopCamera() {
    state.camToken += 1;
    if (state.stream) { state.stream.getTracks().forEach(function (t) { t.stop(); }); state.stream = null; }
  }
  function camMessage(html) {
    var cam = document.getElementById('cam'); if (!cam) return;
    var m = document.createElement('div'); m.className = 'cam-msg'; m.innerHTML = html; cam.appendChild(m);
    var r = m.querySelector('#retry'); if (r) r.onclick = function () { route(); };
    var a = m.querySelector('#msearch'); if (a) a.onclick = function () { go('#/search'); };
  }
  function startCamera() {
    var my = ++state.camToken, vid = document.getElementById('vid');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return camMessage('<div>Камера недоступна в этом браузере.</div><button class="btn sm" id="msearch">Найти по названию</button>');
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(function (stream) {
        if (my !== state.camToken) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        state.stream = stream; vid.srcObject = stream; return vid.play();
      })
      .catch(function (e) {
        if (my !== state.camToken) return;
        camMessage('<div>Камера недоступна (' + esc(e.name || 'ошибка') + ').</div><div style="font-size:14px;opacity:.85">Разрешите доступ к камере в настройках iOS: Настройки, Safari, Камера. Затем нажмите «Повторить».</div><button class="btn sm" id="retry">Повторить</button><button class="btn sm s" style="color:#fff;border-color:#fff" id="msearch">Найти по названию</button>');
      });
  }
  function viewCamera() {
    state.snap = null;
    $view.innerHTML = '<div class="cam' + (state.zoom === 2 ? ' z2' : '') + '" id="cam">' +
      '<video id="vid" playsinline muted autoplay></video>' +
      '<i class="brk tl"></i><i class="brk tr"></i><i class="brk bl"></i><i class="brk br"></i>' +
      '<div class="cam-top"><span class="pill">Наведите камеру на объект</span><button class="pill btnlike" id="toSearch">' + I.search + 'По названию</button></div>' +
      '<div class="cam-ctl"><div class="spacer44"></div><button class="shutter" id="shot" aria-label="Сделать снимок"><i></i></button>' +
      '<div class="zoom"><button data-z="1" class="' + (state.zoom === 1 ? 'on' : '') + '">1×</button><button data-z="2" class="' + (state.zoom === 2 ? 'on' : '') + '">2×</button></div></div></div>';
    document.getElementById('toSearch').onclick = function () { go('#/search'); };
    document.getElementById('shot').onclick = capture;
    Array.prototype.forEach.call($view.querySelectorAll('[data-z]'), function (b) {
      b.onclick = function () {
        state.zoom = +b.getAttribute('data-z');
        document.getElementById('cam').classList.toggle('z2', state.zoom === 2);
        Array.prototype.forEach.call($view.querySelectorAll('[data-z]'), function (x) { x.classList.toggle('on', x === b); });
      };
    });
    startCamera();
  }
  function capture() {
    var v = document.getElementById('vid');
    if (!v || !v.videoWidth) return toast('Камера ещё не готова');
    var z = state.zoom, sw = v.videoWidth / z, sh = v.videoHeight / z, sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
    var k = Math.min(1, 1024 / Math.max(sw, sh)), c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    state.snap = { url: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
    go('#/confirm');
  }
  function makeThumb(url, size) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, size / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { res(null); };
      img.src = url;
    });
  }

  /* ---------- подтверждение и распознавание ---------- */
  function viewConfirm() {
    if (!state.snap) return go('#/camera');
    $view.innerHTML = '<div class="page noTabs"><div class="kicker">Шаг 1 из 2</div><h1 class="t">Проверьте снимок</h1>' +
      '<img class="snap" alt="Снимок" src="' + state.snap.url + '">' +
      '<div class="banner">Пробная версия: изображение пока не анализируется. Объект ищется по вашему местоположению или по названию.</div>' +
      '<p class="note">Снимок хранится только на телефоне, не сохраняется в «Фото» и удаляется после просмотра результата.</p>' +
      '<div class="stack" style="margin-top:18px"><button class="btn" id="go">Узнать</button><button class="btn s" id="retake">Переснять</button></div></div>';
    document.getElementById('go').onclick = function () { go('#/progress'); };
    document.getElementById('retake').onclick = function () { state.snap = null; go('#/camera'); };
  }
  function getPos() {
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) return rej(new Error('геолокация не поддерживается'));
      navigator.geolocation.getCurrentPosition(res, function (e) { rej(new Error(e.code === 1 ? 'доступ к местоположению запрещён' : (e.message || 'не удалось определить'))); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    });
  }
  function viewProgress() {
    if (!state.snap) return go('#/camera');
    var my = ++state.runToken, t0 = Date.now();
    var steps = ['Определяю местоположение', 'Ищу объекты рядом', 'Готовлю варианты'];
    $view.innerHTML = '<div class="page noTabs"><div class="kicker">Шаг 2 из 2</div><h1 class="t">Распознавание</h1><ul class="steps" id="steps">' +
      steps.map(function (s, k) { return '<li data-k="' + k + '"><span class="dot"></span>' + s + '</li>'; }).join('') +
      '</ul><button class="btn s" id="cancel">Отмена</button></div>';
    function mark(k, cls) {
      var li = $view.querySelector('[data-k="' + k + '"]'); if (!li) return;
      li.className = cls; li.firstChild.className = cls === 'on' ? 'spin' : 'dot';
    }
    document.getElementById('cancel').onclick = function () { state.runToken += 1; go('#/camera'); };
    function alive() { return my === state.runToken; }
    function end(result, extra) { Store.log({ method: 'geo', result: result, ms: Date.now() - t0, note: extra || '' }); }
    mark(0, 'on');
    if (!S.geo) { state.notice = 'Определение по местоположению отключено в настройках.'; end('no_location', 'off'); return go('#/notfound'); }
    getPos().then(function (p) {
      if (!alive()) return;
      mark(0, 'done'); mark(1, 'on');
      return Wiki.geo(p.coords.latitude, p.coords.longitude, 500).then(function (list) {
        if (!alive()) return;
        mark(1, 'done'); mark(2, 'on');
        if (!list.length) { state.notice = 'Рядом с вами ничего не найдено.'; end('not_found'); return go('#/notfound'); }
        state.candidates = list.map(function (x) { return { title: x.title, dist: Math.round(x.dist) }; });
        end('candidates'); go('#/pick');
      });
    }).catch(function (e) {
      if (!alive()) return;
      state.notice = 'Не удалось определить объект: ' + e.message + '.';
      end('no_location', e.message); go('#/notfound');
    });
  }
  function viewPick() {
    $view.innerHTML = '<div class="page"><div class="kicker">Рядом с вами</div><h1 class="t">Что это?</h1><p class="muted" style="margin-top:-6px">Выберите объект из найденных поблизости.</p><div id="lst">' +
      state.candidates.map(function (c, k) {
        return '<div class="li" data-k="' + k + '"><div class="tx"><b>' + esc(c.title) + '</b><small>≈ ' + c.dist + ' м от вас</small></div></div>';
      }).join('') + '</div><button class="btn s" id="none" style="margin-top:16px">Ничего не подходит</button></div>';
    Array.prototype.forEach.call($view.querySelectorAll('.li'), function (el) {
      el.onclick = function () { openByTitle(state.candidates[+el.getAttribute('data-k')].title, 'geo'); };
    });
    document.getElementById('none').onclick = function () { state.notice = ''; go('#/notfound'); };
  }
  function searchBox() {
    return '<form id="sf" class="stack" style="margin:14px 0"><input class="field" id="q" type="search" placeholder="Например: Чёрный квадрат" autocomplete="off" enterkeyhint="search"><button class="btn" type="submit">Найти</button></form><div id="res"></div>';
  }
  function wireSearch() {
    var f = document.getElementById('sf'), res = document.getElementById('res');
    f.onsubmit = function (e) {
      e.preventDefault();
      var q = document.getElementById('q').value.trim(); if (!q) return;
      res.innerHTML = '<div class="empty">Ищу…</div>';
      Wiki.search(q).then(function (list) {
        if (!list.length) { res.innerHTML = '<div class="empty">Ничего не найдено. Попробуйте изменить запрос.</div>'; return; }
        res.innerHTML = list.map(function (x, k) { return '<div class="li" data-k="' + k + '"><div class="tx"><b>' + esc(x.title) + '</b><small>' + esc(x.snippet) + '</small></div></div>'; }).join('');
        Array.prototype.forEach.call(res.querySelectorAll('.li'), function (el) { el.onclick = function () { openByTitle(list[+el.getAttribute('data-k')].title, 'search'); }; });
      }).catch(function (err) { res.innerHTML = '<div class="banner bad">Не удалось выполнить поиск: ' + esc(err.message) + '. Проверьте подключение к интернету.</div>'; });
    };
  }
  function viewNotFound() {
    $view.innerHTML = '<div class="page"><div class="kicker">Результат</div><h1 class="t">Не распознано</h1>' +
      (state.notice ? '<div class="banner">' + esc(state.notice) + '</div>' : '') +
      '<p>Распознавание по изображению появится после подготовки индекса музеев. Пока объект можно найти по названию.</p>' + searchBox() +
      '<hr class="hr"><div class="kicker">Советы</div><ul class="muted"><li>Подойдите ближе и исключите блики и посторонние предметы.</li><li>Для зданий включите определение по местоположению.</li></ul>' +
      '<button class="btn s" id="again" style="margin-top:12px">Переснять</button></div>';
    wireSearch();
    document.getElementById('again').onclick = function () { state.snap = null; go('#/camera'); };
  }
  function viewSearch() {
    $view.innerHTML = '<div class="page"><div class="kicker">Поиск</div><h1 class="t">По названию</h1><p class="muted" style="margin-top:-6px">Введите название картины, здания или памятника.</p>' + searchBox() + '</div>';
    wireSearch();
    var q = document.getElementById('q'); if (q) q.focus();
  }

  /* ---------- карточка объекта ---------- */
  function openByTitle(title, method) { state.method = method || 'search'; go('#/find/' + encodeURIComponent(title)); }
  function viewFind(title) {
    var t0 = Date.now();
    $view.innerHTML = '<div class="page noTabs"><div class="kicker">Справка</div><h1 class="t">' + esc(title) + '</h1><ul class="steps"><li class="on"><span class="spin"></span>Собираю сведения из Википедии и Викиданных</li></ul><button class="btn s" id="cancel">Отмена</button></div>';
    var gone = false;
    document.getElementById('cancel').onclick = function () { gone = true; go('#/camera'); };
    Wiki.buildCard(title).then(function (card) {
      if (gone) return;
      var rec = Object.assign({}, card, { id: 'h' + Date.now(), createdAt: Date.now(), favorite: false, thumb: null, method: state.method });
      var done = function (thumb) {
        rec.thumb = thumb; state.snap = null; state.card = rec; state.cardFrom = 'camera';
        if (S.retention !== 0) Store.put('history', rec).catch(function () { });
        Store.log({ method: state.method, title: card.title, cls: card.cls, result: 'found', ms: Date.now() - t0 });
        location.replace('#/card/' + rec.id);
      };
      if (state.snap) makeThumb(state.snap.url, 400).then(done); else done(null);
    }).catch(function (e) {
      if (gone) return;
      Store.log({ method: state.method, title: title, result: 'error', ms: Date.now() - t0, note: e.message });
      $view.innerHTML = '<div class="page noTabs"><div class="kicker">Справка</div><h1 class="t">Не удалось получить</h1><div class="banner bad">' + esc(e.message) + '. Проверьте подключение к интернету.</div><div class="stack"><button class="btn" id="retry">Повторить</button><button class="btn s" id="back">Назад</button></div></div>';
      document.getElementById('retry').onclick = function () { route(); };
      document.getElementById('back').onclick = function () { go('#/camera'); };
    });
  }
  function speechList(c) {
    var list = [c.title + '.'];
    if (c.byline) list.push((c.cls === 'building' ? 'Архитектор: ' : 'Автор: ') + c.byline + '.');
    (c.meta || []).forEach(function (m) {
      if (m[1] === NF) return;
      list.push(m[0] === 'Год' ? 'Датировка: ' + m[1] + ' г.' : m[0] + ': ' + m[1] + '.');
    });
    var start = list.length;
    (c.desc || []).forEach(function (d) { list.push(d); });
    return { list: list, start: start };
  }
  function viewCard(id) {
    var get = (state.card && state.card.id === id) ? Promise.resolve(state.card) : Store.get('history', id);
    get.then(function (c) { if (!c) { toast('Запись не найдена'); return go('#/history'); } renderCard(c); });
  }
  function renderCard(c) {
    var sp = speechList(c), items = Speech.buildItems(sp.list);
    var meta = (c.meta || []);
    $view.innerHTML = '<div class="page"><div class="hero">' + (c.thumb ? '<img alt="" src="' + c.thumb + '">' : '<div class="ph">' + I.img + '</div>') +
      '<button class="rbtn l" id="back" aria-label="Назад">' + I.back + '</button><button class="rbtn r' + (c.favorite ? ' on' : '') + '" id="fav" aria-label="В избранное">' + (c.favorite ? I.heartOn : I.heart) + '</button></div>' +
      '<div class="kicker" style="margin-top:16px">' + esc(c.kicker || c.kind) + '</div><h1 class="card-t">' + esc(c.title) + '</h1>' +
      (c.byline ? '<div class="by">' + esc(c.byline) + '</div>' : (c.short ? '<div class="by">' + esc(c.short) + '</div>' : '')) +
      (meta.length ? '<div class="meta" style="grid-template-columns:repeat(' + meta.length + ',1fr)">' + meta.map(function (m) { return '<div><small>' + esc(m[0]) + '</small>' + esc(m[1]) + '</div>'; }).join('') + '</div>' : '<div style="height:12px"></div>') +
      '<p class="desc" id="desc">' + ((c.desc && c.desc.length) ? c.desc.map(function (d, k) { return '<span data-k="' + k + '">' + esc(d) + '</span>'; }).join(' ') : NF) + '</p>' +
      '<div class="src">Источники: <a href="' + esc(c.url) + '" target="_blank" rel="noopener">Википедия</a> (лицензия CC BY-SA 4.0)' + (c.wikidata ? ', Викиданные (CC0)' : '') + '.<br>Справка сформирована автоматически и может содержать неточности.</div>' +
      '<button class="linkbtn" id="wrong">Это не то</button></div>' +
      '<div class="player"><button class="small-ic" id="prev" aria-label="Предыдущее предложение">' + I.prev + '</button><button class="play" id="pl" aria-label="Слушать">' + I.play + '</button><button class="small-ic" id="next" aria-label="Следующее предложение">' + I.next + '</button>' +
      '<div class="pt"><b id="ptitle">Слушать справку</b><div class="bar"><i id="pbar"></i></div></div><button class="chip" id="rate" aria-label="Скорость">' + S.rate + '×</button></div>';

    var spans = $view.querySelectorAll('#desc span'), bar = document.getElementById('pbar'), pl = document.getElementById('pl'), title = document.getElementById('ptitle');
    var player = state.player = Speech.Player({
      voice: function () { return Speech.pickVoice(S.voice); }, rate: function () { return S.rate; },
      pauses: function () { return S.pauses; }, queue: function () { return S.queue; },
      onIndex: function (i) {
        Array.prototype.forEach.call(spans, function (s) { s.classList.remove('cur'); });
        if (i < 0) { bar.style.width = '0'; return; }
        bar.style.width = Math.round(((i + 1) / items.length) * 100) + '%';
        var k = items[i].src - sp.start;
        if (k >= 0 && spans[k]) { spans[k].classList.add('cur'); }
        title.textContent = 'Предложение ' + (i + 1) + ' из ' + items.length;
      },
      onState: function (st) {
        pl.innerHTML = st === 'playing' ? I.pause : I.play;
        pl.setAttribute('aria-label', st === 'playing' ? 'Пауза' : 'Слушать');
        if (st !== 'playing' && st !== 'paused') title.textContent = 'Слушать справку';
        if (st === 'paused') title.textContent += ' · пауза';
      }
    });
    player.setItems(items);
    pl.onclick = function () { player.toggle(); };
    document.getElementById('prev').onclick = function () { player.step(-1); };
    document.getElementById('next').onclick = function () { player.step(1); };
    document.getElementById('rate').onclick = function (e) {
      var r = [0.8, 0.9, 1.0, 1.1], k = r.indexOf(S.rate); S.rate = r[(k + 1) % r.length]; save();
      e.target.textContent = S.rate + '×'; if (player.playing) player.play(player.idx);
    };
    document.getElementById('back').onclick = function () { go(state.cardFrom === 'history' ? '#/history' : '#/camera'); };
    document.getElementById('fav').onclick = function (e) {
      c.favorite = !c.favorite; var b = e.currentTarget; b.classList.toggle('on', c.favorite); b.innerHTML = c.favorite ? I.heartOn : I.heart;
      Store.put('history', c).catch(function () { });
    };
    document.getElementById('wrong').onclick = function () { Store.log({ method: 'mark', title: c.title, result: 'marked_wrong' }); toast('Отмечено в журнале запросов'); };
    if (S.autoplay) { try { player.play(0); } catch (e) { /* без жеста воспроизведение может быть запрещено */ } }
  }

  /* ---------- история ---------- */
  function viewHistory() {
    Store.all('history').then(function (all) {
      all.sort(function (a, b) { return b.createdAt - a.createdAt; });
      var list = state.histFilter === 'fav' ? all.filter(function (x) { return x.favorite; }) : all;
      $view.innerHTML = '<div class="page"><div class="kicker">Сохранённые справки</div><h1 class="t">История</h1>' +
        '<div class="seg"><button data-f="all" class="' + (state.histFilter === 'all' ? 'on' : '') + '">Все</button><button data-f="fav" class="' + (state.histFilter === 'fav' ? 'on' : '') + '">Избранное</button></div>' +
        (list.length ? list.map(function (h) {
          return '<div class="li" data-id="' + h.id + '"><div class="th">' + (h.thumb ? '<img alt="" src="' + h.thumb + '">' : I.img) + '</div><div class="tx"><b>' + esc(h.title) + '</b><small>' + esc(h.kind || 'Объект') + ' · ' + fmtDate(h.createdAt) + '</small></div>' +
            '<button class="icon-btn' + (h.favorite ? ' on' : '') + '" data-fav="' + h.id + '" aria-label="Избранное">' + (h.favorite ? I.heartOn : I.heart) + '</button>' +
            '<button class="icon-btn" data-del="' + h.id + '" aria-label="Удалить">' + I.trash + '</button></div>';
        }).join('') : '<div class="empty">' + (state.histFilter === 'fav' ? 'В избранном пока ничего нет.' : 'История пуста. Найдите первый объект.') + '</div>') +
        '<p class="note">Записи хранятся ' + (S.retention ? S.retention + ' дней, избранное — без срока' : 'только до закрытия справки') + '. Изменить срок можно в настройках.</p></div>';
      Array.prototype.forEach.call($view.querySelectorAll('[data-f]'), function (b) { b.onclick = function () { state.histFilter = b.getAttribute('data-f'); viewHistory(); }; });
      Array.prototype.forEach.call($view.querySelectorAll('.li'), function (el) {
        el.onclick = function () { state.card = null; state.cardFrom = 'history'; go('#/card/' + el.getAttribute('data-id')); };
      });
      Array.prototype.forEach.call($view.querySelectorAll('[data-fav]'), function (b) {
        b.onclick = function (e) {
          e.stopPropagation(); var id = b.getAttribute('data-fav');
          Store.get('history', id).then(function (h) { h.favorite = !h.favorite; return Store.put('history', h); }).then(viewHistory);
        };
      });
      Array.prototype.forEach.call($view.querySelectorAll('[data-del]'), function (b) {
        b.onclick = function (e) { e.stopPropagation(); Store.del('history', b.getAttribute('data-del')).then(viewHistory); };
      });
    });
  }

  /* ---------- настройки и журнал ---------- */
  function sample() { return ['Чёрный квадрат — одно из программных произведений супрематизма.', 'Картина написана Казимиром Малевичем в 1915 г.', 'Сегодня она хранится в Государственной Третьяковской галерее.']; }
  function playSample() {
    if (state.preview) state.preview.stop();
    var pr = state.preview = Speech.Player({
      voice: function () { return Speech.pickVoice(S.voice); }, rate: function () { return S.rate; },
      pauses: function () { return S.pauses; }, queue: function () { return S.queue; }, onIndex: function () { }, onState: function () { }
    });
    pr.setItems(Speech.buildItems(sample())); pr.play(0);
  }
  function viewSettings() {
    var voices = Speech.ruVoices();
    var vopts = voices.map(function (v) { var cur = Speech.pickVoice(S.voice); return '<option value="' + esc(v.name) + '"' + (cur && cur.name === v.name ? ' selected' : '') + '>' + esc(v.name) + (v.localService ? '' : ' (сетевой)') + '</option>'; }).join('');
    function sw(id, on, title, sub) { return '<div class="row"><div class="l">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div><input type="checkbox" class="sw" id="' + id + '"' + (on ? ' checked' : '') + '></div>'; }
    $view.innerHTML = '<div class="page"><div class="kicker">Приложение</div><h1 class="t">Настройки</h1>' +
      '<div class="grp kicker">Озвучивание</div>' +
      (voices.length ? '<div class="row"><div class="l">Голос<small>Улучшенные голоса: Настройки iOS, Универсальный доступ, Устный контент, Голоса, Русский</small></div></div><select class="field" id="voice">' + vopts + '</select>' : '<div class="banner">Русские голоса не найдены. Загрузите голос: Настройки iOS, Универсальный доступ, Устный контент, Голоса.</div>') +
      '<div class="row"><div class="l">Скорость</div><select class="field" id="rate" style="width:170px"><option value="0.8">медленно</option><option value="0.9">спокойно</option><option value="1">обычно</option><option value="1.1">быстрее</option></select></div>' +
      sw('pauses', S.pauses, 'Паузы между предложениями', 'Речь звучит спокойнее и менее механически') +
      sw('queue', S.queue, 'Непрерывный режим', 'Включите, если озвучивание обрывается после первого предложения') +
      sw('autoplay', S.autoplay, 'Озвучивать автоматически', 'Работает не всегда: iOS требует нажатия кнопки') +
      '<div style="margin:12px 0"><button class="btn sm" id="sample">Прослушать пример</button> <button class="btn sm s" id="stopsample">Стоп</button></div>' +
      '<div class="grp kicker">Хранение данных</div>' +
      '<div class="row"><div class="l">Срок хранения истории<small>Избранное не удаляется автоматически</small></div><select class="field" id="ret" style="width:150px"><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="0">не хранить</option></select></div>' +
      '<div style="margin:12px 0"><button class="btn sm s" id="clrh">Очистить историю</button></div>' +
      '<p class="muted" style="font-size:13px">Снимок хранится только на время просмотра результата и в «Фото» не сохраняется.</p>' +
      '<div class="grp kicker">Местоположение</div>' + sw('geo', S.geo, 'Искать объекты рядом', 'Координаты отправляются только в Википедию для поиска статей рядом и нигде не сохраняются') +
      '<div class="grp kicker">Журнал</div><div class="row" id="tolog" style="cursor:pointer"><div class="l">Журнал запросов<small>Что и когда отправлялось на распознавание</small></div>' + I.back.replace('<svg class="i"', '<svg class="i" style="transform:rotate(180deg)"') + '</div>' +
      '<div class="grp kicker">О приложении</div>' +
      '<p class="muted" style="font-size:13.5px">Версия: ' + VERSION + '.<br>Источники: Википедия (CC BY-SA 4.0) и Викиданные (CC0).<br>Ответственность за соблюдение правил посещения (билеты, разрешение на съёмку, условия доступа к коллекциям) лежит на пользователе. Приложение не является разрешением на съёмку.</p></div>';
    document.getElementById('rate').value = String(S.rate); document.getElementById('ret').value = String(S.retention);
    var v = document.getElementById('voice'); if (v) v.onchange = function () { S.voice = v.value; save(); };
    document.getElementById('rate').onchange = function (e) { S.rate = parseFloat(e.target.value); save(); };
    document.getElementById('ret').onchange = function (e) { S.retention = parseInt(e.target.value, 10); save(); Store.cleanup(S.retention); };
    ['pauses', 'queue', 'autoplay', 'geo'].forEach(function (k) { document.getElementById(k).onchange = function (e) { S[k] = e.target.checked; save(); }; });
    document.getElementById('sample').onclick = playSample;
    document.getElementById('stopsample').onclick = function () { if (state.preview) state.preview.stop(); };
    document.getElementById('clrh').onclick = function () { if (confirm('Удалить всю историю, включая избранное?')) Store.clear('history').then(function () { toast('История очищена'); }); };
    document.getElementById('tolog').onclick = function () { go('#/log'); };
  }
  var RES = { found: 'найдено', candidates: 'варианты', not_found: 'не найдено', no_location: 'нет местоположения', marked_wrong: 'отмечено как неверное', error: 'ошибка' };
  var MTH = { geo: 'по местоположению', search: 'по названию', mark: 'отметка' };
  function viewLog() {
    Store.all('log').then(function (all) {
      all.sort(function (a, b) { return b.at - a.at; });
      $view.innerHTML = '<div class="page"><button class="linkbtn" id="back">← Настройки</button><div class="kicker">Только на этом телефоне</div><h1 class="t">Журнал запросов</h1>' +
        (all.length ? all.map(function (e) {
          return '<div class="log-i"><b>' + esc(e.title || 'Поиск рядом') + '</b><small>' + fmtDate(e.at) + ' · ' + (MTH[e.method] || e.method) + ' · ' + (RES[e.result] || e.result) + (e.ms ? ' · ' + (e.ms / 1000).toFixed(1) + ' с' : '') + '</small></div>';
        }).join('') : '<div class="empty">Журнал пуст.</div>') +
        (all.length ? '<button class="btn sm s" id="clrl" style="margin-top:16px">Очистить журнал</button>' : '') + '</div>';
      document.getElementById('back').onclick = function () { go('#/settings'); };
      var c = document.getElementById('clrl'); if (c) c.onclick = function () { Store.clear('log').then(viewLog); };
    });
  }

  /* ---------- первый запуск ---------- */
  function onboarding() {
    if (S.accepted) return;
    var o = document.createElement('div'); o.className = 'onb';
    o.innerHTML = '<div class="kicker">Добро пожаловать</div><h1 class="t" style="font-size:40px">Аудиогид</h1>' +
      '<p class="serif-i" style="font-size:18px;color:var(--muted)">Справка о картине, скульптуре или здании — на экране и вслух.</p>' +
      '<ol><li>Наведите камеру на объект и нажмите кнопку съёмки.</li><li>Подтвердите снимок кнопкой «Узнать».</li><li>Нажмите «Слушать справку».</li></ol>' +
      (standalone() ? '' : '<div class="banner">Чтобы приложение открывалось на весь экран: «Поделиться», затем «На экран Домой».</div>') +
      '<div class="banner">Пробная версия: распознавание по изображению ещё не подключено. Объекты ищутся по местоположению и по названию.</div>' +
      '<div class="banner">Ответственность за соблюдение правил посещения (билеты, разрешение на фото- и видеосъёмку, условия доступа к коллекциям) лежит на вас. Приложение не является разрешением на съёмку.</div>' +
      '<div class="grow"></div><button class="btn" id="ok">Принимаю и начинаю</button>';
    document.getElementById('app').appendChild(o);
    document.getElementById('ok').onclick = function () { S.accepted = true; save(); o.parentNode.removeChild(o); };
  }

  /* ---------- навигация ---------- */
  var TABS = [['camera', 'Камера', I.cam], ['history', 'История', I.hist], ['settings', 'Настройки', I.set]];
  function renderTabs(active, hidden) {
    $tabs.className = 'tabs' + (hidden ? ' hide' : '');
    $tabs.innerHTML = TABS.map(function (t) { return '<button class="tab' + (t[0] === active ? ' on' : '') + '" data-t="' + t[0] + '" aria-label="' + t[1] + '">' + t[2] + '<span>' + t[1] + '</span></button>'; }).join('');
    Array.prototype.forEach.call($tabs.querySelectorAll('.tab'), function (b) { b.onclick = function () { if (b.getAttribute('data-t') === 'camera') { state.zoom = state.zoom || 1; } go('#/' + b.getAttribute('data-t')); }; });
  }
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/'), name = parts[0] || 'camera', arg = decodeURIComponent(parts.slice(1).join('/'));
    if (name !== 'camera') stopCamera();
    if (name !== 'card' && state.player) { state.player.stop(); state.player = null; }
    if (name !== 'settings' && state.preview) { state.preview.stop(); state.preview = null; }
    var tab = { camera: 'camera', confirm: 'camera', progress: 'camera', pick: 'camera', notfound: 'camera', search: 'camera', find: 'camera', card: state.cardFrom === 'history' ? 'history' : 'camera', history: 'history', settings: 'settings', log: 'settings' }[name] || 'camera';
    renderTabs(tab, name === 'confirm' || name === 'progress' || name === 'find');
    var views = { camera: viewCamera, confirm: viewConfirm, progress: viewProgress, pick: viewPick, notfound: viewNotFound, search: viewSearch, history: viewHistory, settings: viewSettings, log: viewLog };
    if (name === 'find') return viewFind(arg);
    if (name === 'card') return viewCard(arg);
    (views[name] || viewCamera)();
  }
  window.addEventListener('hashchange', route);

  Store.cleanup(S.retention).catch(function () { });
  if ('speechSynthesis' in window) {
    try { speechSynthesis.getVoices(); } catch (e) { /* голоса загрузятся позже */ }
    speechSynthesis.onvoiceschanged = function () { if (/^#\/settings/.test(location.hash)) viewSettings(); };
  }
  route();
  onboarding();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
})();
