// Petits utilitaires DOM. Tout texte venant de l'utilisateur ou du modèle passe par textContent
// (jamais innerHTML), sauf le Markdown qui est nettoyé par DOMPurify (voir markdown.js).

// Crée un élément HTML en une ligne : el("button", { class, text, onclick }, ...enfants).
// "text" passe par textContent (pas d'injection possible), "onXxx" ajoute un écouteur d'événement.
export function el(tag, props = {}, ...enfants) {
  const noeud = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(props)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === "class") noeud.className = valeur;
    else if (cle === "text") noeud.textContent = valeur;
    else if (cle === "dataset") Object.assign(noeud.dataset, valeur);
    else if (cle.startsWith("on")) noeud.addEventListener(cle.slice(2).toLowerCase(), valeur);
    else noeud.setAttribute(cle, valeur === true ? "" : valeur);
  }
  for (const enfant of enfants.flat()) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    noeud.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return noeud;
}

// Icônes SVG statiques (contenu fixe, défini ici : pas de risque d'injection).
const TRACES = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  dots: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  paperclip: '<path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0Z"/><path d="m19 7-3 7a3 3 0 0 0 6 0Z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
};

export function icone(nom) {
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRACES[nom] ?? ""}</svg>`;
  return span;
}

// Logo Transformers : carré arrondi à la couleur d'accent avec un « T » (s'adapte au thème).
const LOGO_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M10 11h12M16 11v11" stroke="var(--accent-contrast)" stroke-width="3" stroke-linecap="round"/></svg>`;

export function logo() {
  const span = document.createElement("span");
  span.className = "logo";
  span.innerHTML = LOGO_SVG;
  return span;
}

// Remplit les emplacements déclarés dans le HTML : data-icon="nom" et data-logo.
export function hydraterIcones(racine = document) {
  racine.querySelectorAll("[data-icon]").forEach((noeud) => {
    noeud.prepend(icone(noeud.dataset.icon));
    noeud.removeAttribute("data-icon");
  });
  racine.querySelectorAll("[data-logo]").forEach((noeud) => {
    noeud.innerHTML = LOGO_SVG;
    noeud.removeAttribute("data-logo");
  });
}

// Copie dans le presse-papiers, avec repli pour les pages servies en HTTP
// (l'API Clipboard n'est disponible qu'en contexte sécurisé).
export async function copier(texte) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(texte);
    return;
  }
  const zone = el("textarea", { style: "position:fixed;opacity:0;pointer-events:none" });
  zone.value = texte;
  document.body.append(zone);
  zone.select();
  const ok = document.execCommand("copy");
  zone.remove();
  if (!ok) throw new Error("Copie impossible");
}
