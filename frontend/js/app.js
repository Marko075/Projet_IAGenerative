import { api, jeton, quandSessionExpiree, stockage } from "./api.js";
import { NOM_ASSISTANT, TAILLE_MAX_PPTX } from "./config.js";
import { copier, el, hydraterIcones, icone, logo } from "./dom.js";
import { rendreMarkdown } from "./markdown.js";
import { appliquerTheme, themeActuel } from "./theme.js";
import { confirmer, fermerMenu, itemMenu, menuOuvertPour, ouvrirMenu, toast } from "./ui.js";

const $ = (id) => document.getElementById(id);
const dom = {
  login: $("login-screen"),
  loginForm: $("login-form"),
  loginError: $("login-error"),
  loginEmail: $("login-email"),
  loginPassword: $("login-password"),
  loginSubmit: $("login-submit"),
  guestBtn: $("guest-btn"),
  app: $("app"),
  sidebarClose: $("sidebar-close"),
  sidebarOpen: $("sidebar-open"),
  overlay: $("overlay"),
  newChat: $("new-chat"),
  searchBox: $("search-box"),
  searchInput: $("search-input"),
  guestCard: $("guest-card"),
  guestLogin: $("guest-login"),
  convList: $("conv-list"),
  userBtn: $("user-btn"),
  userAvatar: $("user-avatar"),
  userName: $("user-name"),
  userSub: $("user-sub"),
  topbar: $("topbar"),
  convTitle: $("conv-title"),
  aiBadge: $("ai-badge"),
  aiBadgeDetail: $("ai-badge-detail"),
  thread: $("thread"),
  composer: $("composer"),
  composerInput: $("composer-input"),
  composerAttachment: $("composer-attachment"),
  attachBtn: $("attach-btn"),
  fileInput: $("file-input"),
  sendBtn: $("send-btn"),
  aboutDialog: $("about-dialog"),
  aboutList: $("about-list"),
  aboutStorage: $("about-storage"),
};

const CLE_MODE = "transformers.mode";
const CLE_SIDEBAR = "transformers.sidebar";
const LONGUEUR_TITRE_AUTO = 60;

const etat = {
  mode: null,          // "user" (connecté) ou "guest" (invité)
  user: null,
  info: null,          // modèle, fournisseur, région (bandeau de transparence)
  conversations: [],   // résumés { id, title, updatedAt } (mode connecté)
  courante: null,      // id de la conversation affichée (null = nouvelle)
  titre: null,
  messages: [],
  chargement: false,
  enCours: null,       // { controleur, type: "send" | "regen", pptx, silencieux }
  echec: null,         // { messageUtilisateur, erreur, relancer }
  pieceJointe: null,   // { nom, base64 }
  recherche: "",
  renommage: null,     // id de la conversation en cours de renommage
};

let compteurLocal = 0;
const idLocal = () => `local-${Date.now()}-${++compteurLocal}`;
const estMobile = () => window.matchMedia("(max-width: 800px)").matches;
const rendus = new WeakMap(); // message -> contenu Markdown déjà rendu

function titreAuto(texte) {
  const ligne = texte.replace(/\s+/g, " ").trim();
  return ligne.length > LONGUEUR_TITRE_AUTO ? `${ligne.slice(0, LONGUEUR_TITRE_AUTO - 1)}…` : ligne;
}

// ============================================================
// Session : connexion, invité, déconnexion
// ============================================================

function reinitialiserEtat() {
  arreter(true);
  Object.assign(etat, {
    mode: null, user: null, conversations: [], courante: null, titre: null, messages: [],
    chargement: false, echec: null, pieceJointe: null, recherche: "", renommage: null,
  });
  dom.searchInput.value = "";
  dom.composerInput.value = "";
}

function montrerConnexion(message = null) {
  fermerMenu();
  dom.app.hidden = true;
  dom.login.hidden = false;
  dom.loginError.hidden = !message;
  dom.loginError.textContent = message ?? "";
  dom.loginPassword.value = "";
  dom.loginEmail.focus();
  document.title = NOM_ASSISTANT;
}

function montrerApplication() {
  dom.login.hidden = true;
  dom.app.hidden = false;
  majProfil();
  nouvelleConversation({ focus: !estMobile() });
}

