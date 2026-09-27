import { stockage } from "./api.js";

// Thème : "light", "dark" ou "system" (suit la préférence du système, par défaut).
const CLE = "transformers.theme";

export function themeActuel() {
  const valeur = stockage.lire(CLE);
  return valeur === "light" || valeur === "dark" ? valeur : "system";
}

export function appliquerTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    stockage.ecrire(CLE, theme);
  } else {
    delete document.documentElement.dataset.theme;
    stockage.ecrire(CLE, null);
  }
}
