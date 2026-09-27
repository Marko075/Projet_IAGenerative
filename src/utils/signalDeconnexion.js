// Signal déclenché si le client ferme la connexion avant la réponse (bouton « Stop ») :
// l'appel au modèle est alors annulé et rien n'est enregistré.
// « close » est émis dans tous les cas ; writableFinished permet de distinguer
// une réponse envoyée normalement d'une connexion coupée par le client.
export function signalDeconnexion(res) {
  const controleur = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controleur.abort();
  });
  return controleur.signal;
}