async function entrerUtilisateur(user) {
  // Lu avant montrerApplication(), qui réinitialise l'URL.
  const idDansUrl = location.hash.match(/^#c\/(.+)$/)?.[1];
  etat.mode = "user";
  etat.user = user;
  stockage.ecrire(CLE_MODE, null);
  montrerApplication();
  if (idDansUrl) ouvrirConversation(decodeURIComponent(idDansUrl));

  try {
    const { conversations } = await api.listerConversations();
    etat.conversations = conversations;
    rendreListe();
  } catch (err) {
    toast(`Impossible de charger l'historique : ${err.message}`, 4000);
  }
}

function entrerInvite() {
  etat.mode = "guest";
  etat.user = null;
  stockage.ecrire(CLE_MODE, "guest");
  montrerApplication();
}

async function allerVersConnexion() {
  if (etat.mode === "guest" && etat.messages.length) {
    const ok = await confirmer({
      titre: "Quitter le mode invité ?",
      message: "La conversation en cours n'est pas enregistrée et sera perdue.",
      libelle: "Continuer",
    });
    if (!ok) return;
  }
  reinitialiserEtat();
  stockage.ecrire(CLE_MODE, null);
  montrerConnexion();
}

async function deconnecter() {
  api.deconnexion().catch(() => {});
  jeton.set(null);
  reinitialiserEtat();
  history.replaceState(null, "", location.pathname + location.search);
  montrerConnexion();
}

quandSessionExpiree(() => {
  jeton.set(null);
  if (etat.mode === "user") {
    reinitialiserEtat();
    montrerConnexion("Votre session a expiré. Reconnectez-vous.");
  }
});

dom.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = dom.loginEmail.value.trim();
  const motDePasse = dom.loginPassword.value;
  if (!email || !motDePasse) {
    dom.loginError.textContent = "Renseignez votre email et votre mot de passe.";
    dom.loginError.hidden = false;
    return;
  }

  dom.loginSubmit.disabled = true;
  dom.loginSubmit.textContent = "Connexion…";
  try {
    const { token, user } = await api.connexion(email, motDePasse);
    jeton.set(token);
    reinitialiserEtat();
    await entrerUtilisateur(user);
  } catch (err) {
    dom.loginError.textContent = err.message;
    dom.loginError.hidden = false;
    dom.loginPassword.select();
  } finally {
    dom.loginSubmit.disabled = false;
    dom.loginSubmit.textContent = "Se connecter";
  }
});

dom.guestBtn.addEventListener("click", () => {
  reinitialiserEtat();
  entrerInvite();
});
dom.guestLogin.addEventListener("click", allerVersConnexion);

// ============================================================
// Panneau latéral : liste des conversations
// ============================================================

function grouperParDate(conversations) {
  const JOUR = 24 * 60 * 60 * 1000;
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const j = debutJour.getTime();

  const groupes = new Map([
    ["Aujourd'hui", []], ["Hier", []], ["7 derniers jours", []], ["30 derniers jours", []], ["Plus ancien", []],
  ]);
  for (const c of conversations) {
    const t = Date.parse(c.updatedAt);
    const cle = t >= j ? "Aujourd'hui"
      : t >= j - JOUR ? "Hier"
      : t >= j - 7 * JOUR ? "7 derniers jours"
      : t >= j - 30 * JOUR ? "30 derniers jours"
      : "Plus ancien";
    groupes.get(cle).push(c);
  }
  return [...groupes].filter(([, liste]) => liste.length);
}

function rendreListe() {
  const connecte = etat.mode === "user";
  dom.guestCard.hidden = connecte;
  dom.searchBox.hidden = !connecte;
  dom.convList.replaceChildren();
  if (!connecte) return;

  const filtre = etat.recherche.trim().toLowerCase();
  const conversations = etat.conversations.filter((c) => !filtre || c.title.toLowerCase().includes(filtre));
  if (!conversations.length) {
    dom.convList.append(el("p", { class: "conv-empty", text: filtre ? "Aucun résultat." : "Aucune conversation pour l'instant." }));
    return;
  }
  for (const [titre, liste] of grouperParDate(conversations)) {
    dom.convList.append(el("div", { class: "conv-group-title", text: titre }), ...liste.map(rendreItemConversation));
  }
}

