/* Аудиогид: локальное хранилище (история, журнал запросов, настройки). Всё остаётся на устройстве. */
var Store = (function () {
  'use strict';
  var dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('audiogid-app', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore('history', { keyPath: 'id' });
        d.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function run(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode), req = fn(t.objectStore(store));
        t.oncomplete = function () { res(req && req.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  var api = {
    put: function (s, o) { return run(s, 'readwrite', function (st) { return st.put(o); }); },
    get: function (s, k) { return run(s, 'readonly', function (st) { return st.get(k); }); },
    all: function (s) { return run(s, 'readonly', function (st) { return st.getAll(); }); },
    del: function (s, k) { return run(s, 'readwrite', function (st) { return st.delete(k); }); },
    clear: function (s) { return run(s, 'readwrite', function (st) { return st.clear(); }); }
  };

  var DEFAULTS = { voice: '', rate: 0.9, pauses: true, queue: false, autoplay: false, retention: 30, geo: true, accepted: false };
  api.settings = function () {
    var s = {};
    try { s = JSON.parse(localStorage.getItem('audiogid.settings') || '{}'); } catch (e) { s = {}; }
    var o = {}; Object.keys(DEFAULTS).forEach(function (k) { o[k] = (s[k] === undefined) ? DEFAULTS[k] : s[k]; });
    return o;
  };
  api.save = function (s) { try { localStorage.setItem('audiogid.settings', JSON.stringify(s)); } catch (e) { /* хранилище недоступно */ } };

  api.cleanup = function (days) {
    if (!days) return Promise.resolve();
    var limit = Date.now() - days * 86400000;
    return api.all('history').then(function (list) {
      return Promise.all(list.filter(function (h) { return !h.favorite && h.createdAt < limit; }).map(function (h) { return api.del('history', h.id); }));
    });
  };
  api.log = function (entry) { entry.at = Date.now(); return api.put('log', entry).catch(function () { }); };
  return api;
})();
