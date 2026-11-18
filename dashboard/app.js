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

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against the supply, then repay it, once a week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap once a week in the main pool, or add and remove a small amount of liquidity.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open and close one small hedged trade a week, never a large one.';
    if (c.indexOf('prediction') >= 0) return 'Place one small market position a week on a market you follow.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit or rebalance a small amount in the vault once a week.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a small amount once a week and use it in the destination app.';
    return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyActionFor(p), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
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
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Top implied value' }), el('div', { class: 'v', text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) }))));
    return head;
  }

  function renderTabs() {
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'Pre-token board'], ['live', 'Live tokens'], ['model', 'The model']].forEach(function (t) {
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
      el('p', {}, 'Each row carries six steps derived from the protocol\'s own record — its category, its chains, its TVL, its age. The capital scales with size ($50–$250), the hold with age (30–60 days), the weekly action with the category. It is a plan for farming a launch that may never come; the position is real money, and the steps say so.'));
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
    var steps = farmSteps(row).map(function (s) { return el('li', { text: s }); });
    return el('section', { class: 'drawer', 'aria-label': 'Protocol detail' },
      el('button', { class: 'close', text: 'Close ×', onclick: function () { state.selected = null; render(); } }),
      el('h2', {}, '#' + row.rank + ' — ' + row.name),
      el('p', { class: 'sub', text: row.slug + ' · ' + (row.category || 'no category') + ' · implied value ' + fmtUsd(row.implied_value_usd) }),
      el('div', { class: 'grid2' },
        el('div', {}, el('h3', { text: 'The record' }), facts, el('h3', { text: 'Why this number' }), math),
        el('div', {}, el('h3', { text: 'How to farm it' }), el('ol', { class: 'steps' }, steps), compBlock)));
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
