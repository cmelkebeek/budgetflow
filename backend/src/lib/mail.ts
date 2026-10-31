// Envoi d'e-mails via SMTP. Sans SMTP_HOST, l'envoi est désactivé et l'app se rabat sur la réinitialisation en ligne de commande.
import nodemailer from 'nodemailer';
import { APP_URL, SMTP } from '../config.ts';

const transport = SMTP.host
  ? nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465, // 465 = TLS direct ; 587 = STARTTLS
      auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass } : undefined,
    })
  : null;

export const mailEnabled = transport !== null;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Message {
  to: string;
  subject: string;
  name: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}

// Mise en page simple, lisible dans tous les clients mail (styles en ligne, une colonne).
function render({ name, paragraphs, action, footer }: Message) {
  const text = [`Bonjour ${name},`, '', ...paragraphs, ...(action ? ['', `${action.label} : ${action.url}`] : []), '', footer].join('\n');
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f6f6f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e1e0d9;border-radius:14px;padding:28px">
    <p style="margin:0 0 20px;font-weight:650;font-size:17px">Budget</p>
    <p style="margin:0 0 14px">Bonjour ${escapeHtml(name)},</p>
    ${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n    ')}
    ${
      action
        ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0b0b0b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">${escapeHtml(action.label)}</a></p>
    <p style="margin:0 0 14px;font-size:13px;color:#52514e;word-break:break-all">Le bouton ne marche pas ? Copie ce lien : ${escapeHtml(action.url)}</p>`
        : ''
    }
    <p style="margin:24px 0 0;font-size:13px;color:#898781">${escapeHtml(footer)}</p>
  </div>
</body></html>`;
  return { text, html };
}

async function send(message: Message) {
  if (!transport) throw new Error("L'envoi d'e-mails n'est pas configuré (SMTP_HOST)");
  await transport.sendMail({ from: SMTP.from, to: message.to, subject: message.subject, ...render(message) });
}

export const sendResetEmail = (to: string, name: string, token: string) =>
  send({
    to,
    name,
    subject: 'Réinitialiser ton mot de passe',
    paragraphs: [
      'Tu as demandé à réinitialiser le mot de passe de ton compte Budget.',
      'Ce lien est valable 30 minutes et ne fonctionne qu’une seule fois.',
    ],
    // Le jeton est dans le fragment (#) : il n'est jamais envoyé au serveur ni écrit dans les journaux du proxy.
    action: { label: 'Choisir un nouveau mot de passe', url: `${APP_URL}/#reset=${token}` },
    footer: "Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : ton mot de passe ne change pas.",
  });

export const sendPasswordChangedEmail = (to: string, name: string) =>
  send({
    to,
    name,
    subject: 'Ton mot de passe a été modifié',
    paragraphs: [
      `Le mot de passe de ton compte Budget vient d'être modifié (${new Date().toLocaleString('fr-FR', { timeZone: process.env.TZ || 'Europe/Paris' })}).`,
    ],
    footer: "Si ce n'est pas toi, réinitialise ton mot de passe tout de suite et vérifie tes passkeys.",
  });

export const sendTestEmail = (to: string, name: string) =>
  send({
    to,
    name,
    subject: 'E-mail de test',
    paragraphs: ["Si tu lis ceci, l'envoi d'e-mails de Budget fonctionne."],
    footer: 'Tu peux supprimer cet e-mail.',
  });

// Envoi en arrière-plan : une panne SMTP ne doit pas bloquer ni trahir la réponse HTTP.
export function sendInBackground(promise: Promise<void>) {
  promise.catch((err) => console.error("Échec d'envoi d'e-mail :", err instanceof Error ? err.message : err));
}
