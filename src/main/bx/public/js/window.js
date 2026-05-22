/**
 * BoxLang ColdFusion Window Compatibility Module
 *
 * Provides the same API surface as the ACF cfwindow.js (originally shipped with
 * <cfajaximport tags="cfwindow">) without any dependency on the ColdFusion.Util
 * helper object, the Ext JS library, or Adobe-proprietary infrastructure.
 *
 * All window instances are rendered as native <dialog> elements styled to match
 * the original cfwindow behaviour. The public API is re-exported onto
 * `window.ColdFusion.Window` for drop-in compatibility.
 */

// ---------------------------------------------------------------------------
// Internal utilities (replacing ColdFusion.Util.*)
// ---------------------------------------------------------------------------

/**
 * Returns true when `value` is, or can unambiguously be coerced to, a boolean.
 * Accepts actual booleans and the strings "true" / "false" (case-insensitive).
 *
 * @param {*} value
 * @returns {boolean}
 */
function isBoolean(value) {
	if (typeof value === "boolean") return true;
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		return lower === "true" || lower === "false";
	}
	return false;
}

/**
 * Casts `value` to a native boolean.
 * Truthy strings ("true", "yes", "1") → true; everything else → false.
 *
 * @param {*} value
 * @returns {boolean}
 */
function castBoolean(value) {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		return ["true", "yes", "1"].includes(value.toLowerCase());
	}
	return Boolean(value);
}

/**
 * Returns true when `value` is an integer or a string that parses to one.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isInteger(value) {
	if (typeof value === "number") return Number.isInteger(value);
	if (typeof value === "string" && value.trim() !== "") {
		return Number.isInteger(Number(value));
	}
	return false;
}

/**
 * Replaces all occurrences of `search` in `str` with `replacement`.
 *
 * @param {string} str
 * @param {string} search
 * @param {string} replacement
 * @returns {string}
 */
function replaceAll(str, search, replacement) {
	return str.split(search).join(replacement);
}

/**
 * Emits a console warning and optionally throws when `throwError` is true.
 * Replaces ColdFusion.handleError().
 *
 * @param {string} messageKey  - dot-separated message identifier (logged as-is)
 * @param {Array}  [args]      - substitution tokens for the message
 * @param {boolean} [throwError=false]
 */
function handleError(messageKey, args = [], throwError = false) {
	const detail = args.length
		? `${messageKey}: ${args.join(", ")}`
		: messageKey;
	console.warn(`[ColdFusion.Window] ${detail}`);
	if (throwError) {
		throw new Error(`[ColdFusion.Window] ${detail}`);
	}
}

// ---------------------------------------------------------------------------
// Internal state (replacing ColdFusion.objectCache / bindHandlerCache)
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} Registry of all window instances and config objects. */
const objectCache = new Map();

/** @type {Map<string, Function>} Registry of bind handlers keyed by element id. */
const bindHandlerCache = new Map();

// ---------------------------------------------------------------------------
// Window counter (equivalent to ColdFusion.Window.windowIdCounter)
// ---------------------------------------------------------------------------

let windowIdCounter = 1;

// ---------------------------------------------------------------------------
// Default cascade offsets
// ---------------------------------------------------------------------------

let nextX = 50;
let nextY = 50;

// ---------------------------------------------------------------------------
// Config normalisation  (replacing ColdFusion.Window.getUpdatedConfigObj)
// ---------------------------------------------------------------------------

const TITLE_BGCOLOR_TEMPLATE =
	"WINDOW_DIV_ID .bx-window-header { background-color: COLOR_ID; }";

/**
 * Validates and normalises a raw config object supplied by the caller.
 * Returns a fully-populated config ready for use, or throws on validation failure.
 *
 * @param {object|null} rawConfig
 * @param {string}      windowName
 * @returns {object}
 */
