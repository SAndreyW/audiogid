/* Аудиогид: сведения из Википедии и Викиданных (бесплатные источники, без ключей). */
var Wiki = (function () {
  'use strict';
  var REST = 'https://ru.wikipedia.org/api/rest_v1/page/summary/';
  var API = 'https://ru.wikipedia.org/w/api.php';
  var WD = 'https://www.wikidata.org/w/api.php';

  function getJson(url, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 12000);
    return fetch(url, { signal: c.signal }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) { clearTimeout(t); throw (e.name === 'AbortError' ? new Error('время ожидания истекло') : e); });
  }

  function geo(lat, lon, radius) {
    return getJson(API + '?action=query&list=geosearch&gscoord=' + lat + '%7C' + lon + '&gsradius=' + (radius || 400) + '&gslimit=10&format=json&origin=*')
      .then(function (j) { return (j.query && j.query.geosearch) || []; });
  }
  function search(q) {
    return getJson(API + '?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&srlimit=8&srprop=snippet&format=json&origin=*')
      .then(function (j) {
        return ((j.query && j.query.search) || []).map(function (x) { return { title: x.title, snippet: x.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&') }; });
      });
  }
  function summary(title) {
    return getJson(REST + encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true');
  }
  function entity(id) {
    return getJson(WD + '?action=wbgetentities&ids=' + id + '&props=claims&format=json&origin=*').then(function (j) { return (j.entities[id] && j.entities[id].claims) || {}; });
  }
  function entities(ids) {
    if (!ids.length) return Promise.resolve({});
    return getJson(WD + '?action=wbgetentities&ids=' + ids.join('%7C') + '&props=labels%7Cclaims&languages=ru&format=json&origin=*').then(function (j) { return j.entities || {}; });
  }

  function claimIds(cl, p) {
    return (cl[p] || []).map(function (c) {
      var v = c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
      return v && v.id;
    }).filter(Boolean).slice(0, 3);
  }
  function claimYear(cl, p) {
    var c = (cl[p] || [])[0], v = c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
    if (!v || !v.time || v.precision < 9) return null;
    var m = /^([+-])(\d+)-/.exec(v.time);
    if (!m) return null;
    var y = parseInt(m[2], 10);
    return m[1] === '-' ? -y : y;
  }
  function label(ents, id) {
    var e = ents[id];
    return e && e.labels && e.labels.ru ? e.labels.ru.value : null;
  }
  function names(ents, ids) {
    return ids.map(function (i) { return label(ents, i); }).filter(function (x, k, a) { return x && a.indexOf(x) === k; });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  var KINDS = { painting: 'Картина', sculpture: 'Скульптура и памятник', building: 'Здание и сооружение', unknown: 'Объект' };
  function classify(labels) {
    var s = labels.join(' ').toLowerCase();
    if (/картин|живопис|полотн|икона/.test(s)) return 'painting';
    if (/скульптур|памятник|статуя|монумент|бюст|обелиск/.test(s)) return 'sculpture';
    if (/здани|собор|храм|церков|башн|дворец|мост|сооружени|усадьб|монастыр|замок|крепост|театр|вокзал|музей|особняк|дом|мечеть|синагог|часовн|колокольн/.test(s)) return 'building';
    return 'unknown';
  }

  function enrich(card) {
    return entity(card.wikidata).then(function (cl) {
      var groups = {};
      ['P31', 'P170', 'P84', 'P149', 'P136', 'P186', 'P195', 'P276', 'P131'].forEach(function (p) { groups[p] = claimIds(cl, p); });
      var all = [];
      Object.keys(groups).forEach(function (p) { groups[p].forEach(function (id) { if (all.indexOf(id) < 0) all.push(id); }); });
      return entities(all.slice(0, 40)).then(function (ents) {
        var cls = classify(names(ents, groups.P31));
        card.cls = cls; card.kind = KINDS[cls];
        var yearV = claimYear(cl, 'P571') || claimYear(cl, 'P1619');
        var people = groups.P170.length ? groups.P170 : groups.P84;
        if (people.length) {
          card.byline = people.map(function (id) {
            var e = ents[id], b = e && claimYear(e.claims || {}, 'P569'), d = e && claimYear(e.claims || {}, 'P570');
            return label(ents, id) + (b && d ? ', ' + b + '–' + d : '');
          }).filter(function (x) { return x && x.indexOf('null') < 0; }).join('; ');
        }
        var NF = 'Сведения не найдены';
        var style = names(ents, groups.P149).concat(names(ents, groups.P136))[0];
        if (cls === 'painting') {
          card.meta = [['Год', yearV ? String(yearV) : NF], ['Техника', names(ents, groups.P186).join(', ') || NF], ['Музей', names(ents, groups.P195.concat(groups.P276)).join(', ') || NF]];
        } else if (cls === 'sculpture') {
          card.meta = [['Год', yearV ? String(yearV) : NF], ['Материал', names(ents, groups.P186).join(', ') || NF], ['Место', names(ents, groups.P131.concat(groups.P276)).join(', ') || NF]];
        } else if (cls === 'building') {
          card.meta = [['Год', yearV ? String(yearV) : NF], ['Стиль', style ? cap(style) : NF], ['Место', names(ents, groups.P131.concat(groups.P276)).join(', ') || NF]];
        } else {
          card.meta = [];
          if (yearV) card.meta.push(['Год', String(yearV)]);
          var mat = names(ents, groups.P186).join(', '); if (mat) card.meta.push(['Материал', mat]);
          var pl = names(ents, groups.P131.concat(groups.P276, groups.P195)).join(', '); if (pl) card.meta.push(['Место', pl]);
        }
        card.kicker = card.kind + (style && cls !== 'unknown' ? ' · ' + cap(style) : '');
      });
    });
  }

  function buildCard(title) {
    return summary(title).then(function (s) {
      var sentences = Speech.splitSentences(s.extract || '').slice(0, 4);
      var card = {
        title: s.title, desc: sentences, short: s.description || '',
        url: (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || ('https://ru.wikipedia.org/wiki/' + encodeURIComponent(title)),
        wikidata: s.wikibase_item || null, byline: '', meta: [], cls: 'unknown', kind: KINDS.unknown, kicker: KINDS.unknown
      };
      if (!card.wikidata) return card;
      return enrich(card).then(function () { return card; }, function () { return card; });
    });
  }

  return { geo: geo, search: search, buildCard: buildCard, KINDS: KINDS };
})();
