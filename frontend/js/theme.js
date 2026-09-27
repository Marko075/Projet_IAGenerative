import { stockage } from "./api.js";

// Thème : "light", "dark" ou "system" (suit la préférence du système, par défaut).
// Le CSS lit l'attribut data-theme de <html> ; sans attribut, il suit prefers-color-scheme.
// Le choix est mémorisé dans le navigateur (et réappliqué dès le chargement, voir index.html).
const CLE = "transformers.theme";

// Thème enregistré, ou "system" si aucun choix explicite.
export function themeActuel() {
  const valeur = stockage.lire(CLE);
  return valeur === "light" || valeur === "dark" ? valeur : "system";
}

// Applique immédiatement le thème et le mémorise ("system" efface le choix).
export function appliquerTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    stockage.ecrire(CLE, theme);
  } else {
    delete document.documentElement.dataset.theme;
    stockage.ecrire(CLE, null);
  }
}
