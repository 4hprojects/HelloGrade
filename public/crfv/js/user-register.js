//user-register.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('userRegisterForm');
  const accommodation = document.getElementById('accommodation');
  const accommodationOther = document.getElementById('accommodationOther');
  const eventSelect = document.getElementById('eventId');
  const registerMessage = document.getElementById('registerMessage');
  const certificateNameInput = document.getElementById('certificateName');
  const reviewCertificateName = document.getElementById('reviewCertificateName');
  const eventAgree = document.getElementById('eventAgree');
 
  // Populate events dropdown with upcoming events
  fetch('/api/events?upcoming=1')
    .then(res => res.json())
    .then(data => {
      eventSelect.innerHTML = '<option value="">Select event...</option>';
      if (Array.isArray(data.events)) {
        data.events.forEach(ev => {
          eventSelect.innerHTML += `<option value="${ev.id}">${ev.event_name} (${ev.event_date})</option>`;
        });
      } else {
        eventSelect.innerHTML = '<option value="">No upcoming events</option>';
      }
    })
    .catch(() => {
      eventSelect.innerHTML = '<option value="">Failed to load events</option>';
    });

  // Accommodation "Others" logic (container-based)
  accommodation.addEventListener('change', function() {
    if (this.value === 'Others') {
      accommodationOther.style.display = 'block';
      accommodationOther.required = true;
    } else {
      accommodationOther.style.display = 'none';
      accommodationOther.required = false;
      accommodationOther.value = '';
    }
  });

  // Certificate name real-time update
  if (certificateNameInput && reviewCertificateName) {
    certificateNameInput.addEventListener('input', function() {
      reviewCertificateName.textContent = certificateNameInput.value || '-';
    });
  }

  // Event agreement logic
  if (eventAgree && certificateNameInput) {
    eventAgree.addEventListener('change', function() {
      certificateNameInput.disabled = !this.checked;
      if (!this.checked) {
        certificateNameInput.value = '';
        reviewCertificateName.textContent = '-';
      }
    });
  }

  // Form submission
  form.onsubmit = async (e) => {
    e.preventDefault();
    registerMessage.textContent = 'Submitting...';
    const formData = {
      firstName: form.firstName.value.trim(),
      middleName: form.middleName.value.trim(),
      lastName: form.lastName.value.trim(),
      gender: form.gender.value,
      designation: form.designation.value.trim(),
      organization: form.organization.value.trim(),
      email: form.email.value.trim(),
      contactNo: form.contactNo.value.trim(),
      accommodation: form.accommodation.value,
      accommodationOther: form.accommodationOther.value.trim(),
      event_id: form.eventId.value, // <-- use event_id to match backend/db
      certificateName: form.certificateName.value.trim() // <-- add this line
    };

    // Basic validation for "Others"
    if (accommodation.value === 'Others' && !accommodationOther.value.trim()) {
      registerMessage.textContent = 'Please specify your accommodation.';
      registerMessage.style.color = '#e53935';
      accommodationOther.focus();
      return;
    }

    // Data privacy checkbox validation
    if (!form.privacyAgree.checked) {
      registerMessage.textContent = 'You must agree to the Data Privacy Policy to register.';
      registerMessage.style.color = '#e53935';
      form.privacyAgree.focus();
      return;
    }

    // Email validation
    const emailValue = form.email.value.trim();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailValue && !emailPattern.test(emailValue)) {
      registerMessage.textContent = 'Please enter a valid email address (e.g., name@example.com)';
      registerMessage.style.color = '#e53935';
      form.email.focus();
      return;
    }

    // Disable button to prevent double submit
    form.submitBtn.disabled = true;
    form.submitBtn.textContent = 'Registering...';

    try {
      const res = await fetch('/api/user-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        form.reset();
        accommodationOther.style.display = 'none';
        registerMessage.style.color = '#388e3c';
        registerMessage.innerHTML = `
          Registration successful!<br>
          <strong>Your confirmation code:</strong> <span id="confCode">${data.confirmationCode}</span>
          <br><small>Please check your email for details.</small>
        `;
        document.getElementById('copyCodeBtn').onclick = function() {
          navigator.clipboard.writeText(data.confirmationCode);
          this.textContent = "Copied!";
        };
      } else {
        registerMessage.innerHTML = `<span style="color:red;">${data.message || 'Registration failed.'}</span>`;
        registerMessage.style.color = '#e53935';
      }
    } catch (err) {
      registerMessage.innerHTML = `<span style="color:red;">Network error. Please try again.</span>`;
      registerMessage.style.color = '#e53935';
    }
    form.submitBtn.disabled = false;
    form.submitBtn.textContent = 'Register';
  };
});


        // Google Ads
        (adsbygoogle = window.adsbygoogle || []).push({});
        
        // Form functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Elements
            const form = document.getElementById('userRegisterForm');
            const accommodation = document.getElementById('accommodation');
            const accommodationOther = document.getElementById('accommodationOther');
            const accommodationOtherContainer = document.getElementById('accommodationOtherContainer');
            const eventSelect = document.getElementById('eventId');
            const registerMessage = document.getElementById('registerMessage');
            const step1 = document.getElementById('step1');
            const step2 = document.getElementById('step2');
            const step3 = document.getElementById('step3');
            const nextBtn1 = document.getElementById('nextBtn1');
            const nextBtn2 = document.getElementById('nextBtn2');
            const prevBtn1 = document.getElementById('prevBtn1');
            const prevBtn2 = document.getElementById('prevBtn2');
            const progressBar = document.getElementById('progressBar');
            const certificateNameInput = document.getElementById('certificateName');
            const reviewCertificateName = document.getElementById('reviewCertificateName');
            const eventAgree = document.getElementById('eventAgree');

            // Populate events dropdown with upcoming events
            fetch('/api/events?upcoming=1')
                .then(res => res.json())
                .then(data => {
                    eventSelect.innerHTML = '<option value="">Select event...</option>';
                    if (Array.isArray(data.events)) {
                        data.events.forEach(ev => {
                            eventSelect.innerHTML += `<option value="${ev.id}">${ev.event_name} (${ev.event_date})</option>`;
                        });
                    } else {
                        eventSelect.innerHTML = '<option value="">No upcoming events</option>';
                    }
                })
                .catch(() => {
                    eventSelect.innerHTML = '<option value="">Failed to load events</option>';
                });

            // Accommodation "Others" logic (container-based)
            accommodation.addEventListener('change', function() {
                if (this.value === 'Others') {
                    accommodationOtherContainer.style.display = 'block';
                    accommodationOther.required = true;
                } else {
                    accommodationOtherContainer.style.display = 'none';
                    accommodationOther.required = false;
                    accommodationOther.value = '';
                }
            });

            // Certificate name real-time update
            if (certificateNameInput && reviewCertificateName) {
                certificateNameInput.addEventListener('input', function() {
                    reviewCertificateName.textContent = certificateNameInput.value || '-';
                });
            }

            // Event agreement logic
            if (eventAgree && certificateNameInput) {
                eventAgree.addEventListener('change', function() {
                    certificateNameInput.disabled = !this.checked;
                    if (!this.checked) {
                      certificateNameInput.value = '';
                      reviewCertificateName.textContent = '-';
                    }
                });
            }

            // Step navigation handlers
            nextBtn1.addEventListener('click', function() {
                const requiredFields = step1.querySelectorAll('[required]');
                let firstInvalid = null;
                let isValid = true;
                requiredFields.forEach(field => {
                    if (!field.value) {
                        field.style.borderColor = 'var(--warning)';
                        if (!firstInvalid) firstInvalid = field;
                        isValid = false;
                    } else {
                        field.style.borderColor = '#d1d5db';
                    }
                });
                if (isValid) {
                    step1.classList.remove('active');
                    step2.classList.add('active');
                    progressBar.style.width = '66%';
                    updateStep(2);
                } else {
                    showMessage('Please fill all required fields', 'error');
                    if (firstInvalid) firstInvalid.focus();
                }
            });

            nextBtn2.addEventListener('click', function() {
                const requiredFields = step2.querySelectorAll('[required]');
                let isValid = true;
                requiredFields.forEach(field => {
                    if (!field.value) {
                        field.style.borderColor = 'var(--warning)';
                        isValid = false;
                    } else {
                        field.style.borderColor = '#d1d5db';
                    }
                });
                const emailValue = form.email.value.trim();
                if (emailValue && !isValidEmail(emailValue)) {
                    form.email.classList.add('invalid');
                    showMessage('Please enter a valid email address (e.g., name@example.com)', 'error');
                    form.email.focus();
                    isValid = false;
                    return;
                } else {
                    form.email.classList.remove('invalid');
                }
                if (isValid) {
                    step2.classList.remove('active');
                    step3.classList.add('active');
                    progressBar.style.width = '100%';
                    updateStep(3);
  const certificateName = document.getElementById('certificateName');
  const privacyAgree = document.getElementById('privacyAgree');
  const eventAgree = document.getElementById('eventAgree');
  const infoCorrect = document.getElementById('infoCorrect');
                    updateReview();
                } else {
                    showMessage('Please fill all required fields', 'error');
                }
            });

            prevBtn1.addEventListener('click', function() {
                step2.classList.remove('active');
                step1.classList.add('active');
                progressBar.style.width = '33%';
                updateStep(1);
            });

            prevBtn2.addEventListener('click', function() {
                step3.classList.remove('active');
                step2.classList.add('active');
                progressBar.style.width = '66%';
                updateStep(2);
            });

            function updateStep(step) {
                document.querySelectorAll('.step').forEach((stepEl, index) => {
                    if (index < step) {
                        stepEl.classList.add('active');
                    } else {
                        stepEl.classList.remove('active');
                    }
                });
            }

            function updateReview() {
                document.getElementById('reviewEvent').textContent =
                    document.querySelector('#eventId option:checked').text || '-';
                const firstName = document.getElementById('firstName').value;
                const middleName = document.getElementById('middleName').value;
                const lastName = document.getElementById('lastName').value;
                let fullName = firstName;
                if (middleName) fullName += ` ${middleName}`;
                fullName += ` ${lastName}`;
                document.getElementById('reviewName').textContent = fullName;
                document.getElementById('reviewGender').textContent =
                    document.querySelector('#gender option:checked').text || '-';
                document.getElementById('reviewDesignation').textContent =
                    document.getElementById('designation').value || '-';
                document.getElementById('reviewOrganization').textContent =
                    document.getElementById('organization').value || '-';
                document.getElementById('reviewEmail').textContent =
                    document.getElementById('email').value || '-';
                document.getElementById('reviewContact').textContent =
                    document.getElementById('contactNo').value || '-';
                let accommodationText = document.querySelector('#accommodation option:checked').text || '-';
                if (accommodation.value === 'Others') {
                    accommodationText += ` (${document.getElementById('accommodationOther').value})`;
                }
                document.getElementById('reviewAccommodation').textContent = accommodationText;
                document.getElementById('reviewCertificateName').textContent =
                    document.getElementById('certificateName').value || '-';
            }

            // Unified showMessage function
            function showMessage(message, type) {
                registerMessage.className = '';
                registerMessage.style.backgroundColor = '';
                registerMessage.style.color = '';
                registerMessage.style.border = '';

                if (type === 'success') {
                    registerMessage.classList.add('success-message');
                    registerMessage.innerHTML = `
                        <div>${message}</div>
                        <div style="margin-top:1em;">
                            <button id="registerAgainBtn" class="nav-btn" style="margin-right:1em;">Register Another</button>
                            <a href="https://crfv-cpu.org" class="nav-btn" style="text-decoration:none;">Back to Event Details</a>
                        </div>
                    `;
                    // Hide submit and back buttons
                    document.getElementById('submitBtn').style.display = 'none';
                    document.getElementById('prevBtn2').style.display = 'none';
                    // Register Another button handler
                    document.getElementById('registerAgainBtn').onclick = function() {
                        form.reset();
                        document.getElementById('privacyAgree').checked = true;
                        accommodationOtherContainer.style.display = 'none';
                        step3.classList.remove('active');
                        step1.classList.add('active');
                        progressBar.style.width = '33%';
                        updateStep(1);
                        registerMessage.innerHTML = '';
                        // Show buttons again
                        document.getElementById('submitBtn').style.display = '';
                        document.getElementById('prevBtn2').style.display = '';
                    };
                } else if (type === 'error') {
                    registerMessage.classList.add('error-message');
                    registerMessage.textContent = message;
                    setTimeout(() => {
                        registerMessage.textContent = '';
                        registerMessage.className = '';
                    }, 5000);
                } else {
                    registerMessage.style.backgroundColor = '#e1effe';
                    registerMessage.style.color = 'var(--primary)';
                    registerMessage.style.border = '1px solid var(--primary-light)';
                    registerMessage.textContent = message;
                    setTimeout(() => {
                        registerMessage.textContent = '';
                        registerMessage.className = '';
                    }, 5000);
                }
            }

            function isValidEmail(email) {
                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                return emailPattern.test(email);
            }

            // Form submission handler
            form.onsubmit = async function(e) {
                e.preventDefault();
                // Validate privacy checkbox
                if (!form.privacyAgree.checked) {
                    showMessage('You must agree to the Data Privacy Policy to register.', 'error');
                    form.privacyAgree.focus();
                    return;
                }
                // Validate "Others" accommodation
                if (accommodation.value === 'Others' && !accommodationOther.value.trim()) {
                    showMessage('Please specify your accommodation.', 'error');
                    accommodationOther.focus();
                    return;
                }
                // Email validation
                const emailValue = form.email.value.trim();
                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (emailValue && !emailPattern.test(emailValue)) {
                    showMessage('Please enter a valid email address (e.g., name@example.com)', 'error');
                    form.email.focus();
                    return;
                }
                // Disable submit button
                form.submitBtn.disabled = true;
                form.submitBtn.textContent = 'Registering...';

                // Prepare form data
                const formData = {
                    firstName: form.firstName.value.trim(),
                    middleName: form.middleName.value.trim(),
                    lastName: form.lastName.value.trim(),
                    gender: form.gender.value,
                    designation: form.designation.value.trim(),
                    organization: form.organization.value.trim(),
                    email: form.email.value.trim(),
                    contactNo: form.contactNo.value.trim(),
                    accommodation: form.accommodation.value,
                    accommodationOther: form.accommodationOther.value.trim(),
                    event_id: form.eventId.value,
                    certificateName: form.certificateName.value.trim() // <-- add this line
                };

                try {
                    const res = await fetch('/api/user-register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showMessage(
                            `Registration successful!<br>
                            <strong>Your confirmation code:</strong> <span id="confCode">${data.confirmationCode}</span>
                            <br><small>Please check your email for details.</small>`,
                            'success'
                        );

                    } else {
                        showMessage(data.message || 'Registration failed.', 'error');
                    }
                } catch (err) {
                    showMessage('Network error. Please try again.', 'error');
                }
                form.submitBtn.disabled = false;
                form.submitBtn.textContent = 'Register';
            };
        });
