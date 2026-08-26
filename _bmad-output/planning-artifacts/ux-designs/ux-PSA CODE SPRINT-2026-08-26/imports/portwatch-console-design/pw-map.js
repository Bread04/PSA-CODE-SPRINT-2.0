/* Portwatch map surfaces — two read-only custom elements.
   pw-strait-map : real Natural Earth geometry (world-atlas 110m) via d3-geo, Mercator-fit to the Singapore Strait.
   pw-plan-view  : terminal schematic (berths, cranes, yard blocks, IGT link) — a plan drawing, not geography.
   Both take a JSON `state` attribute and redraw on change. No pan, no zoom, no tiles. */

const ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
let landPromise = null;

function land() {
  if (!landPromise) {
    landPromise = fetch(ATLAS)
      .then((r) => r.json())
      .then((topo) => window.topojson.feature(topo, topo.objects.countries));
  }
  return landPromise;
}

function ready() {
  if (window.d3 && window.topojson) return Promise.resolve();
  return new Promise((res) => {
    const t = setInterval(() => {
      if (window.d3 && window.topojson) { clearInterval(t); res(); }
    }, 40);
  });
}

const HEAD = "font-family:var(--font-heading);font-weight:600";
const lerp = (a, b, t) => a + (b - a) * t;

class Base extends HTMLElement {
  static get observedAttributes() { return ["state"]; }
  label() { return "Diagram"; }
  get st() {
    try { return JSON.parse(this.getAttribute("state") || "{}"); } catch (e) { return {}; }
  }
  connectedCallback() {
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";
    this.render();
  }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
}

/* ── Strait approach — real coastline geometry ─────────────────────────── */
class StraitMap extends Base {
  label() {
    const s = this.st;
    return "Strait approach map, Natural Earth coastline. MSC ANNA is inbound along the western approach to Tuas, " +
      Math.round((s.progress || 0) * 100) + " percent of the way from the Malacca Strait congestion zone, ETA 15:50, ninety minutes late. Pasir Panjang is marked to the east. Mocked positions, not a live AIS feed.";
  }
  render() {
    const s = this.st;
    ready().then(() => land()).then((feat) => {
      const W = this.clientWidth || 420, H = this.clientHeight || 260;
      const d3 = window.d3;
      const frame = { type: "MultiPoint", coordinates: [[99.2, -1.4], [105.9, -1.4], [105.9, 4.6], [99.2, 4.6]] };
      const proj = d3.geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], frame);
      const path = d3.geoPath(proj);
      const P = (lon, lat) => proj([lon, lat]);

      const TUAS = [103.62, 1.24], PP = [103.77, 1.27];
      const A = [101.35, 2.55], B = [102.4, 1.85], C = [103.62, 1.24];
      const CONG = [102.05, 2.05];
      const prog = Math.max(0, Math.min(1, s.progress == null ? 0.35 : s.progress));
      const seg = prog < 0.5 ? [A, B, prog / 0.5] : [B, C, (prog - 0.5) / 0.5];
      const ship = P(lerp(seg[0][0], seg[1][0], seg[2]), lerp(seg[0][1], seg[1][1], seg[2]));
      const pa = P(...A), pb = P(...B), pc = P(...C), pcg = P(...CONG), pt = P(...TUAS), pp = P(...PP);

      this.innerHTML =
        '<svg role="img" aria-label="' + this.label().replace(/"/g, "&quot;") + '" viewBox="0 0 ' + W + " " + H + '" width="100%" height="100%" style="display:block">' +
        '<defs><clipPath id="pwClip"><rect x="0" y="0" width="' + W + '" height="' + H + '"/></clipPath></defs>' +
        '<rect width="' + W + '" height="' + H + '" style="fill:var(--color-bg)"/>' +
        '<g clip-path="url(#pwClip)">' + feat.features.map((f) => '<path d="' + (path(f) || "") + '" style="fill:var(--color-neutral-200);stroke:var(--color-neutral-400);stroke-width:.7"/>').join("") + '</g>' +
        '<g style="stroke:var(--color-neutral-400);stroke-width:.5">' +
        [0, 1, 2, 3].map((i) => '<line x1="0" y1="' + (H / 4 * i + 14) + '" x2="' + W + '" y2="' + (H / 4 * i + 14) + '"/>').join("") +
        "</g>" +
        '<circle cx="' + pcg[0] + '" cy="' + pcg[1] + '" r="26" style="fill:var(--color-accent);opacity:.12"/>' +
        '<circle cx="' + pcg[0] + '" cy="' + pcg[1] + '" r="26" style="fill:none;stroke:var(--color-accent);stroke-width:1;stroke-dasharray:3 3"/>' +
        '<polyline points="' + [pa, pb, pc].map((p) => p.join(",")).join(" ") + '" style="fill:none;stroke:var(--color-accent-700);stroke-width:1.2;stroke-dasharray:5 4"/>' +
        '<g transform="translate(' + ship[0] + "," + ship[1] + ')">' +
        '<rect x="-7" y="-3.5" width="14" height="7" style="fill:var(--color-accent);stroke:var(--color-accent-900);stroke-width:.8"/>' +
        '<rect x="-11" y="-1" width="22" height="2" style="fill:var(--color-accent-900)"/></g>' +
        '<text x="' + (ship[0] + 14) + '" y="' + (ship[1] - 6) + '" style="' + HEAD + ';font-size:11px;letter-spacing:.06em;fill:var(--color-text)">MSC ANNA</text>' +
        '<text x="' + (ship[0] + 14) + '" y="' + (ship[1] + 6) + '" style="font-family:var(--font-body);font-size:10px;fill:var(--color-neutral-700)">ETA 15:50 (+90)</text>' +
        '<text x="' + (pcg[0] - 24) + '" y="' + (pcg[1] - 32) + '" style="' + HEAD + ';font-size:10px;letter-spacing:.12em;fill:var(--color-accent-700)">CONGESTION</text>' +
        '<g><circle cx="' + pt[0] + '" cy="' + pt[1] + '" r="4" style="fill:var(--color-accent-900)"/>' +
        '<text x="' + (pt[0] - 6) + '" y="' + (pt[1] + 18) + '" text-anchor="end" style="' + HEAD + ';font-size:11px;letter-spacing:.06em;fill:var(--color-text)">TUAS</text></g>' +
        '<g><circle cx="' + pp[0] + '" cy="' + pp[1] + '" r="3" style="fill:none;stroke:var(--color-accent-900);stroke-width:1.2"/>' +
        '<text x="' + (pp[0] + 8) + '" y="' + (pp[1] + 16) + '" style="' + HEAD + ';font-size:10px;letter-spacing:.06em;fill:var(--color-neutral-700)">PASIR PANJANG</text></g>' +
        '<text x="10" y="' + (H - 10) + '" style="' + HEAD + ';font-size:10px;letter-spacing:.14em;fill:var(--color-neutral-700)">SINGAPORE STRAIT · WESTERN APPROACH</text>' +
        '<text x="' + (W - 10) + '" y="' + (H - 10) + '" text-anchor="end" style="font-family:var(--font-body);font-size:11px;fill:var(--color-neutral-700)">Natural Earth 110m · mocked track</text>' +
        "</svg>";
    });
  }
}

