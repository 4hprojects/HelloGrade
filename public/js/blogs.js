document.addEventListener("DOMContentLoaded", () => {
    const blogPool = [
        {   
            id: "blog1",
            title: "The Role of Technology in Education",
            date: "December 1, 2024",
            image: "/images/blog1.webp",
            link: "/blogs/blog1.html",
            description: "Learn how technology is shaping the way educators and students interact in today's classrooms."
        },
        {
            id: "blog2",
            title: "Effective Study Techniques",
            date: "December 1, 2024",
            image: "/images/blog2.webp",
            link: "/blogs/blog2.html",
            description: "Discover effective methods for students to improve their learning and retention of concepts."
        },
        {
            id: "blog3",
            title: "Developing Digital Literacy Skills",
            date: "December 1, 2024",
            image: "/images/blog3.webp",
            link: "/blogs/blog3.html",
            description: "Empower students with essential competencies to thrive in the digital age."
        },
        {
            id: "blog4",
            title: "Why Every Student Should Attend Seminars and Conferences",
            date: "December 2, 2024",
            image: "/images/blog4.webp",
            link: "/blogs/blog4.html",
            description: "Discover the benefits of seminars and conferences: networking, fresh perspectives, and staying updated on trends."
        },
        {
            id: "blog5",
            title: "What to Do During Semestral Breaks: Rest, Growth, and Fun",
            date: "December 5, 2024",
            image: "/images/blog5.webp",
            link: "/blogs/blog5.html",
            description: "Maximise your semestral break with tips for rest, skill development, and exciting activities."
        },
        {
            id: "blog6",
            title: "Baguio Smart City Challenge: Student Innovations for a Smarter Future",
            date: "December 11, 2024",
            image: "/images/blog6.webp",
            link: "/blogs/blog6.html",
            description: "Explore the projects, lessons, and insights from this transformative experience."
        },
        {
            id: "blog7",
            title: "10 Things I Wish I Knew Before Entering IT – Tips for Success",
            date: "December 30, 2024",
            image: "/images/blog7.webp",
            link: "/blogs/blog7.html",
            description: "Discover the essential lessons to thrive in IT, from mastering problem-solving and debugging to embracing perseverance and practical skills. Avoid common regrets and excel in your IT career with these expert tips."
        },
        {
            id: "blog8",
            title: "Building Habits for Success: Your Journey to Personal Growth",
            date: "January 2, 2025", 
            image: "/images/blog8.webp",
            link: "/blogs/blog8.html",
            description: "Discover how to build positive habits and unlock your potential for success. Learn practical strategies to overcome challenges, achieve goals, and foster personal growth on your journey to self-improvement."
        }
    ];

    // 1. Latest / Random Blog Sections
    const latestBlogContainer = document.getElementById("latestBlogContainer");
    const randomBlogsContainer = document.getElementById("randomBlogsContainer");
    const numberOfBlogsToShow = 3;

    // Sort blogs by date (largest/newest date first)
    const sortedBlogs = blogPool.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestBlog = sortedBlogs[0];
    const randomBlogs = sortedBlogs.slice(1).sort(() => Math.random() - 0.5).slice(0, numberOfBlogsToShow);

    // Display the latest blog (if container exists)
    if (latestBlogContainer) {
        latestBlogContainer.innerHTML = `
            <img src="${latestBlog.image}" alt="${latestBlog.title}" class="w-full h-64 object-cover rounded-md mb-4">
            <h3 class="text-2xl font-semibold text-gray-800">
                <a href="${latestBlog.link}" class="text-blue-600 hover:underline">${latestBlog.title}</a>
            </h3>
            <p class="text-gray-600 text-sm">Published on: <span class="font-medium">${latestBlog.date}</span></p>
            <p class="text-gray-600 mt-2">${latestBlog.description}</p>
            <a href="${latestBlog.link}" class="text-blue-500 mt-4 inline-block hover:underline">Read More</a>
        `;
    }

    // Display random blogs (if container exists)
    if (randomBlogsContainer) {
        randomBlogs.forEach(blog => {
            const blogCard = document.createElement("div");
            blogCard.className = "bg-white p-6 rounded-lg shadow-md";

            blogCard.innerHTML = `
                <img src="${blog.image}" alt="${blog.title}" class="w-full h-40 object-cover rounded-md mb-4">
                <h3 class="text-xl font-semibold text-gray-800">
                    <a href="${blog.link}" class="text-blue-600 hover:underline">${blog.title}</a>
                </h3>
                <p class="text-gray-600 text-sm">Published on: <span class="font-medium">${blog.date}</span></p>
                <p class="text-gray-600 mt-2">${blog.description}</p>
                <a href="${blog.link}" class="text-blue-500 mt-4 inline-block hover:underline">Read More</a>
            `;

            randomBlogsContainer.appendChild(blogCard);
        });
    }

    // 2. Blog Navigation (Previous / Next)
    const currentBlogId = document.body.getAttribute("data-blog-id"); // e.g., "blog7"
    const currentIndex = sortedBlogs.findIndex(blog => blog.id === currentBlogId);

    // If the blog ID is recognized (currentIndex >= 0), build nav
    if (currentIndex !== -1) {
        // Looping logic:
        const prevIndex = (currentIndex + 1) % sortedBlogs.length;
        const nextIndex = (currentIndex - 1 + sortedBlogs.length) % sortedBlogs.length;

        const prevBlog = sortedBlogs[prevIndex];
        const nextBlog = sortedBlogs[nextIndex];

        const navContainer = document.getElementById("blogNav");
        if (navContainer) {
            navContainer.innerHTML = `
            <div class="mt-6 flex justify-center space-x-4">
                <a
                    href="${prevBlog.link}"
                    class="text-white bg-blue-600 px-4 py-2 rounded-md text-sm text-center hover:bg-blue-700"
                >
                    Previous: ${prevBlog.title}
                </a>
                <a
                    href="/blog"
                    class="text-white bg-green-700 px-4 py-2 rounded-md text-sm text-center hover:bg-green-800"
                >
                    Check Other Blogs
                </a>
                <a
                    href="${nextBlog.link}"
                    class="text-white bg-blue-600 px-4 py-2 rounded-md text-sm text-center hover:bg-blue-700"
                >
                    Next: ${nextBlog.title}
                </a>
            </div>

            `;
        }
    } else {
        // Optional: console error if data-blog-id doesn't match
        console.error("No matching blog for data-blog-id:", currentBlogId);
    }
});
