import { copier, el, icone } from "./dom.js";

// Rendu Markdown des réponses du modèle.
// marked produit le HTML, DOMPurify le nettoie (anti-XSS), highlight.js colore le code.
// Si les bibliothèques CDN n'ont pas pu être chargées, on affiche le texte brut.

const librairiesDisponibles = () =>
  typeof window.marked !== "undefined" && typeof window.DOMPurify !== "undefined";

let configure = false;
function configurer() {
  if (configure) return;
  window.marked.setOptions({ gfm: true, breaks: true });
  configure = true;
}

function enrichirBlocCode(pre) {
  const code = pre.querySelector("code");
  if (!code) return;
  const langue = [...code.classList].find((c) => c.startsWith("language-"))?.slice(9) ?? "";
  if (window.hljs) {
    try { window.hljs.highlightElement(code); } catch {}
  }

  const bouton = el("button", { class: "code-copy", type: "button" }, icone("copy"), "Copier");
  bouton.addEventListener("click", async () => {
    try {
      await copier(code.textContent);
      bouton.replaceChildren(icone("check"), "Copié");
      setTimeout(() => bouton.replaceChildren(icone("copy"), "Copier"), 1500);
    } catch {}
  });

  const bloc = el("div", { class: "code-block" }, el("div", { class: "code-head" }, el("span", { text: langue || "code" }), bouton));
  pre.replaceWith(bloc);
  bloc.append(pre);
}

export function rendreMarkdown(texte) {
  const conteneur = el("div", { class: "markdown" });

  if (!librairiesDisponibles()) {
    conteneur.style.whiteSpace = "pre-wrap";
    conteneur.textContent = texte;
    return conteneur;
  }

  configurer();
  conteneur.innerHTML = window.DOMPurify.sanitize(window.marked.parse(texte));
  conteneur.querySelectorAll("pre").forEach(enrichirBlocCode);
  conteneur.querySelectorAll("a[href]").forEach((lien) => {
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
  });
  return conteneur;
}
