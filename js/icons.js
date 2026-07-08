const NAV_SECTIONS = [
  { view: "dashboard", label: "Dashboard" },
  { view: "debts", label: "Loans & Debts" },
  { view: "goals", label: "Savings Goals" },
  { view: "expenses", label: "Expenses & Income" },
  { view: "remittances", label: "Remittances" },
  { view: "networth", label: "Net Worth" },
  { view: "contributions", label: "Contributions" },
  { view: "planning", label: "Planning" },
  { view: "settings", label: "Settings" },
];

function iconPickerGridHtml(current) {
  return ICON_CHOICES.map((ic) => `<button type="button" class="icon-choice ${ic === current ? "selected" : ""}" data-icon="${ic}">${ic}</button>`).join("");
}

function openIconPicker(current, onSelect) {
  Modal.open("Choose an icon", `
    <div class="icon-picker-grid">${iconPickerGridHtml(current)}</div>
    <div class="form-row">
      <label>Or type your own emoji/symbol
        <input type="text" id="f-custom-icon" maxlength="4" value="${current && !ICON_CHOICES.includes(current) ? escapeHtml(current) : ""}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Use this icon</button>
    </div>
  `, (body) => {
    let chosen = current;
    body.querySelectorAll(".icon-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosen = btn.dataset.icon;
        body.querySelector("#f-custom-icon").value = "";
        body.querySelectorAll(".icon-choice").forEach((b) => b.classList.toggle("selected", b === btn));
      });
    });
    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const custom = body.querySelector("#f-custom-icon").value.trim();
      onSelect(custom || chosen || "");
      Modal.close();
    });
  });
}

function applyNavIcons() {
  const icons = Store.state.appearance.navIcons;
  Object.entries(icons).forEach(([view, icon]) => {
    const navSpan = document.querySelector(`.nav-item[data-view="${view}"] .nav-icon`);
    if (navSpan) navSpan.textContent = icon;
    const headerSpan = document.querySelector(`.header-icon.${view}`);
    if (headerSpan) headerSpan.textContent = icon;
  });
}

function renderNavIconSettings() {
  const el = document.getElementById("navIconSettings");
  if (!el) return;
  const icons = Store.state.appearance.navIcons;
  el.innerHTML = NAV_SECTIONS.map((s) => `
    <div class="balance-row">
      <span class="balance-row-name">${s.label}</span>
      <button type="button" class="icon-choice-btn" data-view="${s.view}">${icons[s.view]}</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openIconPicker(icons[btn.dataset.view], (icon) => {
        Store.setNavIcon(btn.dataset.view, icon);
        applyNavIcons();
        renderNavIconSettings();
        showToast("Icon updated");
      });
    });
  });
}

function renderDebtCategoryIconSettings() {
  const el = document.getElementById("debtCategoryIconSettings");
  if (!el) return;
  const icons = Store.state.appearance.debtCategoryIcons;
  el.innerHTML = OFW_DEBT_CATEGORIES.map((c) => `
    <div class="balance-row">
      <span class="balance-row-name">${c.label}</span>
      <button type="button" class="icon-choice-btn" data-cat="${c.value}">${icons[c.value] || "•"}</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openIconPicker(icons[btn.dataset.cat], (icon) => {
        Store.setDebtCategoryIcon(btn.dataset.cat, icon);
        renderDebtCategoryIconSettings();
        renderDebts();
        showToast("Icon updated");
      });
    });
  });
}
