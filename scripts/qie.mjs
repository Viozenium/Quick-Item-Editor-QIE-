import { MODULE_ID } from "./constants.mjs";
import { GlobalItemEditor } from "./apps/global-item-editor.mjs";

/**
 * Punto di ingresso del modulo.
 * Registra l'API pubblica e inietta il pulsante "Modifica globale"
 * nell'intestazione della barra laterale degli Item.
 */

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  if (module)
    module.api = { GlobalItemEditor, open: () => GlobalItemEditor.show() };
  console.log(`${MODULE_ID} | inizializzato`);
});

Hooks.on("renderItemDirectory", (app, element) => {
  // Foundry v13+ passa un HTMLElement; manteniamo il fallback per sicurezza.
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;
  if (!game.user.isGM) return;
  if (root.querySelector(".qie-global-edit")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("qie-global-edit");
  button.dataset.tooltip = game.i18n.localize("QIE.GlobalEditHint");
  button.innerHTML = `<i class="fas fa-table-list"></i> <span>${game.i18n.localize("QIE.GlobalEdit")}</span>`;
  button.addEventListener("click", () => GlobalItemEditor.show());

  const header =
    root.querySelector(".header-actions") ??
    root.querySelector(".directory-header");
  if (header) header.append(button);
  else root.prepend(button);
});
