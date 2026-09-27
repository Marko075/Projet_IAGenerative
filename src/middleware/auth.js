// Middlewares d'authentification : lisent le jeton « Authorization: Bearer <jeton> »
// et retrouvent l'utilisateur correspondant (voir AuthService). Pas de cookies :
// le frontend (S3) et le backend (EC2) sont sur des origines différentes.
import { AppError } from "../errors.js";
import { utilisateurDepuisJeton } from "../services/AuthService.js";

function lireJeton(req) {
  const entete = req.get("authorization") || "";
  const [type, jeton] = entete.split(" ");
  return type === "Bearer" && jeton ? jeton : null;
}

// Remplit req.user si un jeton valide est fourni, sans rien exiger (routes ouvertes aux invités).
export function optionalAuth(req, res, next) {
  const jeton = lireJeton(req);
  req.jeton = jeton;
  req.user = jeton ? utilisateurDepuisJeton(jeton) : null;
  next();
}

// Même lecture, mais refuse la requête (401) si aucun utilisateur valide n'est trouvé.
export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Session expirée ou invalide. Reconnecte-toi."));
    next();
  });
}
