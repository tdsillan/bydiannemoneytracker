function renderGoals() {
  renderOverallGoalProgress();
  const list = document.getElementById("goalList");
  const goals = Store.state.goals;
  if (goals.length === 0) {
    list.innerHTML = `<p class="muted empty-msg">No savings goals yet. Add one to start saving towards something.</p>`;
    return;
  }
  list.innerHTML = goals.map(goalCardHtml).join("");
  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const goal = Store.state.goals.find((g) => g.id === id);
      if (action === "edit") openGoalForm(goal);
      else if (action === "delete") {
        if (confirm(`Delete "${goal.name}"? This cannot be undone.`)) {
          Store.deleteGoal(id);
          renderGoals();
          renderDashboard();
          showToast("Deleted");
        }
      } else if (action === "contribute") openGoalContributionForm(goal);
      else if (action === "withdraw") openGoalWithdrawalForm(goal);
    });
  });

  list.querySelectorAll(".hypo-input").forEach((input) => {
    input.addEventListener("input", () => {
      const goal = goals.find((g) => g.id === input.dataset.id);
      const resultEl = list.querySelector(`.hypo-result[data-id="${input.dataset.id}"]`);
      const rate = parseFloat(input.value);
      if (!rate || rate <= 0) { resultEl.textContent = ""; return; }
      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
      if (remaining <= 0) { resultEl.textContent = "Goal already reached!"; return; }
      const months = Math.ceil(remaining / rate);
      const date = addMonths(todayISO(), months);
      resultEl.textContent = `→ ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
    });
  });
}

function renderOverallGoalProgress() {
  const el = document.getElementById("goalOverallProgress");
  const goals = Store.state.goals;
  if (goals.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">Add a savings goal to see overall progress.</p>`;
    return;
  }
  const byCurrency = {};
  goals.forEach((g) => {
    const cur = g.currency;
    if (!byCurrency[cur]) byCurrency[cur] = { target: 0, saved: 0 };
    byCurrency[cur].target += g.targetAmount;
    byCurrency[cur].saved += g.currentAmount;
  });
  el.innerHTML = Object.entries(byCurrency).map(([cur, { target, saved }]) => {
    const ratio = target > 0 ? clamp(saved / target, 0, 1) : 0;
    const remaining = Math.max(0, target - saved);
    const donut = donutChartSvg({ percent: ratio, color: "var(--success)", label: `${Math.round(ratio * 100)}%` });
    return `
      <div class="overall-progress-card">
        <div class="overall-progress-title">All goals &middot; ${cur}</div>
        <div class="donut-row">
          ${donut}
          <div class="donut-meta">
            <div class="line"><span>Saved</span><strong>${fmtMoney(saved, cur)}</strong></div>
            <div class="line"><span>Remaining</span><strong>${fmtMoney(remaining, cur)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function goalMonthlyRate(goal) {
  const months = monthsBetween(goal.createdAt, todayISO());
  if (months < 1) return null;
  return goal.currentAmount / months;
}

function projectionLineHtml(goal) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) return `<div class="line"><span>Goal reached!</span></div>`;
  const rate = goalMonthlyRate(goal);
  if (rate === null) return `<div class="line"><span>Check back after a month of saving for a projected date.</span></div>`;
  if (!rate || rate <= 0) return `<div class="line"><span>Add a contribution to project a completion date.</span></div>`;
  const months = Math.ceil(remaining / rate);
  const date = addMonths(todayISO(), months);
  const dateStr = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `<div class="line"><span>At this rate (${fmtMoney(rate, goal.currency)}/mo), reach it by</span><strong>${dateStr}</strong></div>`;
}

function goalCardHtml(goal) {
  const ratio = goal.targetAmount > 0 ? clamp(goal.currentAmount / goal.targetAmount, 0, 1) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const done = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0;
  let dateLine = "";
  if (goal.targetDate) {
    const days = daysUntil(goal.targetDate);
    dateLine = days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  }
  const donut = donutChartSvg({ percent: ratio, color: "var(--success)", label: `${Math.round(ratio * 100)}%` });
  const otherCur = Store.state.settings.defaultCurrency;
  let equivLine = "";
  if (otherCur !== goal.currency) {
    const equiv = Store.convert(goal.currentAmount, goal.currency, otherCur);
    if (equiv !== null) equivLine = `<div class="line"><span>&approx; in ${otherCur}</span><strong>${fmtMoney(equiv, otherCur)}</strong></div>`;
  }
  return `
    <div class="entity-card" data-id="${goal.id}">
      <div class="entity-card-top">
        <div>
          <div class="entity-title">${goal.icon ? escapeHtml(goal.icon) + " " : ""}${escapeHtml(goal.name)}</div>
          <div class="entity-sub">${goal.targetDate ? "Target: " + fmtDate(goal.targetDate) : "No target date"}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:flex-start;">
          ${accountBadgeHtml(goal.accountId)}
          ${done ? '<span class="badge loan">Reached!</span>' : ""}
        </div>
      </div>
      <div class="donut-row">
        ${donut}
        <div class="donut-meta">
          <div class="line"><span>Saved</span><strong>${fmtMoney(goal.currentAmount, goal.currency)}</strong></div>
          <div class="line"><span>Remaining</span><strong>${fmtMoney(remaining, goal.currency)}</strong></div>
          ${equivLine}
          ${dateLine ? `<div class="line"><span>${dateLine}</span></div>` : ""}
          ${projectionLineHtml(goal)}
        </div>
      </div>
      <div class="hypo-row">
        <label class="muted small">What if you saved
          <input type="number" class="hypo-input" data-id="${goal.id}" min="0" step="0.01" placeholder="amount">
          /mo instead?
        </label>
        <span class="hypo-result muted small" data-id="${goal.id}"></span>
      </div>
      <div class="entity-actions">
        <button class="btn-secondary small" data-action="contribute" data-id="${goal.id}">Add funds</button>
        ${goal.currentAmount > 0 ? `<button class="btn-secondary small" data-action="withdraw" data-id="${goal.id}">Withdraw</button>` : ""}
        <button class="btn-secondary small" data-action="edit" data-id="${goal.id}">Edit</button>
        <button class="btn-danger small" data-action="delete" data-id="${goal.id}">Delete</button>
      </div>
    </div>
  `;
}

function openGoalForm(existing) {
  const isEdit = !!existing;
  const g = existing || { name: "", icon: "", targetAmount: "", currentAmount: 0, targetDate: "", currency: Store.state.settings.defaultCurrency, accountId: "" };
  Modal.open(isEdit ? "Edit goal" : "Add savings goal", `
    <div class="form-row two">
      <label>Goal name
        <input type="text" id="f-name" placeholder="e.g. Emergency fund, New laptop" value="${escapeHtml(g.name)}">
      </label>
      <label>Icon <span class="muted small">(optional emoji)</span>
        <input type="text" id="f-icon" maxlength="4" placeholder="🏠" value="${escapeHtml(g.icon || "")}">
      </label>
    </div>
    <div class="form-row two">
      <label>Target amount
        <input type="number" id="f-target" min="0" step="0.01" value="${g.targetAmount}">
      </label>
      <label>Current amount saved
        <input type="number" id="f-current" min="0" step="0.01" value="${g.currentAmount}">
      </label>
    </div>
    <div class="form-row two">
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(g.currency)}</select>
      </label>
      <label>Account
        <select id="f-account">${accountOptionsHtml(g.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Target date (optional)
        <input type="date" id="f-date" value="${g.targetDate || ""}">
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
        icon: body.querySelector("#f-icon").value.trim(),
        targetAmount: parseFloat(body.querySelector("#f-target").value) || 0,
        currentAmount: parseFloat(body.querySelector("#f-current").value) || 0,
        currency: body.querySelector("#f-currency").value,
        accountId: body.querySelector("#f-account").value,
        targetDate: body.querySelector("#f-date").value || "",
      };
      if (isEdit) Store.updateGoal(existing.id, payload);
      else Store.addGoal(payload);
      Modal.close();
      renderGoals();
      renderDashboard();
      showToast(isEdit ? "Saved" : "Added");
    });
  });
}

