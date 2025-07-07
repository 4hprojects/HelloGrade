document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('eventForm');
  const statusDiv = document.getElementById('eventStatus');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
      event_name: form.event_name.value.trim(),
      event_date: form.event_date.value,
      location: form.location.value.trim()
    };
    statusDiv.textContent = "Creating event...";
    try {
      const res = await fetch('/api/events', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.status === "success") {
        statusDiv.textContent = "Event created!";
        form.reset();
        loadLatestEvents();
      } else {
        statusDiv.textContent = result.message || "Event creation failed.";
      }
    } catch {
      statusDiv.textContent = "Network error. Please try again.";
    }
  });

  async function loadLatestEvents() {
    const res = await fetch('/api/events/latest');
    const events = await res.json();
    const list = document.getElementById('latestEventsList');
    list.innerHTML = events.map(ev =>
      `<li>${ev.event_name} (${ev.event_date}) - ${ev.location}</li>`
    ).join('');
  }
  loadLatestEvents();
});