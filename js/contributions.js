function renderContributions() {
  const el = document.getElementById("contributionPrograms");
  const programs = Store.state.contributionPrograms;
  el.innerHTML = programs.map(contributionProgramCardHtml).join("");

  el.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "delete-payment") {
        if (confirm("Delete this payment record?")) {
          Store.deleteContributionPayment(btn.dataset.paymentId);
          renderContributions();
          showToast("Deleted");
        }
        return;
      }
      const prog = Store.state.contributionPrograms.find((p) => p.id === btn.dataset.id);
      if (btn.dataset.action === "log") openContributionPaymentForm(prog);
      else if (btn.dataset.action === "editprogram") openContributionProgramForm(prog);
    });
  });
}

function contributionProgramCardHtml(prog) {
  const payments = Store.state.contributionPayments
    .filter((p) => p.programId === prog.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const next = nextOccurrence(prog.dueDay);
  const days = daysUntil(next);

  return `
    <div class="entity-card" data-id="${prog.id}">
      <div class="entity-card-top">
        <div>
          <div class="entity-title">${escapeHtml(prog.name)}</div>
          <div class="entity-sub">${fmtMoney(prog.monthlyAmount, prog.currency)}/mo &middot; due day ${prog.dueDay} of each month</div>
        </div>
        <span class="badge account">Next in ${days} day${days === 1 ? "" : "s"}</span>
      </div>
      <div class="entity-meta">
        <span>Total contributed: ${fmtMoney(total, prog.currency)}</span>
        <span>${payments.length} payment${payments.length === 1 ? "" : "s"} logged</span>
      </div>
      <div class="entity-actions">
        <button class="btn-primary small" data-action="log" data-id="${prog.id}">Log payment</button>
        <button class="btn-secondary small" data-action="editprogram" data-id="${prog.id}">Edit schedule</button>
      </div>
      ${payments.length ? `
        <div class="contribution-history">
          ${payments.slice(0, 5).map((p) => `
            <div class="activity-row">
              <span>${fmtMoney(p.amount, p.currency)}${p.note ? " &middot; " + escapeHtml(p.note) : ""}</span>
              <span class="meta">${fmtDate(p.date)} <button class="icon-btn" data-action="delete-payment" data-payment-id="${p.id}">Delete</button></span>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function openContributionPaymentForm(prog) {
  Modal.open(`Log payment &middot; ${escapeHtml(prog.name)}`, `
    <div class="form-row two">
      <label>Amount
        <input type="number" id="f-amount" min="0" step="0.01" value="${prog.monthlyAmount || ""}">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(prog.currency)}</select>
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
      <button class="btn-primary" id="saveBtn">Log payment</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const amount = parseFloat(body.querySelector("#f-amount").value);
      if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
      Store.addContributionPayment({
        programId: prog.id,
        amount,
        currency: body.querySelector("#f-currency").value,
        date: body.querySelector("#f-date").value || todayISO(),
        note: body.querySelector("#f-note").value.trim(),
      });
      Modal.close();
      renderContributions();
      showToast("Payment logged");
    });
  });
}

function openContributionProgramForm(prog) {
  Modal.open(`Edit schedule &middot; ${escapeHtml(prog.name)}`, `
    <div class="form-row two">
      <label>Monthly amount
        <input type="number" id="f-amount" min="0" step="0.01" value="${prog.monthlyAmount}">
      </label>
      <label>Currency
        <select id="f-currency">${currencyOptionsHtml(prog.currency)}</select>
      </label>
    </div>
    <div class="form-row">
      <label>Due day of month
        <input type="number" id="f-day" min="1" max="31" value="${prog.dueDay}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Save</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      Store.updateContributionProgram(prog.id, {
        monthlyAmount: parseFloat(body.querySelector("#f-amount").value) || 0,
        currency: body.querySelector("#f-currency").value,
        dueDay: clamp(parseInt(body.querySelector("#f-day").value, 10) || 1, 1, 31),
      });
      Modal.close();
      renderContributions();
      showToast("Saved");
    });
  });
}