function openGoalContributionForm(goal) {
  Modal.open(`Add funds &middot; ${escapeHtml(goal.name)}`, `
    <div class="form-row two">
      <label>Amount
        <input type="number" id="f-amount" min="0" step="0.01">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(goal.currency)}</select>
      </label>
    </div>
    <div id="rateRow"></div>
    <div class="form-row two">
      <label>Date
        <input type="date" id="f-date" value="${todayISO()}">
      </label>
      <label>Note (optional)
        <input type="text" id="f-note">
      </label>
    </div>
    <div class="form-row">
      <label>Taking from <span class="muted small">(optional — decreases that account's balance)</span>
        <select id="f-source-account">${accountOptionsHtml(goal.accountId)}</select>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Add</button>
    </div>
  `, (body) => {
    const currencySelect = body.querySelector("#f-currency");
    const amountInput = body.querySelector("#f-amount");
    const rateRow = body.querySelector("#rateRow");

    const renderRateRow = () => {
      const from = currencySelect.value;
      if (from === goal.currency) {
        rateRow.innerHTML = "";
        return;
      }
      const knownRate = Store.getRate(from, goal.currency);
      rateRow.innerHTML = `
        <div class="form-row two">
          <label>Exchange rate (1 ${from} = ? ${goal.currency})
            <input type="number" id="f-rate" min="0" step="0.0001" value="${knownRate || ""}">
          </label>
          <label>&nbsp;
            <span class="muted small" id="ratePreview">Enter an amount and rate to see the converted total.</span>
          </label>
        </div>
      `;
      rateRow.querySelector("#f-rate").addEventListener("input", updatePreview);
      amountInput.addEventListener("input", updatePreview);
      updatePreview();
    };

    const updatePreview = () => {
      const preview = rateRow.querySelector("#ratePreview");
      if (!preview) return;
      const amount = parseFloat(amountInput.value) || 0;
      const rate = parseFloat(rateRow.querySelector("#f-rate").value) || 0;
      preview.innerHTML = amount && rate ? `&approx; ${fmtMoney(amount * rate, goal.currency)}` : "Enter an amount and rate to see the converted total.";
    };

    currencySelect.addEventListener("change", renderRateRow);
    renderRateRow();

    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      const from = currencySelect.value;
      let convertedAmount = amount;
      let rate = 1;
      if (from !== goal.currency) {
        rate = parseFloat(rateRow.querySelector("#f-rate").value);
        if (!rate || rate <= 0) { showToast(`Enter the exchange rate from ${from} to ${goal.currency}`); return; }
        convertedAmount = +(amount * rate).toFixed(2);
        Store.setRate(from, goal.currency, rate);
      }
      Store.recordGoalContribution(
        goal.id,
        convertedAmount,
        body.querySelector("#f-date").value || todayISO(),
        body.querySelector("#f-note").value.trim(),
        { amount, currency: from, rate },
        body.querySelector("#f-source-account").value
      );
      Modal.close();
      renderGoals();
      renderDashboard();
      showToast("Funds added");
    });
  });
}