function rendreItemConversation(c) {
  const actif = c.id === etat.courante;
  const item = el("div", { class: `conv-item${actif ? " active" : ""}` });

  if (etat.renommage === c.id) {
    const champ = el("input", { class: "conv-rename", value: c.title, maxlength: "120", "aria-label": "Nouveau titre" });
    let termine = false;
    const terminer = (garder) => {
      if (termine) return;
      termine = true;
      etat.renommage = null;
      const titre = champ.value.trim();
      if (garder && titre && titre !== c.title) renommer(c.id, titre);
      else rendreListe();
    };
    champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); terminer(true); }
      if (e.key === "Escape") terminer(false);
    });
    champ.addEventListener("blur", () => terminer(true));
    item.append(champ);
    queueMicrotask(() => { champ.focus(); champ.select(); });
    return item;
  }

  const lien = el("button", {
    class: "conv-link", type: "button", title: c.title, text: c.title,
    "aria-current": actif ? "page" : null,
    onclick: () => ouvrirConversation(c.id),
  });
  const boutonMenu = el("button", {
    class: "conv-menu-btn", type: "button", "aria-haspopup": "menu", "aria-label": `Options de « ${c.title} »`,
  }, icone("dots"));
  boutonMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menuOuvertPour(boutonMenu)) return fermerMenu();
    item.classList.add("menu-open");
    ouvrirMenu(boutonMenu, [
      itemMenu("Renommer", "pencil", () => { etat.renommage = c.id; rendreListe(); }),
      itemMenu("Supprimer", "trash", () => supprimerConversation(c), { danger: true }),
    ], { onClose: () => item.classList.remove("menu-open") });
  });

  item.append(lien, boutonMenu);
  return item;
}

function majResumeConversation(resume) {
  etat.conversations = [resume, ...etat.conversations.filter((c) => c.id !== resume.id)];
  rendreListe();
}

async function renommer(id, titre) {
  const conversation = etat.conversations.find((c) => c.id === id);
  const ancien = conversation?.title;
  if (conversation) conversation.title = titre;
  if (etat.courante === id) { etat.titre = titre; majTitre(); }
  rendreListe();
  try {
    await api.renommerConversation(id, titre);
  } catch (err) {
    if (conversation) conversation.title = ancien;
    if (etat.courante === id) { etat.titre = ancien; majTitre(); }
    rendreListe();
    toast(`Renommage impossible : ${err.message}`);
  }
}

async function supprimerConversation(c) {
  const ok = await confirmer({
    titre: "Supprimer la conversation ?",
    message: `« ${c.title} » sera définitivement supprimée.`,
    libelle: "Supprimer",
  });
  if (!ok) return;
  try {
    await api.supprimerConversation(c.id);
    etat.conversations = etat.conversations.filter((x) => x.id !== c.id);
    if (etat.courante === c.id) nouvelleConversation();
    else rendreListe();
    toast("Conversation supprimée.");
  } catch (err) {
    toast(`Suppression impossible : ${err.message}`);
  }
}

dom.searchInput.addEventListener("input", () => {
  etat.recherche = dom.searchInput.value;
  rendreListe();
});

// Ouverture / fermeture du panneau (tiroir sur mobile, repliable sur ordinateur)
function fermerSidebarMobile() {
  dom.app.classList.remove("sidebar-open");
}
dom.sidebarClose.addEventListener("click", () => {
  if (estMobile()) return fermerSidebarMobile();
  dom.app.classList.add("sidebar-collapsed");
  stockage.ecrire(CLE_SIDEBAR, "collapsed");
});
dom.sidebarOpen.addEventListener("click", () => {
  if (estMobile()) return dom.app.classList.add("sidebar-open");
  dom.app.classList.remove("sidebar-collapsed");
  stockage.ecrire(CLE_SIDEBAR, null);
});
dom.overlay.addEventListener("click", fermerSidebarMobile);
dom.newChat.addEventListener("click", () => nouvelleConversation());

// ============================================================
// Menu utilisateur, thème, bandeau de transparence
// ============================================================

