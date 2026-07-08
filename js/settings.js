function applyTheme() {
  const s = Store.state.settings;
  document.documentElement.style.setProperty("--accent", s.accentColor);
  document.documentElement.style.setProperty("--accent-soft", s.accentColor + "1a");
  document.documentElement.classList.toggle("dark", !!s.darkMode);
  const name = s.userName.trim();
  document.getElementById("brandTitle").textContent = name ? `${name}'s Money Tracker` : "My Money Tracker";
}

function renderSettings() {
  const s = Store.state.settings;

  document.getElementById("settingName").value = s.userName;
  document.getElementById("settingAccent").value = s.accentColor;
  document.getElementById("settingDark").checked = !!s.darkMode;

  const currencySelect = document.getElementById("settingCurrency");
  currencySelect.innerHTML = currencyOptionsHtml(s.defaultCurrency);

  renderCategoryTags("expense", "expenseCategoryTags");
  renderCategoryTags("income", "incomeCategoryTags");
  renderAccountTags();
  renderExchangeRates();
  renderNavIconSettings();
  renderDebtCategoryIconSettings();
}

function renderExchangeRates() {
  const el = document.getElementById("exchangeRateList");
  const rates = Store.state.exchangeRates;
  if (rates.length === 0) {
    el.innerHTML = `<p class="muted empty-msg">No exchange rates saved yet.</p>`;
  } else {
    el.innerHTML = rates.map((r) => `
      <div class="balance-row">
        <span class="balance-row-name">1 ${r.from} = </span>
        <div class="balance-row-amounts">
          <span class="badge account">${r.rate} ${r.to}</span>
        </div>
        <button class="btn-danger small" data-id="${r.id}">Remove</button>
      </div>
    `).join("");
  }
  el.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Store.removeRate(btn.dataset.id);
      renderExchangeRates();
      refreshAllViews();
      showToast("Exchange rate removed");
    });
  });

  document.getElementById("newRateFrom").innerHTML = currencyOptionsHtml();
  document.getElementById("newRateTo").innerHTML = currencyOptionsHtml();
}

function renderAccountTags() {
  const el = document.getElementById("accountTags");
  el.innerHTML = Store.state.accounts.map((a) => `
    <span class="tag">${escapeHtml(a.name)}<button data-id="${a.id}" title="Remove">&times;</button></span>
  `).join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      Store.removeAccount(btn.dataset.id);
      renderAccountTags();
      refreshAllViews();
      showToast("Account removed");
    });
  });
}

function renderCategoryTags(kind, containerId) {
  const el = document.getElementById(containerId);
  const cats = Store.state.categories[kind];
  el.innerHTML = cats.map((c) => `
    <span class="tag">
      <button type="button" class="tag-icon-btn" data-cat="${escapeHtml(c)}" title="Change icon">${Store.state.appearance.categoryIcons[c] || "•"}</button>
      ${escapeHtml(c)}
      <button data-kind="${kind}" data-cat="${escapeHtml(c)}" title="Remove">&times;</button>
    </span>
  `).join("");
  el.querySelectorAll("button[data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Store.removeCategory(btn.dataset.kind, btn.dataset.cat);
      renderCategoryTags(kind, containerId);
      showToast("Category removed");
    });
  });
  el.querySelectorAll(".tag-icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      openIconPicker(Store.state.appearance.categoryIcons[cat], (icon) => {
        Store.setCategoryIcon(cat, icon);
        renderCategoryTags(kind, containerId);
        refreshAllViews();
        showToast("Icon updated");
      });
    });
  });
}

function initSettingsHandlers() {
  document.getElementById("settingName").addEventListener("input", (e) => {
    Store.state.settings.userName = e.target.value;
    Store.save();
    applyTheme();
    renderGreeting();
    regenerateManifest();
  });

  document.getElementById("settingCurrency").addEventListener("change", (e) => {
    Store.state.settings.defaultCurrency = e.target.value;
    Store.save();
    refreshAllViews();
  });

  document.getElementById("addAccountBtn").addEventListener("click", () => {
    const input = document.getElementById("newAccountName");
    Store.addAccount(input.value);
    input.value = "";
    renderAccountTags();
  });

  document.getElementById("addRateBtn").addEventListener("click", () => {
    const from = document.getElementById("newRateFrom").value;
    const to = document.getElementById("newRateTo").value;
    const valueInput = document.getElementById("newRateValue");
    const rate = parseFloat(valueInput.value);
    if (from === to) { showToast("Pick two different currencies"); return; }
    if (!rate || rate <= 0) { showToast("Enter a valid rate"); return; }
    Store.setRate(from, to, rate);
    valueInput.value = "";
    renderExchangeRates();
    refreshAllViews();
    showToast("Exchange rate saved");
  });

  document.getElementById("settingAccent").addEventListener("input", (e) => {
    Store.state.settings.accentColor = e.target.value;
    Store.save();
    applyTheme();
    regenerateManifest();
  });

  document.getElementById("settingDark").addEventListener("change", (e) => {
    Store.state.settings.darkMode = e.target.checked;
    Store.save();
    applyTheme();
  });

  document.getElementById("addExpenseCategoryBtn").addEventListener("click", () => {
    const input = document.getElementById("newExpenseCategory");
    Store.addCategory("expense", input.value);
    input.value = "";
    renderCategoryTags("expense", "expenseCategoryTags");
  });

  document.getElementById("addIncomeCategoryBtn").addEventListener("click", () => {
    const input = document.getElementById("newIncomeCategory");
    Store.addCategory("income", input.value);
    input.value = "";
    renderCategoryTags("income", "incomeCategoryTags");
  });

  const exportHandler = () => Store.exportBackup();
  document.getElementById("exportBtn").addEventListener("click", exportHandler);
  document.getElementById("exportBtn2").addEventListener("click", exportHandler);

  const importHandler = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Store.importBackup(file, (ok) => {
      if (ok) {
        applyTheme();
        refreshAllViews();
        showToast("Backup imported");
      } else {
        showToast("Could not read that file");
      }
      e.target.value = "";
    });
  };
  document.getElementById("importFile").addEventListener("change", importHandler);
  document.getElementById("importFile2").addEventListener("change", importHandler);

  document.getElementById("clearDataBtn").addEventListener("click", () => {
    if (confirm("This will permanently delete all debts, goals, and transactions. Continue?")) {
      Store.resetAll();
      applyTheme();
      refreshAllViews();
      showToast("All data cleared");
    }
  });
}
