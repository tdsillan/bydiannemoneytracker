function remittanceMetrics(r) {
  const markupPct = r.midMarketRate > 0 ? clamp((r.midMarketRate - r.rateReceived) / r.midMarketRate, -1, 1) : 0;
  const spreadCostSent = r.amountSent * markupPct;
  const totalCostSent = r.feePaid + spreadCostSent;
  const effectiveCostPct = r.amountSent > 0 ? (totalCostSent / r.amountSent) * 100 : 0;
  return { markupPct, spreadCostSent, totalCostSent, effectiveCostPct };
}

function renderRemittances() {
  renderRemittanceStats();
  renderRemittanceChart();
  renderRemittanceTable();
}

function renderRemittanceStats() {
  const grid = document.getElementById("remittanceStatGrid");
  const remittances = Store.state.remittances;
  if (remittances.length === 0) {
    grid.innerHTML = `<p class="muted empty-msg">No remittances logged yet.</p>`;
    return;
  }
  const byCurrency = {};
  remittances.forEach((r) => {
    const cur = r.currency;
    if (!byCurrency[cur]) byCurrency[cur] = { sent: 0, fees: 0, spread: 0, byService: {} };
    const m = remittanceMetrics(r);
    byCurrency[cur].sent += r.amountSent;
    byCurrency[cur].fees += r.feePaid;
    byCurrency[cur].spread += m.spreadCostSent;
    if (!byCurrency[cur].byService[r.service]) byCurrency[cur].byService[r.service] = { totalCostPct: 0, count: 0 };
    byCurrency[cur].byService[r.service].totalCostPct += m.effectiveCostPct;
    byCurrency[cur].byService[r.service].count += 1;
  });

  grid.innerHTML = Object.entries(byCurrency).map(([cur, agg]) => {
    let best = null;
    Object.entries(agg.byService).forEach(([service, s]) => {
      const avgPct = s.totalCostPct / s.count;
      if (!best || avgPct < best.avgPct) best = { service, avgPct };
    });
    return `
      <div class="stat-card">
        <div class="label">${cur}</div>
        <div class="stat-line"><span>Total sent</span><span class="value small-value">${fmtMoney(agg.sent, cur)}</span></div>
        <div class="stat-line"><span>Total fees</span><span class="value small-value negative">${fmtMoney(agg.fees, cur)}</span></div>
        <div class="stat-line"><span>Total spread cost</span><span class="value small-value negative">${fmtMoney(agg.spread, cur)}</span></div>
        <div class="stat-line"><span>Best service so far</span><span class="value small-value positive">${best ? `${escapeHtml(best.service)} (${best.avgPct.toFixed(2)}%)` : "—"}</span></div>
      </div>
    `;
  }).join("");
}

