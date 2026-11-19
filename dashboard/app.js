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
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(row.chains.length - 1, 0), model.chain_max);
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * chainMult));
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
    if (flags.length === 0) return el('p', { class: 'sub', text: 'No flags on this row: more than 90 days of history, more than one chain, no 7-day spike, and a category median behind the multiple.' });
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

  function renderHeader() {
    var head = el('header', { class: 'mast' },
      el('p', { class: 'eyebrow', text: 'Token Radar · model ' + DATA.model_version + ' · snapshot ' + DATA.as_of }),
      el('h1', {}, 'Which pre-token protocol', el('span', { class: 'thin', text: ' would be worth the most if it launched?' })),
      el('p', { class: 'lede' },
        'Every protocol DefiLlama tracks, scored by what its token would be worth — ',
        el('b', { text: DATA.board_size + ' launch candidates' }),
        ', ranked by implied value. The multiple comes from the market itself: the median market-cap-to-TVL ratio of the live tokens in the same category. ',
        el('b', { text: 'No name is special-cased.' })),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Protocols scanned' }), el('div', { class: 'v', text: String(DATA.protocols_total) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'On the watchlist' }), el('div', { class: 'v', text: String(DATA.watchlist_size) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Rows ranked' }), el('div', { class: 'v', text: String(DATA.board_size) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Total implied value' }), el('div', { class: 'v' }, el('em', { text: fmtUsd(DATA.total_implied_usd) }))),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Top implied value' }), el('div', { class: 'v', text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Rows flagged — look twice' }), el('div', { class: 'v', text: String(DATA.insights ? DATA.insights.flagged_rows : 0) }))));
    return head;
  }

  function renderTabs() {
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'Pre-token board'], ['movers', 'Movers & risks'], ['live', 'Live tokens'], ['model', 'The model']].forEach(function (t) {
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
      el('th', { class: 'num' }, sortButton('Implied value', 'implied'))));
    var tbody = el('tbody', {});
    pageRows.forEach(function (r) {
      var chg = r.change_7d === null ? el('span', { class: 'flat', text: 'n/a' })
        : el('span', { class: r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat', text: fmtPct(r.change_7d) });
      var tr = el('tr', { class: state.selected === r.slug ? 'sel' : null, onclick: function () { state.selected = r.slug; render(); } },
        el('td', { class: 'rank', text: '#' + r.rank }),
        el('td', {}, el('span', { class: 'name', text: r.name }), wlSlugs[r.slug] ? el('span', { class: 'tag', text: 'watchlist' }) : null, el('small', { text: r.slug })),
        el('td', { text: r.category || '—' }),
        el('td', { text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num' }, chg),
        el('td', {}, flagBadges(r.slug)),
        el('td', { class: 'num', text: r.tvl_usd > 0 ? fmtMult(r.implied_value_usd / r.tvl_usd) : 'n/a' }),
        el('td', { class: 'num' }, el('b', { text: fmtUsd(r.implied_value_usd) })));
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
      moverTable('Most efficient — implied value per $1 of TVL', ins.efficient, 'The five rows at or above the $50M floor that squeeze the most implied value out of each TVL dollar. Efficiency is the category multiple times growth, maturity and chains — a rich category, not a big TVL, is what tops this list. The $50M floor keeps a tiny TVL from winning on noise.'),
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
      el('p', { class: 'lede' }, 'The market\'s own values, not a model\'s. These are the live-token protocols that calibrate the board: each category\'s multiple is the median of its rows here.'),
      el('table', { class: 'board' }, thead, tbody));
  }

  function renderModel() {
    var rows = DATA.comps.map(function (c) {
      return el('tr', {},
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { class: 'num', text: fmtMult(c.median_multiple) }),
        el('td', { text: c.examples.map(function (e) { return e.name + ' (' + fmtMult(e.multiple) + ')'; }).join(', ') }));
    });
    var compTable = el('table', { class: 'comp' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Live comps' }), el('th', { class: 'num', text: 'Median mcap / TVL' }), el('th', { text: 'Largest comps' }))),
      el('tbody', {}, rows));
    return el('div', { class: 'modelpage' },
      el('h2', { text: 'How the board is scored' }),
      el('p', {}, 'The board answers one question: if this protocol issued a token tomorrow and its record stayed as it is, what would the token be worth? The answer is a claim this entry makes — never a prediction that a token is coming, and never make.fun\'s.'),
      el('div', { class: 'formula' },
        'implied  =  TVL  ×  category multiple  ×  growth  ×  maturity  ×  chains\n',
        'category multiple  =  median(market cap / TVL) of live tokens in the same category\n',
        '                     (≥ ', String(DATA.model.comp_min), ' comps; else the global median ', fmtMult(DATA.global_multiple), ')\n',
        'growth             =  1 + clamp(7d change, −', String(DATA.model.growth_floor), '%, +', String(DATA.model.growth_cap), '%) / 100 × ', String(DATA.model.growth_weight), '\n',
        'maturity           =  ', String(DATA.model.maturity_floor), ' + min(age, ', String(DATA.model.maturity_days), 'd) / ', String(DATA.model.maturity_days), ' × ', String(DATA.model.maturity_range), '   (age unknown: ', String(DATA.model.unknown_age_days), 'd)\n',
        'chains             =  1 + ', String(DATA.model.chain_step), ' × min(chains − 1, ', String(DATA.model.chain_max), ')'),
      el('h2', { text: 'The calibration' }),
      el('p', {}, 'Each category\'s multiple is the median market-cap-to-TVL ratio of the snapshot\'s own live-token protocols in that category. The market pays very differently for different businesses — compare Dexes, Lending and Liquid Staking in the table below — and the board prices that in. Categories with fewer than ' + DATA.model.comp_min + ' live comps fall back to the global median ' + fmtMult(DATA.global_multiple) + '.'),
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
    var math = el('div', { class: 'math' },
      el('div', {}, 'TVL  ', el('b', { text: fmtUsd(row.tvl_usd) }), '  ×  category multiple  ', el('b', { text: fmtMult(row.category_multiple) }), '  ', el('span', { class: 'dim', text: '(' + row.category_comps + ' live comp' + (row.category_comps === 1 ? '' : 's') + ' in ' + (row.category || 'no category') + ')' })),
      el('div', {}, '×  growth  ', el('b', { text: row.growth_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(7d ' + fmtPct(growth) + ')' })),
      el('div', {}, '×  maturity  ', el('b', { text: row.maturity_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(' + fmtAge(row.age_days) + ' old)' })),
      el('div', {}, '×  chains  ', el('b', { text: row.chain_multiplier.toFixed(4) }), '  ', el('span', { class: 'dim', text: '(' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')' })),
      el('div', {}, '=  implied value  ', el('b', { text: fmtUsd(row.implied_value_usd) }), '  ', el('span', { class: 'dim', text: recomputed === row.implied_value_usd ? '— recomputed in the page, matches the board' : '— recomputed ' + fmtUsd(recomputed) })));
    var facts = el('dl', { class: 'facts' },
      el('dt', { text: 'Rank' }), el('dd', { text: '#' + row.rank + ' of ' + DATA.board_size }),
      el('dt', { text: 'Category' }), el('dd', { text: row.category || '—' }),
      el('dt', { text: 'Chains' }), el('dd', { text: row.chains.join(', ') || '—' }),
      el('dt', { text: 'TVL' }), el('dd', { text: fmtUsd(row.tvl_usd) }),
      el('dt', { text: '7-day change' }), el('dd', { text: fmtPct(row.change_7d) }),
      el('dt', { text: 'Listed' }), el('dd', { text: (row.listed_at || 'unknown') + ' (' + fmtAge(row.age_days) + ')' }),
      el('dt', { text: 'Token' }), el('dd', { text: 'records no token' }),
      el('dt', { text: 'Watchlist' }), el('dd', { text: wlSlugs[row.slug] ? 'yes — at or above the $50M floor' : 'no — below the floor, ranked on merit' }));
    var compBlock = comp ? el('div', {},
      el('h3', { text: 'Category comps — ' + comp.category }),
      el('table', { class: 'comp' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Live token' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: 'Mcap / TVL' }))),
        el('tbody', {}, comp.examples.map(function (e) {
          return el('tr', {}, el('td', { text: e.name }), el('td', { class: 'num', text: fmtUsd(e.tvl_usd) }), el('td', { class: 'num', text: fmtUsd(e.mcap_usd) }), el('td', { class: 'num', text: fmtMult(e.multiple) }));
        }))),
      el('p', { class: 'sub', text: 'Median of ' + comp.comps + ' live tokens in this category: ' + fmtMult(comp.median_multiple) + '.' }))
      : el('p', { class: 'sub', text: 'Fewer than ' + DATA.model.comp_min + ' live tokens in this category, so the board uses the global median ' + fmtMult(DATA.global_multiple) + '.' });
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
