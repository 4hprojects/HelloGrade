// routes/sitemapRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Reads the file `public/js/blogs.js`, extracts the array assigned
 * to `const blogPool = [ ... ];`, converts it to a usable array,
 * and returns it as a JavaScript array of objects.
 *
 * WARNING: This approach is naive. If `blogs.js` changes format
 * (e.g., multiline comments inside the array, advanced code),
 * you may need a more robust parser or store your data in JSON instead.
 */
function getBlogsFromBlogsJS() {
  // 1. Read the file content
  const filePath = path.join(__dirname, '..', 'public', 'js', 'blogs.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 2. Find the snippet that looks like: `const blogPool = [...];`
  const regex = /const\s+blogPool\s*=\s*(\[[\s\S]*?\]);/;
  const match = fileContent.match(regex);
  if (!match) {
    // If not found, return empty array
    return [];
  }

  // match[1] is the "[ ... ]" part
  let arrayString = match[1].trim();

  // 3. Convert that array substring into valid JSON so we can parse it:
  //    a) Wrap unquoted keys in double quotes
  //    b) Convert single quotes to double quotes
  //    (Naive approach—if your data has tricky quotes, you’ll need more robust logic)
  arrayString = arrayString.replace(/(\w+)\s*:/g, '"$1":'); // e.g. id: -> "id":
  arrayString = arrayString.replace(/'/g, '"');

  // 4. Parse the resulting string as JSON
  return JSON.parse(arrayString);
}

// GET /sitemap.xml
router.get('/sitemap.xml', (req, res) => {
  // 1. Base URL for building full links
  const baseUrl = 'https://www.hellograde.online';

  // 2. Optional static URLs you want in the sitemap
  const staticUrls = [
    // Add any non-blog pages you want to appear
    { loc: '/',               priority: 1.0 },
    { loc: '/index',          priority: 0.8 },
    { loc: '/login',          priority: 0.8 },
    { loc: '/search',         priority: 0.6 },
    { loc: '/contact',        priority: 0.5 },
    { loc: '/about',          priority: 0.5 },
    { loc: '/help',           priority: 0.5 },
    { loc: '/privacy-policy', priority: 0.3 },
    { loc: '/terms-and-conditions', priority: 0.3 },
    // etc.
  ];

  // 3. Parse the blogs array from `blogs.js`
  let blogList = [];
  try {
    blogList = getBlogsFromBlogsJS();
  } catch (err) {
    console.error('Error parsing blogs.js:', err);
    blogList = [];
  }

  // 4. Build dynamic URLs for each blog entry
  //    If you have a date in the blog for <lastmod>, parse that as well (optional).
  const blogUrls = blogList.map((blog) => ({
    loc: blog.link,       // e.g. "/blogs/promptengineering"
    priority: 0.64,       // up to you
    // Could parse blog.date to generate a <lastmod> if you want
  }));

  // 5. Combine static + dynamic
  const allUrls = [
    ...staticUrls,
    ...blogUrls
  ];

  // 6. Generate XML
  //    Example: create a typical sitemap header with schemas, then loop
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>\n`;
  xml += `<!-- Generated from blogs.js + static urls -->\n\n`;

  // For <lastmod>, you can set it to current date or parse the blog date
  const now = new Date();
  allUrls.forEach((urlObj) => {
    const loc = urlObj.loc || '/';
    const priority = urlObj.priority || 0.5;
    // optional date format
    const iso = now.toISOString().replace('Z', '+00:00');

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${loc}</loc>\n`;
    xml += `    <lastmod>${iso}</lastmod>\n`;
    xml += `    <priority>${priority.toFixed(2)}</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

module.exports = router;
