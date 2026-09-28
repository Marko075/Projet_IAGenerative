# Transformers — Chatbot d'entreprise (Hackathon EPF)

Un serveur Node.js qui se place entre l'interface web et le modèle d'IA : il gère les comptes, enregistre les conversations, et reste le seul point de contact avec le modèle. Le navigateur n'a jamais accès aux identifiants AWS.

## Stack technique

- **Node.js** (ES modules) + **Express 5**
- **AWS Bedrock** (API Converse) — modèle **GLM-4.7 Flash** (Z-AI, licence MIT, 100% open source)
- **officeparser** pour l'extraction de texte des documents
- **crypto** (module natif Node) pour l'authentification
- Stockage en fichier **JSON**
- Hébergement : backend sur **AWS EC2** (Francfort), interface sur **S3**, déploiement automatique via **GitHub Actions**

## Architecture en couches

Chaque requête traverse les mêmes couches, dans le même ordre. Chaque couche a un seul rôle : changer de modèle ou de stockage ne touche qu'une seule couche.

## Organisation du code

| Dossier / fichier | Rôle |
|---|---|
| `server.js` | Point d'entrée : monte les routes, transforme les erreurs en JSON `{ error, code }`, crée le compte admin au démarrage |
| `config.js` | Configuration lue depuis `.env` (modèle, prompt système, limites, durée des sessions) |
| `routes/` | Associe chaque URL à un contrôleur, déclare les routes protégées |
| `middleware/` | Authentification : lit l'en-tête `Authorization: Bearer` |
| `controllers/` | Reçoivent la requête, la valident, appellent le service adéquat |
| `validation.js` | Vérifie chaque requête (types, longueurs, formats de fichier) |
| `services/` | Logique métier : comptes/sessions, conversations, appel au modèle, extraction de documents |
| `store/` | Lecture/écriture atomique de `data/db.json` |
| `errors.js` | Erreurs applicatives et traduction des erreurs AWS |
| `utils/`, `scripts/`, `seed/` | Annulation d'appel (bouton Stop), création d'admin en CLI, compte admin initial |

## API

Toutes les routes sont préfixées par `/api` et échangent du JSON.

**Authentification**
- `POST /auth/login` (public) — email + mot de passe → jeton de session (7 jours)
- `POST /auth/logout` (connecté)
- `GET /auth/me` (connecté)
- `GET /info` (public) — modèle, fournisseur et région pour le bandeau de transparence

**Conversations enregistrées** *(connecté)*
- `GET` / `POST /conversations`
- `GET` / `PATCH` / `DELETE /conversations/:id`
- `POST /conversations/:id/messages`
- `POST /conversations/:id/regenerate`

**Mode invité** *(public, rien n'est enregistré)*
- `POST /chat`
- `POST /document/summarize` — PDF, Word, Excel ou PowerPoint + consigne

## Sécurité et fiabilité

- La clé AWS reste côté serveur, jamais exposée au navigateur
- Mots de passe hachés avec **scrypt** (sel aléatoire, comparaison en temps constant)
- Sessions par jeton aléatoire (32 octets), seul le hash SHA-256 est stocké
- Isolation stricte des conversations par propriétaire (404 si accès non autorisé)
- Anti force brute : 5 tentatives de connexion/minute/IP, puis 429
- Validation systématique de toute entrée via `validation.js`
- Écriture atomique du fichier de données (fichier temporaire puis renommage)
- Configuration entièrement pilotée via `.env`, sans dépendance ajoutée pour l'auth

## Données stockées (`data/db.json`)

```js
// users
{ id, email, name, role: "admin", passwordHash: "scrypt$<sel>$<hash>", createdAt }

// sessions (le jeton lui-même n'est jamais stocké)
{ tokenHash, userId, createdAt, expiresAt }

// conversations
{ id, userId, title, createdAt, updatedAt,
  messages: [ { id, role: "user" | "assistant", content, createdAt, truncated?, attachment? } ] }
```

Le mode invité n'écrit rien : les messages sont envoyés au modèle puis oubliés par le serveur.

## Limites connues et pistes d'amélioration

- **Fournisseur américain** : le modèle tourne sur AWS Bedrock à Francfort (données en UE, mais AWS relève du CLOUD Act). Changer de fournisseur ne toucherait que `BedrockService.js`
- **HTTP sans chiffrement** : nécessiterait un nom de domaine + HTTPS (Caddy ou nginx devant Express)
- **Stockage fichier** : suffisant pour une démo, PostgreSQL recommandé au-delà
- **Pas de streaming** : la réponse arrive d'un bloc
- **Documents** : les PDF scannés (images) ne sont pas lus faute d'OCR ; les anciens formats `.doc`/`.xls` non plus

---

*Le backend est la seule porte vers le modèle : il décide qui peut parler à l'IA, ce qui est envoyé, ce qui est conservé — le modèle y est un composant remplaçable.*

