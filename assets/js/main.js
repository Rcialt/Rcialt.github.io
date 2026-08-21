// Mobile nav, gallery lightbox, scroll reveals, header shadow. No dependencies.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      // the sticky call bar hides while the menu is open (CSS body.nav-open)
      document.body.classList.toggle("nav-open", open);
    });
  }

  // Mobile accordion sub-menus (Services / Service Areas chevrons)
  document.querySelectorAll(".sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var li = btn.closest(".has-sub");
      var open = li.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      // close the other accordion so the menu stays short
      document.querySelectorAll(".has-sub.open").forEach(function (other) {
        if (other !== li) {
          other.classList.remove("open");
          var ob = other.querySelector(".sub-toggle");
          if (ob) ob.setAttribute("aria-expanded", "false");
        }
      });
    });
  });

  // Header shadow once the page scrolls (rAF-throttled)
  var header = document.querySelector(".site-header");
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle("scrolled", window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Scroll-reveal: desktop polish only — phones skip it entirely for
  // smooth scrolling (CSS force-shows .reveal below 960px regardless)
  if ("IntersectionObserver" in window &&
      window.matchMedia("(min-width: 960px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var targets = document.querySelectorAll(
      ".section .wrap > *, .card, .review, .value"
    );
    targets.forEach(function (el) { el.classList.add("reveal"); });
    var fired = false;
    var io = new IntersectionObserver(function (entries) {
      fired = true;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
    // Safety net: if the observer never fires (odd embedded/legacy contexts),
    // reveal everything rather than leave content hidden.
    setTimeout(function () {
      if (!fired) {
        document.documentElement.classList.add("reveal-off");
      }
    }, 2500);
  }

  // Archived review timestamps: render "N years ago" from data-date so
  // they read exactly like the live Google ones.
  document.querySelectorAll(".rev-when[data-date]").forEach(function (el) {
    var d = new Date(el.dataset.date);
    if (isNaN(d)) return;
    var months = Math.max(0, Math.round((Date.now() - d.getTime()) / 2629800000));
    var label = months < 1 ? "recently"
      : months < 12 ? months + (months === 1 ? " month ago" : " months ago")
      : Math.floor(months / 12) + (Math.floor(months / 12) === 1 ? " year ago" : " years ago");
    el.textContent = " · " + label;
  });

  // Live Google reviews: loads fresh from Google on every visit (newest
  // first), swaps in for the curated reviews when it succeeds. Requires
  // google_maps_key + google_place_id in content/site.json.
  var gbox = document.getElementById("google-reviews");
  if (gbox && gbox.dataset.key && gbox.dataset.place) {
    window.__initGReviews = function () {
      google.maps.importLibrary("places").then(function (lib) {
        var place = new lib.Place({ id: gbox.dataset.place });
        return place.fetchFields({
          fields: ["reviews", "rating", "userRatingCount"]
        }).then(function () { return place; });
      }).then(function (place) {
        var reviews = (place.reviews || []).slice().sort(function (a, b) {
          return new Date(b.publishTime || 0) - new Date(a.publishTime || 0);
        }).filter(function (r) {
          var txt = typeof r.text === "string" ? r.text : (r.text && r.text.text);
          return (r.rating || 0) >= 4 && txt;
        }).slice(0, 9);
        if (!reviews.length) return;
        var grid = gbox.querySelector(".greviews-grid");
        var normName = function (s) {
          var t = (s || "").split("·")[0].toLowerCase()
            .replace(/[^a-z ]/g, " ").trim().split(/\s+/).filter(Boolean);
          return t.length ? t[0] + " " + t[t.length - 1] : "";
        };
        // Build one combined, date-sorted pool: Google's live reviews plus
        // archived ones from authors the live batch doesn't include —
        // newest first no matter the source, nobody twice, max 9.
        var pool = reviews.map(function (r) {
          var b = document.createElement("blockquote");
          b.className = "review";
          var p = document.createElement("p");
          var txt = typeof r.text === "string" ? r.text : (r.text && r.text.text) || "";
          p.textContent = txt.length > 320 ? txt.slice(0, 317) + "…" : txt;
          var f = document.createElement("footer");
          var author = (r.authorAttribution && r.authorAttribution.displayName) || "Google review";
          f.textContent = author + " · " + "★".repeat(Math.round(r.rating || 5)) +
            (r.relativePublishTimeDescription ? " · " + r.relativePublishTimeDescription : "");
          b.appendChild(p); b.appendChild(f);
          // publishTime is a Date object — normalize to ISO so it compares
          // correctly against the archive's YYYY-MM-DD strings
          var iso = (r.publishTime && r.publishTime.toISOString)
            ? r.publishTime.toISOString()
            : String(r.publishTime || "");
          return { node: b, date: iso, name: normName(author) };
        });
        var seen = pool.map(function (x) { return x.name; });
        var curated = document.getElementById("curated-reviews");
        if (curated) {
          curated.querySelectorAll(".review").forEach(function (b) {
            var nm = normName((b.querySelector("footer") || {}).textContent);
            if (nm && seen.indexOf(nm) === -1) {
              var clone = b.cloneNode(true);
              // strip scroll-reveal state or the clone renders invisible
              clone.classList.remove("reveal", "in-view");
              pool.push({ node: clone,
                          date: b.dataset.date || "", name: nm });
              seen.push(nm);
            }
          });
          curated.hidden = true;
        }
        pool.sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        pool.slice(0, 9).forEach(function (x) { grid.appendChild(x.node); });
        if (place.rating) {
          gbox.querySelector(".greviews-stars").textContent =
            "★★★★★".slice(0, Math.round(place.rating));
          gbox.querySelector(".greviews-summary").textContent =
            place.rating.toFixed(1) + " on Google · " +
            (place.userRatingCount || reviews.length) + " reviews";
        }
        gbox.hidden = false;
      }).catch(function () { /* keep curated reviews */ });
    };
    var s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + gbox.dataset.key +
            "&v=weekly&loading=async&callback=__initGReviews";
    s.async = true;
    s.onerror = function () { /* keep curated reviews */ };
    document.head.appendChild(s);
  }

  var lightbox = document.querySelector(".lightbox");
  if (lightbox) {
    var img = lightbox.querySelector("img");
    document.querySelectorAll("[data-lightbox]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        img.src = a.getAttribute("href");
        img.alt = a.querySelector("img") ? a.querySelector("img").alt : "";
        lightbox.hidden = false;
        document.body.style.overflow = "hidden";
      });
    });
    function close() {
      lightbox.hidden = true;
      img.src = "";
      document.body.style.overflow = "";
    }
    lightbox.addEventListener("click", function (e) {
      if (e.target !== img) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) close();
    });
  }
})();

