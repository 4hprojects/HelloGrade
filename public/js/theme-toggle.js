const themeToggle = document.getElementById("themeToggle");

// Apply saved theme preference
if (localStorage.getItem("theme") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀︎";
}

themeToggle.addEventListener("click", () => {
    // Toggle the theme
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