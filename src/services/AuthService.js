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
export function utilisateurPublic(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

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
const hacherJeton = (jeton) => crypto.createHash("sha256").update(jeton).digest("hex");

function purgerSessionsExpirees() {
  const maintenant = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > maintenant);
}

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
