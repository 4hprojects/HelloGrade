async function renderSidePanel(loggedIn, user) {
  const panel = document.getElementById('sidePanel');
  if (!loggedIn) {
    panel.innerHTML = `
      <div class="login-card">
        <div class="login-card-header">
          <i class="material-icons" style="font-size:2em;margin-bottom:0.3em;">person</i><br>
          Welcome! Please Log In

        </div>
                  <br>
        <div class="login-card-body">
          <form id="loginForm" autocomplete="off">
            <div class="form-group">
              
              <input type="text" placeholder="User Name" id="loginUsername" class="form-control" required autofocus autocomplete="username">
            </div>
            <div class="form-group">
              
              <input type="password" placeholder="Password" id="loginPassword" class="form-control" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn">Sign In</button>
            <div id="loginError" class="error-message" aria-live="polite"></div>
            <!---a href="#" class="forgot-link">Forgot password?</!---a>
          </form>
        </div>
      </div>
    `;
    // Disable menu links
    document.querySelectorAll('.menu-links a, .header-nav a').forEach(a => a.classList.add('disabled'));
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
          <button class="logout-btn btn" id="logoutBtn">Logout</button>
        </div>
      </div>
    `;
    // Enable menu links
    document.querySelectorAll('.menu-links a, .header-nav a').forEach(a => a.classList.remove('disabled'));
    document.getElementById('logoutBtn').onclick = logoutHandler;
  }
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
  renderSidePanel(false);
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

document.addEventListener('DOMContentLoaded', checkAuth);