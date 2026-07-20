import { z } from "zod";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const updateSchema = z.object({
  status: z.enum(["pending_payment", "confirmed", "preparing", "ready", "shipped", "delivered", "cancelled"]),
  paymentStatus: z.enum(["pending", "paid", "cancelled", "refunded"]).optional(),
  adminNote: z.string().trim().max(1000).optional().default("")
});

export async function adminRoutes(app, { db, auth }) {
  app.post("/api/admin/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Identifiants invalides." });
    const admin = await auth.login(reply, parsed.data.email, parsed.data.password);
    if (!admin) return reply.code(401).send({ error: "Email ou mot de passe incorrect." });
    return { admin };
  });

  app.get("/api/admin/me", { preHandler: auth.authenticate }, async (request) => ({ admin: request.admin }));

  app.post("/api/admin/logout", { preHandler: auth.authenticate }, async (request, reply) => {
    await auth.logout(request, reply);
    return { ok: true };
  });

  app.get("/api/admin/orders", { preHandler: auth.authenticate }, async (request) => {
    const page = Math.max(1, Number.parseInt(request.query.page || "1", 10));
    const limit = Math.min(100, Math.max(10, Number.parseInt(request.query.limit || "30", 10)));
    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];
    const push = (value) => { params.push(value); return `$${params.length}`; };

    if (request.query.paymentStatus) filters.push(`payment_status=${push(request.query.paymentStatus)}`);
    if (request.query.status) filters.push(`status=${push(request.query.status)}`);
    if (request.query.search) {
      const term = `%${request.query.search.trim()}%`;
      const p = push(term);
      filters.push(`(reference ilike ${p} or customer_name ilike ${p} or customer_phone ilike ${p})`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";

    const [orders, count, stats] = await Promise.all([
      db.query(`select * from orders ${where} order by created_at desc limit ${push(limit)} offset ${push(offset)}`, params),
      db.query(`select count(*)::int as total from orders ${where}`, params.slice(0, -2)),
      db.query(`select
        count(*)::int as orders,
        count(*) filter (where payment_status='paid')::int as paid_orders,
        coalesce(sum(total_amount) filter (where payment_status='paid'),0)::int as revenue,
        count(*) filter (where payment_status='pending')::int as pending
        from orders`)
    ]);
    return { orders: orders.rows, total: count.rows[0].total, page, limit, stats: stats.rows[0] };
  });

  app.get("/api/admin/bookings", { preHandler: auth.authenticate }, async (request) => {
    const filters = [];
    const params = [];
    const push = (value) => { params.push(value); return `$${params.length}`; };
    if (request.query.status) filters.push(`status=${push(request.query.status)}`);
    if (request.query.date) filters.push(`booking_date=${push(request.query.date)}`);
    const where = filters.length ? `where ${filters.join(" and ")}` : "";
    const result = await db.query(
      `select * from bookings ${where} order by booking_date asc, booking_time asc limit 200`,
      params
    );
    return { bookings: result.rows };
  });

  app.patch("/api/admin/bookings/:reference", { preHandler: auth.authenticate }, async (request, reply) => {
    const parsed = z.object({ status: z.enum(["pending", "confirmed", "honored", "cancelled"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Mise à jour invalide." });
    const result = await db.query(
      `update bookings set status=$1 where reference=$2 returning *`,
      [parsed.data.status, request.params.reference]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "Réservation introuvable." });
    return { booking: result.rows[0] };
  });

  app.patch("/api/admin/orders/:reference", { preHandler: auth.authenticate }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Mise à jour invalide." });
    const current = await db.query(`select * from orders where reference=$1 limit 1`, [request.params.reference]);
    if (!current.rows[0]) return reply.code(404).send({ error: "Commande introuvable." });
    if (parsed.data.paymentStatus && current.rows[0].payment_provider !== "manual") {
      return reply.code(400).send({ error: "Le statut d'un paiement PayDunya est mis à jour uniquement par le prestataire." });
    }
    const paymentStatus = parsed.data.paymentStatus || current.rows[0].payment_status;
    const status = paymentStatus === "paid" && parsed.data.status === "pending_payment" ? "confirmed" : parsed.data.status;
    const result = await db.query(
      `update orders set status=$1, payment_status=$2, admin_note=$3,
       paid_at=case when $2='paid' then coalesce(paid_at,now()) else paid_at end
       where reference=$4 returning *`,
      [status, paymentStatus, parsed.data.adminNote || null, request.params.reference]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "Commande introuvable." });
    return { order: result.rows[0] };
  });
}
