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
/* hero */
.hero{background:#fff;border-bottom:1px solid var(--line)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center;padding-top:44px;padding-bottom:40px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--blue-ink);background:var(--blue-soft);border-radius:999px;padding:6px 12px}
h1{font-size:clamp(30px,4.4vw,52px);line-height:1.06;letter-spacing:-.035em;margin:16px 0 12px;font-weight:800}
.hero p.sub{font-size:17px;color:var(--ink-2);max-width:640px;margin:0}
.hero .facts{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.hero .facts span{background:#F5F7FA;border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:14px;color:var(--ink-2)}
.hero .facts b{color:var(--ink);font-weight:800}
.cluster{display:grid;grid-template-columns:repeat(3,76px);grid-template-rows:repeat(2,76px);gap:14px 18px;align-items:center;justify-items:center}
.cluster img{width:76px;height:76px}
.cluster img.big{grid-column:2;grid-row:1/3;width:132px;height:132px}
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
.toolbar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:12px 14px;margin:0 0 16px}
.seg{display:flex;flex-wrap:wrap;gap:4px;background:#F2F4F7;border-radius:12px;padding:4px}
.chip{border:0;background:transparent;color:var(--ink-2);border-radius:9px;padding:7px 12px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.chip:hover{color:var(--ink)}
.chip[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(16,24,40,.12)}
.count{margin-left:auto;color:var(--muted);font-size:13.5px;font-weight:600}
/* ad cards */
.ads{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.ad{background:#fff;border-radius:16px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;outline:none}
.ad:hover,.ad:focus-visible{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.ad[hidden]{display:none}
.ad .media{position:relative;aspect-ratio:1/1;background:#EEF1F5;overflow:hidden}
.ad .media img,.ad .media video{width:100%;height:100%;object-fit:cover;display:block}
.ad .media.shot{background:#fff;border-bottom:1px solid var(--line)}
.ad .media.shot img{object-fit:contain;object-position:top center;padding:10px}
.ad .media.words{display:flex;flex-direction:column;justify-content:center;gap:8px;padding:22px;background:#F7F9FC}
.ad .media.words .hl{font-size:17px;font-weight:700;color:var(--blue-ink);line-height:1.3}
.ad .media.words .tx{font-size:14px;color:var(--ink-2);-webkit-line-clamp:6}
.badges{position:absolute;inset:10px 10px auto 10px;display:flex;justify-content:space-between;gap:6px;pointer-events:none}
.badge{font-size:12px;font-weight:700;border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.94);color:var(--ink);box-shadow:0 1px 3px rgba(16,24,40,.15);white-space:nowrap}
.badge.proven{background:var(--green);color:#fff}
.badge.play{position:absolute;left:10px;bottom:10px;top:auto;background:rgba(11,18,32,.82);color:#fff}
.ad .body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
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
.rt{background:#fff;border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
.rt-row{display:grid;grid-template-columns:minmax(220px,1.35fr) 118px 118px minmax(180px,1fr) minmax(180px,1fr);gap:16px;padding:18px 22px;border-top:1px solid var(--line);align-items:start}
.rt-row:first-child{border-top:0}
.rt-head{background:#F7F9FC;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding-top:12px;padding-bottom:12px}
.biz{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:start}
.rank{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:#fff;font-weight:800;font-size:14px}
.biz .name{font-weight:700;font-size:15.5px;line-height:1.3}
.biz .meta{color:var(--muted);font-size:13px;margin-top:2px}
.stars{color:var(--star);letter-spacing:.5px}
.lib{font-weight:800;font-size:20px;letter-spacing:-.02em;line-height:1.1}
.lib small{display:block;font-size:12.5px;font-weight:600;color:var(--muted);letter-spacing:0;margin-top:2px}
.lib.zero{color:var(--faint)}.lib.unread{font-size:13px;color:var(--amber-ink);font-weight:600}
.lbl-m{display:none;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
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
.theme .spread{color:var(--muted);font-size:13px;margin-top:8px}
.quotes{display:grid;gap:10px}
blockquote{margin:0;padding:14px 16px;background:#F7F9FC;border:1px solid var(--line);border-radius:14px;color:var(--ink);font-size:15px;line-height:1.5}
blockquote footer{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px;margin-top:6px}
.angle{display:flex;gap:10px;align-items:flex-start;background:var(--green-soft);color:#05603A;border-radius:14px;padding:12px 14px;font-size:14.5px;font-weight:500}
.angle b{color:var(--green);white-space:nowrap}
.praise{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px}
.praise .lab{font-weight:700;margin-right:4px}
/* ads written for you: feed post mockups */
.wins{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));align-items:start}
.win{display:flex;flex-direction:column;gap:12px}
.post{background:#fff;border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.post .ph{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.post .av{width:38px;height:38px;border-radius:999px;background:var(--blue);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none}
.post .pn{font-weight:700;font-size:14.5px;line-height:1.2}.post .ps{font-size:12.5px;color:var(--muted)}
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
.viewer .vb{padding:24px;display:flex;flex-direction:column;gap:12px;max-height:86vh;overflow:auto}
.viewer .vb .who{font-size:13px}
.viewer .vb .hl{font-weight:800;font-size:19px;letter-spacing:-.015em;line-height:1.3}.viewer .vb .tx{white-space:pre-wrap;color:var(--ink-2);font-size:14.5px}
.viewer .pills{display:flex;flex-wrap:wrap;gap:6px}
.pill{font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:#F2F4F7;color:var(--ink-2);white-space:nowrap}
.pill.proven{background:var(--green-soft);color:var(--green)}
.viewer .links{display:grid;gap:6px;margin-top:auto;padding-top:8px;border-top:1px solid var(--line)}
.x{position:absolute;top:12px;right:12px;z-index:2;border:none;background:#fff;border-radius:999px;width:34px;height:34px;font-size:20px;line-height:1;cursor:pointer;box-shadow:var(--shadow)}
.anon .ad .media img,.anon .ad .media video,.anon .viewer .vm img,.anon .viewer .vm video,.anon .change img{filter:blur(9px)}
@media (max-width:980px){.rt-head{display:none}.rt-row{grid-template-columns:1fr 1fr;gap:14px}.rt-row .biz,.rt-row .said,.rt-row .cmp{grid-column:1/-1}.lbl-m{display:block}.verdict{grid-template-columns:1fr}.theme{grid-template-columns:1fr;gap:16px}.hero .wrap{grid-template-columns:1fr}.cluster{display:none}}
@media (max-width:640px){.wrap{padding:0 16px}.viewer{grid-template-columns:1fr}.cta{grid-template-columns:1fr}.sec-head + .lead{margin-left:0}.toolbar{padding:10px}.count{margin-left:0}.topbar .toc{display:none}}
@media print{.topbar,.toolbar,.copy,.cta .btn{display:none}.ad,.theme,.post{break-inside:avoid}body{background:#fff}.card,.ad,.rt,.post,.coupon{box-shadow:none;border:1px solid var(--line)}}
`;
