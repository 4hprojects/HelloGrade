// --- Tab Switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
  });
});

// --- Authentication ---
async function checkAuthAndShowModal() {
  try {
    const res = await fetch('/api/check-auth', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = "attendance.html";
    }
  } catch {
    window.location.href = "attendance.html";
  }
}
document.addEventListener('DOMContentLoaded', checkAuthAndShowModal);

// --- Logout Button ---
document.querySelector('.btn-logout').onclick = async function() {
  await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.reload();
};

// --- Clock ---
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

// --- Spinner ---
function showSpinner() {
  document.getElementById('loadingSpinner').style.display = '';
}
function hideSpinner() {
  document.getElementById('loadingSpinner').style.display = 'none';
}

// --- Data holders and sorting state ---
let attendeesData = [], attendanceData = [], eventsData = [];
let attendeesPage = 1, attendeesPerPage = 10;
let attendancePage = 1, attendancePerPage = 10;
let eventsPage = 1, eventsPerPage = 10;
let attendeesSort = { key: null, asc: true };
let attendanceSort = { key: null, asc: true };
let eventsSort = { key: null, asc: true };

// --- Fetch and Render Attendees ---
async function loadAttendees() {
  showSpinner();
  try {
    const res = await fetch('/api/attendees/all');
    attendeesData = await res.json();
    attendeesPage = 1;
    updateAttendeesTable();
  } catch (err) {
    document.querySelector('#attendeesTable tbody').innerHTML =
      `<tr><td colspan="7">Failed to load attendees.</td></tr>`;
  }
  hideSpinner();
}
function filterAttendees(query) {
  query = query.trim().toLowerCase();
  if (!query) return attendeesData;
  return attendeesData.filter(a =>
    [a.last_name, a.first_name, a.middle_name, a.attendee_no, a.rfid, a.organization, a.contact_no]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}
function paginateAttendees(data) {
  if (attendeesPerPage === 'all') return data;
  const start = (attendeesPage - 1) * attendeesPerPage;
  return data.slice(start, start + Number(attendeesPerPage));
}
function renderAttendeesTable(data) {
  const tbody = document.querySelector('#attendeesTable tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">No attendees found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(a => `
    <tr>
      <td>${a.last_name || ''}</td>
      <td>${a.first_name || ''}</td>
      <td>${a.middle_name || ''}</td>
      <td>${a.organization || ''}</td>
      <td>${a.email || ''}</td>
      <td>${a.contact_no || ''}</td>
      <td>${a.rfid || ''}</td>
      <td>${a.event?.event_name || ''}</td>
    </tr>
  `).join('');
}
function renderAttendeesPagination(filtered) {
  const pagDiv = document.getElementById('attendeesPagination');
  const total = filtered.length;
  const perPage = attendeesPerPage === 'all' ? total : attendeesPerPage;
  const pages = perPage === 0 ? 1 : Math.ceil(total / perPage);

  let html = `
    <label>Show
      <select id="attendeesPerPage">
        <option value="10" ${attendeesPerPage==10?'selected':''}>10</option>
        <option value="20" ${attendeesPerPage==20?'selected':''}>20</option>
        <option value="all" ${attendeesPerPage==='all'?'selected':''}>All</option>
      </select>
    </label>
    <span>Page ${attendeesPage} of ${pages}</span>
    <button id="attendeesPrev" ${attendeesPage<=1?'disabled':''}>&lt; Prev</button>
    <button id="attendeesNext" ${attendeesPage>=pages?'disabled':''}>Next &gt;</button>
  `;
  pagDiv.innerHTML = html;

  document.getElementById('attendeesPerPage').onchange = e => {
    attendeesPerPage = e.target.value === 'all' ? 'all' : Number(e.target.value);
    attendeesPage = 1;
    updateAttendeesTable();
  };
  document.getElementById('attendeesPrev').onclick = () => {
    if (attendeesPage > 1) { attendeesPage--; updateAttendeesTable(); }
  };
  document.getElementById('attendeesNext').onclick = () => {
    const pages = Math.ceil(filtered.length / (attendeesPerPage === 'all' ? filtered.length : attendeesPerPage));
    if (attendeesPage < pages) { attendeesPage++; updateAttendeesTable(); }
  };
}
function updateAttendeesTable() {
  const query = document.getElementById('searchAttendees').value;
  let filtered = filterAttendees(query);
  if (attendeesSort.key) {
    filtered = sortData(filtered, attendeesSort.key, attendeesSort.asc);
  }
  const paged = paginateAttendees(filtered);
  renderAttendeesTable(paged);
  renderAttendeesPagination(filtered);
}
document.getElementById('searchAttendees').addEventListener('input', () => {
  attendeesPage = 1;
  updateAttendeesTable();
});
document.getElementById('exportAttendeesBtn').onclick = function () {
  const query = document.getElementById('searchAttendees').value;
  const filtered = filterAttendees(query);
  const paged = paginateAttendees(filtered);
  const headers = ["Last Name", "First Name", "Organization", "Email", "Contact No", "RFID", "Event ID"];
  const rows = paged.map(a => [
    a.last_name || "",
    a.first_name || "",
    a.organization || "",
    a.email || "",
    a.contact_no || "",
    a.rfid || "",
    a.event_id || ""
  ]);
  if (typeof XLSX === "undefined") {
    alert("XLSX library not loaded.");
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendees");
  XLSX.writeFile(wb, "attendees_report.xlsx");
};

// --- Fetch and Render Attendance ---
async function loadAttendance() {
  showSpinner();
  try {
    const res = await fetch('/api/attendance/all');
    attendanceData = await res.json();
    attendancePage = 1;
    updateAttendanceTable();
  } catch (err) {
    document.querySelector('#attendanceTable tbody').innerHTML =
      `<tr><td colspan="10">Failed to load attendance records.</td></tr>`;
  }
  hideSpinner();
}
function filterAttendance(query) {
  query = query.trim().toLowerCase();
  if (!query) return attendanceData;
  return attendanceData.filter(r => {
    const name = r.attendee
      ? [r.attendee.last_name, r.attendee.first_name, r.attendee.middle_name].filter(Boolean).join(', ')
      : '';
    return [
      r.date, r.time, r.slot, r.status, r.rfid,
      r.organization, r.contact_no,
      r.attendee?.attendee_no, name,
      r.event?.event_name
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
}
function paginateAttendance(data) {
  if (attendancePerPage === 'all') return data;
  const start = (attendancePage - 1) * attendancePerPage;
  return data.slice(start, start + Number(attendancePerPage));
}
function renderAttendanceTable(data) {
  const tbody = document.querySelector('#attendanceTable tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="10">No attendance records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.date || ''}</td>
      <td>${r.time || ''}</td>
      <td>${r.attendee?.attendee_no || ''}</td>
      <td>${r.attendee
        ? [r.attendee.last_name, r.attendee.first_name, r.attendee.middle_name].filter(Boolean).join(', ')
        : ''}</td>
      <td>${r.event?.event_name || ''}</td>
      <td>${r.slot || ''}</td>
      <td>${r.status || ''}</td>
      <td>${r.organization || r.attendee?.organization || ''}</td>
      <td>${r.contact_no || r.attendee?.contact_no || ''}</td>
      <td>${r.rfid || r.attendee?.rfid || ''}</td>
    </tr>
  `).join('');
}
function renderAttendancePagination(filtered) {
  const pagDiv = document.getElementById('attendancePagination');
  const total = filtered.length;
  const perPage = attendancePerPage === 'all' ? total : attendancePerPage;
  const pages = perPage === 0 ? 1 : Math.ceil(total / perPage);

  let html = `
    <label>Show
      <select id="attendancePerPage">
        <option value="10" ${attendancePerPage==10?'selected':''}>10</option>
        <option value="20" ${attendancePerPage==20?'selected':''}>20</option>
        <option value="all" ${attendancePerPage==='all'?'selected':''}>All</option>
      </select>
    </label>
    <span>Page ${attendancePage} of ${pages}</span>
    <button id="attendancePrev" ${attendancePage<=1?'disabled':''}>&lt; Prev</button>
    <button id="attendanceNext" ${attendancePage>=pages?'disabled':''}>Next &gt;</button>
  `;
  pagDiv.innerHTML = html;

  document.getElementById('attendancePerPage').onchange = e => {
    attendancePerPage = e.target.value === 'all' ? 'all' : Number(e.target.value);
    attendancePage = 1;
    updateAttendanceTable();
  };
  document.getElementById('attendancePrev').onclick = () => {
    if (attendancePage > 1) { attendancePage--; updateAttendanceTable(); }
  };
  document.getElementById('attendanceNext').onclick = () => {
    const pages = Math.ceil(filtered.length / (attendancePerPage === 'all' ? filtered.length : attendancePerPage));
    if (attendancePage < pages) { attendancePage++; updateAttendanceTable(); }
  };
}
function updateAttendanceTable() {
  const query = document.getElementById('searchAttendance').value;
  let filtered = filterAttendance(query);
  if (attendanceSort.key) {
    filtered = sortData(filtered, attendanceSort.key, attendanceSort.asc, true);
  }
  const paged = paginateAttendance(filtered);
  renderAttendanceTable(paged);
  renderAttendancePagination(filtered);
}
document.getElementById('searchAttendance').addEventListener('input', () => {
  attendancePage = 1;
  updateAttendanceTable();
});
document.getElementById('exportAttendanceBtn').onclick = function () {
  const query = document.getElementById('searchAttendance').value;
  const filtered = filterAttendance(query);
  const paged = paginateAttendance(filtered);
  const headers = ["Date", "Time", "Attendee No", "Name", "Event Name", "Slot", "Status", "Organization", "Contact No", "RFID"];
  const rows = paged.map(r => [
    r.date || "",
    r.time || "",
    r.attendee?.attendee_no || "",
    r.attendee
      ? [r.attendee.last_name, r.attendee.first_name, r.attendee.middle_name].filter(Boolean).join(', ')
      : "",
    r.event?.event_name || "",
    r.slot || "",
    r.status || "",
    r.organization || r.attendee?.organization || "",
    r.contact_no || r.attendee?.contact_no || "",
    r.rfid || r.attendee?.rfid || ""
  ]);
  if (typeof XLSX === "undefined") {
    alert("XLSX library not loaded.");
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, "attendance_report.xlsx");
};

// --- Fetch and Render Events ---
async function loadEvents() {
  showSpinner();
  try {
    const res = await fetch('/api/events/all');
    eventsData = await res.json();
    eventsPage = 1;
    updateEventsTable();
  } catch (err) {
    document.querySelector('#eventsTable tbody').innerHTML =
      `<tr><td colspan="3">Failed to load events.</td></tr>`;
  }
  hideSpinner();
}
function filterEvents(query) {
  query = query.trim().toLowerCase();
  if (!query) return eventsData;
  return eventsData.filter(e =>
    [e.event_name, e.event_date, e.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}
function paginateEvents(data) {
  if (eventsPerPage === 'all') return data;
  const start = (eventsPage - 1) * eventsPerPage;
  return data.slice(start, start + Number(eventsPerPage));
}
function renderEventsTable(data) {
  const tbody = document.querySelector('#eventsTable tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="3">No events found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(e => `
    <tr>
      <td>${e.event_name || ''}</td>
      <td>${e.event_date || ''}</td>
      <td>${e.location || ''}</td>
    </tr>
  `).join('');
}
function renderEventsPagination(filtered) {
  const pagDiv = document.getElementById('eventsPagination');
  const total = filtered.length;
  const perPage = eventsPerPage === 'all' ? total : eventsPerPage;
  const pages = perPage === 0 ? 1 : Math.ceil(total / perPage);

  let html = `
    <label>Show
      <select id="eventsPerPage">
        <option value="10" ${eventsPerPage==10?'selected':''}>10</option>
        <option value="20" ${eventsPerPage==20?'selected':''}>20</option>
        <option value="all" ${eventsPerPage==='all'?'selected':''}>All</option>
      </select>
    </label>
    <span>Page ${eventsPage} of ${pages}</span>
    <button id="eventsPrev" ${eventsPage<=1?'disabled':''}>&lt; Prev</button>
    <button id="eventsNext" ${eventsPage>=pages?'disabled':''}>Next &gt;</button>
  `;
  pagDiv.innerHTML = html;

  document.getElementById('eventsPerPage').onchange = e => {
    eventsPerPage = e.target.value === 'all' ? 'all' : Number(e.target.value);
    eventsPage = 1;
    updateEventsTable();
  };
  document.getElementById('eventsPrev').onclick = () => {
    if (eventsPage > 1) { eventsPage--; updateEventsTable(); }
  };
  document.getElementById('eventsNext').onclick = () => {
    const pages = Math.ceil(filtered.length / (eventsPerPage === 'all' ? filtered.length : eventsPerPage));
    if (eventsPage < pages) { eventsPage++; updateEventsTable(); }
  };
}
function updateEventsTable() {
  const query = document.getElementById('searchEvents').value;
  let filtered = filterEvents(query);
  if (eventsSort.key) {
    filtered = sortData(filtered, eventsSort.key, eventsSort.asc);
  }
  const paged = paginateEvents(filtered);
  renderEventsTable(paged);
  renderEventsPagination(filtered);
}
document.getElementById('searchEvents').addEventListener('input', () => {
  eventsPage = 1;
  updateEventsTable();
});
document.getElementById('exportEventsBtn').onclick = function () {
  const query = document.getElementById('searchEvents').value;
  const filtered = filterEvents(query);
  const paged = paginateEvents(filtered);
  const headers = ["Event Name", "Date", "Location"];
  const rows = paged.map(e => [
    e.event_name || "",
    e.event_date || "",
    e.location || ""
  ]);
  if (typeof XLSX === "undefined") {
    alert("XLSX library not loaded.");
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Events");
  XLSX.writeFile(wb, "events_report.xlsx");
};

// --- Sorting helpers ---
function sortData(data, key, asc = true, nested = false) {
  return [...data].sort((a, b) => {
    let valA = nested ? getNestedValue(a, key) : a[key];
    let valB = nested ? getNestedValue(b, key) : b[key];
    valA = valA === undefined || valA === null ? '' : valA;
    valB = valB === undefined || valB === null ? '' : valB;
    if (!isNaN(valA) && !isNaN(valB)) {
      return asc ? valA - valB : valB - valA;
    }
    return asc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });
}
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : ''), obj);
}

// --- Header click handlers for sorting ---
function setupSortableHeaders(tableId, sortState, updateFn, keys) {
  const ths = document.querySelectorAll(`#${tableId} th`);
  ths.forEach((th, idx) => {
    th.style.cursor = 'pointer';
    th.onclick = function() {
      const key = keys[idx];
      if (sortState.key === key) {
        sortState.asc = !sortState.asc;
      } else {
        sortState.key = key;
        sortState.asc = true;
      }
      updateFn();
      // Optional: add sort indicator
      ths.forEach(header => header.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(sortState.asc ? 'sorted-asc' : 'sorted-desc');
    };
  });
}

// --- Initial fetch and setup ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadAttendees();
  await loadAttendance();
  await loadEvents();

  setupSortableHeaders('attendeesTable', attendeesSort, updateAttendeesTable,
    ['last_name', 'first_name', 'organization', 'email', 'contact_no', 'rfid', 'event_id']);
  setupSortableHeaders('attendanceTable', attendanceSort, updateAttendanceTable,
    ['date', 'time', 'attendee.attendee_no', 'attendee.last_name', 'event.event_name', 'slot', 'status', 'organization', 'contact_no', 'rfid']);
  setupSortableHeaders('eventsTable', eventsSort, updateEventsTable,
    ['event_name', 'event_date', 'location']);
});

// --- Refresh Buttons ---
document.getElementById('refreshAttendeesBtn').onclick = loadAttendees;
document.getElementById('refreshAttendanceBtn').onclick = loadAttendance;
document.getElementById('refreshEventsBtn').onclick = loadEvents;

// --- Render Attendees Header ---
function renderAttendeesHeader() {
  const headerRow = document.getElementById('attendeesHeaderRow');
  const columns = [
    { label: "Last Name", key: "last_name" },
    { label: "First Name", key: "first_name" },
    { label: "Middle Name", key: "middle_name" },
    { label: "Organization", key: "organization" },
    { label: "Email", key: "email" },
    { label: "Contact No", key: "contact_no" },
    { label: "RFID", key: "rfid" },
    { label: "Event Name", key: "event_name" }
  ];
  headerRow.innerHTML = columns.map(col => {
    let arrow = '';
    if (attendeesSort.key === col.key) {
      arrow = attendeesSort.asc ? ' ▲' : ' ▼';
    }
    return `<th class="${attendeesSort.key === col.key ? 'sorted-col' : ''}" data-key="${col.key}" style="cursor:pointer">${col.label}${arrow}</th>`;
  }).join('');
  // Re-attach click handlers
  headerRow.querySelectorAll('th').forEach(th => {
    th.onclick = function() {
      const key = th.dataset.key;
      if (attendeesSort.key === key) {
        attendeesSort.asc = !attendeesSort.asc;
      } else {
        attendeesSort.key = key;
        attendeesSort.asc = true;
      }
      renderAttendeesHeader();
      updateAttendeesTable();
    };
  });
}