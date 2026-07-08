function renderPlanning() {
  renderPlanningInputs();
  renderPlanningResults();
  if (!document.getElementById("compareScenariosPanel").hidden) renderScenarioComparison();
}

function renderPlanningInputs() {
  const p = Store.state.planning;
  document.getElementById("pl-income").value = p.monthlyIncome || "";
  document.getElementById("pl-age").value = p.age || "";
  document.getElementById("pl-retire-age").value = p.retirementAge;
  document.getElementById("pl-return-rate").value = p.returnRatePct;
  document.getElementById("pl-savings-rate").value = p.savingsRatePct;
  document.getElementById("pl-inflation-rate").value = p.inflationRatePct;
  document.getElementById("pl-needs-pct").value = p.needsPct;
  document.getElementById("pl-wants-pct").value = p.wantsPct;
  document.getElementById("pl-savings-pct").value = p.savingsPct;
  document.getElementById("pl-ef-short").value = p.efShortMonths;
  document.getElementById("pl-ef-long").value = p.efLongMonths;
}

function readPlanningInputs() {
  return {
    monthlyIncome: parseFloat(document.getElementById("pl-income").value) || 0,
    age: parseFloat(document.getElementById("pl-age").value) || 0,
    retirementAge: parseFloat(document.getElementById("pl-retire-age").value) || 0,
    returnRatePct: parseFloat(document.getElementById("pl-return-rate").value) || 0,
    savingsRatePct: parseFloat(document.getElementById("pl-savings-rate").value) || 0,
    inflationRatePct: parseFloat(document.getElementById("pl-inflation-rate").value) || 0,
    needsPct: parseFloat(document.getElementById("pl-needs-pct").value) || 0,
    wantsPct: parseFloat(document.getElementById("pl-wants-pct").value) || 0,
    savingsPct: parseFloat(document.getElementById("pl-savings-pct").value) || 0,
    efShortMonths: parseFloat(document.getElementById("pl-ef-short").value) || 0,
    efLongMonths: parseFloat(document.getElementById("pl-ef-long").value) || 0,
  };
}

function renderPlanningResults() {
  const p = readPlanningInputs();
  const cur = Store.state.settings.defaultCurrency;
  const yearsLeft = Math.max(0, p.retirementAge - p.age);
  const monthlySavings = p.monthlyIncome * (p.savingsRatePct / 100);
  const months = Math.round(yearsLeft * 12);
  const futureValue = futureValueAnnuity(monthlySavings, p.returnRatePct, months);

  const needsAmt = p.monthlyIncome * (p.needsPct / 100);
  const wantsAmt = p.monthlyIncome * (p.wantsPct / 100);
  const savingsAmt = p.monthlyIncome * (p.savingsPct / 100);

  const futureValuePHP = Store.convert(futureValue, cur, "PHP");
  let inflationCard = `
    <div class="stat-card">
      <div class="label">Retirement value in today's PHP</div>
      <div class="value">Add a ${cur}&rarr;PHP rate in Settings</div>
    </div>
  `;
  if (futureValuePHP !== null) {
    const realValuePHP = futureValuePHP / Math.pow(1 + p.inflationRatePct / 100, yearsLeft);
    inflationCard = `
      <div class="stat-card">
        <div class="label">Retirement value in today's PHP <span class="muted small">(${p.inflationRatePct}%/yr inflation)</span></div>
        <div class="value positive">${fmtMoney(realValuePHP, "PHP")}</div>
      </div>
    `;
  }

  document.getElementById("planningStatGrid").innerHTML = `
    <div class="stat-card">
      <div class="label">Years left to retirement</div>
      <div class="value">${yearsLeft}</div>
    </div>
    <div class="stat-card">
      <div class="label">Monthly savings target (${p.savingsRatePct}%)</div>
      <div class="value positive">${fmtMoney(monthlySavings, cur)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Projected value at retirement</div>
      <div class="value positive">${fmtMoney(futureValue, cur)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Suggested remittance home <span class="muted small">(from Savings %)</span></div>
      <div class="value positive">${fmtMoney(savingsAmt, cur)}</div>
    </div>
    ${inflationCard}
  `;

  const maxAmt = Math.max(needsAmt, wantsAmt, savingsAmt, 1);
  document.getElementById("planningSplit").innerHTML = [
    ["Needs", needsAmt, p.needsPct],
    ["Wants", wantsAmt, p.wantsPct],
    ["Savings", savingsAmt, p.savingsPct],
  ].map(([label, amt, pct]) => `
    <div class="cat-row">
      <span class="cat-name">${label} (${pct}%)</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(amt / maxAmt) * 100}%"></div></div>
      <span class="cat-amount">${fmtMoney(amt, cur)}</span>
    </div>
  `).join("");

  document.getElementById("plSplitWarning").hidden = (p.needsPct + p.wantsPct + p.savingsPct) === 100;

  document.getElementById("planningEmergencyFund").innerHTML = `
    <div class="mini-row">
      <span class="name">${p.efShortMonths} months worth</span>
      <span class="amount">${fmtMoney(p.monthlyIncome * p.efShortMonths, cur)}</span>
    </div>
    <div class="mini-row">
      <span class="name">${p.efLongMonths} months worth</span>
      <span class="amount">${fmtMoney(p.monthlyIncome * p.efLongMonths, cur)}</span>
    </div>
  `;
}

