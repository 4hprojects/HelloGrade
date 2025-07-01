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

  // Use custom slots if loaded
  if (customTimeSlots) {
    for (const [slot, value] of Object.entries(customTimeSlots)) {
      if (!value || !value.start || !value.end) continue; // Skip if missing
      const [sh, sm] = value.start.split(":").map(Number);
      const [eh, em] = value.end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (current >= startMin && current < endMin) {
        return slot.replace("_", " ");
      }
    }
    return "PM OUT"; // fallback if not matched
  }

  // Default fallback
  if (h < 12) return "AM IN";
  if (h >= 12 && h < 13) return "AM OUT";
  if (h >= 13 && h < 17) return "PM IN";
  return "PM OUT";
}

function logEntry(entry) {
  const div = document.createElement('div');
  div.className = 'log-entry' + (entry.synced ? '' : ' unsynced');
  // Only show name if available
  let name = (entry.last_name || entry.first_name)
    ? ` - ${entry.last_name}, ${entry.first_name}`.replace(/, $/, '') // Remove trailing comma if no first name
    : '';
  div.textContent = `${entry.time} - ${entry.rfid} (${entry.slot})${name}`;
  logsDiv.prepend(div);
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

document.addEventListener("DOMContentLoaded", () => {
  input.focus();
  input.select();
});

document.body.addEventListener("click", focusInput);

window.addEventListener("online", () => {
  status.textContent = "Online - syncing logs...";
  syncStoredLogs();
});
window.addEventListener("offline", () => {
  status.textContent = "Offline - logs will be saved locally.";
});

function clearLogs() {
  localStorage.removeItem("logs");
  localStorage.removeItem("offlineLogs");
  logsDiv.innerHTML = '';
  status.textContent = "Logs cleared.";
}

function stripLeadingZeros(str) {
  return str.replace(/^0+/, '');
}

