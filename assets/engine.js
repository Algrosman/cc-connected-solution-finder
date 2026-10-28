/* Solution finder engine: decides which questions apply and scores products.
   Pure functions with no DOM access, so they can be tested outside the browser. */
(function (root) {
  "use strict";

  function statusAllows(item, status) {
    return !item.status || !status || item.status.indexOf(status) !== -1;
  }

  function whenAllows(question, answers) {
    if (!question.when) return true;
    return Object.keys(question.when).some(function (qid) {
      return answers[qid] !== undefined && question.when[qid].indexOf(answers[qid]) !== -1;
    });
  }

  function optionsFor(question, status) {
    return question.options.filter(function (o) { return statusAllows(o, status); });
  }

  /* Questions for the domain, in order, given the answers so far. A question only
     appears once every earlier question it depends on has been answered. */
  function questionsFor(finder, status, domain, answers) {
    var list = (finder.questions[domain] || []).filter(function (q) { return statusAllows(q, status); });
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.when) {
        var deps = Object.keys(q.when);
        var pending = deps.some(function (d) {
          return answers[d] === undefined && out.some(function (o) { return o.id === d; });
        });
        if (pending) break; // wait until the dependency is answered
        if (!whenAllows(q, answers)) continue;
      }
      out.push(q);
    }
    return out;
  }

  function nextQuestion(finder, status, domain, answers) {
    var qs = questionsFor(finder, status, domain, answers);
    for (var i = 0; i < qs.length; i++) if (answers[qs[i].id] === undefined) return qs[i];
    // dependencies may unlock further questions once answered
    var again = questionsFor(finder, status, domain, answers);
    for (var j = 0; j < again.length; j++) if (answers[again[j].id] === undefined) return again[j];
    return null;
  }

  function chosenOption(question, status, answers) {
    var id = answers[question.id];
    if (id === undefined) return null;
    var opts = optionsFor(question, status);
    for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i];
    return null;
  }

  function fits(product, status) {
    return !status || product.fit.indexOf(status) !== -1;
  }

  /* Score every product in the domain that is offered to this hospital type. */
  function rank(catalog, finder, status, domain, answers) {
    var qs = questionsFor(finder, status, domain, answers);
    var totals = {};
    qs.forEach(function (q) {
      var opt = chosenOption(q, status, answers);
      if (!opt || !opt.scores) return;
      Object.keys(opt.scores).forEach(function (pid) { totals[pid] = (totals[pid] || 0) + opt.scores[pid]; });
    });
    return catalog
      .map(function (p, idx) { return { product: p, score: totals[p.id] || 0, idx: idx }; })
      .filter(function (r) { return r.product.domain === domain && fits(r.product, status); })
      .sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
  }

  function recommend(catalog, finder, status, domain, answers) {
    var ranked = rank(catalog, finder, status, domain, answers);
    if (!ranked.length) return null;
    var top = ranked[0];
    var alts = ranked.slice(1).filter(function (r) { return r.score > 0; }).slice(0, 2);
    if (alts.length < 2) {
      ranked.slice(1).forEach(function (r) { if (alts.length < 2 && alts.indexOf(r) === -1) alts.push(r); });
    }
    return { top: top.product, score: top.score, alternatives: alts.map(function (r) { return r.product; }), ranked: ranked };
  }

  /* Which products are still "in play" for the portfolio map. */
  function inPlay(catalog, finder, status, domain, answers) {
    var set = {};
    catalog.forEach(function (p) {
      if (fits(p, status) && (!domain || p.domain === domain)) set[p.id] = true;
    });
    if (domain) {
      var ranked = rank(catalog, finder, status, domain, answers);
      var positive = ranked.filter(function (r) { return r.score > 0; });
      if (positive.length) {
        set = {};
        positive.forEach(function (r) { set[r.product.id] = true; });
      }
    }
    return set;
  }

  root.CCEngine = {
    optionsFor: optionsFor,
    questionsFor: questionsFor,
    nextQuestion: nextQuestion,
    chosenOption: chosenOption,
    fits: fits,
    rank: rank,
    recommend: recommend,
    inPlay: inPlay
  };
})(typeof window !== "undefined" ? window : globalThis);
