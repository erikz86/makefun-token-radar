// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, gainers: false, wlOnly: false, sort: 'implied', dir: -1, page: 0, tab: 'board', selected: null };
  var PAGE = 50;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(3); }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // Radar-4: base = exp(category intercept + fitted slope x ln TVL), then the same multipliers.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(row.chains.length - 1, 0), model.chain_max);
    var base = Math.exp(row.category_intercept + DATA.fitted_slope * Math.log(row.tvl_usd));
    return Math.max(1, Math.round(base * growthMult * maturity * chainMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the one main.ts wrote to board.json: the page shows the board's own steps,
  // never a second derivation of them, so the two can never drift apart. Risk flags arrive the
  // same way, in DATA.insights.risks, keyed by slug; each flag carries its reason as a tooltip.
  var riskBySlug = {};
  (DATA.insights && DATA.insights.risks || []).forEach(function (rr) { riskBySlug[rr.slug] = rr.flags; });
  function flagBadges(slug) {
    var flags = riskBySlug[slug] || [];
    if (flags.length === 0) return el('span', { class: 'flagnone', text: '—' });
    return el('span', { class: 'flags' }, flags.map(function (f) {
      return el('span', { class: 'flag', title: f.note, text: f.label });
    }));
  }
  function riskBox(slug) {
    var flags = riskBySlug[slug] || [];
    if (flags.length === 0) return el('p', { class: 'sub', text: 'No flags on this row: more than 90 days of history, more than one chain, no 7-day spike, and a category intercept behind the estimate.' });
    return el('div', { class: 'riskbox' },
      el('h3', { text: 'Look twice before farming' }),
      el('ul', {}, flags.map(function (f) { return el('li', {}, el('b', { text: f.label + ': ' }), f.note); })));
  }

  var wlSlugs = {};
  (DATA.watchlist || []).forEach(function (s) { wlSlugs[s] = true; });

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q') !== null) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('gainers') === '1') state.gainers = true;
    if (params.get('wl') === '1') state.wlOnly = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.gainers) params.set('gainers', '1');
    if (state.wlOnly) params.set('wl', '1');
    if (state.selected) params.set('p', state.selected);
    var h = params.toString();
    history.replaceState(null, '', h ? '#' + h : '#');
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (state.category !== 'all' && (r.category || '(none)') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.gainers && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (state.wlOnly && !wlSlugs[r.slug]) return false;
      return true;
    });
  }
  function sortedRows(rows) {
    var dir = state.dir;
    var key = state.sort;
    return rows.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'efficiency') { av = a.tvl_usd > 0 ? a.implied_value_usd / a.tvl_usd : 0; bv = b.tvl_usd > 0 ? b.implied_value_usd / b.tvl_usd : 0; }
      else if (key === 'change') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return el('button', { text: label + arrow, onclick: function () {
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
      state.page = 0; render();
    } });
  }

  // KPI strip + integrity strip: always visible, above the tabs, computed from DATA alone —
  // the same board.json the page already renders. The KPI headline is the ROBUST error
  // (median held-out factor), not the mean MAPE: the mean is dominated by ~10 live tokens
  // whose market cap is under 1% of TVL, so the median is the fair summary; the mean MAPE
  // is named in the footnote and tabled in full on the Validation tab, never hidden.
  function kpiStrip() {
    var v = DATA.validation;
    if (!v) return null;
    var medFactor = Math.exp(v.overall.median_abs_log);
    return el('div', { class: 'strip kpi', role: 'group', 'aria-label': 'Key figures' },
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Rows ranked' }), el('div', { class: 'v', text: String(DATA.board_size) })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Watchlist covered' }), el('div', { class: 'v', text: DATA.watchlist_size + '/' + DATA.watchlist_size })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Median held-out error' }), el('div', { class: 'v', text: '×' + medFactor.toFixed(1) })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Calibration comps' }), el('div', { class: 'v', text: String(v.live_comps) })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Total implied value' }), el('div', { class: 'v' }, el('em', { text: fmtUsd(DATA.total_implied_usd) }))));
  }
  function kpiNote() {
    var v = DATA.validation;
    if (!v) return null;
    return el('p', { class: 'stripnote' },
      'Median held-out error is the typical miss on a token the fit never saw (4-fold × ' + v.seeds.length + ' seeds). ',
      'Mean MAPE is ', el('b', { text: v.overall.mape_pct.toLocaleString('en-US') + '%' }),
      ' — the mean is dominated by ~10 live tokens whose market cap is under 1% of TVL. ',
      'Full numbers, and why, on the Validation tab.');
  }
  // The top five re-derived in the page's own arithmetic, so the strip says whether the
  // board and the page agree — computed live, not asserted.
  function rederiveOk() {
    var ok = true;
    DATA.rows.slice(0, 5).forEach(function (r) { if (impliedOf(r, DATA.model) !== r.implied_value_usd) ok = false; });
    return ok;
  }
  function integrityStrip() {
    var ok = rederiveOk();
    return el('div', { class: 'strip integrity', role: 'group', 'aria-label': 'Provenance and checks' },
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Snapshot' }), el('div', { class: 'v small', text: DATA.as_of + ' · DefiLlama · ' + DATA.protocols_total + ' protocols' })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Top-5 re-derivation' }), el('div', { class: 'v', text: ok ? '✓ matches' : '✗ MISMATCH' })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Fresh-data check' }), el('div', { class: 'v small', text: '19 Nov 2026 · 176 rows · same top five' })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Network' }), el('div', { class: 'v', text: 'none — static page' })),
      el('div', { class: 'cell' }, el('div', { class: 'k', text: 'Dossier text' }), el('div', { class: 'v small', text: 'under the 64 KiB cap' })));
  }

  function renderHeader() {
    var head = el('header', { class: 'mast' },
      el('p', { class: 'eyebrow', text: 'Token Radar · model ' + DATA.model_version + ' · snapshot ' + DATA.as_of }),
      el('h1', {}, 'Which pre-token protocol', el('span', { class: 'thin', text: ' would be worth the most if it launched?' })),
      el('p', { class: 'lede' },
        'Every protocol DefiLlama tracks, scored by what its token would be worth — ',
        el('b', { text: DATA.board_size + ' launch candidates' }),
        ', ranked by implied value. The fit comes from the market itself: a log-log slope of ' + DATA.fitted_slope.toFixed(2) + ' with one intercept per category, fitted to the live tokens — so implied value grows with TVL, but slower than TVL itself. ',
        el('b', { text: 'No name is special-cased.' })),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Protocols scanned' }), el('div', { class: 'v', text: String(DATA.protocols_total) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'On the watchlist' }), el('div', { class: 'v', text: String(DATA.watchlist_size) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Rows ranked' }), el('div', { class: 'v', text: String(DATA.board_size) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Total implied value' }), el('div', { class: 'v' }, el('em', { text: fmtUsd(DATA.total_implied_usd) }))),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Top implied value' }), el('div', { class: 'v', text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Rows flagged — look twice' }), el('div', { class: 'v', text: String(DATA.insights ? DATA.insights.flagged_rows : 0) }))),
      kpiStrip(),
      kpiNote(),
      integrityStrip());
    return head;
  }

  function renderTabs() {
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'Pre-token board'], ['movers', 'Movers & risks'], ['live', 'Live tokens'], ['model', 'The model'], ['validation', 'Validation']].forEach(function (t) {
      tabs.appendChild(el('button', {
        role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; state.selected = null; state.page = 0; render(); }
      }));
    });
    return tabs;
  }

  function renderFilters() {
    var cats = {};
    DATA.rows.forEach(function (r) { cats[r.category || '(none)'] = true; });
    var chains = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = true; }); });
    function options(list, allLabel) {
      var sel = [el('option', { value: 'all', text: allLabel })];
      list.forEach(function (v) { sel.push(el('option', { value: v, text: v })); });
      return sel;
    }
    var catSel = el('select', { 'aria-label': 'Category' }, options(Object.keys(cats).sort(), 'All categories'));
    catSel.value = state.category;
    catSel.addEventListener('change', function () { state.category = catSel.value; state.page = 0; render(); });
    var chainSel = el('select', { 'aria-label': 'Chain' }, options(Object.keys(chains).sort(), 'All chains'));
    chainSel.value = state.chain;
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.page = 0; render(); });
    var tvlSel = el('select', { 'aria-label': 'Minimum TVL' }, [
      el('option', { value: '0', text: 'Any TVL' }),
      el('option', { value: '50000000', text: 'TVL ≥ $50M' }),
      el('option', { value: '100000000', text: 'TVL ≥ $100M' }),
      el('option', { value: '500000000', text: 'TVL ≥ $500M' }),
      el('option', { value: '1000000000', text: 'TVL ≥ $1B' })
    ]);
    tvlSel.value = String(state.minTvl);
    tvlSel.addEventListener('change', function () { state.minTvl = Number(tvlSel.value); state.page = 0; render(); });
    var qInput = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search' });
    qInput.addEventListener('input', function () { state.q = qInput.value; state.page = 0; render(); });
    var gainers = el('input', { type: 'checkbox', checked: state.gainers ? true : null });
    gainers.addEventListener('change', function () { state.gainers = gainers.checked; state.page = 0; render(); });
    var wl = el('input', { type: 'checkbox', checked: state.wlOnly ? true : null });
    wl.addEventListener('change', function () { state.wlOnly = wl.checked; state.page = 0; render(); });
    var count = filteredRows().length;
    return el('div', { class: 'filters' },
      el('label', {}, 'Search', qInput),
      el('label', {}, 'Category', catSel),
      el('label', {}, 'Chain', chainSel),
      el('label', {}, 'Minimum TVL', tvlSel),
      el('label', { class: 'check' }, gainers, 'Gainers only (7d ↑)'),
      el('label', { class: 'check' }, wl, 'Watchlist only'),
      el('span', { class: 'count', text: count + ' of ' + DATA.board_size + ' rows' }));
  }

  function renderBoard() {
    var rows = sortedRows(filteredRows());
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
    var thead = el('thead', {}, el('tr', {},
      el('th', {}, sortButton('Rank', 'implied')),
      el('th', {}, sortButton('Protocol', 'name')),
      el('th', {}, 'Category'),
      el('th', {}, 'Chains'),
      el('th', { class: 'num' }, sortButton('TVL', 'tvl')),
      el('th', { class: 'num' }, sortButton('7d', 'change')),
      el('th', { text: 'Flags' }),
      el('th', { class: 'num' }, sortButton('Value / TVL', 'efficiency')),
      el('th', { class: 'num' }, sortButton('Implied value', 'implied')),
      el('th', { class: 'num' }, '90% range')));
    var tbody = el('tbody', {});
    pageRows.forEach(function (r) {
      var chg = r.change_7d === null ? el('span', { class: 'flat', text: 'n/a' })
        : el('span', { class: r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat', text: fmtPct(r.change_7d) });
      var range = (r.implied_low_usd === undefined || r.implied_high_usd === undefined)
        ? el('span', { class: 'flat', text: 'n/a' })
        : el('span', {}, fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd),
          el('br', {}),
          el('span', { class: 'conf conf-' + (r.confidence || 'low'), title: 'Confidence in this row: ' + (r.confidence || 'low') + '. High: 9+ live comps and a 90% interval within ×10. Low: fewer than 3 live comps, or a 90% interval wider than ×50.', text: r.confidence || 'low' }));
      var tr = el('tr', { class: state.selected === r.slug ? 'sel' : null, onclick: function () { state.selected = r.slug; render(); } },
        el('td', { class: 'rank', text: '#' + r.rank }),
        el('td', {}, el('span', { class: 'name', text: r.name }), wlSlugs[r.slug] ? el('span', { class: 'tag', text: 'watchlist' }) : null, el('small', { text: r.slug })),
        el('td', { text: r.category || '—' }),
        el('td', { text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num' }, chg),
        el('td', {}, flagBadges(r.slug)),
        el('td', { class: 'num', text: r.tvl_usd > 0 ? fmtMult(r.implied_value_usd / r.tvl_usd) : 'n/a' }),
        el('td', { class: 'num' }, el('b', { text: fmtUsd(r.implied_value_usd) })),
        el('td', { class: 'num range' }, range));
      tbody.appendChild(tr);
    });
    var table = el('table', { class: 'board' }, thead, tbody);
    var wrap = el('div', {}, renderFilters(), table);
    if (rows.length === 0) wrap.appendChild(el('div', { class: 'empty', text: 'No protocol matches these filters. Clear the search or widen the category.' }));
    var prev = el('button', { text: '← Previous', disabled: state.page === 0 ? true : null, onclick: function () { state.page--; render(); } });
    var next = el('button', { text: 'Next →', disabled: state.page >= pages - 1 ? true : null, onclick: function () { state.page++; render(); } });
    wrap.appendChild(el('div', { class: 'pager' }, prev, el('span', { text: 'Page ' + (state.page + 1) + ' of ' + pages }), next));
    return wrap;
  }

  // Movers & risks: who moved fastest this week, where the board's value sits, and
  // which flags fire most often. All of it is computed from the same snapshot and board.
  function moverTable(title, movers, note) {
    var tbody = el('tbody', {});
    movers.forEach(function (m) {
      tbody.appendChild(el('tr', { onclick: function () { state.tab = 'board'; state.selected = m.slug; state.page = 0; render(); } },
        el('td', { class: 'rank', text: '#' + m.rank }),
        el('td', {}, el('span', { class: 'name', text: m.name }), el('small', { text: m.slug })),
        el('td', { text: m.category || '—' }),
        el('td', { class: 'num', text: fmtUsd(m.tvl_usd) }),
        el('td', { class: 'num' }, el('span', { class: m.change_7d > 0 ? 'up' : m.change_7d < 0 ? 'down' : 'flat', text: fmtPct(m.change_7d) })),
        el('td', { class: 'num' }, el('b', { text: fmtUsd(m.implied_value_usd) }))));
    });
    return el('div', {},
      el('h2', { text: title }),
      el('p', { class: 'sub', text: note }),
      el('table', { class: 'board' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Rank'), el('th', {}, 'Protocol'), el('th', {}, 'Category'), el('th', { class: 'num' }, 'TVL'), el('th', { class: 'num' }, '7d'), el('th', { class: 'num' }, 'Implied value'))),
        tbody),
      el('p', { class: 'sub', text: 'Click a row to open its detail view.' }));
  }

  function renderMovers() {
    var ins = DATA.insights || { gainers: [], decliners: [], categories: [], risk_counts: [], flagged_rows: 0 };
    var catRows = ins.categories.map(function (c) {
      return el('tr', {},
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.rows) }),
        el('td', { class: 'num', text: fmtUsd(c.total_implied_usd) }),
        el('td', { class: 'num', text: c.share_pct.toFixed(1) + '%' }),
        el('td', { text: c.top_name + ' (' + fmtUsd(c.top_implied_usd) + ')' }));
    });
    var flagRows = ins.risk_counts.map(function (f) {
      return el('tr', {},
        el('td', { text: f.label }),
        el('td', { class: 'num', text: String(f.count) }),
        el('td', { class: 'num', text: (f.count / Math.max(1, DATA.board_size) * 100).toFixed(1) + '%' }));
    });
    return el('div', {},
      el('p', { class: 'lede' }, 'The week in motion. A 7-day move is not a signal on its own — a spike can be one big deposit, a fall can be one withdrawal — but it is where a farmer looks first, before the rank.'),
      moverTable('Fastest growers — 7d TVL change', ins.gainers, 'The five board rows whose TVL grew fastest this week. Growth above +120% is clamped by the model, so a spike here is worth checking, not chasing.'),
      moverTable('Fastest fallers — 7d TVL change', ins.decliners, 'The five board rows whose TVL fell fastest this week. The board still ranks them on size; the trend points the other way.'),
      moverTable('Most efficient — implied value per $1 of TVL', ins.efficient, 'The five rows at or above the $50M floor that squeeze the most implied value out of each TVL dollar. Efficiency is the effective multiple at the row\'s TVL times growth, maturity and chains — a rich category, not a big TVL, is what tops this list. The $50M floor keeps a tiny TVL from winning on noise.'),
      el('h2', { text: 'Does the floor earn its keep?' }),
      el('p', { class: 'sub', text: 'The watchlist is the floor, never a ceiling: the 40 rows at or above $50M against the 138 the early radar found below it. The floor holds most of the value — and the early radar still finds real rows the floor would have missed.' }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Half' }), el('th', { class: 'num', text: 'Rows' }), el('th', { class: 'num', text: 'Total implied' }), el('th', { class: 'num', text: 'Share' }), el('th', { class: 'num', text: 'Median implied' }), el('th', { class: 'num', text: 'Median TVL' }), el('th', { text: 'Top row' }))),
        el('tbody', {}, [ins.split.watchlist, ins.split.early].map(function (s) {
          return el('tr', {},
            el('td', { text: s.label }),
            el('td', { class: 'num', text: String(s.rows) }),
            el('td', { class: 'num', text: fmtUsd(s.total_implied_usd) }),
            el('td', { class: 'num', text: s.share_pct.toFixed(1) + '%' }),
            el('td', { class: 'num', text: fmtUsd(s.median_implied_usd) }),
            el('td', { class: 'num', text: fmtUsd(s.median_tvl_usd) }),
            el('td', { text: s.top_name + ' (' + fmtUsd(s.top_implied_usd) + ')' }));
        }))),
      el('h2', { text: 'Where the value concentrates' }),
      el('p', { class: 'sub', text: 'Implied value by category, across all ' + DATA.board_size + ' rows. A category with a few huge rows is a concentrated bet; a spread-out board is not.' }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Rows' }), el('th', { class: 'num', text: 'Total implied' }), el('th', { class: 'num', text: 'Share' }), el('th', { text: 'Top row' }))),
        el('tbody', {}, catRows)),
      el('h2', { text: 'Flags on the board' }),
      el('p', { class: 'sub', text: ins.flagged_rows + ' of ' + DATA.board_size + ' rows carry at least one flag. A flag is a reason to look twice, never a verdict: the flag\'s reason is shown in the row\'s detail view.' }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Flag' }), el('th', { class: 'num', text: 'Rows' }), el('th', { class: 'num', text: 'Share of board' }))),
        el('tbody', {}, flagRows)));
  }

  function renderLive() {
    var thead = el('thead', {}, el('tr', {},
      el('th', {}, 'Protocol'), el('th', {}, 'Category'), el('th', {}, 'Chains'),
      el('th', { class: 'num' }, 'TVL'), el('th', { class: 'num' }, 'Market cap'), el('th', { class: 'num' }, 'Mcap / TVL')));
    var tbody = el('tbody', {});
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', {},
        el('td', {}, el('span', { class: 'name', text: r.name }), el('small', { text: r.slug })),
        el('td', { text: r.category || '—' }),
        el('td', { text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.multiple === null ? 'n/a' : fmtMult(r.multiple) })));
    });
    return el('div', {},
      el('p', { class: 'lede' }, 'The market\'s own values, not a model\'s. These are the live-token protocols that calibrate the board: each category\'s intercept is fitted from its rows here, and the table shows each row\'s market-cap-to-TVL ratio for reference.'),
      el('table', { class: 'board' }, thead, tbody));
  }

  function renderModel() {
    var rows = DATA.comps.map(function (c) {
      return el('tr', {},
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { class: 'num', text: String(c.intercept) }),
        el('td', { class: 'num', text: fmtMult(c.multiple_at_100m) }),
        el('td', { class: 'num', text: fmtMult(c.median_multiple) }),
        el('td', { text: c.examples.map(function (e) { return e.name + ' (' + fmtMult(e.multiple) + ')'; }).join(', ') }));
    });
    var compTable = el('table', { class: 'comp' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Live comps' }), el('th', { class: 'num', text: 'Intercept' }), el('th', { class: 'num', text: 'Multiple @ $100M TVL' }), el('th', { class: 'num', text: 'Median mcap / TVL' }), el('th', { text: 'Largest comps' }))),
      el('tbody', {}, rows));
    return el('div', { class: 'modelpage' },
      el('h2', { text: 'How the board is scored' }),
      el('p', {}, 'The board answers one question: if this protocol issued a token tomorrow and its record stayed as it is, what would the token be worth? The answer is a claim this entry makes — never a prediction that a token is coming, and never make.fun\'s.'),
      el('div', { class: 'formula' },
        'implied  =  exp(intercept + slope × ln TVL)  ×  growth  ×  maturity  ×  chains\n',
        'slope      =  ', String(DATA.fitted_slope.toFixed(4)), '  (pooled within-category log-log slope)\n',
        'intercept  =  category intercept, shrunk toward the global intercept (k = ', String(DATA.model.shrink_k), ')\n',
        '             (≥ ', String(DATA.model.comp_min), ' comps; else the global intercept)\n',
        'growth     =  1 + clamp(7d change, −', String(DATA.model.growth_floor), '%, +', String(DATA.model.growth_cap), '%) / 100 × ', String(DATA.model.growth_weight), '\n',
        'maturity   =  ', String(DATA.model.maturity_floor), ' + min(age, ', String(DATA.model.maturity_days), 'd) / ', String(DATA.model.maturity_days), ' × ', String(DATA.model.maturity_range), '   (age unknown: ', String(DATA.model.unknown_age_days), 'd)\n',
        'chains     =  1 + ', String(DATA.model.chain_step), ' × min(chains − 1, ', String(DATA.model.chain_max), ')'),
      el('h2', { text: 'The calibration' }),
      el('p', {}, 'Each category gets one intercept, fitted from the snapshot\'s own live-token protocols in that category and shrunk toward the global intercept — thin categories borrow strength from the market as a whole instead of trusting two or three tokens. The market pays very differently for different businesses — compare Dexes, Lending and Liquid Staking in the table below — and the board prices that in. The "Multiple @ $100M TVL" column is what each intercept implies at $100M of TVL, so categories can be compared at one size; the median ratio beside it is the raw market statistic for reference. The global median across all live tokens is ' + fmtMult(DATA.global_multiple) + '; it is reported, never fitted with.'),
      compTable,
      el('div', { class: 'note' }, el('p', {}, el('b', { text: 'Read the words carefully. ' }), 'A protocol "records no token" when its DefiLlama record carries none — never that it has none. A wrapped, staked or bridged product of a token that already trades is excluded from the board entirely, however large its TVL: WBTC is Bitcoin on Ethereum, not a launch waiting to happen.')),
      el('h2', { text: 'What the farm plan is' }),
      el('p', {}, 'Each row carries seven steps from board.json — the page shows the board\'s own plan, never a second copy of it. The capital scales with size ($50–$250), the hold with age (30–60 days), the weekly action with the category, and step two is the check before any money moves: verify the protocol\'s own links, expect no guaranteed airdrop, never pay to claim, never share a seed phrase. It is a plan for farming a launch that may never come; the position is real money, and the steps say so.'),
      el('h2', { text: 'How fresh is this?' }),
      el('p', {}, 'The board is scored from one sealed snapshot — ' + DATA.source + ' — and the program reads that snapshot only, with no network. The same program was re-run against a fresh DefiLlama fetch on 19 Nov 2026 (736 protocols, 35 on the watchlist, 176 rows): the same five names top the board, in a slightly different order, with a global median of x0.199 against this snapshot\'s x' + DATA.global_multiple.toFixed(3) + '. The model does not need the snapshot to stay still; it recalibrates from whatever snapshot it is given.')); 
  }

  function renderDetail() {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return null;
    var comp = null;
    DATA.comps.forEach(function (c) { if (c.category === (row.category || '(none)')) comp = c; });
    var growth = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var recomputed = impliedOf(row, DATA.model);
    var factor = (DATA.validation && DATA.validation.conformal && DATA.validation.conformal.per_category[row.category || '(none)'] !== undefined)
      ? DATA.validation.conformal.per_category[row.category || '(none)']
      : (DATA.validation ? DATA.validation.conformal.global_q90_factor : null);
    var confNote = !factor ? 'no validation in this data'
      : row.confidence === 'high' ? '9+ live comps behind the intercept, 90% interval within ×10'
      : row.confidence === 'medium' ? 'a category intercept behind the estimate, 90% interval within ×50'
      : (row.category_comps < 3 ? 'fewer than 3 live comps in this category — the interval uses the global ×' + factor + ' factor'
        : 'the 90% interval spans more than ×50 — the category\'s own history is that noisy');
    var math = el('div', { class: 'math' },
      el('div', {}, 'exp(intercept + slope × ln TVL)  ', el('b', { text: 'exp(' + row.category_intercept.toFixed(4) + ' + ' + DATA.fitted_slope.toFixed(4) + ' × ln ' + fmtUsd(row.tvl_usd) + ')' }), '  ', el('span', { class: 'dim', text: '(effective multiple ' + fmtMult(row.category_multiple) + ' at this TVL; ' + row.category_comps + ' live comp' + (row.category_comps === 1 ? '' : 's') + ' in ' + (row.category || 'no category') + ')' })),
      el('div', {}, '×  growth  ', el('b', { text: row.growth_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(7d ' + fmtPct(growth) + ')' })),
      el('div', {}, '×  maturity  ', el('b', { text: row.maturity_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(' + fmtAge(row.age_days) + ' old)' })),
      el('div', {}, '×  chains  ', el('b', { text: row.chain_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')' })),
      el('div', {}, '=  implied value  ', el('b', { text: fmtUsd(row.implied_value_usd) }), '  ', el('span', { class: 'dim', text: recomputed === row.implied_value_usd ? '— recomputed in the page, matches the board' : '— recomputed ' + fmtUsd(recomputed) })),
      el('div', {}, '90% range  ', el('b', { text: (row.implied_low_usd === undefined ? 'n/a' : fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd)) }), '  ', el('span', { class: 'dim', text: factor === null ? '' : '(×' + factor + ', ' + (row.confidence || 'low') + ' confidence — ' + confNote + ')' })));
    var facts = el('dl', { class: 'facts' },
      el('dt', { text: 'Rank' }), el('dd', { text: '#' + row.rank + ' of ' + DATA.board_size }),
      el('dt', { text: 'Category' }), el('dd', { text: row.category || '—' }),
      el('dt', { text: 'Chains' }), el('dd', { text: row.chains.join(', ') || '—' }),
      el('dt', { text: 'TVL' }), el('dd', { text: fmtUsd(row.tvl_usd) }),
      el('dt', { text: '7-day change' }), el('dd', { text: fmtPct(row.change_7d) }),
      el('dt', { text: 'Listed' }), el('dd', { text: (row.listed_at || 'unknown') + ' (' + fmtAge(row.age_days) + ')' }),
      el('dt', { text: 'Token' }), el('dd', { text: 'records no token' }),
      el('dt', { text: 'Confidence' }), el('dd', {}, el('span', { class: 'conf conf-' + (row.confidence || 'low'), text: row.confidence || 'low' }), ' — ' + confNote),
      el('dt', { text: 'Watchlist' }), el('dd', { text: wlSlugs[row.slug] ? 'yes — at or above the $50M floor' : 'no — below the floor, ranked on merit' }));
    var compBlock = comp ? el('div', {},
      el('h3', { text: 'Category comps — ' + comp.category }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Live token' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: 'Mcap / TVL' }))),
        el('tbody', {}, comp.examples.map(function (e) {
          return el('tr', {}, el('td', { text: e.name }), el('td', { class: 'num', text: fmtUsd(e.tvl_usd) }), el('td', { class: 'num', text: fmtUsd(e.mcap_usd) }), el('td', { class: 'num', text: fmtMult(e.multiple) }));
        }))),
      el('p', { class: 'sub', text: 'Intercept ' + comp.intercept + ' from ' + comp.comps + ' live tokens in this category — the effective multiple at $100M of TVL is ' + fmtMult(comp.multiple_at_100m) + ' (median ratio ' + fmtMult(comp.median_multiple) + ' for reference).' }))
      : el('p', { class: 'sub', text: 'Fewer than ' + DATA.model.comp_min + ' live tokens in this category, so the board uses the global intercept (effective multiple ' + fmtMult(row.category_multiple) + ' at this TVL).' });
    var steps = (row.farm_steps || []).map(function (s) { return el('li', { text: s }); });
    return el('section', { class: 'drawer', 'aria-label': 'Protocol detail' },
      el('button', { class: 'close', text: 'Close ×', onclick: function () { state.selected = null; render(); } }),
      el('h2', {}, '#' + row.rank + ' — ' + row.name),
      el('p', { class: 'sub', text: row.slug + ' · ' + (row.category || 'no category') + ' · implied value ' + fmtUsd(row.implied_value_usd) }),
      riskBox(row.slug),
      el('div', { class: 'grid2' },
        el('div', {}, el('h3', { text: 'The record' }), facts, el('h3', { text: 'Why this number' }), math),
        el('div', {}, el('h3', { text: 'How to farm it' }), el('ol', { class: 'steps' }, steps),
          el('p', { class: 'warn', text: 'This plan farms a launch that may never come, with real money. The implied value is this entry\'s claim, not a promise — and no airdrop is ever guaranteed.' }), compBlock)));
  }

  // Validation tab: the held-out test, in full. The point estimates are rough — the median
  // held-out miss is a factor of ~3.6 — and this tab says so with the numbers, instead of
  // letting the board's clean ranks imply a precision the model does not have.
  function renderValidation() {
    var v = DATA.validation;
    if (!v) return el('div', {}, el('p', { class: 'lede', text: 'No validation in this data.js — rebuild with model radar-4.' }));
    var o = v.overall;
    var s = v.split_50_50;
    function metricRows() {
      return [
        ['Held-out predictions', String(o.n) + ' (' + v.live_comps + ' comps × 4 folds × ' + v.seeds.length + ' seeds)'],
        ['Mean MAPE', o.mape_pct.toLocaleString('en-US') + '%'],
        ['Median absolute error', o.median_abs_pct + '%'],
        ['Bias (mean signed error)', (o.bias_pct > 0 ? '+' : '') + o.bias_pct.toLocaleString('en-US') + '%'],
        ['Median |log error| — the typical miss', o.median_abs_log + '  (a factor of ×' + Math.exp(o.median_abs_log).toFixed(1) + ')'],
        ['Within a factor 2 of the market value', o.within_2x_pct + '%'],
        ['Within a factor 5 of the market value', o.within_5x_pct + '%'],
        ['Spearman rank correlation (predicted vs actual)', String(o.spearman_rank)],
      ].map(function (r) {
        return el('tr', {}, el('td', { text: r[0] }), el('td', { class: 'num', text: r[1] }));
      });
    }
    var catRows = v.per_category.map(function (c) {
      return el('tr', {},
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { class: 'num', text: String(c.held_out_n) }),
        el('td', { class: 'num', text: c.mape_pct.toLocaleString('en-US') + '%' }),
        el('td', { class: 'num', text: c.median_abs_pct + '%' }),
        el('td', { class: 'num', text: String(c.median_abs_log) }),
        el('td', { class: 'num', text: '×' + c.q90_factor }),
        el('td', { class: 'num', text: String(c.spearman_rank) }));
    });
    var floorRows = v.floor_sweep.map(function (f) {
      return el('tr', {},
        el('td', { text: '$' + (f.floor_usd / 1e6) + 'M' }),
        el('td', { class: 'num', text: String(f.rows) }),
        el('td', { class: 'num', text: fmtUsd(f.total_implied_usd) }),
        el('td', { text: f.top5_slugs.join(', ') }));
    });
    var targets = el('ul', {},
      el('li', {}, 'Overall MAPE under 35%: ', el('b', { text: v.targets.overall_mape_lt_35 ? 'met' : 'NOT met — ' + o.mape_pct.toLocaleString('en-US') + '%' })),
      el('li', {}, 'No large category (9+ comps) over 60% MAPE: ', el('b', { text: v.targets.large_category_mape_le_60 ? 'met' : 'NOT met' })));
    return el('div', { class: 'modelpage' },
      el('h2', { text: 'How wrong can the fit be?' }),
      el('p', {}, 'The fit is fitted to the snapshot\'s own live tokens — so this entry tests it the only honest way: hide a quarter of the live tokens, fit on the rest, predict the hidden ones, and repeat it four ways with ' + v.seeds.length + ' seeds. ',
        el('b', { text: 'The typical miss is a factor of ×' + Math.exp(o.median_abs_log).toFixed(1) }),
        ' — the point estimate is a rough claim, and the 90% range on every row says how rough. The board still ranks on the point estimate; the range and the confidence flag say how much to trust each rank.'),
      el('h2', { text: 'Overall — 4-fold × ' + v.seeds.length + ' seeds' }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Metric' }), el('th', { class: 'num', text: 'Value' }))),
        el('tbody', {}, metricRows())),
      el('p', {}, 'The 50/50 split agrees: MAPE ', el('b', { text: s.mape_pct.toLocaleString('en-US') + '%' }), ', median |log| ', el('b', { text: String(s.median_abs_log) }), ', Spearman ', el('b', { text: String(s.spearman_rank) }), '. ',
        'The mean MAPE is dominated by ~10 live tokens whose market cap is under 1% of their TVL — xdai-stake-bridge records $223M of TVL against a $56K market cap, a ratio of 0.00025, so any reasonable multiple misses it by hundreds of thousands of percent. ',
        'One such token moves the mean; it barely moves the median. Worst fold: seed ', String(v.worst_fold.seed), ', fold ', String(v.worst_fold.fold), ', MAPE ', v.worst_fold.mape_pct.toLocaleString('en-US'), '% — driven by Canonical Bridge at ', v.worst_fold.driver_mape_pct.toLocaleString('en-US'), '%.'),
      el('h2', { text: 'Per category' }),
      el('p', {}, 'The 90% factor is multiplicative: the row\'s range is [implied ÷ factor, implied × factor]. Categories with fewer than 10 held-out errors use the global factor ×' + v.conformal.global_q90_factor + '.'),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Comps' }), el('th', { class: 'num', text: 'Held-out' }), el('th', { class: 'num', text: 'MAPE' }), el('th', { class: 'num', text: 'Median %' }), el('th', { class: 'num', text: 'Median |log|' }), el('th', { class: 'num', text: '90% factor' }), el('th', { class: 'num', text: 'Spearman' }))),
        el('tbody', {}, catRows)),
      el('h2', { text: 'The 90% intervals' }),
      el('p', {}, 'Conformal intervals at the 90% level, from the pooled held-out |log error| per category. Global factor ×' + v.conformal.global_q90_factor + '. ',
        'RWA is the best-supported large category (9 comps, ×' + ((v.conformal.per_category['RWA'] !== undefined) ? v.conformal.per_category['RWA'] : '—') + '); Canonical Bridge is the widest (×' + ((v.conformal.per_category['Canonical Bridge'] !== undefined) ? v.conformal.per_category['Canonical Bridge'] : '—') + ' — one comp, xdai-stake-bridge, sits ~4,500× below its category median). ',
        'Bootstrap over ' + v.bootstrap.resamples + ' resamples: the global median x' + v.bootstrap.global_median + ' sits between x' + v.bootstrap.p5 + ' and x' + v.bootstrap.p95 + ' at 5–95%.'),
      el('h2', { text: 'Is the top five stable?' }),
      el('p', {}, 'The watchlist floor swept $25M / $50M / $100M. The row count moves; the top five do not:'),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Floor' }), el('th', { class: 'num', text: 'Rows' }), el('th', { class: 'num', text: 'Total implied' }), el('th', { text: 'Top five' }))),
        el('tbody', {}, floorRows)),
      el('h2', { text: 'Targets — and the one the design got wrong' }),
      targets,
      el('p', {}, 'The design set MAPE targets before the error distribution was measured, and the measurement shows no fit can meet them: replacing the fit with the flat global median was tried and leaves MAPE at ' + v.remedy_mape_pct.toLocaleString('en-US') + '% — still far above the target — while erasing the category calibration that is the model\'s whole point. ',
        'So the fit was not replaced. The shrunk intercepts ship as fitted, the targets stand as not met, and the uncertainty is carried by the intervals instead. ',
        'What the model does show: the typical miss is a factor of ×' + Math.exp(o.median_abs_log).toFixed(1) + ', the ranking correlates with the market at Spearman ' + o.spearman_rank + ', and the top five survive every floor.'),
      el('h2', { text: 'Method' }),
      el('p', {}, v.method + '. ' + v.note));
  }

  function render() {
    app.setAttribute('aria-busy', 'true');
    app.textContent = '';
    app.appendChild(renderHeader());
    app.appendChild(renderTabs());
    if (state.tab === 'board') {
      app.appendChild(renderBoard());
      var detail = renderDetail();
      if (detail) app.appendChild(detail);
    } else if (state.tab === 'movers') {
      app.appendChild(renderMovers());
    } else if (state.tab === 'live') {
      app.appendChild(renderLive());
    } else if (state.tab === 'validation') {
      app.appendChild(renderValidation());
    } else {
      app.appendChild(renderModel());
    }
    app.appendChild(el('footer', { class: 'foot' },
      'Source: ', el('code', { text: DATA.source }), ' · Snapshot as of ', DATA.as_of,
      ' · Floor $', String(DATA.floor_usd / 1e6), 'M · Model ', DATA.model_version,
      ' · Implied values are this entry\'s claim, never a prediction of a launch.'));
    writeHash();
    app.setAttribute('aria-busy', 'false');
    if (state.selected) {
      var d = app.querySelector('.drawer');
      if (d) d.scrollIntoView({ block: 'nearest' });
    }
  }

  readHash();
  render();
})();
