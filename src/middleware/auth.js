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

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Session expirée ou invalide. Reconnecte-toi."));
    next();
  });
}
