/* Cleveland Clinic Connected public site: contact links, the section bands,
   the package roadmap, the priority wheel and the partner highlights carousel. Everything still reads
   correctly without JavaScript: the roadmap is static and the stories stack. */
(function () {
  "use strict";
  var CONFIG = window.CC_CONFIG || {};
  var email = CONFIG.contactEmail || "ccconnected@ccf.org";
  function $(s, root) { return (root || document).querySelector(s); }
  function $all(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Settings ---------- */
  if (CONFIG.showPrototypeNotice === false) {
    if ($("#protoNote")) $("#protoNote").hidden = true;
    $all(".photo-slot").forEach(function (el) { el.hidden = true; });
  }
  $all('a[href^="mailto:"]').forEach(function (a) {
    var q = a.getAttribute("href").split("?")[1];
    a.href = "mailto:" + email + (q ? "?" + q : "");
    if (a.id === "footerEmail" || a.classList.contains("custom-ask-email")) a.textContent = email;
  });
  var y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  /* ---------- Section bands: draw in when they scroll into view ---------- */
  var bars = $all(".section-bar");
  if (bars.length && !reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("bar-anim");
    var barObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); barObs.unobserve(e.target); } });
    }, { threshold: 0.6 });
    bars.forEach(function (el) { barObs.observe(el); });
  }

  /* ---------- Package roadmap: fill in on first view, light up a domain on hover ---------- */
  var rm = $("#roadmap");
  if (rm) {
    if (!reduceMotion && "IntersectionObserver" in window) {
      rm.classList.add("rm-anim");
      var rmObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          rmObs.disconnect();
          rm.classList.add("is-in");
          setTimeout(function () { rm.classList.remove("rm-anim", "is-in"); }, 2800);
        });
      }, { threshold: 0.3 });
      rmObs.observe(rm);
    }
    $all("[data-lane]", rm).forEach(function (el) {
      el.addEventListener("mouseenter", function () { rm.setAttribute("data-focus", el.getAttribute("data-lane")); });
      el.addEventListener("mouseleave", function () { rm.removeAttribute("data-focus"); });
    });
  }

  /* ---------- Existing hospitals: priority wheel ---------- */
  var ex = $("#explorer");
  if (ex) {
    var segs = $all(".seg", ex), rot = $(".wheel-rot", ex), wheel = $(".wheel", ex), hub = $("#hubTitle"), hubKicker = $("#hubKicker"), hubBox = $(".hub", ex);
    var current = 0, turn = 0;   /* running rotation in degrees, so the wheel always turns the short way */
    var stacked = window.matchMedia("(max-width: 900px)");
    var face = function () { return stacked.matches ? 90 : 0; };   /* point at the panel: right, or down when stacked */
    var select = function (i, focus) {
      var seg = segs[i], key = seg.getAttribute("data-key");
      segs.forEach(function (s, k) { var on = k === i; s.setAttribute("aria-selected", String(on)); s.setAttribute("tabindex", on ? "0" : "-1"); });
      $all(".pri", ex).forEach(function (pnl) { pnl.classList.toggle("is-on", pnl.id === "pri-" + key); });
      hub.textContent = seg.getAttribute("data-title");
      hubKicker.textContent = seg.getAttribute("data-short");
      hubBox.style.setProperty("--d", seg.style.getPropertyValue("--d"));
      var target = face() - parseFloat(seg.getAttribute("data-angle"));
      turn += ((target - turn) % 360 + 540) % 360 - 180;
      rot.style.transform = "rotate(" + turn + "deg)";
      wheel.style.setProperty("--counter", (-turn) + "deg");
      current = i;
      if (focus) seg.focus();
    };
    segs.forEach(function (s, i) {
      s.addEventListener("click", function () { wheel.classList.remove("is-hinting"); select(i, false); });
      s.addEventListener("keydown", function (e) {
        var n = segs.length;
        wheel.classList.remove("is-hinting");
        if (e.key === "Enter" || e.key === " ") { select(i, false); e.preventDefault(); }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { select((i + 1) % n, true); e.preventDefault(); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { select((i + n - 1) % n, true); e.preventDefault(); }
      });
    });
    if (stacked.addEventListener) stacked.addEventListener("change", function () { select(current, false); });
    ex.classList.add("no-anim");
    select(0, false);
    requestAnimationFrame(function () { requestAnimationFrame(function () { ex.classList.remove("no-anim"); }); });
    /* "See the story" opens that partner in the carousel */
    $all(".proof-link", ex).forEach(function (a) {
      a.addEventListener("click", function () { if (window.CCStories) window.CCStories.go(parseInt(a.getAttribute("data-story"), 10)); });
    });
  }

  /* ---------- Partner highlights carousel ---------- */
  var root = $("#stories"), track = $("#storiesTrack");
  if (!root || !track) return;
  var slides = $all(".story", track);
  if (slides.length < 2) return;
  var controls = $(".stories-controls", root), bar = $(".stories-progress", root);
  var nowEl = $("#storiesNow"), allEl = $("#storiesAll"), pauseBtn = $(".stories-pause", root);
  var DWELL = 9000;                 /* milliseconds on each story */
  var index = 0, elapsed = 0, last = null;
  var userPaused = reduceMotion, hovering = false, focused = false, visible = false;

  controls.hidden = false;
  allEl.textContent = slides.length;
  var dots = slides.map(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Show highlight " + (i + 1) + ": " + s.querySelector(".story-name").textContent);
    b.innerHTML = '<span class="fill"></span>';
    b.addEventListener("click", function () { go(i, true); });
    bar.appendChild(b);
    return b;
  });

  function render() {
    slides.forEach(function (s, i) {
      var on = i === index;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", String(!on));
      if (on) s.removeAttribute("inert"); else s.setAttribute("inert", "");
    });
    dots.forEach(function (d, i) {
      d.classList.toggle("is-past", i < index);
      d.setAttribute("aria-current", i === index ? "true" : "false");
      d.querySelector(".fill").style.setProperty("--p", i < index ? 1 : 0);
    });
    nowEl.textContent = index + 1;
  }
  function go(i, byUser) {
    index = (i + slides.length) % slides.length;
    elapsed = 0;
    render();
    if (byUser) track.setAttribute("aria-live", "polite");
  }
  window.CCStories = { go: function (i) { go(i, true); } };
  function playing() { return !userPaused && !hovering && !focused && visible && !document.hidden; }
  function setPaused(p) {
    userPaused = p;
    root.classList.toggle("is-paused", p);
    pauseBtn.setAttribute("aria-label", p ? "Start automatic rotation" : "Pause automatic rotation");
    track.setAttribute("aria-live", p ? "polite" : "off");
  }
  function tick(t) {
    if (last === null) last = t;
    var dt = t - last; last = t;
    if (playing()) {
      elapsed += dt;
      if (elapsed >= DWELL) { go(index + 1, false); }
    }
    var fill = dots[index].querySelector(".fill");
    fill.style.setProperty("--p", Math.min(elapsed / DWELL, 1).toFixed(4));
    requestAnimationFrame(tick);
  }

  pauseBtn.addEventListener("click", function () { setPaused(!userPaused); });
  $(".stories-prev", root).addEventListener("click", function () { go(index - 1, true); });
  $(".stories-next", root).addEventListener("click", function () { go(index + 1, true); });
  root.addEventListener("mouseenter", function () { hovering = true; });
  root.addEventListener("mouseleave", function () { hovering = false; });
  /* Keyboard focus inside the carousel stops the rotation; a mouse click on a control does not */
  root.addEventListener("focusin", function (e) {
    var kb = true;
    try { kb = e.target.matches(":focus-visible"); } catch (err) { /* older browsers: treat as keyboard */ }
    focused = kb;
  });
  root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) focused = false; });
  root.addEventListener("keydown", function () { focused = true; });
  controls.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { go(index + 1, true); e.preventDefault(); }
    if (e.key === "ArrowLeft") { go(index - 1, true); e.preventDefault(); }
  });

  /* Swipe on touch screens */
  var x0 = null, y0 = null;
  track.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") { x0 = e.clientX; y0 = e.clientY; } });
  track.addEventListener("pointerup", function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1), true);
  });
  track.addEventListener("pointercancel", function () { x0 = null; });

  /* Rotate only while the carousel is on screen, so every visitor starts on the first story */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible = e.isIntersecting; });
    }, { threshold: 0.35 }).observe(root);
  } else { visible = true; }

  setPaused(userPaused);
  render();
  requestAnimationFrame(tick);
})();
