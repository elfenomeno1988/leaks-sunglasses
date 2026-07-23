/* ════════════════════════════════════════════════════════════
   LEAKS — L'application mobile
   Coquille native en un fichier : routage par hash, écrans,
   pager de vues, réservation concierge sur l'API bookings.
   ════════════════════════════════════════════════════════════ */

(() => {
  const CONFIG = {
    brandName: "LEAKS",
    whatsappNumber: "2250173891404",
    dropDate: "2026-07-25T20:00:00Z",
    orderOpenAt: "2026-07-24T00:00:00Z"
  };

  const SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const MORNING = new Set(["10:00", "11:00", "12:00"]);
  const DAYS_SHOWN = 12;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const models = window.LEAKS_MODELS || [];
  const accessories = window.LEAKS_ACCESSORIES || [];
  const money = (v) => `${new Intl.NumberFormat("fr-FR").format(v)} F`;

  /* ── WhatsApp générique ────────────────────────────────────── */

  const waGeneric = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Bonjour ${CONFIG.brandName}, j'aimerais des renseignements sur le Drop 004.`)}`;
  $("#ah-wa").href = waGeneric;
  $("#st-wa").href = waGeneric;

  /* ── Compte à rebours ──────────────────────────────────────── */

  const dropTime = new Date(CONFIG.dropDate).getTime();
  const cd = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  function tick() {
    const diff = Math.max(0, dropTime - Date.now());
    cd.d.textContent = String(Math.floor(diff / 864e5)).padStart(2, "0");
    cd.h.textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, "0");
    cd.m.textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, "0");
    cd.s.textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  /* ── Routage : #/drop · #/collection · #/model/<id> · #/rdv · #/info ──── */

  const screens = $$(".screen");
  const tabs = $$(".tabbar a");
  const backBtn = $("#ah-back");
  const ROOTS = new Set(["drop", "collection", "rdv", "info"]);

  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "drop").split("/");
    const name = ROOTS.has(parts[0]) || parts[0] === "model" ? parts[0] : "drop";

    if (name === "model" && parts[1]) openModel(parts[1], parts[2]);

    screens.forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
    document.body.dataset.view = name;
    backBtn.hidden = name !== "model";
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.hash = "#/collection";
  });

  window.addEventListener("hashchange", route);

  /* ── Collection : le fil ───────────────────────────────────── */

  const feed = $("#feed");
  let currentTier = "";
  models.forEach((m, i) => {
    if (m.tier !== currentTier) {
      currentTier = m.tier;
      const heading = document.createElement("h2");
      heading.className = "feed-tier";
      heading.textContent = m.tierLabel;
      feed.appendChild(heading);
    }
    const a = document.createElement("a");
    a.className = "f-card";
    a.href = `#/model/${m.id}`;
    a.innerHTML = `
      <span class="f-visual"><img src="${m.colors[0].image}" alt="LEAKS ${m.name}" ${i > 2 ? 'loading="lazy"' : ""}></span>
      <span class="f-meta">
        <span><span class="f-name"><span class="idx">${String(i + 1).padStart(2, "0")}</span>LEAKS — ${m.name}</span>
        <span class="f-sub">${m.sku} · ${m.colors.length} coloris</span></span>
        <span class="f-price">${money(m.price)}</span>
      </span>`;
    feed.appendChild(a);
  });

  if (accessories.length) {
    const heading = document.createElement("h2");
    heading.className = "feed-tier";
    heading.textContent = "More LEAKS — Accessories";
    feed.appendChild(heading);
    accessories.forEach((item) => {
      const a = document.createElement("a");
      a.className = "f-card accessory-feed";
      a.href = item.purchasable
        ? `/checkout.html?product=${encodeURIComponent(item.id)}&variant=${encodeURIComponent(item.variantId)}`
        : waGeneric;
      if (item.purchasable) a.dataset.orderLink = "";
      if (!item.purchasable) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      a.innerHTML = `
        <span class="f-visual">${item.image
          ? `<img src="${item.image}" alt="${item.name}" loading="lazy">`
          : `<span class="accessory-fallback">LEAKS<br>Travel Case</span>`}</span>
        <span class="f-meta"><span><span class="f-name">${item.name}</span><span class="f-sub">${item.description}</span></span><span class="f-price">${money(item.price)}</span></span>`;
      feed.appendChild(a);
    });
  }

  /* ── Ouverture des commandes ─────────────────────────────── */

  const orderOpenTime = new Date(CONFIG.orderOpenAt).getTime();

  function applyOrderGate() {
    const isOpen = Date.now() >= orderOpenTime;
    $$("[data-order-link]").forEach((link) => {
      if (!link.dataset.originalLabel) link.dataset.originalLabel = link.textContent;
      link.textContent = isOpen ? link.dataset.originalLabel : "Commandes le 24.07.2026";
      link.classList.toggle("is-locked", !isOpen);
      link.setAttribute("aria-disabled", String(!isOpen));
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-order-link].is-locked");
    if (!link) return;
    event.preventDefault();
    $("[data-screen='drop']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  applyOrderGate();
  if (Date.now() < orderOpenTime) {
    setTimeout(applyOrderGate, Math.min(orderOpenTime - Date.now() + 1000, 2_147_000_000));
  }

  /* ── Écran modèle : pager de vues + coloris ────────────────── */

  const pager = $("#pager");
  const dots = $("#pager-dots");
  let currentModel = null;
  let currentColor = null;

  const variantViews = (c) => (c.views && c.views.length ? c.views : [{ label: "Face", src: c.image }]);

  function renderPager() {
    const views = variantViews(currentColor);
    pager.innerHTML = views.map((v) => `<figure><img src="${v.src}" alt="${currentModel.name} — ${v.label}"></figure>`).join("");
    dots.innerHTML = views.map((_, i) => `<i${i === 0 ? ' class="on"' : ""}></i>`).join("");
    pager.scrollTo({ left: 0 });
  }

  pager.addEventListener("scroll", () => {
    const idx = Math.round(pager.scrollLeft / pager.clientWidth);
    $$("i", dots).forEach((d, i) => d.classList.toggle("on", i === idx));
  }, { passive: true });

  function openModel(id, colorId) {
    const m = models.find((x) => x.id === id);
    if (!m) return;
    currentModel = m;
    currentColor = m.colors.find((c) => c.variantId === colorId) || m.colors[0];

    $("#m-name").textContent = `LEAKS — ${m.name}`;
    $("#m-price").textContent = money(m.price);
    $("#m-desc").textContent = m.description;
    $("#m-sku").textContent = m.sku;
    $("#m-color").textContent = currentColor.label;
    $("#m-buy").href = `/checkout.html?product=${encodeURIComponent(m.id)}&variant=${encodeURIComponent(currentColor.variantId)}`;

    const sw = $("#m-swatches");
    sw.innerHTML = "";
    m.colors.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-swatch" + (c === currentColor ? " is-active" : "");
      b.innerHTML = `<img src="${c.image}" alt="">${c.label}`;
      b.addEventListener("click", () => {
        currentColor = c;
        $("#m-color").textContent = c.label;
        $("#m-buy").href = `/checkout.html?product=${encodeURIComponent(m.id)}&variant=${encodeURIComponent(c.variantId)}`;
        $$(".m-swatch", sw).forEach((x) => x.classList.toggle("is-active", x === b));
        renderPager();
      });
      sw.appendChild(b);
    });

    renderPager();
  }

  /* ── Réserver : trois gestes sur l'API bookings ────────────── */

  const rdv = {
    date: "", time: "", name: "", phone: "", note: "",
    reference: "", delivery: "handoff", handoffText: "",
    availability: new Map()
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const frDate = (iso) => {
    const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(`${iso}T00:00:00Z`));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function rdvPanel(name) {
    $$(".rdv-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
    const order = ["moment", "contact", "done"];
    $$("#rdv-steps span").forEach((s) => {
      s.classList.toggle("is-active", order.indexOf(s.dataset.dot) <= order.indexOf(name));
    });
    window.scrollTo(0, 0);
  }

  const daysWrap = $("#days");
  const slotsWrap = $("#slots");
  const toContact = $("#to-contact");

  function buildDays() {
    const base = new Date(`${todayISO()}T00:00:00Z`);
    for (let i = 0; i < DAYS_SHOWN; i += 1) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const sunday = d.getUTCDay() === 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day";
      btn.disabled = sunday;
      btn.dataset.date = iso;
      const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
      const mo = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
      btn.innerHTML = `<em>${i === 0 ? "auj." : wd}</em><b>${d.getUTCDate()}</b><span>${sunday ? "fermé" : mo}</span>`;
      btn.addEventListener("click", () => selectDay(iso, btn));
      daysWrap.appendChild(btn);
    }
    const first = $$(".day", daysWrap).find((b) => !b.disabled);
    if (first) selectDay(first.dataset.date, first);
  }

  async function fetchAvailability(iso) {
    if (rdv.availability.has(iso)) return rdv.availability.get(iso);
    try {
      const res = await fetch(`/api/bookings/availability?date=${iso}`);
      const data = await res.json();
      const taken = new Set(data.booked || []);
      rdv.availability.set(iso, taken);
      return taken;
    } catch { return new Set(); }
  }

  async function selectDay(iso, btn) {
    rdv.date = iso;
    rdv.time = "";
    toContact.disabled = true;
    $$(".day", daysWrap).forEach((b) => b.classList.toggle("is-active", b === btn));
    slotsWrap.innerHTML = '<p class="hint">Le concierge consulte le carnet…</p>';
    const taken = await fetchAvailability(iso);
    if (rdv.date !== iso) return;
    renderSlots(taken);
  }

  function renderSlots(taken) {
    slotsWrap.innerHTML = "";
    const now = new Date();
    const isToday = rdv.date === todayISO();
    [["Matin", (t) => MORNING.has(t)], ["Après-midi", (t) => !MORNING.has(t)]].forEach(([label, match]) => {
      const g = document.createElement("div");
      g.className = "slot-group";
      g.innerHTML = `<span class="tag">${label}</span>`;
      const row = document.createElement("div");
      row.className = "slot-row";
      SLOTS.filter(match).forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        const past = isToday && (() => {
          const [h, mn] = t.split(":").map(Number);
          return h * 60 + mn <= now.getUTCHours() * 60 + now.getUTCMinutes() + 45;
        })();
        if (taken.has(t)) { b.disabled = true; b.innerHTML = `${t}<i>réservé</i>`; }
        else { b.textContent = t; b.disabled = past; }
        b.addEventListener("click", () => {
          rdv.time = t;
          $$(".slot", slotsWrap).forEach((x) => x.classList.toggle("is-active", x === b));
          toContact.disabled = false;
        });
        row.appendChild(b);
      });
      g.appendChild(row);
      slotsWrap.appendChild(g);
    });
  }

  toContact.addEventListener("click", () => rdvPanel("contact"));
  $("#back-moment").addEventListener("click", () => rdvPanel("moment"));

  ["name", "phone", "note"].forEach((k) => {
    $(`#f-${k}`).addEventListener("input", (e) => { rdv[k] = e.target.value.trim(); });
  });

  const prettyPhone = () => {
    const digits = rdv.phone.replace(/[^\d+]/g, "");
    return digits.startsWith("+") || digits.startsWith("00") ? digits : `+225 ${rdv.phone}`;
  };

  const errBox = $("#rdv-err");
  const confirmBtn = $("#confirm-rdv");

  confirmBtn.addEventListener("click", async () => {
    const missing = [];
    if (!rdv.date || !rdv.time) missing.push("votre créneau");
    if (rdv.name.length < 2) missing.push("votre nom");
    if (rdv.phone.replace(/\D/g, "").length < 9) missing.push("un numéro WhatsApp valide");
    if (missing.length) {
      errBox.hidden = false;
      errBox.textContent = `Il manque ${missing.join(", ")}.`;
      if (!rdv.date || !rdv.time) rdvPanel("moment");
      return;
    }
    errBox.hidden = true;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Un instant…";

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: rdv.date, time: rdv.time, name: rdv.name, phone: prettyPhone(), note: rdv.note })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        rdv.availability.delete(rdv.date);
        errBox.hidden = false;
        errBox.textContent = data.message || data.error || "Ce créneau vient d'être pris.";
        rdv.time = "";
        const dayBtn = $$(".day", daysWrap).find((b) => b.dataset.date === rdv.date);
        if (dayBtn) await selectDay(rdv.date, dayBtn);
        rdvPanel("moment");
        return;
      }
      if (!res.ok) throw new Error();
      rdv.reference = data.booking.reference;
      rdv.delivery = data.whatsapp?.delivery || "handoff";
      rdv.handoffText = data.whatsapp?.handoffText || "";
    } catch {
      rdv.reference = "";
      rdv.delivery = "handoff";
      rdv.handoffText = "";
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Réserver";
    }

    prepareDone();
    rdvPanel("done");

    /* L'ouverture préremplie ne sert que lorsque l'API Cloud n'est pas
       disponible. En automatique, aucun second geste n'est demandé. */
    if (rdv.delivery === "handoff") {
      const opened = window.open($("#t-wa").href, "_blank", "noopener");
      if (!opened) $("#t-wa").classList.add("pulse");
    }
  });

  /* Secours hors ligne — même voix que le serveur. */
  function waMessage() {
    if (rdv.handoffText) return rdv.handoffText;
    return [
      `Bonjour ${CONFIG.brandName} ✦ Essayage privé`,
      "",
      "Ma carte de rendez-vous :",
      rdv.reference ? `· ${rdv.reference}` : null,
      `· ${frDate(rdv.date)} · ${rdv.time}`,
      `· ${rdv.name} — ${prettyPhone()}`,
      rdv.note ? `· Note : ${rdv.note}` : null,
      "",
      "Un créneau privé de quarante-cinq minutes.",
      "Un mot de votre concierge pour confirmer ?"
    ].filter((l) => l !== null).join("\n");
  }

  function icsFile() {
    const dt = `${rdv.date.replaceAll("-", "")}T${rdv.time.replace(":", "")}00Z`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LEAKS//Essayage//FR",
      "BEGIN:VEVENT",
      `UID:${rdv.reference || stamp}@leaks`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt}`,
      "DURATION:PT45M",
      `SUMMARY:Essayage privé LEAKS${rdv.reference ? ` — ${rdv.reference}` : ""}`,
      "LOCATION:Abidjan — lieu communiqué sur WhatsApp",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  function prepareDone() {
    const sent = rdv.delivery === "sent";
    const queued = rdv.delivery === "queued";
    const automatic = sent || queued;
    $("#done-lead").textContent = sent
      ? "C'est fait — votre confirmation est déjà dans votre WhatsApp."
      : queued
        ? "C'est fait — votre confirmation WhatsApp part automatiquement."
      : rdv.reference
        ? "Votre créneau est retenu. WhatsApp s'ouvre avec votre carte — envoyez-la telle quelle."
        : "Votre demande est prête. Envoyez-la — le concierge bloque le créneau à réception.";
    $("#t-ref").textContent = rdv.reference || "· · ·";
    $("#t-when").textContent = `${frDate(rdv.date)} · ${rdv.time}`;
    $("#t-wa").textContent = automatic ? "Ouvrir WhatsApp" : "Envoyer sur WhatsApp";
    $("#t-wa").href = automatic
      ? `https://wa.me/${CONFIG.whatsappNumber}`
      : `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(waMessage())}`;
    $("#t-ics").href = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile())}`;
  }

  /* ── Démarrage ─────────────────────────────────────────────── */

  buildDays();
  route();
})();
