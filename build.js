const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const ROOT    = __dirname;
const SHARED  = path.join(ROOT, '_shared');
const CONTENT = path.join(ROOT, 'content/blog');
const OUT     = path.join(ROOT, 'blog');
const SITE    = 'https://bajacurated.com';

// Load shared assets once
const CSS    = fs.readFileSync(path.join(SHARED, 'site.css'),    'utf8');
const JS     = fs.readFileSync(path.join(SHARED, 'site.js'),     'utf8');
const LOGO   = fs.readFileSync(path.join(SHARED, 'logo.txt'),    'utf8').trim();
const FOOTER = fs.readFileSync(path.join(SHARED, 'footer.html'), 'utf8');
const MODALS = fs.readFileSync(path.join(SHARED, 'modals.html'), 'utf8');

const TOUR_MAP = {
  'desert-intro-3h':       'Desert Intro 3H',
  'el-zorro-14':           'El Zorro 14',
  'explorer-6h':           'Explorer 6H',
  'cabo-pulmo-expedition': 'Cabo Pulmo Expedition',
  'challenger-10h':        'Challenger 10H',
  'extreme-16h':           'Extreme 16H',
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-MX', {year:'numeric',month:'long',day:'numeric'});
}

function nav(activeBlog) {
  return `<nav>
  <a href="/" class="nav-left">
    <img src="${LOGO}" alt="Baja Curated" style="height:80px;width:auto;display:block;">
    <img src="https://i.imgur.com/GlHNHM9.png" alt="Can-Am BRP" style="height:36px;width:auto;display:block;">
  </a>
  <ul class="nav-links">
    <li><a href="/#tours">Tours</a></li>
    <li><a href="/blog/" ${activeBlog ? 'style="color:var(--yellow);"' : ''}>Blog</a></li>
    <li><a href="/#why">Why Us</a></li>
    <li><a href="/#faq">FAQ</a></li>
    <li class="lang-wrap">
      <button class="lang-btn active" onclick="setLang('en',event)">EN</button>
      <button class="lang-btn" onclick="setLang('es',event)">ES</button>
    </li>
    <li><a href="/#book" class="nav-cta">Book Now</a></li>
  </ul>
</nav>`;
}

