const API_URL = 'https://script.google.com/macros/s/AKfycbyRXVvf9XDXGsIZyDIZoA4DbhNLcS3rL4GDnby_BQoemU2gSKmuFaH-ga9uvm2FTkEcLg/exec';

const input = document.getElementById('rfidInput');
const status = document.getElementById('status');
const logsDiv = document.getElementById('logs');
const reloadBtn = document.getElementById('reloadBtn');
const syncBtn = document.getElementById('syncBtn');
let registeredList = [];  // 💡 store attendees here
let offlineLogs = JSON.parse(localStorage.getItem("offlineLogs") || "[]");

// Manual sync button handler
syncBtn.addEventListener("click", () => {
  status.textContent = "Manual sync started...";
  syncStoredLogs();
  focusInput();
});

async function loadRegisteredList() {
  status.textContent = "Loading registered data...";
  try {
    const res = await fetch(API_URL);
    registeredList = await res.json();
    status.textContent = "Ready to scan.";
  } catch (e) {
    status.textContent = "Failed to load registered data.";
  }
}

// Fetch registered list on load
window.addEventListener("load", async () => {
  try {
    const res = await fetch(API_URL);
    registeredList = await res.json();
    status.textContent = "Ready to scan.";
  } catch (e) {
    status.textContent = "Failed to load registered data.";
  }
});

// Reload button handler
reloadBtn.addEventListener("click", () => {
  loadRegisteredList();
  focusInput();
  console.log("Registered List:", registeredList);
});

function focusInput() {
  input.focus();
  input.select();
}

let customTimeSlots = null;

// Fetch custom time slots on load
async function loadTimeSlots() {
  try {
    const res = await fetch(API_URL + '?timeslots=1');
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

  // Use custom slots if loaded and valid
  if (customTimeSlots) {
    for (const [slot, value] of Object.entries(customTimeSlots)) {
      if (!value || !value.start || !value.end) continue;
      const [sh, sm] = value.start.split(":").map(Number);
      const [eh, em] = value.end.split(":").map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      // Handle midnight wrap-around
      if (endMin > startMin) {
        if (current >= startMin && current < endMin) {
          return slot.replace("_", " ");
        }
      } else {
        // Slot wraps past midnight
        if (current >= startMin || current < endMin) {
          return slot.replace("_", " ");
        }
      }
    }
    // Fallback to default logic if no custom slot matches
    if (h < 12) return "AM IN";
    if (h >= 12 && h < 13) return "AM OUT";
    if (h >= 13 && h < 17) return "PM IN";
    return "PM OUT";
  }

  // Default fallback
  if (h < 12) return "AM IN";
  if (h >= 12 && h < 13) return "AM OUT";
  if (h >= 13 && h < 17) return "PM IN";
  return "PM OUT";
}

function logEntry(entry) {
  const logsDiv = document.getElementById('logs-main');
  if (!logsDiv) return;

  // Compose full name
  const fullName = `${entry.last_name}, ${entry.first_name}${entry.middle_name ? ' ' + entry.middle_name : ''}`;
  // Slot badge
  const slotBadge = `<span class="slot-badge">${entry.slot || ''}</span>`;
  // Late badge
  const lateBadge = isLate(entry) ? `<span class="late-label">LATE</span>` : '';
  // Organization
  const org = entry.organization ? `<span class="org">${entry.organization}</span>` : '';
  // Entry time
  const time = `<span class="log-time">${entry.time}</span>`;

  const logHtml = `
    <li class="log-entry${entry.synced ? '' : ' unsynced'}">
      <div class="log-main-row">
        <span class="log-name">${fullName}</span>
        ${slotBadge}
        ${lateBadge}
      </div>
      <div class="log-meta-row">
        ${time}
        ${org}
      </div>
    </li>
  `;

  // Remove 'new' class from previous first log if needed
  if (logsDiv.firstChild && logsDiv.firstChild.classList) logsDiv.firstChild.classList.remove('new');
  const temp = document.createElement('div');
  temp.innerHTML = logHtml;
  logsDiv.prepend(temp.firstElementChild);
}

function saveOffline(entry) {
  const logs = JSON.parse(localStorage.getItem("logs") || "[]");
  logs.push(entry);
  localStorage.setItem("logs", JSON.stringify(logs));
}

function syncStoredLogs() {
  if (!navigator.onLine) return;
  if (!offlineLogs.length) {
    status.textContent = "No offline logs to sync.";
    return;
  }

  let logsToSync = [...offlineLogs];
  let syncedCount = 0;

  offlineLogs.forEach(async (log, idx) => {
    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log)
      });
      syncedCount++;
      // Remove from offlineLogs after successful sync
      offlineLogs = offlineLogs.filter(l => l !== log);
      localStorage.setItem("offlineLogs", JSON.stringify(offlineLogs));
      logEntry({ ...log, synced: true });
      if (syncedCount === logsToSync.length) {
        status.textContent = "All offline logs synced!";
      }
    } catch (e) {
      console.error("Sync failed", e);
      status.textContent = "Some logs failed to sync.";
    }
  });
}

