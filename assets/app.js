/* Cleveland Clinic Connected: advisory solution finder, catalog and cart. */
(function () {
  "use strict";

  var CATALOG = window.CC_CATALOG || [];
  var FINDER = window.CC_FINDER;
  var CONFIG = window.CC_CONFIG || {};
  var E = window.CCEngine;

  var BY_ID = {};
  CATALOG.forEach(function (p) { BY_ID[p.id] = p; });
  var DOMAINS = FINDER.domains;
  var DOMAIN_BY_ID = {};
  DOMAINS.forEach(function (d) { DOMAIN_BY_ID[d.id] = d; });
  var FIT_LABEL = { "new": "New hospital", existing: "Existing hospital" };
  var STATUS_PHRASE = { "new": "a hospital in development", existing: "an existing hospital" };
  var STATUS_PLURAL = { "new": "new hospitals", existing: "existing hospitals" };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- State ---------------- */
  var state = {
    answers: {},        // status, domain and every domain question id -> option id
    order: [],          // answered keys in the order they were answered
    recall: null,       // { key, value } shown as selected after going back
    cart: loadCart(),
    fit: "all",
    query: "",
    open: {},           // domain id -> expanded in the catalog
    cartView: "list",
    lastRequest: null
  };

  /* ---------------- Utilities ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* Escape, then highlight bracketed placeholders such as [X] that the brochures still carry. */
  function rich(s) {
    return esc(s).replace(/\[[^\]]{1,60}\]/g, function (m) {
      return '<mark class="tbc" title="To be confirmed">' + m + "</mark>";
    });
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* storage unavailable */ } }
  function loadCart() {
    try {
      var raw = JSON.parse(storageGet("ccc-cart") || "[]");
      return Array.isArray(raw) ? raw.filter(function (id) { return !!BY_ID[id]; }) : [];
    } catch (e) { return []; }
  }
  function saveCart() { storageSet("ccc-cart", JSON.stringify(state.cart)); }
  function inCart(id) { return state.cart.indexOf(id) !== -1; }

  function markersHTML(p) {
    return '<span class="markers">' + p.fit.slice().sort(function (a, b) { return a === "new" ? -1 : 1; }).map(function (f) {
      return '<span class="marker marker-' + f + '">' + FIT_LABEL[f] + "</span>";
    }).join("") + "</span>";
  }

  var ICON = {
    back: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    pdf: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function cartButtonHTML(id, extraClass) {
    var added = inCart(id);
    return '<button type="button" class="btn ' + (added ? "btn-secondary is-added" : "btn-secondary") + " " + (extraClass || "") +
      '" data-action="' + (added ? "open-cart" : "add") + '" data-id="' + id + '" aria-label="' +
      (added ? "In cart: " : "Add to cart: ") + esc(BY_ID[id].title) + '">' + (added ? ICON.check + "In cart" : ICON.plus + "Add to cart") + "</button>";
  }

  /* ---------------- Finder ---------------- */
  var finderMain = $("#finderMain");

  function currentStep() {
    var a = state.answers;
    if (!a.status) return { type: "status", q: FINDER.status };
    if (!a.domain) return { type: "domain", q: FINDER.domain };
    var q = E.nextQuestion(FINDER, a.status, a.domain, domainAnswers());
    if (q) return { type: "question", q: q };
    return { type: "result" };
  }

  function domainAnswers() {
    var out = {};
    Object.keys(state.answers).forEach(function (k) { if (k !== "status" && k !== "domain") out[k] = state.answers[k]; });
    return out;
  }

  function domainOptions(status) {
    return DOMAINS.map(function (d) {
      var n = CATALOG.filter(function (p) { return p.domain === d.id && E.fits(p, status); }).length;
      return { id: d.id, label: d.name, detail: d.blurb, meta: plural(n, "solution", "solutions") + " for " + STATUS_PLURAL[status] };
    });
  }

  function questionShort(key) {
    if (key === "status") return "Hospital";
    if (key === "domain") return "Advisory area";
    var list = FINDER.questions[state.answers.domain] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === key) return list[i].short || list[i].title;
    return key;
  }

  function answerLabel(key) {
    var v = state.answers[key];
    if (key === "status") return v === "new" ? "Building a new hospital" : "Operating an existing hospital";
    if (key === "domain") return DOMAIN_BY_ID[v] ? DOMAIN_BY_ID[v].name : v;
    var list = FINDER.questions[state.answers.domain] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === key) {
        var o = E.chosenOption(list[i], state.answers.status, state.answers);
        return o ? o.label : v;
      }
    }
    return v;
  }

  function renderFinder(opts) {
    opts = opts || {};
    var step = currentStep();
    var grid = $(".finder-grid");
    grid.classList.toggle("is-result", step.type === "result");
    renderSteps(step);
    if (step.type === "result") renderResult(); else renderQuestion(step);
    renderMap(step);
    renderAnswers();
    if (opts.focus) {
      var target = $(".q-title", finderMain) || $(".result-title", finderMain);
      if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
      var top = finderMain.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.7) {
        var y = window.scrollY + $(".finder").getBoundingClientRect().top - 12;
        window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
      }
    }
  }

  function renderSteps(step) {
    var idx = { status: 0, domain: 1, question: 2, result: 3 }[step.type];
    $all("#finderSteps li").forEach(function (li, i) {
      li.classList.toggle("is-done", i < idx);
      li.classList.toggle("is-current", i === idx);
      if (i === idx) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }

  function renderQuestion(step) {
    var q = step.q, status = state.answers.status, options, kicker = "";
    if (step.type === "status") options = q.options;
    else if (step.type === "domain") options = domainOptions(status);
    else {
      options = E.optionsFor(q, status);
      kicker = DOMAIN_BY_ID[state.answers.domain].name;
    }
    var recall = state.recall && state.recall.key === q.id ? state.recall.value : null;
    var html = '<div class="q-enter">';
    if (kicker) html += '<p class="q-kicker">' + esc(kicker) + "</p>";
    html += '<h2 class="q-title" id="qTitle">' + esc(q.title) + "</h2>";
    if (q.help) html += '<p class="q-help">' + esc(q.help) + "</p>"; else html += '<div style="height:20px"></div>';
    html += '<div class="options' + (step.type === "domain" ? " is-wide" : "") + '" role="group" aria-labelledby="qTitle">';
    options.forEach(function (o) {
      html += '<button type="button" class="option" data-action="answer" data-key="' + esc(q.id) + '" data-value="' + esc(o.id) +
        '" aria-pressed="' + (recall === o.id ? "true" : "false") + '">' +
        '<span class="option-mark" aria-hidden="true"></span><span>' +
        '<span class="option-label">' + esc(o.label) + "</span>" +
        (o.detail ? '<span class="option-detail">' + esc(o.detail) + "</span>" : "") +
        (o.meta ? '<span class="option-meta">' + esc(o.meta) + "</span>" : "") +
        "</span></button>";
    });
    html += "</div>";
    if (state.order.length) {
      html += '<div class="q-nav"><button type="button" class="link-btn" data-action="back">' + ICON.back + "Back</button>" +
        '<button type="button" class="link-btn" data-action="restart">Start over</button></div>';
    }
    html += "</div>";
    finderMain.innerHTML = html;
  }

  function recommendation() {
    return E.recommend(CATALOG, FINDER, state.answers.status, state.answers.domain, domainAnswers());
  }

  function renderResult() {
    var rec = recommendation();
    if (!rec) { finderMain.innerHTML = "<p>No solutions match yet. Try another area.</p>"; return; }
    var p = rec.top, d = DOMAIN_BY_ID[p.domain];
    var nAnswers = state.order.length - 2;
    var shown = p.deliverables.slice(0, 4);
    var more = p.deliverables.length - shown.length;

    var html = '<div class="q-enter">' +
      '<article class="result" aria-labelledby="resultTitle">' +
      '<div class="result-band"><p class="result-for">Your best match</p>' +
      "<p>For " + STATUS_PHRASE[state.answers.status] + ", based on your " + plural(nAnswers, "answer", "answers") + " about " + esc(d.name.toLowerCase().replace("safety, quality & patient experience", "safety, quality and patient experience")) + ".</p></div>" +
      '<div class="result-body">' +
      '<p class="ref">' + esc(p.id) + "</p>" +
      '<h2 class="result-title" id="resultTitle">' + esc(p.title) + "</h2>" +
      '<p class="result-sub">' + rich(p.subtitle) + "</p>" +
      '<div style="margin-top:14px">' + markersHTML(p) + "</div>" +
      '<div class="result-cols"><div><h4>What you receive</h4><ul class="squares">' +
      shown.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>" +
      (more > 0 ? '<p style="margin-top:10px;font-size:14.5px;color:var(--slate)">Plus ' + plural(more, "more deliverable", "more deliverables") + " in the full profile.</p>" : "") +
      "</div>" +
      '<dl class="facts">' +
      "<div><dt>Typical duration</dt><dd>" + rich(p.durationShort) + "</dd></div>" +
      "<div><dt>Delivery model</dt><dd>" + esc(p.deliveryShort) + "</dd></div>" +
      "<div><dt>Category</dt><dd>" + esc(p.category) + "</dd></div>" +
      "</dl></div>" +
      '<div class="result-actions">' +
      cartButtonHTML(p.id, "btn-primary-like") +
      '<button type="button" class="btn btn-quiet" data-action="detail" data-id="' + p.id + '">View full profile</button>' +
      '<a class="btn btn-quiet" href="' + esc(p.pdf) + '" target="_blank" rel="noopener">' + ICON.pdf + "Download brochure (PDF)</a>" +
      "</div></div></article>";

    if (rec.alternatives.length) {
      html += '<section class="also" aria-label="Also consider"><h3>Also consider</h3>';
      rec.alternatives.forEach(function (a) {
        html += '<div class="also-row"><span class="ref">' + esc(a.id) + "</span><div>" +
          '<button type="button" class="also-title" data-action="detail" data-id="' + a.id + '">' + esc(a.title) + "</button>" +
          "<p>" + rich(a.durationShort) + "</p></div>" +
          cartButtonHTML(a.id, "btn-small on-navy-btn") + "</div>";
      });
      html += "</section>";
    }
    html += '<div class="result-more">' +
      '<button type="button" class="link-btn" data-action="another">Find a solution in another area</button>' +
      '<button type="button" class="link-btn" data-action="back">' + ICON.back + "Change my last answer</button>" +
      '<button type="button" class="link-btn" data-action="restart">Start over</button></div>';
    html += "</div>";
    finderMain.innerHTML = html;
    // The primary add button on the result sheet uses the filled style.
    var primary = $(".result-actions .btn", finderMain);
    if (primary && !inCart(p.id)) { primary.classList.remove("btn-secondary"); primary.classList.add("btn-primary"); }
    $all(".also .btn", finderMain).forEach(function (b) {
      b.classList.remove("btn-secondary");
      b.classList.add(inCart(b.getAttribute("data-id")) ? "btn-light" : "btn-ghost-light");
    });
  }

  function renderMap(step) {
    var a = state.answers;
    var live = E.inPlay(CATALOG, FINDER, a.status, a.domain, domainAnswers());
    var rec = step.type === "result" ? recommendation() : null;
    var altIds = rec ? rec.alternatives.map(function (x) { return x.id; }) : [];
    var html = "";
    DOMAINS.forEach(function (d) {
      html += '<div class="map-col' + (a.domain === d.id ? " is-active" : "") + '"><h3>' + esc(d.short) + '</h3><div class="map-cells">';
      CATALOG.filter(function (p) { return p.domain === d.id; }).forEach(function (p) {
        var cls = "cell", note = "";
        if (a.status && !E.fits(p, a.status)) { cls += " is-off"; note = "not offered for " + STATUS_PLURAL[a.status]; }
        else if (rec && rec.top.id === p.id) { cls += " is-top"; note = "recommended"; }
        else if (rec && altIds.indexOf(p.id) !== -1) { cls += " is-alt"; note = "also consider"; }
        else if (!live[p.id]) { cls += " is-dim"; note = a.domain && p.domain !== a.domain ? "different area" : "not a match yet"; }
        else note = "matches so far";
        html += '<button type="button" class="' + cls + '" data-action="detail" data-id="' + p.id + '" title="' + esc(p.id + ": " + p.title) +
          '" aria-label="' + esc(p.id + ", " + p.title + ", " + note) + '">' + esc(p.id) + "</button>";
      });
      html += "</div></div>";
    });
    $("#portfolioMap").innerHTML = html;

    var count;
    var n = Object.keys(live).length;
    if (!a.status) count = CATALOG.length + " solutions across " + DOMAINS.length + " areas";
    else if (!a.domain) count = plural(n, "solution", "solutions") + " offered to " + STATUS_PLURAL[a.status];
    else if (step.type === "result") count = "Best match " + rec.top.id + ", with " + plural(altIds.length, "alternative", "alternatives");
    else if (state.order.length <= 2) count = plural(n, DOMAIN_BY_ID[a.domain].short + " solution", DOMAIN_BY_ID[a.domain].short + " solutions") + " for " + STATUS_PLURAL[a.status];
    else count = plural(n, "solution matches", "solutions match") + " your answers so far";
    $("#mapCount").textContent = count;
  }

  function renderAnswers() {
    var box = $("#answerList");
    if (!state.order.length) { box.innerHTML = ""; return; }
    var html = "<h3>Your answers</h3><dl>";
    state.order.forEach(function (key) {
      html += '<div class="answer-row"><dt>' + esc(questionShort(key)) + "</dt><dd>" + esc(answerLabel(key)) + "</dd>" +
        '<button type="button" class="link-btn" data-action="change" data-key="' + esc(key) + '" aria-label="Change ' + esc(questionShort(key)) + '">Change</button></div>';
    });
    box.innerHTML = html + "</dl>";
  }

  function answer(key, value, button) {
    if (button) {
      $all(".option", finderMain).forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
    }
    // Answering again after going back replaces everything that came after.
    var at = state.order.indexOf(key);
    if (at !== -1) truncate(at);
    state.answers[key] = value;
    state.order.push(key);
    state.recall = null;
    setTimeout(function () { renderFinder({ focus: true }); }, reduceMotion ? 0 : 200);
  }

  function truncate(index) {
    state.order.slice(index).forEach(function (k) { delete state.answers[k]; });
    state.order = state.order.slice(0, index);
  }

  function back() {
    if (!state.order.length) return;
    var key = state.order[state.order.length - 1];
    state.recall = { key: key, value: state.answers[key] };
    truncate(state.order.length - 1);
    renderFinder({ focus: true });
  }

  function change(key) {
    var at = state.order.indexOf(key);
    if (at === -1) return;
    state.recall = { key: key, value: state.answers[key] };
    truncate(at);
    renderFinder({ focus: true });
  }

  function another() {
    var keep = state.answers.status;
    truncate(0);
    state.answers.status = keep;
    state.order = ["status"];
    state.recall = null;
    renderFinder({ focus: true });
  }

  function restart() {
    truncate(0);
    state.recall = null;
    renderFinder({ focus: true });
  }

  /* ---------------- Catalog ---------------- */
  function matchesQuery(p, q) {
    if (!q) return true;
    var hay = [p.id, p.title, p.subtitle, p.category, p.need.join(" "), p.deliverables.join(" "), p.outcomes.join(" "), DOMAIN_BY_ID[p.domain].name]
      .join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  }

  function visibleProducts(domainId) {
    return CATALOG.filter(function (p) {
      return p.domain === domainId && (state.fit === "all" || p.fit.indexOf(state.fit) !== -1) && matchesQuery(p, state.query);
    });
  }

  function renderCatalog() {
    var total = 0, html = "";
    DOMAINS.forEach(function (d) {
      var all = CATALOG.filter(function (p) { return p.domain === d.id; });
      var list = visibleProducts(d.id);
      total += list.length;
      if (state.query && !list.length) return;
      var open = !!state.open[d.id] || (!!state.query && list.length > 0);
      var countText = list.length === all.length ? plural(all.length, "solution", "solutions") : list.length + " of " + all.length + " solutions";
      html += '<section class="domain" aria-labelledby="dh-' + d.id + '">' +
        '<button type="button" class="domain-head" id="dh-' + d.id + '" data-action="toggle-domain" data-domain="' + d.id +
        '" aria-expanded="' + open + '" aria-controls="db-' + d.id + '">' +
        '<span><span class="domain-name">' + esc(d.name) + '</span><span class="domain-blurb">' + esc(d.blurb) + "</span></span>" +
        '<span class="domain-count">' + countText + "</span>" +
        '<span class="chev" aria-hidden="true">' + ICON.chev + "</span></button>" +
        '<div class="domain-body" id="db-' + d.id + '"' + (open ? "" : " hidden") + ">";
      if (!list.length) {
        html += '<p class="empty-domain">No ' + esc(d.name) + " solutions are offered to " + STATUS_PLURAL[state.fit] + ".</p>";
      }
      list.forEach(function (p) {
        html += '<div class="row">' +
          '<span class="ref">' + esc(p.id) + "</span>" +
          '<div><button type="button" class="row-title" data-action="detail" data-id="' + p.id + '">' + esc(p.title) + "</button>" +
          '<p class="row-sub">' + rich(p.subtitle) + "</p></div>" +
          '<div class="row-meta">' + markersHTML(p) + "<span>Typical duration: " + rich(p.durationShort) + "</span></div>" +
          '<div class="row-actions">' + cartButtonHTML(p.id, "btn-small") +
          '<button type="button" class="btn btn-quiet btn-small" data-action="detail" data-id="' + p.id + '" aria-label="View details: ' + esc(p.title) + '">View details</button></div>' +
          "</div>";
      });
      html += "</div></section>";
    });
    if (!total) {
      html = '<div class="catalog-empty"><h3 class="section-title" style="font-size:24px">No solutions match "' + esc(state.query) + '"</h3>' +
        "<p>Try a broader term such as finance, nursing or EHR, or clear the search to see every solution.</p>" +
        '<p style="margin-top:16px"><button type="button" class="btn btn-secondary btn-small" data-action="clear-search">Clear search</button></p></div>';
    }
    $("#domainList").innerHTML = html;
    var filterText = state.fit === "all" ? "" : " for " + STATUS_PLURAL[state.fit];
    $("#catalogCount").textContent = "Showing " + plural(total, "solution", "solutions") + filterText;
  }

  /* ---------------- Detail panel ---------------- */
  var KV = /^(Format|Location|Offering type|Customizable|Add-on|Learn more[^:]*|Intended audience|Note|Prerequisites?):\s*(.*)$/;

  function paragraphsHTML(list) {
    var plain = [], kv = [];
    list.forEach(function (t) {
      var m = KV.exec(t);
      if (m) kv.push(m); else plain.push(t);
    });
    var html = plain.map(function (t) { return "<p>" + rich(t) + "</p>"; }).join("");
    if (kv.length) {
      html += '<dl class="kv">' + kv.map(function (m) { return "<div><dt>" + esc(m[1]) + "</dt><dd>" + rich(m[2]) + "</dd></div>"; }).join("") + "</dl>";
    }
    return html;
  }

  function listHTML(items, green) {
    return '<ul class="squares' + (green ? " green" : "") + '">' + items.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
  }

  var panelReturn = null;

  function openDetail(id, opener) {
    var p = BY_ID[id];
    if (!p) return;
    var d = DOMAIN_BY_ID[p.domain];
    var panel = $("#detailPanel");
    var res = "";
    if (p.resourcesCC.length || p.resourcesClient.length) {
      res = '<section class="dsec"><h3>Resource requirements</h3>';
      if (p.resourcesCC.length && p.resourcesClient.length) {
        res += '<div class="res-cols"><div><h4>Cleveland Clinic team</h4>' + listHTML(p.resourcesCC) + "</div>" +
          "<div><h4>Your team and inputs</h4>" + listHTML(p.resourcesClient, true) + "</div></div>";
      } else {
        res += "<h4 style=\"font-size:14px;color:var(--slate);margin-bottom:8px\">" + (p.resourcesCC.length ? "Cleveland Clinic team" : "Your team and inputs") + "</h4>" +
          listHTML(p.resourcesCC.length ? p.resourcesCC : p.resourcesClient, !p.resourcesCC.length);
      }
      res += "</section>";
    }
    panel.innerHTML =
      '<div class="panel-head on-navy">' +
      '<div class="panel-top"><span class="ref">' + esc(p.id) + " &nbsp;&nbsp;" + esc(d.name) + "</span>" +
      '<button type="button" class="close-btn" data-action="close-panel" aria-label="Close">' + ICON.close + "</button></div>" +
      '<h2 class="panel-title" id="detailTitle">' + esc(p.title) + "</h2>" +
      '<p class="panel-sub">' + rich(p.subtitle) + "</p>" + markersHTML(p) + "</div>" +
      '<div class="panel-body">' +
      '<dl class="fact-strip">' +
      "<div><dt>Category</dt><dd>" + esc(p.category) + "</dd></div>" +
      "<div><dt>Typical duration</dt><dd>" + rich(p.durationShort) + "</dd></div>" +
      "<div><dt>Delivery model</dt><dd>" + esc(p.deliveryShort) + "</dd></div>" +
      "<div><dt>Delivered by</dt><dd>" + p.deliveredBy.map(esc).join("<br>") + "</dd></div>" +
      "</dl>" +
      '<section class="dsec"><h3>The need</h3>' + paragraphsHTML(p.need) + "</section>" +
      '<section class="dsec"><h3>What Cleveland Clinic brings</h3>' + paragraphsHTML(p.value) + "</section>" +
      '<section class="dsec"><h3>Key deliverables</h3>' + listHTML(p.deliverables) + "</section>" +
      '<section class="dsec"><h3>How it is delivered</h3><p class="lead-in">' + esc(p.deliveryModel) + "</p>" + paragraphsHTML(p.deliveryDetail) + "</section>" +
      '<section class="dsec"><h3>Typical duration</h3><p class="lead-in">' + rich(p.duration) + "</p>" + paragraphsHTML(p.durationDetail) + "</section>" +
      res +
      '<section class="dsec"><h3>Expected outcomes</h3>' + listHTML(p.outcomes, true) + "</section>" +
      "</div>" +
      '<div class="panel-foot">' + cartButtonHTML(p.id) +
      '<a class="btn btn-quiet" href="' + esc(p.pdf) + '" target="_blank" rel="noopener">' + ICON.pdf + "Download brochure (PDF)</a></div>";
    var foot = $(".panel-foot .btn", panel);
    if (foot && !inCart(p.id)) { foot.classList.remove("btn-secondary"); foot.classList.add("btn-primary"); }
    showPanel(panel, opener);
    try { history.replaceState(null, "", "#solution=" + p.id); } catch (e) { /* ignore */ }
  }

  function hideToast() {
    var t = $("#toast");
    clearTimeout(toastTimer);
    t.classList.remove("is-on");
    t.hidden = true;
  }

  function showPanel(panel, opener) {
    if (panel.id === "cartPanel") hideToast();
    var other = panel.id === "detailPanel" ? $("#cartPanel") : $("#detailPanel");
    if (!other.hidden) hidePanel(other, true);
    if (panel.hidden) panelReturn = opener || document.activeElement;
    var scrim = $("#scrim");
    scrim.hidden = false;
    panel.hidden = false;
    document.body.classList.add("is-locked");
    requestAnimationFrame(function () {
      scrim.classList.add("is-open");
      panel.classList.add("is-open");
    });
    var body = $(".panel-body", panel);
    if (body) body.scrollTop = 0;
    var first = $(".close-btn", panel);
    if (first) first.focus({ preventScroll: true });
  }

  function hidePanel(panel, swapping) {
    if (panel.hidden) return;
    panel.classList.remove("is-open");
    if (!swapping) {
      $("#scrim").classList.remove("is-open");
      document.body.classList.remove("is-locked");
    }
    setTimeout(function () {
      panel.hidden = true;
      if (!swapping && !$("#scrim").classList.contains("is-open")) $("#scrim").hidden = true;
    }, reduceMotion ? 0 : 300);
    if (panel.id === "detailPanel") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    }
    if (!swapping && panelReturn && document.body.contains(panelReturn)) panelReturn.focus({ preventScroll: true });
  }

  function openPanel() {
    return [$("#detailPanel"), $("#cartPanel")].filter(function (p) { return !p.hidden; })[0] || null;
  }

  /* ---------------- Cart ---------------- */
  function addToCart(id) {
    if (!BY_ID[id] || inCart(id)) return;
    state.cart.push(id);
    saveCart();
    refreshCartUI();
    toast("Added to cart: " + BY_ID[id].title);
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(function (x) { return x !== id; });
    saveCart();
    refreshCartUI();
  }

  function refreshCartUI() {
    var c = $("#cartCount");
    c.textContent = state.cart.length;
    c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
    $("#cartButton").setAttribute("aria-label", "Cart, " + plural(state.cart.length, "solution", "solutions"));
    // Re-render everything that shows add buttons, keeping the finder where it is.
    var step = currentStep();
    if (step.type === "result") renderResult();
    renderCatalog();
    var dp = $("#detailPanel");
    if (!dp.hidden) {
      var id = (location.hash.match(/solution=([A-Z0-9-]+)/) || [])[1];
      var foot = $(".panel-foot", dp);
      if (id && foot) {
        foot.innerHTML = cartButtonHTML(id) + '<a class="btn btn-quiet" href="' + esc(BY_ID[id].pdf) + '" target="_blank" rel="noopener">' + ICON.pdf + "Download brochure (PDF)</a>";
        if (!inCart(id)) { var b = $(".btn", foot); b.classList.remove("btn-secondary"); b.classList.add("btn-primary"); }
      }
    }
    var cp = $("#cartPanel");
    if (!cp.hidden && state.cartView === "list") renderCart();
  }

  function openCart(opener) {
    if (state.cartView === "done") state.cartView = "list";
    renderCart();
    showPanel($("#cartPanel"), opener);
  }

  function cartHead(title, sub) {
    return '<div class="panel-head"><div class="panel-top"><span class="ref">' + esc(sub || "") + "</span>" +
      '<button type="button" class="close-btn" data-action="close-panel" aria-label="Close">' + ICON.close + "</button></div>" +
      '<h2 class="panel-title" id="cartTitle">' + esc(title) + "</h2></div>";
  }

  function renderCart() {
    var panel = $("#cartPanel");
    if (state.cartView === "form") { renderForm(panel); return; }
    if (state.cartView === "done") { renderDone(panel); return; }
    var items = state.cart.map(function (id) { return BY_ID[id]; });
    var html = cartHead("Your cart", plural(items.length, "solution", "solutions"));
    html += '<div class="panel-body">';
    if (!items.length) {
      html += '<div class="cart-empty"><h3>Your cart is empty</h3><p>Use the solution finder or browse all solutions, then add the ones you would like to discuss with our team.</p>' +
        '<button type="button" class="btn btn-primary" data-action="go-finder">Find a solution</button></div>';
    } else {
      html += '<ul class="cart-list">' + items.map(function (p) {
        return '<li class="cart-item"><span class="ref">' + esc(p.id) + " &nbsp;&nbsp;" + esc(DOMAIN_BY_ID[p.domain].name) + "</span>" +
          '<button type="button" class="cart-item-title" data-action="detail" data-id="' + p.id + '">' + esc(p.title) + "</button>" +
          markersHTML(p) + '<span class="cart-dur">Typical duration: ' + rich(p.durationShort) + "</span>" +
          '<button type="button" class="remove" data-action="remove" data-id="' + p.id + '" aria-label="Remove ' + esc(p.title) + '">Remove</button></li>';
      }).join("") + "</ul>";
      html += '<p class="cart-summary">There is no charge to request a proposal. Our team confirms scope, timing and fees with you before any engagement begins.</p>';
    }
    html += "</div>";
    if (items.length) {
      html += '<div class="panel-foot"><button type="button" class="btn btn-primary" data-action="to-form">Request a proposal</button>' +
        '<button type="button" class="btn btn-quiet" data-action="close-panel">Keep browsing</button></div>';
    }
    panel.innerHTML = html;
  }

  function renderForm(panel) {
    var items = state.cart.map(function (id) { return BY_ID[id]; });
    var draft = state.draft || {};
    var status = draft.status || state.answers.status || "";
    function field(name, label, type, required, extra) {
      return '<div class="field"><label for="f-' + name + '">' + label + (required ? "" : ' <span class="opt">(optional)</span>') + "</label>" +
        '<input id="f-' + name + '" name="' + name + '" type="' + type + '"' + (required ? " required" : "") + ' value="' + esc(draft[name] || "") + '"' + (extra || "") + "></div>";
    }
    var html = cartHead("Request a proposal", plural(items.length, "solution", "solutions") + " in your cart");
    html += '<div class="panel-body"><form class="form" id="requestForm" novalidate>' +
      '<p class="form-intro">Tell us about your organization. The Cleveland Clinic Connected team will contact you to scope the solutions below.</p>' +
      listHTML(items.map(function (p) { return p.id + "  " + p.title; })) +
      '<div class="field-row">' + field("name", "Full name", "text", true, ' autocomplete="name"') + field("title", "Job title", "text", true, ' autocomplete="organization-title"') + "</div>" +
      '<div class="field-row">' + field("org", "Organization", "text", true, ' autocomplete="organization"') + field("country", "Country", "text", true, ' autocomplete="country-name"') + "</div>" +
      '<div class="field-row">' + field("email", "Work email", "email", true, ' autocomplete="email"') + field("phone", "Phone", "tel", false, ' autocomplete="tel"') + "</div>" +
      '<fieldset class="field"><legend>Your hospital</legend><div class="radios">' +
      '<label><input type="radio" name="status" value="existing"' + (status === "existing" ? " checked" : "") + "> Operating an existing hospital</label>" +
      '<label><input type="radio" name="status" value="new"' + (status === "new" ? " checked" : "") + "> Building a new hospital</label></div></fieldset>" +
      '<div class="field"><label for="f-timing">When would you like to start?</label><select id="f-timing" name="timing">' +
      ["Within 3 months", "In 3 to 6 months", "In 6 to 12 months", "Exploring options"].map(function (t) {
        return "<option" + (draft.timing === t ? " selected" : "") + ">" + t + "</option>";
      }).join("") + "</select></div>" +
      '<div class="field"><label for="f-notes">What would you like us to know? <span class="opt">(optional)</span></label>' +
      '<textarea id="f-notes" name="notes" placeholder="For example, your opening date, bed count or the challenge behind this request.">' + esc(draft.notes || "") + "</textarea></div>" +
      '<label class="check"><input type="checkbox" name="consent" required' + (draft.consent ? " checked" : "") + "><span>I agree that Cleveland Clinic may contact me about this request.</span></label>" +
      '<p class="form-error" id="formError" role="alert" hidden></p>' +
      "</form></div>" +
      '<div class="panel-foot"><button type="submit" form="requestForm" class="btn btn-primary" id="sendBtn">Send request</button>' +
      '<button type="button" class="btn btn-quiet" data-action="to-list">' + ICON.back + "Back to cart</button></div>";
    panel.innerHTML = html;
    $("#requestForm").addEventListener("input", saveDraft);
    $("#requestForm").addEventListener("submit", submitRequest);
  }

  function formData() {
    var f = $("#requestForm");
    var get = function (n) { var el = f.elements[n]; return el ? (el.value || "").trim() : ""; };
    var st = f.querySelector('input[name="status"]:checked');
    return {
      name: get("name"), title: get("title"), org: get("org"), country: get("country"),
      email: get("email"), phone: get("phone"), status: st ? st.value : "", timing: get("timing"),
      notes: get("notes"), consent: f.elements.consent.checked
    };
  }

  function saveDraft() { if ($("#requestForm")) state.draft = formData(); }

  function validate(data) {
    var f = $("#requestForm"), firstBad = null, problems = [];
    var labels = { name: "full name", title: "job title", org: "organization", country: "country", email: "work email" };
    Object.keys(labels).forEach(function (k) {
      var el = f.elements[k];
      var bad = !data[k] || (k === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[k]));
      el.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad) { problems.push(labels[k]); if (!firstBad) firstBad = el; }
    });
    if (!data.consent) { problems.push("permission to contact you"); if (!firstBad) firstBad = f.elements.consent; }
    var err = $("#formError");
    if (problems.length) {
      err.hidden = false;
      err.textContent = "Add your " + problems.join(", ").replace(/, ([^,]*)$/, " and $1") + " to send the request.";
      firstBad.focus();
      return false;
    }
    err.hidden = true;
    return true;
  }

  function referenceCode() {
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "CCC-" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function buildRequest(data) {
    return {
      reference: referenceCode(),
      submittedAt: new Date().toISOString(),
      contact: { name: data.name, title: data.title, organization: data.org, country: data.country, email: data.email, phone: data.phone },
      hospitalStatus: data.status || "not specified",
      timing: data.timing,
      notes: data.notes,
      solutions: state.cart.map(function (id) { var p = BY_ID[id]; return { id: p.id, title: p.title, area: DOMAIN_BY_ID[p.domain].name }; }),
      finderAnswers: state.order.map(function (k) { return { question: questionShort(k), answer: answerLabel(k) }; })
    };
  }

  function emailBody(req) {
    var lines = [
      "Proposal request " + req.reference,
      "",
      "Solutions of interest:"
    ];
    req.solutions.forEach(function (s) { lines.push("- " + s.id + " " + s.title); });
    lines.push("", "Contact:",
      req.contact.name + ", " + req.contact.title,
      req.contact.organization + ", " + req.contact.country,
      req.contact.email + (req.contact.phone ? ", " + req.contact.phone : ""),
      "", "Hospital: " + (req.hospitalStatus === "new" ? "building a new hospital" : req.hospitalStatus === "existing" ? "operating an existing hospital" : "not specified"),
      "Preferred start: " + req.timing);
    if (req.notes) lines.push("", "Notes:", req.notes);
    return lines.join("\n");
  }

  function mailtoLink(req) {
    var to = CONFIG.inquiryEmail || "ccconnected@ccf.org";
    var subject = "Proposal request " + req.reference + ": " + req.contact.organization;
    return "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(emailBody(req));
  }

  function submitRequest(ev) {
    ev.preventDefault();
    var data = formData();
    if (!validate(data)) return;
    var req = buildRequest(data);
    state.lastRequest = req;
    var btn = $("#sendBtn");
    if (CONFIG.inquiryEndpoint) {
      btn.disabled = true; btn.textContent = "Sending";
      fetch(CONFIG.inquiryEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(req) })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); finishRequest("sent"); })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Send request";
          var err = $("#formError");
          err.hidden = false;
          err.innerHTML = 'The request could not be sent. Check your connection and try again, or <a href="' + esc(mailtoLink(req)) + '">send it by email</a>.';
        });
    } else {
      window.location.href = mailtoLink(req);
      finishRequest("email");
    }
  }

  function finishRequest(mode) {
    state.requestMode = mode;
    state.cartView = "done";
    renderCart();
    var title = $("#cartTitle"); if (title) { title.setAttribute("tabindex", "-1"); title.focus(); }
  }

  function renderDone(panel) {
    var req = state.lastRequest;
    var sent = state.requestMode === "sent";
    var html = cartHead(sent ? "Request sent" : "Your email is ready to send", "Reference " + req.reference);
    html += '<div class="panel-body"><div class="done">' +
      (sent
        ? "<h3>Thank you, " + esc(req.contact.name.split(" ")[0]) + "</h3><p>The Cleveland Clinic Connected team has your request and will reply to " + esc(req.contact.email) + ".</p>"
        : "<h3>Send it from your email app</h3><p>We opened a message to " + esc(CONFIG.inquiryEmail || "ccconnected@ccf.org") +
          " with your request filled in. Send it from there to reach the Cleveland Clinic Connected team. If nothing opened, use the button below.</p>") +
      '<p class="ref-code">Reference: <strong>' + esc(req.reference) + "</strong></p>" +
      listHTML(req.solutions.map(function (s) { return s.id + "  " + s.title; })) +
      '<div class="done-actions">' +
      (sent ? "" : '<a class="btn btn-primary" href="' + esc(mailtoLink(req)) + '">Open the email again</a>') +
      '<button type="button" class="btn btn-secondary" data-action="print">Print or save as PDF</button>' +
      "</div>" +
      '<p style="margin-top:22px;font-size:14.5px">Your cart is unchanged, so you can keep adding solutions. <button type="button" class="remove" data-action="clear-cart">Empty the cart</button></p>' +
      "</div></div>";
    panel.innerHTML = html;
  }

  function printRequest() {
    var req = state.lastRequest;
    if (!req) return;
    var rows = [
      ["Reference", req.reference],
      ["Date", new Date(req.submittedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })],
      ["Name", req.contact.name + ", " + req.contact.title],
      ["Organization", req.contact.organization + ", " + req.contact.country],
      ["Email", req.contact.email + (req.contact.phone ? "  |  " + req.contact.phone : "")],
      ["Hospital", req.hospitalStatus === "new" ? "Building a new hospital" : req.hospitalStatus === "existing" ? "Operating an existing hospital" : "Not specified"],
      ["Preferred start", req.timing]
    ];
    if (req.notes) rows.push(["Notes", req.notes]);
    var sol = req.solutions.map(function (s) {
      var p = BY_ID[s.id];
      return "<tr><th>" + esc(s.id) + "</th><td><strong>" + esc(p.title) + "</strong><br>" + esc(s.area) + "<br>Typical duration: " + esc(p.durationShort) + "<br>Delivery: " + esc(p.deliveryShort) + "</td></tr>";
    }).join("");
    $("#printArea").innerHTML =
      '<img src="assets/cleveland-clinic-logo.png" alt="Cleveland Clinic">' +
      "<h1>Proposal request</h1><p>Cleveland Clinic Connected, International &amp; Emerging Markets</p>" +
      "<h2>Contact</h2><table>" + rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>" +
      "<h2>Solutions of interest</h2><table>" + sol + "</table>" +
      (req.finderAnswers.length ? "<h2>Solution finder answers</h2><table>" + req.finderAnswers.map(function (a) { return "<tr><th>" + esc(a.question) + "</th><td>" + esc(a.answer) + "</td></tr>"; }).join("") + "</table>" : "");
    window.print();
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.innerHTML = "<span>" + esc(msg) + '</span><button type="button" data-action="open-cart">View cart</button>';
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("is-on"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("is-on");
      setTimeout(function () { t.hidden = true; }, 220);
    }, 4200);
  }

  /* ---------------- Events ---------------- */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var act = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");
    switch (act) {
      case "answer": answer(el.getAttribute("data-key"), el.getAttribute("data-value"), el); break;
      case "back": back(); break;
      case "change": change(el.getAttribute("data-key")); break;
      case "restart": restart(); break;
      case "another": another(); break;
      case "detail": openDetail(id, el); break;
      case "add": addToCart(id); break;
      case "remove": removeFromCart(id); break;
      case "open-cart": state.cartView = "list"; openCart(el); break;
      case "close-panel": var p = openPanel(); if (p) hidePanel(p); break;
      case "to-form": state.cartView = "form"; renderCart(); var first = $("#f-name"); if (first) first.focus(); break;
      case "to-list": saveDraft(); state.cartView = "list"; renderCart(); break;
      case "print": printRequest(); break;
      case "clear-cart": state.cart = []; saveCart(); state.cartView = "list"; refreshCartUI(); renderCart(); break;
      case "go-finder":
        var op = openPanel(); if (op) hidePanel(op);
        document.getElementById("finder").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        break;
      case "toggle-domain":
        var dom = el.getAttribute("data-domain");
        var expanded = el.getAttribute("aria-expanded") === "true";
        state.open[dom] = !expanded;
        el.setAttribute("aria-expanded", String(!expanded));
        document.getElementById("db-" + dom).hidden = expanded;
        break;
      case "clear-search": state.query = ""; $("#catalogSearch").value = ""; renderCatalog(); break;
    }
  });

  $("#cartButton").addEventListener("click", function (ev) { state.cartView = state.cartView === "done" ? "list" : state.cartView; openCart(ev.currentTarget); });
  $("#scrim").addEventListener("click", function () { var p = openPanel(); if (p) hidePanel(p); });

  document.addEventListener("keydown", function (ev) {
    var panel = openPanel();
    if (!panel) return;
    if (ev.key === "Escape") { hidePanel(panel); return; }
    if (ev.key === "Tab") {
      var f = $all('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]', panel)
        .filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  $all(".segmented button").forEach(function (b) {
    b.addEventListener("click", function () {
      state.fit = b.getAttribute("data-fit");
      $all(".segmented button").forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
      renderCatalog();
    });
    b.addEventListener("keydown", function (ev) {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      var all = $all(".segmented button");
      var i = all.indexOf(b) + (ev.key === "ArrowRight" ? 1 : -1);
      var next = all[(i + all.length) % all.length];
      next.focus(); next.click();
    });
  });

  var searchTimer = null;
  $("#catalogSearch").addEventListener("input", function (ev) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.query = ev.target.value.trim(); renderCatalog(); }, 120);
  });

  /* ---------------- Start ---------------- */
  if (CONFIG.showPrototypeNotice === false) $("#protoNote").hidden = true;
  if (CONFIG.contactEmail) {
    $("#contactEmailLink").href = "mailto:" + CONFIG.contactEmail;
    $("#footerEmail").href = "mailto:" + CONFIG.contactEmail;
    $("#footerEmail").textContent = CONFIG.contactEmail;
  }
  $("#year").textContent = new Date().getFullYear();
  $("#cartCount").textContent = state.cart.length;
  renderFinder();
  renderCatalog();

  function openFromHash() {
    var deep = (location.hash.match(/solution=([A-Z0-9-]+)/) || [])[1];
    if (deep && BY_ID[deep]) openDetail(deep);
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
