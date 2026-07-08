const txnFilters = { month: "", category: "", type: "", accountId: "" };

function renderExpenses() {
  populateExpenseFilters();
  renderTxnStatsAndTable();
  renderRecurringIncomes();
}

function populateExpenseFilters() {
  const monthSelect = document.getElementById("filterMonth");
  const monthsPresent = Array.from(new Set(Store.state.transactions.map((t) => monthKey(t.date)))).sort().reverse();
  const currentMonth = todayISO().slice(0, 7);
  if (!monthsPresent.includes(currentMonth)) monthsPresent.unshift(currentMonth);
  const prevMonthVal = monthSelect.value || txnFilters.month;
  monthSelect.innerHTML = `<option value="">All months</option>` + monthsPresent.map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join("");
  monthSelect.value = monthsPresent.includes(prevMonthVal) ? prevMonthVal : "";
  txnFilters.month = monthSelect.value;

  const catSelect = document.getElementById("filterCategory");
  const allCats = Array.from(new Set([...Store.state.categories.expense, ...Store.state.categories.income]));
  const prevCat = catSelect.value || txnFilters.category;
  catSelect.innerHTML = `<option value="">All categories</option>` + allCats.map((c) => `<option value="${escapeHtml(c)}">${categoryIconLabel(c)}</option>`).join("");
  catSelect.value = allCats.includes(prevCat) ? prevCat : "";
  txnFilters.category = catSelect.value;

  const accSelect = document.getElementById("filterAccount");
  const prevAcc = accSelect.value || txnFilters.accountId;
  accSelect.innerHTML = `<option value="">All accounts</option>` + Store.state.accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  accSelect.value = Store.state.accounts.some((a) => a.id === prevAcc) ? prevAcc : "";
  txnFilters.accountId = accSelect.value;
}

