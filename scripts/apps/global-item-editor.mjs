import { MODULE_ID, MODULE_PATH } from "../constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Finestra di modifica globale degli oggetti del mondo. */
export class GlobalItemEditor extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** Istanza singleton, così il pulsante non apre finestre duplicate. */
  static #instance = null;

  /** ID delle cartelle attualmente espanse, conservati tra un render e l'altro. */
  #expanded = new Set();

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
    actions: {
      expandAll: GlobalItemEditor.#onExpandAll,
      collapseAll: GlobalItemEditor.#onCollapseAll,
    },
  };

  static PARTS = {
    main: {
      template: `${MODULE_PATH}/templates/global-item-editor.hbs`,
      scrollable: [".qie-body"],
    },
  };

  /** Apre (o porta in primo piano) l'editor globale. */
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

  /*  Contesto */

  // L'albero è quello della "collection:"
  // stesso ordine e stessa gerarchia della barra laterale, modalità di ordinamento dell'utente compresa.

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!game.items.tree) game.items.initializeTree?.();
    const root = this.#buildNode(game.items.tree, true);

    return Object.assign(context, {
      moduleId: MODULE_ID,
      tree: root,
      hasItems: game.items.size > 0,
      countLabel: game.i18n.format("QIE.ItemCount", { count: game.items.size }),
      folderLabel: game.i18n.format("QIE.FolderCount", {
        count: root.folderCount,
      }),
    });
  }

  /**
   * Converte un nodo dell'albero della collection in un nodo di rendering.
   * Usare `game.items.tree` garantisce lo stesso ordine della barra laterale.
   *
   * @param {object} node   Nodo di `game.items.tree`.
   * @param {boolean} isRoot
   * @returns {object}
   */
  #buildNode(node, isRoot = false) {
    const children = (node?.children ?? [])
      .filter((child) => child.visible !== false)
      .map((child) => this.#buildNode(child));
    const entries = (node?.entries ?? []).map((item) =>
      this.#prepareItem(item),
    );

    const total =
      entries.length + children.reduce((sum, child) => sum + child.total, 0);
    const folderCount =
      children.length +
      children.reduce((sum, child) => sum + child.folderCount, 0);

    if (isRoot) return { children, entries, total, folderCount };

    const folder = node.folder;
    return {
      id: folder?.id ?? null,
      name: folder?.name ?? game.i18n.localize("QIE.Uncategorized"),
      colorStyle: GlobalItemEditor.#folderColorStyle(folder),
      expanded: this.#expanded.has(folder?.id),
      children,
      entries,
      total,
      folderCount,
    };
  }

  /**
   * Dati di rendering di un singolo oggetto.
   * @param {Item} item
   */
  #prepareItem(item) {
    const typeLabel = CONFIG.Item?.typeLabels?.[item.type];
    return {
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      typeLabel: typeLabel ? game.i18n.localize(typeLabel) : item.type,
    };
  }

  /**
   * Riproduce la colorazione delle cartelle della barra laterale.
   * @param {Folder|null} folder
   * @returns {string} Dichiarazioni CSS inline (eventualmente vuote).
   */
  static #folderColorStyle(folder) {
    const color = folder?.color;
    if (!color) return "";
    const css = color.css ?? String(color);
    return `--qie-folder-color: ${css};`;
  }

  /*  Interazione */

  // Memorizza lo stato aperto/chiuso così un re-render non richiude tutto.

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const details of this.element.querySelectorAll(
      ".qie-folder > .qie-details",
    )) {
      details.addEventListener("toggle", () => {
        const id = details.closest(".qie-folder")?.dataset.folderId;
        if (!id) return;
        if (details.open) this.#expanded.add(id);
        else this.#expanded.delete(id);
      });
    }
  }

  /** Apre tutte le cartelle. */
  static #onExpandAll() {
    this.#setAllOpen(true);
  }

  /** Chiude tutte le cartelle. */
  static #onCollapseAll() {
    this.#setAllOpen(false);
  }

  /**
   * @param {boolean} open
   */
  #setAllOpen(open) {
    for (const details of this.element.querySelectorAll(
      ".qie-folder > .qie-details",
    )) {
      details.open = open;
    }
  }

  /** @override */
  async close(options) {
    GlobalItemEditor.#instance = null;
    return super.close(options);
  }
}