function majProfil() {
  const connecte = etat.mode === "user";
  dom.userAvatar.classList.toggle("guest", !connecte);
  dom.userAvatar.textContent = connecte ? (etat.user.name || etat.user.email).charAt(0).toUpperCase() : "?";
  dom.userName.textContent = connecte ? etat.user.name : "Invité";
  dom.userSub.textContent = connecte ? etat.user.email : "Non connecté";
}

function selecteurTheme() {
  const options = [["light", "sun", "Clair"], ["dark", "moon", "Sombre"], ["system", "monitor", "Système"]];
  const boutons = options.map(([valeur, nomIcone, libelle]) => el("button", {
    type: "button", "aria-pressed": String(themeActuel() === valeur),
    onclick: () => {
      appliquerTheme(valeur);
      boutons.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i][0] === valeur)));
    },
  }, icone(nomIcone), libelle));
  return el("div", { class: "theme-switch", role: "group", "aria-label": "Thème" }, boutons);
}

dom.userBtn.addEventListener("click", () => {
  if (menuOuvertPour(dom.userBtn)) return fermerMenu();
  const connecte = etat.mode === "user";
  ouvrirMenu(dom.userBtn, [
    el("div", { class: "menu-header", text: connecte ? etat.user.email : "Mode invité" }),
    el("div", { class: "menu-sep" }),
    el("div", { class: "menu-label", text: "Thème" }),
    selecteurTheme(),
    el("div", { class: "menu-sep" }),
    itemMenu("À propos de l'assistant", "info", ouvrirAPropos),
    connecte
      ? itemMenu("Se déconnecter", "logout", deconnecter)
      : itemMenu("Se connecter", "login", allerVersConnexion),
  ]);
});

async function chargerInfo() {
  try {
    etat.info = await api.info();
    const ville = etat.info.regionLabel.split(",")[0];
    dom.aiBadgeDetail.textContent = `${etat.info.modelLabel} · ${etat.info.provider} (${ville})`;
    dom.aiBadge.title = `Vous discutez avec une IA : ${etat.info.modelLabel} via ${etat.info.provider}, ${etat.info.regionLabel}`;
  } catch {
    dom.aiBadgeDetail.textContent = NOM_ASSISTANT;
  }
}

function ouvrirAPropos() {
  const info = etat.info;
  const lignes = info
    ? [
      ["Assistant", info.assistant],
      ["Modèle", info.modelLabel],
      ["Identifiant", info.model],
      ["Fournisseur d'inférence", info.provider],
      ["Région d'inférence", `${info.regionLabel} (${info.region})`],
    ]
    : [["Assistant", NOM_ASSISTANT], ["Détails", "indisponibles (serveur injoignable)"]];
  dom.aboutList.replaceChildren(...lignes.map(([cle, valeur]) => el("li", {}, el("span", { text: cle }), el("span", { text: valeur }))));
  dom.aboutStorage.textContent = etat.mode === "user"
    ? "Vos conversations sont enregistrées sur le serveur de l'application pour que vous puissiez les retrouver. Vous pouvez les supprimer à tout moment depuis la liste."
    : "Mode invité : vos messages sont envoyés au modèle pour générer les réponses, mais rien n'est enregistré sur nos serveurs. La conversation disparaît quand vous quittez la page.";
  dom.aboutDialog.showModal();
}
dom.aiBadge.addEventListener("click", ouvrirAPropos);

// ============================================================
// Fil de discussion
// ============================================================

function majTitre() {
  dom.convTitle.textContent = etat.titre ?? "";
  document.title = etat.titre ? `${etat.titre} · ${NOM_ASSISTANT}` : NOM_ASSISTANT;
}

function majUrl() {
  const cible = etat.courante ? `#c/${encodeURIComponent(etat.courante)}` : location.pathname + location.search;
  history.replaceState(null, "", cible);
}

function boutonAction(nomIcone, libelle, action) {
  const bouton = el("button", { class: "icon-btn", type: "button", "aria-label": libelle, title: libelle }, icone(nomIcone));
  bouton.addEventListener("click", () => action(bouton));
  return bouton;
}

