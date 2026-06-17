(() => {
  /**
   * Hourly Tracker – completely rebuilt for better mobile support
   *
   * This script manages time tracking, call‑outs, commissions, pay settings,
   * paycheck estimation, and summary calculations. Data is persisted in
   * localStorage so the app can be used offline as a PWA.
   */

  // State arrays loaded from localStorage
  let entries = JSON.parse(localStorage.getItem('entries')) || [];
  let callouts = JSON.parse(localStorage.getItem('callouts')) || [];
  let commissions = JSON.parse(localStorage.getItem('commissions')) || [];

  // Validate persisted data: if schema changed, reset arrays to prevent NaN
  function validateData() {
    // Validate entries: should have regMinutes, otMinutes and pay
    if (
      Array.isArray(entries) &&
      entries.some(
        (e) =>
          typeof e.regMinutes !== 'number' ||
          typeof e.otMinutes !== 'number' ||
          typeof e.pay !== 'number'
      )
    ) {
      entries = [];
      localStorage.setItem('entries', JSON.stringify(entries));
    }
    // Validate callouts: should have type and date
    if (
      Array.isArray(callouts) &&
      callouts.some((c) => !c.type || !c.date)
    ) {
      callouts = [];
      localStorage.setItem('callouts', JSON.stringify(callouts));
    }
    // Validate commissions: should have amount and date
    if (
      Array.isArray(commissions) &&
      commissions.some((c) => typeof c.amount !== 'number' || !c.date)
    ) {
      commissions = [];
      localStorage.setItem('commissions', JSON.stringify(commissions));
    }
  }

  // Pay rate settings with defaults
  let regularRate = parseFloat(localStorage.getItem('regularRate')) || 32;
  let overtimeRate = parseFloat(localStorage.getItem('overtimeRate')) || 48;
  let weekdayCalloutRate = parseFloat(localStorage.getItem('weekdayCalloutRate')) || 25;
  let weekendCalloutRate = parseFloat(localStorage.getItem('weekendCalloutRate')) || 50;

  // Current shift tracking
  let currentShift = null; // { start: Date }
  let timerInterval = null;

  /* Helper functions */

  // Format minutes as "xh ym"
  function formatMinutes(mins) {
    const hours = Math.floor(mins / 60);
    const minutes = Math.floor(mins % 60);
    return `${hours}h ${minutes}m`;
  }

  // Format currency
  function formatCurrency(value) {
    return `$${value.toFixed(2)}`;
  }

  // Update today's date and time
  function updateTodayDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('todayDate').textContent = now.toLocaleDateString(undefined, options);
  }

  // Compute if a date is weekend
  function isWeekend(d) {
    const day = d.getDay();
    return day === 0 || day === 6; // Sunday (0) or Saturday (6)
  }

  // Start shift handler
  function startShift() {
    if (currentShift) return;
    currentShift = { start: new Date() };
    document.getElementById('startTime').textContent = currentShift.start
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('startShiftBtn').disabled = true;
    document.getElementById('stopShiftBtn').disabled = false;
    updateRunningDisplay(0, 0);
    timerInterval = setInterval(updateRunningTime, 1000);
  }

  // Stop shift handler
  function stopShift() {
    if (!currentShift) return;
    clearInterval(timerInterval);
    const end = new Date();
    const diffMs = end - currentShift.start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const regMinutes = Math.min(totalMinutes, 480); // up to 8 hours (480 mins)
    const otMinutes = Math.max(totalMinutes - 480, 0);
    // Compute pay
    const regPay = (regMinutes / 60) * regularRate;
    const otPay = (otMinutes / 60) * overtimeRate;
    const pay = regPay + otPay;
    // Store entry
    const entry = {
      date: currentShift.start.toISOString(),
      start: currentShift.start.toISOString(),
      end: end.toISOString(),
      regMinutes,
      otMinutes,
      pay,
    };
    entries.push(entry);
    localStorage.setItem('entries', JSON.stringify(entries));
    currentShift = null;
    document.getElementById('startShiftBtn').disabled = false;
    document.getElementById('stopShiftBtn').disabled = true;
    document.getElementById('startTime').textContent = '--:--';
    updateRunningDisplay(0, 0);
    updateUI();
  }

  // Update running timer display
  function updateRunningTime() {
    if (!currentShift) return;
    const now = new Date();
    const diffMs = now - currentShift.start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const regMinutes = Math.min(totalMinutes, 480);
    const otMinutes = Math.max(totalMinutes - 480, 0);
    updateRunningDisplay(regMinutes, otMinutes);
  }

  function updateRunningDisplay(regMinutes, otMinutes) {
    document.getElementById('runningTime').textContent = formatMinutes(regMinutes);
    document.getElementById('runningOvertime').textContent = formatMinutes(otMinutes);
  }

  // Add call‑out
  function addCallout() {
    const type = document.getElementById('calloutType').value;
    const dateVal = document.getElementById('calloutDate').value;
    if (!dateVal) {
      alert('Please select a date for the call‑out.');
      return;
    }
    const date = new Date(dateVal);
    const callout = {
      date: date.toISOString(),
      type,
    };
    callouts.push(callout);
    localStorage.setItem('callouts', JSON.stringify(callouts));
    updateUI();
  }

  // Add commission
  function addCommission() {
    const amountVal = parseFloat(document.getElementById('commissionAmount').value);
    const dateVal = document.getElementById('commissionDate').value;
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Enter a valid commission amount.');
      return;
    }
    if (!dateVal) {
      alert('Select a date for the commission.');
      return;
    }
    const commission = {
      date: new Date(dateVal).toISOString(),
      amount: amountVal,
    };
    commissions.push(commission);
    localStorage.setItem('commissions', JSON.stringify(commissions));
    document.getElementById('commissionAmount').value = '';
    updateUI();
  }

  // Save pay rates
  function saveRates() {
    const reg = parseFloat(document.getElementById('rateRegular').value);
    const ot = parseFloat(document.getElementById('rateOvertime').value);
    const weekday = parseFloat(
      document.getElementById('rateWeekdayCallout').value
    );
    const weekend = parseFloat(
      document.getElementById('rateWeekendCallout').value
    );
    if (
      [reg, ot, weekday, weekend].some(
        (v) => isNaN(v) || v < 0
      )
    ) {
      alert('Please enter valid pay rates.');
      return;
    }
    regularRate = reg;
    overtimeRate = ot;
    weekdayCalloutRate = weekday;
    weekendCalloutRate = weekend;
    localStorage.setItem('regularRate', regularRate);
    localStorage.setItem('overtimeRate', overtimeRate);
    localStorage.setItem('weekdayCalloutRate', weekdayCalloutRate);
    localStorage.setItem('weekendCalloutRate', weekendCalloutRate);
    alert('Rates saved!');
    updateUI();
  }

  // Estimate paycheck
  function estimatePay() {
    const regHours = parseFloat(document.getElementById('estRegHours').value) || 0;
    const overHours = parseFloat(document.getElementById('estOverHours').value) || 0;
    const weekdayCount = parseInt(
      document.getElementById('estWeekdayCallouts').value
    ) || 0;
    const weekendCount = parseInt(
      document.getElementById('estWeekendCallouts').value
    ) || 0;
    const commission = parseFloat(
      document.getElementById('estCommission').value
    ) || 0;
    const frequencyMultiplier = parseFloat(
      document.getElementById('estFrequency').value
    );
    const regPay = regHours * regularRate;
    const otPay = overHours * overtimeRate;
    const calloutPay =
      weekdayCount * weekdayCalloutRate + weekendCount * weekendCalloutRate;
    const gross = (regPay + otPay + calloutPay + commission) * frequencyMultiplier;
    document.getElementById('estResult').textContent = formatCurrency(gross);
  }

  // Delete entry by index
  function deleteEntry(index) {
    entries.splice(index, 1);
    localStorage.setItem('entries', JSON.stringify(entries));
    updateUI();
  }

  // Update UI summary and table
  function updateUI() {
    // Today & week summary variables
    const now = new Date();
    const todayKey = now.toISOString().substring(0, 10);
    // Determine Monday of current week
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    // Adjust to Monday (1) where Sunday is 0
    const diffToMonday = (dayOfWeek + 6) % 7; // 0 (Mon) => 0, Tue -> 1 etc
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Accumulators
    let todayReg = 0;
    let todayOt = 0;
    let todayRegPay = 0;
    let todayOtPay = 0;
    let todayCallPay = 0;
    let todayCommissionPay = 0;

    let weekMinutes = 0;
    let weekPay = 0;

    // Process entries for today and week
    entries.forEach((entry) => {
      const entryDate = entry.date.substring(0, 10);
      const startDate = new Date(entry.start);
      if (entryDate === todayKey) {
        todayReg += entry.regMinutes;
        todayOt += entry.otMinutes;
        todayRegPay += (entry.regMinutes / 60) * regularRate;
        todayOtPay += (entry.otMinutes / 60) * overtimeRate;
      }
      if (startDate >= weekStart && startDate < weekEnd) {
        weekMinutes += entry.regMinutes + entry.otMinutes;
        weekPay += entry.pay;
      }
    });

    // Process call‑outs
    callouts.forEach((co) => {
      const dateKey = co.date.substring(0, 10);
      const coDate = new Date(co.date);
      const rate = co.type === 'weekday' ? weekdayCalloutRate : weekendCalloutRate;
      if (dateKey === todayKey) todayCallPay += rate;
      if (coDate >= weekStart && coDate < weekEnd) {
        weekPay += rate;
      }
    });

    // Process commissions
    commissions.forEach((com) => {
      const dateKey = com.date.substring(0, 10);
      const comDate = new Date(com.date);
      if (dateKey === todayKey) todayCommissionPay += com.amount;
      if (comDate >= weekStart && comDate < weekEnd) weekPay += com.amount;
    });

    // Update today summary
    const todayHours = todayReg + todayOt;
    document.getElementById('todayHours').textContent = formatMinutes(todayReg);
    document.getElementById('todayOvertime').textContent = formatMinutes(todayOt);
    document.getElementById('todayTotalHours').textContent = formatMinutes(todayHours);
    document.getElementById('todayRegPay').textContent = formatCurrency(todayRegPay);
    document.getElementById('todayOverPay').textContent = formatCurrency(todayOtPay);
    document.getElementById('todayCalloutPay').textContent = formatCurrency(todayCallPay);
    document.getElementById('todayCommission').textContent = formatCurrency(todayCommissionPay);
    const todayGross = todayRegPay + todayOtPay + todayCallPay + todayCommissionPay;
    document.getElementById('todayGrossPay').textContent = formatCurrency(todayGross);

    // Update weekly summary
    document.getElementById('weekTotalHours').textContent = formatMinutes(
      weekMinutes
    );
    document.getElementById('weekTotalPay').textContent = formatCurrency(weekPay);

    // Update entries table
    const tbody = document.querySelector('#entriesTable tbody');
    tbody.innerHTML = '';
    entries
      .slice()
      .reverse()
      .forEach((entry, idx) => {
        const tr = document.createElement('tr');
        const entryDate = new Date(entry.start);
        const endDate = new Date(entry.end);
        const displayIndex = entries.length - 1 - idx;
        tr.innerHTML = `
          <td>${entryDate.toLocaleDateString()}</td>
          <td>${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${formatMinutes(entry.regMinutes)}</td>
          <td>${formatMinutes(entry.otMinutes)}</td>
          <td>${formatCurrency(entry.pay)}</td>
          <td><button class="delete-btn" data-index="${displayIndex}">Delete</button></td>
        `;
        tbody.appendChild(tr);
      });
  }

  // Event listeners
  document.getElementById('startShiftBtn').addEventListener('click', startShift);
  document.getElementById('stopShiftBtn').addEventListener('click', stopShift);
  document.getElementById('addCalloutBtn').addEventListener('click', addCallout);
  document.getElementById('addCommissionBtn').addEventListener('click', addCommission);
  document.getElementById('saveRatesBtn').addEventListener('click', saveRates);
  document.getElementById('estimateBtn').addEventListener('click', estimatePay);

  // Delegated delete handler for dynamic buttons
  document
    .querySelector('#entriesTable tbody')
    .addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        deleteEntry(index);
      }
    });

  // Initialize default dates
  function initDates() {
    const todayIso = new Date().toISOString().substring(0, 10);
    document.getElementById('calloutDate').value = todayIso;
    document.getElementById('commissionDate').value = todayIso;
  }

  // Initialize pay settings inputs
  function initPaySettings() {
    document.getElementById('rateRegular').value = regularRate;
    document.getElementById('rateOvertime').value = overtimeRate;
    document.getElementById('rateWeekdayCallout').value = weekdayCalloutRate;
    document.getElementById('rateWeekendCallout').value = weekendCalloutRate;
  }

  // Initialize app
  function init() {
    // Clean up any stale data from previous versions
    validateData();
    updateTodayDate();
    initDates();
    initPaySettings();
    updateUI();
    // Update date header every minute
    setInterval(updateTodayDate, 60000);
  }

  init();
})();