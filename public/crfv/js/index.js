//index.js
function updateSignInOutButton(loggedIn) {
  const signInOutBtn = document.getElementById('menuSignInOut');
  if (loggedIn) {
    signInOutBtn.querySelector('span').textContent = 'Sign Out';
    signInOutBtn.querySelector('i').textContent = 'logout';
  } else {
    signInOutBtn.querySelector('span').textContent = 'Sign In';
    signInOutBtn.querySelector('i').textContent = 'login';
  }
}

async function renderSidePanel(loggedIn, user) {
  const panel = document.getElementById('sidePanel');
  const panel2 = document.querySelector('.panel-menu');
  const menuButtons = panel2 ? panel2.querySelectorAll('.menu-square') : [];

  if (!loggedIn) {
    panel.innerHTML = `
  <div class="login-card">
    <div class="login-card-header">
      <i class="material-icons" style="font-size:2em;margin-bottom:0.3em;">person</i><br>
      Welcome! <br> Please Log In
    </div>
    <div class="login-card-body">
      <form id="loginForm" autocomplete="off">
        <div class="form-group">
          <input type="text" placeholder="User Name" id="loginUsername" class="form-control" required autofocus autocomplete="username">
        </div>
        <div class="form-group">
          <input type="password" placeholder="Password" id="loginPassword" class="form-control" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary">Log In</button>
        <div id="loginError" class="error-message" aria-live="polite"></div>
      </form>
    </div>
  </div>
    `;
    // Disable Panel 2 and show info message
    if (panel2) {
      panel2.classList.add('panel-disabled');
      panel2.innerHTML = `
        <div class="panel-locked-message" style="text-align:center; padding:2em;">
          <i class="material-icons" style="font-size:3em; color:#1976d2;">lock</i>
          <h3>Menu Locked</h3>
          <p>Please sign in to access event management features.</p>
          <ul style="list-style:none; padding:0; margin:1em 0;">
            <li>✔ Track attendance</li>
            <li>✔ Register participants</li>
            <li>✔ Create events</li>
            <li>✔ View reports</li>
          </ul>
        </div>
      `;
    }
    document.getElementById('loginForm').onsubmit = loginHandler;
    document.getElementById('loginUsername').focus();
  } else {
    panel.innerHTML = `

      <div class="login-card">
        <div class="login-card-header" style="text-align:center;">
          <i class="material-icons" style="font-size:2em;margin-bottom:0.3em;">verified_user</i>
          Logged In
        </div>
        <div class="login-card-body" style="align-items:center;">
          <div style="margin-bottom:1em;">
            <strong>${user.firstName} ${user.lastName}</strong><br>
            <span style="color:#1976d2;">(${user.role})</span>
          </div>
          <button class="logout-btn btn btn-danger" id="logoutBtn">Log Out</button>
        </div>
      </div>

    `;
    // Enable Panel 2 and restore menu buttons by role
    if (panel2) {
      panel2.classList.remove('panel-disabled');
      // Restore original menu HTML if needed
      panel2.innerHTML = `
        <div class="menu-grid">
          <a href="attendance.html" target="_blank" class="menu-square" data-role="all staff">
            <i class="material-icons">how_to_reg</i>
            <span>Attendance</span>
          </a>
          <a href="user-register.html" target="_blank" class="menu-square" data-role="all staff">
            <i class="material-icons">person_add</i>
            <span>Register</span>
          </a>
          <a href="reports.html" target="_blank" class="menu-square" data-role="all staff">
            <i class="material-icons">bar_chart</i>
            <span>Reports</span>
          </a>
          <a href="attendanceSummary.html" target="_blank" class="menu-square" data-role="all staff">
            <i class="material-icons">fact_check</i>
            <span>Attendance Summary</span>
          </a>
          <a href="event-create.html" target="_blank" class="menu-square" data-role="all">
            <i class="material-icons">event</i>
            <span>Create Event</span>
          </a>
          <a href="settings.html" target="_blank" class="menu-square" data-role="all">
            <i class="material-icons">settings</i>
            <span>Settings</span>
          </a>
        </div>
      `;
      // Show/hide menu buttons by role
      const updatedMenuButtons = panel2.querySelectorAll('.menu-square');
      updatedMenuButtons.forEach(btn => {
        const roles = btn.getAttribute('data-role');
        if (
          user.role === 'admin' ||
          user.role === 'manager' ||
          (roles && roles.includes(user.role))
        ) {
          btn.style.display = '';
        } else {
          btn.style.display = 'none';
        }
      });
    }
    document.getElementById('logoutBtn').onclick = logoutHandler;
  }
  updateSignInOutButton(loggedIn);
}

async function checkAuth() {
  try {
    const res = await fetch('/api/check-auth', { credentials: 'same-origin' });
    if (res.ok) {
      const userRes = await fetch('/user-details', { credentials: 'same-origin' });
      let user = {};
      if (userRes.ok) {
        const data = await userRes.json();
        user = data.user || {};
      }
      renderSidePanel(true, user);
    } else {
      renderSidePanel(false);
    }
  } catch {
    renderSidePanel(false);
  }
}

async function loginHandler(e) {
  e.preventDefault();
  const user = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = '';
  errorDiv.innerHTML = '<span style="color:#1976d2;">Logging in...</span>';
  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIDNumber: user, password: pass })
    });
    if (res.ok) {
      checkAuth();
    } else {
      const data = await res.json().catch(() => ({}));
      errorDiv.textContent = data.message || 'Invalid username or password.';
    }
  } catch {
    errorDiv.textContent = 'Network error. Please try again.';
  }
}

async function logoutHandler() {
  await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
  // Instead of just renderSidePanel(false), do a fresh auth check
  checkAuth();
  // Show a brief message
  const panel = document.getElementById('sidePanel');
  panel.insertAdjacentHTML('afterbegin', `<div class="logout-msg" style="color:#1976d2;margin-bottom:1em;">You have been logged out.</div>`);
  setTimeout(() => {
    const msg = panel.querySelector('.logout-msg');
    if (msg) msg.remove();
  }, 2000);
  // Disable menu links
  document.querySelectorAll('.menu-links a').forEach(a => a.classList.add('disabled'));
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const headerNav = document.getElementById('headerNav');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const signInOutBtn = document.getElementById('menuSignInOut');

  mobileMenuBtn.addEventListener('click', () => {
    headerNav.classList.toggle('active');
    menuBackdrop.classList.toggle('active');
  });

  menuBackdrop.addEventListener('click', () => {
    headerNav.classList.remove('active');
    menuBackdrop.classList.remove('active');
  });

  // Add this for Sign In/Out button functionality
  signInOutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Just focus the login panel or logout if already logged in
    // The side panel already handles login/logout UI
    checkAuth();
    document.getElementById('sidePanel').scrollIntoView({ behavior: 'smooth' });
  });
});