function getFilteredTransactions() {
  return Store.state.transactions
    .filter((t) => !txnFilters.month || monthKey(t.date) === txnFilters.month)
    .filter((t) => !txnFilters.category || t.category === txnFilters.category)
    .filter((t) => !txnFilters.type || t.type === txnFilters.type)
    .filter((t) => !txnFilters.accountId || t.accountId === txnFilters.accountId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function renderTxnStatsAndTable() {
  const txns = getFilteredTransactions();
  const incomeByCur = groupSumByCurrency(txns.filter((t) => t.type === "income"), (t) => t.amount);
  const expenseByCur = groupSumByCurrency(txns.filter((t) => t.type === "expense"), (t) => t.amount);
  const currencies = Array.from(new Set([...Object.keys(incomeByCur), ...Object.keys(expenseByCur)]));

  const grid = document.getElementById("txnStatGrid");
  if (currencies.length === 0) {
    grid.innerHTML = `<p class="muted empty-msg">No transactions match these filters.</p>`;
  } else {
    grid.innerHTML = currencies.map((cur) => {
      const income = incomeByCur[cur] || 0;
      const expense = expenseByCur[cur] || 0;
      return `
        <div class="stat-card">
          <div class="label">${cur}</div>
          <div class="stat-line"><span>Income</span><span class="value positive small-value">${fmtMoney(income, cur)}</span></div>
          <div class="stat-line"><span>Expenses</span><span class="value negative small-value">${fmtMoney(expense, cur)}</span></div>
          <div class="stat-line"><span>Net</span><span class="value small-value ${income - expense >= 0 ? "positive" : "negative"}">${fmtMoney(income - expense, cur)}</span></div>
        </div>
      `;
    }).join("");
  }

  const tbody = document.getElementById("txnTableBody");
  const empty = document.getElementById("txnEmpty");
  if (txns.length === 0) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = txns.map((t) => `
    <tr data-id="${t.id}">
      <td>${fmtDate(t.date)}</td>
      <td>${categoryIconLabel(t.category)}</td>
      <td>${escapeHtml(Store.accountName(t.accountId)) || "&mdash;"}</td>
      <td>${escapeHtml(t.note || "")}</td>
      <td class="amount ${t.type}">${t.type === "expense" ? "-" : "+"}${fmtMoney(t.amount, t.currency)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="icon-btn" data-action="delete" data-id="${t.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const txn = Store.state.transactions.find((t) => t.id === id);
      if (btn.dataset.action === "edit") openTxnForm(txn);
      else {
        if (confirm("Delete this transaction?")) {
          Store.deleteTransaction(id);
          renderExpenses();
          renderDashboard();
          showToast("Deleted");
        }
      }
    });
  });
}

function categoryOptionsHtml(type, selected) {
  return Store.state.categories[type].map((c) => `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${categoryIconLabel(c)}</option>`).join("");
}

function openTxnForm(existing, prefill) {
  const isEdit = !!existing;
  const t = existing || prefill || { type: "expense", date: todayISO(), category: "", amount: "", currency: Store.state.settings.defaultCurrency, accountId: "", note: "" };
  Modal.open(isEdit ? "Edit transaction" : "Add transaction", `
    <div class="form-row">
      <label>Type
        <select id="f-type">
          <option value="expense" ${t.type === "expense" ? "selected" : ""}>Expense</option>
          <option value="income" ${t.type === "income" ? "selected" : ""}>Income</option>
        </select>
      </label>
    </div>
    <div class="form-row two">
      <label>Amount
        <input type="number" id="f-amount" min="0" step="0.01" value="${t.amount}">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(t.currency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Date
        <input type="date" id="f-date" value="${t.date}">
      </label>
      <label>Account
        <select id="f-account">${accountOptionsHtml(t.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Category
        <select id="f-category">${categoryOptionsHtml(t.type, t.category)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Note (optional)
        <input type="text" id="f-note" value="${escapeHtml(t.note || "")}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">${isEdit ? "Save changes" : "Add"}</button>
    </div>
  `, (body) => {
    const typeSelect = body.querySelector("#f-type");
    const catSelect = body.querySelector("#f-category");
    typeSelect.addEventListener("change", () => {
      catSelect.innerHTML = categoryOptionsHtml(typeSelect.value);
    });

    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amount = parseFloat(body.querySelector("#f-amount").value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      const payload = {
        type: typeSelect.value,
        amount,
        currency: body.querySelector("#f-currency").value,
        date: body.querySelector("#f-date").value || todayISO(),
        category: catSelect.value,
        accountId: body.querySelector("#f-account").value,
        note: body.querySelector("#f-note").value.trim(),
      };
      if (isEdit) Store.updateTransaction(existing.id, payload);
      else Store.addTransaction(payload);
      Modal.close();
      renderExpenses();
      renderDashboard();
      showToast(isEdit ? "Saved" : "Added");
    });
  });
}

function renderRecurringIncomes() {
  const el = document.getElementById("recurringList");
  const entries = Store.state.recurringIncomes.slice().sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  if (entries.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No recurring income set up yet.</p>`;
    return;
  }
  el.innerHTML = entries.map((r) => {
    const next = nextOccurrence(r.dayOfMonth);
    const days = daysUntil(next);
    return `
      <div class="entity-card" data-id="${r.id}">
        <div class="entity-card-top">
          <div>
            <div class="entity-title">${escapeHtml(r.name)}</div>
            <div class="entity-sub">${fmtMoney(r.amount, r.currency)} &middot; day ${r.dayOfMonth} of each month${r.accountId ? " &middot; " + escapeHtml(Store.accountName(r.accountId)) : ""}</div>
          </div>
          <span class="badge loan">Next in ${days} day${days === 1 ? "" : "s"}</span>
        </div>
        <div class="entity-actions">
          <button class="btn-primary small" data-action="log" data-id="${r.id}">Log this month</button>
          <button class="btn-secondary small" data-action="edit" data-id="${r.id}">Edit</button>
          <button class="btn-danger small" data-action="delete" data-id="${r.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const entry = Store.state.recurringIncomes.find((r) => r.id === id);
      if (btn.dataset.action === "edit") openRecurringForm(entry);
      else if (btn.dataset.action === "delete") {
        if (confirm(`Delete recurring income "${entry.name}"?`)) {
          Store.deleteRecurringIncome(id);
          renderRecurringIncomes();
          showToast("Deleted");
        }
      } else if (btn.dataset.action === "log") {
        openTxnForm(null, {
          type: "income",
          date: todayISO(),
          category: entry.category,
          amount: entry.amount,
          currency: entry.currency,
          accountId: entry.accountId,
          note: entry.name,
        });
      }
    });
  });
}

function openRecurringForm(existing) {
  const isEdit = !!existing;
  const r = existing || { name: "", amount: "", currency: Store.state.settings.defaultCurrency, category: "Salary", accountId: "", dayOfMonth: 25 };
  Modal.open(isEdit ? "Edit recurring income" : "Add recurring income", `
    <div class="form-row">
      <label>Name
        <input type="text" id="f-name" placeholder="e.g. Salary, Allowance" value="${escapeHtml(r.name)}">
      </label>
    </div>
    <div class="form-row two">
      <label>Amount
        <input type="number" id="f-amount" min="0" step="0.01" value="${r.amount}">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(r.currency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Day of month
        <input type="number" id="f-day" min="1" max="31" value="${r.dayOfMonth}">
      </label>
      <label>Account
        <select id="f-account">${accountOptionsHtml(r.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Category
        <select id="f-category">${categoryOptionsHtml("income", r.category)}</select>
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
      const amount = parseFloat(body.querySelector("#f-amount").value);
      const dayOfMonth = clamp(parseInt(body.querySelector("#f-day").value, 10) || 1, 1, 31);
      if (!name) { showToast("Please enter a name"); return; }
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      const payload = {
        name,
        amount,
        currency: body.querySelector("#f-currency").value,
        accountId: body.querySelector("#f-account").value,
        category: body.querySelector("#f-category").value,
        dayOfMonth,
      };
      if (isEdit) Store.updateRecurringIncome(existing.id, payload);
      else Store.addRecurringIncome(payload);
      Modal.close();
      renderRecurringIncomes();
      renderDashboard();
      showToast(isEdit ? "Saved" : "Added");
    });
  });
}
