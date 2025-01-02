function createShareButtons(containerId) {
    const shareUrl = window.location.href; // Automatically gets the current page URL
    const shareText = document.querySelector('meta[name="title"]')?.content || "Check out this blog!";
    const description = document.querySelector('meta[name="description"]')?.content || "A great blog post to read!";

    const platforms = [
        {
            name: "Facebook",
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
            class: "text-blue-600 hover:text-blue-800",
            icon: '<i class="fab fa-facebook-f"></i>',
            title: "Share on Facebook",
        },
        {
            name: "X",
            url: `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
            class: "text-black hover:text-gray-700",
            icon: '<i class="fab fa-x-twitter"></i>',
            title: "Share on X",
        },
        {
            name: "LinkedIn",
            url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}&summary=${encodeURIComponent(description)}`,
            class: "text-blue-700 hover:text-blue-900",
            icon: '<i class="fab fa-linkedin-in"></i>',
            title: "Share on LinkedIn",
        },
        {
            name: "Email",
            url: `mailto:?subject=${encodeURIComponent(shareText)}&body=Check%20out%20this%20blog:%20${encodeURIComponent(shareUrl)}`,
            class: "text-gray-600 hover:text-gray-800",
            icon: '<i class="fas fa-envelope"></i>',
            title: "Share via Email",
        },
    ];

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found.`);
        return;
    }

    platforms.forEach(platform => {
        const link = document.createElement("a");
        link.href = platform.url;
        link.target = "_blank";
        link.className = `${platform.class} text-2xl mx-2`; // Styling for icons
        link.title = platform.title;
        link.innerHTML = platform.icon;
        container.appendChild(link);
    });
}

// Automatically initialize the share buttons
document.addEventListener("DOMContentLoaded", () => {
    const containerId = "share-buttons";
    if (document.getElementById(containerId)) {
        createShareButtons(containerId);
    }
});
