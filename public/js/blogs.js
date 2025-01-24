document.addEventListener("DOMContentLoaded", () => {
    const blogPool = [
        {
            id: "it114lesson4",
            title: "Master Python Conditional Statements: If, Elif, Else Guide",
            date: "January 23, 2025",
            image: "/images/it114-lesson4-conditional-statements.webp",
            link: "/blogs/it114-lesson4-conditional-statements",
            description: "Learn Python conditional statements with if, elif, else, and nested logic. Write smarter, dynamic code with practical examples and actionable tips for better decision-making in your programs."
        },
        {
            id: "mst24lesson5",
            title: "The Internet and the World Wide Web: A Gateway to Modern Connectivity",
            date: "January 23, 2025",
            image: "/images/mst24-lesson5-leon-seibert-2m71l9fA6mg-unsplash.webp",
            link: "/blogs/mst24lesson5-internet-twww",
            description: "Explore the Internet and the World Wide Web: their history, infrastructure, and tools like web browsers and search engines. Learn how these technologies shape modern life and discover actionable insights to improve your online interactions."
        },        
        {
            id: "blog19",
            title: "Put First Things First: Master Time Management with Habit 3",
            date: "January 23, 2025",
            image: "/images/blog19ch_pski-bylXfUFJylU-unsplash.webp",
            link: "/blogs/scp3-put-first-things-first",
            description: "Learn actionable strategies from Stephen R. Covey’s Habit 3 to prioritise your Big Rocks, manage your time effectively, and align daily actions with your personal mission."
        },
        {
            id: "blog18",
            title: "Essential Guide to Computer Hardware: Basics, Components, and Troubleshooting Tips",
            date: "January 22, 2025",
            image: "/images/blog17nathan-anderson-xV3CHzfhkjE-unsplash.webp",
            link: "/blogs/mst24lesson3-hardwarecomponents",
            description: "Discover the basics of computer hardware, including CPUs, motherboards, storage devices, and expert troubleshooting tips."
        },         
        {
            id: "blog17",
            title: "Mastering the Basics: While Looping Statement",
            date: "January 22, 2025",
            image: "/images/blog17lucas-hein-3tgwzKpxHa4-unsplash.webp",
            link: "/blogs/it114-lesson5-while-looping-statement",
            description: "Learn Python while looping statements with clear examples, practical tips, and expert insights to improve your coding skills."
        },  
        {
            id: "blog16",
            title: "The Invisible Force Behind Every Click",
            date: "January 21, 2025",
            image: "/images/blog16software-behind-every-click.webp",
            link: "/blogs/mst24lesson4-software-behind-every-click",
            description: "Discover software's role, types, and functions shaping our world. Explore operating systems, applications, and tools driving innovation."
        },  
        {
            id: "blog15",
            title: "5G vs 6G: The Future of Connectivity and What It Means for You",
            date: "January 18, 2025",
            image: "/images/blog15-5g-vs-6g.webp",
            link: "/blogs/5G-vs-6G",
            description: "Discover the key differences between 5G and 6G, their transformative applications, and how businesses can prepare for the next wave of wireless connectivity."
        },        
        {   
            id: "blog1",
            title: "The Role of Technology in Education",
            date: "December 1, 2024",
            image: "/images/blog1.webp",
            link: "/blogs/role-of-technology-in-education",
            description: "Learn how technology is shaping the way educators and students interact in today's classrooms."
        },
        {
            id: "effective-study-techniques",
            title: "Effective Study Techniques: Boost Learning and Retention",
            date: "December 1, 2024",
            image: "/images/effective-study-techniques.webp",
            link: "/blogs/effective-study-techniques",
            description: "Master proven study techniques like active recall, spaced repetition, and the Pomodoro Technique. Transform your study habits, improve retention, and reduce stress with actionable methods to enhance your learning journey."
        },
        {
            id: "blog3",
            title: "Developing Digital Literacy Skills",
            date: "December 1, 2024",
            image: "/images/blog3.webp",
            link: "/blogs/blog3",
            description: "Empower students with essential competencies to thrive in the digital age."
        },
        {
            id: "blog4",
            title: "Why Every Student Should Attend Seminars and Conferences",
            date: "December 2, 2024",
            image: "/images/blog4.webp",
            link: "/blogs/blog4",
            description: "Discover the benefits of seminars and conferences: networking, fresh perspectives, and staying updated on trends."
        },
        {
            id: "blog5",
            title: "What to Do During Semestral Breaks: Rest, Growth, and Fun",
            date: "December 5, 2024",
            image: "/images/blog5.webp",
            link: "/blogs/blog5",
            description: "Maximise your semestral break with tips for rest, skill development, and exciting activities."
        },
        {
            id: "blog6",
            title: "Baguio Smart City Challenge: Student Innovations for a Smarter Future",
            date: "December 11, 2024",
            image: "/images/blog6.webp",
            link: "/blogs/blog6",
            description: "Explore the projects, lessons, and insights from this transformative experience."
        },
        {
            id: "blog7",
            title: "10 Things I Wish I Knew Before Entering IT – Tips for Success",
            date: "December 30, 2024",
            image: "/images/blog7.webp",
            link: "/blogs/blog7",
            description: "Discover the essential lessons to thrive in IT, from mastering problem-solving and debugging to embracing perseverance and practical skills. Avoid common regrets and excel in your IT career with these expert tips."
        },
        {
            id: "blog8",
            title: "Building Habits for Success: Your Journey to Personal Growth",
            date: "January 2, 2025", 
            image: "/images/blog8.webp",
            link: "/blogs/blog8",
            description: "Discover how to build positive habits and unlock your potential for success. Learn practical strategies to overcome challenges, achieve goals, and foster personal growth on your journey to self-improvement."
        },
        {
            id: "blog9",
            title: "A Beginner's Guide to USB-A, USB-B, and USB-C",
            date: "January 3, 2025", 
            image: "/images/blog9.webp",
            link: "/blogs/blog9",
            description: "Learn the differences between USB-A, USB-B, and USB-C, their history, uses, and why USB-C is the future. A comprehensive guide for tech enthusiasts and beginners alike."
        },
        {
            id: "blog10",
            title: "A Professional’s Guide to Personal and Leadership Growth",
            date: "January 9, 2025", 
            image: "/images/blog10.webp",
            link: "/blogs/scp1-be-proactive",
            description: "Unlock the secrets to personal effectiveness and leadership with our professional guide to The 7 Habits of Highly Effective People. Explore actionable self-improvement tips, productivity habits, and strategies for habit formation in this 8-part series based on Stephen R. Covey’s timeless principles."
        },
        {
            id: "blog11",
            title: "Why Writing Down Your Goals Is Crucial",
            date: "January 12, 2025", 
            image: "/images/blog11-gabrielle-henderson-5HqtJT2l9Gw-unsplash.webp",
            link: "/blogs/why-writing-down-your-goals-is-important",
            description: "Learn why writing down goals boosts success. Discover insights from Covey's The 7 Habits and neuroscience to achieve clarity, accountability, and progress."
        },
        {
            id: "blog12",
            title: "Master Time Management: Proven Methods for Productivity",
            date: "January 15, 2025", 
            image: "/images/blog12-djim-loic-ft0-Xu4nTvA-unsplash.webp",
            link: "/blogs/master-time-management",
            description: "Discover practical time management methods, including the Eisenhower Matrix, time-blocking, and the Pomodoro technique. Transform your productivity with actionable strategies inspired by The 7 Habits of Highly Effective People."
        },
        {
            id: "blog13",
            title: "Crafting Your Legacy: The Power of Beginning With the End in Mind",
            date: "January 16, 2025", 
            image: "/images/blog13joshua-hoehne-Nsaqv7v2V7Q-unsplash.webp",
            link: "/blogs/scp2-beginning-with-the-end-in-mind",
            description: "Discover practical time management methods, including the Eisenhower Matrix, time-blocking, and the Pomodoro technique. Transform your productivity with actionable strategies inspired by The 7 Habits of Highly Effective People."
        },
        {
            id: "blog14",
            title: "The Cost of Standing Still: Brands That Failed to Innovate and Disappeared",
            date: "January 17, 2025", 
            image: "/images/blog14chris-lawton-5IHz5WhosQE-unsplash.webp",
            link: "/blogs/brands-that-failed-to-innovate-and-disappeared",
            description: "Discover the cautionary tales of once-dominant brands like Blockbuster, Kodak, and Nokia that failed to innovate and lost their edge. Learn why they failed, the lessons they teach, and how businesses can avoid the same fate."
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
    if (!currentBlogId) {
    console.error("No valid blog ID provided in data-blog-id.");
    return;
}
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
