let dashboardChartCurrency = null;

function renderDashboard() {
  renderGreeting();
  renderDashboardStats();
  renderAccountBalances();
  renderChartCurrencySelect();
  renderCategoryChart();
  renderTrendChart();
  renderBreakdownCharts();
  renderDebtOverview();
  renderGoalOverview();
  renderUpcomingIncome();
  renderRecentActivity();
}

function renderGreeting() {
  const name = Store.state.settings.userName.trim();
  document.getElementById("greeting").textContent = name ? `Welcome back, ${name}` : "Welcome back";
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function renderDashboardStats() {
  const { debts, goals, transactions } = Store.state;
  const debtByCur = groupSumByCurrency(debts.filter((d) => d.kind === "debt"), (d) => d.balance);
  const owedByCur = groupSumByCurrency(debts.filter((d) => d.kind === "loan"), (d) => d.balance);
  const savedByCur = groupSumByCurrency(goals, (g) => g.currentAmount);

  const currentMonth = todayISO().slice(0, 7);
  const monthTxns = transactions.filter((t) => monthKey(t.date) === currentMonth);
  const monthIncomeByCur = groupSumByCurrency(monthTxns.filter((t) => t.type === "income"), (t) => t.amount);
  const monthExpenseByCur = groupSumByCurrency(monthTxns.filter((t) => t.type === "expense"), (t) => t.amount);

  const currencies = allCurrenciesInUse();

  document.getElementById("statGrid").innerHTML = currencies.map((cur) => {
    const onHand = sumAccountBalances(cur);
    const debt = debtByCur[cur] || 0;
    const owed = owedByCur[cur] || 0;
    const saved = savedByCur[cur] || 0;
    const netMonth = (monthIncomeByCur[cur] || 0) - (monthExpenseByCur[cur] || 0);
    return `
      <div class="stat-card">
        <div class="label">${cur}</div>
        <div class="stat-line"><span>Balance on hand</span><span class="value small-value positive">${fmtMoney(onHand, cur)}</span></div>
        <div class="stat-line"><span>Debt</span><span class="value small-value negative">${fmtMoney(debt, cur)}</span></div>
        <div class="stat-line"><span>Owed to you</span><span class="value small-value positive">${fmtMoney(owed, cur)}</span></div>
        <div class="stat-line"><span>Saved</span><span class="value small-value positive">${fmtMoney(saved, cur)}</span></div>
        <div class="stat-line"><span>This month's net</span><span class="value small-value ${netMonth >= 0 ? "positive" : "negative"}">${fmtMoney(netMonth, cur)}</span></div>
      </div>
    `;
  }).join("");
}

function renderAccountBalances() {
  const el = document.getElementById("accountBalances");
  const accounts = Store.state.accounts;
  if (accounts.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No accounts set up. Add one in Settings &rarr; Accounts.</p>`;
    return;
  }
  el.innerHTML = accounts.map((a) => {
    const entries = Object.entries(a.balances || {}).filter(([, amt]) => amt);
    const amountsHtml = entries.length
      ? entries.map(([cur, amt]) => `<span class="badge account">${fmtMoney(amt, cur)}</span>`).join("")
      : `<span class="muted small">Not set</span>`;
    return `
      <div class="balance-row">
        <span class="balance-row-name">${escapeHtml(a.name)}</span>
        <div class="balance-row-amounts">${amountsHtml}</div>
        <button class="btn-secondary small" data-action="edit-balance" data-id="${a.id}">Edit</button>
      </div>
    `;
  }).join("");

  el.querySelectorAll("[data-action='edit-balance']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const account = Store.state.accounts.find((a) => a.id === btn.dataset.id);
      openAccountBalanceForm(account);
    });
  });
}

function currencyInputPairsHtml(balances) {
  let rows = "";
  for (let i = 0; i < CURRENCIES.length; i += 2) {
    const pair = CURRENCIES.slice(i, i + 2);
    rows += `<div class="form-row two">${pair.map((c) => `
      <label>${c.code} (${c.symbol})
        <input type="number" step="0.01" class="bal-input" data-currency="${c.code}" value="${balances[c.code] || ""}">
      </label>
    `).join("")}</div>`;
  }
  return rows;
}

function openAccountBalanceForm(account) {
  const balances = account.balances || {};
  Modal.open(`Balance on hand &middot; ${escapeHtml(account.name)}`, `
    ${currencyInputPairsHtml(balances)}
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Save</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const newBalances = {};
      body.querySelectorAll(".bal-input").forEach((input) => {
        const val = parseFloat(input.value) || 0;
        if (val !== 0) newBalances[input.dataset.currency] = val;
      });
      Store.updateAccountBalances(account.id, newBalances);
      Modal.close();
      renderDashboard();
      showToast("Balance updated");
    });
  });
}

