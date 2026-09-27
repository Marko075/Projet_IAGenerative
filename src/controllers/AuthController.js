import { config } from "../config.js";
import { connecter, deconnecter, utilisateurPublic, verifierLimiteConnexion } from "../services/AuthService.js";
import { validerIdentifiants } from "../validation.js";

export async function handleLogin(req, res) {
  verifierLimiteConnexion(req.ip);
  const { email, motDePasse } = validerIdentifiants(req.body);
  const { jeton, user } = await connecter(email, motDePasse);
  res.json({ token: jeton, user });
}

export async function handleLogout(req, res) {
  await deconnecter(req.jeton);
  res.status(204).end();
}

export function handleMe(req, res) {
  res.json({ user: utilisateurPublic(req.user) });
}

// Informations affichées dans le bandeau de transparence de l'interface.
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
