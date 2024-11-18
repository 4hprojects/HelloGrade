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

// Real-time password validation
document.getElementById('password').addEventListener('input', function () {
    const password = this.value;

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const noSpecialChar = /^[A-Za-z\d]*$/.test(password); // Ensures no special characters
    const hasMinLength = password.length >= 8;

    updateCriteriaLabel('uppercase', hasUppercase);
    updateCriteriaLabel('lowercase', hasLowercase);
    updateCriteriaLabel('number', hasNumber);
    updateCriteriaLabel('special', noSpecialChar);
    updateCriteriaLabel('length', hasMinLength);
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
event.preventDefault(); // Prevent default form submission

// Check if terms are agreed
const termsCheckbox = document.getElementById('termsCheckbox');
if (!termsCheckbox.checked) {
const errorMessage = document.getElementById('errorMessage');
errorMessage.textContent = 'You must agree to the Terms and Conditions.';
errorMessage.style.display = 'block';
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

fetch('/signup', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(formData)
})
.then(response => response.json())
    .then(data => {
        if (data.success) {
            // Show success message
            errorMessage.textContent = 'Signup successful! Redirecting to login...';
            errorMessage.classList.remove('error');
            errorMessage.classList.add('success');
            errorMessage.style.display = 'block';

            // Redirect to login page after 3 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            // Show error message between the Sign Up button and password criteria
            const errorMessage = document.getElementById('errorMessage');
            errorMessage.textContent = data.message;
            errorMessage.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.style.display = 'block';
    });
});