function buildConfig(rawConfig, windowName) {
	const cfg = {};

	if (rawConfig != null) {
		if (typeof rawConfig !== "object") {
			resetHTML(windowName);
			handleError("window.buildConfig.invalidconfig", [windowName], true);
		}

		for (const key in rawConfig) {
			// "center" is an alias for fixedcenter
			if (key === "center" && isBoolean(rawConfig[key])) {
				cfg.fixedcenter = castBoolean(rawConfig[key]);
			} else {
				cfg[key] = rawConfig[key];
			}
		}
	}

	// --- initshow ---
	if (cfg.initshow !== undefined) {
		if (!isBoolean(cfg.initshow)) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidinitshow",
				[windowName],
				true,
			);
		}
		cfg.initshow = castBoolean(cfg.initshow);
		cfg._cf_visible = cfg.initshow;
	}

	// --- fixedcenter ---
	if (cfg.fixedcenter !== undefined) {
		if (!isBoolean(cfg.fixedcenter)) {
			resetHTML(windowName);
			handleError("window.buildConfig.invalidcenter", [windowName], true);
		}
		cfg.fixedcenter = castBoolean(cfg.fixedcenter);
	}

	// --- boolean flags ---
	for (const flag of ["resizable", "draggable", "closable", "modal"]) {
		if (cfg[flag] !== undefined) {
			if (!isBoolean(cfg[flag])) {
				resetHTML(windowName);
				handleError(
					`window.buildConfig.invalid${flag}`,
					[windowName],
					true,
				);
			}
			cfg[flag] = castBoolean(cfg[flag]);
		}
	}

	// --- refreshonshow ---
	if (cfg.refreshonshow !== undefined) {
		if (!isBoolean(cfg.refreshonshow)) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidrefreshonshow",
				[windowName],
				true,
			);
		}
		cfg._cf_refreshOnShow = castBoolean(cfg.refreshonshow);
	}

	// --- height (default 300) ---
	if (!cfg.height) {
		cfg.height = 300;
	} else if (!isInteger(cfg.height)) {
		resetHTML(windowName);
		handleError("window.buildConfig.invalidheight", [windowName], true);
	} else {
		cfg.height = parseInt(cfg.height, 10);
	}

	// --- width (default 500) ---
	if (!cfg.width) {
		cfg.width = 500;
	} else if (!isInteger(cfg.width)) {
		resetHTML(windowName);
		handleError("window.buildConfig.invalidwidth", [windowName], true);
	} else {
		cfg.width = parseInt(cfg.width, 10);
	}

	let hasMinConstraint = false;

	// --- minwidth ---
	if (cfg.minwidth) {
		if (!isInteger(cfg.minwidth)) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidminwidth",
				[windowName],
				true,
			);
		}
		const minW = parseInt(cfg.minwidth, 10);
		if (minW > cfg.width) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidminwidth",
				[windowName],
				true,
			);
		}
		cfg.minWidth = minW;
		hasMinConstraint = true;
	}

	// --- minheight ---
	if (cfg.minheight) {
		if (!isInteger(cfg.minheight)) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidminheight",
				[windowName],
				true,
			);
		}
		const minH = parseInt(cfg.minheight, 10);
		if (minH > cfg.height) {
			resetHTML(windowName);
			handleError(
				"window.buildConfig.invalidminheightvalue",
				[windowName],
				true,
			);
		}
		cfg.minHeight = minH;
		hasMinConstraint = true;
	}

	// min constraints are incompatible with resizable=false
	if (cfg.resizable === false && hasMinConstraint) {
		resetHTML(windowName);
		handleError("window.buildConfig.minhwnotallowed", [windowName], true);
	}

	// --- x / y validation ---
	for (const axis of ["x", "y"]) {
		if (cfg[axis] !== undefined && !isInteger(cfg[axis])) {
			resetHTML(windowName);
			handleError(
				`window.buildConfig.invalid${axis}`,
				[windowName],
				true,
			);
		}
	}

	// Leave cfg.x / cfg.y undefined when not explicitly supplied.
	// The dialog is centered via CSS (inset:0; margin:auto) by default;
	// JS positioning is only applied when the caller passes explicit coordinates.

	// When initshow=false defer the position until show() is called
	if (cfg.initshow === false) {
		cfg.tempinitshow = false;
		if (isFixedCenter) {
			cfg.tempcenter = cfg.fixedcenter;
			cfg.fixedcenter = null;
		} else {
			cfg.tempx = cfg.x;
			cfg.tempy = cfg.y;
		}
		cfg.x = -10000;
		cfg.y = -10000;
	}

	cfg.initshow = true; // from this point the object is "live"
	cfg.isConfObj = true;

	return cfg;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Clears the innerHTML of the element whose id matches `windowName`.
 *
 * @param {string} windowName
 */
