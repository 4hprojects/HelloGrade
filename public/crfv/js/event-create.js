document.addEventListener('DOMContentLoaded', async () => {
  let user = await checkAuth();
  if (!user) {
    showLoginModal();
  } else {
    renderCreatePanel(user);
  }
  loadLatestEvents();

  // Login modal handler
  document.getElementById('loginForm').onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password})
    });
    if (res.ok) {
      user = await checkAuth();
      hideLoginModal();
      renderCreatePanel(user);
    } else {
      document.getElementById('loginError').textContent = "Login failed.";
    }
  };
});

async function checkAuth() {
  // Adjust this endpoint to your actual user info endpoint
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

function showLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
}
function hideLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

function renderCreatePanel(user) {
  const panel = document.getElementById('createPanel');
  if (user.role === 'admin') {
    panel.innerHTML = `
      <div class="app-container">
        <div class="header">
          <h1>Create New Event</h1>
        </div>
        <form id="eventForm" class="attendance-card" autocomplete="off">
          <label>Event Name: <input type="text" name="event_name" required></label>
          <label>Event Date: <input type="date" name="event_date" required></label>
          <label>Location: <input type="text" name="location" required></label>
          <button type="submit" class="btn btn-primary" style="margin-top:1em;">Create Event</button>
          <div id="eventStatus" style="margin-top:1em;color:#1976d2;"></div>
        </form>
      </div>
    `;
    document.getElementById('eventForm').onsubmit = handleEventCreate;
  } else {
    panel.innerHTML = `<div class="not-allowed-msg">Only admin can create event.</div>`;
  }
}

async function handleEventCreate(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    event_name: form.event_name.value.trim(),
    event_date: form.event_date.value,
    location: form.location.value.trim()
  };
  const statusDiv = document.getElementById('eventStatus');
  statusDiv.textContent = "Creating event...";
  try {
    const res = await fetch('/api/events', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.status === "success") {
      statusDiv.textContent = "Event created successfully!";
      form.reset();
      loadLatestEvents();
    } else {
      statusDiv.textContent = result.message || "Event creation failed.";
    }
  } catch {
    statusDiv.textContent = "Network error. Please try again.";
  }
}

async function loadLatestEvents() {
  try {
    const res = await fetch('/api/events/latest');
    const result = await res.json();
    const list = document.getElementById('latestEventsList');
    if (Array.isArray(result)) {
      list.innerHTML = result.map((ev, i) =>
        `<li class="${i % 2 === 0 ? 'event-even' : 'event-odd'}">
          <strong>${ev.event_name}</strong> (${ev.event_date}) - ${ev.location}
        </li>`
      ).join('');
    } else if (Array.isArray(result.events)) {
      list.innerHTML = result.events.map((ev, i) =>
        `<li class="${i % 2 === 0 ? 'event-even' : 'event-odd'}">
          <strong>${ev.event_name}</strong> (${ev.event_date}) - ${ev.location}
        </li>`
      ).join('');
    } else {
      list.innerHTML = "<li>No events found.</li>";
    }
  } catch {
    document.getElementById('latestEventsList').innerHTML = "<li>Could not load events.</li>";
  }
}