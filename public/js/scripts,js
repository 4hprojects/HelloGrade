let countdown = 5;
const countdownElement = document.getElementById('countdown');

const interval = setInterval(() => {
    countdown -= 1;
    countdownElement.textContent = countdown;

    if (countdown <= 0) {
        clearInterval(interval);
        window.location.href = 'index.html';
    }
}, 1000);