function resetHTML(windowName) {
	const el = document.getElementById(windowName);
	if (el) el.innerHTML = "";
}

/**
 * Applies custom header background colour from a headerstyle string and
 * injects the result as a `<style>` block, scoped to `divId`.
 *
 * @param {string} headerstyle
 * @param {string} divId
 */
function applyHeaderStyle(headerstyle, divId) {
	const lower = String(headerstyle).toLowerCase();
	const bgIndex = lower.indexOf("background-color");
	if (bgIndex < 0) return;

	let endIndex = lower.indexOf(";", bgIndex + 17);
	if (endIndex < 0) endIndex = lower.length;
	const color = lower
		.substring(bgIndex + 17, endIndex)
		.replace(":", "")
		.trim();

	let css = replaceAll(TITLE_BGCOLOR_TEMPLATE, "WINDOW_DIV_ID", `#${divId}`);
	css = replaceAll(css, "COLOR_ID", color);

	const tag = document.createElement("style");
	tag.textContent = css;
	document.head.appendChild(tag);
}

// ---------------------------------------------------------------------------
// Native-dialog window object
// ---------------------------------------------------------------------------

/**
 * Creates and returns a native window descriptor object backed by a <dialog>.
 *
 * @param {string}      name    - logical window name
 * @param {string|null} title
 * @param {string|null} url     - optional URL to load into an <iframe>
 * @param {object}      cfg     - normalised config from buildConfig()
 * @returns {object}  windowObj
 */
