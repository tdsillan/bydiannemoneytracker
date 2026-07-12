function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      if (field !== "" || row.length) pushRow();
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) pushRow();
  return rows;
}

function parseFlexibleDate(str) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseAmountValue(str) {
  if (str === undefined || str === null || str === "") return null;
  let cleaned = String(str).replace(/[, ]/g, "").trim();
  let negative = false;
  if (/^\(.*\)$/.test(cleaned)) { negative = true; cleaned = cleaned.slice(1, -1); }
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function guessColumnIndex(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function columnSelectHtml(id, headers, selectedIdx, allowNone) {
  const opts = headers.map((h, i) => `<option value="${i}" ${i === selectedIdx ? "selected" : ""}>${escapeHtml(h)}</option>`).join("");
  const noneOpt = allowNone ? `<option value="-1" ${selectedIdx === -1 ? "selected" : ""}>${allowNone}</option>` : "";
  return `<select id="${id}">${noneOpt}${opts}</select>`;
}

let importState = null;

function openImportModal() {
  importState = null;
  Modal.open("Import transactions from CSV", `
    <div class="form-row">
      <label>CSV file
        <input type="file" id="f-csv-file" accept=".csv,text/csv">
      </label>
    </div>
    <p class="muted small">Export a transaction history CSV from Wise, Revolut, or your bank's app, then upload it here.</p>
    <div id="importConfigArea"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
    </div>
  `, (body) => {
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#f-csv-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCSV(reader.result);
        if (rows.length < 2) { showToast("That file doesn't look like a valid CSV"); return; }
        const headers = rows[0];
        const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
        importState = { headers, dataRows };
        renderImportConfigStep(body);
      };
      reader.readAsText(file);
    });
  });
}

function renderImportConfigStep(body) {
  const { headers } = importState;
  const dateIdx = guessColumnIndex(headers, ["date", "started date", "completed date", "transaction date"]);
  const amountIdx = guessColumnIndex(headers, ["amount", "value"]);
  const descIdx = guessColumnIndex(headers, ["description", "merchant", "reference", "payee", "note"]);
  const currencyIdx = guessColumnIndex(headers, ["currency", "source currency"]);

  document.getElementById("importConfigArea").innerHTML = `
    <p class="muted small">${importState.dataRows.length} rows found. Match each field to a column from your file.</p>
    <div class="form-row two">
      <label>Date column
        ${columnSelectHtml("f-col-date", headers, dateIdx)}
      </label>
      <label>Amount column
        ${columnSelectHtml("f-col-amount", headers, amountIdx)}
      </label>
    </div>
    <div class="form-row two">
      <label>Description column <span class="muted small">(optional)</span>
        ${columnSelectHtml("f-col-desc", headers, descIdx, "None")}
      </label>
      <label>Currency column <span class="muted small">(optional)</span>
        ${columnSelectHtml("f-col-currency", headers, currencyIdx, "None — use default below")}
      </label>
    </div>
    <div class="form-row two">
      <label>Account these transactions belong to
        <select id="f-import-account">${accountOptionsHtml("")}</select>
      </label>
      <label>Default currency <span class="muted small">(used if no currency column)</span>
        <select id="f-import-currency">${currencyOptionsHtml(Store.state.settings.defaultCurrency)}</select>
      </label>
    </div>
    <div class="form-row two">
      <label>Default category for imported rows
        <select id="f-import-category">${categoryOptionsHtml("expense")}</select>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="f-invert-sign"> Flip sign (check if incoming money shows as negative in this file)
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn2">Cancel</button>
      <button class="btn-primary" id="previewBtn">Preview import</button>
    </div>
  `;
  body.querySelector("#cancelBtn2").addEventListener("click", () => Modal.close());
  body.querySelector("#previewBtn").addEventListener("click", () => renderImportPreviewStep(body));
}

function buildImportRows() {
  const dateIdx = parseInt(document.getElementById("f-col-date").value, 10);
  const amountIdx = parseInt(document.getElementById("f-col-amount").value, 10);
  const descIdx = parseInt(document.getElementById("f-col-desc").value, 10);
  const currencyIdx = parseInt(document.getElementById("f-col-currency").value, 10);
  const accountId = document.getElementById("f-import-account").value;
  const defaultCurrency = document.getElementById("f-import-currency").value;
  const category = document.getElementById("f-import-category").value;
  const invert = document.getElementById("f-invert-sign").checked;

  const existing = Store.state.transactions;

  return importState.dataRows.map((r) => {
    const date = parseFlexibleDate(r[dateIdx]);
    let amount = parseAmountValue(r[amountIdx]);
    const note = descIdx !== -1 ? (r[descIdx] || "").trim() : "";
    const currency = currencyIdx !== -1 && r[currencyIdx] ? r[currencyIdx].trim().toUpperCase() : defaultCurrency;

    if (amount !== null && invert) amount = -amount;

    const valid = date !== null && amount !== null && amount !== 0;
    const type = valid && amount < 0 ? "expense" : "income";
    const absAmount = valid ? Math.abs(amount) : 0;

    const isDuplicate = valid && existing.some((t) =>
      t.date === date && t.currency === currency && t.accountId === accountId &&
      Math.abs(t.amount - absAmount) < 0.005 && t.type === type
    );

    return { date, amount: absAmount, type, currency, note, category, accountId, valid, isDuplicate, raw: r };
  });
}

function renderImportPreviewStep(body) {
  const rows = buildImportRows();
  const validCount = rows.filter((r) => r.valid).length;
  const dupCount = rows.filter((r) => r.valid && r.isDuplicate).length;

  document.getElementById("importConfigArea").innerHTML = `
    <p class="muted small">${validCount} of ${rows.length} rows parsed successfully. ${dupCount} look like duplicates of transactions you already have and are unchecked by default.</p>
    <div class="table-scroll" style="max-height:340px; overflow-y:auto;">
      <table class="txn-table">
        <thead>
          <tr><th></th><th>Date</th><th>Type</th><th class="right">Amount</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td><input type="checkbox" class="import-row-check" data-i="${i}" ${r.valid && !r.isDuplicate ? "checked" : ""} ${r.valid ? "" : "disabled"}></td>
              <td>${r.valid ? fmtDate(r.date) : `<span class="muted small">couldn't parse</span>`}</td>
              <td>${r.valid ? (r.type === "expense" ? "Expense" : "Income") : "—"}</td>
              <td class="amount ${r.type}">${r.valid ? fmtMoney(r.amount, r.currency) : "—"}</td>
              <td>${escapeHtml(r.note)}${r.isDuplicate ? ' <span class="badge account">possible duplicate</span>' : ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="backBtn">Back</button>
      <button class="btn-primary" id="commitBtn">Import selected</button>
    </div>
  `;
  body.querySelector("#backBtn").addEventListener("click", () => renderImportConfigStep(body));
  body.querySelector("#commitBtn").addEventListener("click", () => {
    let count = 0;
    body.querySelectorAll(".import-row-check:checked").forEach((cb) => {
      const r = rows[parseInt(cb.dataset.i, 10)];
      if (!r.valid) return;
      Store.addTransaction({
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        date: r.date,
        category: r.category,
        accountId: r.accountId,
        note: r.note,
      });
      count++;
    });
    Modal.close();
    renderExpenses();
    renderDashboard();
    showToast(`Imported ${count} transaction${count === 1 ? "" : "s"}`);
  });
}
