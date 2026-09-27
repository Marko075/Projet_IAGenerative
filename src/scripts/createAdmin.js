// Crée un compte administrateur en ligne de commande.
// Usage (serveur arrêté, voir JsonStore.js) : npm run create-admin -- <email> <motdepasse> [nom]
// Remarque : le compte admin par défaut est déjà créé automatiquement au démarrage
// à partir de src/seed/admin.json ; ce script sert à en ajouter un autre si besoin.
import { creerUtilisateur } from "../services/AuthService.js";

const [email, motDePasse, nom] = process.argv.slice(2);

// ---------- Vérification des arguments ----------
if (!email || !motDePasse) {
  console.error("Usage : npm run create-admin -- <email> <motdepasse> [nom]");
  process.exit(1);
}
if (motDePasse.length < 8) {
  console.error("Le mot de passe doit faire au moins 8 caractères.");
  process.exit(1);
}

// ---------- Création (refusée si l'email existe déjà) ----------
try {
  const user = await creerUtilisateur({ email, motDePasse, nom: nom || "Administrateur", role: "admin" });
  console.log(`✅ Compte admin créé : ${user.email}`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
