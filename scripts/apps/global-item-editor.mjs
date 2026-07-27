import { MODULE_ID, MODULE_PATH } from "../constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Finestra di modifica globale degli oggetti del mondo.
 */
export class GlobalItemEditor extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: "qie-global-item-editor",
    tag: "div",
    classes: ["qie", "qie-global-item-editor"],
    window: {
      title: "QIE.WindowTitle",
      icon: "fas fa-table-list",
      resizable: true,
    },
    position: {
      width: 960,
      height: 720,
    },
  };

  static PARTS = {
    main: {
      template: `${MODULE_PATH}/templates/global-item-editor.hbs`,
      scrollable: [".qie-body"],
    },
  };

  static show() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("QIE.Notify.GMOnly"));
      return null;
    }
    GlobalItemEditor.#instance ??= new GlobalItemEditor();
    const app = GlobalItemEditor.#instance;
    if (app.rendered) app.bringToFront();
    else app.render({ force: true });
    return app;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const items = game.items.contents;
    const folders = this.#buildFolderSummary(items);

    return Object.assign(context, {
      moduleId: MODULE_ID,
      folders,
      itemCount: items.length,
      hasItems: items.length > 0,
      countLabel: game.i18n.format("QIE.ItemCount", { count: items.length }),
      folderLabel: game.i18n.format("QIE.FolderCount", {
        count: folders.length,
      }),
    });
  }

  /**
   * Riepilogo piatto delle cartelle di Item con il numero di oggetti diretti.
   * @param {Item[]} items
   * @returns {{id: string, name: string, depth: number, count: number}[]}
   */
  #buildFolderSummary(items) {
    const counts = new Map();
    for (const item of items) {
      const key = item.folder?.id ?? null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const folders = game.folders
      .filter((f) => f.type === "Item")
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((f) => ({
        id: f.id,
        name: f.name,
        depth: f.depth ?? 0,
        count: counts.get(f.id) ?? 0,
      }));

    const orphans = counts.get(null) ?? 0;
    if (orphans > 0) {
      folders.push({
        id: null,
        name: game.i18n.localize("QIE.Uncategorized"),
        depth: 0,
        count: orphans,
      });
    }

    return folders;
  }

  /** @override */
  async close(options) {
    GlobalItemEditor.#instance = null;
    return super.close(options);
  }
}
