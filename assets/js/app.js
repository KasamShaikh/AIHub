/* AIHub — AI Solutions showcase, data-driven renderer */
(() => {
  "use strict";

  const DATA_URL = "assets/data/projects.json";
  const MAX_CHIPS = 4;

  // Zero-setup global counter (Abacus — free, no account). Namespace must be unique to this site.
  const COUNTER_API = "https://abacus.jasoncameron.dev";
  const COUNTER_NS = "aihub-kasamshaikh-x7q2";

  // "Work with me" form delivery via Web3Forms. The recipient email is stored server-side
  // (tied to the access key) and is NEVER exposed in this page or its source.
  // Keys are domain-locked, so we pick by hostname: localhost for dev, the live domain otherwise.
  const WEB3FORMS_KEYS = {
    local: "ee121bde-5d43-4ebe-8239-16465078c137", // localhost
    live: "99dc55eb-abf7-4e75-a3a5-3d9fdbe5d217" // kasamshaikh.github.io
  };
  const IS_LOCALHOST = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
  const WEB3FORMS_KEY = IS_LOCALHOST ? WEB3FORMS_KEYS.local : WEB3FORMS_KEYS.live;
  const LINKEDIN_URL = "https://linkedin.com/in/kasamshaikh";

  // Inline SVG icon set keyed by project "icon" field.
  const ICONS = {
    shield: '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3z"/><path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    trending: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 7h6v6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><line x1="4" y1="12" x2="20" y2="12" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    wand: '<path d="M15 4V2M15 10V8M9.5 7h-2M22.5 7h-2M18 11l-1.5-1.5M18 3l-1.5 1.5M12 4l-1.5 1.5"/><path d="m4 20 9-9 1.5 1.5-9 9z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>'
  };

  const els = {
    grid: document.getElementById("cardGrid"),
    empty: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    chips: document.getElementById("filterChips"),
    heroStats: document.getElementById("heroStats"),
    footerYear: document.getElementById("footerYear"),
    footerStats: document.getElementById("footerStats"),
    statViews: document.getElementById("statViews"),
    statSketch: document.getElementById("statSketch"),
    statStandard: document.getElementById("statStandard"),
    statClicks: document.getElementById("statClicks"),
    modal: document.getElementById("modal"),
    modalContent: document.getElementById("modalContent"),
    themeToggle: document.getElementById("themeToggle")
  };

  let projects = [];
  let activeDomain = "All";
  let query = "";

  // ---------- helpers ----------
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const iconSvg = (key) =>
    `<svg class="banner-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${
      ICONS[key] || ICONS.scan
    }</svg>`;

  // Extract "owner/repo" from a GitHub repo URL (null for non-GitHub or missing URLs).
  const repoSlug = (url) => {
    if (!url) return null;
    const m = String(url).match(
      /github\.com\/([^/#?\s]+)\/([^/#?\s]+?)(?:\.git)?\/?(?:[#?].*)?$/i
    );
    return m ? `${m[1]}/${m[2]}` : null;
  };

  // In-memory cache of contributors per repo slug (array on success, null on failure/none).
  const contributorsCache = new Map();

  async function fetchContributors(slug) {
    if (contributorsCache.has(slug)) return contributorsCache.get(slug);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${slug}/contributors?per_page=8`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) throw new Error(`github ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
            .filter((c) => c && c.type === "User" && c.login)
            .map((c) => ({ login: c.login, url: c.html_url, avatar: c.avatar_url }))
        : [];
      contributorsCache.set(slug, list);
      return list;
    } catch (_) {
      contributorsCache.set(slug, null); // best-effort; don't retry this session
      return null;
    }
  }

  function contributorsHtml(list) {
    const MAX = 3;
    const shown = list.slice(0, MAX);
    const rest = list.length - shown.length;
    const chips = shown
      .map(
        (c) =>
          `<a class="contrib" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(
            c.login
          )} on GitHub"><img class="contrib-avatar" src="${esc(
            c.avatar
          )}&s=48" alt="" width="22" height="22" loading="lazy"><span class="contrib-name">${esc(
            c.login
          )}</span></a>`
      )
      .join("");
    const more = rest > 0 ? `<span class="contrib-more">+${rest}</span>` : "";
    return `<span class="contrib-label">Contributors</span><span class="contrib-row">${chips}${more}</span>`;
  }

  // Populate the contributors row for each card that references a GitHub repo.
  function hydrateContributors() {
    els.grid.querySelectorAll(".card-contributors[data-repo]").forEach((box) => {
      fetchContributors(box.dataset.repo).then((list) => {
        if (!box.isConnected || !list || !list.length) return; // keep hidden
        box.innerHTML = contributorsHtml(list);
        box.hidden = false;
      });
    });
  }

  const matches = (p) => {
    const inDomain = activeDomain === "All" || p.domain === activeDomain;
    if (!inDomain) return false;
    if (!query) return true;
    const hay = [p.name, p.tagline, p.domain, p.description, ...(p.techStack || [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  };

  // ---------- rendering ----------
  function cardHtml(p) {
    const chips = (p.techStack || []).slice(0, MAX_CHIPS);
    const extra = (p.techStack || []).length - chips.length;
    const chipHtml =
      chips.map((t) => `<span class="tech-chip">${esc(t)}</span>`).join("") +
      (extra > 0 ? `<span class="tech-chip more">+${extra}</span>` : "");

    const demoBtn = p.demoUrl
      ? `<a class="btn btn-primary" href="${esc(p.demoUrl)}" target="_blank" rel="noopener" aria-label="Open live demo of ${esc(
          p.name
        )}">${openIcon()} Open demo</a>`
      : "";
    const detailsBtn = `<button class="btn ${
      p.demoUrl ? "btn-ghost" : "btn-primary"
    }" data-id="${esc(p.id)}" type="button">Details</button>`;

    const slug = repoSlug(p.repoUrl);
    const contribBox = slug
      ? `<div class="card-contributors" data-repo="${esc(slug)}" hidden></div>`
      : "";

    return `
      <article class="card" tabindex="0" role="button" data-id="${esc(p.id)}" aria-label="View details for ${esc(
      p.name
    )}">
        <div class="card-body">
          <div class="card-top">
            <span class="card-icon banner-${esc(p.accent)}">${iconSvg(p.icon)}</span>
            <span class="domain-badge">${esc(p.domain)}</span>
          </div>
          <h2 class="card-title">${esc(p.name)}</h2>
          <p class="card-tagline">${esc(p.tagline)}</p>
          <div class="tech-chips">${chipHtml}</div>
          ${contribBox}
          <div class="card-actions">
            ${demoBtn}
            ${detailsBtn}
          </div>
        </div>
      </article>`;
  }

  function render() {
    const visible = projects.filter(matches);
    els.grid.innerHTML = visible.map(cardHtml).join("");
    els.empty.hidden = visible.length > 0;
    hydrateContributors();
  }

  function buildChips() {
    const domains = ["All", ...Array.from(new Set(projects.map((p) => p.domain)))];
    els.chips.innerHTML = domains
      .map(
        (d) =>
          `<button class="chip" type="button" data-domain="${esc(d)}" aria-pressed="${
            d === activeDomain
          }">${esc(d === "All" ? "All solutions" : d)}</button>`
      )
      .join("");
  }

  function renderStats() {
    if (!els.heroStats) return;
    const liveDemos = projects.filter((p) => p.demoUrl).length;
    const repos = projects.filter((p) => p.repoUrl).length;
    const stats = [
      [projects.length, "AI Solutions"],
      [liveDemos, "Live demos"],
      [repos, "GitHub repos"]
    ];
    els.heroStats.innerHTML = stats
      .map(
        ([n, label]) =>
          `<div class="hero-stat"><dt>${n}</dt><dd>${esc(label)}</dd></div>`
      )
      .join("");
  }

  // ---------- modal ----------
  function openModal(id) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;

    const stack = (p.techStack || [])
      .map((t) => `<span class="tech-chip">${esc(t)}</span>`)
      .join("");
    const roi = (p.roi || []).map((r) => `<li>${esc(r)}</li>`).join("");

    let cta;
    if (p.demoUrl || p.repoUrl) {
      const demoCta = p.demoUrl
        ? `<a class="btn btn-primary" href="${esc(p.demoUrl)}" target="_blank" rel="noopener">${openIcon()} Open demo</a>`
        : "";
      let repoCta = "";
      if (p.repoUrl) {
        const forkUrl = `${p.repoUrl.replace(/\/$/, "")}/fork`;
        const repoBtnClass = p.demoUrl ? "btn-ghost" : "btn-primary";
        repoCta = `
          <a class="btn ${repoBtnClass}" href="${esc(p.repoUrl)}" target="_blank" rel="noopener">${githubIcon()} View repository</a>
          <a class="btn btn-ghost" href="${esc(p.repoUrl)}" target="_blank" rel="noopener">${starIcon()} Star</a>
          <a class="btn btn-ghost" href="${esc(forkUrl)}" target="_blank" rel="noopener">${forkIcon()} Fork</a>`;
      }
      cta = `<div class="modal-cta">${demoCta}${repoCta}</div>`;
    } else {
      cta = `<p class="no-repo-note">Links coming soon — this solution is available on request.</p>`;
    }

    els.modalContent.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head">
          <span class="card-icon banner-${esc(p.accent)}">${iconSvg(p.icon)}</span>
          <span class="domain-badge">${esc(p.domain)}</span>
        </div>
        <h2 id="modalTitle">${esc(p.name)}</h2>
        <p class="modal-tagline">${esc(p.tagline)}</p>

        <div class="modal-section">
          <h3>About</h3>
          <p>${esc(p.description)}</p>
        </div>

        <div class="modal-section">
          <h3>Business impact &amp; ROI</h3>
          <ul class="roi-list">${roi}</ul>
        </div>

        <div class="modal-section">
          <h3>Tech stack</h3>
          <div class="modal-stack">${stack}</div>
        </div>

        ${cta}
      </div>`;

    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = els.modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
  }

  // ---------- small inline action icons ----------
  function githubIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 5 18 5.3 18 5.3c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/></svg>';
  }
  function starIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9"/></svg>';
  }
  function forkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="M6 7.5V11a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.5M12 14v2.5"/></svg>';
  }
  function openIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  }

  // ---------- theme ----------
  function initTheme() {
    const saved = localStorage.getItem("acc-theme");
    const theme = saved || "light";
    document.documentElement.setAttribute("data-theme", theme);
  }
  function toggleTheme() {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("acc-theme", next);
  }

  // ---------- sketchboard theme toggle ----------
  // Enables/disables the separate sketch.css stylesheet. Off => minimal base theme.
  function initSketchToggle() {
    const link = document.getElementById("sketchCss");
    const btn = document.getElementById("sketchToggle");
    if (!link || !btn) return;
    const apply = (on) => {
      link.disabled = !on;
      btn.setAttribute("aria-pressed", String(on));
    };
    let on = localStorage.getItem("aihub-sketch") === "on"; // default OFF (minimal)
    apply(on);
    btn.addEventListener("click", () => {
      on = !on;
      localStorage.setItem("aihub-sketch", on ? "on" : "off");
      apply(on);
    });
  }

  // ---------- analytics (zero-setup global counter) ----------
  // Uses a free, no-account hit counter (Abacus). Works out of the box; best-effort only.
  async function hitCounter(key) {
    const r = await fetch(`${COUNTER_API}/hit/${COUNTER_NS}/${key}`);
    if (!r.ok) throw new Error(`counter ${r.status}`);
    return (await r.json()).value;
  }
  async function getCounter(key) {
    const r = await fetch(`${COUNTER_API}/get/${COUNTER_NS}/${key}`);
    if (!r.ok) return null;
    return (await r.json()).value;
  }

  function trackCardClick() {
    hitCounter("cardclicks")
      .then((v) => {
        if (typeof v === "number" && els.statClicks) {
          els.statClicks.textContent = v.toLocaleString();
        }
      })
      .catch(() => {
        /* best-effort; never block the UI */
      });
  }

  async function loadFooterStats() {
    if (!els.footerStats) return;
    let views = null;
    try {
      views = await hitCounter("pageviews"); // +1 per page load (total)
    } catch (_) {
      return; // counter unavailable — keep the stats line hidden
    }

    // Count this view against the active theme (Sketchboard vs standard).
    const sketchOn = !(document.getElementById("sketchCss") || {}).disabled;
    const hitKey = sketchOn ? "views_sketch" : "views_standard";
    const otherKey = sketchOn ? "views_standard" : "views_sketch";
    let mine = null;
    let other = null;
    let clicks = null;
    try {
      mine = await hitCounter(hitKey); // +1 for the active mode
    } catch (_) {
      /* ignore */
    }
    try {
      other = await getCounter(otherKey); // current total, no increment
    } catch (_) {
      /* ignore */
    }
    try {
      clicks = await getCounter("cardclicks"); // current total, no increment
    } catch (_) {
      /* ignore */
    }
    const sketchViews = sketchOn ? mine : other;
    const standardViews = sketchOn ? other : mine;

    els.statViews.textContent = Number(views).toLocaleString();
    if (els.statSketch) els.statSketch.textContent = Number(sketchViews ?? 0).toLocaleString();
    if (els.statStandard) els.statStandard.textContent = Number(standardViews ?? 0).toLocaleString();
    if (els.statClicks) els.statClicks.textContent = Number(clicks ?? 0).toLocaleString();
    els.footerStats.hidden = false;
  }

  // ---------- get involved (tabs + help form) ----------
  function wireTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    if (!tabs.length) return;
    const activate = (tab, focus) => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          activate(tabs[(i + dir + tabs.length) % tabs.length], true);
        }
      });
    });
  }

  function showHelpNote(msg, ok) {
    const n = document.getElementById("helpNote");
    if (!n) return;
    n.textContent = msg;
    n.classList.toggle("ok", !!ok);
    n.classList.toggle("err", !ok);
    n.hidden = false;
  }

  async function submitHelp(e) {
    e.preventDefault();
    const f = e.target;
    const val = (name) => (f.elements[name] ? f.elements[name].value.trim() : "");
    const name = val("name");
    const problem = val("problem");
    if (!name || !problem) {
      showHelpNote("Please add your name and a short problem statement.", false);
      return;
    }

    const payload = new FormData();
    payload.append("access_key", WEB3FORMS_KEY);
    payload.append("subject", `AIHub — Problem statement from ${name}`);
    payload.append("from_name", "AIHub showcase");
    payload.append("name", name);
    if (val("email")) payload.append("email", val("email"));
    payload.append("Domain", val("domain"));
    payload.append("GitHub handle", val("github"));
    payload.append("GitHub repo", val("repo"));
    payload.append("LinkedIn", val("linkedin"));
    payload.append("message", problem);
    payload.append("botcheck", ""); // honeypot for spam

    const btn = f.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    showHelpNote("Sending…", true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: payload
      });
      const data = await res.json();
      if (data.success) {
        f.reset();
        showHelpNote("Thanks! Your problem statement has been sent — I'll be in touch soon.", true);
      } else {
        showHelpNote("Sorry, that didn't go through. Please try again, or reach out on LinkedIn.", false);
      }
    } catch (_) {
      showHelpNote("Network error — please try again, or reach out on LinkedIn.", false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ---------- events ----------
  function wireEvents() {
    els.search.addEventListener("input", (e) => {
      query = e.target.value.trim().toLowerCase();
      render();
    });

    els.chips.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      activeDomain = btn.dataset.domain;
      els.chips
        .querySelectorAll(".chip")
        .forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
      render();
    });

    els.grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      // A card interaction: opening the demo link or viewing details.
      const isDemo = !!e.target.closest("a");
      trackCardClick();
      if (isDemo) return; // let the demo link navigate
      openModal(btn.dataset.id);
    });

    els.grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".card");
      if (!card || e.target.tagName === "A" || e.target.tagName === "BUTTON") return;
      e.preventDefault();
      trackCardClick();
      openModal(card.dataset.id);
    });

    els.modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modal.hidden) closeModal();
    });

    els.themeToggle.addEventListener("click", toggleTheme);
    initSketchToggle();

    wireTabs();
    const helpForm = document.getElementById("helpForm");
    if (helpForm) helpForm.addEventListener("submit", submitHelp);
    const linkedinLink = document.getElementById("linkedinLink");
    if (linkedinLink) linkedinLink.href = LINKEDIN_URL;
  }

  // ---------- boot ----------
  async function init() {
    initTheme();
    els.footerYear.textContent = new Date().getFullYear();
    wireEvents();

    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      projects = Array.isArray(data) ? data.filter((p) => !p.hidden) : [];
    } catch (err) {
      els.grid.innerHTML = "";
      els.empty.hidden = false;
      els.empty.textContent =
        "Could not load solutions. If viewing locally, serve over HTTP (e.g. python -m http.server).";
      console.error("Failed to load projects.json:", err);
      return;
    }

    renderStats();
    buildChips();
    render();
    loadFooterStats();
  }

  init();
})();
