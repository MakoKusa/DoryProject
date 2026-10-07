(function () {
  "use strict";
  var main = document.getElementById("main");
  if (!main) return;

  function padOptions(html, targetLines) {
    var lines = html.split("\n");
    var first = lines.findIndex(function (line) { return /^╔.* OPTIONS .*╗$/.test(line); });
    if (first < 0) return html;
    var last = lines.findIndex(function (line, i) { return i > first && /^╚═+╝$/.test(line); });
    if (last < 0) return html;
    var count = last - first + 1, missing = Math.max(0, targetLines - count);
    if (!missing) return html;
    var width = lines[first].length - 2;
    var blank = "║" + " ".repeat(width) + "║";
    var footer = lines.findIndex(function (line, i) { return i > first && i < last && line.indexOf("ECHAP : RETOUR") >= 0; });
    lines.splice.apply(lines, [footer < 0 ? last : footer, 0].concat(Array(missing).fill(blank)));
    return lines.join("\n");
  }

  function update() {
    var pre = main.querySelector("pre");
    if (!pre) { main.classList.remove("has-terminal-stream"); return; }
    var text = pre.textContent, first = text.split("\n").find(function (line) { return line.trim().length > 0; }) || "";
    var framed = /^\s*[╔╚║]/.test(first);
    main.classList.toggle("has-terminal-stream", !framed && main.firstElementChild === pre);
    if (/^╔.* OPTIONS .*╗$/.test(first)) {
      var width = first.length - 2;
      var padded = padOptions(pre.innerHTML, width < 60 ? 22 : 18);
      if (padded !== pre.innerHTML) pre.innerHTML = padded;
    }
    if (main.classList.contains("has-terminal-stream")) pre.scrollTop = pre.scrollHeight;
  }

  /* Screen replacements only: no observation of our own padding edits. */
  new MutationObserver(update).observe(main, { childList: true });
  window.addEventListener("resize", update);
  update();
})();
