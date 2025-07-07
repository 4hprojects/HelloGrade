const input = document.getElementById('rfidInput');
const status = document.getElementById('status');
const logsDiv = document.getElementById('logs');
const reloadBtn = document.getElementById('reloadBtn');
const syncBtn = document.getElementById('syncBtn');
let registeredList = [];
let offlineLogs = JSON.parse(localStorage.getItem("offlineLogs") || "[]");
let currentEventId = null;
let currentEventName = "";

// Manual sync button handler
syncBtn.addEventListener("click", () => {
  status.textContent = "Manual sync started...";
  syncStoredLogs();
  focusInput();
});

async function loadRegisteredList() {
  status.textContent = "Loading registered data...";
  try {
    const res = await fetch('/api/attendees/all');
    registeredList = await res.json();
    status.textContent = "Ready to scan.";
  } catch (e) {
    status.textContent = "Failed to load registered data.";
  }
}

// Fetch registered list on load
window.addEventListener("load", loadRegisteredList);

// Reload button handler
reloadBtn.addEventListener("click", () => {
  loadRegisteredList();
  focusInput();
  setTimeout(() => console.log("Registered List:", registeredList), 1000);
});

function focusInput() {
  input.focus();
  input.select();
}

let customTimeSlots = null;

// Fetch custom time slots on load
async function loadTimeSlots() {
  try {
    const res = await fetch('/api/timeslots'); // Update this endpoint if needed
    customTimeSlots = await res.json();
    console.log("Loaded custom time slots:", customTimeSlots);
  } catch (e) {
    customTimeSlots = null;
    console.warn("Using default time slots.");
  }
}
window.addEventListener("load", loadTimeSlots);

function getSlot() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const current = h * 60 + m;

  if (customTimeSlots) {
    for (const [slot, value] of Object.entries(customTimeSlots)) {
      if (!value || !value.start || !value.end) continue;
      const [sh, sm] = value.start.split(":").map(Number);
      const [eh, em] = value.end.split(":").map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (endMin > startMin) {
        if (current >= startMin && current < endMin) {
          return slot.replace("_", " ");
        }
      } else {
        if (current >= startMin || current < endMin) {
          return slot.replace("_", " ");
        }
      }
    }
    if (h < 12) return "AM IN";
    if (h >= 12 && h < 13) return "AM OUT";
    if (h >= 13 && h < 17) return "PM IN";
    return "PM OUT";
  }
  if (h < 12) return "AM IN";
  if (h >= 12 && h < 13) return "AM OUT";
  if (h >= 13 && h < 17) return "PM IN";
  return "PM OUT";
}

function logEntry(entry) {
  const logsDiv = document.getElementById('logs-main');
  if (!logsDiv) return;
  const fullName = `${entry.last_name}, ${entry.first_name || ''}${entry.middle_name ? ' ' + entry.middle_name : ''}`;
  const slotBadge = `<span class="slot-badge" data-slot="${entry.slot || ''}">${entry.slot || ''}</span>`;
  const lateBadge = isLate(entry) ? `<span class="late-label">LATE</span>` : '';
  const org = entry.organization ? `<span class="org">${entry.organization}</span>` : '';
  const time = `<span class="log-time">${entry.time}</span>`;
  const logClass = entry.synced ? 'logged' : 'pending';
  const pendingBadge = !entry.synced
    ? `<span class="pending-label"><i class="fas fa-clock"></i> Pending Sync</span>`
    : '';
  const logHtml = `
    <li class="log-entry ${logClass}">
      <div class="log-main-row">
        <span class="log-name">${fullName}</span>
        <span class="slot-badge">${entry.slot || ''}</span>
        ${lateBadge}
        ${pendingBadge}
      </div>
      <div class="log-meta-row">
        <span class="log-time">${entry.time}</span>
        <span class="org">${entry.organization || ''}</span>
      </div>
    </li>
  `;
  if (logsDiv.firstChild && logsDiv.firstChild.classList) logsDiv.firstChild.classList.remove('new');
  const temp = document.createElement('div');
  temp.innerHTML = logHtml;
  const newLog = temp.firstElementChild;
  newLog.classList.add('new');
  logsDiv.prepend(newLog);
}

function saveOffline(entry) {
  const logs = JSON.parse(localStorage.getItem("offlineLogs") || "[]");
  logs.push(entry);
  localStorage.setItem("offlineLogs", JSON.stringify(logs));
}

function syncStoredLogs() {
  if (!navigator.onLine) return;
  if (!offlineLogs.length) {
    status.textContent = "No offline logs to sync.";
    return;
  }
  let logsToSync = [...offlineLogs];
  let syncedCount = 0;
  let failed = false;
  offlineLogs.forEach(async (log, idx) => {
    try {
      await fetch('/api/attendance', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log)
      });
      syncedCount++;
      offlineLogs = offlineLogs.filter(l => l !== log);
      localStorage.setItem("offlineLogs", JSON.stringify(offlineLogs));
      logEntry({ ...log, synced: true });
      if (syncedCount === logsToSync.length && !failed) {
        status.textContent = "All offline logs synced!";
      }
    } catch (e) {
      failed = true;
      status.innerHTML = `Sync failed. <button id="retrySyncBtn">Retry</button>`;
      document.getElementById('retrySyncBtn').onclick = syncStoredLogs;
    }
  });
}