function rendreAccueil() {
  const suggestions = [
    { icone: "mail", texte: "Rédige un e-mail pour annoncer une réunion d'équipe lundi à 10 h" },
    { icone: "scale", texte: "Explique-moi les grands principes du RGPD en 5 points" },
    { icone: "layout", texte: "Aide-moi à structurer une présentation de projet" },
    { icone: "file", texte: "Résumer un PowerPoint (.pptx)", action: () => dom.fileInput.click() },
  ];
  const prenom = etat.mode === "user" ? etat.user.name : null;
  return el("div", { class: "empty" },
    logo(),
    el("h2", { text: prenom ? `Bonjour ${prenom}` : "Bonjour" }),
    el("p", { text: "Comment puis-je vous aider aujourd'hui ?" }),
    el("div", { class: "suggestions" }, suggestions.map((s) => el("button", {
      class: "suggestion", type: "button",
      onclick: s.action ?? (() => envoyer(s.texte, null)),
    }, icone(s.icone), el("span", { text: s.texte })))),
  );
}

function rendreMessageUtilisateur(message) {
  const bloc = el("div", { class: "msg msg-user" });
  if (message.attachment) {
    bloc.append(el("div", { class: "attachment-chip" }, icone("file"), el("span", { text: message.attachment })));
  }
  const texte = message.attachment ? message.content.replace(/^\[PowerPoint joint : [^\]]*\]\s?/, "") : message.content;
  if (texte) bloc.append(el("div", { class: "bubble", text: texte }));
  return bloc;
}

function peutRegenerer(index) {
  if (etat.enCours || index !== etat.messages.length - 1) return false;
  // En invité, le PowerPoint n'est pas conservé : impossible de redemander un résumé.
  return !(etat.mode === "guest" && etat.messages[index - 1]?.attachment);
}

function rendreMessageAssistant(message, index) {
  if (!rendus.has(message)) rendus.set(message, rendreMarkdown(message.content));
  const contenu = rendus.get(message);

  const actions = el("div", { class: "msg-actions" },
    boutonAction("copy", "Copier", async (bouton) => {
      try {
        await copier(message.content);
        bouton.replaceChildren(icone("check"));
        setTimeout(() => bouton.replaceChildren(icone("copy")), 1500);
      } catch {
        toast("Copie impossible.");
      }
    }),
    peutRegenerer(index) ? boutonAction("refresh", "Régénérer la réponse", () => regenerer()) : null,
    boutonAction("download", "Télécharger en PDF", () => exporterPdf(contenu.innerText)),
  );

  return el("div", { class: "msg msg-assistant" },
    logo(),
    el("div", { class: "msg-body" },
      el("div", { class: "msg-author", text: NOM_ASSISTANT }),
      contenu,
      message.truncated
        ? el("div", { class: "msg-note" }, icone("info"), "Réponse tronquée : la limite de longueur a été atteinte.")
        : null,
      actions,
    ),
  );
}

function rendreReflexion() {
  const libelle = etat.enCours.pptx ? "Lecture du PowerPoint…" : `${NOM_ASSISTANT} réfléchit…`;
  return el("div", { class: "msg msg-assistant" },
    logo(),
    el("div", { class: "msg-body" },
      el("div", { class: "msg-author", text: NOM_ASSISTANT }),
      el("div", { class: "thinking" }, el("span", { class: "dots" }, el("span"), el("span"), el("span")), libelle),
    ),
  );
}

function rendreEchec() {
  return el("div", { class: "msg" },
    el("div", { class: "error-box", role: "alert" },
      icone("alert"),
      el("span", { text: etat.echec.erreur }),
      el("button", { class: "btn btn-secondary", type: "button", onclick: etat.echec.relancer }, icone("refresh"), "Réessayer"),
    ),
  );
}

function rendreFil() {
  if (etat.chargement) {
    dom.thread.replaceChildren(el("div", { class: "thread-inner" }, el("p", { class: "loading-thread", text: "Chargement de la conversation…" })));
    return;
  }
  if (!etat.messages.length && !etat.enCours && !etat.echec) {
    dom.thread.replaceChildren(rendreAccueil());
    majBordureEntete();
    return;
  }

  const interieur = el("div", { class: "thread-inner" });
  // Pendant une régénération, l'ancienne réponse est masquée et remplacée par l'indicateur.
  const visibles = etat.enCours?.type === "regen" ? etat.messages.slice(0, -1) : etat.messages;
  visibles.forEach((m, i) => interieur.append(m.role === "user" ? rendreMessageUtilisateur(m) : rendreMessageAssistant(m, i)));
  if (etat.echec?.messageUtilisateur) interieur.append(rendreMessageUtilisateur(etat.echec.messageUtilisateur));
  if (etat.echec) interieur.append(rendreEchec());
  if (etat.enCours) interieur.append(rendreReflexion());

  dom.thread.replaceChildren(interieur);
  dom.thread.scrollTop = dom.thread.scrollHeight;
  majBordureEntete();
}

