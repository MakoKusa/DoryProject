(function () {
  "use strict";
  var main = document.getElementById("main");
  if (!main) return;
  var frame = null, raf = 0, last = 0, x = 12, y = 12, vx = 90, vy = 60;

  function getLimits(width, height, itemWidth, itemHeight, bottomInset) {
    var gap = 8;
    var usableWidth = Math.max(1, width - gap * 2);
    var usableHeight = Math.max(1, height - bottomInset - gap * 2);
    var scale = Math.min(1, usableWidth / Math.max(1, itemWidth), usableHeight / Math.max(1, itemHeight));
    return { scale: scale, minX: gap, minY: gap,
      maxX: Math.max(gap, width - gap - itemWidth * scale),
      maxY: Math.max(gap, height - bottomInset - gap - itemHeight * scale) };
  }

  function move(now) {
    raf = 0;
    if (!frame || !frame.isConnected) { last = 0; return; }
    var viewport = window.visualViewport;
    var width = viewport ? viewport.width : document.documentElement.clientWidth;
    var height = viewport ? viewport.height : window.innerHeight;
    var offsetX = viewport ? viewport.offsetLeft : 0, offsetY = viewport ? viewport.offsetTop : 0;
    var bar = document.getElementById("tbar"), inset = 0;
    if (bar) {
      var rect = bar.getBoundingClientRect();
      if (rect.height > 0) inset = Math.max(0, Math.min(height, offsetY + height - rect.top));
    }
    var limits = getLimits(width, height, frame.offsetWidth, frame.offsetHeight, inset);
    var dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    x += vx * dt; y += vy * dt;
    if (x <= limits.minX) { x = limits.minX; vx = Math.abs(vx); }
    else if (x >= limits.maxX) { x = limits.maxX; vx = -Math.abs(vx); }
    if (y <= limits.minY) { y = limits.minY; vy = Math.abs(vy); }
    else if (y >= limits.maxY) { y = limits.maxY; vy = -Math.abs(vy); }
    frame.style.transform = "translate3d(" + (offsetX + x).toFixed(2) + "px," + (offsetY + y).toFixed(2) + "px,0) scale(" + limits.scale.toFixed(5) + ")";
    raf = requestAnimationFrame(move);
  }

  function sync() {
    var candidate = main.querySelector("pre"), lines = candidate ? candidate.textContent.split("\n") : [];
    var first = lines.findIndex(function (line) { return /^ *╔═* VEILLE ═*╗$/.test(line); });
    var sleeping = first >= 0;
    document.documentElement.classList.toggle("viewport-sleep", sleeping);
    if (!sleeping) {
      frame = null; last = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0; return;
    }
    var indent = lines[first].indexOf("╔"), normalized = lines.slice(first).map(function (line) { return line.slice(indent); }).join("\n");
    if (candidate !== frame) {
      candidate.textContent = normalized;
      candidate.classList.add("viewport-sleep-frame");
      frame = candidate;
    }
    if (!raf) raf = requestAnimationFrame(move);
  }

  /* Observe screen replacement, not text edits, to avoid redraw loops. */
  new MutationObserver(sync).observe(main, { childList: true });
  window.addEventListener("resize", sync);
  document.addEventListener("visibilitychange", function () { last = 0; });
  sync();
})();
