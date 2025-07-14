//attendance.js
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
  const fullName = entry.last_name === "unregistered"
    ? "Unregistered ID"
    : `${entry.last_name}, ${entry.first_name}${entry.middle_name ? ' ' + entry.middle_name : ''}`;
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
  const enhancedEntry = {
    ...entry,
    is_unregistered: entry.last_name === "unregistered",
    sync_version: 2
  };
  const logs = JSON.parse(localStorage.getItem("offlineLogs") || "[]");
  logs.push(enhancedEntry);
  localStorage.setItem("offlineLogs", JSON.stringify(logs));
}

function syncStoredLogs() {
  if (!navigator.onLine) return;
  let offlineLogs = JSON.parse(localStorage.getItem("offlineLogs") || "[]");
  if (!offlineLogs.length) {
    status.textContent = "No offline logs to sync.";
    return;
  }
  let logsToSync = [...offlineLogs];
  let syncedCount = 0;
  let failed = false;

  // Use for...of for sequential sync and easier removal
  (async () => {
    for (let i = 0; i < logsToSync.length; i++) {
      const log = logsToSync[i];
      const normalized = normalizeLogEntry(log);
      try {
        const res = await fetch('/api/attendance', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalized)
        });
        const result = await res.json();
        if (result.status === "success") {
          syncedCount++;
          // Remove from offlineLogs
          offlineLogs = offlineLogs.filter((l, idx) => idx !== i);
        } else {
          failed = true;
        }
      } catch (err) {
        failed = true;
      }
    }
    localStorage.setItem("offlineLogs", JSON.stringify(offlineLogs));
    status.textContent = failed
      ? `Some logs failed to sync. ${syncedCount} synced.`
      : `All offline logs synced! (${syncedCount})`;
  })();
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
    let match = rfidToAttendee[scannedRfid];
    let now = new Date();
    let entry = {
      rfid: scannedRfid,
      event_id: currentEvent?.event_id,
      timestamp: now.toISOString(),
      status: "present",
      slot: getSlot(),
      time: now.toTimeString().slice(0,5),
      date: now.toISOString().slice(0,10),
      synced: false,
      first_name: match?.first_name || "",
      last_name: match?.last_name || "unregistered",
      attendee_no: match?.attendee_no || "unregistered",
      is_unregistered: !match
    };

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
        if (match) {
          status.textContent = `Hello, ${match.first_name}! Scan recorded.`;
        } else {
          status.textContent = "Scan recorded, but ID is unregistered.";
        }
      } else if (
        result.message &&
        result.message.includes("row-level security policy")
      ) {
        saveOffline(entry);
        status.textContent = "Scan could not be saved: permission error. Saved offline.";
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

function normalizeLogEntry(entry) {
  if (entry.attendee) {
    return {
      ...entry,
      ...entry.attendee,
      organization: entry.attendee.organization || ''
    };
  }
  return entry;
}

function renderLogs(logs) {
  logsDiv.innerHTML = '';
  logs.map(normalizeLogEntry).forEach(logEntry);
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

let currentEvent = null;
let attendees = [];
let rfidToAttendee = {};

async function loadCurrentEventAndAttendees() {
  try {
    // 1. Load current event
    const eventRes = await fetch('/api/attendance/latest-event');
    const eventData = await eventRes.json();
    if (!eventData || !eventData.event_id) throw new Error("No current event found");
    currentEvent = eventData;
    document.getElementById('currentEventLabel').textContent = `${currentEvent.event_name} (${currentEvent.start_date})`;

    // 2. Load attendees for this event
    const attendeesRes = await fetch(`/api/attendance/attendees/by-event/${currentEvent.event_id}`);
    attendees = await attendeesRes.json();

    // 3. Build RFID lookup map for fast scan
    rfidToAttendee = {};
    attendees.forEach(a => {
      if (a.rfid) rfidToAttendee[String(a.rfid).trim()] = a;
    });

    // 4. Ready for scan
    setStatus('Ready for next scan', true);
  } catch (e) {
    document.getElementById('currentEventLabel').textContent = "No current event found.";
    setStatus('Error loading event or attendees', false);
  }
}

// Call on page load
window.addEventListener('DOMContentLoaded', loadCurrentEventAndAttendees);

function setStatus(msg, online = true) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = msg;
    if (online) {
      statusDiv.classList.remove('offline');
      statusDiv.classList.add('online');
    } else {
      statusDiv.classList.remove('online');
      statusDiv.classList.add('offline');
    }
  }
}