function majBordureEntete() {
  dom.topbar.classList.toggle("scrolled", dom.thread.scrollTop > 0);
}
dom.thread.addEventListener("scroll", majBordureEntete, { passive: true });

function exporterPdf(texte) {
  if (!window.jspdf) return toast("Export PDF indisponible.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const marge = 15;
  const largeur = doc.internal.pageSize.getWidth() - 2 * marge;
  const basPage = doc.internal.pageSize.getHeight() - marge;

  doc.setFontSize(14);
  const entete = doc.splitTextToSize(`${NOM_ASSISTANT} — ${etat.titre || "Réponse"}`, largeur);
  doc.text(entete, marge, 20);
  let y = 20 + entete.length * 7 + 4;

  doc.setFontSize(11);
  for (const ligne of doc.splitTextToSize(texte, largeur)) {
    if (y > basPage) { doc.addPage(); y = 20; }
    doc.text(ligne, marge, y);
    y += 6;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Réponse générée par une IA (Transformers) : elle peut contenir des erreurs.", marge, basPage + 8);
  doc.save("transformers-reponse.pdf");
}

// ============================================================
// Conversations : ouvrir, créer
// ============================================================

function nouvelleConversation({ focus = true } = {}) {
  arreter(true);
  Object.assign(etat, { courante: null, titre: null, messages: [], echec: null, chargement: false });
  majUrl();
  rendreListe();
  majTitre();
  rendreFil();
  majComposer();
  fermerSidebarMobile();
  if (focus) dom.composerInput.focus();
}

async function ouvrirConversation(id) {
  fermerSidebarMobile();
  if (id === etat.courante && !etat.chargement && !etat.echec) return;
  arreter(true);
  Object.assign(etat, {
    courante: id, messages: [], echec: null, chargement: true,
    titre: etat.conversations.find((c) => c.id === id)?.title ?? null,
  });
  majUrl();
  rendreListe();
  majTitre();
  rendreFil();

  try {
    const { conversation } = await api.obtenirConversation(id);
    if (etat.courante !== id) return;
    etat.messages = conversation.messages;
    etat.titre = conversation.title;
  } catch (err) {
    if (etat.courante !== id) return;
    if (err.status === 404) {
      etat.conversations = etat.conversations.filter((c) => c.id !== id);
      toast("Cette conversation n'existe plus.");
      return nouvelleConversation();
    }
    etat.echec = { messageUtilisateur: null, erreur: err.message, relancer: () => ouvrirConversation(id) };
  } finally {
    if (etat.courante === id) {
      etat.chargement = false;
      majTitre();
      rendreFil();
    }
  }
}

// ============================================================
// Envoi, régénération, arrêt
// ============================================================

function arreter(silencieux = false) {
  if (!etat.enCours) return;
  etat.enCours.silencieux = silencieux;
  etat.enCours.controleur.abort();
}

function retirerMessage(message) {
  const index = etat.messages.indexOf(message);
  if (index !== -1) etat.messages.splice(index, 1);
}

async function envoyer(texte, pieceJointe) {
  if (etat.enCours || etat.chargement) return;

  const messageUtilisateur = {
    id: idLocal(),
    role: "user",
    content: pieceJointe ? `[PowerPoint joint : ${pieceJointe.nom}]${texte ? ` ${texte}` : ""}` : texte,
    attachment: pieceJointe?.nom,
  };
  const tache = { controleur: new AbortController(), type: "send", pptx: !!pieceJointe, silencieux: false };
  let conversationCreee = null; // créée pour ce premier message : supprimée si l'envoi n'aboutit pas
  etat.echec = null;
  etat.messages.push(messageUtilisateur);
  etat.enCours = tache;
  rendreFil();
  majComposer();

  try {
    if (etat.mode === "user") {
      if (!etat.courante) {
        const { conversation } = await api.creerConversation();
        conversationCreee = conversation.id;
        etat.courante = conversation.id;
        majUrl();
        majResumeConversation(conversation);
      }
      const idConversation = etat.courante;
      const corps = pieceJointe
        ? { document: pieceJointe.base64, documentName: pieceJointe.nom, message: texte }
        : { message: texte };
      const res = await api.envoyerMessage(idConversation, corps, tache.controleur.signal);
      if (etat.courante !== idConversation) return;
      etat.messages.splice(etat.messages.indexOf(messageUtilisateur), 1, ...res.messages);
      etat.titre = res.conversation.title;
      majResumeConversation(res.conversation);
    } else {
      const historique = etat.messages.slice(0, -1).map(({ role, content }) => ({ role, content }));
      const data = pieceJointe
        ? await api.pptxInvite(pieceJointe.base64, texte, tache.controleur.signal)
        : await api.chatInvite(texte, historique, tache.controleur.signal);
      etat.messages.push({ id: idLocal(), role: "assistant", content: data.response, truncated: data.truncated });
      if (!etat.titre) etat.titre = pieceJointe ? `Résumé : ${pieceJointe.nom}` : titreAuto(texte);
    }
  } catch (err) {
    retirerMessage(messageUtilisateur);
    if (conversationCreee) {
      // Pas de conversation vide « Nouvelle conversation » qui traîne dans la liste.
      api.supprimerConversation(conversationCreee).catch(() => {});
      etat.conversations = etat.conversations.filter((c) => c.id !== conversationCreee);
      if (etat.courante === conversationCreee) {
        etat.courante = null;
        majUrl();
      }
      rendreListe();
    }
    if (err.name === "AbortError") {
      if (!tache.silencieux) {
        // On rend le message à l'utilisateur pour qu'il puisse le modifier et le renvoyer.
        if (!dom.composerInput.value) dom.composerInput.value = texte;
        if (pieceJointe && !etat.pieceJointe) etat.pieceJointe = pieceJointe;
        ajusterHauteur();
        toast("Génération interrompue.");
      }
    } else {
      etat.echec = {
        messageUtilisateur,
        erreur: err.message,
        relancer: () => { etat.echec = null; envoyer(texte, pieceJointe); },
      };
    }
  } finally {
    if (etat.enCours === tache) etat.enCours = null;
    majTitre();
    rendreFil();
    majComposer();
  }
}

async function regenerer() {
  if (etat.enCours || etat.messages.at(-1)?.role !== "assistant") return;

  const tache = { controleur: new AbortController(), type: "regen", pptx: false, silencieux: false };
  etat.echec = null;
  etat.enCours = tache;
  rendreFil();
  majComposer();

  try {
    if (etat.mode === "user") {
      const idConversation = etat.courante;
      const res = await api.regenerer(idConversation, tache.controleur.signal);
      if (etat.courante !== idConversation) return;
      etat.messages.splice(-1, 1, res.message);
      majResumeConversation(res.conversation);
    } else {
      const question = etat.messages.at(-2);
      const historique = etat.messages.slice(0, -2).map(({ role, content }) => ({ role, content }));
      const data = await api.chatInvite(question.content, historique, tache.controleur.signal);
      etat.messages.splice(-1, 1, { id: idLocal(), role: "assistant", content: data.response, truncated: data.truncated });
    }
  } catch (err) {
    if (err.name === "AbortError") {
      if (!tache.silencieux) toast("Génération interrompue.");
    } else {
      etat.echec = { messageUtilisateur: null, erreur: err.message, relancer: () => { etat.echec = null; regenerer(); } };
    }
  } finally {
    if (etat.enCours === tache) etat.enCours = null;
    rendreFil();
    majComposer();
  }
}

// ============================================================
// Zone de saisie
// ============================================================

function ajusterHauteur() {
  const zone = dom.composerInput;
  zone.style.height = "auto";
  zone.style.height = `${Math.min(zone.scrollHeight, 220)}px`;
}

function majComposer() {
  const occupe = !!etat.enCours;
  dom.sendBtn.replaceChildren(icone(occupe ? "stop" : "arrowUp"));
  dom.sendBtn.type = occupe ? "button" : "submit";
  dom.sendBtn.setAttribute("aria-label", occupe ? "Arrêter la génération" : "Envoyer");
  dom.sendBtn.title = occupe ? "Arrêter la génération" : "Envoyer";
  dom.sendBtn.disabled = !occupe && !dom.composerInput.value.trim() && !etat.pieceJointe;
  dom.attachBtn.disabled = occupe;

  dom.composerAttachment.hidden = !etat.pieceJointe;
  dom.composerAttachment.replaceChildren();
  if (etat.pieceJointe) {
    dom.composerAttachment.append(el("div", { class: "attachment-chip" },
      icone("file"),
      el("span", { text: etat.pieceJointe.nom }),
      el("button", {
        class: "icon-btn", type: "button", "aria-label": "Retirer la pièce jointe",
        onclick: () => { etat.pieceJointe = null; majComposer(); },
      }, icone("x")),
    ));
  }
}

dom.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (etat.enCours) return;
  const texte = dom.composerInput.value.trim();
  if (!texte && !etat.pieceJointe) return;
  const pieceJointe = etat.pieceJointe;
  dom.composerInput.value = "";
  etat.pieceJointe = null;
  ajusterHauteur();
  envoyer(texte, pieceJointe);
});