function openGoalWithdrawalForm(goal) {
  Modal.open(`Withdraw &middot; ${escapeHtml(goal.name)}`, `
    <p class="muted small">Currently saved: ${fmtMoney(goal.currentAmount, goal.currency)}</p>
    <div class="form-row two">
      <label>Amount (${goal.currency})
        <input type="number" id="f-amount" min="0" max="${goal.currentAmount}" step="0.01">
      </label>
      <label>Date
        <input type="date" id="f-date" value="${todayISO()}">
      </label>
    </div>
    <div class="form-row">
      <label>Goes to <span class="muted small">(optional — increases that account's balance)</span>
        <select id="f-dest-account">${accountOptionsHtml(goal.accountId)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Note (optional)
        <input type="text" id="f-note" placeholder="e.g. Emergency car repair">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-danger" id="saveBtn">Withdraw</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amount = parseFloat(body.querySelector("#f-amount").value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      if (amount > goal.currentAmount) { showToast("Can't withdraw more than what's saved"); return; }
      Store.recordGoalWithdrawal(
        goal.id,
        amount,
        body.querySelector("#f-date").value || todayISO(),
        body.querySelector("#f-note").value.trim(),
        body.querySelector("#f-dest-account").value
      );
      Modal.close();
      renderGoals();
      renderDashboard();
      showToast("Funds withdrawn");
    });
  });
}
