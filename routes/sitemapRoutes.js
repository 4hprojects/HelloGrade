// routes/sitemapRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Reads 'public/js/blogs.js', extracts the array assigned to `blogPool`, 
 * and returns it as a proper JavaScript array.
 * 
 * WARNING: This is a naive parsing approach. For complex or changing code 
 * in `blogs.js`, a more robust solution (or separate JSON) is recommended.
 */
function getBlogsFromBlogsJS() {
  // 1) Read the file
  const filePath = path.join(__dirname, '..', 'public', 'js', 'blogs.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 2) Use a RegExp to find:  `const blogPool = [ ... ];`
  const regex = /const\s+blogPool\s*=\s*(\[[\s\S]*?\]);/;
  const match = fileContent.match(regex);
  if (!match) {
    // If we can't find the array, return empty
    return [];
  }

  // `match[1]` should be the string version of the array, e.g. "[ { id: ..., }, ... ]"
  let arrayString = match[1].trim(); // remove trailing semicolon, etc.

  // 3) Convert that arrayString into valid JSON so we can JSON.parse it.
  //    - Wrap unquoted object keys in double quotes
  //    - Change any single quotes '...' to "..."
  //    - This might fail if your blog data has funky formatting or quotes inside strings.
  //      Adjust as necessary for your actual data.

  // Wrap unquoted keys: (e.g. id: => "id":
  arrayString = arrayString.replace(/(\w+)\s*:/g, '"$1":');
  // Convert single quotes to double quotes
  arrayString = arrayString.replace(/'/g, '"');

  // 4) Parse as JSON
  const blogData = JSON.parse(arrayString);
  return blogData;
}

/**
 * Route for generating sitemap.xml with both:
 *  - Some "static" routes
 *  - The dynamic blog routes from `blogs.js`
 */
router.get('/sitemap.xml', (req, res) => {
  // 1) Base domain for generating full URLs
  const baseUrl = 'https://hellograde.online';

  // 2) Static URLs you want in your sitemap
  const staticUrls = [
    { loc: '/',                   changefreq: 'daily',   priority: 1.0  },
    { loc: '/index',              changefreq: 'daily',   priority: 1.0  },
    { loc: '/blogs',              changefreq: 'daily',   priority: 1.0  },
    { loc: '/login',              changefreq: 'daily',   priority: 0.8  },
    { loc: '/search',             changefreq: 'weekly',  priority: 0.6  },
    { loc: '/contact',            changefreq: 'monthly', priority: 0.5  },
    { loc: '/about',              changefreq: 'monthly', priority: 0.5  },
    { loc: '/help',               changefreq: 'monthly', priority: 0.5  },
    { loc: '/privacy-policy',     changefreq: 'yearly',  priority: 0.3  },
    { loc: '/terms-and-conditions', changefreq: 'yearly', priority: 0.3 }
    // Add others as you like
  ];

  // 3) Get the blog array from blogs.js
  let blogList = [];
  try {
    blogList = getBlogsFromBlogsJS();
  } catch (err) {
    console.error('Failed to parse blogs.js:', err);
    // fallback to empty
    blogList = [];
  }

  // 4) Generate blog entries for the sitemap
  const dynamicUrls = blogList.map(blog => ({
    loc: blog.link,         // e.g. "/blogs/promptengineering"
    changefreq: 'weekly',   // or "daily", up to you
    priority: 0.8           // up to you
  }));

  // 5) Combine both sets
  const allUrls = [...staticUrls, ...dynamicUrls];

  // 6) Build the XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const urlObj of allUrls) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${urlObj.loc}</loc>\n`;
    xml += `    <changefreq>${urlObj.changefreq}</changefreq>\n`;
    xml += `    <priority>${urlObj.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  // 7) Return as XML
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

module.exports = router;
