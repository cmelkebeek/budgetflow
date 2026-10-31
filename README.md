# BudgetFlow

Petite app de budget mensuel auto-hébergée (React + TypeScript, Node, SQLite). Chaque compte a son propre budget, indépendant des autres.

- **Charges récurrentes** : recopiées dans chaque nouveau mois, avec « ma part » en % (ex. 50 % pour un loyer divisé par deux). Option calcul essence à partir des km.
- **Mois** : revenu, dépenses, reste, cases « payé », dépenses ponctuelles, km d'essence ajustables.
- **Achats prévus** : liste d'envies à placer dans un mois ; cocher la ligne comme payée marque l'achat comme fait.
- **Historique** des mois.

## Organisation du projet

```
backend/src/          serveur (Hono + SQLite), exécuté directement en TypeScript par Node 24
  main.ts             point d'entrée : protections, routes, fichiers du front
  cli.ts              administration des comptes (budget-cli)
  config.ts           toute la configuration (variables d'environnement)
  database/           connexion, schéma et migrations
  http/               validation des entrées, session, protections HTTP (CSP, anti-CSRF…)
  lib/                e-mails, chiffrement, hachage
  auth/               mots de passe, sessions, 2FA, codes de secours, passkeys, réinitialisation, routes publiques
  account/            routes de la page Compte
  budget/             charges récurrentes, mois et lignes, achats prévus
frontend/             interface React (Vite)
  src/lib/            client API, formats, thème, notifications, passkeys
  src/components/     composants réutilisables (champs, fenêtres, graphiques, chargement)
  src/pages/          une page par dossier : month, recurring, wishes, history, account, auth
  src/styles/         CSS découpé par thème (index.css les importe dans l'ordre)
shared/types.ts       types partagés entre le serveur et l'interface
```

## Déploiement (Docker)

1. Crée le fichier `.env` à côté de `docker-compose.yml`, à partir de `.env.example`. Il contient **toute la configuration de l'installation** (adresse, clé de chiffrement, e-mails) ; `docker-compose.yml` reste identique partout et n'est jamais à modifier :
   ```sh
   cp .env.example .env
   # puis renseigne ENCRYPTION_KEY avec le résultat de :
   openssl rand -base64 32
   ```
   **Garde une copie de cette clé** (gestionnaire de mots de passe) : elle chiffre les secrets de la double authentification. Sans elle, l'app refuse de démarrer ; si elle est perdue, il faut désactiver puis réactiver la 2FA des comptes (`budget-cli disable-2fa`). Le fichier `.env` n'est jamais copié dans l'image ni dans le volume.

2. Lance l'app et crée les comptes (un mot de passe est généré et affiché) :
   ```sh
   docker compose up -d --build
   docker compose exec budget budget-cli create-user camille Camille
   ```

L'app écoute sur le port 3000. Les données sont dans le volume `budget-data` (`/data/budget.db`).

Commandes `budget-cli` : `create-user`, `reset-password`, `set-email`, `disable-2fa` (secours si le téléphone est perdu), `list-users`. Sans argument, la liste s'affiche.

### Derrière un reverse proxy en HTTPS (Pangolin, Traefik…)

Dans `.env`, `PUBLIC_URL=https://budget.ton-domaine.fr` : l'adresse publique de l'app, nécessaire pour les passkeys et les liens des e-mails. Plusieurs adresses possibles, séparées par des virgules. Une passkey est liée au domaine où elle a été créée. Si la première adresse est en https, le cookie de session est réservé au HTTPS (forçable avec `COOKIE_SECURE`).

### E-mails (mot de passe oublié)

Renseigne `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM` dans `.env` (n'importe quel fournisseur SMTP : Gmail avec un mot de passe d'application, OVH, Brevo…), puis relance avec `docker compose up -d`. Chaque utilisateur ajoute son adresse dans l'onglet Compte, avec un bouton pour envoyer un e-mail de test.

« Mot de passe oublié ? » envoie alors un lien valable 30 minutes, utilisable une fois. La réinitialisation ferme toutes les sessions et ne contourne pas la double authentification. Sans SMTP, l'app indique la commande `reset-password` à lancer sur le serveur.

### Sécurité

- **Passkeys** : connexion par empreinte, Face ID, Windows Hello ou clé de sécurité, sans mot de passe. Nécessite HTTPS (ou localhost).
- **Double authentification (TOTP)** avec 10 codes de secours à usage unique. Les secrets sont chiffrés en base (AES-256-GCM, clé `ENCRYPTION_KEY` hors du volume).
- Mots de passe hachés (scrypt) ; sessions, codes de secours et liens de réinitialisation stockés sous forme d'empreinte.
- Actions sensibles (passkeys, 2FA, codes de secours) : mot de passe redemandé s'il date de plus de 10 minutes.
- En-têtes de sécurité (CSP stricte, anti-iframe), protection anti-CSRF, limite d'essais à la connexion.

### Sauvegarde

```sh
docker compose exec budget node -e "new (require('node:sqlite').DatabaseSync)('/data/budget.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose cp budget:/data/backup.db ./backup.db
```

La sauvegarde contient tes données de budget en clair : stocke-la sur un support chiffré (ex. Proxmox Backup Server avec chiffrement).

## Développement

Nécessite Node 24. Le fichier `.env` est lu automatiquement.

```sh
npm install
npm run dev:backend    # API sur :3000 (base dans ./data), redémarre à chaque modification
npm run dev:frontend   # interface sur :5173, /api est redirigé vers l'API
npm run cli -- create-user camille Camille
```

`npm run typecheck` vérifie les types du serveur et de l'interface.
