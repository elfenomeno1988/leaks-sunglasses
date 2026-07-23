import { randomBytes } from "node:crypto";
import { z } from "zod";

export const SLOT_TIMES = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const MAX_DAYS_AHEAD = 30;

const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  time: z.enum(SLOT_TIMES, { message: "Créneau invalide." }),
  name: z.string().trim().min(2, "Nom trop court.").max(80),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 .-]{7,19}$/, "Téléphone invalide."),
  note: z.string().trim().max(500).optional().default(""),
  models: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([])
});

export class BookingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function abidjanToday() {
  // Abidjan vit en UTC : la date locale est donc la date UTC.
  return new Date().toISOString().slice(0, 10);
}

function assertBookableDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new BookingError("Date invalide.");
  if (date.getUTCDay() === 0) throw new BookingError("Les essayages ne sont pas proposés le dimanche.");
  const today = abidjanToday();
  if (iso < today) throw new BookingError("Cette date est déjà passée.");
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + MAX_DAYS_AHEAD);
  if (date > horizon) throw new BookingError("Le carnet n'ouvre que 30 jours à l'avance.");
}

const makeReference = () => `LK-RDV-${randomBytes(2).toString("hex").toUpperCase()}`;

export async function createBooking({ db, catalog, input }) {
  const values = bookingSchema.parse(input ?? {});
  assertBookableDate(values.date);

  /* Anti-abus : deux rendez-vous à venir maximum par numéro. */
  const phoneDigits = values.phone.replace(/\D/g, "");
  const active = await db.query(
    `select count(*)::int as n from bookings
     where regexp_replace(customer_phone, '\\D', '', 'g') = $1
       and status in ('pending', 'confirmed')
       and booking_date >= current_date`,
    [phoneDigits]
  );
  if (active.rows[0].n >= 2) {
    throw new BookingError("Vous avez déjà deux rendez-vous à venir. Écrivez au concierge pour modifier.", 429);
  }

  const knownModels = new Set(catalog.list.map((product) => product.id));
  const models = [...new Set(values.models)].filter((id) => knownModels.has(id));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const reference = makeReference();
    try {
      const result = await db.query(
        `insert into bookings (reference, booking_date, booking_time, customer_name, customer_phone, customer_note, models)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning *`,
        [reference, values.date, values.time, values.name, values.phone, values.note || null, JSON.stringify(models)]
      );
      return result.rows[0];
    } catch (error) {
      if (error?.code === "23505" && String(error.constraint || "").includes("bookings_slot_active")) {
        throw new BookingError("Ce créneau vient d'être réservé. Choisissez-en un autre.", 409);
      }
      if (error?.code === "23505" && String(error.constraint || "").includes("bookings_reference")) {
        continue; // collision de référence, on retente
      }
      throw error;
    }
  }
  throw new BookingError("Impossible de générer une référence. Réessayez.", 500);
}

export async function bookedSlots({ db, date }) {
  const result = await db.query(
    `select booking_time from bookings where booking_date = $1 and status <> 'cancelled' order by booking_time`,
    [date]
  );
  return result.rows.map((row) => row.booking_time);
}

export function publicBooking(row) {
  return {
    reference: row.reference,
    date: row.booking_date instanceof Date ? row.booking_date.toISOString().slice(0, 10) : String(row.booking_date),
    time: row.booking_time,
    name: row.customer_name,
    models: row.models || [],
    status: row.status
  };
}
