// --- Attendance Tab ---
async function loadAttendanceRecords() {
  try {
    const res = await fetch('/api/attendance-records');
    const data = await res.json();
    attendanceData = data;
    // Default sort: date_time descending
    attendanceSort = [{ key: 'date_time', asc: false }];
    attendanceSearch = '';
    renderAttendanceTable(attendanceData);
    updateSortIndicators('#attendanceTable', attendanceSort, ['date_time', 'raw_last_name', 'raw_first_name', 'raw_rfid', 'slot', 'event_id']);
  } catch (err) {
    document.querySelector('#attendanceTable tbody').innerHTML =
      `<tr><td colspan="6">Failed to load attendance records.</td></tr>`;
  }
}

function renderAttendanceTable(records) {
  // Filter by search
  let filtered = records.filter(rec =>
    Object.values(rec).some(val =>
      (val || '').toString().toLowerCase().includes(attendanceSearch)
    )
  );

  // Sort
  filtered.sort((a, b) => {
    for (const { key, asc } of attendanceSort) {
      let av = a[key] || '', bv = b[key] || '';
      if (key === 'date_time') { // special for date+time
        av = (a.date || '') + ' ' + (a.time || '');
        bv = (b.date || '') + ' ' + (b.time || '');
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
    }
    return 0;
  });

  const rows = filtered.map(rec => `
  <tr>
    <td>${rec.date ? rec.date + ' ' + (rec.time || '') : ''}</td>
    <td>${rec.raw_last_name || ''}</td>
    <td>${rec.raw_first_name || ''}</td>
    <td>${rec.raw_rfid || ''}</td>
    <td>${rec.slot || ''}</td>
    <td>${rec.event_id || ''}</td>
  </tr>
`).join('');
  document.querySelector('#attendanceTable tbody').innerHTML = rows;
}

// --- Events Tab ---
async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    const data = await res.json();
    eventsData = data.events;
    eventsSort = [{ key: 'start_date', asc: false }];
    eventsSearch = '';
    renderEventsTable(eventsData);
    updateSortIndicators('#eventsTable', eventsSort, ['event_id', 'event_name', 'start_date', 'end_date', 'status', 'location', 'venue']);
  } catch (err) {
    document.querySelector('#eventsTable tbody').innerHTML =
      `<tr><td colspan="7">Failed to load events.</td></tr>`;
  }
}

function renderEventsTable(events) {
  // Filter by search
  let filtered = events.filter(ev =>
    Object.values(ev).some(val =>
      (val || '').toString().toLowerCase().includes(eventsSearch)
    )
  );

  // Sort
  filtered.sort((a, b) => {
    for (const { key, asc } of eventsSort) {
      let av = a[key] || '', bv = b[key] || '';
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
    }
    return 0;
  });

  const rows = filtered.map(ev => `
    <tr>
      <td>${ev.event_id || ''}</td>
      <td>${ev.event_name || ''}</td>
      <td>${ev.start_date || ''}</td>
      <td>${ev.end_date || ''}</td>
      <td>${ev.status || ''}</td>
      <td>${ev.location || ''}</td>
      <td>${ev.venue || ''}</td>
    </tr>
  `).join('');
  document.querySelector('#eventsTable tbody').innerHTML = rows;
}

// --- Logs Tab ---
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/audit-trail');
    const data = await res.json();
    renderLogsTable(data);
  } catch (err) {
    document.querySelector('#logs-table tbody').innerHTML =
      `<tr><td colspan="6">Failed to load logs.</td></tr>`;
  }
}

function renderLogsTable(logs) {
  const rows = logs.map(log => `
    <tr>
      <td>${log.user_name || ''}</td>
      <td>${log.user_role || ''}</td>
      <td>${log.action || ''}</td>
      <td>${log.action_time || ''}</td>
      <td>${log.ip_address || ''}</td>
      <td>${log.details || ''}</td>
    </tr>
  `).join('');
  document.querySelector('#logs-table tbody').innerHTML = rows;
}

// --- On DOMContentLoaded, load all tabs ---
document.addEventListener('DOMContentLoaded', () => {
  loadAttendanceRecords();
  loadEvents();
  loadAuditLogs();

  // Attendance sort
  document.querySelectorAll('#attendanceTable thead th').forEach((th, idx) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', e => {
      const keyMap = ['date_time', 'raw_last_name', 'raw_first_name', 'raw_rfid', 'slot', 'event_id'];
      let key = keyMap[idx];
      let multi = e.shiftKey;
      let arr = attendanceSort;
      let found = arr.find(s => s.key === key);
      if (!multi) arr.length = 0;
      if (found) {
        if (found.asc) {
          // Was ascending: set to descending
          found.asc = false;
        } else {
          // Was descending: remove from sort
          arr = arr.filter(s => s.key !== key);
        }
      } else {
        // Not sorted yet: add as ascending
        arr.push({ key, asc: true });
      }
      renderAttendanceTable(attendanceData);
      updateSortIndicators('#attendanceTable', arr, keyMap);
    });
  });

  // Events sort
  document.querySelectorAll('#eventsTable thead th').forEach((th, idx) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', e => {
      const keyMap = ['event_id', 'event_name', 'start_date', 'end_date', 'status', 'location', 'venue'];
      let key = keyMap[idx];
      let multi = e.shiftKey;
      let arr = eventsSort;
      let found = arr.find(s => s.key === key);
      if (!multi) arr.length = 0;
      if (found) {
        if (found.asc) {
          // Was ascending: set to descending
          found.asc = false;
        } else {
          // Was descending: remove from sort
          arr = arr.filter(s => s.key !== key);
        }
      } else {
        // Not sorted yet: add as ascending
        arr.push({ key, asc: true });
      }
      renderEventsTable(eventsData);
      updateSortIndicators('#eventsTable', arr, keyMap);
    });
  });

  // Attendance search
  document.getElementById('searchAttendance').addEventListener('input', e => {
    attendanceSearch = e.target.value.toLowerCase();
    renderAttendanceTable(attendanceData);
  });

  // Events search
  document.getElementById('searchEvents').addEventListener('input', e => {
    eventsSearch = e.target.value.toLowerCase();
    renderEventsTable(eventsData);
  });
});

// Helper to update sort indicators
function updateSortIndicators(tableSelector, sortArr, keyMap) {
  document.querySelectorAll(`${tableSelector} thead th`).forEach((th, idx) => {
    th.textContent = th.textContent.replace(/[\u25B2\u25BC]/g, '').trim();
    let sort = sortArr.find(s => s.key === keyMap[idx]);
    if (sort) th.textContent += sort.asc ? ' ▲' : ' ▼';
  });
}

let attendanceData = [];
let attendanceSort = [];
let attendanceSearch = '';

let eventsData = [];
let eventsSort = [];
let eventsSearch = '';
