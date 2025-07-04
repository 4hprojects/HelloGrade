const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbz8rsTh7FsEUbpq1FR33VMQ_2auDYpjuq6SJTbOmgzHqHSRThylSkpEe7ZTExBo8099jQ/exec';

document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    rfid: form.rfid.value.trim(),
    id_number: form.id_number.value.trim(),
    last_name: form.last_name.value.trim(),
    first_name: form.first_name.value.trim(),
    middle_name: form.middle_name.value.trim(),
    organization: form.organization.value.trim(),
    contact_no: form.contact_no.value.trim(),
    register: "1" // <-- THIS IS CRUCIAL
  };
  const statusDiv = document.getElementById('regStatus');
  statusDiv.textContent = "Submitting...";
  try {
    const res = await fetch('/api/register', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.status === "success") {
      statusDiv.textContent = "Registration successful!";
      form.reset();
    } else {
      statusDiv.textContent = result.message || "Registration failed.";
    }
  } catch (err) {
    statusDiv.textContent = "Network error. Please try again.";
  }
});