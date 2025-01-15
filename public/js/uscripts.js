document.addEventListener("DOMContentLoaded", function () {
    // Scroll to Top Button functionality
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

    // Load footer HTML content
    const footerContainer = document.getElementById("footerContainer");
    if (footerContainer) {
        fetch("/footer.html")
            .then(response => response.text())
            .then(data => {
                footerContainer.innerHTML = data;
            })
            .catch(error => console.error("Error loading footer:", error));
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

// search functions
function toggleSearchOverlay() {
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) {
        searchOverlay.classList.toggle('hidden');
    }
}

function goToSearchPage() {
    const query = document.getElementById('overlaySearchInput').value.trim();
    if (query) {
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
    return false; // Prevent default form submission
}