function readPosts() {
  if (!fs.existsSync(CONTENT)) return [];
  return fs.readdirSync(CONTENT)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const {data, content} = matter(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
      const slug = file.replace(/\.md$/, '');
      const html = marked.parse(content);
      const words = content.split(/\s+/).length;
      return { ...data, slug, html, readingTime: Math.max(1, Math.round(words / 200)) };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

const BLOG_CSS = `
.blog-hero{position:relative;min-height:52vh;display:flex;align-items:flex-end;padding:80px 48px 52px;background-size:cover;background-position:center;overflow:hidden;}
.blog-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.93) 0%,rgba(0,0,0,0.4) 55%,rgba(0,0,0,0.1) 100%);pointer-events:none;}
.blog-hero-content{position:relative;z-index:2;max-width:780px;}
.blog-hero-meta{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:18px;font-size:0.76rem;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);}
.blog-hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.6rem,6vw,5rem);line-height:0.97;color:#fff;margin:0;}
.blog-tag{display:inline-block;background:var(--yellow);color:#000;font-size:0.6rem;font-weight:700;letter-spacing:2px;padding:3px 8px;text-transform:uppercase;margin-right:5px;margin-bottom:4px;}
.blog-body-wrap{max-width:720px;margin:0 auto;padding:64px 48px;}
.blog-body{font-size:1.05rem;line-height:1.85;color:var(--lgray);}
.blog-body h2{font-family:'Bebas Neue',sans-serif;font-size:2.2rem;color:#fff;margin:2em 0 0.5em;}
.blog-body h3{font-family:'Bebas Neue',sans-serif;font-size:1.55rem;color:var(--yellow);margin:1.6em 0 0.4em;}
.blog-body p{margin-bottom:1.4em;}
.blog-body ul,.blog-body ol{padding-left:1.5em;margin-bottom:1.4em;}
.blog-body li{margin-bottom:0.45em;}
.blog-body strong{color:#fff;font-weight:600;}
.blog-body em{color:rgba(255,255,255,0.7);}
.blog-body a{color:var(--yellow);}
.blog-body img{width:100%;height:auto;margin:2em 0;display:block;}
.blog-body blockquote{border-left:3px solid var(--yellow);padding:0 0 0 20px;margin:2em 0;font-style:italic;color:rgba(255,255,255,0.55);}
.blog-body hr{border:none;border-top:1px solid var(--gray);margin:3em 0;}
.blog-tags-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid var(--gray);}
.blog-tour-cta{background:var(--mid);padding:36px;margin:48px 0;display:flex;flex-direction:column;gap:14px;align-items:flex-start;}
.blog-tour-cta h3{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#fff;margin:0;}
.btn-yellow{display:inline-block;background:var(--yellow);color:#000;font-weight:700;font-size:0.78rem;letter-spacing:2px;padding:12px 26px;text-decoration:none;text-transform:uppercase;}
.blog-header{background:var(--black);padding:140px 48px 64px;}
.blog-header h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(4rem,10vw,8rem);line-height:0.9;color:#fff;margin:14px 0 0;}
.blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--dark);padding:2px;}
.blog-card{background:var(--black);overflow:hidden;}
.blog-card-inner{display:block;text-decoration:none;color:inherit;}
.blog-card-img{height:210px;background-size:cover;background-position:center;transition:transform .4s;}
.blog-card:hover .blog-card-img{transform:scale(1.04);}
.blog-card-body{padding:26px;}
.blog-card-meta{font-size:0.7rem;letter-spacing:1px;text-transform:uppercase;color:var(--lgray);margin-bottom:8px;}
.blog-card-title{font-family:'Bebas Neue',sans-serif;font-size:1.55rem;color:#fff;line-height:1.1;margin:0 0 10px;}
.blog-card-excerpt{font-size:0.85rem;color:var(--lgray);line-height:1.6;margin-bottom:14px;}
.blog-card-cta{font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:var(--yellow);font-weight:700;}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.related-card{text-decoration:none;color:inherit;border:1px solid rgba(255,255,255,0.1);transition:border-color .2s;}
.related-card:hover{border-color:var(--yellow);}
.related-card-img{height:140px;background-size:cover;background-position:center;}
.related-card-body{padding:14px;}
.related-card-title{font-weight:600;font-size:0.85rem;color:#fff;line-height:1.35;margin-bottom:4px;}
.related-card-date{font-size:0.7rem;color:var(--lgray);}
.back-link{display:inline-flex;align-items:center;gap:6px;color:var(--yellow);font-size:0.72rem;letter-spacing:2px;text-decoration:none;text-transform:uppercase;margin-bottom:24px;}
@media(max-width:900px){.blog-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:640px){
  .blog-grid{grid-template-columns:1fr;}
  .blog-hero{padding:80px 20px 36px;}
  .blog-body-wrap{padding:48px 20px;}
  .blog-header{padding:120px 20px 48px;}
  .related-grid{grid-template-columns:1fr;}
}`;

function buildPost(post, allPosts) {
  const tags  = (post.tags||[]).map(t=>`<span class="blog-tag">${t}</span>`).join('');
  const tour  = post.related_tour ? `
  <div class="blog-tour-cta">
    <div class="eyebrow">Experiencia relacionada</div>
    <h3>${TOUR_MAP[post.related_tour]||post.related_tour}</h3>
    <a href="/tours/${post.related_tour}.html" class="btn-yellow">Ver experiencia →</a>
  </div>` : '';

  const others = allPosts.filter(p=>p.slug!==post.slug).slice(0,3);
  const related = others.length ? `
  <section style="background:var(--dark);padding:56px 48px;">
    <div class="eyebrow">Más artículos</div>
    <h3 style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:#fff;margin:8px 0 24px;">SEGUIR LEYENDO</h3>
    <div class="related-grid">
      ${others.map(p=>`
      <a href="/blog/${p.slug}/" class="related-card">
        <div class="related-card-img" style="background:${p.featured_image?`url('${p.featured_image}') center/cover`:'#1a1a1a'}"></div>
        <div class="related-card-body"><div class="related-card-title">${p.title}</div><div class="related-card-date">${fmtDate(p.date)}</div></div>
      </a>`).join('')}
    </div>
  </section>` : '';

  const heroBg = post.featured_image
    ? `background-image:url('${post.featured_image}');background-color:#0a0a0a;`
    : `background-color:#0a0a0a;`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${post.title} | Baja Curated Blog</title>
<meta name="description" content="${post.meta_description||''}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${SITE}/blog/${post.slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.meta_description||''}">
<meta property="og:url" content="${SITE}/blog/${post.slug}/">
${post.featured_image?`<meta property="og:image" content="${SITE}${post.featured_image}">`:''}
<meta property="article:published_time" content="${post.date}">
<link rel="icon" href="/favicon.ico">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap" rel="stylesheet">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(post.title)},"description":${JSON.stringify(post.meta_description||'')},"datePublished":"${post.date}","author":{"@type":"Organization","name":"${post.author||'Baja Curated'}"},"publisher":{"@type":"Organization","name":"Baja Curated","url":"${SITE}"},"url":"${SITE}/blog/${post.slug}/"${post.featured_image?`,"image":"${SITE}${post.featured_image}"`:''}}</script>
<style>${CSS}${BLOG_CSS}</style>
</head>
<body>
${nav(true)}
<section class="blog-hero" style="${heroBg}">
  <div class="blog-hero-content">
    <a href="/blog/" class="back-link">← Blog</a>
    <div class="blog-hero-meta">
      <span>${fmtDate(post.date)}</span><span>·</span>
      <span>${post.readingTime} min de lectura</span><span>·</span>
      <span>${post.author||'Baja Curated'}</span>
    </div>
    <h1>${post.title}</h1>
  </div>
</section>
<div style="background:var(--black);">
  <div class="blog-body-wrap">
    ${tags?`<div class="blog-tags-row">${tags}</div>`:''}
    <article class="blog-body">${post.html}</article>
    ${tour}
  </div>
</div>
${related}
${FOOTER}
${MODALS}
<script>${JS}</script>
</body>
</html>`;
}

function buildIndex(posts) {
  const cards = posts.map(p=>`
  <article class="blog-card reveal">
    <a href="/blog/${p.slug}/" class="blog-card-inner">
      <div class="blog-card-img" style="background:${p.featured_image?`url('${p.featured_image}') center/cover`:'#1a1a1a'}"></div>
      <div class="blog-card-body">
        <div class="blog-card-meta">${fmtDate(p.date)} · ${p.readingTime} min</div>
        <h2 class="blog-card-title">${p.title}</h2>
        <p class="blog-card-excerpt">${p.meta_description||''}</p>
        <div style="margin-bottom:12px;">${(p.tags||[]).map(t=>`<span class="blog-tag">${t}</span>`).join('')}</div>
        <span class="blog-card-cta">Leer artículo →</span>
      </div>
    </a>
  </article>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Blog — Off-road, Baja California & Can-Am | Baja Curated</title>
<meta name="description" content="Guías, rutas y experiencias de off-road en Baja California Sur. Todo sobre Can-Am, Cabo Pulmo y la Baja real.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${SITE}/blog/">
<meta property="og:title" content="Blog — Baja Curated">
<meta property="og:description" content="Guías, rutas y experiencias de off-road en Baja California Sur.">
<meta property="og:url" content="${SITE}/blog/">
<link rel="icon" href="/favicon.ico">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap" rel="stylesheet">
<style>${CSS}${BLOG_CSS}</style>
</head>
<body>
${nav(true)}
<header class="blog-header">
  <div class="eyebrow">Baja Curated</div>
  <h1>BAJA,<br>RAW &amp;<br>REAL.</h1>
</header>
<main>
  ${posts.length?`<div class="blog-grid">${cards}</div>`:`<div style="padding:100px 48px;text-align:center;color:var(--lgray);"><p>Próximamente — primeros artículos en camino.</p></div>`}
</main>
${FOOTER}
${MODALS}
<script>${JS}</script>
</body>
</html>`;
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log('Building blog...');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, {recursive:true});

// Copy uploads
const uploadsIn  = path.join(ROOT, 'static/uploads');
const uploadsOut = path.join(ROOT, 'uploads');
if (fs.existsSync(uploadsIn) && fs.readdirSync(uploadsIn).length) {
  if (!fs.existsSync(uploadsOut)) fs.mkdirSync(uploadsOut);
  fs.readdirSync(uploadsIn).forEach(f =>
    fs.copyFileSync(path.join(uploadsIn, f), path.join(uploadsOut, f)));
}

const posts = readPosts();
console.log(`  ${posts.length} post(s) found`);

posts.forEach(p => {
  const dir = path.join(OUT, p.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'index.html'), buildPost(p, posts));
  console.log(`  ✓ /blog/${p.slug}/`);
});

fs.writeFileSync(path.join(OUT, 'index.html'), buildIndex(posts));
console.log(`  ✓ /blog/`);
console.log(`Done — ${posts.length} post(s) built.`);