function isLate(entry) {
  // Default cutoff times
  let amLateHour = 9, amLateMinute = 0;
  let pmLateHour = 13, pmLateMinute = 0;

  // Check custom timeslots if available
  if (customTimeSlots) {
    // For AM IN, use AM_START as cutoff if present, else AM_IN.start
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
    // For PM IN, use PM_START as cutoff if present, else PM_IN.start
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

  // Parse entry time
  const [h, m] = entry.time.split(":").map(Number);

  if (entry.slot === "AM IN") {
    // Late if after AM cutoff
    return (h > amLateHour) || (h === amLateHour && m > amLateMinute);
  }
  if (entry.slot === "PM IN") {
    // Late if after PM cutoff
    return (h > pmLateHour) || (h === pmLateHour && m > pmLateMinute);
  }
  // You can add more rules for other slots if needed
  return false;
}



input.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    let rfid = input.value.trim();
    input.value = "";
    focusInput();

    if (!rfid) return;

    rfid = stripLeadingZeros(rfid);

    const match = registeredList.find(entry => String(entry.rfid) === String(rfid));
    const now = new Date();
    const entry = {
      rfid: rfid,
      id_number: match ? (match.id_number || "") : "",
      last_name: match ? (match.last_name || "") : "",
      first_name: match ? (match.first_name || "") : "",
      middle_name: match ? (match.middle_name || "") : "",
      organization: match ? (match.organization || "") : "",
      contact_no: match ? String(match.contact_no || "") : "",
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString(),
      slot: getSlot(),
      synced: false
      
    };
        console.log("Match:", match);
        // Print name and contact number after scanning
    if (match) {
      status.textContent = `Registered: ${rfid} | Name: ${entry.last_name}, ${entry.first_name} `;
    } else {
      status.textContent = `Unregistered RFID: ${rfid}`;
    }

      const helloLabel = document.getElementById('helloLabel');
// ...inside your input keydown handler, after creating entry...
if (match) {
  helloLabel.textContent = `Hello, ${entry.first_name} ${entry.last_name}`;
} else {
  helloLabel.textContent = '';
}

    if (!navigator.onLine) {
      offlineLogs.push(entry);
      localStorage.setItem("offlineLogs", JSON.stringify(offlineLogs));
      logEntry(entry);
      return;
    }

    fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    }).then(() => {
      entry.synced = true;
      logEntry(entry);
      syncStoredLogs();
    }).catch(() => {
      offlineLogs.push(entry);
      localStorage.setItem("offlineLogs", JSON.stringify(offlineLogs));
      logEntry(entry);
    });
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

// Optionally update stats
function updateStats(count) {
  const stats = document.getElementById('stats');
  if (stats) stats.textContent = `Today: ${count} attendees`;
}

function stripLeadingZeros(str) {
  return String(str).replace(/^0+/, '');
}

document.addEventListener('click', function(e) {
  // Only refocus if the click is outside the input
  if (e.target !== input) {
    focusInput();
  }
});
