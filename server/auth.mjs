import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "leaks_admin_session";
const SESSION_DAYS = 7;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function createAuth({ db, config }) {
  return {
    async login(reply, email, password) {
      const result = await db.query(
        `select id, email, password_hash from admins where lower(email)=lower($1) and active=true limit 1`,
        [email]
      );
      const admin = result.rows[0];
      if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return null;

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
      await db.query(
        `insert into admin_sessions (admin_id, token_hash, expires_at) values ($1,$2,$3)`,
        [admin.id, sha256(token), expiresAt]
      );
      reply.setCookie(COOKIE_NAME, token, {
        path: "/",
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "strict",
        expires: expiresAt,
        signed: true
      });
      return { id: admin.id, email: admin.email };
    },

    async authenticate(request, reply) {
      const signed = request.cookies[COOKIE_NAME]
        ? request.unsignCookie(request.cookies[COOKIE_NAME])
        : null;
      if (!signed?.valid) return reply.code(401).send({ error: "Authentification requise." });

      const result = await db.query(
        `select a.id, a.email
         from admin_sessions s join admins a on a.id=s.admin_id
         where s.token_hash=$1 and s.expires_at > now() and a.active=true limit 1`,
        [sha256(signed.value)]
      );
      if (!result.rows[0]) return reply.code(401).send({ error: "Session expirée." });
      request.admin = result.rows[0];
    },

    async logout(request, reply) {
      const signed = request.cookies[COOKIE_NAME]
        ? request.unsignCookie(request.cookies[COOKIE_NAME])
        : null;
      if (signed?.valid) {
        await db.query(`delete from admin_sessions where token_hash=$1`, [sha256(signed.value)]);
      }
      reply.clearCookie(COOKIE_NAME, { path: "/" });
    }
  };
}
