function renderDebts() {
  renderDebtStats();
  renderOverallDebtProgress();
  renderDebtCategoryProgress();
  renderDebtList();
}

function ofwCategoryLabel(value) {
  const found = OFW_DEBT_CATEGORIES.find((c) => c.value === value);
  const label = escapeHtml(found ? found.label : value);
  const icon = Store.state.appearance.debtCategoryIcons[value];
  return icon ? `${iconDisplayHtml(icon, 14)} ${label}` : label;
}

function ofwCategoryOptionsHtml(selected) {
  return OFW_DEBT_CATEGORIES.map((c) => `<option value="${c.value}" ${c.value === selected ? "selected" : ""}>${c.label}</option>`).join("");
}

function renderDebtCategoryProgress() {
  const el = document.getElementById("debtCategoryProgress");
  if (!el) return;
  const debts = Store.state.debts.filter((d) => d.kind === "debt");
  if (debts.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">Add a debt to see it broken down by category.</p>`;
    return;
  }
  const byKey = {};
  debts.forEach((d) => {
    const key = `${d.ofwCategory}|${d.currency}`;
    if (!byKey[key]) byKey[key] = { category: d.ofwCategory, currency: d.currency, original: 0, balance: 0 };
    byKey[key].original += debtOriginalValue(d);
    byKey[key].balance += d.balance;
  });
  el.innerHTML = Object.values(byKey).map(({ category, currency, original, balance }) => {
    const ratio = original > 0 ? clamp((original - balance) / original, 0, 1) : 0;
    const paid = Math.max(0, original - balance);
    const donut = donutChartSvg({ percent: ratio, color: "var(--danger)", label: `${Math.round(ratio * 100)}%` });
    return `
      <div class="overall-progress-card">
        <div class="overall-progress-title">${ofwCategoryLabel(category)} &middot; ${currency}</div>
        <div class="donut-row">
          ${donut}
          <div class="donut-meta">
            <div class="line"><span>Paid off</span><strong>${fmtMoney(paid, currency)}</strong></div>
            <div class="line"><span>Remaining</span><strong>${fmtMoney(balance, currency)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function madAmountFor(debt) {
  return +(debt.balance * (debt.madPercent || 0) / 100).toFixed(2);
}

function debtOriginalValue(d) {
  return d.debtType === "revolving" ? d.creditLimit : d.originalAmount;
}

function overallProgressCards(items, title, color, paidLabel, remainingLabel) {
  if (items.length === 0) return [];
  const byCurrency = {};
  items.forEach((d) => {
    const cur = d.currency;
    if (!byCurrency[cur]) byCurrency[cur] = { original: 0, balance: 0 };
    byCurrency[cur].original += debtOriginalValue(d);
    byCurrency[cur].balance += d.balance;
  });
  return Object.entries(byCurrency).map(([cur, { original, balance }]) => {
    const ratio = original > 0 ? clamp((original - balance) / original, 0, 1) : 0;
    const paid = Math.max(0, original - balance);
    const donut = donutChartSvg({ percent: ratio, color: `var(--${color})`, label: `${Math.round(ratio * 100)}%` });
    return `
      <div class="overall-progress-card">
        <div class="overall-progress-title">${title} &middot; ${cur}</div>
        <div class="donut-row">
          ${donut}
          <div class="donut-meta">
            <div class="line"><span>${paidLabel}</span><strong>${fmtMoney(paid, cur)}</strong></div>
            <div class="line"><span>${remainingLabel}</span><strong>${fmtMoney(balance, cur)}</strong></div>
          </div>
        </div>
      </div>
    `;
  });
}

function renderOverallDebtProgress() {
  const el = document.getElementById("debtOverallProgress");
  const debts = Store.state.debts;
  const cards = [
    ...overallProgressCards(debts.filter((d) => d.kind === "debt"), "You owe", "danger", "Paid off", "Remaining"),
    ...overallProgressCards(debts.filter((d) => d.kind === "loan"), "Owed to you", "success", "Collected", "Still owed"),
  ];
  el.innerHTML = cards.length ? cards.join("") : `<p class="muted empty-msg">Add a debt or loan to see overall progress.</p>`;
}

function renderDebtStats() {
  const debts = Store.state.debts;
  const owe = groupSumByCurrency(debts.filter((d) => d.kind === "debt"), (d) => d.balance);
  const owed = groupSumByCurrency(debts.filter((d) => d.kind === "loan"), (d) => d.balance);
  const monthly = groupSumByCurrency(debts.filter((d) => d.kind === "debt" && d.debtType !== "revolving" && d.monthlyPayment > 0), (d) => d.monthlyPayment);
  const minDue = groupSumByCurrency(debts.filter((d) => d.kind === "debt" && d.debtType === "revolving"), madAmountFor);
  const currencies = Array.from(new Set([...Object.keys(owe), ...Object.keys(owed), ...Object.keys(monthly), ...Object.keys(minDue)]));

  const grid = document.getElementById("debtStatGrid");
  if (currencies.length === 0) {
    grid.innerHTML = `<p class="muted empty-msg">No debts or loans yet.</p>`;
    return;
  }
  grid.innerHTML = currencies.map((cur) => `
    <div class="stat-card">
      <div class="label">${cur}</div>
      <div class="stat-line"><span>You owe</span><span class="value negative small-value">${fmtMoney(owe[cur] || 0, cur)}</span></div>
      <div class="stat-line"><span>Owed to you</span><span class="value positive small-value">${fmtMoney(owed[cur] || 0, cur)}</span></div>
      <div class="stat-line"><span>Fixed payments/mo</span><span class="value small-value">${fmtMoney(monthly[cur] || 0, cur)}</span></div>
      <div class="stat-line"><span>Min. due (revolving)</span><span class="value small-value">${fmtMoney(minDue[cur] || 0, cur)}</span></div>
    </div>
  `).join("");
}

function installmentCardHtml(debt, isDebt) {
  const paidRatio = debt.originalAmount > 0 ? clamp((debt.originalAmount - debt.balance) / debt.originalAmount, 0, 1) : 0;
  const paidAmount = Math.max(0, debt.originalAmount - debt.balance);
  let payoffLine = "No regular payment set";
  if (debt.monthlyPayment > 0) {
    const months = monthsToPayoff(debt.balance, debt.interestRate || 0, debt.monthlyPayment);
    payoffLine = months === Infinity
      ? "Payment too low to ever pay off"
      : months === 0
        ? "Paid off!"
        : `~${months} month${months === 1 ? "" : "s"} to go`;
  }
  const donut = donutChartSvg({ percent: paidRatio, color: isDebt ? "var(--danger)" : "var(--success)", label: `${Math.round(paidRatio * 100)}%` });
  return `
    <div class="donut-row">
      ${donut}
      <div class="donut-meta">
        <div class="line"><span>Paid</span><strong>${fmtMoney(paidAmount, debt.currency)}</strong></div>
        <div class="line"><span>Remaining</span><strong>${fmtMoney(debt.balance, debt.currency)}</strong></div>
        <div class="line"><span>${payoffLine}</span></div>
      </div>
    </div>
  `;
}

function revolvingCardHtml(debt) {
  const utilization = debt.creditLimit > 0 ? clamp(debt.balance / debt.creditLimit, 0, 1) : 0;
  const available = Math.max(0, debt.creditLimit - debt.balance);
  const mad = madAmountFor(debt);
  const donut = donutChartSvg({ percent: utilization, color: utilization > 0.7 ? "var(--danger)" : "var(--accent)", label: `${Math.round(utilization * 100)}%` });
  return `
    <div class="donut-row">
      ${donut}
      <div class="donut-meta">
        <div class="line"><span>Used</span><strong>${fmtMoney(debt.balance, debt.currency)}</strong></div>
        <div class="line"><span>Available</span><strong>${fmtMoney(available, debt.currency)}</strong></div>
        <div class="line"><span>Min. due</span><strong>${fmtMoney(mad, debt.currency)}</strong></div>
      </div>
    </div>
  `;
}

function debtCardHtml(debt) {
  const isDebt = debt.kind === "debt";
  const isRevolving = isDebt && debt.debtType === "revolving";
  const subLine = isRevolving
    ? `${debt.interestRate ? debt.interestRate + "% APR &middot; " : ""}Revolving credit &middot; ${debt.madPercent || 0}% min. due`
    : `${debt.interestRate ? debt.interestRate + "% APR &middot; " : ""}${debt.monthlyPayment ? fmtMoney(debt.monthlyPayment, debt.currency) + "/mo" : "no scheduled payment"}`;
  return `
    <div class="entity-card" data-id="${debt.id}">
      <div class="entity-card-top">
        <div>
          <div class="entity-title">${escapeHtml(debt.name)}</div>
          <div class="entity-sub">${subLine}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:flex-start; flex-wrap:wrap; justify-content:flex-end;">
          ${isDebt ? `<span class="badge account">${ofwCategoryLabel(debt.ofwCategory)}</span>` : ""}
          ${accountBadgeHtml(debt.accountId)}
          <span class="badge ${isDebt ? "debt" : "loan"}">${isDebt ? "I owe" : "Owed to me"}</span>
        </div>
      </div>
      ${isRevolving ? revolvingCardHtml(debt) : installmentCardHtml(debt, isDebt)}
      <div class="entity-actions">
        <button class="btn-secondary small" data-action="pay" data-id="${debt.id}">Record payment</button>
        <button class="btn-secondary small" data-action="edit" data-id="${debt.id}">Edit</button>
        <button class="btn-danger small" data-action="delete" data-id="${debt.id}">Delete</button>
      </div>
    </div>
  `;
}

function renderDebtList() {
  const list = document.getElementById("debtList");
  const debts = Store.state.debts;
  if (debts.length === 0) {
    list.innerHTML = `<p class="muted empty-msg">No debts or loans yet. Add one to start tracking.</p>`;
    return;
  }
  list.innerHTML = debts.map(debtCardHtml).join("");
  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const debt = Store.state.debts.find((d) => d.id === id);
      if (action === "edit") openDebtForm(debt);
      else if (action === "delete") {
        if (confirm(`Delete "${debt.name}"? This cannot be undone.`)) {
          Store.deleteDebt(id);
          renderDebts();
          renderDashboard();
          showToast("Deleted");
        }
      } else if (action === "pay") openDebtPaymentForm(debt);
    });
  });
}

function debtDynamicFieldsHtml(kind, debtType, d) {
  if (kind === "loan" || debtType === "installment") {
    return `
      <div class="form-row two">
        <label>Original amount
          <input type="number" id="f-original" min="0" step="0.01" value="${d.originalAmount || ""}">
        </label>
        <label>Current balance
          <input type="number" id="f-balance" min="0" step="0.01" value="${d.balance || ""}">
        </label>
      </div>
      <div class="form-row two">
        <label>Interest rate (% APR)
          <input type="number" id="f-rate" min="0" step="0.01" value="${d.interestRate || ""}">
        </label>
        <label>Monthly payment
          <input type="number" id="f-payment" min="0" step="0.01" value="${d.monthlyPayment || ""}">
        </label>
      </div>
    `;
  }
  return `
    <div class="form-row two">
      <label>Credit limit
        <input type="number" id="f-limit" min="0" step="0.01" value="${d.creditLimit || ""}">
      </label>
      <label>Current balance
        <input type="number" id="f-balance" min="0" step="0.01" value="${d.balance || ""}">
      </label>
    </div>
    <div class="form-row two">
      <label>Interest rate (% APR)
        <input type="number" id="f-rate" min="0" step="0.01" value="${d.interestRate || ""}">
      </label>
      <label>Min. due (% of balance)
        <input type="number" id="f-madpercent" min="0" step="0.1" value="${d.madPercent || 5}">
      </label>
    </div>
  `;
}

function openDebtForm(existing) {
  const isEdit = !!existing;
  const d = existing || { kind: "debt", debtType: "installment", ofwCategory: "personal_loan", name: "", originalAmount: "", balance: "", interestRate: "", monthlyPayment: "", creditLimit: "", madPercent: 5, currency: Store.state.settings.defaultCurrency, accountId: "", notes: "" };
  Modal.open(isEdit ? "Edit debt / loan" : "Add debt / loan", `
    <div class="form-row">
      <label>Type
        <select id="f-kind">
          <option value="debt" ${d.kind === "debt" ? "selected" : ""}>Debt (I owe this)</option>
          <option value="loan" ${d.kind === "loan" ? "selected" : ""}>Loan (owed to me)</option>
        </select>
      </label>
    </div>
    <div class="form-row" id="debtTypeRow" ${d.kind === "loan" ? "hidden" : ""}>
      <label>Debt type
        <select id="f-debttype">
          <option value="installment" ${d.debtType !== "revolving" ? "selected" : ""}>Fixed installment loan</option>
          <option value="revolving" ${d.debtType === "revolving" ? "selected" : ""}>Revolving credit (credit card / line of credit)</option>
        </select>
      </label>
    </div>
    <div class="form-row" id="ofwCategoryRow" ${d.kind === "loan" ? "hidden" : ""}>
      <label>Category
        <select id="f-ofwcategory">${ofwCategoryOptionsHtml(d.ofwCategory)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Name
        <input type="text" id="f-name" placeholder="e.g. Car loan, Credit card" value="${escapeHtml(d.name)}">
      </label>
    </div>
    <div id="dynamicFields">${debtDynamicFieldsHtml(d.kind, d.debtType, d)}</div>
    <div class="form-row two">
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(d.currency)}</select>
      </label>
      <label>Account
        <select id="f-account">${accountOptionsHtml(d.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Notes
        <input type="text" id="f-notes" value="${escapeHtml(d.notes || "")}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">${isEdit ? "Save changes" : "Add"}</button>
    </div>
  `, (body) => {
    const kindSelect = body.querySelector("#f-kind");
    const debtTypeRow = body.querySelector("#debtTypeRow");
    const ofwCategoryRow = body.querySelector("#ofwCategoryRow");
    const debtTypeSelect = body.querySelector("#f-debttype");
    const dynamicFields = body.querySelector("#dynamicFields");

    const rerenderFields = () => {
      const kind = kindSelect.value;
      debtTypeRow.hidden = kind === "loan";
      ofwCategoryRow.hidden = kind === "loan";
      const debtType = kind === "loan" ? "installment" : debtTypeSelect.value;
      dynamicFields.innerHTML = debtDynamicFieldsHtml(kind, debtType, d);
    };
    kindSelect.addEventListener("change", rerenderFields);
    debtTypeSelect.addEventListener("change", rerenderFields);

    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const name = body.querySelector("#f-name").value.trim();
      if (!name) { showToast("Please enter a name"); return; }
      const kind = kindSelect.value;
      const debtType = kind === "loan" ? "installment" : debtTypeSelect.value;
      const payload = {
        kind,
        debtType,
        ofwCategory: kind === "loan" ? "" : body.querySelector("#f-ofwcategory").value,
        name,
        balance: parseFloat(body.querySelector("#f-balance").value) || 0,
        currency: body.querySelector("#f-currency").value,
        accountId: body.querySelector("#f-account").value,
        notes: body.querySelector("#f-notes").value.trim(),
      };
      if (debtType === "installment") {
        payload.originalAmount = parseFloat(body.querySelector("#f-original").value) || 0;
        payload.interestRate = parseFloat(body.querySelector("#f-rate").value) || 0;
        payload.monthlyPayment = parseFloat(body.querySelector("#f-payment").value) || 0;
        payload.creditLimit = 0;
        payload.madPercent = 0;
      } else {
        payload.creditLimit = parseFloat(body.querySelector("#f-limit").value) || 0;
        payload.interestRate = parseFloat(body.querySelector("#f-rate").value) || 0;
        payload.madPercent = parseFloat(body.querySelector("#f-madpercent").value) || 0;
        payload.originalAmount = 0;
        payload.monthlyPayment = 0;
      }
      if (isEdit) Store.updateDebt(existing.id, payload);
      else Store.addDebt(payload);
      Modal.close();
      renderDebts();
      renderDashboard();
      showToast(isEdit ? "Saved" : "Added");
    });
  });
}

function openDebtPaymentForm(debt) {
  const suggested = debt.debtType === "revolving" ? madAmountFor(debt) : debt.monthlyPayment;
  Modal.open(`Record payment &middot; ${escapeHtml(debt.name)}`, `
    <div class="form-row two">
      <label>Amount (${debt.currency})
        <input type="number" id="f-amount" min="0" step="0.01" value="${suggested || ""}">
      </label>
      <label>Date
        <input type="date" id="f-date" value="${todayISO()}">
      </label>
    </div>
    ${debt.debtType === "revolving" ? `<p class="muted small">Minimum due this cycle: ${fmtMoney(madAmountFor(debt), debt.currency)}. Paying less than the full balance will roll the rest over.</p>` : ""}
    <div class="form-row">
      <label>Paying from <span class="muted small">(optional — decreases that account's balance)</span>
        <select id="f-payment-account">${accountOptionsHtml(debt.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Note (optional)
        <input type="text" id="f-note">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Record</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amount = parseFloat(body.querySelector("#f-amount").value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      Store.recordDebtPayment(
        debt.id,
        amount,
        body.querySelector("#f-date").value || todayISO(),
        body.querySelector("#f-note").value.trim(),
        body.querySelector("#f-payment-account").value
      );
      Modal.close();
      renderDebts();
      renderDashboard();
      showToast("Payment recorded");
    });
  });
}
