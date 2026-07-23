// Mobile nav, gallery lightbox, scroll reveals, header shadow. No dependencies.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
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
