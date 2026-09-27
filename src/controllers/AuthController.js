// Contrôleurs de l'authentification et des informations publiques de l'assistant.
import { config } from "../config.js";
import { connecter, deconnecter, utilisateurPublic, verifierLimiteConnexion } from "../services/AuthService.js";
import { validerIdentifiants } from "../validation.js";

// POST /api/auth/login — limite de tentatives par IP, puis vérification des identifiants.
// Renvoie un jeton de session que le frontend enverra ensuite dans l'en-tête Authorization.
export async function handleLogin(req, res) {
  verifierLimiteConnexion(req.ip);
  const { email, motDePasse } = validerIdentifiants(req.body);
  const { jeton, user } = await connecter(email, motDePasse);
  res.json({ token: jeton, user });
}

// POST /api/auth/logout — supprime la session correspondant au jeton envoyé.
export async function handleLogout(req, res) {
  await deconnecter(req.jeton);
  res.status(204).end();
}

// GET /api/auth/me — utilisé au chargement de la page pour savoir si le jeton stocké est encore valide.
export function handleMe(req, res) {
  res.json({ user: utilisateurPublic(req.user) });
}

// GET /api/info — informations affichées dans le bandeau de transparence de l'interface
// (l'utilisateur sait quel modèle répond, via quel fournisseur et dans quelle région).
export function handleInfo(req, res) {
  res.json({
    assistant: config.nomAssistant,
    model: config.modele.id,
    modelLabel: config.modele.libelle,
    provider: config.fournisseur,
    region: config.awsRegion,
    regionLabel: config.libelleRegion,
  });
}