dom.sendBtn.addEventListener("click", (e) => {
  if (!etat.enCours) return;
  // L'annulation remet le bouton en mode « Envoyer » avant la fin du clic :
  // sans preventDefault, le clic sur Stop renverrait aussitôt le formulaire.
  e.preventDefault();
  arreter();
});

dom.composerInput.addEventListener("input", () => {
  ajusterHauteur();
  majComposer();
});

dom.composerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!etat.enCours) dom.composer.requestSubmit();
  }
});

// Pièce jointe PowerPoint : bouton trombone ou glisser-déposer
function lireFichier(fichier) {
  if (!fichier) return;
  if (!fichier.name.toLowerCase().endsWith(".pptx")) return toast("Seuls les fichiers PowerPoint (.pptx) sont acceptés.");
  if (fichier.size > TAILLE_MAX_PPTX) return toast("Fichier trop volumineux (10 Mo maximum).");

  const lecteur = new FileReader();
  lecteur.onload = () => {
    etat.pieceJointe = { nom: fichier.name, base64: String(lecteur.result).split(",")[1] };
    majComposer();
    dom.composerInput.focus();
  };
  lecteur.onerror = () => toast("Lecture du fichier impossible.");
  lecteur.readAsDataURL(fichier);
}

dom.attachBtn.addEventListener("click", () => dom.fileInput.click());
dom.fileInput.addEventListener("change", () => {
  lireFichier(dom.fileInput.files[0]);
  dom.fileInput.value = "";
});
dom.composer.addEventListener("dragover", (e) => {
  e.preventDefault();
  dom.composer.classList.add("dragging");
});
dom.composer.addEventListener("dragleave", () => dom.composer.classList.remove("dragging"));
dom.composer.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.composer.classList.remove("dragging");
  if (!etat.enCours) lireFichier(e.dataTransfer.files[0]);
});

// Raccourcis : Ctrl/Cmd + Maj + O = nouvelle conversation, Échap = fermer le tiroir mobile
document.addEventListener("keydown", (e) => {
  if (dom.app.hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") {
    e.preventDefault();
    nouvelleConversation();
  }
  if (e.key === "Escape") fermerSidebarMobile();
});

// ============================================================
// Démarrage
// ============================================================

async function demarrer() {
  hydraterIcones();
  if (stockage.lire(CLE_SIDEBAR) === "collapsed") dom.app.classList.add("sidebar-collapsed");
  chargerInfo();

  if (jeton.get()) {
    try {
      const { user } = await api.moi();
      return entrerUtilisateur(user);
    } catch (err) {
      if (err.status === 0) return montrerConnexion(err.message);
      jeton.set(null);
    }
  }
  if (stockage.lire(CLE_MODE) === "guest") return entrerInvite();
  montrerConnexion();
}

demarrer();
