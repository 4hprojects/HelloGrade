document.addEventListener('DOMContentLoaded', async () => {
  const authModal = document.getElementById('authModal');
  const goHomeBtn = document.getElementById('goHomeBtn');
  const createPanel = document.getElementById('createPanel');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const headerNav = document.getElementById('headerNav');

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
          <label>Event Date: <input type="date" name="event_date" required></label>
          <label>Location: <input type="text" name="location" required></label>
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
      event_date: form.event_date.value,
      location: form.location.value.trim()
    });

    try {
      const data = {
        event_name: form.event_name.value.trim(),
        event_date: form.event_date.value,
        location: form.location.value.trim()
      };

      const res = await fetch('/api/events', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data)
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

  async function loadLatestEvents() {
    const list = document.getElementById('latestEventsList');
    list.innerHTML = '<li>Loading events...</li>';

    try {
      const res = await fetch('/api/events/latest');
      const result = await res.json();

      const events = Array.isArray(result) ? result : 
                   (Array.isArray(result?.events) ? result.events : []);

      if (events.length > 0) {
        list.innerHTML = events.map((ev, i) => `
          <li class="${i % 2 === 0 ? 'event-even' : 'event-odd'}">
            <strong>${ev.event_name}</strong> 
            (${new Date(ev.event_date).toLocaleDateString()}) - ${ev.location}
          </li>
        `).join('');
      } else {
        list.innerHTML = "<li>No upcoming events found</li>";
      }
    } catch (err) {
      list.innerHTML = "<li>Error loading events</li>";
    }
  }
});
