//reports.js
// --- Define the columns for the Attendees tab ---
const attendeesColumns = [
  { key: 'last_name', label: 'Last Name' },
  { key: 'first_name', label: 'First Name' },
  { key: 'organization', label: 'Organization' },
  { key: 'designation', label: 'Designation' },
  { key: 'email', label: 'Email' },
  { key: 'contact_no', label: 'Contact No' },
  { key: 'rfid', label: 'RFID' },
  { key: 'confirmation_code', label: 'Confirmation Code' },
  { key: 'event_name', label: 'Event' },
  { key: 'payment_status', label: 'Payment Status' },
  { key: 'info_details', label: 'Info Details' },
  { key: 'payment_details', label: 'Payment Details' }
];
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



// --- Render the table header ---
function renderAttendeesHeader() {
  const header = document.getElementById('attendeesTableHeader');
  header.innerHTML = `<tr>${attendeesColumns.map(col => `<th>${col.label}</th>`).join('')}</tr>`;
}

// Render the table body
function renderAttendeesTable(attendees) {
  const tbody = document.getElementById('attendeesTableBody');
  tbody.innerHTML = attendees.map(att => `
    <tr>
      <td>${att.last_name || ''}</td>
      <td>${att.first_name || ''}</td>
      <td>${att.organization || ''}</td>
      <td>${att.designation || ''}</td>
      <td>${att.email || ''}</td>
      <td>${att.contact_no || ''}</td>
      <td>${att.rfid || ''}</td>
      <td>${att.confirmation_code || ''}</td>
      <td>${att.event_name || ''}</td>
      <td>${att.payment_status || ''}</td>
      <td>
        <button class="btn btn-info" onclick="openInfoModal('${att.attendee_no}')">Edit Info</button>
      </td>
      <td>
        <button class="btn btn-payment" onclick="openPaymentModal('${att.attendee_no}')">Edit Payment Info</button>
      </td>
    </tr>
  `).join('');
}

// Example: Fetch and render attendees on page load or tab switch
async function loadAttendees() {
  // Replace with your actual API endpoint
  const res = await fetch('/api/attendees');
  const attendees = await res.json();
  renderAttendeesHeader();
  renderAttendeesTable(attendees);
}

// Call this when the Attendees tab is shown
loadAttendees();

// --- Info Modal ---
async function openInfoModal(attendee_no) {
  const res = await fetch(`/api/attendees/${attendee_no}`);
  const att = await res.json();
  document.getElementById('modalRfid').value = att.rfid || '';
  document.getElementById('modalInfoFields').innerHTML = `
    <div>Last Name: ${att.last_name}</div>
    <div>First Name: ${att.first_name}</div>
    <div>Organization: ${att.organization}</div>
    <div>Designation: ${att.designation}</div>
    <div>Email: ${att.email}</div>
    <div>Contact No: ${att.contact_no || ''}</div>
    <div>Accommodation: ${att.accommodation || ''}</div>
    <div>Event: ${att.event_name}</div>
  `;
  document.getElementById('infoModal').style.display = 'block';

  document.getElementById('infoForm').onsubmit = async function(e) {
    e.preventDefault();
    const rfid = document.getElementById('modalRfid').value;
    await fetch(`/api/attendees/${attendee_no}/rfid`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid })
    });
    closeInfoModal();
    loadAttendees();
  };
}
function closeInfoModal() {
  document.getElementById('infoModal').style.display = 'none';
}

// --- Payment Modal ---
async function openPaymentModal(attendee_no) {
  // Clear containers
  document.getElementById('newPaymentFormContainer').innerHTML = '';
  document.getElementById('paymentRecords').innerHTML = '';

  // Render "Add New Payment" form
  document.getElementById('newPaymentFormContainer').innerHTML = `
    <form id="newPaymentForm">
      <h4>Add New Payment</h4>
      <label>Status: 
        <select name="payment_status" required>
          <option value="">Select status</option>
          <option value="Fully Paid">Fully Paid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Others">Others</option>
        </select>
      </label>
      <label>Amount: <input type="text" name="amount" required></label>
      <label>Form of Payment: <input type="text" name="form_of_payment"></label>
      <label>Date Full Payment: <input type="date" name="date_full_payment"></label>
      <label>Date Partial Payment: <input type="date" name="date_partial_payment"></label>
      <label>Account: <input type="text" name="account"></label>
      <label>OR Number: <input type="text" name="or_number"></label>
      <label>Quickbooks No: <input type="text" name="quickbooks_no"></label>
      <label>Shipping Tracking No: <input type="text" name="shipping_tracking_no"></label>
      <label>Notes: <input type="text" name="notes"></label>
      <button type="submit">Add Payment</button>
      <div id="newPaymentError" style="color:red;"></div>
    </form>
    <hr>
  `;

  // Handle new payment submission
  document.getElementById('newPaymentForm').onsubmit = async function(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(this));
    formData.attendee_no = attendee_no;
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      openPaymentModal(attendee_no); // Refresh modal
    } else {
      const errMsg = (await res.json()).message || 'Failed to add payment.';
      document.getElementById('newPaymentError').textContent = errMsg;
    }
  };

  // Fetch and render existing payments
  const res = await fetch(`/api/payments/${attendee_no}`);
  let payments = await res.json();
  payments = payments.filter(p => p && p.payment_id);

  document.getElementById('paymentRecords').innerHTML = payments.length
    ? payments.map(payment => `
      <form class="paymentForm" data-payment-id="${payment.payment_id}">
        <label>Status: 
          <select name="payment_status">
            <option value="Fully Paid" ${payment.payment_status === 'Fully Paid' ? 'selected' : ''}>Fully Paid</option>
            <option value="Partially Paid" ${payment.payment_status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
            <option value="Others" ${payment.payment_status === 'Others' ? 'selected' : ''}>Others</option>
          </select>
        </label>
        <label>Amount: <input type="text" name="amount" value="${payment.amount || ''}"></label>
        <label>Form of Payment: <input type="text" name="form_of_payment" value="${payment.form_of_payment || ''}"></label>
        <label>Date Full Payment: <input type="date" name="date_full_payment" value="${payment.date_full_payment || ''}"></label>
        <label>Date Partial Payment: <input type="date" name="date_partial_payment" value="${payment.date_partial_payment || ''}"></label>
        <label>Account: <input type="text" name="account" value="${payment.account || ''}"></label>
        <label>OR Number: <input type="text" name="or_number" value="${payment.or_number || ''}"></label>
        <label>Quickbooks No: <input type="text" name="quickbooks_no" value="${payment.quickbooks_no || ''}"></label>
        <label>Shipping Tracking No: <input type="text" name="shipping_tracking_no" value="${payment.shipping_tracking_no || ''}"></label>
        <label>Notes: <input type="text" name="notes" value="${payment.notes || ''}"></label>
        <button type="submit">Save</button>
        <div class="paymentError" style="color:red;"></div>
      </form>
      <hr>
    `).join('')
    : '<div>No payment records yet.</div>';

  document.getElementById('paymentModal').style.display = 'block';

  // Handle existing payment edits
  document.querySelectorAll('.paymentForm').forEach(form => {
    form.onsubmit = async function(e) {
      e.preventDefault();
      const payment_id = form.dataset.paymentId;
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch(`/api/payments/${payment_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        openPaymentModal(attendee_no); // Refresh modal after edit
      } else {
        const errMsg = (await res.json()).message || 'Failed to update payment.';
        form.querySelector('.paymentError').textContent = errMsg;
      }
    };
  });
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
  loadAttendees(); // Refresh main table after closing modal
}