function isLate(entry) {
  let amLateHour = 9, amLateMinute = 0;
  let pmLateHour = 13, pmLateMinute = 0;
  if (customTimeSlots) {
    if (entry.slot === "AM IN") {
      let cutoff = null;
      if (customTimeSlots.AM_START && customTimeSlots.AM_START.start) {
        cutoff = customTimeSlots.AM_START.start;
      } else if (customTimeSlots.AM_IN && customTimeSlots.AM_IN.start) {
        cutoff = customTimeSlots.AM_IN.start;
      }
      if (cutoff) {
        const [h, m] = cutoff.split(":").map(Number);
        amLateHour = h;
        amLateMinute = m;
      }
    }
    if (entry.slot === "PM IN") {
      let cutoff = null;
      if (customTimeSlots.PM_START && customTimeSlots.PM_START.start) {
        cutoff = customTimeSlots.PM_START.start;
      } else if (customTimeSlots.PM_IN && customTimeSlots.PM_IN.start) {
        cutoff = customTimeSlots.PM_IN.start;
      }
      if (cutoff) {
        const [h, m] = cutoff.split(":").map(Number);
        pmLateHour = h;
        pmLateMinute = m;
      }
    }
  }
  const [h, m] = entry.time ? entry.time.split(":").map(Number) : [0, 0];
  if (entry.slot === "AM IN") {
    return (h > amLateHour) || (h === amLateHour && m > amLateMinute);
  }
  if (entry.slot === "PM IN") {
    return (h > pmLateHour) || (h === pmLateHour && m > pmLateMinute);
  }
  return false;
}

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    const scannedRfid = input.value.trim();
    const match = registeredList.find(a => a.rfid === scannedRfid);

    let now = new Date();
    let entry = {
      rfid: scannedRfid,
      event_id: currentEventId,
      timestamp: now.toISOString(),
      status: "present",
      slot: getSlot(),
      time: now.toTimeString().slice(0,5),
      date: now.toISOString().slice(0,10),
      synced: false
    };

    if (match) {
      entry.attendee_no = match.attendee_no;
      entry.last_name = match.last_name;
      entry.first_name = match.first_name;
      entry.middle_name = match.middle_name;
      entry.organization = match.organization;
      entry.contact_no = match.contact_no;
      entry.id_number = match.id_number;
    } else {
      entry.last_name = "unregistered";
      entry.attendee_no = "unregistered";
    }

    // POST to backend (works for both registered and unregistered)
    try {
      const res = await fetch('/api/attendance', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      const result = await res.json();
      if (result.status === "success") {
        entry.synced = true;
        logEntry(entry);
        status.textContent = `Hello${match ? ', ' + match.first_name : ''}! Scan recorded.`;
      } else {
        saveOffline(entry);
        status.textContent = "Scan saved offline (server error).";
      }
    } catch (err) {
      saveOffline(entry);
      status.textContent = "Scan saved offline (network error).";
    }
    input.value = "";
    focusInput();
  }
});

function updateClock() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  document.getElementById('clock').textContent = now.toLocaleDateString('en-US', options);
}
setInterval(updateClock, 1000);
document.addEventListener("DOMContentLoaded", updateClock);
window.addEventListener('DOMContentLoaded', focusInput);

function updateStats(count) {
  const stats = document.getElementById('stats');
  if (stats) stats.textContent = `Today: ${count} attendees`;
}

function stripLeadingZeros(str) {
  return String(str).replace(/^0+/, '');
}

document.addEventListener('click', function(e) {
  const modal = document.getElementById('miniLoginModal');
  if (modal && modal.style.display !== 'none') return;
  if (e.target !== input) {
    focusInput();
  }
});

function updateSystemIndicator() {
  const indicator = document.getElementById('system-indicator');
  if (!indicator) return;
  if (navigator.onLine) {
    indicator.classList.add('system-online');
    indicator.classList.remove('system-offline');
    status.innerHTML = `<span id="system-indicator" class="system-online"></span>Ready for next scan`;
  } else {
    indicator.classList.add('system-offline');
    indicator.classList.remove('system-online');
    status.innerHTML = `<span id="system-indicator" class="system-offline"></span>Offline - logs will be saved locally`;
  }
}
window.addEventListener('online', () => {
  updateSystemIndicator();
  syncStoredLogs();
});
window.addEventListener('offline', updateSystemIndicator);
document.addEventListener('DOMContentLoaded', updateSystemIndicator);

function renderLogs(logs) {
  const logsDiv = document.getElementById('logs-main');
  logsDiv.innerHTML = '';
  if (!logs || logs.length === 0) {
    logsDiv.innerHTML = `
      <div class="empty-logs">
        <i class="fas fa-inbox"></i>
        <div>No attendance logs yet.</div>
      </div>
    `;
    return;
  }
  logs.forEach(entry => logEntry(entry));
}

