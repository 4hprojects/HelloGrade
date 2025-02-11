document.addEventListener("DOMContentLoaded", () => {
    const blogPool = [
        {
            id: "mst24-lesson9",
            title: "Cloud Computing",
            date: "February 12, 2025",
            image: "/images/mst24lesson9-cloudcomputing.webp",
            link: "/blogs/mst24lesson9-cloudcomputing",
            description: "Discover the fundamentals of cloud computing, including its benefits, service models (IaaS, PaaS, SaaS, FaaS), and real-world applications. Learn how cloud services power modern businesses and enhance technology efficiency."
        },
        {
            id: "handwriting-code-guide",
            title: "Improving Coding Skills Through Handwriting",
            date: "February 11, 2025",
            image: "/images/handwriting-code.webp",
            link: "/blogs/handwritingcode.html",
            description: "Discover how writing code with pen and paper can improve your problem-solving, debugging, and coding skills. Learn actionable steps to practice pen and paper coding techniques and improve your coding fluency by applying traditional coding methods."
        },     
        {
            id: "it114-lesson8-randommodule",
            title: "Python Random Module",
            date: "February 7, 2025",
            image: "/images/it114-lesson8-randommodule.webp",
            link: "/blogs/it114-lesson8-randommodule",
            description: "Learn how to use the Python random module for generating random numbers, shuffling lists, selecting random elements, and more. Explore key functions like random(), randint(), shuffle(), choice(), and uniform(), and see how randomness is used in AI, game development, cryptography, and simulations."
        },        
        {
            id: "year2038-problem",
            title: "The Year 2038 Problem",
            date: "February 7, 2025",
            image: "/images/year2038.webp",
            link: "/blogs/year2038",
            description: "Explore the risks of the Y2K38 bug and how the Unix time overflow could disrupt banking, aviation, infrastructure, and IoT. Learn about 64-bit migration, patching legacy systems, and industry-wide solutions to prevent a global digital meltdown before 2038."
        },        
        {
            id: "scp5-seek-first-to-understand",
            title: "Seek First to Understand, Then to Be Understood",
            date: "February 6, 2025",
            image: "/images/sc/scp5-seek-first-to-understand.webp",
            link: "/blogs/scp5-seek-first-to-understand",
            description: "Discover how Habit 5 from Stephen Covey’s 7 Habits of Highly Effective People can transform communication, leadership, and problem-solving. Learn practical strategies for empathic listening and how to apply them in IT, business, and personal relationships."
        },        
        {
            id: "mst24-lesson8",
            title: "Artificial Intelligence",
            date: "February 4, 2025",
            image: "/images/mst24-lesson8-ai-concept.webp",
            link: "/blogs/mst24lesson8-artificialintelligence",
            description: "Discover the fundamentals of Artificial Intelligence, including Machine Learning, Deep Learning, and AI applications in daily life. Learn about AI ethics, automation, and the future of AI in business, healthcare, and technology."
        },
        {
            id: "it114-lesson7",
            title: "Mastering Python For Loops",
            date: "February 4, 2025",
            image: "/images/it114-lesson7-blog-python-for-loops.webp",
            link: "/blogs/it114-lesson7-forloop",
            description: "Learn how to use Python for loops effectively with this step-by-step guide. Explore the syntax, iterate over sequences, work with nested loops, and apply advanced techniques like enumerate(), zip(), and range(). Unlock the full potential of iteration in Python with real-world examples and exercises."
        },
        {
            id: "programmingMindset",
            title: "The Programming Mindset: Think Like a Developer",
            date: "January 31, 2025",
            image: "/images/pdev/pmt-katrina-wright-yMg_SMqfoRU-unsplash.webp",
            link: "/blogs/programmingmindset",
            description: "Develop a strong programming mindset with key problem-solving strategies. Learn debugging techniques, optimization principles, and practical approaches that help you write better code and become a more efficient developer."
        },
        {
            "id": "mst24lesson7",
            "title": "Social Media in the Modern World",
            "date": "January 31, 2025",
            "image": "/images/mst24lesson7-socialmedia.webp",
            "link": "/blogs/mst24lesson7-socialmedia",
            "description": "Discover the evolution of social media, its impact on society, privacy concerns, and ethical considerations. Learn how online communities, user-generated content, and digital technology shape communication, business, and global interactions."
        },
        {
            id: "scp4-think-win-win",
            title: "Think Win-Win",
            date: "January 29, 2025",
            image: "/images/scp4-krakenimages-Y5bvRlcCx8k-unsplash.webp",
            link: "/blogs/scp4-think-win-win",
            description: "Discover how Think Win-Win, the 4th habit from The 7 Habits of Highly Effective People, fosters collaboration, leadership, and long-term success through mutual benefit."
        },
        {
            id: "it114lesson3",
            title: "Python Strings",
            date: "January 15, 2025",
            image: "/images/it114lesson3-hellograde-blog-python-strings.jpg",
            link: "/blogs/it114-lesson3-python-strings",
            description: "Discover the power of Python strings. Learn string manipulation, slicing, formatting, and essential string methods with real-world examples to enhance your coding skills."
        },
        {
            id: "it114lesson2",
            title: "Python Programming Basics",
            date: "January 13, 2025",
            image: "/images/it114lesson2-hellograde-blog-python-basics.jpg",
            link: "/blogs/it114-lesson2-python-programming-basics",
            description: "Learn Python programming from scratch. Explore Python syntax, variables, data types, and operators with hands-on examples. Build a strong foundation for coding and software development."
        },
        {
            id: "it114lesson1",
            title: "Introduction to Python Programming",
            date: "January 9, 2025",
            image: "/images/it114lesson1-python-intro.webp",
            link: "/blogs/it114-lesson1-introduction-to-python",
            description: "Start your Python journey with this beginner-friendly lesson. Learn about Python’s history, why it became the world’s most popular programming language, and how to set up your development environment. Get ready to write your first Python script and take the first step into coding."
        },
        {
            id: "mst24lesson1",
            title: "Understanding Information Technology",
            date: "January 10, 2025",
            image: "/images/mst24lesson1-towfiqu-barbhuiya-oZuBNC-6E2s-unsplash.webp",
            link: "/blogs/mst24lesson1-understandingIT",
            description: "Gain a solid foundation in Information Technology (IT). Explore core concepts, IT infrastructure, networking, cybersecurity, and the impact of IT in business, education, and society. Learn how IT drives innovation and digital transformation."
        },        
        {
            id: "mst24lesson2",
            title: "History of Computers: From Abacus to AI",
            date: "January 8, 2025",
            image: "/images/mst24-lesson2/intro.png",
            link: "/blogs/mst24lesson2-historyofcomputers",
            description: "Explore the evolution of computing, from ancient counting tools like the abacus to modern artificial intelligence. Discover key milestones, visionary pioneers like Charles Babbage and Alan Turing, and the impact of computing on today's digital world."
        },
        {
            id: "it114lesson6",
            title: "Data Structures in Python",
            date: "January 27, 2025",
            image: "/images/it114-lesson6-python-data-structures.webp",
            link: "/blogs/it114-lesson6-datastructures",
            description: "Dive into Python data structures like lists, tuples, sets, and dictionaries. Learn their characteristics, practical use cases, and actionable tips to write efficient, scalable, and maintainable code. Master the foundations for smarter programming."
        },    
        {
            id: "mst24lesson6",
            title: "Cybersecurity",
            date: "January 26, 2025",
            image: "/images/mst24lesson6-cybersecurity.webp",
            link: "/blogs/mst24lesson6-cybersecurity",
            description: "Learn key cybersecurity practices, understand common threats, and discover actionable strategies to protect your digital footprint. This article explores the evolution of cybersecurity, its critical importance, and how to stay safe in an ever-connected world."
        },        
        {
            id: "it114lesson4",
            title: "Python Conditional Statements",
            date: "January 23, 2025",
            image: "/images/it114-lesson4-conditional-statements.webp",
            link: "/blogs/it114-lesson4-conditional-statements",
            description: "Learn Python conditional statements with if, elif, else, and nested logic. Write smarter, dynamic code with practical examples and actionable tips for better decision-making in your programs."
        },
        {
            id: "mst24lesson5",
            title: "The Internet and the World Wide Web",
            date: "January 23, 2025",
            image: "/images/mst24-lesson5-leon-seibert-2m71l9fA6mg-unsplash.webp",
            link: "/blogs/mst24lesson5-internet-twww",
            description: "Explore the Internet and the World Wide Web: their history, infrastructure, and tools like web browsers and search engines. Learn how these technologies shape modern life and discover actionable insights to improve your online interactions."
        },        
        {
            id: "blog19",
            title: "Put First Things First",
            date: "January 23, 2025",
            image: "/images/blog19ch_pski-bylXfUFJylU-unsplash.webp",
            link: "/blogs/scp3-put-first-things-first",
            description: "Learn actionable strategies from Stephen R. Covey’s Habit 3 to prioritise your Big Rocks, manage your time effectively, and align daily actions with your personal mission."
        },
        {
            id: "blog18",
            title: "Essential Guide to Computer Hardware",
            date: "January 22, 2025",
            image: "/images/blog17nathan-anderson-xV3CHzfhkjE-unsplash.webp",
            link: "/blogs/mst24lesson3-hardwarecomponents",
            description: "Discover the basics of computer hardware, including CPUs, motherboards, storage devices, and expert troubleshooting tips."
        },         
        {
            id: "blog17",
            title: "While Looping Statement",
            date: "January 22, 2025",
            image: "/images/blog17lucas-hein-3tgwzKpxHa4-unsplash.webp",
            link: "/blogs/it114-lesson5-while-looping-statement",
            description: "Learn Python while looping statements with clear examples, practical tips, and expert insights to improve your coding skills."
        },  
        {
            id: "blog16",
            title: "Computer Software",
            date: "January 21, 2025",
            image: "/images/blog16software-behind-every-click.webp",
            link: "/blogs/mst24lesson4-software-behind-every-click",
            description: "Discover software's role, types, and functions shaping our world. Explore operating systems, applications, and tools driving innovation."
        },  
        {
            id: "blog15",
            title: "5G vs 6G",
            date: "January 18, 2025",
            image: "/images/blog15-5g-vs-6g.webp",
            link: "/blogs/5G-vs-6G",
            description: "Discover the key differences between 5G and 6G, their transformative applications, and how businesses can prepare for the next wave of wireless connectivity."
        },        
        {   
            id: "blog1",
            title: "Technology in Education",
            date: "December 1, 2024",
            image: "/images/blog1.webp",
            link: "/blogs/role-of-technology-in-education",
            description: "Learn how technology is shaping the way educators and students interact in today's classrooms."
        },
        {
            id: "effective-study-techniques",
            title: "Effective Study Techniques",
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
            title: "Why Should We Attend Seminars and Conferences",
            date: "December 2, 2024",
            image: "/images/blog4.webp",
            link: "/blogs/blog4",
            description: "Discover the benefits of seminars and conferences: networking, fresh perspectives, and staying updated on trends."
        },
        {
            id: "blog5",
            title: "What to Do During Semestral Breaks",
            date: "December 5, 2024",
            image: "/images/blog5.webp",
            link: "/blogs/blog5",
            description: "Maximise your semestral break with tips for rest, skill development, and exciting activities."
        },
        {
            id: "blog6",
            title: "Baguio Smart City Challenge",
            date: "December 11, 2024",
            image: "/images/blog6.webp",
            link: "/blogs/blog6",
            description: "Explore the projects, lessons, and insights from this transformative experience."
        },
        {
            id: "blog7",
            title: "10 Things I Wish I Knew Before Entering IT",
            date: "December 30, 2024",
            image: "/images/blog7.webp",
            link: "/blogs/blog7",
            description: "Discover the essential lessons to thrive in IT, from mastering problem-solving and debugging to embracing perseverance and practical skills. Avoid common regrets and excel in your IT career with these expert tips."
        },
        {
            id: "blog8",
            title: "Be Proactive",
            date: "January 2, 2025", 
            image: "/images/blog8.webp",
            link: "/blogs/blog8",
            description: "Discover how to build positive habits and unlock your potential for success. Learn practical strategies to overcome challenges, achieve goals, and foster personal growth on your journey to self-improvement."
        },
        {
            id: "blog9",
            title: "Beginner's Guide to USB-A, USB-B, and USB-C",
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
            title: "Master Time Management",
            date: "January 15, 2025", 
            image: "/images/blog12-djim-loic-ft0-Xu4nTvA-unsplash.webp",
            link: "/blogs/master-time-management",
            description: "Discover practical time management methods, including the Eisenhower Matrix, time-blocking, and the Pomodoro technique. Transform your productivity with actionable strategies inspired by The 7 Habits of Highly Effective People."
        },
        {
            id: "blog13",
            title: "Beginning With the End in Mind",
            date: "January 16, 2025", 
            image: "/images/blog13joshua-hoehne-Nsaqv7v2V7Q-unsplash.webp",
            link: "/blogs/scp2-beginning-with-the-end-in-mind",
            description: "Discover practical time management methods, including the Eisenhower Matrix, time-blocking, and the Pomodoro technique. Transform your productivity with actionable strategies inspired by The 7 Habits of Highly Effective People."
        },
        {
            id: "blog14",
            title: "Brands That Failed to Innovate and Disappeared",
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
