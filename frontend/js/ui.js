import { el, icone } from "./dom.js";

// ---------- Menu flottant (un seul ouvert à la fois) ----------
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
const zoneToast = document.getElementById("toast");
let minuteurToast = null;

export function toast(texte, duree = 2500) {
  zoneToast.textContent = texte;
  zoneToast.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { zoneToast.hidden = true; }, duree);
}
