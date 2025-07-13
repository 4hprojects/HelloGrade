//event-create.js 
document.addEventListener('DOMContentLoaded', async () => {
  const authModal = document.getElementById('authModal');
  const goHomeBtn = document.getElementById('goHomeBtn');
  const createPanel = document.getElementById('createPanel');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const headerNav = document.getElementById('headerNav');

  let events = [];

  // Mobile menu toggle
  mobileMenuBtn.addEventListener('click', () => {
    headerNav.classList.toggle('active');
  });

  // Check admin session
  try {
    const res = await fetch('/session-check', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const user = await res.json();
    console.log('Admin Check:', user);
    if (user.role !== 'admin') throw new Error();
    authModal.style.display = 'none';
    document.body.style.overflow = '';
    renderCreatePanel(user);
    loadLatestEvents();
  } catch (err) {
    console.error('Admin Check Failed:', err);
    authModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  goHomeBtn.addEventListener('click', () => {
    window.location.href = '/crfv/index.html';
  });

  function renderCreatePanel(user) {
    createPanel.innerHTML = `
      <div class="app-container">
        <div class="header">
          <h1>Create New Event</h1>
        </div>
        <form id="eventForm" class="attendance-card" autocomplete="off">
          <label>Event Name: <input type="text" name="event_name" required></label>
          <label>Start Date: <input type="date" name="start_date" required></label>
          <label>End Date: <input type="date" name="end_date" required></label>
          <label>Location: <input type="text" name="location" required></label>
          <label>Venue: <input type="text" name="venue" required></label>
          <button type="submit" class="btn btn-primary mt-4">Create Event</button>
          <div id="eventStatus" class="mt-4 text-blue-600"></div>
        </form>
      </div>
    `;
    document.getElementById('eventForm').addEventListener('submit', handleEventCreate);
  }

  async function handleEventCreate(e) {
    e.preventDefault();
    const form = e.target;
    const statusDiv = document.getElementById('eventStatus');
    statusDiv.textContent = "Creating event...";
    console.log('Form Data:', {
      event_name: form.event_name.value.trim(),
      start_date: form.start_date.value,
      end_date: form.end_date.value,
      location: form.location.value.trim(),
      venue: form.venue.value.trim()
    });

    // Validate date range
    if (new Date(form.end_date.value) < new Date(form.start_date.value)) {
      alert("End date cannot be before start date.");
      return;
    }

    try {
      const formData = {
        event_name: form.event_name.value.trim(),
        start_date: form.start_date.value,
        end_date: form.end_date.value,
        location: form.location.value.trim(),
        venue: form.venue.value.trim()
      };

      const res = await fetch('/api/events', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      console.log('Event Creation Response:', result);

      if (res.ok && result.status === "success") {
        statusDiv.textContent = "Event created successfully!";
        form.reset(); // Reset the form fields
        loadLatestEvents(); // Reload the latest events list
      } else {
        throw new Error(result.message || "Event creation failed");
      }
    } catch (err) {
      console.error('Event Creation Error:', err);
      statusDiv.textContent = err.message || "Network error. Please try again.";
    }
  }

  function formatEventDate(start, end) {
    if (!start && !end) return '';
    if (start === end || !end) {
      return new Date(start).toLocaleDateString();
    }
    return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
  }

  async function loadLatestEvents() {
    const list = document.getElementById('latestEventsList');
    list.innerHTML = '<li>Loading events...</li>';

    try {
      const res = await fetch('/api/events/latest');
      const result = await res.json();

      // Store globally for easy access
      events = Array.isArray(result) ? result : (Array.isArray(result?.events) ? result.events : []);

      if (events.length > 0) {
        list.innerHTML = events.map((ev, i) => `
          <li class="${i % 2 === 0 ? 'event-even' : 'event-odd'}" data-event-id="${ev.id}">
            <strong>${ev.event_name}</strong>
            (${formatEventDate(ev.start_date, ev.end_date)})
            ${ev.venue ? ' - ' + ev.venue : ''}
            ${ev.location ? ' - ' + ev.location : ''}
            <span class="event-action edit-btn" data-id="${ev.id}">Edit</span>
            <span class="event-action archive-btn" data-id="${ev.id}">
              ${ev.status === 'archived' ? 'Un-archive' : 'Archive'}
            </span>
          </li>
        `).join('');
      } else {
        list.innerHTML = "<li>No upcoming events found</li>";
      }

      // Attach event listeners for edit/archive buttons
      list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
      });
      list.querySelectorAll('.archive-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleArchiveEvent(e.target.dataset.id, e.target.textContent));
      });
    } catch (err) {
      list.innerHTML = "<li>Error loading events</li>";
    }
  }

  // Modal HTML (add to body if not present)
  if (!document.getElementById('eventEditModal')) {
    const modal = document.createElement('div');
    modal.id = 'eventEditModal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <form id="editEventForm" class="attendance-card">
          <h2>Edit Event</h2>
          <label>Event Name: <input type="text" name="event_name" required></label>
          <label>Start Date: <input type="date" name="start_date" required></label>
          <label>End Date: <input type="date" name="end_date" required></label>
          <label>Location: <input type="text" name="location" required></label>
          <label>Venue: <input type="text" name="venue"></label>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" id="closeEditModal" class="btn">Cancel</button>
          </div>
        </form>
      </div>
      <style>
        #eventEditModal { position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;z-index:1000;}
        .modal-backdrop {position:absolute;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.3);}
        .modal-content {position:relative;background:#fff;padding:2rem;border-radius:8px;z-index:1;min-width:320px;}
        .modal-actions {margin-top:1rem;display:flex;gap:1rem;}
      </style>
    `;
    document.body.appendChild(modal);
  }

  // Modal open/close logic
  function openEditModal(eventId) {
    console.log('Edit clicked for eventId:', eventId);
    console.log('Available event IDs:', events.map(ev => ev.id));
    const event = events.find(ev => ev.id === eventId);
    if (!event) {
      alert('Event not found.');
      return;
    }
    const modal = document.getElementById('eventEditModal');
    const form = modal.querySelector('#editEventForm');
    form.event_name.value = event.event_name || '';
    form.start_date.value = event.start_date || '';
    form.end_date.value = event.end_date || '';
    form.location.value = event.location || '';
    form.venue.value = event.venue || '';
    form.dataset.eventId = eventId;
    modal.style.display = 'flex';
  }
  document.getElementById('closeEditModal').onclick = () => {
    if (confirm("Are you sure you want to cancel editing? Unsaved changes will be lost.")) {
      document.getElementById('eventEditModal').style.display = 'none';
    }
  };

  // Handle edit form submission
  document.getElementById('editEventForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const eventId = form.dataset.eventId;
    // Validate date range
    if (new Date(form.end_date.value) < new Date(form.start_date.value)) {
      alert("End date cannot be before start date.");
      return;
    }
    if (!confirm("Are you sure you want to save these changes?")) return;
    const updatedData = {
      event_name: form.event_name.value.trim(),
      start_date: form.start_date.value,
      end_date: form.end_date.value,
      location: form.location.value.trim(),
      venue: form.venue.value.trim()
    };
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        document.getElementById('eventEditModal').style.display = 'none';
        loadLatestEvents();
      } else {
        const errorData = await res.json();
        alert('Failed to update event.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Archive/Un-archive logic
  async function handleArchiveEvent(eventId, action) {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this event?`)) return;
    const status = action === 'Un-archive' ? 'active' : 'archived';
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        loadLatestEvents();
      } else {
        alert('Failed to update event status.');
      }
    } catch {
      alert('Network error.');
    }
  }
});

//update and archive event not fully working