function createDialogWindow(name, title, url, cfg) {
	// ---- <dialog> -------------------------------------------------------
	const dialog = document.createElement("dialog");
	const autoId = `cf_window${windowIdCounter++}`;
	dialog.id = cfg.divid || autoId;
	dialog.className = "bx-window";
	dialog.style.width = `${cfg.width}px`;
	dialog.style.height = `${cfg.height}px`;
	if (cfg.minWidth) dialog.style.minWidth = `${cfg.minWidth}px`;
	if (cfg.minHeight) dialog.style.minHeight = `${cfg.minHeight}px`;

	// ---- header ---------------------------------------------------------
	const header = document.createElement("div");
	header.className = "bx-window-header";
	if (cfg.headerstyle) header.style.cssText = cfg.headerstyle;

	const titleEl = document.createElement("span");
	titleEl.className = "bx-window-title";
	titleEl.textContent = title || "";
	header.appendChild(titleEl);

	if (cfg.closable !== false) {
		const closeBtn = document.createElement("button");
		closeBtn.className = "bx-window-close";
		closeBtn.textContent = "×";
		closeBtn.setAttribute("aria-label", "Close");
		closeBtn.addEventListener("click", () => WindowAPI.hide(name));
		header.appendChild(closeBtn);
	}

	// ---- body -----------------------------------------------------------
	const body = document.createElement("div");
	body.id = `${name}-body`;
	body.className = "bx-window-body";
	if (cfg.bodystyle) body.style.cssText = cfg.bodystyle;

	// Transplant any content from the server-rendered seed element
	const seed = document.getElementById(`${name}-body`);
	if (seed && !url) {
		body.innerHTML = seed.innerHTML;
	}

	// ---- resizer --------------------------------------------------------
	const resizer = document.createElement("div");
	resizer.className = "bx-window-resizer";

	dialog.appendChild(header);
	dialog.appendChild(body);
	if (cfg.resizable !== false) dialog.appendChild(resizer);

	// Apply custom header bg colour
	if (cfg.headerstyle) applyHeaderStyle(cfg.headerstyle, dialog.id);

	document.body.appendChild(dialog);

	// The native 'close' event fires whenever the dialog is dismissed – whether
	// via dialog.close(), the Escape key, or any other mechanism.  We use it as
	// the single source of truth for visibility state so that the X button,
	// Escape, and programmatic WindowAPI.hide() all stay in sync.
	dialog.addEventListener("close", () => {
		if (windowObj) {
			windowObj._cf_visible = false;
			if (windowObj._cf_refreshOnShow) windowObj._cf_dirtyview = true;
			if (windowObj._cf_onHide) windowObj._cf_onHide(name);
			if (windowObj.destroyonclose) windowObj.destroy();
		}
	});

	// ---- positioning (non-modal / pre-modal) ----------------------------

	// Apply an explicit pixel position, overriding the CSS centering.
	function applyPosition(x, y) {
		dialog.style.inset = "auto";
		dialog.style.margin = "0";
		dialog.style.left = `${x}px`;
		dialog.style.top = `${y}px`;
	}

	// Restore CSS-based centering (inset:0; margin:auto) defined in window.css.
	// This is the default state – no JS calculation needed.
	function centerDialog() {
		dialog.style.inset = "";
		dialog.style.margin = "";
		dialog.style.left = "";
		dialog.style.top = "";
	}

	// Only apply an explicit position when the caller actually provided x/y
	// coordinates or a deferred position.  Otherwise leave the dialog at the
	// CSS-centered default so that modal and non-modal windows both open
	// visually centered without any JS arithmetic.
	if (!cfg.modal) {
		if (cfg.fixedcenter) {
			// CSS centering is already the default; add a resize listener so
			// centerDialog() can be called programmatically if needed later.
			window.addEventListener("resize", centerDialog);
		} else if (cfg.tempx != null) {
			applyPosition(cfg.tempx, cfg.tempy);
		} else if (cfg.x !== undefined) {
			// Explicit x/y supplied by caller – honour it.
			applyPosition(cfg.x, cfg.y);
		}
		// Otherwise: no x/y → stay CSS-centered (inset:0; margin:auto).
	}

	// ---- dragging (header drag for non-modal floating windows) ----------
	if (cfg.draggable !== false && !cfg.modal) {
		let startX, startY, startLeft, startTop;
		header.addEventListener("mousedown", (e) => {
			startX = e.clientX;
			startY = e.clientY;
			startLeft = dialog.offsetLeft;
			startTop = dialog.offsetTop;
			document.addEventListener("mousemove", onDrag);
			document.addEventListener("mouseup", stopDrag);
		});
		function onDrag(e) {
			applyPosition(
				startLeft + e.clientX - startX,
				startTop + e.clientY - startY,
			);
		}
		function stopDrag() {
			document.removeEventListener("mousemove", onDrag);
			document.removeEventListener("mouseup", stopDrag);
		}
	}

	// ---- resizing -------------------------------------------------------
	if (cfg.resizable !== false) {
		let startW, startH, startX, startY;
		resizer.addEventListener("mousedown", (e) => {
			e.preventDefault();
			startW = dialog.offsetWidth;
			startH = dialog.offsetHeight;
			startX = e.clientX;
			startY = e.clientY;
			document.addEventListener("mousemove", onResize);
			document.addEventListener("mouseup", stopResize);
		});
		function onResize(e) {
			const newW = Math.max(
				cfg.minWidth || 100,
				startW + e.clientX - startX,
			);
			const newH = Math.max(
				cfg.minHeight || 80,
				startH + e.clientY - startY,
			);
			dialog.style.width = `${newW}px`;
			dialog.style.height = `${newH}px`;
		}
		function stopResize() {
			document.removeEventListener("mousemove", onResize);
			document.removeEventListener("mouseup", stopResize);
		}
	}

	// ---- window object --------------------------------------------------
	const windowObj = {
		// Metadata
		cfwindowname: name,
		divid: dialog.id,
		isConfObj: false,
		callfromtag: cfg.callfromtag || false,
		url: url || null,
		_cf_body: `${name}-body`,
		_cf_visible: false,
		_cf_dirtyview: true,
		_cf_refreshOnShow: cfg._cf_refreshOnShow || false,
		_cf_onShow: cfg.onShow || null,
		_cf_onHide: cfg.onHide || null,
		// DOM refs
		_dialog: dialog,
		_body: body,
		// Config echoes
		tempx: cfg.tempx ?? null,
		tempy: cfg.tempy ?? null,
		tempcenter: cfg.tempcenter ?? null,
		fixedcenter: cfg.fixedcenter || false,
		modal: cfg.modal || false,
		destroyonclose: cfg.destroyonclose || false,

		isVisible() {
			return this._cf_visible;
		},

		show() {
			if (this._cf_dirtyview) {
				this._loadContent();
				this._cf_dirtyview = false;
			}

			// Position deferred until first show
			if (this.tempcenter) {
				centerDialog();
				this.tempcenter = null;
			} else if (this.tempx != null && this.tempy != null) {
				applyPosition(this.tempx, this.tempy);
				this.tempx = null;
				this.tempy = null;
			}

			if (this.modal) {
				// showModal() uses the native ::backdrop pseudo-element
				dialog.showModal();
			} else {
				dialog.show();
				if (this.fixedcenter) centerDialog();
			}

			this._cf_visible = true;
			if (this._cf_onShow) this._cf_onShow(name);
		},

		hide() {
			// The 'close' event listener on the dialog handles state updates.
			dialog.close();
		},

		destroy() {
			dialog.remove();
			objectCache.delete(name);
			objectCache.delete(`${name}-body`);
		},

		center() {
			centerDialog();
		},

		setPosition(x, y) {
			applyPosition(x, y);
		},

		addListener(event, handler) {
			const map = {
				show: "_cf_onShow",
				hide: "_cf_onHide",
				beforeshow: "_cf_onBeforeShow",
				beforeclose: "_cf_onBeforeClose",
			};
			if (map[event]) this[map[event]] = handler;
		},

		// Load URL into an iframe. When the tag rendered body content and no
		// source URL was given, the seed content was already transplanted above.
		_loadContent() {
			if (!this.url) return;
			const iframe = document.createElement("iframe");
			iframe.src = this.url;
			iframe.title = title || name;
			// Once the page loads, sync the header title to the iframe page title
			// (or clear it if the page has no <title>).
			iframe.addEventListener("load", () => {
				try {
					const pageTitle = iframe.contentDocument?.title;
					titleEl.textContent =
						pageTitle && pageTitle.trim() !== "" ? pageTitle : "";
				} catch {
					// Cross-origin iframes will throw on contentDocument access – leave title as-is.
				}
			});
			this._body.innerHTML = "";
			this._body.appendChild(iframe);
		},
	};

	return windowObj;
}

