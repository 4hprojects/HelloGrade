document.addEventListener("DOMContentLoaded", function () {
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");
    if (scrollToTopBtn) {
        // Show the button when scrolling down
        window.addEventListener("scroll", function () {
            if (document.documentElement.scrollTop > 100) {
                scrollToTopBtn.style.display = "flex";
            } else {
                scrollToTopBtn.style.display = "none";
            }
        });

        // Scroll to the top smoothly when the button is clicked
        scrollToTopBtn.addEventListener("click", function () {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });
    }
});

document.addEventListener("DOMContentLoaded", function () {
    fetch("/footer.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("footerContainer").innerHTML = data;
        })
        .catch(error => console.error("Error loading footer:", error));
});

// Toggle the search overlay
function toggleSearchOverlay() {
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.toggle('hidden');
    // Focus on the input if overlay is shown
    if (!overlay.classList.contains('hidden')) {
        setTimeout(() => {
            const input = document.getElementById('overlaySearchInput');
            if (input) input.focus();
        }, 100);
    }
}

// Redirect to search.html with the query
function goToSearchPage() {
    const query = document.getElementById('overlaySearchInput').value.trim();
    if (query) {
        window.location.href = '/search.html?q=' + encodeURIComponent(query);
    } else {
        window.location.href = '/search.html';
    }
    return false; // Prevent normal form submission
}
