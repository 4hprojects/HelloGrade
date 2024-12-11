// js/signup.js

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const errorMessage = document.getElementById('errorMessage');
    console.log('Signup form:', signupForm);

        // Real-time password matching validation
        confirmPasswordInput.addEventListener('input', () => {
            if (passwordInput.value !== confirmPasswordInput.value) {
                errorMessage.textContent = 'Passwords do not match!';
                errorMessage.className = 'notification error';
                errorMessage.style.display = 'block';
            } else {
                errorMessage.textContent = '';
                errorMessage.style.display = 'none';
            }
        });

    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        if (passwordInput.value !== confirmPasswordInput.value) {
            showNotification('error', 'Passwords do not match!');
            return;
        }

        const formData = new FormData(signupForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.success) {
                showNotification('success', result.message);
                // Optionally redirect to login page after a delay
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else {
                showNotification('error', result.message);
            }
        } catch (error) {
            console.error('Error during signup:', error);
            showNotification('error', 'An error occurred during signup.');
        }
    });
});


// Password visibility toggle
document.querySelectorAll('.password-toggle-icon').forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        this.textContent = type === 'password' ? '👁️' : '🙈';
    });
});

// Theme toggle logic
const themeToggle = document.getElementById("themeToggle");

if (localStorage.getItem("theme") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀︎";
}

themeToggle.addEventListener("click", () => {
    if (document.documentElement.getAttribute("data-theme") === "dark") {
        document.documentElement.setAttribute("data-theme", "light");
        themeToggle.textContent = "☾";
        localStorage.setItem("theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        themeToggle.textContent = "☀︎";
        localStorage.setItem("theme", "dark");
    }
});

function updateCriteriaLabel(elementId, isValid) {
    const element = document.getElementById(elementId);
    if (isValid) {
        element.classList.add('valid');
    } else {
        element.classList.remove('valid');
    }
}

document.getElementById('signupForm').addEventListener('submit', function(event) {
    console.log('Form submitted'); // Debugging statement
    event.preventDefault(); // Prevent default form submission

    // Check if terms are agreed
    const termsCheckbox = document.getElementById('termsCheckbox');
    if (!termsCheckbox.checked) {
        alert(`${type.toUpperCase()}: ${message}`);
        showNotification('error', 'You must agree to the Terms and Conditions.');
        return;
    }

    // Collect form data
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        studentIDNumber: document.getElementById('studentIDNumber').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        termsCheckbox: termsCheckbox.checked
    };

    // Send data to the server
    fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    })
    .then((response) => response.json().then((data) => ({ status: response.status, body: data })))
    .then(({ status, body }) => {
        if (status === 400) {
            // Display the error message in the notification
            alert(`${type.toUpperCase()}: ${message}`);
            showNotification('error', body.message);
        } else if (status === 200 && body.success) {
            // Display success notification and redirect
            alert(`${type.toUpperCase()}: ${message}`);
            showNotification('success', 'Signup successful! Redirecting to login...');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 3000);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`${type.toUpperCase()}: ${message}`);
        showNotification('error', 'An unexpected error occurred. Please try again.');
    });
    
});
