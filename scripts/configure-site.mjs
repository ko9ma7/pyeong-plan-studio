import { readFile, writeFile } from 'node:fs/promises';

const rawUrl = process.argv[2];
const repositoryUrl = process.argv[3] || '';
if (!rawUrl) {
  console.error('Usage: node scripts/configure-site.mjs <site-url> [repository-url]');
  process.exit(1);
}

const siteUrl = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;
const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');
html = html.replace(/<link rel="canonical" href="[^"]*" data-bootstrap-url \/>/, `<link rel="canonical" href="${siteUrl}" data-bootstrap-url />`);
html = html.replace(/<meta property="og:url" content="[^"]*" data-bootstrap-url \/>/, `<meta property="og:url" content="${siteUrl}" data-bootstrap-url />`);
await writeFile(indexUrl, html);

const publicDir = new URL('../public/', import.meta.url);
await writeFile(new URL('robots.txt', publicDir), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
await writeFile(new URL('sitemap.xml', publicDir), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`);

console.log(`Configured site URL: ${siteUrl}`);
if (repositoryUrl) console.log(`Repository: ${repositoryUrl}`);
