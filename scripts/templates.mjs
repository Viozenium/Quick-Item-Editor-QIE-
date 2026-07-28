import { MODULE_PATH } from "./constants.mjs";

// FOUNDRY v13 ESPONE "loadTemplates" SOTTO "foundry.applications.handlebars".
// FOUNDRY v14 IL GLOBALE OMONIMO È DREPEACTO E RIMOSSO.

/**
 * Registra i partial Handlebars del modulo.
 * I nomi sono espliciti perché il partial delle cartelle richiama se stesso
 * per costruire l'albero a cascata.
 */
export async function registerTemplates() {
  const load =
    foundry.applications.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  return load({
    qieFolder: `${MODULE_PATH}/templates/parts/folder.hbs`,
    qieItem: `${MODULE_PATH}/templates/parts/item.hbs`,
  });
}
