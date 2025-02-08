// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // ==== Select DOM Elements ====
    const privacyCheckbox = document.getElementById('privacyAgreement');
    const registrationForm = document.getElementById('registrationForm');
    const successModal = document.getElementById('successModal');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModal');
    const formStatus = document.getElementById('formStatus');
  
    // ==== Show/Hide the Registration Form based on Privacy Agreement ====
    privacyCheckbox.addEventListener('change', () => {
      registrationForm.classList.toggle('form-hidden', !privacyCheckbox.checked);
    });
  
    // ==== College and Degree Data ====
    const colleges = {
      'College of Agriculture': [
        'Bachelor of Science in Agriculture',
        'Bachelor of Science in Agribusiness'
      ],
      'College of Arts and Humanities': [
        'Bachelor of Arts in Communication',
        'Bachelor of Arts in English Language',
        'Bachelor of Arts in Filipino Language'
      ],
      'College of Engineering': [
        'Bachelor of Science in Agricultural and Biosystems Engineering',
        'Bachelor of Science in Civil Engineering',
        'Bachelor of Science in Electrical Engineering',
        'Bachelor of Science in Industrial Engineering'
      ],
      'College of Forestry': [
        'Bachelor of Science in Forestry'
      ],
      'College of Home Economics and Technology': [
        'Bachelor of Science in Hospitality Management',
        'Bachelor of Science in Nutrition and Dietetics',
        'Bachelor of Science in Entrepreneurship',
        'Bachelor of Science in Food Technology',
        'Bachelor of Science in Tourism Management'
      ],
      'College of Human Kinetics': [
        'Bachelor of Science in Exercise and Sports Sciences'
      ],
      'College of Information Sciences': [
        'Bachelor of Science in Development Communication',
        'Bachelor of Library and Information Science'
      ],
      'College of Natural Sciences': [
        'Bachelor of Science in Biology',
        'Bachelor of Science in Chemistry',
        'Bachelor of Science in Environmental Science'
      ],
      'College of Numeracy and Applied Sciences': [
        'Bachelor of Science in Statistics',
        'Bachelor of Science in Mathematics'
      ],
      'College of Nursing': [
        'Bachelor of Science in Nursing'
      ],
      'College of Public Administration and Governance': [
        'Bachelor of Public Administration'
      ],
      'College of Social Sciences': [
        'Bachelor of Science in Psychology',
        'Bachelor of Arts in History'
      ],
      'College of Teacher Education': [
        'Bachelor of Early Childhood Education',
        'Bachelor of Elementary Education',
        'Bachelor of Secondary Education',
        'Bachelor of Technology and Livelihood Education'
      ],
      'College of Veterinary Medicine': [
        'Doctor of Veterinary Medicine'
      ]
    };
  
    const collegeSelect = document.getElementById('college');
    const degreeSelect = document.getElementById('degree');
  
    // ==== Populate College Dropdown ====
    Object.keys(colleges).forEach(college => {
      const option = new Option(college, college);
      collegeSelect.add(option);
    });
  
    // ==== Update Degree Dropdown on College Change ====
    collegeSelect.addEventListener('change', () => {
      degreeSelect.innerHTML = '<option value="" disabled selected>Select Degree</option>';
      const selectedCollege = collegeSelect.value;
      if (colleges[selectedCollege]) {
        colleges[selectedCollege].forEach(degree => {
          const option = new Option(degree, degree);
          degreeSelect.add(option);
        });
      }
    });
  
    // ==== Handle Form Submission ====
    registrationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      // Gather form values
      const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        yearLevel: document.getElementById('yearLevel').value,
        email: document.getElementById('email').value,
        college: document.getElementById('college').value,
        degree: document.getElementById('degree').value,
      };
  
      // Check Digital Signature (full name)
      const signatureVal = document.getElementById('signature').value.trim();
      const fullName = `${formData.firstName} ${formData.lastName}`.toLowerCase();
  
      if (signatureVal.toLowerCase() !== fullName) {
        alert(
          `Your digital signature must match your first and last name exactly (e.g., ${formData.firstName} ${formData.lastName}).`
        );
        return;
      }
  
      formData.signature = signatureVal;
  
      // (Optional) Show some loading or disable the button here
      formStatus.textContent = 'Submitting... Please wait.';
  
      try {
        // Example POST to your server endpoint:
        const response = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const result = await response.json();
  
        if (response.ok) {
          // Clear any status text
          formStatus.textContent = '';
  
          // Show success modal
          showSuccessModal(formData.email);
  
        } else {
          alert(`Error: ${result.message || 'Unknown error'}`);
          formStatus.textContent = '';
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('An error occurred while submitting. Please try again.');
        formStatus.textContent = '';
      }
    });
  
    // ==== showSuccessModal Function ====
    function showSuccessModal(email) {
      console.log('showSuccessModal called with email:', email);
  
      // Reset the form so user can register again if desired
      registrationForm.reset();
  
      // Fill the modal content
      modalContent.innerHTML = `
        <h2>✅ Registration Successful!</h2>
        <p>Thank you for registering. A confirmation email will be sent to <strong>${email}</strong>.</p>
  
        <div class="success-buttons">
          <!-- .btn-secondary class can be in your CSS for a different color from primary -->
          <button id="registerAgain" class="btn btn-secondary">Register Another Participant</button>
          <!-- .btn-tertiary class for a distinct color -->
          <a href="/blogs" class="btn btn-tertiary">Check Latest Blogs</a>
        </div>
      `;
  
      // Display the modal
      successModal.style.display = 'flex';
  
      // Hook up the "Register Again" button to close the modal
      document.getElementById('registerAgain').addEventListener('click', () => {
        successModal.style.display = 'none';
      });
    }
  
    // ==== Close Modal on X button ====
    closeModalBtn.addEventListener('click', () => {
      successModal.style.display = 'none';
    });
  
    // This console log will help see if the script runs without errors on load.
    console.log('Script loaded successfully. The modal is hidden by default.');
  });
  
/*
  document.getElementById("startRegistration").addEventListener("click", () => {
    document.getElementById("privacyAgreement").checked = true;
    document.getElementById("registrationForm").classList.remove("form-hidden");
    document.getElementById("registrationForm").scrollIntoView({ behavior: "smooth" });
});*/


document.getElementById("scrollToPrivacyBtn").addEventListener("click", () => {
    document.getElementById("privacy-section").scrollIntoView({ behavior: "smooth" });
});
