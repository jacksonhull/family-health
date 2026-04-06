import nodemailer from "nodemailer";

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

const FROM = process.env.SMTP_FROM ?? "Family Health <no-reply@example.com>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const transport = getTransport();
  if (!transport) {
    // Dev fallback — no SMTP configured
    console.log(
      `\n[email] Would send to: ${opts.to}\n[email] Subject: ${opts.subject}\n[email] ${opts.text}\n`
    );
    return;
  }
  await transport.sendMail({ from: FROM, ...opts });
}

export async function sendInviteEmail({
  to,
  token,
  invitedByName,
}: {
  to: string;
  token: string;
  invitedByName: string | null | undefined;
}) {
  const link = `${APP_URL}/invite/${token}`;
  const from = invitedByName ?? "An administrator";

  console.log(`[email] Invite link → ${link}`);

  await sendMail({
    to,
    subject: "You've been invited to Family Health",
    text: `${from} has invited you to Family Health.\n\nAccept your invitation:\n${link}\n\nThis link expires in 48 hours.`,
    html: `<p>${from} has invited you to <strong>Family Health</strong>.</p>
<p><a href="${link}">Accept invitation</a></p>
<p>This link expires in 48 hours.</p>`,
  });
}

export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}) {
  const link = `${APP_URL}/reset-password/${token}`;

  console.log(`[email] Password reset link → ${link}`);

  await sendMail({
    to,
    subject: "Reset your Family Health password",
    text: `Reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request a reset, you can ignore this email.`,
    html: `<p><a href="${link}">Reset your password</a></p>
<p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>`,
  });
}
