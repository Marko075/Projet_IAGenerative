// Service d'authentification : comptes, mots de passe, sessions et limitation des tentatives.
// Uniquement des modules natifs de Node (crypto) : aucune dépendance externe à maintenir.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import { db, sauvegarder } from "../store/JsonStore.js";

const scrypt = promisify(crypto.scrypt);
const LONGUEUR_HASH = 64;
const JOUR_MS = 24 * 60 * 60 * 1000;

// ---------- Mots de passe ----------
// scrypt + sel aléatoire propre à chaque compte : deux mots de passe identiques donnent des hash différents,
// et le calcul volontairement coûteux ralentit les attaques par force brute.
// Format stocké : "scrypt$<sel>$<hash>". La comparaison se fait en temps constant (timingSafeEqual).
export async function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16);
  const hash = await scrypt(motDePasse, sel, LONGUEUR_HASH);
  return `scrypt$${sel.toString("hex")}$${hash.toString("hex")}`;
}

async function verifierMotDePasse(motDePasse, stocke) {
  const [, selHex, hashHex] = stocke.split("$");
  const attendu = Buffer.from(hashHex, "hex");
  const calcule = await scrypt(motDePasse, Buffer.from(selHex, "hex"), attendu.length);
  return crypto.timingSafeEqual(attendu, calcule);
}

// Hash factice : on fait le même calcul quand l'email n'existe pas,
// pour ne pas révéler par le temps de réponse quels comptes existent.
const HASH_FACTICE = await hacherMotDePasse(crypto.randomUUID());

// ---------- Utilisateurs ----------
// Version renvoyée au client : jamais le hash du mot de passe.
export function utilisateurPublic(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// Création d'un compte (utilisée par le script create-admin). L'email sert d'identifiant unique.
export async function creerUtilisateur({ email, motDePasse, nom, role = "user" }) {
  const emailNormalise = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === emailNormalise)) {
    throw new AppError(409, "EMAIL_TAKEN", "Un compte existe déjà avec cet email.");
  }
  const user = {
    id: crypto.randomUUID(),
    email: emailNormalise,
    name: nom || emailNormalise.split("@")[0],
    role,
    passwordHash: await hacherMotDePasse(motDePasse),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await sauvegarder();
  return user;
}

// Compte admin amorcé depuis src/seed/admin.json (email + hash, jamais le mot de passe en clair).
// Créé au démarrage s'il n'existe pas encore ; un compte existant n'est jamais réécrasé.
const FICHIER_AMORCAGE = new URL("../seed/admin.json", import.meta.url);

export async function amorcerAdmin() {
  let amorce;
  try {
    amorce = JSON.parse(await fs.readFile(FICHIER_AMORCAGE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Error(`Fichier d'amorçage admin illisible : ${err.message}`);
  }

  const email = amorce.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) return null;

  const user = {
    id: crypto.randomUUID(),
    email,
    name: amorce.name || "Administrateur",
    role: "admin",
    passwordHash: amorce.passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await sauvegarder();
  return user;
}

// ---------- Sessions ----------
// Une session = un jeton aléatoire remis au client, valable SESSION_TTL_DAYS jours.
const hacherJeton = (jeton) => crypto.createHash("sha256").update(jeton).digest("hex");

// Nettoyage des sessions expirées (fait à chaque connexion pour que le fichier ne grossisse pas).
function purgerSessionsExpirees() {
  const maintenant = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > maintenant);
}

// Connexion : même message d'erreur que l'email soit inconnu ou le mot de passe faux
// (on ne révèle pas quels comptes existent), puis création d'une session.
export async function connecter(email, motDePasse) {
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  const valide = await verifierMotDePasse(motDePasse, user?.passwordHash ?? HASH_FACTICE);
  if (!user || !valide) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");
  }

  // Seul le hash du jeton est stocké : une fuite du fichier ne permet pas d'usurper une session.
  const jeton = crypto.randomBytes(32).toString("base64url");
  purgerSessionsExpirees();
  db.sessions.push({
    tokenHash: hacherJeton(jeton),
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + config.auth.dureeSessionJours * JOUR_MS).toISOString(),
  });
  await sauvegarder();
  return { jeton, user: utilisateurPublic(user) };
}

// Retrouve l'utilisateur d'un jeton (appelé par le middleware à chaque requête authentifiée).
export function utilisateurDepuisJeton(jeton) {
  const hash = hacherJeton(jeton);
  const session = db.sessions.find((s) => s.tokenHash === hash);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

export async function deconnecter(jeton) {
  const hash = hacherJeton(jeton);
  db.sessions = db.sessions.filter((s) => s.tokenHash !== hash);
  await sauvegarder();
}

// ---------- Limitation des tentatives de connexion (en mémoire, par IP) ----------
// Fenêtre d'une minute par adresse IP : au-delà de LOGIN_ATTEMPTS_PER_MINUTE essais, réponse 429.
// Freine les tentatives de deviner un mot de passe. Remis à zéro au redémarrage du serveur.
const tentatives = new Map();

export function verifierLimiteConnexion(ip) {
  const maintenant = Date.now();
  const entree = tentatives.get(ip);
  if (!entree || entree.finFenetre <= maintenant) {
    tentatives.set(ip, { nombre: 1, finFenetre: maintenant + 60_000 });
    return;
  }
  entree.nombre += 1;
  if (entree.nombre > config.auth.tentativesConnexionParMinute) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "Trop de tentatives de connexion. Réessaie dans une minute.");
  }
}