function computeScenario(monthlyIncome, savingsRatePct, returnRatePct, years) {
  const monthlySavings = monthlyIncome * (savingsRatePct / 100);
  const months = Math.round(Math.max(0, years) * 12);
  const futureValue = futureValueAnnuity(monthlySavings, returnRatePct, months);
  return { monthlySavings, futureValue };
}

function renderScenarioComparison() {
  const cur = Store.state.settings.defaultCurrency;
  const p = Store.state.planning;
  const yearsA = Math.max(0, p.retirementAge - p.age);
  const a = computeScenario(p.monthlyIncome, p.savingsRatePct, p.returnRatePct, yearsA);

  document.getElementById("scenarioAStats").innerHTML = `
    <div class="mini-row"><span class="name">Monthly savings</span><span class="amount">${fmtMoney(a.monthlySavings, cur)}</span></div>
    <div class="mini-row"><span class="name">Projected value</span><span class="amount">${fmtMoney(a.futureValue, cur)}</span></div>
  `;

  const bIncome = parseFloat(document.getElementById("plb-income").value) || p.monthlyIncome;
  const bSavingsRate = parseFloat(document.getElementById("plb-savings-rate").value) || p.savingsRatePct;
  const bReturnRate = parseFloat(document.getElementById("plb-return-rate").value);
  const bYears = parseFloat(document.getElementById("plb-years").value) || yearsA;
  const b = computeScenario(bIncome, bSavingsRate, isNaN(bReturnRate) ? p.returnRatePct : bReturnRate, bYears);

  document.getElementById("scenarioBStats").innerHTML = `
    <div class="mini-row"><span class="name">Monthly savings</span><span class="amount">${fmtMoney(b.monthlySavings, cur)}</span></div>
    <div class="mini-row"><span class="name">Projected value</span><span class="amount">${fmtMoney(b.futureValue, cur)}</span></div>
  `;

  const maxSavings = Math.max(a.monthlySavings, b.monthlySavings, 1);
  const maxFuture = Math.max(a.futureValue, b.futureValue, 1);
  document.getElementById("scenarioChart").innerHTML = `
    <div class="scenario-bar-row">
      <div class="scenario-bar-label"><span>Monthly savings</span></div>
      <div class="scenario-bar-pair">
        <div class="scenario-bar-track"><div class="scenario-bar-fill a" style="width:${(a.monthlySavings / maxSavings) * 100}%"></div></div>
        <span class="muted small">A: ${fmtMoney(a.monthlySavings, cur)}</span>
        <div class="scenario-bar-track"><div class="scenario-bar-fill b" style="width:${(b.monthlySavings / maxSavings) * 100}%"></div></div>
        <span class="muted small">B: ${fmtMoney(b.monthlySavings, cur)}</span>
      </div>
    </div>
    <div class="scenario-bar-row">
      <div class="scenario-bar-label"><span>Projected value at retirement</span></div>
      <div class="scenario-bar-pair">
        <div class="scenario-bar-track"><div class="scenario-bar-fill a" style="width:${(a.futureValue / maxFuture) * 100}%"></div></div>
        <span class="muted small">A: ${fmtMoney(a.futureValue, cur)}</span>
        <div class="scenario-bar-track"><div class="scenario-bar-fill b" style="width:${(b.futureValue / maxFuture) * 100}%"></div></div>
        <span class="muted small">B: ${fmtMoney(b.futureValue, cur)}</span>
      </div>
    </div>
  `;
}

function initPlanningHandlers() {
  const fieldIds = ["pl-income", "pl-age", "pl-retire-age", "pl-return-rate", "pl-savings-rate", "pl-inflation-rate", "pl-needs-pct", "pl-wants-pct", "pl-savings-pct", "pl-ef-short", "pl-ef-long"];
  fieldIds.forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      Store.updatePlanning(readPlanningInputs());
      renderPlanningResults();
      if (!document.getElementById("compareScenariosPanel").hidden) renderScenarioComparison();
    });
  });

  const scenarioBIds = ["plb-income", "plb-savings-rate", "plb-return-rate", "plb-years"];
  scenarioBIds.forEach((id) => {
    document.getElementById(id).addEventListener("input", renderScenarioComparison);
  });

  document.getElementById("toggleCompareBtn").addEventListener("click", () => {
    const panel = document.getElementById("compareScenariosPanel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      const p = Store.state.planning;
      document.getElementById("plb-income").value = p.monthlyIncome || "";
      document.getElementById("plb-savings-rate").value = p.savingsRatePct;
      document.getElementById("plb-return-rate").value = p.returnRatePct;
      document.getElementById("plb-years").value = Math.max(0, p.retirementAge - p.age);
      renderScenarioComparison();
    }
  });
}
