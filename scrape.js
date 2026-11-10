// Scrapes titles and prices of Young Adult (teen) books from books.toscrape.com
// and top-selling family-friendly video games from the Steam store, prints the
// five cheapest of each, and writes index.html.
const fs = require("fs");
const path = require("path");

const BASE = "https://books.toscrape.com/catalogue/category/books/young-adult_21/";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function scrapePage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();

  const books = [];
  for (const pod of html.split('<article class="product_pod">').slice(1)) {
    const title = pod.match(/<h3><a [^>]*title="([^"]*)"/);
    const price = pod.match(/<p class="price_color">[^\d]*([\d.]+)<\/p>/);
    if (title && price) books.push({ title: decode(title[1]), price: parseFloat(price[1]) });
  }
  const hasNext = /<li class="next">/.test(html);
  return { books, hasNext };
}

async function scrapeAll() {
  const all = [];
  for (let page = 1; ; page++) {
    const url = BASE + (page === 1 ? "index.html" : `page-${page}.html`);
    const { books, hasNext } = await scrapePage(url);
    all.push(...books);
    if (!hasNext) break;
  }
  return all;
}

const STEAM_URL =
  "https://store.steampowered.com/search/results/?query&start=0&count=100&filter=topsellers" +
  "&category1=998&tags=5350&cc=us&l=english&infinite=1";
// Steam content descriptors for adult-only / sexual / mature content (not teen-appropriate)
const ADULT_DESCRIPTORS = new Set([3, 4, 5]);