// ---------------------------------------------------------------------------
// Public Window API  (mirroring ColdFusion.Window.*)
// ---------------------------------------------------------------------------

const WindowAPI = {
	/**
	 * Creates a new window or shows an existing one.
	 *
	 * @param {string}      name
	 * @param {string|null} title
	 * @param {string|null} url
	 * @param {object|null} config
	 */
	create(name, title, url, config) {
		if (name == null) {
			handleError("window.create.nullname", [], true);
			return;
		}
		if (name === "") {
			handleError("window.create.emptyname", [], true);
			return;
		}

		const cached = objectCache.get(name);

		if (cached != null) {
			// Already a live window – just show it
			if (
				typeof cached.isConfObj !== "undefined" &&
				cached.isConfObj === true
			) {
				if (config?.initshow === false) return;
			} else {
				if (!config || config.initshow !== false) {
					this.show(name);
				}
				return;
			}
		}

		console.info(`[ColdFusion.Window] Creating window: ${name}`);

		let cfg;
		try {
			cfg = buildConfig(config, name);
		} catch {
			return;
		}

		// When initshow=false, stash config and defer creation
		if (config?.initshow === false) {
			cfg.url = url;
			objectCache.set(name, cfg);
			objectCache.set(`${name}-body`, cfg);
			return;
		}

		const winObj = createDialogWindow(name, title, url, cfg);
		objectCache.set(name, winObj);
		objectCache.set(`${name}-body`, winObj);

		if (cfg.initshow !== false) {
			winObj.show();
		}

		return winObj;
	},

	/**
	 * Shows a named window, creating it first if it was deferred.
	 *
	 * @param {string} name
	 */
	show(name) {
		const cached = objectCache.get(name);

		if (cached == null) {
			handleError("window.show.notfound", [name], true);
			return;
		}

		// Still a deferred config object – materialise it now
		if (cached.isConfObj === true) {
			cached.initshow = true;
			const winObj = createDialogWindow(
				name,
				cached.title ?? null,
				cached.url ?? null,
				cached,
			);
			objectCache.set(name, winObj);
			objectCache.set(`${name}-body`, winObj);
			winObj.show();
			return;
		}

		if (!cached.isVisible()) {
			cached.show();
			console.info(`[ColdFusion.Window] Shown: ${name}`);
		}
	},

	/**
	 * Hides a named window without destroying it.
	 *
	 * @param {string} name
	 */
	hide(name) {
		const winObj = objectCache.get(name);
		if (!winObj || typeof winObj.isVisible !== "function") {
			handleError("window.hide.notfound", [name], true);
			return;
		}
		if (winObj.isVisible()) {
			winObj.hide();
			console.info(`[ColdFusion.Window] Hidden: ${name}`);
		}
	},

	/**
	 * Destroys a named window, removing it from the DOM.
	 *
	 * @param {string}  name
	 * @param {boolean} [force=false] - reserved for API compatibility
	 */
	destroy(name, force = false) {
		if (!name) return;
		const winObj = objectCache.get(name);
		if (winObj && typeof winObj.destroy === "function") {
			winObj.destroy();
			console.info(`[ColdFusion.Window] Destroyed: ${name}`);
		}
	},

	/**
	 * Registers a callback invoked after the window is shown.
	 *
	 * @param {string}   name
	 * @param {Function} handler  - receives the window name as its argument
	 */
	onShow(name, handler) {
		const winObj = objectCache.get(name);
		if (winObj == null) {
			handleError("window.onshow.notfound", [name], true);
			return;
		}
		winObj._cf_onShow = handler;
		winObj.addListener("show", (w) => handler(w.cfwindowname));
	},

	/**
	 * Registers a callback invoked after the window is hidden.
	 *
	 * @param {string}   name
	 * @param {Function} handler  - receives the window name as its argument
	 */
	onHide(name, handler) {
		const winObj = objectCache.get(name);
		if (winObj == null) {
			handleError("window.onhide.notfound", [name], true);
			return;
		}
		winObj._cf_onHide = handler;
		winObj.addListener("hide", (w) => handler(w.cfwindowname));
	},

	/**
	 * Retrieves a live window object by name, materialising deferred configs.
	 *
	 * @param {string} name
	 * @returns {object|undefined}
	 */
	getWindowObject(name) {
		if (!name) {
			handleError("window.getwindowobject.emptyname", [], true);
			return;
		}
		const cached = objectCache.get(name);
		if (cached == null) {
			handleError("window.getwindowobject.notfound", [name], true);
			return;
		}
		if (cached.isConfObj === true) {
			// Materialise deferred window and immediately hide it
			const winObj = createDialogWindow(
				name,
				cached.title ?? null,
				cached.url ?? null,
				cached,
			);
			objectCache.set(name, winObj);
			objectCache.set(`${name}-body`, winObj);
			winObj.show();
			winObj.hide();
			return winObj;
		}
		return cached;
	},
};

// ---------------------------------------------------------------------------
// Expose on window.ColdFusion.Window  (drop-in compatibility)
// ---------------------------------------------------------------------------

window.ColdFusion = window.ColdFusion || {};
window.ColdFusion.Window = WindowAPI;

// Also expose the internal caches so that external ColdFusion.* code that
// reads objectCache / bindHandlerCache continues to function.
window.ColdFusion.objectCache = objectCache;
window.ColdFusion.bindHandlerCache = bindHandlerCache;
