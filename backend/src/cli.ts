// Administration des comptes en ligne de commande (il n'y a pas d'inscription publique).
// Dans le conteneur : docker compose exec budget budget-cli <commande>
import { randomBytes } from 'node:crypto';
import { hashPassword, setPassword } from './auth/passwords.ts';
import { deleteRecoveryCodes } from './auth/recovery-codes.ts';
import { deleteAllSessions } from './auth/sessions.ts';
import { normalizeEmail, userRowByUsername } from './auth/users.ts';
import { all, run } from './database/connection.ts';

const USAGE = `Commandes :
  create-user <identifiant> [nom affiché]   crée un compte (mot de passe généré)
  reset-password <identifiant>              génère un nouveau mot de passe
  set-email <identifiant> <adresse>         définit l'adresse e-mail
  disable-2fa <identifiant>                 désactive la double authentification (téléphone perdu)
  list-users                                liste les comptes`;

const [command, username, ...rest] = process.argv.slice(2);
const generatePassword = () => randomBytes(12).toString('base64url');

function requireUser(name: string | undefined, usage: string) {
  if (!name) throw new Error(`Usage : ${usage}`);
  const row = userRowByUsername(name);
  if (!row) throw new Error(`Compte « ${name} » introuvable`);
  return row;
}

try {
  switch (command) {
    case 'create-user': {
      if (!username) throw new Error('Usage : create-user <identifiant> [nom affiché]');
      const password = generatePassword();
      run(
        'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)',
        username.toLowerCase(),
        rest.join(' ') || username,
        hashPassword(password),
      );
      console.log(`Compte « ${username.toLowerCase()} » créé. Mot de passe : ${password}`);
      break;
    }
    case 'reset-password': {
      const user = requireUser(username, 'reset-password <identifiant>');
      const password = generatePassword();
      setPassword(user.id, password);
      deleteAllSessions(user.id);
      console.log(`Nouveau mot de passe pour « ${user.username} » : ${password}`);
      break;
    }
    case 'set-email': {
      const user = requireUser(username, 'set-email <identifiant> <adresse>');
      if (!rest[0]) throw new Error('Usage : set-email <identifiant> <adresse>');
      run('UPDATE users SET email = ? WHERE id = ?', normalizeEmail(rest[0]), user.id);
      console.log(`Adresse de « ${user.username} » : ${normalizeEmail(rest[0])}`);
      break;
    }
    case 'disable-2fa': {
      const user = requireUser(username, 'disable-2fa <identifiant>');
      run('UPDATE users SET totp_secret = NULL, totp_pending = NULL WHERE id = ?', user.id);
      deleteRecoveryCodes(user.id);
      console.log(`Double authentification désactivée pour « ${user.username} »`);
      break;
    }
    case 'list-users':
      console.table(
        all(
          "SELECT id, username, display_name, email, CASE WHEN totp_secret IS NULL THEN 'non' ELSE 'oui' END AS '2fa' FROM users ORDER BY id",
        ),
      );
      break;
    default:
      console.log(USAGE);
      process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