// ---- sticky mobile call bar: step aside while the visitor is reading ------
// Scrolling down tucks the bar away so it never covers content mid-read;
// pausing or scrolling back up brings it back (that's when people act).
(function () {
  var bar = document.querySelector(".mobile-cta");
  if (!bar) return;
  var lastY = window.scrollY || 0, idleT = null;
  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    if (y > lastY + 6 && y > 160) bar.classList.add("mcta-hidden");
    else if (y < lastY - 6) bar.classList.remove("mcta-hidden");
    lastY = y;
    clearTimeout(idleT);
    idleT = setTimeout(function () { bar.classList.remove("mcta-hidden"); }, 500);
  }, { passive: true });
})();

// ---- homepage "Recent Projects" conveyor ----------------------------------
// Every cycle the WHOLE row rolls one slot to the right in unison: a fresh
// gallery photo slides in from the left edge and the rightmost photo exits.
// Paused off-screen and while hovered; skipped for reduced-motion users.
(function () {
  var strip = document.getElementById("shuffle-strip");
  var track = strip && strip.querySelector(".strip-track");
  var pool = window.RCI_STRIP_POOL;
  var alts = window.RCI_STRIP_ALTS || [];
  if (!strip || !track || !pool || pool.length < 8) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var THUMB = "/assets/img/gallery/thumbs/";
  var inUse = {};
  Array.prototype.forEach.call(track.querySelectorAll("img"), function (img) {
    inUse[img.getAttribute("src").split("/").pop()] = true;
  });

  function pickFresh() {
    for (var t = 0; t < 30; t++) {
      var i = Math.floor(Math.random() * pool.length);
      if (!inUse[pool[i]]) return i;
    }
    return -1;
  }

  var animating = false;
  function tick() {
    if (animating) return;
    var pi = pickFresh();
    if (pi < 0) return;
    var tiles = track.children;
    if (tiles.length < 2) return;
    // one slot = distance between neighbouring tiles (width + gap)
    var step = tiles[1].getBoundingClientRect().left -
               tiles[0].getBoundingClientRect().left;
    if (step <= 0) return;
    var img = new Image();
    img.alt = alts[pi] || "Rondeau Construction project in Grand County";
    img.width = 320; img.height = 200;
    img.onerror = function () { animating = false; };
    img.onload = function () {
      animating = true;
      inUse[pool[pi]] = true;
      var a = document.createElement("a");
      a.href = "/gallery/";
      a.appendChild(img);
      // insert the new tile at the left, snap the track one slot left,
      // then glide the whole row right together back to rest
      track.insertBefore(a, track.firstChild);
      track.style.transition = "none";
      track.style.transform = "translateX(" + (-step) + "px)";
      void track.offsetWidth;
      track.style.transition = "transform 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)";
      track.style.transform = "translateX(0)";
      setTimeout(function () {
        while (track.children.length > 6) {
          var last = track.lastElementChild;
          var li = last.querySelector("img");
          if (li) delete inUse[li.getAttribute("src").split("/").pop()];
          track.removeChild(last);
        }
        animating = false;
      }, 950);
    };
    img.src = THUMB + pool[pi];
  }

  var timer = null;
  function start() {
    if (timer) return;
    tick();                              // roll IMMEDIATELY on becoming visible
    timer = setInterval(tick, 2400);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  // roll only while on screen and not hovered (hover = visitor is looking)
  var inView = !("IntersectionObserver" in window), hovered = false;
  function update() { (inView && !hovered) ? start() : stop(); }
  strip.addEventListener("mouseenter", function () { hovered = true; update(); });
  strip.addEventListener("mouseleave", function () { hovered = false; update(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView = e.isIntersecting; update(); });
    }, { threshold: 0.1 }).observe(strip);   // begin as soon as it edges into view
  } else {
    update();
  }
})();
