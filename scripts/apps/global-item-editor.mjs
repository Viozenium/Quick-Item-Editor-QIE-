import { FIELDS, MODULE_ID, MODULE_PATH } from "../constants.mjs";
import {
  currencyChoices,
  normalize,
  rarityChoices,
  readItem,
} from "../item-data.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Ritardo prima di salvare mentre si digita, in millisecondi. */

const SAVE_DELAY = 500;

/**
 * Finestra di modifica globale degli oggetti del mondo.
 * I valori sono modificabili direttamente nelle righe e vengono salvati sul documento senza conferma esplicita.
 */
export class GlobalItemEditor extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /** Istanza singleton, così il pulsante non apre finestre duplicate. */
  static #instance = null;

  /** ID delle cartelle espanse dall'utente, conservati tra un render e l'altro. */
  #expanded = new Set();

  /**
   * Indice dei valori normalizzati, per ID oggetto.
   * Viene ricostruito a ogni render. */
  #index = new Map();

  /** Timer di salvataggio in sospeso, uno per campo in modifica. */
  #saveTimers = new Map();

  /** Hook registrati mentre la finestra è aperta. */
  #hooks = [];

  /** Stato corrente dei filtri, conservato tra un render e l'altro. */
  #filters = {
    name: "",
    description: "",
    rarity: "",
    weightMin: null,
    weightMax: null,
    priceMin: null,
    priceMax: null,
  };

  /** Il pannello dei filtri è aperto? */
  #filtersOpen = false;

  /** Ridisegno differito, per non ricostruire l'albero a ogni singolo evento. */
  #rerender = foundry.utils.debounce(() => {
    if (this.rendered) this.render();
  }, 250);

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
      width: 1040,
      height: 720,
    },
    actions: {
      expandAll: GlobalItemEditor.#onExpandAll,
      collapseAll: GlobalItemEditor.#onCollapseAll,
      toggleFilters: GlobalItemEditor.#onToggleFilters,
      clearFilters: GlobalItemEditor.#onClearFilters,
      refresh: GlobalItemEditor.#onRefresh,
      openSheet: GlobalItemEditor.#onOpenSheet,
      toggleDescription: GlobalItemEditor.#onToggleDescription,
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

  // L'albero è quello della collection, stesso ordine e stessa gerarchia della barra laterale, modalità di ordinamento dell'utente compresa.

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!game.items.tree) game.items.initializeTree?.();

    this.#index.clear();
    const root = this.#buildNode(game.items.tree, 0, true);

    return Object.assign(context, {
      moduleId: MODULE_ID,
      tree: root,
      hasItems: game.items.size > 0,
      itemCount: game.items.size,
      countLabel: game.i18n.format("QIE.ItemCount", { count: game.items.size }),
      folderLabel: game.i18n.format("QIE.FolderCount", {
        count: root.folderCount,
      }),
      filters: this.#filters,
      filtersOpen: this.#filtersOpen,
      rarities: rarityChoices(),
      currencies: currencyChoices(),
    });
  }

  /**
   * Converte un nodo dell'albero della collection in un nodo di rendering.
   * @param {object} node   Nodo di `game.items.tree`.
   * @param {number} depth  Profondità di annidamento, usata per il rientro.
   * @param {boolean} isRoot
   * @returns {object}
   */
  #buildNode(node, depth = 0, isRoot = false) {
    const childDepth = isRoot ? 0 : depth + 1;
    const children = (node?.children ?? [])
      .filter((child) => child.visible !== false)
      .map((child) => this.#buildNode(child, childDepth));
    const entries = (node?.entries ?? []).map((item) =>
      this.#prepareItem(item, childDepth),
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
      depth,
      children,
      entries,
      total,
      folderCount,
    };
  }

  /**
   * Dati di rendering di un singolo oggetto, popola anche l'indice di ricerca.
   * @param {Item} item
   * @param {number} depth
   */
  #prepareItem(item, depth = 0) {
    const data = readItem(item);
    this.#indexItem(data);

    const typeLabel = CONFIG.Item?.typeLabels?.[item.type];
    return {
      id: data.id,
      uuid: data.uuid,
      depth,
      name: data.name,
      img: data.img,
      typeLabel: typeLabel ? game.i18n.localize(typeLabel) : item.type,
      rarity: data.rarity,
      denomination: data.denomination,
      weightValue: data.weight === null ? "" : data.weight,
      priceValue: data.priceValue === null ? "" : data.priceValue,

      // Un oggetto senza il campo nel proprio schema (una magia, un privilegio) non deve esporre un controllo che genererebbe un update non valido.

      canWeight: item.system?.weight !== undefined,
      canPrice: item.system?.price !== undefined,
      canRarity: item.system?.rarity !== undefined,
      canDescription: item.system?.description?.value !== undefined,
    };
  }

  /**
   * Aggiorna la voce dell'indice di ricerca di un oggetto.
   * @param {object} data  Risultato di `readItem`.
   */
  #indexItem(data) {
    this.#index.set(data.id, {
      name: normalize(data.name),
      description: normalize(data.descriptionText),
      rarity: data.rarity,
      weight: data.weight,
      price: data.priceGold,
    });
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

  /*  Ciclo di vita */

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);

    // Le modifiche fatte altrove (scheda oggetto) devono riflettersi qui.

    this.#registerHook("updateItem", (item) => this.#onItemUpdated(item));
    this.#registerHook("createItem", () => this.#rerender());
    this.#registerHook("deleteItem", () => this.#rerender());
    for (const hook of ["createFolder", "updateFolder", "deleteFolder"]) {
      this.#registerHook(hook, (folder) => {
        if (folder?.type === "Item") this.#rerender();
      });
    }
  }

  /**
   * @param {string} hook
   * @param {Function} handler
   */
  #registerHook(hook, handler) {
    this.#hooks.push([hook, Hooks.on(hook, handler)]);
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    for (const [hook, id] of this.#hooks) Hooks.off(hook, id);
    this.#hooks = [];
    for (const timer of this.#saveTimers.values()) clearTimeout(timer);
    this.#saveTimers.clear();
    GlobalItemEditor.#instance = null;
  }

  /*  Interazione */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Lo stato aperto/chiuso viene registrato dal click sul summary e non dall'evento "toggle": quest'ultimo scatta anche per le aperture automatiche del filtraggio.

    for (const summary of this.element.querySelectorAll(
      ".qie-folder > .qie-details > summary",
    )) {
      summary.addEventListener("click", () => {
        const details = summary.closest(".qie-details");
        const id = summary.closest(".qie-folder")?.dataset.folderId;
        if (!id) return;
        if (details.open) this.#expanded.delete(id);
        else this.#expanded.add(id);
      });
    }

    // Lo stato del filtro si aggiorna subito, il ridisegno è ritardato, l'evento non sopravvivrebbe al debounce, il valore del campo sì.

    const applyDebounced = foundry.utils.debounce(
      () => this.#applyFilters(),
      150,
    );
    for (const input of this.element.querySelectorAll("[data-filter]")) {
      const value = this.#filters[input.dataset.filter];
      input.value = value === null || value === undefined ? "" : value;

      const handler = () => {
        this.#readFilter(input);
        applyDebounced();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    }

    // Delega sul contenitore: un ascoltatore per campo sarebbe insostenibile con centinaia di oggetti, e non coprirebbe le righe descrizione aggiunte dopo.

    const body = this.element.querySelector(".qie-body");
    body?.addEventListener("input", (event) => {
      const field = event.target.closest?.("[data-field]");
      if (field) this.#scheduleSave(field);
    });
    body?.addEventListener("change", (event) => {
      const field = event.target.closest?.("[data-field]");
      if (field) this.#saveField(field);
    });

    this.#applyFilters();
  }

  /*  Salvataggio */

  /**
   * Salva il campo dopo una breve pausa nella digitazione.
   * @param {HTMLElement} input
   */
  #scheduleSave(input) {
    clearTimeout(this.#saveTimers.get(input));
    this.#saveTimers.set(
      input,
      setTimeout(() => {
        this.#saveTimers.delete(input);
        this.#saveField(input);
      }, SAVE_DELAY),
    );
  }

  /**
   * Scrive il valore del campo sul documento.
   * @param {HTMLElement} input
   */
  async #saveField(input) {
    clearTimeout(this.#saveTimers.get(input));
    this.#saveTimers.delete(input);

    const row = input.closest("[data-item-id]");
    const item = game.items.get(row?.dataset.itemId);
    if (!item) return;

    const update = GlobalItemEditor.#buildUpdate(item, input);
    if (!update) {
      // Nome vuoto, si ripristina il valore corrente invece di rifiutare l'update.

      if (input.dataset.field === "name") input.value = item.name;
      return;
    }

    const [path, value] = Object.entries(update)[0];
    if (foundry.utils.getProperty(item, path) === value) return;

    try {
      await item.update(update);
      GlobalItemEditor.#flash(input, "qie-saved");
    } catch (error) {
      console.error(`${MODULE_ID} | salvataggio non riuscito`, error);
      ui.notifications.error(
        game.i18n.format("QIE.Notify.SaveFailed", { name: item.name }),
      );
      GlobalItemEditor.#flash(input, "qie-save-error");
      this.#syncRow(item);
    }
  }

  /**
   * Traduce un campo dell'interfaccia in un update per il documento.
   * @param {Item} item
   * @param {HTMLElement} input
   * @returns {object|null} `null` se il valore non è utilizzabile.
   */
  static #buildUpdate(item, input) {
    const value = input.value;

    switch (input.dataset.field) {
      case "name": {
        const name = String(value).trim();
        return name ? { name } : null;
      }
      case "weight": {
        // dnd5e >= 3.x usa {value, units}, prima era un numero semplice.

        const legacy =
          item.system?.weight === null ||
          typeof item.system?.weight !== "object";
        return {
          [legacy ? "system.weight" : FIELDS.weight]:
            GlobalItemEditor.#toNumber(value),
        };
      }
      case "price":
        return { [FIELDS.price]: GlobalItemEditor.#toNumber(value) };
      case "denomination":
        return { [FIELDS.priceDenomination]: value };
      case "rarity":
        return { [FIELDS.rarity]: value };
      case "description":
        return { [FIELDS.description]: value };
      default:
        return null;
    }
  }

  /**
   * @param {string} value
   * @returns {number}
   */
  static #toNumber(value) {
    const number = Number(value);
    return value === "" || !Number.isFinite(number) ? 0 : Math.max(0, number);
  }

  /**
   * Segnale visivo temporaneo sull'esito del salvataggio.
   * @param {HTMLElement} element
   * @param {string} cssClass
   */
  static #flash(element, cssClass) {
    element.classList.add(cssClass);
    setTimeout(() => element.classList.remove(cssClass), 900);
  }

  /*  Sincronizzazione */

  /**
   * Riallinea la riga di un oggetto modificato altrove.
   * Il nome non provoca un ridisegno, con l'ordinamento alfabetico la riga cambierebbe posizione a metà digitazione.
   * L'ordine si aggiorna con il pulsante Ricarica o alla riapertura della finestra.
   * @param {Item} item
   */
  #onItemUpdated(item) {
    if (!this.rendered) return;
    this.#syncRow(item);
  }

  /**
   * @param {Item} item
   */
  #syncRow(item) {
    const row = this.element?.querySelector(
      `.qie-item[data-item-id="${item.id}"]`,
    );
    if (!row) return;

    const data = readItem(item);
    this.#indexItem(data);

    // Il campo su cui l'utente sta scrivendo non va sovrascritto sotto le dita.

    const assign = (field, value) => {
      const element = row.querySelector(`[data-field="${field}"]`);
      if (element && element !== document.activeElement) element.value = value;
    };
    assign("name", data.name);
    assign("rarity", data.rarity);
    assign("weight", data.weight === null ? "" : data.weight);
    assign("price", data.priceValue === null ? "" : data.priceValue);
    assign("denomination", data.denomination);

    const img = row.querySelector(".qie-item-img");
    if (img && img.getAttribute("src") !== data.img) img.src = data.img;

    this.#applyFilters();
  }

  /*  Filtri */

  /**
   * Aggiorna lo stato dei filtri leggendo il campo indicato.
   * @param {HTMLInputElement|HTMLSelectElement} input
   */
  #readFilter(input) {
    const key = input.dataset.filter;
    if (!(key in this.#filters)) return;

    if (input.type === "number") {
      const number = Number(input.value);
      this.#filters[key] =
        input.value === "" || !Number.isFinite(number) ? null : number;
    } else {
      this.#filters[key] = input.value;
    }
  }

  /** Qualche filtro è impostato? */
  get #isFiltering() {
    return Object.values(this.#filters).some(
      (value) => value !== "" && value !== null,
    );
  }

  /**
   * Un oggetto supera i filtri correnti?
   * @param {object} data  Voce dell'indice.
   * @returns {boolean}
   */
  #matches(data) {
    const filters = this.#filters;
    if (!data) return false;

    if (filters.name && !data.name.includes(normalize(filters.name)))
      return false;
    if (
      filters.description &&
      !data.description.includes(normalize(filters.description))
    )
      return false;

    if (filters.rarity) {
      if (filters.rarity === "__none__") {
        if (data.rarity) return false;
      } else if (data.rarity !== filters.rarity) return false;
    }

    // Il valore mancante va escluso a monte, un confronto diretto lo tratterebbe come zero (null >= 0 è true) facendo passare oggetti senza peso o prezzo.

    if (
      !GlobalItemEditor.#inRange(
        data.weight,
        filters.weightMin,
        filters.weightMax,
      )
    )
      return false;
    if (
      !GlobalItemEditor.#inRange(data.price, filters.priceMin, filters.priceMax)
    )
      return false;

    return true;
  }

  /**
   * Verifica un intervallo numerico opzionale.
   * @param {number|null} value  Valore dell'oggetto, `null` se assente.
   * @param {number|null} min
   * @param {number|null} max
   * @returns {boolean}
   */
  static #inRange(value, min, max) {
    if (min === null && max === null) return true;
    if (value === null || value === undefined) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  /**
   * Nasconde le righe che non superano i filtri e le cartelle rimaste vuote.
   * Durante il filtraggio le cartelle con risultati vengono aperte in automatico, azzerando i filtri si torna allo stato scelto dall'utente.
   */
  #applyFilters() {
    if (!this.element) return;
    const filtering = this.#isFiltering;
    let visible = 0;

    for (const row of this.element.querySelectorAll(".qie-item")) {
      const matched =
        !filtering || this.#matches(this.#index.get(row.dataset.itemId));
      row.classList.toggle("qie-hidden", !matched);

      // La riga della descrizione è una sorella della riga oggetto, va nascosta con lei.

      const description = row.nextElementSibling;
      if (description?.classList.contains("qie-description-row")) {
        description.classList.toggle("qie-hidden", !matched);
      }
      if (matched) visible++;
    }

    // Ordine inverso del documento: le sottocartelle sono valutate prima dei genitori.

    const folders = [...this.element.querySelectorAll(".qie-folder")].reverse();
    for (const folder of folders) {
      const details = folder.querySelector(":scope > .qie-details");
      if (!filtering) {
        folder.classList.remove("qie-hidden");
        if (details) details.open = this.#expanded.has(folder.dataset.folderId);
        continue;
      }
      const hasMatch = !!folder.querySelector(".qie-item:not(.qie-hidden)");
      folder.classList.toggle("qie-hidden", !hasMatch);
      if (details && hasMatch) details.open = true;
    }

    const empty = this.element.querySelector(".qie-no-results");
    if (empty) empty.classList.toggle("qie-hidden", visible > 0 || !filtering);

    const counter = this.element.querySelector(".qie-result-count");
    if (counter) {
      counter.textContent = filtering
        ? game.i18n.format("QIE.Results", { visible, total: this.#index.size })
        : "";
    }
  }

  /*  Azioni */

  /** Apre tutte le cartelle. */
  static #onExpandAll() {
    this.#setAllOpen(true);
  }

  /** Chiude tutte le cartelle. */
  static #onCollapseAll() {
    this.#setAllOpen(false);
  }

  /** Ricostruisce l'albero, riallineando ordine e contenuti. */
  static #onRefresh() {
    this.render();
  }

  /** Mostra o nasconde il pannello dei filtri. */
  static #onToggleFilters(event, target) {
    this.#filtersOpen = !this.#filtersOpen;
    this.element
      .querySelector(".qie-filters")
      ?.toggleAttribute("hidden", !this.#filtersOpen);
    target.classList.toggle("active", this.#filtersOpen);
  }

  /** Azzera tutti i filtri e la ricerca. */
  static #onClearFilters() {
    for (const key of Object.keys(this.#filters)) {
      this.#filters[key] =
        key.endsWith("Min") || key.endsWith("Max") ? null : "";
    }
    for (const input of this.element.querySelectorAll("[data-filter]"))
      input.value = "";
    this.#applyFilters();
  }

  /** Apre la scheda completa dell'oggetto. */
  static #onOpenSheet(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    game.items.get(id)?.sheet?.render(true);
  }

  /** Mostra o nasconde l'editor di descrizione sotto la riga. */
  static async #onToggleDescription(event, target) {
    const row = target.closest(".qie-item");
    const item = game.items.get(row?.dataset.itemId);
    if (!item) return;

    const existing = row.nextElementSibling;
    if (existing?.classList.contains("qie-description-row")) {
      existing.remove();
      target.classList.remove("active");
      return;
    }

    target.classList.add("active");
    row.after(await GlobalItemEditor.#buildDescriptionRow(item));
  }

  /**
   * Riga espansa con l'editor di testo ricco della descrizione.
   * @param {Item} item
   * @returns {Promise<HTMLLIElement>}
   */
  static async #buildDescriptionRow(item) {
    const value = item.system?.description?.value ?? "";
    const TextEditorImpl =
      foundry.applications.ux?.TextEditor?.implementation ??
      globalThis.TextEditor;

    let enriched = value;
    try {
      enriched = await TextEditorImpl.enrichHTML(value, {
        secrets: true,
        relativeTo: item,
      });
    } catch (error) {
      console.warn(
        `${MODULE_ID} | arricchimento della descrizione non riuscito`,
        error,
      );
    }

    const editor = foundry.applications.elements.HTMLProseMirrorElement.create({
      name: FIELDS.description,
      value,
      enriched,
      toggled: true,
      collaborate: false,
      documentUUID: item.uuid,
    });
    editor.dataset.field = "description";

    const row = document.createElement("li");
    row.classList.add("qie-node", "qie-description-row");
    row.dataset.itemId = item.id;
    row.append(editor);
    return row;
  }

  /**
   * @param {boolean} open
   */
  #setAllOpen(open) {
    this.#expanded.clear();
    for (const folder of this.element.querySelectorAll(".qie-folder")) {
      const details = folder.querySelector(":scope > .qie-details");
      if (details) details.open = open;
      if (open && folder.dataset.folderId)
        this.#expanded.add(folder.dataset.folderId);
    }
  }
}
