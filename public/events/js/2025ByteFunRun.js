// 2025ByteFunRun.js
document.addEventListener('DOMContentLoaded', async () => {
  /***** NEW CODE: Cutoff Check *****/
  // This date/time is "2025-02-27 at 10:00 AM" PH time (UTC+8)
  const cutoffDate = new Date('2025-02-27T10:00:00+08:00');
  const now = new Date();

  // Get references to form and "closed" message
  const funRunForm = document.getElementById('funRunForm');
  const closedMessage = document.getElementById('closedMessage');

  // If now is >= cutoff, hide form and show "closed" message
  if (now >= cutoffDate) {
    funRunForm.style.display = 'none';           // or funRunForm.classList.add('hidden');
    closedMessage.classList.remove('hidden');
    return; // Stop execution so no further event listeners are added.
  }

  /***** EXISTING CODE BELOW *****/

  try {
    // Load waiver snippet dynamically
    const response = await fetch('/events/waiverSnippet.html');
    if (!response.ok) throw new Error('Snippet not found');
    const snippetHTML = await response.text();
    document.getElementById('waiverSection').innerHTML = snippetHTML;
  } catch (err) {
    console.error('Error loading waiver snippet:', err);
  }

  // Handle organization field behavior
  const orgSelect = document.getElementById('organization');
  const otherOrgInput = document.getElementById('otherOrganization');
  orgSelect.addEventListener('change', () => {
    if (orgSelect.value === 'others') {
      otherOrgInput.classList.remove('hidden');
      otherOrgInput.required = true;
    } else {
      otherOrgInput.classList.add('hidden');
      otherOrgInput.required = false;
      otherOrgInput.value = "";
    }
  });

  // Handle form submission
  funRunForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect form values
    const formData = {
      distance: document.getElementById('distance').value,
      age: document.getElementById('age').value,
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value,
      gender: document.getElementById('gender').value,
      emergencyContactName: document.getElementById('emergencyContactName').value,
      emergencyContactNumber: document.getElementById('emergencyContactNumber').value,
      organization: orgSelect.value,
      otherOrganization: otherOrgInput.value,
    };

    // Validate signature (waiver signature must match first & last name)
    const signatureVal = document.getElementById('signature').value.trim();
    const fullName = `${formData.firstName} ${formData.lastName}`.toLowerCase();
    if (signatureVal.toLowerCase() !== fullName) {
      alert(`Your digital signature must match your first and last name exactly (e.g., ${formData.firstName} ${formData.lastName}).`);
      return;
    }
    formData.signature = signatureVal;

    // Submit form data via API
    try {
      const response = await fetch('/api/bytefunrun2025', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        // Clear form and reset hidden fields
        funRunForm.reset();
        otherOrgInput.classList.add('hidden');
        // Show the "Thank You" modal
        document.getElementById('thankYouMessage').classList.remove('hidden');
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('An error occurred while submitting your sign-up. Please try again.');
    }
  });

  // Modal buttons
  const registerAnotherBtn = document.getElementById('registerAnother');
  const backToInfoBtn = document.getElementById('backToInfo');

  // Register Another Person
  registerAnotherBtn.addEventListener('click', () => {
    window.location.href = '/events/2025bytefunrun.html';
  });

  // Back to Race Info
  backToInfoBtn.addEventListener('click', () => {
    window.location.href = '/events/2025bytefunruninfo.html';
  });
});