/* ── Terminal plan view — schematic ───────────────────────────────────── */
class PlanView extends Base {
  label() {
    const s = this.st;
    if (s.mode === "gate") {
      return "Gate complex plan. Four truck lanes; gate G2 " + (s.resolved
        ? "cleared, dwell down to 8.1 minutes after 18 appointment slots were shifted to 15:00 to 15:30"
        : "congested, dwell 11.4 minutes against a 9.0 threshold, appointment grid oversubscribed by 18 slots") + ".";
    }
    return "Terminal plan of Tuas Phase 1. Berth C7-3 holds MSC ANNA on a window extended by " + (s.delay || 45) +
      " minutes; crane C4 is faulty and crane C7 has telemetry stale by 340 seconds; yard block C7-B12 is at " + (s.b12 || "94%") +
      " with an IMDG 5.1 segregation constraint in slot 04; " + (s.replanned
        ? "the 340-box overflow is routed over inter-gateway transfer to Pasir Panjang P2, now at " + (s.p2 || "73%")
        : "the inter-gateway link to Pasir Panjang P2 at " + (s.p2 || "61%") + " is idle") + ".";
  }
  render() {
    const s = this.st;
    const W = 720, H = 300;
    const acc = "var(--color-accent)", ink = "var(--color-text)", mut = "var(--color-neutral-700)";
    const box = (x, y, w, h, on) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="fill:' + (on ? "var(--color-accent-100)" : "none") + ";stroke:" + (on ? acc : "var(--color-neutral-400)") + ';stroke-width:' + (on ? 1.4 : 0.9) + '"/>';
    const lab = (x, y, t, size, color, anchor) => '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "start") + '" style="' + HEAD + ";font-size:" + (size || 11) + "px;letter-spacing:.07em;fill:" + (color || ink) + '">' + t + "</text>";
    const small = (x, y, t, anchor) => '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "start") + '" style="font-family:var(--font-body);font-size:11px;fill:' + mut + '">' + t + "</text>";

    let g = "";

    if (s.mode === "gate") {
      g += lab(14, 22, "GATE COMPLEX — TRUCK LANES", 11, mut);
      for (let i = 0; i < 4; i++) {
        const on = i === 1;
        const x = 30 + i * 165;
        g += box(x, 40, 130, 54, on) + lab(x + 10, 62, "GATE G" + (i + 1), 12, on ? "var(--color-accent-800)" : ink);
        g += small(x + 10, 80, on ? (s.resolved ? "dwell 8.1 min · cleared" : "dwell 11.4 min · over") : "dwell 6.2 min");
        const q = on ? (s.resolved ? 3 : 9) : 2;
        for (let t = 0; t < q; t++) g += '<rect x="' + (x + 8 + t * 13) + '" y="104" width="9" height="16" style="fill:' + (on ? acc : "var(--color-neutral-400)") + '"/>';
      }
      g += lab(14, 168, "APPOINTMENT GRID 14:00 – 15:30", 11, mut);
      for (let i = 0; i < 18; i++) {
        const shifted = s.resolved && i >= 6;
        g += '<rect x="' + (30 + (i % 9) * 42) + '" y="' + (182 + Math.floor(i / 9) * 30) + '" width="34" height="22" style="fill:' + (shifted ? "var(--color-accent-100)" : "none") + ";stroke:" + (shifted ? acc : "var(--color-neutral-400)") + ';stroke-width:.9"/>';
      }
      g += small(30, 258, s.resolved ? "18 slots shifted to 15:00–15:30 — Tier 1, auto-executed, no approval requested" : "14:00–14:30 oversubscribed by 18 slots");
    } else {
      /* quay + berths */
      g += '<rect x="0" y="0" width="' + W + '" height="30" style="fill:var(--color-accent-100)"/>';
      g += small(14, 19, "SINGAPORE STRAIT");
      g += '<line x1="0" y1="34" x2="' + W + '" y2="34" style="stroke:var(--color-neutral-900);stroke-width:1.6"/>';
      g += lab(14, 52, "QUAY — TUAS PHASE 1", 10, mut);

      /* cranes */
      const cranes = [["C1", 0], ["C4", 2], ["C7", 3], ["C9", 4], ["C11", 5]];
      cranes.forEach(([name, i]) => {
        const x = 40 + i * 108;
        const fault = name === "C4", stale = name === "C7";
        const col = fault ? "var(--color-accent-900)" : stale ? acc : "var(--color-neutral-500)";
        g += '<g style="stroke:' + col + ';stroke-width:1.3;fill:none' + (fault ? ";stroke-dasharray:3 3" : "") + '">' +
          '<line x1="' + x + '" y1="34" x2="' + x + '" y2="76"/><line x1="' + (x + 26) + '" y1="34" x2="' + (x + 26) + '" y2="76"/>' +
          '<line x1="' + (x - 8) + '" y1="60" x2="' + (x + 40) + '" y2="60"/></g>';
        g += lab(x + 13, 90, name, 10, fault ? "var(--color-accent-900)" : stale ? "var(--color-accent-800)" : mut, "middle");
        if (fault) g += small(x + 13, 102, "fault", "middle");
        if (stale) g += small(x + 13, 102, "stale 340s", "middle");
      });

      /* berths */
      [["C7-1", 0], ["C7-3", 1], ["C7-5", 2]].forEach(([name, i]) => {
        const x = 30 + i * 230, on = name === "C7-3";
        g += box(x, 112, 210, 34, on) + lab(x + 10, 134, name, 11, on ? "var(--color-accent-800)" : ink);
        if (on) g += small(x + 78, 134, "MSC ANNA · window +" + (s.delay || 45) + " min");
        if (name === "C7-5") g += small(x + 66, 134, "SGP-4471 · " + (s.resolved ? "slot held" : "at risk"));
      });

      /* yard */
      g += lab(14, 176, "YARD — TUAS BLOCK C7", 10, mut);
      ["B10", "B11", "B12", "B13", "B14"].forEach((b, i) => {
        const x = 30 + i * 82, on = b === "B12";
        g += box(x, 186, 70, 52, on) + lab(x + 35, 208, b, 11, on ? "var(--color-accent-800)" : ink, "middle");
        g += small(x + 35, 224, on ? (s.b12 || "94%") : ["71%", "68%", "", "77%", "64%"][i], "middle");
        if (on) g += small(x + 35, 236, "IMDG 5.1", "middle");
      });

      /* IGT link + Pasir Panjang */
      const live = !!s.replanned;
      g += '<path d="M 452 212 C 500 212 510 212 540 212" style="fill:none;stroke:' + (live ? acc : "var(--color-neutral-400)") + ";stroke-width:" + (live ? 2 : 1) + (live ? "" : ";stroke-dasharray:4 4") + '"/>';
      g += lab(496, 202, "IGT", 9, live ? "var(--color-accent-800)" : mut, "middle");
      g += box(540, 186, 160, 52, live) + lab(550, 208, "PASIR PANJANG P2", 10, live ? "var(--color-accent-800)" : ink);
      g += small(550, 224, (s.p2 || "61%") + (live ? " · absorbing 340 boxes" : " · spare capacity"));
      g += small(14, 266, live ? "Re-plan routes 340-box overflow off Tuas C7-B12 to Pasir Panjang P2 over inter-gateway transfer" : "IMDG segregation constraint active in C7-B12 slot 04 — overflow into B12 blocked");
    }

    this.innerHTML = '<svg role="img" aria-label="' + this.label().replace(/"/g, "&quot;") + '" viewBox="0 0 ' + W + " " + H + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">' + g + "</svg>";
  }
}

if (!customElements.get("pw-strait-map")) customElements.define("pw-strait-map", StraitMap);
if (!customElements.get("pw-plan-view")) customElements.define("pw-plan-view", PlanView);
