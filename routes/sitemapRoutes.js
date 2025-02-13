// routes/sitemapRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Reads the file `public/js/blogs.js`, extracts the array assigned
 * to `const blogPool = [ ... ];`, converts it to valid JSON,
 * and returns it as a JavaScript array of blog objects.
 *
 * WARNING: This approach is naive. If your blogs.js changes format
 * or includes advanced code inside the array, you may need a more
 * robust parser or store your data in a JSON/DB instead.
 */
function getBlogsFromBlogsJS() {
  // 1) Construct the file path
  const filePath = path.join(__dirname, '..', 'public', 'js', 'blogs.js');
  console.log(`[sitemapRoutes] Reading file from: ${filePath}`);

  // 2) Read file content
  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('[sitemapRoutes] Error reading blogs.js:', err);
    return [];
  }
  console.log(`[sitemapRoutes] Successfully read file. Content length: ${fileContent.length} chars`);

  // 3) Use regex to find: const blogPool = [ ... ];
  const regex = /const\s+blogPool\s*=\s*(\[[\s\S]*?\]);/;
  const match = fileContent.match(regex);
  if (!match) {
    console.warn('[sitemapRoutes] Regex did not match `const blogPool = [ ... ];`. Returning empty array.');
    return [];
  }

  // match[1] is the "[ ... ]" part
  let arrayString = match[1].trim();
  console.log('[sitemapRoutes] Matched blogPool array substring. Length:', arrayString.length);

  // 4) Convert that substring to valid JSON:
  //    a) Wrap unquoted keys in double quotes
  //    b) Convert single quotes to double quotes
  // (Naive approach - can fail if your data has advanced quotes)
  arrayString = arrayString.replace(/(\w+)\s*:/g, '"$1":');
  arrayString = arrayString.replace(/'/g, '"');

  // 5) Try to parse as JSON
  try {
    const parsedData = JSON.parse(arrayString);
    console.log(`[sitemapRoutes] Parsed blogPool successfully. Found ${parsedData.length} blog entries.`);
    return parsedData;
  } catch (err) {
    console.error('[sitemapRoutes] JSON parse error:', err);
    return [];
  }
}

// GET /sitemap.xml - Generate and return the sitemap
router.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://www.hellograde.online';

  // 1) Define any static pages you want in your sitemap
  const staticUrls = [
    { loc: '/',               priority: 1.0 },
    { loc: '/index',          priority: 0.8 },
    { loc: '/login',          priority: 0.8 },
    { loc: '/search',         priority: 0.6 },
    { loc: '/contact',        priority: 0.5 },
    { loc: '/about',          priority: 0.5 },
    { loc: '/help',           priority: 0.5 },
    { loc: '/privacy-policy', priority: 0.3 },
    { loc: '/terms-and-conditions', priority: 0.3 },
    // etc. Add more if needed
  ];

  // 2) Load blog data from blogs.js
  let blogList = [];
  try {
    blogList = getBlogsFromBlogsJS();
  } catch (err) {
    console.error('[sitemapRoutes] Caught error retrieving blogList:', err);
    blogList = [];
  }

  // 3) Build an array of blog URLs
  //    You can parse 'blog.date' if you want <lastmod>; here we just set them all to now
  const blogUrls = blogList.map((blog) => ({
    loc: blog.link,  // e.g. "/blogs/promptengineering"
    priority: 0.64,  // you choose
  }));

  // 4) Combine static + dynamic
  const allUrls = [...staticUrls, ...blogUrls];

  // 5) Create the sitemap XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>\n`;
  xml += `<!--  Generated from blogs.js + static urls  -->\n\n`;

  // We'll set <lastmod> to the current date/time for simplicity
  const now = new Date();
  const isoDate = now.toISOString().replace('Z', '+00:00');

  for (const urlObj of allUrls) {
    const loc      = urlObj.loc      || '/';
    const priority = urlObj.priority || 0.5;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${loc}</loc>\n`;
    xml += `    <lastmod>${isoDate}</lastmod>\n`;
    xml += `    <priority>${priority.toFixed(2)}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  // 6) Send as XML
  res.setHeader('Content-Type', 'application/xml');
  console.log('[sitemapRoutes] Returning sitemap with', allUrls.length, 'URLs.');
  res.send(xml);
});

module.exports = router;