async function scrapeGames() {
  const res = await fetch(STEAM_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for Steam search`);
  const { results_html: html } = await res.json();

  const games = [];
  for (const row of html.split('class="search_result_row').slice(1)) {
    const title = row.match(/<span class="title">([^<]*)<\/span>/);
    if (!title) continue;
    const descriptors = JSON.parse((row.match(/data-ds-descids="([^"]*)"/) || [, "[]"])[1]);
    if (descriptors.some((d) => ADULT_DESCRIPTORS.has(d))) continue;
    const cents = row.match(/data-price-final="(\d+)"/);
    games.push({
      title: decode(title[1]).trim(),
      price: cents ? parseInt(cents[1], 10) / 100 : 0,
    });
  }
  return games;
}

const byPrice = (a, b) => a.price - b.price || a.title.localeCompare(b.title);

function buildHtml({ books, cheapestBooks, games, cheapestGames }) {
  const section = (cls, heading, items, symbol) => `    <section${cls ? ` class="${cls}"` : ""}>
      <h2>${heading}</h2>
      <table>
        <thead><tr><th>#</th><th>Title</th><th>Price</th></tr></thead>
        <tbody>
${items
  .map(
    (b, i) =>
      `        <tr><td>${i + 1}</td><td>${escapeHtml(b.title)}</td><td class="price">${
        b.price === 0 ? "Free" : symbol + b.price.toFixed(2)
      }</td></tr>`
  )
  .join("\n")}
        </tbody>
      </table>
    </section>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Best Books &amp; Video Games for Teenagers – Cheapest Picks</title>
  <style>
    :root { --bg: #0b0720; --text: #eaeaff; --muted: #a9a4d6; }
    .books { --accent: #00e5ff; --accent2: #ff2bd6; }
    .games { --accent: #39ff14; --accent2: #ffb800; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif; color: var(--text); margin: 0; padding: 2rem 1rem;
      background: radial-gradient(circle at 15% 0%, #3a0ca3 0%, transparent 45%),
                  radial-gradient(circle at 90% 20%, #f72585 0%, transparent 40%),
                  radial-gradient(circle at 50% 100%, #0077b6 0%, transparent 50%), var(--bg);
      background-attachment: fixed;
    }
    main { max-width: 800px; margin: 0 auto; }
    h1 {
      margin-bottom: .25rem; font-size: 2.2rem; text-align: center;
      background: linear-gradient(90deg, #00e5ff, #ff2bd6, #39ff14, #ffb800);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      filter: drop-shadow(0 0 12px rgba(255,43,214,.6));
    }
    h2 { color: var(--accent); text-shadow: 0 0 8px var(--accent), 0 0 20px var(--accent); }
    .sub { color: var(--muted); margin-top: 0; }
    a { color: var(--accent2, #00e5ff); text-shadow: 0 0 6px currentColor; }
    section {
      background: rgba(18, 12, 50, .75); border: 1px solid var(--accent); border-radius: 14px;
      padding: 1rem 1.5rem; margin: 1.5rem 0;
      box-shadow: 0 0 10px var(--accent), 0 0 30px rgba(255,255,255,.08), inset 0 0 18px rgba(255,255,255,.05);
    }
    section.top5 { border-color: var(--accent2); box-shadow: 0 0 14px var(--accent2), 0 0 40px var(--accent2), inset 0 0 18px rgba(255,255,255,.05); }
    section.top5 h2 { color: var(--accent2); text-shadow: 0 0 8px var(--accent2), 0 0 20px var(--accent2); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid rgba(255,255,255,.1); }
    th { color: var(--accent); text-transform: uppercase; font-size: .8rem; letter-spacing: .08em; }
    tbody tr:hover { background: rgba(255,255,255,.08); }
    .price { text-align: right; font-weight: 700; white-space: nowrap; color: var(--accent); text-shadow: 0 0 8px var(--accent); }
    th:last-child { text-align: right; }
    .top5 tr:first-child td { color: #fff; text-shadow: 0 0 10px var(--accent2); }
    .top5 tr:first-child .price { color: var(--accent2); }
    nav { margin: 1rem 0; text-align: center; }
    nav a {
      display: inline-block; margin: 0 .5rem; padding: .4rem 1.2rem; border-radius: 999px; text-decoration: none;
      border: 1px solid currentColor; font-weight: 600; box-shadow: 0 0 12px currentColor, inset 0 0 8px rgba(255,255,255,.15);
    }
    nav a:hover { background: rgba(255,255,255,.12); }
    footer { color: var(--muted); font-size: .85rem; text-align: center; }
  </style>
</head>
<body>
  <main>
    <h1>Best Books &amp; Video Games for Teenagers</h1>
    <p class="sub" style="text-align:center">Scraped on ${new Date().toLocaleDateString("en-US")}</p>
    <nav><a href="#books" style="color:#00e5ff">Books</a><a href="#games" style="color:#39ff14">Video Games</a></nav>

    <div class="books">
    <h2 id="books">Books</h2>
    <p class="sub">Young Adult titles from <a href="https://books.toscrape.com">books.toscrape.com</a> (prices in GBP)</p>
${section("top5", "5 Cheapest Books", cheapestBooks, "£")}
${section("", `All ${books.length} Books`, books, "£")}
    </div>

    <div class="games">
    <h2 id="games">Video Games</h2>
    <p class="sub">Top-selling Family Friendly games from the <a href="https://store.steampowered.com">Steam store</a>, adult-content titles removed (prices in USD; free games excluded from the cheapest list)</p>
${section("top5", "5 Cheapest Video Games", cheapestGames, "$")}
${section("", `All ${games.length} Video Games`, games, "$")}
    </div>
    <footer>Generated by scrape.js</footer>
  </main>
</body>
</html>
`;
}

(async () => {
  const books = (await scrapeAll()).sort(byPrice);
  const games = (await scrapeGames()).sort(byPrice);
  const cheapestBooks = books.slice(0, 5);
  const cheapestGames = games.filter((g) => g.price > 0).slice(0, 5);

  console.log(`Scraped ${books.length} books.\n`);
  console.log("Five cheapest books:");
  cheapestBooks.forEach((b, i) => console.log(`${i + 1}. ${b.title} - £${b.price.toFixed(2)}`));

  console.log(`\nScraped ${games.length} video games.\n`);
  console.log("Five cheapest video games (paid):");
  cheapestGames.forEach((g, i) => console.log(`${i + 1}. ${g.title} - $${g.price.toFixed(2)}`));

  const out = path.join(__dirname, "index.html");
  fs.writeFileSync(out, buildHtml({ books, cheapestBooks, games, cheapestGames }), "utf8");
  console.log(`\nWrote ${out}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
