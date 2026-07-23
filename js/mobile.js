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
  const remainingByVariant = new Map();

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
      if (item.purchasable) {
        a.dataset.productId = item.id;
        a.dataset.variantId = item.variantId;
      }
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

  let orderOpenTime = new Date(CONFIG.orderOpenAt).getTime();

  function applyOrderGate() {
    const isOpen = Date.now() >= orderOpenTime;
    $$("[data-order-link]").forEach((link) => {
      if (!link.dataset.originalLabel) link.dataset.originalLabel = link.textContent;
      const remaining = remainingByVariant.get(`${link.dataset.productId}:${link.dataset.variantId}`);
      const soldOut = remaining === 0;
      link.textContent = soldOut
        ? "Épuisé"
        : !isOpen
          ? "Bientôt disponible"
          : remaining != null
            ? `${link.dataset.originalLabel} · ${remaining} restant${remaining > 1 ? "s" : ""}`
            : link.dataset.originalLabel;
      link.classList.toggle("is-locked", !isOpen || soldOut);
      link.setAttribute("aria-disabled", String(!isOpen || soldOut));
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
    $("#m-buy").dataset.productId = m.id;
    $("#m-buy").dataset.variantId = currentColor.variantId;

    const sw = $("#m-swatches");
    sw.innerHTML = "";
    m.colors.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-swatch" + (c === currentColor ? " is-active" : "");
      const soldOut = remainingByVariant.get(`${m.id}:${c.variantId}`) === 0;
      b.disabled = soldOut;
      b.classList.toggle("is-sold-out", soldOut);
      b.innerHTML = `<img src="${c.image}" alt="">${c.label}${soldOut ? " · épuisé" : ""}`;
      b.addEventListener("click", () => {
        currentColor = c;
        $("#m-color").textContent = c.label;
        $("#m-buy").href = `/checkout.html?product=${encodeURIComponent(m.id)}&variant=${encodeURIComponent(c.variantId)}`;
        $("#m-buy").dataset.variantId = c.variantId;
        $$(".m-swatch", sw).forEach((x) => x.classList.toggle("is-active", x === b));
        renderPager();
        applyOrderGate();
      });
      sw.appendChild(b);
    });

    renderPager();
    applyOrderGate();
  }

  async function hydrateAvailability() {
    try {
      const response = await fetch("/api/catalog", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const catalog = await response.json();
      const opens = new Date(catalog.orderOpenAt).getTime();
      if (Number.isFinite(opens)) orderOpenTime = opens;
      catalog.products?.forEach((product) => {
        product.variants?.forEach((variant) => {
          if (variant.remaining != null) {
            remainingByVariant.set(`${product.id}:${variant.id}`, Number(variant.remaining));
          }
        });
      });
      if (currentModel) openModel(currentModel.id, currentColor?.variantId);
      applyOrderGate();
    } catch {
      /* Le serveur contrôle encore le stock au dernier geste. */
    }
  }

  /* ── Réserver : trois gestes sur l'API bookings ────────────── */

  const rdv = {
    date: "", time: "", name: "", phone: "", address: "", note: "",
    latitude: null, longitude: null,
    reference: "", confirmationToken: "", confirmed: false,
    delivery: "handoff", handoffText: "",
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
    if (name === "contact") window.setTimeout(ensureRdvMap, 0);
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

  ["name", "phone", "address", "note"].forEach((k) => {
    $(`#f-${k}`).addEventListener("input", (e) => { rdv[k] = e.target.value.trim(); });
  });

  let rdvMap = null;
  let rdvMarker = null;

  function setRdvLocation(latitude, longitude, label = "Lieu épinglé") {
    rdv.latitude = Number(latitude.toFixed(6));
    rdv.longitude = Number(longitude.toFixed(6));
    const point = [rdv.latitude, rdv.longitude];
    if (!rdvMarker) rdvMarker = window.L.marker(point).addTo(rdvMap);
    else rdvMarker.setLatLng(point);
    $("#m-location-status").textContent = label;
  }

  function ensureRdvMap() {
    if (!window.L || !$("#m-rdv-map")) return;
    if (!rdvMap) {
      rdvMap = window.L.map("m-rdv-map", { scrollWheelZoom: false })
        .setView([5.3484, -4.0278], 12);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap &copy; CARTO"
      }).addTo(rdvMap);
      rdvMap.on("click", ({ latlng }) => setRdvLocation(latlng.lat, latlng.lng));
    }
    rdvMap.invalidateSize();
  }

  $("#m-locate").addEventListener("click", () => {
    const status = $("#m-location-status");
    if (!navigator.geolocation) {
      status.textContent = "Position indisponible";
      return;
    }
    status.textContent = "Localisation…";
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        ensureRdvMap();
        setRdvLocation(coords.latitude, coords.longitude, "Position ajoutée");
        rdvMap.setView([coords.latitude, coords.longitude], 16);
      },
      () => { status.textContent = "Touchez la carte pour placer l’épingle"; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  const normalizedPhone = () => {
    const raw = rdv.phone.trim();
    const digits = rdv.phone.replace(/\D/g, "");
    const normalized = raw.startsWith("00")
      ? digits.slice(2)
      : (!raw.startsWith("+") && digits.length === 10 ? `225${digits}` : digits);
    return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
  };

  const prettyPhone = () => {
    const digits = normalizedPhone();
    return digits ? `+${digits}` : rdv.phone;
  };

  const errBox = $("#rdv-err");
  const confirmBtn = $("#confirm-rdv");

  confirmBtn.addEventListener("click", async () => {
    const missing = [];
    if (!rdv.date || !rdv.time) missing.push("votre créneau");
    if (rdv.name.length < 2) missing.push("votre nom");
    if (!normalizedPhone()) missing.push("un numéro WhatsApp international valide avec indicatif pays");
    if (rdv.address.length < 8) missing.push("une adresse précise");
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
        body: JSON.stringify({
          date: rdv.date, time: rdv.time, name: rdv.name, phone: prettyPhone(),
          address: rdv.address, latitude: rdv.latitude, longitude: rdv.longitude,
          note: rdv.note
        })
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
      rdv.confirmationToken = data.booking.confirmationToken || "";
      rdv.delivery = data.whatsapp?.delivery || "handoff";
      rdv.handoffText = data.whatsapp?.handoffText || "";
    } catch {
      rdv.reference = "";
      rdv.confirmationToken = "";
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
      const opened = window.open($("#t-wa").dataset.handoff, "_blank", "noopener");
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
      `· Adresse : ${rdv.address}`,
      rdv.latitude != null && rdv.longitude != null
        ? `· Position : https://www.google.com/maps?q=${rdv.latitude},${rdv.longitude}`
        : null,
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
      `LOCATION:${rdv.address.replace(/([,;])/g, "\\$1")}`,
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
    $("#t-place").textContent = `${rdv.address} · 45 min · le concierge vient à vous`;
    $("#t-wa").textContent = automatic ? "Confirmer le RDV" : "Envoyer sur WhatsApp";
    $("#t-wa").dataset.mode = automatic ? "confirm" : "handoff";
    $("#t-wa").dataset.handoff = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(waMessage())}`;
    $("#t-wa").disabled = false;
    $("#t-confirm-status").textContent = automatic
      ? "Confirmez votre présence. Le concierge sera prévenu automatiquement."
      : "L'envoi automatique est indisponible. Transmettez votre demande au concierge.";
    $("#t-ics").href = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile())}`;
  }

  $("#t-wa").addEventListener("click", async () => {
    const button = $("#t-wa");
    if (button.dataset.mode === "handoff") {
      window.open(button.dataset.handoff, "_blank", "noopener");
      return;
    }
    if (!rdv.reference || !rdv.confirmationToken || rdv.confirmed) return;
    button.disabled = true;
    button.textContent = "Confirmation…";
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(rdv.reference)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rdv.confirmationToken })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Confirmation impossible.");
      rdv.confirmed = true;
      button.textContent = "RDV confirmé";
      $("#done-lead").textContent = "Rendez-vous confirmé.";
      $("#t-confirm-status").textContent = "Le concierge a été prévenu.";
    } catch (error) {
      button.disabled = false;
      button.textContent = "Réessayer";
      $("#t-confirm-status").textContent = error.message || "Confirmation impossible. Réessayez.";
    }
  });

  /* ── Démarrage ─────────────────────────────────────────────── */

  hydrateAvailability();
  buildDays();
  route();
})();
