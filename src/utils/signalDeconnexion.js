// Signal déclenché si le client ferme la connexion avant la réponse (bouton « Stop ») :
// l'appel au modèle est alors annulé et rien n'est enregistré.
export function signalDeconnexion(res) {
  const controleur = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controleur.abort();
  });
  return controleur.signal;
}
