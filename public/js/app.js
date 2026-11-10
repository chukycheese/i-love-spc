/* i ❤ spc — app.js
   순수 바닐라. 외부 라이브러리 없음.
   데이터 원본: data/spc-data.json (file:// 대비 data/spc-data.js 래퍼) */
(function () {
  'use strict';

  var CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  var CATEGORY = {
    all: '전체',
    bakery: '베이커리 · 디저트',
    dining: '외식 · 버거',
    cafe: '카페 · 음료',
    service: 'IT · 서비스'
  };
  var TYPE_PILL = { '사망': 'fatal', '부상': 'injury', '화재': 'fire', '구조': 'labor' };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  var norm = function (value) {
    return String(value == null ? '' : value).toLowerCase().replace(/\s+/g, '');
  };
  var choseongOf = function (text) {
    var out = '';
    String(text || '').split('').forEach(function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        out += CHOSEONG[Math.floor((code - 0xAC00) / 588)];
      } else if (/[0-9a-z]/i.test(ch)) {
        out += ch.toLowerCase();
      }
    });
    return out;
  };
  var hasChoseong = function (text) { return /[ㄱ-ㅎ]/.test(text); };
  var epTitle = function (ep) {
    return String(ep.title).replace(/^좋게된 제빵사\s*:\s*/, '');
  };
  var scrollBehavior = function () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  };

  var DATA = null;
  var state = { tab: 'brands', brandCat: 'all', brandQuery: '', year: 'all' };
  var epByRelated = {};
  var recordById = {};

  /* ------------------------------------------------------------------ boot */
  function boot() {
    if (window.__SPC_DATA__) {
      init(window.__SPC_DATA__);
      return;
    }
    fetch('data/spc-data.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(init)
      .catch(function () {
        var main = $('#main');
        if (main) {
          main.innerHTML =
            '<div class="wrap" style="padding:60px 0"><div class="empty">' +
            '<p class="empty__emoji">🍞</p>' +
            '<p class="empty__title">데이터를 불러오지 못했습니다.</p>' +
            '<p class="empty__body">로컬 서버로 열어 주세요. 예: <code>python3 -m http.server</code> 후 ' +
            '<code>http://localhost:8000</code> 접속. 원본 데이터는 <code>data/spc-data.json</code>에 있습니다.</p>' +
            '</div></div>';
        }
      });
  }

  function init(data) {
    DATA = data;
    buildIndexes();

    $('#as-of-label').textContent = data.meta.asOfLabel;
    if ($('#footer-asof')) $('#footer-asof').textContent = data.meta.asOfLabel;
    if ($('#footer-disclaimer')) $('#footer-disclaimer').textContent = data.meta.disclaimer;

    renderStats();
    renderTicker();
    renderBrandChips();
    renderBrands();
    renderBrandNotes();
    renderGovernance();
    renderTrials();
    renderYearChips();
    renderIncidents();
    renderPledge();
    renderColdStats();
    renderPodHero();
    renderPodcasts();

    bindTabs();
    bindSearch();
    bindAccordions();
    bindJumps();
    bindToTop();

    var fromHash = (location.hash || '').replace('#', '');
    var known = ['brands', 'trials', 'incidents', 'podcasts'].indexOf(fromHash) > -1;
    activateTab(known ? fromHash : 'brands', { hash: false });

    document.documentElement.classList.add('is-ready');
  }

  function buildIndexes() {
    DATA.trials.forEach(function (trial) {
      recordById[trial.id] = { label: trial.short, tab: 'trials', el: 'trial-' + trial.id };
    });
    DATA.incidents.forEach(function (item) {
      var d = item.date.split('-');
      recordById[item.id] = {
        label: d[0] + '.' + d[1] + ' ' + item.type,
        tab: 'incidents',
        el: 'incident-' + item.id
      };
    });
    DATA.podcasts.episodes.forEach(function (ep) {
      (ep.related || []).forEach(function (id) {
        if (!epByRelated[id]) epByRelated[id] = [];
        epByRelated[id].push(ep);
      });
    });
  }

  /* --------------------------------------------------------------- summary */
  function renderStats() {
    var host = $('#stats');
    if (!host) return;
    host.innerHTML = DATA.summary.cards.map(function (card) {
      var accent = '';
      if (card.accent === 'blue' || card.accent === 'pink') accent = ' stat--blue';
      else if (card.accent === 'yellow') accent = ' stat--yellow';
      return '<article class="stat' + accent + '">' +
        '<span class="stat__label">' + esc(card.label) + '</span>' +
        '<span class="stat__num"><span class="stat__value">' + esc(card.value) + '</span>' +
        '<span class="stat__unit">' + esc(card.unit) + '</span></span>' +
        '<span class="stat__note">' + esc(card.note) + '</span>' +
        '</article>';
    }).join('');
  }

  function renderTicker() {
    var track = $('#ticker');
    if (!track) return;
    var items = DATA.summary.ticker.concat(DATA.summary.ticker);
    track.innerHTML = items.map(function (text) {
      return '<span class="ticker__item">' + esc(text) + '</span>';
    }).join('');
    track.style.setProperty('--ticker-duration', Math.max(34, DATA.summary.ticker.length * 8) + 's');
  }

  /* ---------------------------------------------------------------- brands */
  function renderBrandChips() {
    var host = $('#brand-chips');
    if (!host) return;
    var counts = { all: DATA.brands.length };
    DATA.brands.forEach(function (brand) {
      counts[brand.category] = (counts[brand.category] || 0) + 1;
    });
    host.innerHTML = Object.keys(CATEGORY).map(function (key) {
      return '<button type="button" class="chip" data-cat="' + key + '" aria-pressed="' +
        (key === state.brandCat) + '">' + esc(CATEGORY[key]) +
        (counts[key] ? '<span class="chip__count">' + counts[key] + '</span>' : '') + '</button>';
    }).join('');

    host.addEventListener('click', function (event) {
      var btn = event.target.closest('.chip');
      if (!btn) return;
      state.brandCat = btn.dataset.cat;
      $$('.chip', host).forEach(function (chip) {
        chip.setAttribute('aria-pressed', String(chip === btn));
      });
      renderBrands();
    });
  }

  function brandMatches(brand, query) {
    if (!query) return true;
    var q = norm(query);
    var companyChoseong = choseongOf(brand.company);
    var haystack = norm([
      brand.name, brand.en, brand.company, brand.product,
      brand.choseong, companyChoseong, CATEGORY[brand.category]
    ].join('|')).replace(/\|/g, '');

    if (haystack.indexOf(q) > -1) return true;

    if (hasChoseong(query)) {
      var qChoseong = query.replace(/[^ㄱ-ㅎ]/g, '');
      if (!qChoseong) return true;
      var targets = (brand.choseong || '') + companyChoseong + choseongOf(brand.en);
      if (targets.indexOf(qChoseong) > -1) return true;
    }
    return false;
  }

  function renderBrands() {
    var grid = $('#brand-grid');
    var empty = $('#brand-empty');
    var count = $('#brand-count');
    if (!grid) return;

    var list = DATA.brands.filter(function (brand) {
      return (state.brandCat === 'all' || brand.category === state.brandCat) && brandMatches(brand, state.brandQuery);
    });

    grid.innerHTML = list.map(function (brand) {
      return '<article class="brand" style="--brand:' + esc(brand.color) + '">' +
        '<div class="brand__top"><span class="brand__dot" aria-hidden="true"></span>' +
        '<span class="brand__company">' + esc(brand.company) + '</span></div>' +
        '<h3>' + esc(brand.name) + '</h3>' +
        '<p class="brand__en">' + esc(brand.en) + '</p>' +
        '<p class="brand__product">' + esc(brand.product) + '</p>' +
        '<span class="brand__choseong" aria-hidden="true">' + esc(brand.choseong) + '</span>' +
        '</article>';
    }).join('');

    var q = state.brandQuery.trim();
    var scope = state.brandCat === 'all' ? '전체 브랜드' : CATEGORY[state.brandCat];
    if (q) {
      count.innerHTML = '‘<strong>' + esc(q) + '</strong>’ 검색 결과 <strong>' + list.length +
        '</strong>개 · ' + esc(scope) + ' ' + DATA.brands.length + '개 중';
    } else {
      count.innerHTML = esc(scope) + ' <strong>' + list.length + '</strong>개';
    }

    var isFiltering = Boolean(q) || state.brandCat !== 'all';
    grid.hidden = list.length === 0;
    empty.hidden = list.length !== 0;
    if (!isFiltering) empty.hidden = true;
    $('#search-clear').hidden = !q;
  }

  function renderBrandNotes() {
    var host = $('#brand-notes');
    if (!host) return;
    host.innerHTML = DATA.brandNotes.map(function (note, index) {
      return '<p>' + (index === 0 ? '<strong>읽는 법 · </strong>' : '') + esc(note) + '</p>';
    }).join('');
  }

  /* ------------------------------------------------------------ governance */
  function renderGovernance() {
    var host = $('#gov');
    if (!host) return;
    var g = DATA.governance;

    var owners = g.owners.map(function (owner) {
      return '<div class="owner">' +
        '<span class="owner__name">' + esc(owner.name) + '<small>' + esc(owner.role) + '</small></span>' +
        '<span class="owner__bar"><i style="width:' + Number(owner.stake) + '%"></i></span>' +
        '<span class="owner__pct">' + Number(owner.stake).toFixed(2) + '%</span>' +
        '</div>';
    }).join('');

    var holdingSource = g.holding.note ? esc(g.holding.note) : '';
    var children = g.children.map(function (child) {
      var stake = child.stake == null ? '계열' : Number(child.stake).toFixed(child.stake === 100 ? 0 : 2) + '%';
      return '<div class="child' + (child.listed ? ' child--listed' : '') + '">' +
        '<div class="child__top"><span class="child__name">' + esc(child.name) + '</span>' +
        '<span class="child__stake">' + esc(stake) + '</span></div>' +
        '<p class="child__note">' + esc(child.note) + '</p></div>';
    }).join('');

    var listedRows = g.listed.stakes.map(function (row) {
      var isOwner = row.name !== '기타 주주';
      return '<div class="listed__row' + (isOwner ? ' listed__row--owner' : '') + '">' +
        '<span>' + esc(row.name) + '</span>' +
        '<span class="listed__track"><i style="width:' + Number(row.stake) + '%"></i></span>' +
        '<span class="listed__pct">' + Number(row.stake).toFixed(2) + '%</span>' +
        '</div>';
    }).join('');

    var succession = g.succession.map(function (text) {
      return '<li>' + esc(text) + '</li>';
    }).join('');

    host.innerHTML =
      '<header class="gov__head">' +
      '<p class="gov__eyebrow">GOVERNANCE · 상미당홀딩스</p>' +
      '<h2 id="gov-title">빵은 30개 브랜드, 지분은 4명</h2>' +
      '<p class="gov__note">' + esc(g.holding.name) + '은 오너 일가가 <strong>100%</strong> 보유한 가족회사입니다. ' +
      '그 아래에 파리크라상과 삼립, 그리고 우리가 먹는 브랜드들이 있습니다. 지주사 전환은 승계를 위한 구조라는 분석이 나옵니다.</p>' +
      '</header>' +
      '<div class="holding">' +
      '<div class="holding__top"><div><span class="holding__name">' + esc(g.holding.name) + '</span>' +
      '<span class="holding__en">' + esc(g.holding.en) + '</span></div>' +
      '<span class="holding__badge">오너 일가 100%</span></div>' +
      '<div class="owners">' + owners + '</div>' +
      (holdingSource ? '<p class="gov__note" style="margin-top:14px;font-size:11.5px">' + holdingSource + '</p>' : '') +
      '</div>' +
      '<p class="children__label">↓ 주요 계열사 · 지배 구조</p>' +
      '<div class="children">' + children + '</div>' +
      '<div class="listed">' +
      '<div class="listed__head"><span class="listed__name">' + esc(g.listed.name) + '</span>' +
      '<span class="listed__code">KRX ' + esc(g.listed.code) + '</span></div>' +
      '<div class="listed__bars">' + listedRows + '</div>' +
      '<p class="listed__note">' + esc(g.listed.note) + '</p>' +
      '</div>' +
      '<div class="succession"><h3>3세 승계, 지금 어디까지 왔나</h3><ul>' + succession + '</ul></div>' +
      '<p class="gov__source">출처: ' + esc(g.source.publisher) + ', ' + esc(g.source.date) + ' · ' +
      '<a href="' + esc(g.source.url) + '" target="_blank" rel="noopener" style="color:#b79fa9">기사 보기 ↗</a></p>';
  }

  /* ----------------------------------------------------------------- trials */
  function podLinksHtml(recordId) {
    var eps = epByRelated[recordId];
    if (!eps || !eps.length) return '';
    return '<div class="pod-links"><span class="pod-links__label">🎙️ 관련 팟캐스트</span>' +
      eps.map(function (ep) {
        return '<button type="button" class="pod-chip" data-ep-target="' + esc(ep.code) + '">' +
          '<span class="pod-chip__code">' + esc(ep.code) + '</span>' +
          '<span class="pod-chip__title">' + esc(epTitle(ep)) + '</span></button>';
      }).join('') + '</div>';
  }

  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    return '<div class="sources"><p class="sources__title">SOURCES</p><ul>' +
      sources.map(function (source) {
        return '<li><a href="' + esc(source.url) + '" target="_blank" rel="noopener">' +
          esc(source.title) + '</a> <span>' + esc(source.publisher) + ' · ' + esc(source.date) + '</span></li>';
      }).join('') + '</ul></div>';
  }

  function bulletsHtml(items) {
    return '<ul class="bullets">' + items.map(function (text) {
      return '<li>' + esc(text) + '</li>';
    }).join('') + '</ul>';
  }

  function renderTrials() {
    var host = $('#trials-list');
    if (!host) return;

    host.innerHTML = DATA.trials.map(function (trial, index) {
      var open = index === 0;
      var facts = trial.facts.map(function (fact) {
        return '<div><dt>' + esc(fact.label) + '</dt><dd>' + esc(fact.value) + '</dd></div>';
      }).join('');

      var timeline = trial.timeline && trial.timeline.length
        ? '<div class="trial__block"><h4>재판 경과</h4><ul class="mini-timeline">' +
          trial.timeline.map(function (row) {
            return '<li><time>' + esc(row.date) + '</time><span>' + esc(row.text) + '</span></li>';
          }).join('') + '</ul></div>'
        : '';

      var note = trial.note
        ? '<p class="trial__note"><strong>팩트체크 · </strong>' + esc(trial.note) + '</p>'
        : '';

      return '<article class="trial" id="trial-' + esc(trial.id) + '">' +
        '<button type="button" class="trial__head" aria-expanded="' + open + '" aria-controls="trial-body-' +
        esc(trial.id) + '" data-acc="' + esc(trial.id) + '">' +
        '<span class="pill pill--' + esc(trial.statusType) + '">' + esc(trial.status) + '</span>' +
        '<span class="trial__titlewrap">' +
        '<span class="trial__short">' + esc(trial.short) + ' · ' + esc(trial.charge) + '</span>' +
        '<h3>' + esc(trial.title) + '</h3>' +
        '<span class="trial__meta">' + esc(trial.court) + ' · ' + esc(trial.defendants) + '</span>' +
        '</span>' +
        '<span class="trial__chev" aria-hidden="true">⌄</span>' +
        '</button>' +
        '<div class="trial__body" id="trial-body-' + esc(trial.id) + '"' + (open ? '' : ' hidden') + '>' +
        '<p class="keyline">' + esc(trial.keyLine) + '</p>' +
        '<p class="bodytext">' + esc(trial.body) + '</p>' +
        '<dl class="facts">' + facts + '</dl>' +
        '<div class="trial__cols">' +
        '<section><h4>기소 배경</h4>' + bulletsHtml(trial.background) + '</section>' +
        '<section><h4>법정 공방</h4>' + bulletsHtml(trial.dispute) + '</section>' +
        '</div>' +
        '<div class="trial__block"><div class="ruling' + (trial.rulingState === 'pending' ? ' ruling--pending' : '') + '">' +
        '<h4>' + (trial.rulingState === 'pending' ? '현재 진행 상황' : '판시 요지') + '</h4>' +
        bulletsHtml(trial.ruling) + '</div></div>' +
        timeline +
        note +
        podLinksHtml(trial.id) +
        sourcesHtml(trial.sources) +
        '</div></article>';
    }).join('');

    var countEl = $('#trial-count');
    if (countEl) {
      countEl.textContent = '재판 ' + DATA.trials.length + '건 · 확정 ' +
        DATA.trials.filter(function (t) { return t.rulingState === 'decided'; }).length + '건 · 진행 중 ' +
        DATA.trials.filter(function (t) { return t.rulingState === 'pending'; }).length + '건';
    }
  }

  /* -------------------------------------------------------------- incidents */
  function renderYearChips() {
    var host = $('#year-chips');
    if (!host) return;
    var years = [];
    DATA.incidents.forEach(function (item) {
      if (years.indexOf(item.year) === -1) years.push(item.year);
    });
    years.sort(function (a, b) { return a - b; });

    var counts = {};
    DATA.incidents.forEach(function (item) { counts[item.year] = (counts[item.year] || 0) + 1; });

    host.innerHTML = '<button type="button" class="chip" data-year="all" aria-pressed="true">전체' +
      '<span class="chip__count">' + DATA.incidents.length + '</span></button>' +
      years.map(function (year) {
        return '<button type="button" class="chip" data-year="' + year + '" aria-pressed="false">' +
          year + '년<span class="chip__count">' + counts[year] + '</span></button>';
      }).join('');

    host.addEventListener('click', function (event) {
      var btn = event.target.closest('.chip');
      if (!btn) return;
      state.year = btn.dataset.year;
      $$('.chip', host).forEach(function (chip) {
        chip.setAttribute('aria-pressed', String(chip === btn));
      });
      renderIncidents();
    });
  }

  function renderIncidents() {
    var host = $('#incident-list');
    var countEl = $('#incident-count');
    if (!host) return;

    var list = DATA.incidents.filter(function (item) {
      return state.year === 'all' || String(item.year) === String(state.year);
    });

    host.innerHTML = list.map(function (item) {
      var pillClass = TYPE_PILL[item.type] || 'labor';
      var details = item.details && item.details.length ? bulletsHtml(item.details) : '';
      var after = item.after ? '<p class="incident__after"><strong>그 뒤</strong>' + esc(item.after) + '</p>' : '';
      var judgement = item.judgement && item.judgement.length
        ? '<div class="incident__judgement"><strong>법원 · 수사 결과</strong><ul>' +
          item.judgement.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul></div>'
        : '';

      return '<article class="incident' + (item.fatal ? ' incident--fatal' : '') + '" id="incident-' + esc(item.id) + '">' +
        '<div class="incident__card">' +
        '<div class="incident__top"><time class="incident__date" datetime="' + esc(item.date) + '">' +
        esc(item.dateLabel) + '</time><span class="pill pill--' + pillClass + '">' + esc(item.type) + '</span></div>' +
        '<h3>' + esc(item.title) + '</h3>' +
        '<p class="incident__where">' + esc(item.company) + ' · ' + esc(item.place) + '</p>' +
        '<p class="incident__summary">' + esc(item.summary) + '</p>' +
        '<button type="button" class="incident__more" aria-expanded="false" aria-controls="incident-body-' +
        esc(item.id) + '">자세히 보기</button>' +
        '<div class="incident__detail" id="incident-body-' + esc(item.id) + '" hidden>' +
        details + after + judgement +
        podLinksHtml(item.id) +
        sourcesHtml(item.sources) +
        '</div></div></article>';
    }).join('');

    if (countEl) {
      countEl.textContent = state.year === 'all'
        ? '전체 ' + DATA.incidents.length + '건 — 사망 ' + DATA.incidents.filter(function (i) { return i.fatal; }).length + '건'
        : state.year + '년 ' + list.length + '건';
    }
  }

  function renderPledge() {
    var host = $('#pledge');
    if (!host) return;
    var p = DATA.incidentExtras.pledge;
    var totalPromise = 1000;

    host.innerHTML =
      '<p class="pledge__eyebrow">PROMISE · ' + esc(p.date) + '</p>' +
      '<h2 id="pledge-title">' + esc(p.title) + '</h2>' +
      '<p class="pledge__body">' + esc(p.body) + '</p>' +
      '<div class="pledge__money"><strong>1,000</strong><span>억 원 / 3년</span></div>' +
      '<dl class="pledge__split">' + p.items.map(function (row) {
        return '<div><dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd></div>';
      }).join('') + '</dl>' +
      '<div class="pledge__cols">' +
      '<section><h3>그 뒤에 일어난 일</h3><ul class="pledge__after">' + p.after.map(function (row) {
        return '<li><time>' + esc(row.date) + '</time><span>' + esc(row.text) + '</span></li>';
      }).join('') + '</ul></section>' +
      '<section><h3>집행 내역 <span style="font-weight:500;color:#8f7d87">(막대는 1,000억 대비)</span></h3>' +
      '<ul class="pledge__spent">' + p.spent.map(function (row) {
        var value = parseInt(row.value, 10) || 0;
        return '<li><span>' + esc(row.label) + '</span><b>' + esc(row.value) + '</b>' +
          '<span class="track"><i style="width:' + Math.round(value / totalPromise * 100) + '%"></i></span></li>';
      }).join('') + '</ul>' +
      '<p class="pledge__hint">' + esc(p.spentNote) + '. 세 항목 합계 562억 원이며, 나머지 집행 내역은 공개 자료에 명시되지 않았습니다.</p></section>' +
      '</div>' +
      '<blockquote class="pledge__quote">“' + esc(p.quote) + '”<cite>' + esc(p.quoteBy) + '</cite></blockquote>';
  }

  function renderColdStats() {
    var host = $('#cold-stats');
    if (!host) return;
    var s = DATA.incidentExtras.stats;
    host.innerHTML = '<div><h3>' + esc(s.title) + '</h3><p>' + esc(s.body) + '</p>' +
      '<p style="margin-top:8px">출처: ' + esc(s.source) + '</p></div>' +
      '<div class="cold-stats__grid">' + s.items.map(function (row) {
        return '<div class="cold-stats__cell"><span>' + esc(row.label) + '</span><b>' + esc(row.value) + '</b></div>';
      }).join('') + '</div>';
  }

  /* --------------------------------------------------------------- podcasts */
  function renderPodHero() {
    var host = $('#pod-hero');
    if (!host) return;
    var p = DATA.podcasts;
    host.innerHTML =
      '<div class="pod-hero__body">' +
      '<div class="pod-hero__top"><div>' +
      '<p class="pod-hero__label">🎙️ ' + esc(p.network) + ' · ' + esc(p.show) + '</p>' +
      '<h3>' + esc(p.series) + '</h3>' +
      '<p class="pod-hero__show">출연 ' + esc(p.guest) + '</p>' +
      '</div></div>' +
      '<p class="pod-hero__desc">' + esc(p.intro) + '</p>' +
      '<div class="pod-hero__meta">' +
      '<span class="meta-pill">전체 <b>' + p.count + '</b>편</span>' +
      '<span class="meta-pill">기간 <b>' + esc(p.span) + '</b></span>' +
      '<span class="meta-pill">시리즈 <b>' + esc(p.series) + '</b></span>' +
      '</div>' +
      '<div class="pod-hero__actions">' +
      '<a class="btn btn--primary" href="' + esc(p.feedUrl) + '" target="_blank" rel="noopener">Apple Podcasts에서 시리즈 보기 ↗</a>' +
      '</div></div>' +
      '<div class="pod-hero__mark" aria-hidden="true"><span>8</span><small>YEARS<br>· 12 EPISODES ·</small></div>';
  }

  function renderPodcasts() {
    var host = $('#pod-list');
    if (!host) return;

    host.innerHTML = DATA.podcasts.episodes.map(function (ep) {
      var related = (ep.related || []).map(function (id) {
        var record = recordById[id];
        if (!record) return '';
        return '<button type="button" class="related-chip" data-record="' + esc(id) + '" data-record-tab="' +
          esc(record.tab) + '">' + esc(record.label) + ' →</button>';
      }).join('');

      return '<article class="episode" id="ep-' + esc(ep.code) + '">' +
        '<div class="episode__top"><span class="episode__code">EP ' + esc(ep.code) + '</span>' +
        '<span class="episode__date">' + esc(ep.dateLabel) + '</span></div>' +
        '<h4>' + esc(epTitle(ep)) + '</h4>' +
        '<p class="episode__guests">출연 ' + esc(ep.guests.join(' · ')) + '</p>' +
        '<p class="episode__desc">' + esc(ep.desc) + '</p>' +
        '<div class="episode__foot">' +
        '<a class="episode__listen" href="' + esc(ep.url) + '" target="_blank" rel="noopener">' +
        'Apple Podcasts <span aria-hidden="true">↗</span></a>' +
        (related ? '<div class="episode__related">' + related + '</div>' : '') +
        '</div></article>';
    }).join('');
  }

  /* ------------------------------------------------------------------- tabs */
  function bindTabs() {
    var tablist = $('.tabs__inner');
    if (!tablist) return;

    tablist.addEventListener('click', function (event) {
      var btn = event.target.closest('.tab');
      if (!btn) return;
      activateTab(btn.dataset.tab, { scroll: true });
    });

    tablist.addEventListener('keydown', function (event) {
      var keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (keys.indexOf(event.key) === -1) return;
      event.preventDefault();
      var tabs = $$('.tab', tablist);
      var current = tabs.indexOf(document.activeElement);
      var next = current;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next].focus();
      activateTab(tabs[next].dataset.tab, { scroll: false });
    });
  }

  function activateTab(name, options) {
    var opts = options || {};
    if (['brands', 'trials', 'incidents', 'podcasts'].indexOf(name) === -1) name = 'brands';
    state.tab = name;

    $$('.tab').forEach(function (tab) {
      var selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $$('.panel').forEach(function (panel) {
      panel.hidden = panel.id !== 'panel-' + name;
    });

    if (opts.hash !== false) {
      try { history.replaceState(null, '', '#' + name); } catch (err) { /* ignore */ }
    }

    if (opts.scroll) {
      var tabs = $('#tabs');
      var target = tabs ? tabs.getBoundingClientRect().top + window.pageYOffset : 0;
      window.scrollTo({ top: Math.max(0, target - 2), behavior: scrollBehavior() });
    }
  }

  function bindJumps() {
    document.addEventListener('click', function (event) {
      var go = event.target.closest('[data-goto]');
      if (go) {
        event.preventDefault();
        activateTab(go.dataset.goto, { scroll: true });
        return;
      }

      var podChip = event.target.closest('[data-ep-target]');
      if (podChip) {
        var code = podChip.dataset.epTarget;
        activateTab('podcasts', { scroll: false });
        focusRecord('ep-' + code);
        return;
      }

      var recordChip = event.target.closest('[data-record]');
      if (recordChip) {
        event.preventDefault();
        activateTab(recordChip.dataset.recordTab, { scroll: false });
        openRecord(recordChip.dataset.record);
        return;
      }
    });
  }

  function openRecord(id) {
    var trial = $('#trial-' + id);
    if (trial) {
      var head = $('.trial__head', trial);
      var body = $('.trial__body', trial);
      if (head && body && head.getAttribute('aria-expanded') === 'false') {
        head.setAttribute('aria-expanded', 'true');
        body.hidden = false;
      }
      setTimeout(function () { focusRecord('trial-' + id); }, 40);
      return;
    }
    var incident = $('#incident-' + id);
    if (incident) {
      var more = $('.incident__more', incident);
      var detail = $('.incident__detail', incident);
      if (more && detail && more.getAttribute('aria-expanded') === 'false') {
        more.setAttribute('aria-expanded', 'true');
        detail.hidden = false;
      }
      setTimeout(function () { focusRecord('incident-' + id); }, 40);
    }
  }

  function focusRecord(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    el.classList.remove('is-flash');
    /* reflow to restart the animation */
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 2400);
  }

  /* -------------------------------------------------------------- accordions */
  function bindAccordions() {
    document.addEventListener('click', function (event) {
      var head = event.target.closest('.trial__head');
      if (head) {
        var body = document.getElementById(head.getAttribute('aria-controls'));
        var open = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', String(!open));
        if (body) body.hidden = open;
        return;
      }

      var more = event.target.closest('.incident__more');
      if (more) {
        var detail = document.getElementById(more.getAttribute('aria-controls'));
        var isOpen = more.getAttribute('aria-expanded') === 'true';
        more.setAttribute('aria-expanded', String(!isOpen));
        more.textContent = isOpen ? '자세히 보기' : '접기';
        if (detail) detail.hidden = isOpen;
      }
    });

    var toggleAll = $('#trial-toggle-all');
    if (toggleAll) {
      toggleAll.addEventListener('click', function () {
        var heads = $$('.trial__head');
        var anyClosed = heads.some(function (head) { return head.getAttribute('aria-expanded') === 'false'; });
        heads.forEach(function (head) {
          head.setAttribute('aria-expanded', String(anyClosed));
          var body = document.getElementById(head.getAttribute('aria-controls'));
          if (body) body.hidden = !anyClosed;
        });
        toggleAll.textContent = anyClosed ? '모두 접기' : '모두 펼치기';
        toggleAll.setAttribute('aria-pressed', String(anyClosed));
      });
    }
  }

  /* ------------------------------------------------------------------ search */
  function bindSearch() {
    var input = $('#brand-search');
    var clear = $('#search-clear');
    var reset = $('#empty-reset');
    if (!input) return;

    var timer = null;
    input.addEventListener('input', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        state.brandQuery = input.value;
        renderBrands();
      }, 70);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        state.brandQuery = '';
        renderBrands();
      }
    });

    if (clear) {
      clear.addEventListener('click', function () {
        input.value = '';
        state.brandQuery = '';
        input.focus();
        renderBrands();
      });
    }

    if (reset) {
      reset.addEventListener('click', function () {
        input.value = '';
        state.brandQuery = '';
        state.brandCat = 'all';
        $$('#brand-chips .chip').forEach(function (chip) {
          chip.setAttribute('aria-pressed', String(chip.dataset.cat === 'all'));
        });
        renderBrands();
      });
    }
  }

  /* ------------------------------------------------------------------ to top */
  function bindToTop() {
    var btn = $('#to-top');
    if (!btn) return;
    var onScroll = function () {
      btn.hidden = window.pageYOffset < 640;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