function openTransferForm() {
  const accounts = Store.state.accounts;
  if (accounts.length < 2) { showToast("Add at least two accounts first"); return; }
  Modal.open("Transfer between accounts", `
    <div class="form-row two">
      <label>From
        <select id="f-from-account">${accountOptionsHtml(accounts[0].id)}</select>
      </label>
      <label>To
        <select id="f-to-account">${accountOptionsHtml(accounts[1].id)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Amount
        <input type="number" id="f-amount" min="0" step="0.01">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(Store.state.settings.defaultCurrency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Date
        <input type="date" id="f-date" value="${todayISO()}">
      </label>
      <label>Note (optional)
        <input type="text" id="f-note">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Transfer</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const fromAccountId = body.querySelector("#f-from-account").value;
      const toAccountId = body.querySelector("#f-to-account").value;
      const amount = parseFloat(body.querySelector("#f-amount").value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      if (!fromAccountId || !toAccountId) { showToast("Pick both accounts"); return; }
      if (fromAccountId === toAccountId) { showToast("Pick two different accounts"); return; }
      Store.addTransfer({
        fromAccountId,
        toAccountId,
        amount,
        currency: body.querySelector("#f-currency").value,
        date: body.querySelector("#f-date").value || todayISO(),
        note: body.querySelector("#f-note").value.trim(),
      });
      Modal.close();
      renderDashboard();
      showToast("Transfer recorded");
    });
  });
}

function renderChartCurrencySelect() {
  const select = document.getElementById("chartCurrencySelect");
  const currencies = allCurrenciesInUse();
  if (!dashboardChartCurrency || !currencies.includes(dashboardChartCurrency)) {
    dashboardChartCurrency = currencies.includes(Store.state.settings.defaultCurrency) ? Store.state.settings.defaultCurrency : currencies[0];
  }
  select.innerHTML = currencies.map((c) => `<option value="${c}" ${c === dashboardChartCurrency ? "selected" : ""}>${c}</option>`).join("");
  select.onchange = () => {
    dashboardChartCurrency = select.value;
    updateChartCurrencyLabels();
    renderCategoryChart();
    renderTrendChart();
    renderBreakdownCharts();
  };
  updateChartCurrencyLabels();
}

function updateChartCurrencyLabels() {
  document.getElementById("trendCurrencyLabel").textContent = `(${dashboardChartCurrency})`;
  document.getElementById("debtBreakdownLabel").textContent = `(${dashboardChartCurrency})`;
  document.getElementById("savingsBreakdownLabel").textContent = `(${dashboardChartCurrency})`;
}

function renderBreakdownCharts() {
  renderDebtBreakdown();
  renderSavingsBreakdown();
}

function renderDebtBreakdown() {
  const chartEl = document.getElementById("debtBreakdownChart");
  const legendEl = document.getElementById("debtBreakdownLegend");
  const debts = Store.state.debts.filter((d) => d.kind === "debt" && d.currency === dashboardChartCurrency && d.balance > 0);
  if (debts.length === 0) {
    chartEl.innerHTML = "";
    legendEl.innerHTML = `<p class="muted empty-msg">No ${dashboardChartCurrency || ""} debt to break down.</p>`;
    return;
  }
  const total = debts.reduce((sum, d) => sum + d.balance, 0);
  const slices = debts.map((d, i) => ({ label: d.name, value: d.balance, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  chartEl.innerHTML = multiDonutSvg(slices);
  legendEl.innerHTML = slices.map((s) => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span class="legend-name">${escapeHtml(s.label)}</span>
      <span class="legend-value">${fmtMoney(s.value, dashboardChartCurrency)} (${Math.round((s.value / total) * 100)}%)</span>
    </div>
  `).join("");
}

