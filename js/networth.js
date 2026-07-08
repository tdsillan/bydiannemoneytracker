function renderNetWorth() {
  renderInvestments();
  renderNetWorthCurrencyPicker();
  renderNetWorthHero();
  renderNetWorthBreakdown();
}

function renderNetWorthCurrencyPicker() {
  const [curA, curB] = Store.state.settings.netWorthCurrencies;
  const selectA = document.getElementById("networthCurrencyA");
  const selectB = document.getElementById("networthCurrencyB");
  selectA.innerHTML = currencyOptionsHtml(curA);
  selectB.innerHTML = currencyOptionsHtml(curB);
  selectA.onchange = () => {
    Store.state.settings.netWorthCurrencies = [selectA.value, selectB.value];
    Store.save();
    renderNetWorthHero();
  };
  selectB.onchange = () => {
    Store.state.settings.netWorthCurrencies = [selectA.value, selectB.value];
    Store.save();
    renderNetWorthHero();
  };
}

function assetsByCurrency() {
  const totals = {};
  Store.state.accounts.forEach((a) => {
    Object.entries(a.balances || {}).forEach(([cur, amt]) => {
      totals[cur] = (totals[cur] || 0) + amt;
    });
  });
  Store.state.goals.forEach((g) => { totals[g.currency] = (totals[g.currency] || 0) + g.currentAmount; });
  Store.state.investments.forEach((i) => { totals[i.currency] = (totals[i.currency] || 0) + i.value; });
  return totals;
}

function liabilitiesByCurrency() {
  const totals = {};
  Store.state.debts.filter((d) => d.kind === "debt").forEach((d) => {
    totals[d.currency] = (totals[d.currency] || 0) + d.balance;
  });
  return totals;
}

function convertTotalsToCurrency(totals, targetCur) {
  let sum = 0;
  const missing = [];
  Object.entries(totals).forEach(([cur, amt]) => {
    const converted = Store.convert(amt, cur, targetCur);
    if (converted === null) missing.push(cur);
    else sum += converted;
  });
  return { sum, missing };
}

function renderNetWorthHero() {
  const assets = assetsByCurrency();
  const liabilities = liabilitiesByCurrency();
  const el = document.getElementById("networthHero");
  const missingSet = new Set();

  el.innerHTML = Store.state.settings.netWorthCurrencies.map((targetCur) => {
    const a = convertTotalsToCurrency(assets, targetCur);
    const l = convertTotalsToCurrency(liabilities, targetCur);
    a.missing.forEach((c) => missingSet.add(c));
    l.missing.forEach((c) => missingSet.add(c));
    const net = a.sum - l.sum;
    return `
      <div class="networth-hero-card">
        <div class="networth-hero-label">Net worth in ${targetCur}</div>
        <div class="networth-hero-value ${net >= 0 ? "positive" : "negative"}">${fmtMoney(net, targetCur)}</div>
      </div>
    `;
  }).join("");

  document.getElementById("networthMissingRates").textContent = missingSet.size
    ? `Missing exchange rate for: ${Array.from(missingSet).join(", ")} — add it in Settings → Exchange rates to include it in the total.`
    : "";
}

function renderNetWorthBreakdown() {
  const rowsFor = (totals) => Object.entries(totals).map(([cur, amt]) => `
    <div class="mini-row"><span class="name">${cur}</span><span class="amount">${fmtMoney(amt, cur)}</span></div>
  `).join("");

  document.getElementById("networthAssets").innerHTML = rowsFor(assetsByCurrency()) || `<p class="muted empty-msg">Nothing recorded yet.</p>`;
  document.getElementById("networthLiabilities").innerHTML = rowsFor(liabilitiesByCurrency()) || `<p class="muted empty-msg">Nothing recorded yet.</p>`;
}

function renderInvestments() {
  const el = document.getElementById("investmentList");
  const investments = Store.state.investments;
  if (investments.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No investments added yet.</p>`;
    return;
  }
  el.innerHTML = investments.map((inv) => `
    <div class="balance-row">
      <span class="balance-row-name">${escapeHtml(inv.name)}</span>
      <div class="balance-row-amounts">
        <span class="badge account">${fmtMoney(inv.value, inv.currency)}</span>
        ${accountBadgeHtml(inv.accountId)}
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-action="edit" data-id="${inv.id}">Edit</button>
        <button class="icon-btn" data-action="delete" data-id="${inv.id}">Delete</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = Store.state.investments.find((i) => i.id === btn.dataset.id);
      if (btn.dataset.action === "edit") openInvestmentForm(inv);
      else {
        if (confirm(`Delete "${inv.name}"?`)) {
          Store.deleteInvestment(inv.id);
          renderNetWorth();
          showToast("Deleted");
        }
      }
    });
  });
}

function openInvestmentForm(existing) {
  const isEdit = !!existing;
  const inv = existing || { name: "", value: "", currency: Store.state.settings.defaultCurrency, accountId: "" };
  Modal.open(isEdit ? "Edit investment" : "Add investment", `
    <div class="form-row">
      <label>Name
        <input type="text" id="f-name" placeholder="e.g. Stocks, Mutual fund" value="${escapeHtml(inv.name)}">
      </label>
    </div>
    <div class="form-row two">
      <label>Current value
        <input type="number" id="f-value" min="0" step="0.01" value="${inv.value}">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(inv.currency)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Account (optional)
        <select id="f-account">${accountOptionsHtml(inv.accountId)}</select>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">${isEdit ? "Save changes" : "Add"}</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const name = body.querySelector("#f-name").value.trim();
      if (!name) { showToast("Please enter a name"); return; }
      const payload = {
        name,
        value: parseFloat(body.querySelector("#f-value").value) || 0,
        currency: body.querySelector("#f-currency").value,
        accountId: body.querySelector("#f-account").value,
      };
      if (isEdit) Store.updateInvestment(existing.id, payload);
      else Store.addInvestment(payload);
      Modal.close();
      renderNetWorth();
      showToast(isEdit ? "Saved" : "Added");
    });
  });
}
