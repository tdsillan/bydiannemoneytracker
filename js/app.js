function switchView(view) {
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
}

function refreshAllViews() {
  renderDashboard();
  renderDebts();
  renderGoals();
  renderExpenses();
  renderRemittances();
  renderNetWorth();
  renderContributions();
  renderSettings();
  renderPlanning();
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function initTopLevelButtons() {
  document.getElementById("addDebtBtn").addEventListener("click", () => openDebtForm());
  document.getElementById("addGoalBtn").addEventListener("click", () => openGoalForm());
  document.getElementById("addTxnBtn").addEventListener("click", () => openTxnForm());
  document.getElementById("addRecurringBtn").addEventListener("click", () => openRecurringForm());
  document.getElementById("addRemittanceBtn").addEventListener("click", () => openRemittanceForm());
  document.getElementById("addInvestmentBtn").addEventListener("click", () => openInvestmentForm());
}

function initExpenseFilters() {
  const keyMap = { filterMonth: "month", filterCategory: "category", filterType: "type", filterAccount: "accountId" };
  Object.keys(keyMap).forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      txnFilters[keyMap[id]] = e.target.value;
      renderTxnStatsAndTable();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  Store.load();
  applyTheme();
  applyNavIcons();
  initNav();
  initTopLevelButtons();
  initExpenseFilters();
  initSettingsHandlers();
  initPlanningHandlers();
  initPWA();
  refreshAllViews();
});
