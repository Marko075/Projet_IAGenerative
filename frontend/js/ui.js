// Composants d'interface réutilisables : menu flottant, dialogue de confirmation, notification.
import { el, icone } from "./dom.js";

// ---------- Menu flottant (un seul ouvert à la fois) ----------
// Utilisé pour le menu ⋯ des conversations et le menu utilisateur. Un seul élément #popover
// dans la page, rempli à chaque ouverture ; il se ferme au clic extérieur, avec Échap ou au redimensionnement.
const popover = document.getElementById("popover");
let fermerCourant = null;
let ancreCourante = null;

export function menuOuvertPour(ancre) {
  return ancreCourante === ancre;
}

export function fermerMenu() {
  const fermer = fermerCourant;
  fermerCourant = null;
  ancreCourante = null;
  fermer?.();
}

// Place le menu sous le bouton qui l'ouvre, ou au-dessus / décalé s'il sortirait de l'écran.
function positionner(ancre) {
  const r = ancre.getBoundingClientRect();
  const largeur = popover.offsetWidth;
  const hauteur = popover.offsetHeight;
  let haut = r.bottom + 6;
  if (haut + hauteur > window.innerHeight - 8) haut = Math.max(8, r.top - hauteur - 6);
  let gauche = r.left;
  if (gauche + largeur > window.innerWidth - 8) gauche = r.right - largeur;
  popover.style.top = `${haut}px`;
  popover.style.left = `${Math.max(8, gauche)}px`;
}

// Ouvre le menu sous « ancre » avec les éléments « contenu ». Les écouteurs de fermeture
// sont ajoutés ici et retirés dans fermerCourant, pour ne rien laisser traîner après fermeture.
export function ouvrirMenu(ancre, contenu, { onClose } = {}) {
  fermerMenu();
  popover.replaceChildren(...contenu);
  popover.hidden = false;
  positionner(ancre);
  ancre.setAttribute("aria-expanded", "true");

  const clicExterieur = (e) => {
    if (!popover.contains(e.target) && !ancre.contains(e.target)) fermerMenu();
  };
  const clavier = (e) => {
    if (e.key === "Escape") {
      fermerMenu();
      ancre.focus();
    }
  };
  document.addEventListener("pointerdown", clicExterieur);
  document.addEventListener("keydown", clavier);
  window.addEventListener("resize", fermerMenu);

  ancreCourante = ancre;
  fermerCourant = () => {
    document.removeEventListener("pointerdown", clicExterieur);
    document.removeEventListener("keydown", clavier);
    window.removeEventListener("resize", fermerMenu);
    ancre.setAttribute("aria-expanded", "false");
    popover.hidden = true;
    popover.replaceChildren();
    onClose?.();
  };

  popover.querySelector("button")?.focus({ preventScroll: true });
}

// Ligne cliquable d'un menu (icône + libellé) ; ferme le menu avant d'exécuter l'action.
export function itemMenu(libelle, nomIcone, action, { danger = false } = {}) {
  return el(
    "button",
    {
      class: `menu-item${danger ? " danger" : ""}`,
      type: "button",
      role: "menuitem",
      onclick: () => {
        fermerMenu();
        action();
      },
    },
    icone(nomIcone),
    libelle,
  );
}

// ---------- Dialogue de confirmation ----------
// Remplace confirm() du navigateur par une fenêtre au style de l'application (élément <dialog> natif).
// Renvoie une promesse : true si l'utilisateur confirme, false s'il annule ou ferme.
const dialogue = document.getElementById("confirm-dialog");

export function confirmer({ titre, message, libelle = "Confirmer" }) {
  document.getElementById("confirm-title").textContent = titre;
  document.getElementById("confirm-message").textContent = message;
  document.getElementById("confirm-ok").textContent = libelle;
  dialogue.returnValue = "";
  dialogue.showModal();
  return new Promise((resoudre) => {
    dialogue.addEventListener("close", () => resoudre(dialogue.returnValue === "ok"), { once: true });
  });
}

// ---------- Notification éphémère ----------
// Petit message en bas de l'écran (« Conversation supprimée », « Génération interrompue »…),
// masqué automatiquement ; un nouveau message remplace le précédent.
const zoneToast = document.getElementById("toast");
let minuteurToast = null;

export function toast(texte, duree = 2500) {
  zoneToast.textContent = texte;
  zoneToast.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { zoneToast.hidden = true; }, duree);
}
