/* ════════════════════════════════════════════════════════════
   LEAKS — L'essayage privé · expérience concierge
   Trois gestes : le moment, vous, WhatsApp.
   Créneaux réels (API), carte de rendez-vous, fichier calendrier.
   Partage CONFIG / $ / $$ / reducedMotion avec home.js.
   ════════════════════════════════════════════════════════════ */

(() => {
  const root = $("#xp");
  if (!root) return;

  const SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const MORNING = new Set(["10:00", "11:00", "12:00"]);
  const DAYS_SHOWN = 12;

  const state = {
    date: "", time: "",
    name: "", phone: "", note: "",
    reference: "", offline: false,
    delivery: "handoff", handoffText: ""
  };

  /* ── Utilitaires date (Abidjan vit en UTC) ────────────────── */

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const frDate = (iso) => {
    const s = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    }).format(new Date(`${iso}T00:00:00Z`));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /* ── Navigation entre panneaux ─────────────────────────────── */

  const ORDER = ["moment", "contact", "done"];
  const railBtns = $$(".xp-step", root);
  const panels = $$(".xp-panel", root);

  function goTo(step) {
    const idx = ORDER.indexOf(step);
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === step));
    railBtns.forEach((b) => {
      const bIdx = ORDER.indexOf(b.dataset.go);
      b.classList.toggle("is-active", b.dataset.go === step);
      b.classList.toggle("is-done", bIdx < idx);
      /* On peut revenir en arrière, jamais sauter en avant. La confirmation verrouille tout. */
      b.disabled = state.reference ? b.dataset.go !== "done" : bIdx > idx;
    });
    const active = panels.find((p) => p.dataset.panel === step);
    if (active && !reducedMotion) {
      active.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
        { duration: 340, easing: "cubic-bezier(0.2,0.6,0.2,1)" });
    }
    root.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  $$("[data-next]", root).forEach((b) => b.addEventListener("click", () => goTo(b.dataset.next)));
  $$("[data-back]", root).forEach((b) => b.addEventListener("click", () => goTo(b.dataset.back)));
  railBtns.forEach((b) => b.addEventListener("click", () => { if (!b.disabled) goTo(b.dataset.go); }));

  /* ── 01 · Le moment ────────────────────────────────────────── */

  const daysWrap = $("#xp-days");
  const slotsWrap = $("#xp-slots");
  const toContact = $("#xp-to-contact");
  const availability = new Map(); // iso → Set des créneaux pris

  function buildDays() {
    const base = new Date(`${todayISO()}T00:00:00Z`);
    for (let i = 0; i < DAYS_SHOWN; i += 1) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const sunday = d.getUTCDay() === 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "xp-day";
      btn.disabled = sunday;
      btn.dataset.date = iso;
      const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
      const mo = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
      btn.innerHTML = `<em>${i === 0 ? "auj." : wd}</em><strong>${d.getUTCDate()}</strong><span>${sunday ? "fermé" : mo}</span>`;
      btn.addEventListener("click", () => selectDay(iso, btn));
      daysWrap.appendChild(btn);
    }
    const firstOpen = $$(".xp-day", daysWrap).find((b) => !b.disabled);
    if (firstOpen) selectDay(firstOpen.dataset.date, firstOpen);
  }

  async function fetchAvailability(iso) {
    if (availability.has(iso)) return availability.get(iso);
    try {
      const res = await fetch(`/api/bookings/availability?date=${iso}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const taken = new Set(data.booked || []);
      availability.set(iso, taken);
      state.offline = false;
      return taken;
    } catch {
      state.offline = true;
      return new Set();
    }
  }

  async function selectDay(iso, btn) {
    state.date = iso;
    state.time = "";
    toContact.disabled = true;
    $$(".xp-day", daysWrap).forEach((b) => b.classList.toggle("is-active", b === btn));
    slotsWrap.innerHTML = '<p class="field-hint">Le concierge consulte le carnet…</p>';
    const taken = await fetchAvailability(iso);
    if (state.date !== iso) return; // l'utilisateur a déjà changé de jour
    renderSlots(taken);
    ticket();
  }

  function renderSlots(taken) {
    slotsWrap.innerHTML = "";
    const now = new Date();
    const isToday = state.date === todayISO();

    const groups = [["Matin", (t) => MORNING.has(t)], ["Après-midi", (t) => !MORNING.has(t)]];
    groups.forEach(([label, match]) => {
      const block = document.createElement("div");
      block.className = "xp-slot-group";
      block.innerHTML = `<span class="tag">${label}</span>`;
      const row = document.createElement("div");
      row.className = "chips";
      SLOTS.filter(match).forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        const past = isToday && (() => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m <= now.getUTCHours() * 60 + now.getUTCMinutes() + 45;
        })();
        if (taken.has(t)) {
          btn.disabled = true;
          btn.classList.add("is-taken");
          btn.innerHTML = `${t}<i>réservé</i>`;
        } else {
          btn.textContent = t;
          btn.disabled = past;
        }
        if (t === state.time) btn.classList.add("is-active");
        btn.addEventListener("click", () => {
          state.time = t;
          $$(".chip", slotsWrap).forEach((c) => c.classList.toggle("is-active", c === btn));
          toContact.disabled = false;
          ticket();
        });
        row.appendChild(btn);
      });
      block.appendChild(row);
      slotsWrap.appendChild(block);
    });
  }

  /* ── 03 · Vous ─────────────────────────────────────────────── */

  const errBox = $("#xp-errors");

  ["name", "phone", "note"].forEach((k) => {
    $(`#xp-${k}`).addEventListener("input", (e) => {
      state[k] = e.target.value.trim();
      ticket();
    });
  });

  function normalizedPhone() {
    const digits = state.phone.replace(/\D/g, "");
    if (/^225\d{10}$/.test(digits)) return digits;
    if (/^\d{10}$/.test(digits)) return `225${digits}`;
    return "";
  }

  function prettyPhone() {
    const digits = normalizedPhone();
    return digits ? `+${digits}` : state.phone;
  }

  function validate() {
    const missing = [];
    if (!state.date || !state.time) missing.push("votre créneau");
    if (state.name.length < 2) missing.push("votre nom");
    if (!normalizedPhone()) missing.push("un numéro WhatsApp ivoirien valide");
    return missing;
  }

  /* ── Confirmation → API → panneau WhatsApp ─────────────────── */

  const confirmBtn = $("#xp-confirm");

  confirmBtn.addEventListener("click", async () => {
    const missing = validate();
    if (missing.length) {
      errBox.hidden = false;
      errBox.textContent = `Il manque ${missing.join(", ")}.`;
      if (!state.date || !state.time) goTo("moment");
      return;
    }
    errBox.hidden = true;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Le concierge note votre créneau…";

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: state.date, time: state.time,
          name: state.name, phone: prettyPhone(),
          note: state.note
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        availability.delete(state.date);
        errBox.hidden = false;
        errBox.textContent = data.message || data.error || "Ce créneau vient d'être pris — choisissez-en un autre.";
        state.time = "";
        const dayBtn = $$(".xp-day", daysWrap).find((b) => b.dataset.date === state.date);
        if (dayBtn) await selectDay(state.date, dayBtn);
        goTo("moment");
        return;
      }
      if (!res.ok) throw new Error(data.message || data.error || "");
      state.reference = data.booking.reference;
      state.delivery = data.whatsapp?.delivery || "handoff";
      state.handoffText = data.whatsapp?.handoffText || "";
    } catch {
      state.reference = ""; // mode dégradé : la demande part sur WhatsApp sans référence
      state.offline = true;
      state.delivery = "handoff";
      state.handoffText = "";
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Réserver ce créneau";
    }

    prepareDone();
    goTo("done");
    ticket();

    /* En mode automatique, le worker Meta prend la main sans demander un
       second geste au client. Le lien prérempli ne sert qu'au vrai repli. */
    if (state.delivery === "handoff") {
      window.open($("#wa-send").href, "_blank", "noopener");
    }
  });

  /* ── Panneau 04 : aperçu WhatsApp + calendrier ─────────────── */

  /* Secours hors ligne — même voix que le serveur. */
  function waMessage() {
    if (state.handoffText) return state.handoffText;
    const lines = [
      `Bonjour LEAKS ✦ Essayage privé`,
      "",
      "Ma carte de rendez-vous :",
      state.reference ? `· ${state.reference}` : null,
      `· ${frDate(state.date)} · ${state.time}`,
      `· ${state.name} — ${prettyPhone()}`,
      state.note ? `· Note : ${state.note}` : null,
      "",
      "Un créneau privé de quarante-cinq minutes.",
      "Un mot de votre concierge pour confirmer ?"
    ];
    return lines.filter((l) => l !== null).join("\n");
  }

  function icsFile() {
    const dt = `${state.date.replaceAll("-", "")}T${state.time.replace(":", "")}00Z`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const esc = (s) => s.replace(/([,;])/g, "\\$1");
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LEAKS//Essayage//FR",
      "BEGIN:VEVENT",
      `UID:${state.reference || stamp}@leaks`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt}`,
      "DURATION:PT45M",
      `SUMMARY:${esc(`Essayage privé LEAKS${state.reference ? ` — ${state.reference}` : ""}`)}`,
      "LOCATION:Abidjan — lieu communiqué sur WhatsApp",
      `DESCRIPTION:${esc("Essayage privé de 45 minutes. Lieu communiqué par le concierge sur WhatsApp : +" + CONFIG.whatsappNumber)}`,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  function prepareDone() {
    const sent = state.delivery === "sent";
    const queued = state.delivery === "queued";
    const automatic = sent || queued;
    const msg = waMessage();
    $("#wa-bubble").textContent = automatic ? customerEcho() : msg;
    $("#wa-send").textContent = automatic ? "Ouvrir WhatsApp" : "Envoyer sur WhatsApp";
    $("#wa-send").href = automatic
      ? `https://wa.me/${CONFIG.whatsappNumber}`
      : `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    $("#ics-dl").href = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile())}`;
    $("#xp-done-lead").innerHTML = sent
      ? `C'est fait — votre confirmation est <b>déjà dans votre WhatsApp</b>.
         <small>Référence ${state.reference}. Répondez au concierge pour toute modification.</small>`
      : queued
        ? `C'est fait — votre confirmation WhatsApp part <b>automatiquement</b>.
           <small>Référence ${state.reference}. Elle arrivera sur le numéro que vous avez indiqué.</small>`
      : state.reference
        ? `Votre créneau est retenu sous la référence <b>${state.reference}</b>.
           <small>WhatsApp s'ouvre avec votre carte, déjà rédigée — envoyez-la telle quelle.</small>`
        : `Votre demande est prête.
           <small>Envoyez-la sur WhatsApp — le concierge bloque le créneau à réception.</small>`;
  }

  /* Aperçu du message reçu quand l'envoi serveur a eu lieu. */
  function customerEcho() {
    return [
      "LEAKS ✦ Votre essayage privé est retenu.",
      "",
      `${frDate(state.date)} · ${state.time} — Abidjan`,
      `Référence ${state.reference}`,
      "",
      "Répondez à ce message — votre concierge vous lit."
    ].join("\n");
  }

  /* ── La carte de rendez-vous (colonne vivante) ─────────────── */

  function ticket() {
    $("#tk-ref").textContent = state.reference || "· · ·";
    $("#tk-date").textContent = state.date ? frDate(state.date) : "—";
    $("#tk-time").textContent = state.time || "—";
    $("#tk-name").textContent = state.name || "—";
    $("#tk-status").innerHTML = state.reference
      ? state.delivery === "queued" || state.delivery === "sent"
        ? "Créneau retenu.<br>Confirmation WhatsApp automatique."
        : "Créneau retenu.<br>Envoyez la carte sur WhatsApp pour confirmation."
      : state.time
        ? "Encore un geste —<br>vos coordonnées, et la carte est prête."
        : "Composez votre rendez-vous —<br>la carte s'écrit avec vous.";
  }

  buildDays();
  ticket();
})();