document.querySelector('.sidebar-toggle').addEventListener('click', function() {
  const actions = document.getElementById('sidebar-actions');
  const expanded = this.getAttribute('aria-expanded') === 'true';
  this.setAttribute('aria-expanded', !expanded);
  actions.classList.toggle('open');
});

document.getElementById('downloadLogsBtn').addEventListener('click', function () {
  let logs = offlineLogs || [];
  if (!logs.length) {
    alert("No offline logs to download.");
    return;
  }
  const headers = [
    "RFID", "ID Number", "Last Name", "First Name", "Middle Name",
    "Organization", "Contact No", "Date", "Time", "Slot", "Late", "Synced"
  ];
  const rows = logs.map(entry => [
    entry.rfid,
    entry.id_number,
    entry.last_name,
    entry.first_name,
    entry.middle_name,
    entry.organization,
    entry.contact_no,
    entry.date,
    entry.time,
    entry.slot,
    isLate(entry) ? "Yes" : "No",
    entry.synced ? "Yes" : "No"
  ]);
  const csvContent = [headers].concat(rows)
    .map(row => row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "offline_attendance_logs.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function downloadOfflineLogsXLSX() {
  if (!offlineLogs || offlineLogs.length === 0) return;
  const headers = [
    "RFID", "ID Number", "Last Name", "First Name", "Middle Name",
    "Organization", "Contact No", "Date", "Time", "Slot", "Late", "Synced"
  ];
  const data = offlineLogs.map(entry => [
    entry.rfid,
    entry.id_number,
    entry.last_name,
    entry.first_name,
    entry.middle_name,
    entry.organization,
    entry.contact_no,
    entry.date,
    entry.time,
    entry.slot,
    isLate(entry) ? "Yes" : "No",
    entry.synced ? "Yes" : "No"
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offline Logs");
  XLSX.writeFile(wb, "offline_attendance_logs.xlsx");
}

window.addEventListener('beforeunload', function (e) {
  if (offlineLogs && offlineLogs.length > 0) {
    downloadOfflineLogsXLSX();
    e.preventDefault();
    e.returnValue = 'You have unsynced attendance logs. They have been downloaded, but please sync or save before leaving!';
    return e.returnValue;
  }
});

// --- Mini Login Modal Logic ---
function trapFocus(modal) {
  const focusable = modal.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
  let first = focusable[0];
  let last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
}

function showMiniLoginModal() {
  const modal = document.getElementById('miniLoginModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modal.focus();
  trapFocus(modal);
  setTimeout(() => document.getElementById('miniUsername').focus(), 100);
}

function hideMiniLoginModal() {
  document.getElementById('miniLoginModal').style.display = 'none';
  document.body.style.overflow = '';
}

function handleMiniLogin() {
  document.getElementById('miniLoginForm').onsubmit = async function(e) {
    e.preventDefault();
    const user = document.getElementById('miniUsername').value.trim();
    const pass = document.getElementById('miniPassword').value;
    const errorDiv = document.getElementById('miniLoginError');
    errorDiv.textContent = '';
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIDNumber: user, password: pass })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        errorDiv.textContent = data.message || 'Invalid username or password.';
        setTimeout(() => {
          if (!user) {
            document.getElementById('miniUsername').focus();
          } else {
            document.getElementById('miniPassword').focus();
          }
        }, 10);
      }
    } catch {
      errorDiv.textContent = 'Network error. Please try again.';
      setTimeout(() => document.getElementById('miniUsername').focus(), 10);
    }
  };
  const pwInput = document.getElementById('miniPassword');
  const toggle = document.getElementById('miniTogglePassword');
  toggle.onclick = function() {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    toggle.textContent = pwInput.type === 'password' ? '👁️' : '🙈';
  };
  toggle.onkeydown = function(e) {
    if (e.key === 'Enter' || e.key === ' ') toggle.click();
  };
}

async function checkAuthAndShowModal() {
  try {
    const res = await fetch('/api/check-auth', { credentials: 'same-origin' });
    if (res.ok) {
      hideMiniLoginModal();
      focusInput();
    } else {
      showMiniLoginModal();
      handleMiniLogin();
    }
  } catch {
    showMiniLoginModal();
    handleMiniLogin();
  }
}

document.addEventListener('DOMContentLoaded', checkAuthAndShowModal);

document.querySelector('.btn-logout').onclick = async function() {
  if (offlineLogs && offlineLogs.length > 0) {
    downloadOfflineLogsXLSX();
    await new Promise(r => setTimeout(r, 800));
  }
  await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.reload();
};

// Fetch the current/ongoing event from your backend
async function loadCurrentEvent() {
  try {
    const res = await fetch('/api/events/current');
    const event = await res.json();
    currentEventId = event.id;
    currentEventName = event.event_name;
    document.getElementById('currentEventLabel').textContent = `${currentEventName}`;
  } catch (e) {
    document.getElementById('currentEventLabel').textContent = "No current event found.";
  }
}
window.addEventListener("DOMContentLoaded", loadCurrentEvent);