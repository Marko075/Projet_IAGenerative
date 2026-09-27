// Erreur applicative : porte le code HTTP et un message affichable côté client.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Traduit les erreurs du SDK Bedrock en erreurs compréhensibles pour l'utilisateur.
export function traduireErreurBedrock(err) {
  switch (err.name) {
    case "TimeoutError":
    case "AbortError":
      return new AppError(504, "TIMEOUT", "Le modèle a mis trop de temps à répondre. Réessaie.");
    case "ThrottlingException":
    case "ServiceQuotaExceededException":
      return new AppError(429, "RATE_LIMITED", "Trop de requêtes vers le modèle, réessaie dans un instant.");
    case "ModelNotReadyException":
    case "ModelTimeoutException":
    case "ServiceUnavailableException":
    case "InternalServerException":
      return new AppError(503, "MODEL_UNAVAILABLE", "Le modèle est momentanément indisponible. Réessaie.");
    case "AccessDeniedException":
      return new AppError(502, "MODEL_ACCESS_DENIED", "Accès au modèle refusé (droits AWS à vérifier).");
    case "ResourceNotFoundException":
      return new AppError(502, "MODEL_NOT_FOUND", "Modèle introuvable (vérifier MODEL_ID).");
    case "ValidationException":
      return new AppError(502, "MODEL_REJECTED", "Le modèle a refusé la requête (conversation peut-être trop longue).");
    default:
      return new AppError(500, "INTERNAL_ERROR", "Erreur serveur.");
  }
}
