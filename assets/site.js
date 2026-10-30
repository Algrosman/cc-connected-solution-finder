/* Cleveland Clinic Connected public site: contact links and small page settings from assets/config.js. */
(function () {
  "use strict";
  var CONFIG = window.CC_CONFIG || {};
  var email = CONFIG.contactEmail || "ccconnected@ccf.org";
  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  if (CONFIG.showPrototypeNotice === false && $("#protoNote")) $("#protoNote").hidden = true;

  // Every contact link uses the configured address; the subject lines stay as written in the page
  $all('a[href^="mailto:"]').forEach(function (a) {
    var q = a.getAttribute("href").split("?")[1];
    a.href = "mailto:" + email + (q ? "?" + q : "");
    if (a.id === "footerEmail" || a.classList.contains("custom-ask-email")) a.textContent = email;
  });

  var y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();
