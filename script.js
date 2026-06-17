(() => {
  // Constants
  // Default pay rates; these will be overridden by user settings if present in localStorage.
  let HOURLY_RATE = 32;
  let OT_RATE = 48;
  const DAILY_LIMIT_MIN = 8 * 60;
  // Call‑out rates stored in an object. Defaults set to weekday $25 and weekend $50 per user request.
  const calloutRates = { weekday: 25, weekend: 50 };

  // Persistent state
  let startTimestamp = null;
  let timerInterval = null;
  let entries = JSON.parse(localStorage.getItem('entries') || '[]');
  let callouts = JSON.parse(localStorage.getItem('callouts') || '[]');

  // Commissions array
  let commissions = JSON.parse(localStorage.getItem('commissions') || '[]');

  // Load custom pay rates from localStorage if present
  const storedReg = parseFloat(localStorage.getItem('rateRegular'));
  if (!isNaN(storedReg)) {
    HOURLY_RATE = storedReg;
  }
  const storedOT = parseFloat(localStorage.getItem('rateOvertime'));
  if (!isNaN(storedOT)) {
    OT_RATE = storedOT;
  }
  const storedWeekdayCO = parseFloat(localStorage.getItem('rateWeekdayCallout'));
  if (!isNaN(storedWeekdayCO)) {
    calloutRates.weekday = storedWeekdayCO;
  }
  const storedWeekendCO = parseFloat(localStorage.getItem('rateWeekendCallout'));
  if (!isNaN(storedWeekendCO)) {
    calloutRates.weekend = storedWeekendCO;
  }

  // DOM references
  const currentDateEl = document.getElementById('currentDate');
  const periodSelect = document.getElementById('periodSelect');

  const startTimeDisplay = document.getElementById('startTimeDisplay');
  const endTimeDisplay = document.getElementById('endTimeDisplay');
  const totalTimeDisplay = document.getElementById('totalTimeDisplay');
  const overtimeDisplay = document.getElementById('overtimeDisplay');

  const startBtn = document.getElementById('startShiftBtn');
  const stopBtn = document.getElementById('stopShiftBtn');

  const periodRegHoursEl = document.getElementById('periodRegHours');
  const periodOTHoursEl = document.getElementById('periodOTHours');
  const periodTotalHoursEl = document.getElementById('periodTotalHours');
  const periodRegPayEl = document.getElementById('periodRegPay');
  const periodOTPayEl = document.getElementById('periodOTPay');
  const periodHoursPayEl = document.getElementById('periodHoursPay');
  const periodCalloutTotalSummaryEl = document.getElementById('periodCalloutTotalSummary');
  const periodCombinedPayEl = document.getElementById('periodCombinedPay');

  const summaryHeadingEl = document.getElementById('summaryHeading');

  const calloutTypeEl = document.getElementById('calloutType');
  const calloutDateEl = document.getElementById('calloutDate');
  const calloutAmountEl = document.getElementById('calloutAmount');
  const calloutDescEl = document.getElementById('calloutDesc');
  const addCalloutBtn = document.getElementById('addCalloutBtn');

  const periodWeekdayCalloutEl = document.getElementById('periodWeekdayCallout');
  const periodWeekendCalloutEl = document.getElementById('periodWeekendCallout');
  const periodCalloutTotalEl = document.getElementById('periodCalloutTotal');

  const entriesBody = document.getElementById('entriesBody');

  // Settings and commission DOM elements
  const rateRegularInput = document.getElementById('rateRegular');
  const rateOvertimeInput = document.getElementById('rateOvertime');
  const rateWeekdayCalloutInput = document.getElementById('rateWeekdayCallout');
  const rateWeekendCalloutInput = document.getElementById('rateWeekendCallout');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const commissionAmountInput = document.getElementById('commissionAmount');
  const commissionDateInput = document.getElementById('commissionDate');
  const addCommissionBtn = document.getElementById('addCommissionBtn');
  const periodCommissionEl = document.getElementById('periodCommission');
  const periodCommissionTotalEl = document.getElementById('periodCommissionTotal');
  const runReportBtn = document.getElementById('runReportBtn');
  const labelRegPaySpan = document.getElementById('labelRegPay');
  const labelOTPaySpan = document.getElementById('labelOTPay');

  // Estimator elements
  const estimatorRegHoursInput = document.getElementById('estimatorRegHours');
  const estimatorOTHoursInput = document.getElementById('estimatorOTHours');
  const estimatorWeekdayCOInput = document.getElementById('estimatorWeekdayCO');
  const estimatorWeekendCOInput = document.getElementById('estimatorWeekendCO');
  const estimatorCommissionInput = document.getElementById('estimatorCommission');
  const estimateBtn = document.getElementById('estimateBtn');
  const estimatorResultEl = document.getElementById('estimatorResult');

  // Pay frequency dropdown for estimator
  const estimatorFrequencySelect = document.getElementById('estimatorFrequency');

  // Helpers
  function formatTime(min) {
    const hours = Math.floor(min / 60);
    const minutes = Math.floor(min % 60);
    return `${hours}h ${minutes}m`;
  }
  function formatCurrency(num) {
    return `$${num.toFixed(2)}`;
  }
  function getDateRange(period) {
    const now = new Date();
    let start;
    let end;
    if (period === 'week') {
      // start on Monday
      const day = now.getDay();
      const diff = (day === 0 ? -6 : 1) - day; // convert Sunday to Monday
      start = new Date(now);
      start.setHours(0,0,0,0);
      start.setDate(now.getDate() + diff);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
      // today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(start.getDate() + 1);
    }
    return [start, end];
  }
  function updateCurrentDateLabel() {
    const period = periodSelect.value;
    const [start, end] = getDateRange(period);
    const options = { month: 'short', day: 'numeric' };
    if (period === 'today') {
      currentDateEl.textContent = start.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      if (summaryHeadingEl) summaryHeadingEl.textContent = "Today's Summary";
    } else if (period === 'week') {
      const endPrev = new Date(end.getTime() - 1);
      currentDateEl.textContent = `${start.toLocaleDateString(undefined, options)} - ${endPrev.toLocaleDateString(undefined, options)}`;
      if (summaryHeadingEl) summaryHeadingEl.textContent = "This Week's Summary";
    } else {
      const endPrev = new Date(end.getTime() - 1);
      currentDateEl.textContent = `${start.toLocaleDateString(undefined, { month:'long', year:'numeric' })}`;
      if (summaryHeadingEl) summaryHeadingEl.textContent = "This Month's Summary";
    }
  }

  // Time tracking handlers
  startBtn.addEventListener('click', () => {
    if (startTimestamp) return;
    startTimestamp = Date.now();
    const startDate = new Date(startTimestamp);
    startTimeDisplay.value = startDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    endTimeDisplay.value = '';
    totalTimeDisplay.textContent = '0h 0m';
    overtimeDisplay.textContent = '0h 0m overtime';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // default date for callout input
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const todayIso = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
    if (!calloutDateEl.value) calloutDateEl.value = todayIso;

    // Start live timer to update display continuously
    timerInterval = setInterval(() => {
      if (!startTimestamp) return;
      const now = Date.now();
      const totalMinutes = Math.floor((now - startTimestamp) / 60000);
      const otMin = Math.max(0, totalMinutes - DAILY_LIMIT_MIN);
      totalTimeDisplay.textContent = formatTime(totalMinutes);
      overtimeDisplay.textContent = `${formatTime(otMin)} overtime`;
    }, 1000);
  });

  stopBtn.addEventListener('click', () => {
    if (!startTimestamp) return;
    const endTimestamp = Date.now();
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);
    const totalMinutes = Math.floor((endTimestamp - startTimestamp) / 60000);
    const regMin = Math.min(totalMinutes, DAILY_LIMIT_MIN);
    const otMin = Math.max(0, totalMinutes - DAILY_LIMIT_MIN);
    const regPay = (regMin / 60) * HOURLY_RATE;
    const otPay = (otMin / 60) * OT_RATE;
    const entry = {
      date: startDate.toISOString(),
      start: startDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      end: endDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      totalMinutes: totalMinutes,
      overtimeMinutes: otMin,
      hoursPay: regPay + otPay,
      calloutPay: 0,
      totalPay: regPay + otPay
    };
    entries.push(entry);
    localStorage.setItem('entries', JSON.stringify(entries));
    // update display
    totalTimeDisplay.textContent = formatTime(totalMinutes);
    overtimeDisplay.textContent = `${formatTime(otMin)} overtime`;
    // display the end time for the completed shift
    endTimeDisplay.value = endDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    // stop the live timer
    clearInterval(timerInterval);
    timerInterval = null;
    startTimestamp = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateUI();
  });

  // Callout display update
  function updateCalloutDisplay() {
    const type = calloutTypeEl.value;
    const amount = calloutRates[type] || 0;
    calloutAmountEl.textContent = formatCurrency(amount);
    calloutDescEl.textContent = type === 'weekday' ? 'Weekday Call‑Out' : 'Weekend Call‑Out';
  }
  calloutTypeEl.addEventListener('change', updateCalloutDisplay);

  // Add callout handler
  function handleAddCallout() {
    const type = calloutTypeEl.value;
    let dateVal = calloutDateEl.value;
    // Normalize date value: if in MM/DD/YYYY format convert to YYYY-MM-DD
    if (dateVal && dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        dateVal = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!dateVal) {
      alert('Please select a call‑out date.');
      return;
    }
    const amount = calloutRates[type] || 0;
    callouts.push({ type, date: dateVal, amount });
    localStorage.setItem('callouts', JSON.stringify(callouts));
    // update UI to recalc summaries
    updateUI();
    // Immediately recalculate and update current period call‑out summary and combined pay
    const period = periodSelect.value;
    const [startRange, endRange] = getDateRange(period);
    // convert to ISO date strings for comparison
    const startISO = startRange.toISOString().split('T')[0];
    const endISO = endRange.toISOString().split('T')[0];
    let weekdayCallout = 0;
    let weekendCallout = 0;
    // use stored callouts to ensure consistency
    const storedCallouts = JSON.parse(localStorage.getItem('callouts') || '[]');
    storedCallouts.forEach((c) => {
      const cDateStr = (c.date || '').split('T')[0];
      if (cDateStr >= startISO && cDateStr < endISO) {
        if (c.type === 'weekday') {
          weekdayCallout += c.amount;
        } else if (c.type === 'weekend') {
          weekendCallout += c.amount;
        }
      }
    });
    const calloutTotal = weekdayCallout + weekendCallout;
    periodWeekdayCalloutEl.textContent = formatCurrency(weekdayCallout);
    periodWeekendCalloutEl.textContent = formatCurrency(weekendCallout);
    periodCalloutTotalEl.textContent = formatCurrency(calloutTotal);
    if (periodCalloutTotalSummaryEl) {
      periodCalloutTotalSummaryEl.textContent = formatCurrency(calloutTotal);
    }
    // update combined pay by adding call‑out total to hours pay
    const hoursPayVal = parseFloat(periodHoursPayEl.textContent.replace(/[^0-9.\-]+/g, '')) || 0;
    if (periodCombinedPayEl) {
      periodCombinedPayEl.textContent = formatCurrency(hoursPayVal + calloutTotal);
    }
  }

  // Attach event listener to Add Call‑Out button
  addCalloutBtn.addEventListener('click', handleAddCallout);

  // Expose handler globally for inline onclick fallback
  window.handleAddCallout = handleAddCallout;

  // Period selection handler
  periodSelect.addEventListener('change', () => {
    updateCurrentDateLabel();
    updateUI();
  });

  // Save custom pay rate settings
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Read values from inputs and validate
      const regVal = parseFloat(rateRegularInput.value);
      if (!isNaN(regVal) && regVal >= 0) {
        HOURLY_RATE = regVal;
        localStorage.setItem('rateRegular', regVal.toString());
      }
      const otVal = parseFloat(rateOvertimeInput.value);
      if (!isNaN(otVal) && otVal >= 0) {
        OT_RATE = otVal;
        localStorage.setItem('rateOvertime', otVal.toString());
      }
      const weekdayVal = parseFloat(rateWeekdayCalloutInput.value);
      if (!isNaN(weekdayVal) && weekdayVal >= 0) {
        calloutRates.weekday = weekdayVal;
        localStorage.setItem('rateWeekdayCallout', weekdayVal.toString());
      }
      const weekendVal = parseFloat(rateWeekendCalloutInput.value);
      if (!isNaN(weekendVal) && weekendVal >= 0) {
        calloutRates.weekend = weekendVal;
        localStorage.setItem('rateWeekendCallout', weekendVal.toString());
      }
      // Update labels in summary card to reflect new rates
      if (labelRegPaySpan) {
        labelRegPaySpan.textContent = `Regular Pay (@ $${HOURLY_RATE}/hr)`;
      }
      if (labelOTPaySpan) {
        labelOTPaySpan.textContent = `Overtime Pay (@ $${OT_RATE}/hr)`;
      }
      // Update the call‑out display so user sees new default amount
      updateCalloutDisplay();
      // Recompute summary with new rates
      updateUI();
    });
  }

  // Add commission handler
  if (addCommissionBtn) {
    addCommissionBtn.addEventListener('click', () => {
      const amountVal = parseFloat(commissionAmountInput.value);
      const dateVal = commissionDateInput.value;
      if (isNaN(amountVal) || amountVal <= 0) {
        alert('Please enter a positive commission amount.');
        return;
      }
      if (!dateVal) {
        alert('Please select a date for the commission.');
        return;
      }
      commissions.push({ amount: amountVal, date: dateVal });
      localStorage.setItem('commissions', JSON.stringify(commissions));
      // Clear input fields
      commissionAmountInput.value = '';
      commissionDateInput.value = '';
      updateUI();
    });
  }

  // Run report handler: displays summary for current month or selected period
  if (runReportBtn) {
    runReportBtn.addEventListener('click', () => {
      const period = periodSelect.value;
      const [startRange, endRange] = getDateRange(period);
      let regMin = 0;
      let otMin = 0;
      entries.forEach((entry) => {
        const entryDate = new Date(entry.date);
        if (entryDate >= startRange && entryDate < endRange) {
          regMin += Math.min(entry.totalMinutes, DAILY_LIMIT_MIN);
          otMin += entry.overtimeMinutes;
        }
      });
      let weekdayCO = 0;
      let weekendCO = 0;
      const startISO = startRange.toISOString().split('T')[0];
      const endISO = endRange.toISOString().split('T')[0];
      JSON.parse(localStorage.getItem('callouts') || '[]').forEach((c) => {
        const cDateStr = (c.date || '').split('T')[0];
        if (cDateStr >= startISO && cDateStr < endISO) {
          if (c.type === 'weekday') weekdayCO += c.amount;
          else if (c.type === 'weekend') weekendCO += c.amount;
        }
      });
      let commissionTotal = 0;
      commissions.forEach((c) => {
        if (c.date >= startISO && c.date < endISO) {
          commissionTotal += parseFloat(c.amount) || 0;
        }
      });
      const regPay = (regMin / 60) * HOURLY_RATE;
      const otPay = (otMin / 60) * OT_RATE;
      const hoursPay = regPay + otPay;
      const calloutTotal = weekdayCO + weekendCO;
      const grossPay = hoursPay + calloutTotal + commissionTotal;
      const reportMsg =
        `${periodSelect.options[periodSelect.selectedIndex].text} Report\n\n` +
        `Regular Hours: ${formatTime(regMin)}\n` +
        `Overtime Hours: ${formatTime(otMin)}\n` +
        `Total Hours: ${formatTime(regMin + otMin)}\n` +
        `Regular Pay: ${formatCurrency(regPay)}\n` +
        `Overtime Pay: ${formatCurrency(otPay)}\n` +
        `Call‑Out Pay: ${formatCurrency(calloutTotal)}\n` +
        `Commission Pay: ${formatCurrency(commissionTotal)}\n` +
        `Gross Pay: ${formatCurrency(grossPay)}`;
      alert(reportMsg);
    });
  }

  // Estimate paycheck for custom hours with pay frequency multiplier
  if (estimateBtn) {
    estimateBtn.addEventListener('click', () => {
      const regHours = parseFloat(estimatorRegHoursInput.value) || 0;
      const otHours = parseFloat(estimatorOTHoursInput.value) || 0;
      const weekdayCOCount = parseFloat(estimatorWeekdayCOInput.value) || 0;
      const weekendCOCount = parseFloat(estimatorWeekendCOInput.value) || 0;
      const commissionVal = parseFloat(estimatorCommissionInput.value) || 0;
      const regPay = regHours * HOURLY_RATE;
      const otPay = otHours * OT_RATE;
      const coPay = (weekdayCOCount * calloutRates.weekday) + (weekendCOCount * calloutRates.weekend);
      // Determine multiplier based on selected pay frequency
      let multiplier = 1;
      if (estimatorFrequencySelect) {
        const freq = estimatorFrequencySelect.value;
        if (freq === 'biweekly') {
          multiplier = 2;
        } else if (freq === 'monthly') {
          // Approximate monthly pay as 4 pay periods
          multiplier = 4;
        } else if (freq === 'weekly') {
          multiplier = 1;
        } else {
          // perPeriod or unknown uses 1
          multiplier = 1;
        }
      }
      const gross = (regPay + otPay + coPay + commissionVal) * multiplier;
      if (estimatorResultEl) {
        estimatorResultEl.textContent = formatCurrency(gross);
      }
    });
  }

  // Delete entry from recent entries table
  entriesBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const idx = parseInt(e.target.getAttribute('data-index'));
      if (!isNaN(idx)) {
        entries.splice(idx, 1);
        localStorage.setItem('entries', JSON.stringify(entries));
        updateUI();
      }
    }
  });

  function updateSummary() {
    const period = periodSelect.value;
    const [startRange, endRange] = getDateRange(period);
    let regMin = 0;
    let otMin = 0;
    let weekdayCallout = 0;
    let weekendCallout = 0;
    entries.forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate >= startRange && entryDate < endRange) {
        regMin += Math.min(entry.totalMinutes, DAILY_LIMIT_MIN);
        otMin += entry.overtimeMinutes;
      }
    });
    // Re-read callouts from localStorage to ensure we use persisted data
    const storedCallouts = JSON.parse(localStorage.getItem('callouts') || '[]');
    // Use ISO string comparison to avoid timezone issues
    const startISO = startRange.toISOString().split('T')[0];
    const endISO = endRange.toISOString().split('T')[0];
    storedCallouts.forEach((c) => {
      const cDateStr = (c.date || '').split('T')[0];
      if (cDateStr >= startISO && cDateStr < endISO) {
        if (c.type === 'weekday') {
          weekdayCallout += c.amount;
        } else if (c.type === 'weekend') {
          weekendCallout += c.amount;
        }
      }
    });
    const regPay = (regMin / 60) * HOURLY_RATE;
    const otPay = (otMin / 60) * OT_RATE;
    const hoursPay = regPay + otPay;
    // Calculate commission totals
    let commissionTotal = 0;
    commissions.forEach((c) => {
      if (c.date) {
        if (c.date >= startISO && c.date < endISO) {
          commissionTotal += parseFloat(c.amount) || 0;
        }
      }
    });
    // Update summary elements
    periodRegHoursEl.textContent = formatTime(regMin);
    periodOTHoursEl.textContent = formatTime(otMin);
    periodTotalHoursEl.textContent = formatTime(regMin + otMin);
    periodRegPayEl.textContent = formatCurrency(regPay);
    periodOTPayEl.textContent = formatCurrency(otPay);
    periodHoursPayEl.textContent = formatCurrency(hoursPay);
    periodWeekdayCalloutEl.textContent = formatCurrency(weekdayCallout);
    periodWeekendCalloutEl.textContent = formatCurrency(weekendCallout);
    const calloutTotal = weekdayCallout + weekendCallout;
    periodCalloutTotalEl.textContent = formatCurrency(calloutTotal);
    if (periodCommissionEl) {
      periodCommissionEl.textContent = formatCurrency(commissionTotal);
    }
    if (periodCommissionTotalEl) {
      periodCommissionTotalEl.textContent = formatCurrency(commissionTotal);
    }
    if (periodCalloutTotalSummaryEl) {
      periodCalloutTotalSummaryEl.textContent = formatCurrency(calloutTotal);
    }
    if (periodCombinedPayEl) {
      periodCombinedPayEl.textContent = formatCurrency(hoursPay + calloutTotal + commissionTotal);
    }
  }

  function updateEntriesTable() {
    entriesBody.innerHTML = '';
    const displayEntries = entries.slice().reverse().slice(0, 5);
    displayEntries.forEach((entry, displayIndex) => {
      const idx = entries.length - 1 - displayIndex;
      const tr = document.createElement('tr');
      const totalMins = entry.totalMinutes;
      const otMins = entry.overtimeMinutes;
      const row = [
        new Date(entry.date).toLocaleDateString(),
        entry.start,
        entry.end,
        formatTime(totalMins),
        formatTime(otMins),
        formatCurrency(entry.hoursPay),
        formatCurrency(entry.calloutPay || 0),
        formatCurrency(entry.totalPay || (entry.hoursPay + (entry.calloutPay||0)))
      ];
      row.forEach((val) => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      const delTd = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.className = 'delete-btn btn secondary';
      delBtn.setAttribute('data-index', idx.toString());
      delTd.appendChild(delBtn);
      tr.appendChild(delTd);
      entriesBody.appendChild(tr);
    });
  }

  function updateUI() {
    updateSummary();
    updateEntriesTable();
  }

  function init() {
    updateCurrentDateLabel();
    updateCalloutDisplay();
    updateUI();
    // initialize default callout date if empty
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const todayIso = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
    if (!calloutDateEl.value) calloutDateEl.value = todayIso;

    // Populate pay settings inputs with current rates
    if (rateRegularInput) rateRegularInput.value = HOURLY_RATE;
    if (rateOvertimeInput) rateOvertimeInput.value = OT_RATE;
    if (rateWeekdayCalloutInput) rateWeekdayCalloutInput.value = calloutRates.weekday;
    if (rateWeekendCalloutInput) rateWeekendCalloutInput.value = calloutRates.weekend;

    // Update labels in summary card to reflect current rates
    if (labelRegPaySpan) {
      labelRegPaySpan.textContent = `Regular Pay (@ $${HOURLY_RATE}/hr)`;
    }
    if (labelOTPaySpan) {
      labelOTPaySpan.textContent = `Overtime Pay (@ $${OT_RATE}/hr)`;
    }
  }

  init();
})();