/* ════════════════════════════════════════════════════════════
   LEAKS — Centre de notifications (outbox WhatsApp)
   Chaque événement est écrit en base puis envoyé par un worker :
   reprises avec recul exponentiel, dédoublonnage par référence,
   accusés (delivered / read) posés par le webhook Meta.
   Pensé pour des centaines de clients : l'envoi ne bloque jamais
   une requête, et un échec réseau se rejoue tout seul.
   ════════════════════════════════════════════════════════════ */

import { bookingReminderMessage } from "./whatsapp.mjs";

const BATCH = 10;
const MAX_ATTEMPTS = 8;
const TICK_MS = 20_000;
const REMINDER_TICK_MS = 10 * 60_000;

export function createNotificationCenter({ db, whatsapp, logger = console }) {
  /* ── Écrire dans la file (idempotent par genre + référence) ── */

  async function enqueue(kind, recipient, body, reference = null) {
    const to = String(recipient || "").replace(/\D/g, "");
    if (!to || !body) return;
    await db.query(
      `insert into notifications (kind, recipient, body, reference)
       values ($1, $2, $3, $4)
       on conflict (kind, reference) where reference is not null do nothing`,
      [kind, to, body, reference]
    );
    setImmediate(drain); // l'envoi part dans la foulée, hors requête
  }

  /* ── Le worker ─────────────────────────────────────────────── */

  let draining = false;

  async function drain() {
    if (draining || !whatsapp.enabled) return;
    draining = true;
    try {
      for (;;) {
        /* Réclamation ATOMIQUE : l'UPDATE incrémente attempts et repousse
           next_attempt_at dans la même instruction — deux instances du
           serveur ne peuvent jamais réclamer le même message. */
        const { rows } = await db.query(
          `update notifications
           set attempts = attempts + 1,
               next_attempt_at = now() + interval '5 minutes'
           where id in (
             select id from notifications
             where status = 'queued' and next_attempt_at <= now()
             order by created_at
             limit ${BATCH}
             for update skip locked)
           returning id, recipient, body, attempts`
        );
        if (!rows.length) break;

        for (const n of rows) {
          try {
            const result = await whatsapp.sendText(n.recipient, n.body);
            await db.query(
              `update notifications set status='sent', sent_at=now(), meta_message_id=$2, last_error=null where id=$1`,
              [n.id, result?.messages?.[0]?.id || null]
            );
          } catch (error) {
            const failed = n.attempts >= MAX_ATTEMPTS;
            /* Recul exponentiel : 1, 2, 4, 8… minutes, plafonné à 30. */
            const delayMin = Math.min(2 ** (n.attempts - 1), 30);
            await db.query(
              `update notifications set status=$2,
               next_attempt_at = now() + ($3 || ' minutes')::interval,
               last_error=$4 where id=$1`,
              [n.id, failed ? "failed" : "queued", String(delayMin), String(error.message || error).slice(0, 500)]
            );
            logger.warn?.({ id: n.id, attempts: n.attempts, error: String(error.message || error) },
              failed ? "Notification abandonnée" : "Notification rejouée plus tard");
          }
        }
      }
    } catch (error) {
      logger.error?.({ error: String(error) }, "Worker notifications en erreur");
    } finally {
      draining = false;
    }
  }

  /* ── Rappels d'essayage — le matin même ────────────────────── */

  async function scheduleReminders() {
    try {
      const { rows } = await db.query(
        `select reference, booking_date, booking_time, customer_phone
         from bookings
         where booking_date = current_date
           and status in ('pending', 'confirmed')
           and booking_time > to_char(now() + interval '1 hour', 'HH24:MI')`
      );
      for (const b of rows) {
        await enqueue("booking-reminder", b.customer_phone, bookingReminderMessage({
          reference: b.reference,
          date: b.booking_date instanceof Date ? b.booking_date.toISOString().slice(0, 10) : String(b.booking_date),
          time: b.booking_time
        }), b.reference);
      }
    } catch (error) {
      logger.error?.({ error: String(error) }, "Planification des rappels en erreur");
    }
  }

  /* ── Accusés Meta (webhook) ────────────────────────────────── */

  async function recordStatus(metaMessageId, status) {
    if (!metaMessageId) return;
    await db.query(
      `update notifications set delivery_status=$2 where meta_message_id=$1`,
      [metaMessageId, status]
    );
  }

  /* ── Cycle de vie ──────────────────────────────────────────── */

  const timers = [];
  function start() {
    if (!whatsapp.enabled) return;
    timers.push(setInterval(drain, TICK_MS));
    timers.push(setInterval(scheduleReminders, REMINDER_TICK_MS));
    setImmediate(drain);
    setImmediate(scheduleReminders);
  }
  function stop() { timers.forEach(clearInterval); }

  return { enqueue, drain, scheduleReminders, recordStatus, start, stop };
}
