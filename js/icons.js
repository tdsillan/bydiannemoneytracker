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

function isImageIcon(icon) {
  return !!icon && icon.startsWith("data:image");
}

function iconDisplayHtml(icon, size) {
  if (isImageIcon(icon)) {
    return `<img src="${icon}" alt="" class="icon-image" style="width:${size}px;height:${size}px;">`;
  }
  return escapeHtml(icon || "");
}

function resizeImageFileToDataUrl(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function iconPickerGridHtml(current) {
  return ICON_CHOICES.map((ic) => `<button type="button" class="icon-choice ${ic === current ? "selected" : ""}" data-icon="${ic}">${ic}</button>`).join("");
}

function openIconPicker(current, onSelect) {
  Modal.open("Choose an icon", `
    <div class="icon-picker-grid">${iconPickerGridHtml(current)}</div>
    <div class="form-row">
      <label>Or type your own emoji/symbol
        <input type="text" id="f-custom-icon" maxlength="4" value="${current && !ICON_CHOICES.includes(current) && !isImageIcon(current) ? escapeHtml(current) : ""}">
      </label>
    </div>
    <div class="form-row">
      <label>Or upload your own image
        <input type="file" id="f-icon-upload" accept="image/*">
      </label>
      <div id="uploadPreviewRow" style="display:${isImageIcon(current) ? "flex" : "none"}; align-items:center; gap:8px; margin-top:6px;">
        <img id="uploadPreview" src="${isImageIcon(current) ? current : ""}" alt="" class="icon-image" style="width:32px;height:32px;">
        <span class="muted small">Uploaded image selected</span>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="saveBtn">Use this icon</button>
    </div>
  `, (body) => {
    let chosen = current;
    const customInput = body.querySelector("#f-custom-icon");
    const previewRow = body.querySelector("#uploadPreviewRow");
    const previewImg = body.querySelector("#uploadPreview");

    body.querySelectorAll(".icon-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        chosen = btn.dataset.icon;
        customInput.value = "";
        previewRow.style.display = "none";
        body.querySelectorAll(".icon-choice").forEach((b) => b.classList.toggle("selected", b === btn));
      });
    });

    customInput.addEventListener("input", () => {
      body.querySelectorAll(".icon-choice").forEach((b) => b.classList.remove("selected"));
      previewRow.style.display = "none";
    });

    body.querySelector("#f-icon-upload").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      chosen = await resizeImageFileToDataUrl(file, 64);
      previewImg.src = chosen;
      previewRow.style.display = "flex";
      customInput.value = "";
      body.querySelectorAll(".icon-choice").forEach((b) => b.classList.remove("selected"));
    });

    body.querySelector("#cancelBtn").addEventListener("click", () => Modal.close());
    body.querySelector("#saveBtn").addEventListener("click", () => {
      const custom = customInput.value.trim();
      onSelect(custom || chosen || "");
      Modal.close();
    });
  });
}

function applyNavIcons() {
  const icons = Store.state.appearance.navIcons;
  Object.entries(icons).forEach(([view, icon]) => {
    const navSpan = document.querySelector(`.nav-item[data-view="${view}"] .nav-icon`);
    if (navSpan) navSpan.innerHTML = iconDisplayHtml(icon, 16);
    const headerSpan = document.querySelector(`.header-icon.${view}`);
    if (headerSpan) headerSpan.innerHTML = iconDisplayHtml(icon, 22);
  });
}

function renderNavIconSettings() {
  const el = document.getElementById("navIconSettings");
  if (!el) return;
  const icons = Store.state.appearance.navIcons;
  el.innerHTML = NAV_SECTIONS.map((s) => `
    <div class="balance-row">
      <span class="balance-row-name">${s.label}</span>
      <button type="button" class="icon-choice-btn" data-view="${s.view}">${iconDisplayHtml(icons[s.view], 18)}</button>
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
      <button type="button" class="icon-choice-btn" data-cat="${c.value}">${icons[c.value] ? iconDisplayHtml(icons[c.value], 18) : "•"}</button>
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
