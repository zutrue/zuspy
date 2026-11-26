// The look of ZuSpy's pages: white cards on a soft grey page, one blue (#246BFD), matte 3D icons, no gradients.
export const STYLES = `
:root{--blue:#246BFD;--blue-ink:#1550E0;--blue-soft:#EDF3FF;--blue-line:#D4E2FF;--ink:#0B1220;--ink-2:#334155;--muted:#667085;--faint:#98A2B3;--line:#E6E8EC;--bg:#F3F5F9;--card:#fff;--green:#0B8A5F;--green-soft:#E6F6EF;--amber-soft:#FFF6E5;--amber-ink:#8A4B08;--red:#D92D20;--red-soft:#FDECEA;--star:#F5A524;--shadow:0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.06);--shadow-lg:0 2px 4px rgba(16,24,40,.05),0 14px 36px rgba(16,24,40,.10);--r:18px}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:var(--blue-ink);text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
/* top bar */
.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;gap:18px;height:60px}
.brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:17px;letter-spacing:-.02em;color:var(--ink);flex:none}
.brand img{width:30px;height:30px}
.brand:hover{text-decoration:none}
.toc{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
.toc::-webkit-scrollbar{display:none}
.toc a{padding:8px 11px;border-radius:999px;color:var(--ink-2);font-weight:600;font-size:13.5px;white-space:nowrap}
.toc a:hover,.toc a.on{background:var(--blue-soft);color:var(--blue-ink);text-decoration:none}
.prog{position:absolute;left:0;right:0;bottom:-1px;height:2px}
.prog i{display:block;height:100%;width:0;background:var(--blue)}
.jump{display:none;margin-left:auto;border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 10px;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink-2);max-width:60vw}
/* hero */
.hero{background:#fff;border-bottom:1px solid var(--line)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center;padding-top:44px;padding-bottom:40px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--blue-ink);background:var(--blue-soft);border-radius:999px;padding:6px 12px}
h1{font-size:clamp(30px,4.4vw,52px);line-height:1.06;letter-spacing:-.035em;margin:16px 0 12px;font-weight:800}
.hero p.sub{font-size:17px;color:var(--ink-2);max-width:640px;margin:0}
.hero .facts{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.hero .facts span{background:#F5F7FA;border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:14px;color:var(--ink-2)}
.hero .facts b{color:var(--ink);font-weight:800}
.cluster{display:grid;grid-template-columns:76px 140px 76px;grid-template-rows:repeat(2,76px);gap:14px 22px;align-items:center;justify-items:center}
.cluster img{width:76px;height:76px;max-width:none;object-fit:contain}
.cluster img.big{grid-column:2;grid-row:1/3;width:140px;height:140px}
.cluster img:nth-child(1){grid-column:1;grid-row:1}.cluster img:nth-child(3){grid-column:3;grid-row:1}.cluster img:nth-child(4){grid-column:1;grid-row:2}.cluster img:nth-child(5){grid-column:3;grid-row:2}
.vs{display:flex;align-items:center;gap:12px;margin-top:20px}
.vs .lab{font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.vs .stack{display:flex;gap:8px}
.vs .stack a{border-radius:999px;transition:transform .15s ease}
.vs .stack .av{width:44px;height:44px;border-radius:999px;box-shadow:0 0 0 1px var(--line),0 2px 6px rgba(16,24,40,.08)}
.vs .stack .av img{border-radius:999px;padding:3px}
.vs .stack a:hover{transform:translateY(-3px);text-decoration:none}
/* layout */
main.wrap{padding-top:28px;padding-bottom:48px}
section{margin:0 0 44px;scroll-margin-top:80px}
.sec-head{display:flex;align-items:center;gap:14px;margin:0 0 6px}
.sec-head img{width:52px;height:52px;flex:none}
h2{font-size:26px;line-height:1.15;letter-spacing:-.025em;margin:0;font-weight:800}
.lead{color:var(--muted);margin:0 0 18px;max-width:820px}
.sec-head + .lead{margin-left:66px}
.card{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);padding:22px}
.grid{display:grid;gap:16px}
/* stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-bottom:28px}
.stat{display:flex;gap:14px;align-items:center}
.stat img{width:56px;height:56px;flex:none}
.stat .k{color:var(--muted);font-size:13px;font-weight:600}
.stat .v{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:2px 0}
.stat .n{color:var(--ink-2);font-size:13px;line-height:1.4}
/* the short version */
.verdict{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:28px;padding:28px}
.verdict .big{font-size:19px;line-height:1.55;color:var(--ink);margin:10px 0 14px;font-weight:500}
.verdict .ads-line{color:var(--ink-2);margin:0}
.verdict h3{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.moves{list-style:none;margin:0;padding:0;display:grid;gap:10px;counter-reset:m}
.moves li{counter-increment:m;display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:start;background:#F7F9FC;border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-weight:500}
.moves li::before{content:counter(m);display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:var(--blue);color:#fff;font-weight:800;font-size:14px}
.moves a{font-weight:600;white-space:nowrap}
/* filters */
.filters{position:sticky;top:61px;z-index:15;display:grid;gap:10px;background:rgba(255,255,255,.96);backdrop-filter:saturate(1.4) blur(10px);border-radius:18px;box-shadow:var(--shadow);padding:14px;margin:0 0 18px}
.f-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.f-row.who{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:2px 2px 4px;margin:0 -2px}
.f-row.who::-webkit-scrollbar{display:none}
.search{flex:1 1 280px;display:flex;align-items:center;gap:8px;background:#F2F4F7;border-radius:12px;padding:0 12px;color:var(--muted);border:1.5px solid transparent;transition:border-color .15s,background .15s}
.search:focus-within{background:#fff;border-color:var(--blue)}
.search svg{width:18px;height:18px;flex:none}
.search input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:14.5px;padding:10px 0;color:var(--ink);outline:none}
.seg{display:flex;flex-wrap:wrap;gap:4px;background:#F2F4F7;border-radius:12px;padding:4px}
.chip{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:var(--ink-2);border-radius:9px;padding:7px 11px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.chip b,.rpill b{font-size:11.5px;font-weight:800;color:var(--muted);background:rgba(16,24,40,.06);border-radius:999px;padding:1px 7px}
.chip:hover{color:var(--ink)}
.chip[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(16,24,40,.12)}
.chip[aria-pressed=true] b,.rpill[aria-pressed=true] b{background:var(--blue);color:#fff}
.rpill{display:inline-flex;align-items:center;gap:8px;flex:none;border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px 5px 6px;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink-2);cursor:pointer;max-width:260px;transition:border-color .15s,background .15s}
.rpill:first-child{padding-left:12px}
.rpill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rpill .av,.rpill .av img{border-radius:999px}
.rpill:hover{border-color:#C9D6F2}
.rpill[aria-pressed=true]{border-color:var(--blue);background:var(--blue-soft);color:var(--blue-ink)}
.tgl{position:relative;display:inline-flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--ink-2);cursor:pointer;user-select:none;white-space:nowrap}
.tgl input{position:absolute;opacity:0;pointer-events:none}
.tgl .sw{width:36px;height:21px;border-radius:999px;background:#D0D5DD;position:relative;transition:background .15s}
.tgl .sw::after{content:"";position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.2);transition:transform .15s}
.tgl input:checked + .sw{background:var(--green)}
.tgl input:checked + .sw::after{transform:translateX(15px)}
.tgl input:focus-visible + .sw{outline:2px solid var(--blue);outline-offset:2px}
.sort{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--muted)}
.sort select{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer}
.f-meta{display:flex;align-items:center;gap:14px;font-size:13.5px;font-weight:600;color:var(--muted);padding:0 2px}
.link{border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--blue-ink);cursor:pointer}
.link:hover{text-decoration:underline}
/* ad cards */
.ads{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.ad{background:#fff;border-radius:16px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;outline:none}
.ad:hover,.ad:focus-visible{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.ad[hidden]{display:none}
.ad .media{position:relative;aspect-ratio:1/1;background:#EEF1F5;overflow:hidden}
.ad .media img,.ad .media video{width:100%;height:100%;object-fit:cover;display:block}
.ad .media.shot{background:#fff;border-bottom:1px solid var(--line)}
.ad .media.shot img{object-fit:contain;object-position:top center;padding:46px 12px 12px}
.ad .media.words{display:flex;flex-direction:column;justify-content:center;gap:8px;padding:22px;background:#F7F9FC}
.ad .media.words .hl{font-size:17px;font-weight:700;color:var(--blue-ink);line-height:1.3}
.ad .media.words .tx{font-size:14px;color:var(--ink-2);-webkit-line-clamp:6}
.badges{position:absolute;inset:10px 10px auto 10px;display:flex;justify-content:space-between;gap:6px;pointer-events:none}
.badge{font-size:12px;font-weight:700;border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.94);color:var(--ink);box-shadow:0 1px 3px rgba(16,24,40,.15);white-space:nowrap}
.badge.proven{background:var(--green);color:#fff}
.badge.play{position:absolute;left:10px;bottom:10px;top:auto;display:inline-flex;align-items:center;gap:4px;background:rgba(11,18,32,.82);color:#fff}
.badge.play svg{width:12px;height:12px}
.ad-h{display:flex;align-items:center;gap:10px;padding:12px 14px}
.ad-who{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.ad-who .n{font-weight:700;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ad-who .s{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ad-who .pm{width:13px;height:13px}
.ad .body{padding:12px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.who{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--muted);min-width:0}
.who span.n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dot{width:8px;height:8px;border-radius:999px;flex:none;background:var(--blue)}.dot.google{background:#34A853}
.ad .hl{font-weight:700;font-size:15px;line-height:1.35;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ad .tx{font-size:13.5px;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ad .foot{margin-top:auto;padding-top:8px;font-size:12.5px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;gap:8px}
.cta-chip{background:#F2F4F7;color:var(--ink-2);border-radius:8px;padding:3px 8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.ad .host{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.empty{color:var(--muted);padding:26px;text-align:center}
.subhead{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:30px 0 4px}
/* competitors */
.comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;align-items:start}
.comp{background:#fff;border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden;scroll-margin-top:84px}
.comp .cover{--h:220;height:118px;background:linear-gradient(135deg,hsl(var(--h) 70% 92%),hsl(calc(var(--h) + 40) 70% 95%));overflow:hidden}
.comp .cover img{width:100%;height:100%;object-fit:cover;display:block}
.comp-b{padding:0 20px 20px;display:grid;gap:14px}
.comp-h{display:flex;align-items:flex-end;gap:14px}
.comp-h .av{margin-top:-28px;box-shadow:0 0 0 4px #fff,0 2px 8px rgba(16,24,40,.12)}
.comp-h > div{padding-top:12px;min-width:0}
.comp-h h3{margin:0;font-size:17px;line-height:1.25;letter-spacing:-.01em}
.comp-h .meta{color:var(--muted);font-size:13px;margin-top:3px}
.comp-h .meta b{color:var(--ink)}
.cstats{display:grid;background:#F7F9FC;border:1px solid var(--line);border-radius:14px;padding:4px 14px}
.cs{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;align-items:baseline;padding:9px 0;border-top:1px solid var(--line)}
.cs:first-child{border-top:0}
.cs .k{font-size:13.5px;font-weight:600;color:var(--ink-2)}
.cs .v{grid-row:1/3;grid-column:2;align-self:center;font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1}
.cs .n{font-size:12px;color:var(--muted);line-height:1.3}
.cs.zero .v,.cs.muted .v{color:var(--faint)}
.cs.unk .v,.cs.unk .n{color:var(--amber-ink)}
.engine{margin:0;font-size:14px;color:var(--ink-2);line-height:1.5;border-left:3px solid var(--blue-line);padding-left:12px}
.leads{display:grid;gap:6px;font-size:14px;color:var(--ink-2)}
.leads b{display:inline-block;min-width:70px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-right:6px}
.said-row{display:grid;gap:6px}
.said-row .lab{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.comp-links{display:flex;flex-wrap:wrap;gap:6px 16px;padding-top:12px;border-top:1px solid var(--line);font-size:13.5px;font-weight:700}
.comp-links a{display:inline-flex;align-items:center;gap:5px}
.comp-links svg{width:14px;height:14px}
.rank{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:#fff;font-weight:800;font-size:14px}
.lbl-m{display:none;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.stars{color:var(--star);letter-spacing:.5px}
.said{font-size:14px;color:var(--ink-2)}
.said em{display:block;font-style:normal;font-size:12.5px;color:var(--muted);margin-top:6px}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font-size:12.5px;font-weight:600;border-radius:8px;padding:3px 8px;background:var(--red-soft);color:#A8261B}
.tag.good{background:var(--green-soft);color:var(--green)}
.tag.plain{background:#F2F4F7;color:var(--ink-2)}
/* weak spots */
.theme{display:grid;grid-template-columns:260px minmax(0,1fr);gap:26px;padding:26px}
.theme .num{font-size:44px;font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--ink)}
.theme .num small{font-size:14px;font-weight:600;color:var(--muted);letter-spacing:0;margin-left:6px}
.theme h3{font-size:19px;line-height:1.3;letter-spacing:-.015em;margin:12px 0 10px}
.meter{height:8px;border-radius:999px;background:#EEF1F5;overflow:hidden}.meter i{display:block;height:100%;background:var(--blue);border-radius:999px}
.theme .spread{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:13px;margin-top:10px}
.theme .spread span{margin-left:6px}
.quotes{display:grid;gap:10px}
blockquote{margin:0;padding:14px 16px;background:#F7F9FC;border:1px solid var(--line);border-radius:14px;color:var(--ink);font-size:15px;line-height:1.5}
blockquote footer{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12.5px;margin-top:8px}
.angle{display:flex;gap:10px;align-items:flex-start;background:var(--green-soft);color:#05603A;border-radius:14px;padding:12px 14px;font-size:14.5px;font-weight:500}
.angle b{color:var(--green);white-space:nowrap}
.praise{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px}
.praise .lab{font-weight:700;margin-right:4px}
/* ads written for you: feed post mockups */
.wins{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));align-items:start}
.win{display:flex;flex-direction:column;gap:12px}
.post{background:#fff;border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.post .ph{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.post .av{border-radius:999px}
.post .pn{font-weight:700;font-size:14.5px;line-height:1.2}.post .ps{display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted)}.post .ps .pm{width:12px;height:12px}
.post .pt{padding:0 16px 12px;font-size:14.5px;color:var(--ink);line-height:1.5}
.post .creative{aspect-ratio:1.91/1;background:var(--blue);color:#fff;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:22px;position:relative}
.post .creative .tag2{position:absolute;top:16px;left:16px;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.18);border-radius:999px;padding:4px 10px}
.post .creative .h{font-size:clamp(20px,2.2vw,26px);font-weight:800;line-height:1.12;letter-spacing:-.02em}
.post .pf{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#F2F4F7;padding:12px 16px}
.post .pf .d{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.post .pf .t{font-weight:700;font-size:14px;line-height:1.3}
.post .pf .b{background:#E4E7EC;border-radius:8px;padding:8px 12px;font-weight:700;font-size:13.5px;white-space:nowrap}
.why{font-size:13.5px;color:var(--muted)}
.needs{font-size:13.5px;background:var(--amber-soft);color:var(--amber-ink);border-radius:12px;padding:10px 12px}
.needs b{font-weight:700}
.copy{align-self:flex-start;border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:700;color:var(--ink-2);cursor:pointer}
.copy:hover{border-color:var(--blue);color:var(--blue-ink)}
/* offers */
.offers{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
.coupon{position:relative;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:22px 22px 18px;border:2px dashed var(--blue-line);display:flex;flex-direction:column;gap:10px}
.coupon img{width:44px;height:44px}
.coupon h3{font-size:19px;line-height:1.3;letter-spacing:-.015em;margin:0}
/* how it was made */
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px 26px;padding:26px}
.how h2{grid-column:1/-1;font-size:20px}
.how .it{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:14px;color:var(--ink-2)}
.how .it::before{content:"";width:18px;height:18px;margin-top:2px;border-radius:999px;background:var(--blue-soft);box-shadow:inset 0 0 0 5px var(--blue-soft),inset 0 0 0 9px var(--blue)}
.how .it b{color:var(--ink)}
/* the one-click version */
.cta{display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center;background:#fff;border-radius:var(--r);padding:24px 26px;box-shadow:var(--shadow);border:1.5px solid var(--blue-line)}
.cta img{width:84px;height:84px}
.cta h3{margin:0 0 4px;font-size:20px;letter-spacing:-.015em}.cta p{margin:0;color:var(--ink-2);max-width:700px}
.btn{display:inline-block;background:var(--blue);color:#fff;font-weight:700;border-radius:12px;padding:12px 18px;white-space:nowrap}
.btn:hover{background:var(--blue-ink);text-decoration:none}
footer.bottom{color:var(--muted);font-size:13px;text-align:center;padding:4px 0 34px}
/* the ad viewer */
dialog{border:none;border-radius:20px;padding:0;max-width:min(1040px,94vw);width:100%;box-shadow:0 24px 70px rgba(11,18,32,.4);overflow:hidden}
dialog::backdrop{background:rgba(11,18,32,.6)}
.viewer{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
.viewer .vm{background:#0B1220;display:flex;align-items:center;justify-content:center;min-height:360px}
.viewer .vm img,.viewer .vm video{max-width:100%;max-height:82vh;display:block}
.viewer .vm iframe{width:100%;aspect-ratio:16/9;border:0}
.viewer .vb{padding:20px 24px 24px;display:flex;flex-direction:column;gap:12px;overflow:auto}
.v-who{display:flex;align-items:center;gap:12px}
.v-who div{display:flex;flex-direction:column;line-height:1.3}
.v-who b{font-size:15px}.v-who span{font-size:12.5px;color:var(--muted)}
.vm-words{color:#fff;padding:30px;font-size:22px;font-weight:800;line-height:1.3}
.v-count{font-size:12px;color:var(--faint)}
.vside{display:flex;flex-direction:column;min-height:0;max-height:86vh}
.vbar{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.vbar #vpos{font-size:13px;font-weight:700;color:var(--muted);min-width:56px;text-align:center}
.vbar .nav{border:1px solid var(--line);background:#fff;width:34px;height:34px;border-radius:999px;cursor:pointer;display:grid;place-items:center;color:var(--ink)}
.vbar .nav svg{width:16px;height:16px}
.vbar .nav:hover:not(:disabled){border-color:var(--blue);color:var(--blue-ink)}
.vbar .nav:disabled{opacity:.35;cursor:default}
.vbar .x{position:static;margin-left:auto;box-shadow:none;border:1px solid var(--line)}
.viewer .vb .hl{font-weight:800;font-size:19px;letter-spacing:-.015em;line-height:1.3}.viewer .vb .tx{white-space:pre-wrap;color:var(--ink-2);font-size:14.5px}
.viewer .pills{display:flex;flex-wrap:wrap;gap:6px}
.pill{font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:#F2F4F7;color:var(--ink-2);white-space:nowrap}
.pill.proven{background:var(--green-soft);color:var(--green)}
.viewer .links{display:grid;gap:6px;margin-top:auto;padding-top:8px;border-top:1px solid var(--line)}
.x{position:absolute;top:12px;right:12px;z-index:2;border:none;background:#fff;border-radius:999px;width:34px;height:34px;font-size:20px;line-height:1;cursor:pointer;box-shadow:var(--shadow)}
.anon .comp .cover img{filter:blur(14px);transform:scale(1.15)}
.anon .ad .media img,.anon .ad .media video,.anon .viewer .vm img,.anon .viewer .vm video,.anon .change img{filter:blur(9px)}
@media (max-width:980px){.verdict{grid-template-columns:1fr}.theme{grid-template-columns:1fr;gap:16px}.hero .wrap{grid-template-columns:1fr}.cluster{display:none}}
@media (max-width:640px){.wrap{padding:0 16px}.viewer{grid-template-columns:1fr}.cta{grid-template-columns:1fr}.sec-head + .lead{margin-left:0}.topbar .toc{display:none}.jump{display:block}.filters{position:static;padding:12px}.comps{grid-template-columns:1fr}.search{flex-basis:100%}.seg{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;max-width:100%}.seg::-webkit-scrollbar{display:none}.sort{margin-left:auto}.sort select{max-width:170px}}
@media print{.topbar,.filters,.copy,.cta .btn,dialog .nav{display:none}.ad,.theme,.post{break-inside:avoid}body{background:#fff}.card,.ad,.comp,.post,.coupon{box-shadow:none;border:1px solid var(--line)}}
`;