function renderRemittanceChart() {
  const el = document.getElementById("remittanceChart");
  const remittances = Store.state.remittances;
  if (remittances.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">Log a remittance to see fees and spread over time.</p>`;
    return;
  }
  const counts = {};
  remittances.forEach((r) => { counts[r.currency] = (counts[r.currency] || 0) + 1; });
  const mainCurrency = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const sorted = remittances.filter((r) => r.currency === mainCurrency).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-12);
  const maxTotal = Math.max(...sorted.map((r) => r.feePaid + remittanceMetrics(r).spreadCostSent), 1);

  el.innerHTML = `
    <p class="muted small">Showing ${mainCurrency} transfers &middot; teal = fee, rose = exchange-rate spread</p>
    <div class="trend-bars">
      ${sorted.map((r) => {
        const m = remittanceMetrics(r);
        const feeH = (r.feePaid / maxTotal) * 100;
        const spreadH = (Math.max(0, m.spreadCostSent) / maxTotal) * 100;
        return `
          <div class="trend-col">
            <div class="trend-bar-track" style="flex-direction:column-reverse; display:flex;">
              <div class="trend-bar" style="height:${feeH}%; background:var(--teal);" title="Fee: ${fmtMoney(r.feePaid, r.currency)}"></div>
              <div class="trend-bar" style="height:${spreadH}%; background:var(--rose); border-radius:0;" title="Spread: ${fmtMoney(m.spreadCostSent, r.currency)}"></div>
            </div>
            <span class="trend-label">${fmtDate(r.date).replace(/, \d{4}/, "")}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderRemittanceTable() {
  const tbody = document.getElementById("remittanceTableBody");
  const empty = document.getElementById("remittanceEmpty");
  const remittances = Store.state.remittances.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (remittances.length === 0) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = remittances.map((r) => {
    const m = remittanceMetrics(r);
    return `
      <tr data-id="${r.id}">
        <td>${fmtDate(r.date)}</td>
        <td>${escapeHtml(r.service)}</td>
        <td>${fmtMoney(r.amountSent, r.currency)}</td>
        <td>${fmtMoney(r.feePaid, r.currency)}</td>
        <td>${r.rateReceived} ${r.destCurrency}</td>
        <td>${r.midMarketRate || "—"} ${r.destCurrency}</td>
        <td class="amount expense">${fmtMoney(m.totalCostSent, r.currency)} <span class="muted small">(${m.effectiveCostPct.toFixed(2)}%)</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-action="edit" data-id="${r.id}">Edit</button>
            <button class="icon-btn" data-action="delete" data-id="${r.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const r = Store.state.remittances.find((x) => x.id === id);
      if (btn.dataset.action === "edit") openRemittanceForm(r);
      else {
        if (confirm("Delete this remittance entry?")) {
          Store.deleteRemittance(id);
          renderRemittances();
          showToast("Deleted");
        }
      }
    });
  });
}

function serviceOptionsHtml(selected) {
  return REMITTANCE_SERVICES.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`).join("");
}

function openRemittanceForm(existing) {
  const isEdit = !!existing;
  const r = existing || {
    date: todayISO(),
    service: REMITTANCE_SERVICES[0],
    amountSent: "",
    currency: Store.state.settings.defaultCurrency,
    destCurrency: "PHP",
    rateReceived: "",
    midMarketRate: "",
    feePaid: "",
    accountId: "",
    note: "",
  };
  Modal.open(isEdit ? "Edit remittance" : "Log remittance", `
    <div class="form-row two">
      <label>Date
        <input type="date" id="f-date" value="${r.date}">
      </label>
      <label>Service
        <select id="f-service">${serviceOptionsHtml(r.service)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Amount sent
        <input type="number" id="f-amount" min="0" step="0.01" value="${r.amountSent}">
      </label>
      <label>Currency sent
        <select id="f-currency">${currencyOptionsHtml(r.currency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Fee paid
        <input type="number" id="f-fee" min="0" step="0.01" value="${r.feePaid}">
      </label>
      <label>Destination currency
        <select id="f-destcurrency">${currencyOptionsHtml(r.destCurrency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Rate received (1 sent = ? dest)
        <input type="number" id="f-raterecv" min="0" step="0.0001" value="${r.rateReceived}">
      </label>
      <label>Mid-market rate (1 sent = ? dest)
        <input type="number" id="f-ratemid" min="0" step="0.0001" value="${r.midMarketRate}">
      </label>
    </div>
    <div class="form-row">
      <button class="btn-secondary small" id="fetchRateBtn" type="button">Fetch live mid-market rate</button>
      <span class="muted small" id="fetchRateStatus"></span>
    </div>
    <div class="form-row two">
      <label>Account
        <select id="f-account">${accountOptionsHtml(r.accountId)}</select>
      </label>
      <label>Note (optional)
        <input type="text" id="f-note" value="${escapeHtml(r.note || "")}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">${isEdit ? "Save changes" : "Add"}</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());

    body.querySelector("#fetchRateBtn").addEventListener("click", async () => {
      const status = body.querySelector("#fetchRateStatus");
      const from = body.querySelector("#f-currency").value;
      const to = body.querySelector("#f-destcurrency").value;
      const date = body.querySelector("#f-date").value || todayISO();
      status.textContent = "Fetching…";
      const rate = await fetchMidMarketRate(date, from, to);
      if (rate) {
        body.querySelector("#f-ratemid").value = rate;
        status.textContent = `Fetched: 1 ${from} = ${rate} ${to}`;
      } else {
        status.textContent = "Couldn't fetch a rate (offline or unsupported pair) — enter it manually.";
      }
    });

    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amountSent = parseFloat(body.querySelector("#f-amount").value);
      const rateReceived = parseFloat(body.querySelector("#f-raterecv").value);
      if (!amountSent || amountSent <= 0) { showToast("Enter a valid amount sent"); return; }
      if (!rateReceived || rateReceived <= 0) { showToast("Enter the rate you received"); return; }
      const payload = {
        date: body.querySelector("#f-date").value || todayISO(),
        service: body.querySelector("#f-service").value,
        amountSent,
        currency: body.querySelector("#f-currency").value,
        destCurrency: body.querySelector("#f-destcurrency").value,
        rateReceived,
        midMarketRate: parseFloat(body.querySelector("#f-ratemid").value) || 0,
        feePaid: parseFloat(body.querySelector("#f-fee").value) || 0,
        accountId: body.querySelector("#f-account").value,
        note: body.querySelector("#f-note").value.trim(),
      };
      if (isEdit) Store.updateRemittance(existing.id, payload);
      else Store.addRemittance(payload);
      Modal.close();
      renderRemittances();
      showToast(isEdit ? "Saved" : "Logged");
    });
  });
}
