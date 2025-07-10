document.addEventListener('DOMContentLoaded', async () => {
  // 1. Populate event dropdown
  const eventSelect = document.getElementById('event_id');
  let events = [];
  try {
    const eventsRes = await fetch('/api/events/upcoming');
    events = await eventsRes.json();
    eventSelect.innerHTML = '<option value="">Select an event</option>' +
      events.map(ev =>
        `<option value="${ev.id}">${ev.event_name} (${ev.event_date})</option>`
      ).join('');
    if (events.length) eventSelect.value = events[0].id;
  } catch (e) {
    if (eventSelect) eventSelect.innerHTML = '<option disabled>Error loading events</option>';
  }

  // 2. Show event details
  function showEventDetails() {
    const selected = events.find(ev => ev.id == eventSelect.value);
    const detailsDiv = document.getElementById('eventDetails');
    if (selected && detailsDiv) {
      detailsDiv.textContent = `${selected.event_name} on ${selected.event_date} at ${selected.location || ''}`;
    } else if (detailsDiv) {
      detailsDiv.textContent = '';
    }
  }
  if (eventSelect) {
    eventSelect.addEventListener('change', showEventDetails);
    showEventDetails();
  }

  // 3. Manual registration form
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const form = e.target;
      const statusDiv = document.getElementById('regStatus');
      if (statusDiv) statusDiv.textContent = '';

      // Gather data
      const data = {
        first_name: form.first_name.value.trim(),
        middle_name: form.middle_name.value.trim(),
        last_name: form.last_name.value.trim(),
        organization: form.organization.value.trim(),
        email: form.email.value.trim(),
        contact_no: form.phone_no.value.trim(),
        rfid: form.rfid.value.trim() || null,
        event_id: form.event_id.value
      };

      // Validation
      const required = ['first_name', 'last_name', 'organization', 'email', 'event_id'];
      const missing = required.filter(f => !data[f]);
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
      if (missing.length > 0) {
        if (statusDiv) statusDiv.textContent = 'Missing: ' + missing.join(', ');
        return;
      }
      if (!emailValid) {
        if (statusDiv) statusDiv.textContent = 'Invalid email format';
        return;
      }

      // Duplicate RFID check
      if (data.rfid) {
        const checkRes = await fetch(`/api/attendees/check-rfid?rfid=${encodeURIComponent(data.rfid)}`);
        const check = await checkRes.json();
        if (check.exists) {
          if (statusDiv) statusDiv.textContent = "RFID already used!";
          return;
        }
      }

      // Submit registration
      if (statusDiv) statusDiv.textContent = "Registering...";
      const res = await fetch('/api/register', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.status === "success") {
        if (statusDiv) statusDiv.textContent = "Registration successful!";
        form.reset();
        loadLatest();
      } else {
        if (statusDiv) statusDiv.textContent = result.message || "Registration failed.";
      }
    });
  }

  // 4. Load latest registered attendees
  async function loadLatest() {
    const eventId = eventSelect ? eventSelect.value : '';
    const res = await fetch(`/api/attendees/latest?event_id=${encodeURIComponent(eventId)}`);
    const latest = await res.json();
    const list = document.getElementById('latestList');
    if (list) {
      list.innerHTML = latest.map(a =>
        `<li>${a.first_name} ${a.last_name} (${a.organization})</li>`
      ).join('');
    }
  }
  if (eventSelect) eventSelect.addEventListener('change', loadLatest);
  loadLatest();

  // 5. BulkRegister Sheet processing
  const processBtn = document.getElementById('processBulkRegisterBtn');
  const progressDiv = document.getElementById('bulkRegisterProgress');
  const downloadBtn = document.getElementById('downloadBulkResultsBtn');

  if (processBtn) {
    processBtn.onclick = async function() {
      if (progressDiv) progressDiv.textContent = 'Processing...';
      if (downloadBtn) downloadBtn.style.display = 'none';

      const res = await fetch('/api/bulk-register/process-bulkregister', { method: 'POST' });
      const result = await res.json();

      if (res.ok) {
        if (progressDiv) {
          progressDiv.innerHTML = `
            <b>Bulk registration complete:</b><br>
            Registered: ${result.registered}<br>
            Duplicate: ${result.duplicate}<br>
            Error: ${result.error}
          `;
        }
        window._bulkResultsRows = result.processedRows;
        if (downloadBtn) downloadBtn.style.display = '';
      } else {
        if (progressDiv) progressDiv.textContent = 'Error: ' + (result.message || 'Unknown error');
      }
    };
  }

  if (downloadBtn) {
    downloadBtn.onclick = function() {
      if (!window._bulkResultsRows) return;
      const ws = XLSX.utils.json_to_sheet(window._bulkResultsRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BulkRegisterResults");
      XLSX.writeFile(wb, "BulkRegisterResults.xlsx");
    };
  }

  // Fetch events from your backend API
  try {
    const res = await fetch('/api/events/all');
    const events = await res.json();
    const eventSelect = document.getElementById('event_id');
    events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.id; // or ev._id or whatever your event's unique key is
      opt.textContent = ev.event_name + (ev.event_date ? ` (${ev.event_date})` : '');
      eventSelect.appendChild(opt);
    });
  } catch (err) {
    const eventSelect = document.getElementById('event_id');
    eventSelect.innerHTML = '<option value="">Could not load events</option>';
  }
});