function renderSavingsBreakdown() {
  const chartEl = document.getElementById("savingsBreakdownChart");
  const legendEl = document.getElementById("savingsBreakdownLegend");
  const goals = Store.state.goals.filter((g) => g.currency === dashboardChartCurrency && g.currentAmount > 0);
  if (goals.length === 0) {
    chartEl.innerHTML = "";
    legendEl.innerHTML = `<p class="muted empty-msg">No ${dashboardChartCurrency || ""} savings to break down.</p>`;
    return;
  }
  const total = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const slices = goals.map((g, i) => ({ label: g.name, value: g.currentAmount, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  chartEl.innerHTML = multiDonutSvg(slices);
  legendEl.innerHTML = slices.map((s) => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span class="legend-name">${escapeHtml(s.label)}</span>
      <span class="legend-value">${fmtMoney(s.value, dashboardChartCurrency)} (${Math.round((s.value / total) * 100)}%)</span>
    </div>
  `).join("");
}

function renderCategoryChart() {
  const currentMonth = todayISO().slice(0, 7);
  const txns = Store.state.transactions.filter((t) => t.type === "expense" && monthKey(t.date) === currentMonth && t.currency === dashboardChartCurrency);
  const totals = {};
  txns.forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById("categoryChart");
  if (entries.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No ${dashboardChartCurrency || ""} expenses recorded this month yet.</p>`;
    return;
  }
  const max = entries[0][1];
  el.innerHTML = entries.map(([cat, amount]) => `
    <div class="cat-row">
      <span class="cat-name">${categoryIconLabelHtml(cat)}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(amount / max) * 100}%"></div></div>
      <span class="cat-amount">${fmtMoney(amount, dashboardChartCurrency)}</span>
    </div>
  `).join("");
}

function renderTrendChart() {
  const keys = lastNMonthKeys(6);
  const totals = keys.map((k) => {
    const txns = Store.state.transactions.filter((t) => t.type === "expense" && monthKey(t.date) === k && t.currency === dashboardChartCurrency);
    return txns.reduce((s, t) => s + t.amount, 0);
  });
  const max = Math.max(...totals, 1);
  const el = document.getElementById("trendChart");
  el.innerHTML = `
    <div class="trend-bars">
      ${keys.map((k, i) => `
        <div class="trend-col">
          <div class="trend-bar-track"><div class="trend-bar" style="height:${(totals[i] / max) * 100}%" title="${fmtMoney(totals[i], dashboardChartCurrency)}"></div></div>
          <span class="trend-label">${monthLabel(k)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDebtOverview() {
  const el = document.getElementById("debtOverview");
  const debts = Store.state.debts;
  if (debts.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No debts or loans added yet.</p>`;
    return;
  }
  el.innerHTML = debts.slice(0, 5).map((d) => {
    const ratio = d.originalAmount > 0 ? clamp((d.originalAmount - d.balance) / d.originalAmount, 0, 1) : 0;
    return `
      <div class="mini-row">
        <span class="name">${escapeHtml(d.name)}</span>
        <div class="mini-progress"><div class="progress-fill ${d.kind === "debt" ? "danger" : "success"}" style="width:${ratio * 100}%"></div></div>
        <span class="amount">${fmtMoney(d.balance, d.currency)}</span>
      </div>
    `;
  }).join("");
}

function renderGoalOverview() {
  const el = document.getElementById("goalOverview");
  const goals = Store.state.goals;
  if (goals.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No savings goals added yet.</p>`;
    return;
  }
  el.innerHTML = goals.slice(0, 5).map((g) => {
    const ratio = g.targetAmount > 0 ? clamp(g.currentAmount / g.targetAmount, 0, 1) : 0;
    return `
      <div class="mini-row">
        <span class="name">${escapeHtml(g.name)}</span>
        <div class="mini-progress"><div class="progress-fill success" style="width:${ratio * 100}%"></div></div>
        <span class="amount">${Math.round(ratio * 100)}%</span>
      </div>
    `;
  }).join("");
}

function renderUpcomingIncome() {
  const el = document.getElementById("upcomingIncome");
  const entries = Store.state.recurringIncomes
    .map((r) => ({ ...r, next: nextOccurrence(r.dayOfMonth) }))
    .sort((a, b) => (a.next < b.next ? -1 : 1));
  if (entries.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No recurring income set up. Add one from the Expenses &amp; Income page.</p>`;
    return;
  }
  el.innerHTML = entries.map((r) => {
    const days = daysUntil(r.next);
    return `
      <div class="activity-row">
        <span>${escapeHtml(r.name)} &middot; ${fmtMoney(r.amount, r.currency)}${r.accountId ? " &middot; " + escapeHtml(Store.accountName(r.accountId)) : ""}</span>
        <span class="meta">${fmtDate(r.next)} &middot; in ${days} day${days === 1 ? "" : "s"}</span>
      </div>
    `;
  }).join("");
}

function renderRecentActivity() {
  const events = [];
  Store.state.transactions.forEach((t) => events.push({ date: t.date, text: `${t.type === "expense" ? "Spent" : "Received"} ${fmtMoney(t.amount, t.currency)} &middot; ${escapeHtml(t.category)}`, meta: t.note || "" }));
  Store.state.debts.forEach((d) => d.history.forEach((h) => events.push({ date: h.date, text: `Paid ${fmtMoney(h.amount, d.currency)} towards ${escapeHtml(d.name)}`, meta: h.note || "" })));
  Store.state.goals.forEach((g) => g.history.forEach((h) => {
    if (h.amount < 0) {
      events.push({ date: h.date, text: `Withdrew ${fmtMoney(-h.amount, g.currency)} from ${escapeHtml(g.name)}`, meta: h.note || "" });
      return;
    }
    const original = h.originalCurrency ? ` (${fmtMoney(h.originalAmount, h.originalCurrency)} @ ${h.rate})` : "";
    events.push({ date: h.date, text: `Added ${fmtMoney(h.amount, g.currency)}${original} to ${escapeHtml(g.name)}`, meta: h.note || "" });
  }));
  Store.state.transfers.forEach((t) => events.push({
    date: t.date,
    text: `Transferred ${fmtMoney(t.amount, t.currency)} from ${escapeHtml(Store.accountName(t.fromAccountId))} to ${escapeHtml(Store.accountName(t.toAccountId))}`,
    meta: t.note || "",
  }));

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  const el = document.getElementById("recentActivity");
  if (events.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">Nothing recorded yet. Start by adding a transaction, debt, or goal.</p>`;
    return;
  }
  el.innerHTML = events.slice(0, 10).map((e) => `
    <div class="activity-row">
      <span>${e.text}</span>
      <span class="meta">${fmtDate(e.date)}${e.meta ? " &middot; " + e.meta : ""}</span>
    </div>
  `).join("");
}
