import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

// Base de données minimale : un fichier JSON chargé en mémoire au démarrage.
// Les écritures sont sérialisées (une à la fois) et atomiques (fichier temporaire puis rename),
// pour qu'un arrêt brutal ne laisse jamais un fichier à moitié écrit.
//
// Attention : le serveur garde les données en mémoire. Tout script qui modifie le fichier
// (ex. create-admin) doit être lancé serveur arrêté, sinon le serveur écrasera ses changements.

const fichier = path.resolve(config.stockage.fichier);
const VIDE = { users: [], sessions: [], conversations: [] };

// Lecture au démarrage : fichier absent = base vide (premier lancement), fichier illisible = arrêt
// (mieux vaut refuser de démarrer que repartir d'une base vide et écraser les données).
async function charger() {
  try {
    const contenu = JSON.parse(await fs.readFile(fichier, "utf8"));
    return { ...structuredClone(VIDE), ...contenu };
  } catch (err) {
    if (err.code === "ENOENT") return structuredClone(VIDE);
    throw new Error(`Impossible de lire la base ${fichier} : ${err.message}`);
  }
}

// Données partagées par tous les services : { users, sessions, conversations }.
export const db = await charger();

// À appeler après chaque modification de db. L'état est figé au moment de l'appel (instantané),
// puis écrit à la suite des écritures précédentes grâce à la chaîne de promesses fileEcriture.
let fileEcriture = Promise.resolve();

export function sauvegarder() {
  const instantane = JSON.stringify(db, null, 2);
  fileEcriture = fileEcriture
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(fichier), { recursive: true });
      const temporaire = `${fichier}.tmp`;
      await fs.writeFile(temporaire, instantane, "utf8");
      await fs.rename(temporaire, fichier);
    });
  return fileEcriture.catch((err) => {
    console.error(`[store] échec de sauvegarde : ${err.message}`);
    throw err;
  });
}
