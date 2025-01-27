//2025bytefunrun
// 1) After DOM loads, fetch the snippet
    document.addEventListener('DOMContentLoaded', async () => {
        try {
          const response = await fetch('/events/waiverSnippet.html');
          if (!response.ok) throw new Error('Snippet not found');
  
          const snippetHTML = await response.text();
  
          // 2) Insert the snippet into the container
          document.getElementById('waiverSection').innerHTML = snippetHTML;
        } catch (err) {
          console.error('Error loading waiver snippet:', err);
        }
      });

// Show/hide other organization field
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

    // Example: After successful signup, show a "Thank You" modal
    const funRunForm = document.getElementById('funRunForm');
    const thankYouMessage = document.getElementById('thankYouMessage');
    //const closeThankYou = document.getElementById('closeThankYou');

    //closeThankYou.addEventListener('click', () => {
    //  thankYouMessage.classList.add('hidden');
    //});

    funRunForm.addEventListener('submit', async (e) => {
        e.preventDefault();
      
        // 1) Collect values
        const distanceVal = document.getElementById('distance').value;
        const ageVal = document.getElementById('age').value;
        const firstNameVal = document.getElementById('firstName').value.trim();
        const lastNameVal = document.getElementById('lastName').value.trim();
        const emailVal = document.getElementById('email').value;
        const genderVal = document.getElementById('gender').value;
        const emergencyContactNameVal = document.getElementById('emergencyContactName').value;
        const emergencyContactNumberVal = document.getElementById('emergencyContactNumber').value;
        const orgVal = orgSelect.value;
        const otherOrgVal = otherOrgInput.value;
        const signatureVal = document.getElementById('signature').value.trim();
      
        // 2) Signature check
        const fullName = (firstNameVal + " " + lastNameVal).toLowerCase();
        if (signatureVal.toLowerCase() !== fullName) {
          alert(`Your digital signature must match your first and last name exactly (e.g., ${firstNameVal} ${lastNameVal}).`);
          return; // Stop if signature doesn't match
        }
      
        // 3) Build formData
        const formData = {
          distance: distanceVal,
          age: ageVal,
          firstName: firstNameVal,
          lastName: lastNameVal,
          email: emailVal,
          gender: genderVal,
          emergencyContactName: emergencyContactNameVal,
          emergencyContactNumber: emergencyContactNumberVal,
          organization: orgVal,
          otherOrganization: otherOrgVal,
          signature: signatureVal
        };
      
        // 4) Submit via fetch if signature is correct
        try {
          const resp = await fetch('/api/bytefunrun2025', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
      
          const result = await resp.json();
          if (result.success) {
            // Clear form
            funRunForm.reset();
            otherOrgInput.classList.add('hidden');
      
            // Show the “Thank You” overlay
            thankYouMessage.classList.remove('hidden');
            createShareButtons("share-buttons-overlay");
          } else {
            alert(`Error: ${result.message}`);
          }
        } catch (error) {
          console.error('Error submitting form:', error);
          alert('An error occurred while submitting your sign-up. Please try again.');
        }
      });
      

// ADD references to new buttons:
const registerAnotherBtn = document.getElementById('registerAnother');
const backToInfoBtn = document.getElementById('backToInfo');

// === "Register Another Person" ===
// Option A: navigate to the same sign-up page (if that page is /events/2025bytefunrun.html)
registerAnotherBtn.addEventListener('click', () => {
  window.location.href = '/events/2025bytefunrun.html';
});

// Option B: just reload the current page
// registerAnotherBtn.addEventListener('click', () => {
//   window.location.reload();
// });

// === "Back to Race Info" ===
backToInfoBtn.addEventListener('click', () => {
  // if you have a separate info page, e.g. /events/2025bytefunruninfo.html
  window.location.href = '/events/2025bytefunruninfo.html';

  // Or open in a new tab:
  // window.open('/events/2025bytefunruninfo.html', '_blank');
});

// === "Close" ===
//closeThankYou.addEventListener('click', () => {
//  thankYouMessage.classList.add('hidden');
//});

