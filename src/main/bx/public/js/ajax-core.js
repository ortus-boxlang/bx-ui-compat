/**
 * BoxLang AJAX Core JavaScript
 *
 * Defines window.BXUICompat as the canonical public API object, providing a
 * full ColdFusion-compatible AJAX surface (Ajax, Bind, Event, Log, Util, DOM,
 * JSON, Pod stub, and root-level helpers).
 *
 * Sets window.ColdFusion = window.BXUICompat at the very end for drop-in
 * ColdFusion compatibility.
 *
 * All network I/O is delegated to the internal BoxLangAjax.utils namespace
 * which uses the native Fetch API - no external dependencies required.
 *
 * Load order: ajax-core.js -> ajaxproxy.js -> window.js -> component scripts
 */

// ---------------------------------------------------------------------------
// 1. Internal implementation namespace (used by all component scripts)
// ---------------------------------------------------------------------------
window.BoxLangAjax = window.BoxLangAjax || {
	version: "2.0.0",
	config: {
		cssSrc: "/bx-ui-compat/css",
		scriptSrc: "/bx-ui-compat/js",
		defaultTimeout: 30000,
		retryAttempts: 3,
		retryDelay: 1000,
		cacheTTL: 300000, // 5 minutes
		cacheMaxEntries: 100,
	},
	utils: {},
	components: {},
	cache: new Map(),
	proxies: {},
	/** @type {Map<string, AbortController>} In-flight requests keyed by containerId */
	_inFlight: new Map(),
};

// ---------------------------------------------------------------------------
// 2. Shared security & concurrency utilities
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe insertion into HTML.
 * Prevents XSS when interpolating dynamic values into innerHTML templates.
 */
BoxLangAjax.utils.escapeHTML = function (str) {
	if (str == null) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
};

/**
 * Cancel any in-flight request for a given container and return a new AbortController.
 * Ensures only the latest request for a container wins (prevents race conditions).
 */
BoxLangAjax.utils.acquireRequest = function (containerId) {
	var existing = BoxLangAjax._inFlight.get(containerId);
	if (existing) {
		existing.abort();
	}
	var controller = new AbortController();
	BoxLangAjax._inFlight.set(containerId, controller);
	return controller;
};

/**
 * Release a tracked in-flight request (called on completion).
 */
BoxLangAjax.utils.releaseRequest = function (containerId, controller) {
	if (BoxLangAjax._inFlight.get(containerId) === controller) {
		BoxLangAjax._inFlight.delete(containerId);
	}
};

/**
 * Evict stale cache entries beyond TTL or max size.
 */
BoxLangAjax.utils.pruneCache = function () {
	var ttl = BoxLangAjax.config.cacheTTL;
	var max = BoxLangAjax.config.cacheMaxEntries;
	var now = Date.now();

	// Evict expired entries
	BoxLangAjax.cache.forEach(function (entry, key) {
		if (now - entry.timestamp > ttl) {
			BoxLangAjax.cache.delete(key);
		}
	});

	// Evict oldest if over max size
	if (BoxLangAjax.cache.size > max) {
		var excess = BoxLangAjax.cache.size - max;
		var iter = BoxLangAjax.cache.keys();
		for (var i = 0; i < excess; i++) {
			BoxLangAjax.cache.delete(iter.next().value);
		}
	}
};

// ---------------------------------------------------------------------------
// 3. Fetch API wrapper with retry + timeout (internal)
// ---------------------------------------------------------------------------
BoxLangAjax.utils.fetchContent = async function (url, options = {}) {
	const defaultOptions = {
		method: "GET",
		headers: {
			"X-Requested-With": "XMLHttpRequest",
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		timeout: BoxLangAjax.config.defaultTimeout,
	};

	const fetchOptions = Object.assign({}, defaultOptions, options);
	fetchOptions.headers = Object.assign(
		{},
		defaultOptions.headers,
		options.headers || {},
	);

	if (!fetchOptions.headers["Cache-Control"]) {
		fetchOptions.headers["Cache-Control"] = "no-cache";
	}

	let lastError;

	for (
		let attempt = 1;
		attempt <= BoxLangAjax.config.retryAttempts;
		attempt++
	) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(
				() => controller.abort(),
				fetchOptions.timeout,
			);

			const { timeout, ...nativeFetchOptions } = fetchOptions;
			nativeFetchOptions.signal = controller.signal;

			const response = await fetch(url, nativeFetchOptions);
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`,
				);
			}

			const contentType = response.headers.get("content-type");
			let result;

			if (contentType && contentType.includes("application/json")) {
				result = await response.json();
			} else {
				result = await response.text();
			}

			if (response.headers.get("cache-control") !== "no-cache") {
				BoxLangAjax.cache.set(url, {
					data: result,
					timestamp: Date.now(),
					contentType: contentType,
				});
				BoxLangAjax.utils.pruneCache();
			}

			return result;
		} catch (error) {
			lastError = error;

			if (
				error.name === "AbortError" ||
				(error.message && /^HTTP 4/.test(error.message))
			) {
				break;
			}

			if (attempt < BoxLangAjax.config.retryAttempts) {
				await new Promise((resolve) =>
					setTimeout(
						resolve,
						BoxLangAjax.config.retryDelay *
							Math.pow(2, attempt - 1),
					),
				);
			}
		}
	}

	console.error("BoxLang AJAX Error after retries:", lastError);
	throw lastError;
};

/**
 * Load content into a specific container element.
 * Fires BXUICompat.Event onReplaceHTML / onReplaceHTMLUser on success.
 * Cancels any previous in-flight request for the same container (race-condition safe).
 */
BoxLangAjax.utils.loadIntoContainer = function (
	containerId,
	url,
	options = {},
) {
	const container = document.getElementById(containerId);
	if (!container) {
		console.error("Container not found: " + containerId);
		return Promise.reject(new Error("Container not found: " + containerId));
	}

	// Cancel any previous in-flight request for this container
	const requestController = BoxLangAjax.utils.acquireRequest(containerId);

	const loadingHtml =
		options.loadingTemplate || '<div class="bx-loading">Loading...</div>';
	container.innerHTML = loadingHtml;
	container.classList.add("bx-loading");

	// Merge the abort signal into fetch options
	const fetchOptions = Object.assign({}, options, {
		signal: requestController.signal,
	});

	return BoxLangAjax.utils
		.fetchContent(url, fetchOptions)
		.then(function (content) {
			BoxLangAjax.utils.releaseRequest(containerId, requestController);
			container.innerHTML = content;
			container.classList.remove("bx-loading");
			container.classList.add("bx-source-loaded");

			const event = new CustomEvent("boxlang-content-loaded", {
				detail: { url: url, container: containerId, content: content },
				bubbles: true,
			});
			container.dispatchEvent(event);

			BoxLangAjax.utils.executeScripts(container);

			// Fire BXUICompat.Event onReplaceHTML events when registered
			const $E = window.BXUICompat && window.BXUICompat.Event;
			if ($E && $E.loadEvents && $E.loadEvents[containerId]) {
				const evts = $E.loadEvents[containerId];
				if (evts.system) {
					evts.system.fire();
					evts.system.unsubscribe();
				}
				if (evts.user) {
					evts.user.fire();
					evts.user.unsubscribe();
				}
				$E.loadEvents[containerId] = null;
			}

			return content;
		})
		.catch(function (error) {
			BoxLangAjax.utils.releaseRequest(containerId, requestController);

			// If this request was aborted because a newer request replaced it, swallow silently
			if (error.name === "AbortError") {
				return;
			}

			var esc = BoxLangAjax.utils.escapeHTML;
			const errorTemplate =
				options.errorTemplate ||
				'<div class="bx-source-error">' +
					'<div class="bx-error-title">Error loading content</div>' +
					'<div class="bx-error-message">' +
					esc(error.message) +
					"</div>" +
					'<div class="bx-error-retry">' +
					'<button type="button" class="bx-retry-button" data-retry-container="' +
					esc(containerId) +
					'" data-retry-url="' +
					esc(url) +
					'">' +
					"Retry</button></div></div>";

			container.innerHTML = errorTemplate;
			container.classList.remove("bx-loading");
			container.classList.add("bx-source-error");

			// Attach retry handler via addEventListener (no inline onclick)
			var retryBtn = container.querySelector(".bx-retry-button");
			if (retryBtn) {
				retryBtn.addEventListener("click", function () {
					BoxLangAjax.utils.loadIntoContainer(containerId, url);
				});
			}

			const errorEvent = new CustomEvent("boxlang-content-error", {
				detail: { url: url, container: containerId, error: error },
				bubbles: true,
			});
			container.dispatchEvent(errorEvent);

			throw error;
		});
};

/**
 * Handle AJAX links - finds nearest suitable AJAX container and loads content.
 */
BoxLangAjax.utils.handleAjaxLink = function (url, event) {
	if (event) event.preventDefault();

	let currentElement = event ? event.target : null;
	let container = null;

	while (currentElement && currentElement !== document.body) {
		if (
			currentElement.classList &&
			(currentElement.classList.contains("bx-layout") ||
				currentElement.classList.contains("bx-div") ||
				currentElement.classList.contains("bx-pod") ||
				currentElement.classList.contains("bx-layoutarea") ||
				currentElement.id)
		) {
			container = currentElement;
			break;
		}
		currentElement = currentElement.parentElement;
	}

	if (!container) {
		container =
			document.querySelector(".bx-layout, .bx-div, .bx-pod, [id]") ||
			document.body;
	}

	if (container.id) {
		return BoxLangAjax.utils.loadIntoContainer(container.id, url);
	} else {
		const containerId = "bx-ajax-container-" + Date.now();
		container.id = containerId;
		return BoxLangAjax.utils.loadIntoContainer(containerId, url);
	}
};

/**
 * Execute any script tags found inside freshly loaded content.
 */
BoxLangAjax.utils.executeScripts = function (container) {
	container.querySelectorAll("script").forEach(function (script) {
		if (script.src) {
			const newScript = document.createElement("script");
			newScript.src = script.src;
			newScript.async = false;
			document.head.appendChild(newScript);
		} else if (script.textContent) {
			try {
				eval(script.textContent);
			} catch (error) {
				console.error("Error executing loaded script:", error);
			}
		}
	});
};

/**
 * Form submission with AJAX (internal helper).
 */
BoxLangAjax.utils.submitForm = function (form, targetContainer) {
	const formData = new FormData(form);
	const url = form.action || window.location.href;
	const method = (form.method || "POST").toUpperCase();

	const options = {
		method: method,
		headers: { "X-Requested-With": "XMLHttpRequest" },
	};

	if (method === "POST") {
		options.body = formData;
	} else {
		const params = new URLSearchParams(formData);
		const separator = url.includes("?") ? "&" : "?";
		return BoxLangAjax.utils.loadIntoContainer(
			targetContainer,
			url + separator + params.toString(),
		);
	}

	return BoxLangAjax.utils.loadIntoContainer(targetContainer, url, options);
};

/**
 * Auto-refresh a container on a fixed interval (internal).
 * Uses setTimeout chains to prevent stacking when requests are slow.
 */
BoxLangAjax.utils.autoRefresh = function (containerId, url, interval) {
	const container = document.getElementById(containerId);
	if (!container) {
		console.error("Auto-refresh container not found: " + containerId);
		return;
	}

	// Track active auto-refresh timers by container
	if (!BoxLangAjax._autoRefreshTimers) {
		BoxLangAjax._autoRefreshTimers = new Map();
	}

	// Stop any existing auto-refresh for this container
	BoxLangAjax.utils.stopAutoRefresh(containerId);

	var active = true;

	function scheduleNext() {
		if (!active) return;
		var timerId = setTimeout(function () {
			if (!active || !document.contains(container)) {
				active = false;
				BoxLangAjax._autoRefreshTimers.delete(containerId);
				return;
			}
			BoxLangAjax.utils
				.loadIntoContainer(containerId, url)
				.catch(function (error) {
					if (error && error.name !== "AbortError") {
						console.error("Auto-refresh failed:", error);
					}
				})
				.finally(function () {
					scheduleNext();
				});
		}, interval);
		BoxLangAjax._autoRefreshTimers.set(containerId, {
			timerId: timerId,
			stop: function () {
				active = false;
				clearTimeout(timerId);
			},
		});
	}

	scheduleNext();

	// Legacy: store interval marker on dataset for backward compat
	if (!container.dataset.refreshIntervals) {
		container.dataset.refreshIntervals = "";
	}
	container.dataset.refreshIntervals = containerId;

	return containerId; // Return identifier for stopAutoRefresh
};

/**
 * Stop auto-refresh for a container.
 */
BoxLangAjax.utils.stopAutoRefresh = function (containerId) {
	if (!BoxLangAjax._autoRefreshTimers) return;
	var entry = BoxLangAjax._autoRefreshTimers.get(containerId);
	if (entry) {
		entry.stop();
		BoxLangAjax._autoRefreshTimers.delete(containerId);
	}
};

// ---------------------------------------------------------------------------
// 4. window.BXUICompat - canonical public API
// ---------------------------------------------------------------------------
window.BXUICompat = window.BXUICompat || {};

const $C = window.BXUICompat;

$C.version = "2.0.0";
$C.config = BoxLangAjax.config;
$C.objectCache = $C.objectCache || {};
$C.bindHandlerCache = $C.bindHandlerCache || {};
$C.importedTags = $C.importedTags || [];
$C.requestCounter = 0;
$C.required = $C.required || {};
$C.Spry = {}; // Spry is EOL - empty stub for source compatibility

// ---------------------------------------------------------------------------
// 3a. Log - structured console wrapper, no server shipping
// ---------------------------------------------------------------------------
$C.Log = {
	isAvailable: true,

	_fmt: function (msg, category, args) {
		var out = category
			? "[BXUICompat:" + category + "] " + msg
			: "[BXUICompat] " + msg;
		return args && args.length ? [out].concat(args) : [out];
	},

	debug: function (msg, cat, args) {
		console.debug.apply(console, this._fmt(msg, cat, args));
	},
	info: function (msg, cat, args) {
		console.info.apply(console, this._fmt(msg, cat, args));
	},
	warn: function (msg, cat, args) {
		console.warn.apply(console, this._fmt(msg, cat, args));
	},
	error: function (msg, cat, args) {
		console.error.apply(console, this._fmt(msg, cat, args));
	},
	dump: function (obj) {
		console.dir(obj);
	},
};

var $L = $C.Log;

// ---------------------------------------------------------------------------
// 3b. Util - type helpers ported from cfajax.js $U namespace
// ---------------------------------------------------------------------------
$C.Util = {
	isWhitespace: function (s) {
		return /^\s*$/.test(s);
	},

	getFirstNonWhitespaceIndex: function (s) {
		var m = s.search(/\S/);
		return m === -1 ? s.length : m;
	},

	isInteger: function (n) {
		if (typeof n === "number") return n >= 0 && Number.isInteger(n);
		return /^\d+$/.test(String(n));
	},

	isArray: function (a) {
		return Array.isArray(a);
	},

	isBoolean: function (b) {
		if (b === true || b === false) return true;
		if (typeof b === "string") {
			var l = b.toLowerCase();
			return l === "true" || l === "false";
		}
		return false;
	},

	castBoolean: function (b) {
		if (b === true) return true;
		if (b === false) return false;
		if (typeof b === "string") return b.toLowerCase() === "true";
		return false;
	},

	/**
	 * Detect ColdFusion query wire format.
	 * Returns "row" | "col" | null.
	 */
	checkQuery: function (o) {
		if (!o) return null;
		if (
			o.COLUMNS &&
			Array.isArray(o.COLUMNS) &&
			o.DATA &&
			Array.isArray(o.DATA)
		) {
			if (o.DATA.length === 0 || Array.isArray(o.DATA[0])) return "row";
		}
		if (o.COLUMNS && Array.isArray(o.COLUMNS) && o.ROWCOUNT !== undefined) {
			var valid = o.COLUMNS.every(function (col) {
				return Array.isArray(o.DATA[col]);
			});
			if (valid) return "col";
		}
		return null;
	},

	extractReturnFormat: function (url) {
		var m = url.toUpperCase().match(/[?&]RETURNFORMAT=([^&]*)/);
		return m ? m[1] : null;
	},

	replaceAll: function (str, find, replace) {
		return str.split(find).join(replace);
	},

	cloneObject: function (obj) {
		return Object.assign({}, obj);
	},
};

var $U = $C.Util;

// ---------------------------------------------------------------------------
// 3c. JSON - native JSON wrapper with CF-compatible Date serialisation
// ---------------------------------------------------------------------------
$C.JSON = {
	encode: function (o) {
		return JSON.stringify(o, function (_key, value) {
			if (value instanceof Date) {
				var pad = function (n) {
					return String(n).padStart(2, "0");
				};
				return (
					value.getFullYear() +
					"-" +
					pad(value.getMonth() + 1) +
					"-" +
					pad(value.getDate()) +
					"T" +
					pad(value.getHours()) +
					":" +
					pad(value.getMinutes()) +
					":" +
					pad(value.getSeconds())
				);
			}
			return value;
		});
	},

	decode: function (json) {
		if (typeof json === "object") return json;
		if (!json || $U.isWhitespace(json)) return null;
		var idx = $U.getFirstNonWhitespaceIndex(json);
		if (idx > 0) json = json.slice(idx);
		return JSON.parse(json);
	},
};

// ---------------------------------------------------------------------------
// 3d. DOM - element lookup helpers ported from cfajax.js $D namespace
// ---------------------------------------------------------------------------
$C.DOM = {
	get: function (el) {
		if (!el) return null;
		if (typeof el === "string") return document.getElementById(el);
		if (Array.isArray(el))
			return el.map(function (e) {
				return $C.DOM.get(e);
			});
		return el;
	},

	getElement: function (nameOrId, formId) {
		var filterFn = function (el) {
			return el.name === nameOrId || el.id === nameOrId;
		};
		var root = formId ? $C.DOM.get(formId) : null;
		var results = $C.DOM.getElementsBy(filterFn, null, root);
		return results.length === 1 ? results[0] : results;
	},

	getElementsBy: function (filterFn, tag, root) {
		tag = tag || "*";
		root = root || document;
		var all = root.getElementsByTagName(tag);
		var out = [];
		for (var i = 0; i < all.length; i++) {
			if (filterFn(all[i])) out.push(all[i]);
		}
		return out;
	},
};

var $D = $C.DOM;

// ---------------------------------------------------------------------------
// 3e. Event - CF-compatible event system
// ---------------------------------------------------------------------------
$C.Event = (function () {
	"use strict";

	var _listeners = [];
	var _loadEvents = {};
	var _windowLoaded = false;

	var _impQueue = [];
	var _normalQueue = [];
	var _userQueue = [];

	function _makeCFCustomEvent(name, domNode) {
		return {
			name: name,
			domNode: domNode,
			subs: [],
			subscribe: function (fn, params) {
				var dup = this.subs.some(function (s) {
					return s.f === fn && s.p === params;
				});
				if (!dup) this.subs.push({ f: fn, p: params });
			},
			fire: function () {
				this.subs.forEach(
					function (s) {
						s.f.call(null, this, s.p);
					}.bind(this),
				);
			},
			unsubscribe: function () {
				this.subs = [];
			},
		};
	}

	function _addListener(el, ev, fn, params) {
		if (!el) return false;
		var wrapped = function (e) {
			fn.call(null, e || window.event, params);
		};
		_listeners.push({
			el: el,
			ev: ev,
			fn: fn,
			params: params,
			wrapped: wrapped,
		});
		el.addEventListener(ev, wrapped, false);
		return true;
	}

	function _isListener(el, ev, fn, params) {
		return _listeners.some(function (l) {
			return (
				l.el === el && l.ev === ev && l.fn === fn && l.params === params
			);
		});
	}

	function _callBindHandlers(id, params, ev) {
		var el = document.getElementById(id);
		if (!el) return;
		_listeners.forEach(function (l) {
			if (l.el === el && l.ev === ev && l.fn._cf_bindhandler) {
				l.fn.call(null, null, l.params);
			}
		});
	}

	function _registerOnLoad(fn, params, important, user) {
		if (_windowLoaded) {
			var containerId = params && params._cf_containerId;
			if (containerId && _loadEvents[containerId]) {
				var slot = user
					? _loadEvents[containerId].user
					: _loadEvents[containerId].system;
				if (slot) slot.subscribe(fn, params);
			} else {
				fn.call(null, null, params);
			}
		} else {
			if (user) {
				_userQueue.push({ fn: fn, params: params });
			} else if (important) {
				_impQueue.push({ fn: fn, params: params });
			} else {
				_normalQueue.push({ fn: fn, params: params });
			}
		}
	}

	function _onWindowLoad(fn) {
		window.addEventListener("load", fn, false);
	}

	function _windowLoadHandler() {
		_windowLoaded = true;
		_impQueue.forEach(function (e) {
			e.fn.call(null, null, e.params);
		});
		_normalQueue.forEach(function (e) {
			e.fn.call(null, null, e.params);
		});
		_userQueue.forEach(function (e) {
			e.fn.call(null, null, e.params);
		});
		_impQueue.length = _normalQueue.length = _userQueue.length = 0;
	}

	_onWindowLoad(_windowLoadHandler);

	return {
		loadEvents: _loadEvents,
		listeners: _listeners,
		CustomEvent: _makeCFCustomEvent,
		addListener: _addListener,
		isListener: _isListener,
		callBindHandlers: _callBindHandlers,
		registerOnLoad: _registerOnLoad,
		onWindowLoad: _onWindowLoad,

		addOnLoad: function (fn) {
			_registerOnLoad(fn, null, false, true);
		},

		removeOnLoad: function (fn) {
			[_impQueue, _normalQueue, _userQueue].forEach(function (q) {
				var idx = q.findIndex(function (e) {
					return e.fn === fn;
				});
				if (idx !== -1) q.splice(idx, 1);
			});
		},
	};
})();

var $E = $C.Event;

// ---------------------------------------------------------------------------
// 3f. Ajax - public AJAX methods delegating to BoxLangAjax.utils
// ---------------------------------------------------------------------------
$C.Ajax = (function () {
	"use strict";

	function sendMessage(
		url,
		method,
		params,
		async,
		callback,
		context,
		throwOnError,
	) {
		if (async === false) {
			console.warn(
				"BXUICompat.Ajax.sendMessage: synchronous mode is not supported with the Fetch API. Falling back to async.",
			);
		}

		method = (method || "GET").toUpperCase();

		var options = {
			method: method,
			headers: { "X-Requested-With": "XMLHttpRequest" },
		};

		var fetchUrl = url;

		if (params) {
			if (method === "POST") {
				options.headers["Content-Type"] =
					"application/x-www-form-urlencoded";
				options.body = params;
			} else {
				fetchUrl += (url.includes("?") ? "&" : "?") + params;
			}
		}

		var promise = BoxLangAjax.utils.fetchContent(fetchUrl, options);

		if (typeof callback === "function") {
			promise
				.then(function (data) {
					callback(data, context);
				})
				.catch(function (err) {
					if (throwOnError) throw err;
					$L.error("Ajax.sendMessage error: " + err.message, "http");
				});
		}

		return promise;
	}

	function submitForm(formId, url, callback, errorCallback, method, async) {
		var qs = $C.getFormQueryString(formId);
		if (qs === -1) {
			$C.handleError(
				errorCallback,
				"Ajax.submitForm: form not found: " + formId,
				"http",
			);
			return;
		}
		method = (method || "POST").toUpperCase();
		sendMessage(url, method, qs, async !== false, callback, null, false);
	}

	function replaceHTML(
		containerId,
		url,
		method,
		params,
		callback,
		errorHandler,
	) {
		var container = document.getElementById(containerId);
		if (!container) {
			$C.handleError(
				errorHandler,
				"Ajax.replaceHTML: element not found: " + containerId,
				"http",
			);
			return;
		}

		var sysEvt = $E.CustomEvent("onReplaceHTML", container);
		var userEvt = $E.CustomEvent("onReplaceHTMLUser", container);
		$E.loadEvents[containerId] = { system: sysEvt, user: userEvt };

		method = (method || "GET").toUpperCase();

		var fullParams = params || "";
		if (fullParams) fullParams += "&";
		fullParams += "_cf_containerId=" + encodeURIComponent(containerId);

		sendMessage(
			url,
			method,
			fullParams,
			true,
			function (content) {
				container.innerHTML = content;
				BoxLangAjax.utils.executeScripts(container);

				sysEvt.fire();
				sysEvt.unsubscribe();
				userEvt.fire();
				userEvt.unsubscribe();
				$E.loadEvents[containerId] = null;

				if (typeof callback === "function") callback();
			},
			null,
			false,
		);
	}

	function checkForm(form, validateFn, target, callback, errorHandler) {
		if (
			typeof validateFn === "function" &&
			validateFn.call(null, form) === false
		) {
			return false;
		}
		var qs = $C.getFormQueryString(form);
		replaceHTML(
			target,
			form.action,
			form.method,
			qs,
			callback,
			errorHandler,
		);
		return false;
	}

	return {
		sendMessage: sendMessage,
		submitForm: submitForm,
		replaceHTML: replaceHTML,
		checkForm: checkForm,
	};
})();

// ---------------------------------------------------------------------------
// 3g. Bind - CF expression binding system
// ---------------------------------------------------------------------------
$C.Bind = (function () {
	"use strict";

	function getBindElementValue(id, formId, attr, required, suppress) {
		attr = attr || "value";

		var cached = $C.objectCache[id];
		if (cached && typeof cached._cf_getAttribute === "function") {
			return cached._cf_getAttribute(attr);
		}

		var el = $D.getElement(id, formId);
		if (!el || (Array.isArray(el) && el.length === 0)) {
			if (!suppress) {
				$C.handleError(
					null,
					"Bind.getBindElementValue: element not found: " + id,
					"bind",
				);
			}
			return null;
		}

		var els = Array.isArray(el) ? el : [el];

		// Radio / checkbox group
		if (els.length > 1 && !el.options) {
			var val = "";
			var first = true;
			els.forEach(function (e) {
				var isToggle = e.type === "radio" || e.type === "checkbox";
				if (!isToggle || e.checked) {
					if (!first) val += ",";
					val += _extract(e, attr);
					first = false;
				}
			});
			if (required && $C.required[id] && val === "") return null;
			return val;
		}

		var single = els[0];

		// Select element
		if (single.tagName === "SELECT") {
			var sval = "";
			var sfirst = true;
			for (var i = 0; i < single.options.length; i++) {
				if (single.options[i].selected) {
					if (!sfirst) sval += ",";
					sval += _extract(single.options[i], attr);
					sfirst = false;
				}
			}
			return sval;
		}

		return _extract(single, attr);
	}

	function _extract(el, attr) {
		var val = el[attr];
		if ((val === null || val === undefined) && el.getAttribute) {
			val = el.getAttribute(attr);
		}
		return val == null ? "" : val;
	}

	function assignValue(targetId, attr, value, params) {
		if (!targetId) return;

		if (typeof targetId === "function") {
			targetId.call(null, value, params);
			return;
		}

		var cached = $C.objectCache[targetId];
		if (cached && typeof cached._cf_setValue === "function") {
			cached._cf_setValue(value);
			return;
		}

		var el = document.getElementById(targetId);
		if (!el) {
			$C.handleError(
				null,
				"Bind.assignValue: element not found: " + targetId,
				"bind",
			);
			return;
		}

		attr = attr || "value";

		if (el.tagName === "SELECT") {
			_populateSelect(el, value, params, targetId);
		} else {
			el[attr] = value;
		}

		$E.callBindHandlers(targetId, null, "change");
	}

	function _populateSelect(el, value, params, targetId) {
		var queryType = $U.checkQuery(value);
		var cached = $C.objectCache[targetId] || {};

		el.options.length = 0;

		if (!queryType) {
			if (Array.isArray(value)) {
				value.forEach(function (pair, i) {
					var opt = new Option(pair[1], pair[0]);
					el.options[i] = opt;
					if (
						cached.selected &&
						cached.selected.indexOf(opt.value) !== -1
					) {
						opt.selected = true;
					}
				});
			}
			return;
		}

		if (queryType === "col") {
			var vals = value.DATA[cached.valueCol];
			var disp = value.DATA[cached.displayCol];
			if (!vals || !disp) {
				$C.handleError(
					null,
					"Bind.assignValue: missing valueCol/displayCol for select: " +
						targetId,
					"bind",
				);
				return;
			}
			vals.forEach(function (v, i) {
				var opt = new Option(disp[i], v);
				el.options[i] = opt;
				if (
					cached.selected &&
					cached.selected.indexOf(opt.value) !== -1
				)
					opt.selected = true;
			});
			return;
		}

		if (queryType === "row") {
			var vIdx = -1,
				dIdx = -1;
			value.COLUMNS.forEach(function (col, i) {
				if (col === cached.valueCol) vIdx = i;
				if (col === cached.displayCol) dIdx = i;
			});
			if (vIdx === -1 || dIdx === -1) {
				$C.handleError(
					null,
					"Bind.assignValue: invalid valueCol/displayCol for select: " +
						targetId,
					"bind",
				);
				return;
			}
			value.DATA.forEach(function (row, i) {
				var opt = new Option(row[dIdx], row[vIdx]);
				el.options[i] = opt;
				if (
					cached.selected &&
					cached.selected.indexOf(opt.value) !== -1
				)
					opt.selected = true;
			});
		}
	}

	function _evaluateBindTemplate(
		bindParams,
		required,
		encode,
		suppressRequired,
		encodeDelimiters,
	) {
		var expr = bindParams.bindExpr;
		var out = "";

		for (var i = 0; i < expr.length; i++) {
			var part = expr[i];

			if (Array.isArray(part)) {
				if (part.length > 0 && Array.isArray(part[0])) {
					out += $C.JSON.encode(part);
				} else {
					var val = getBindElementValue(
						part[0],
						part[1],
						part[2],
						required,
						suppressRequired,
					);
					if (val === null) {
						if (required) {
							out = "";
							break;
						}
						val = "";
					}
					if (encode) val = encodeURIComponent(val);
					out += val;
				}
			} else {
				var literal = part;
				if (
					encodeDelimiters &&
					i > 0 &&
					typeof literal === "string" &&
					literal.indexOf("&") !== 0
				) {
					literal = encodeURIComponent(literal);
				}
				out += literal;
			}
		}

		return out;
	}

	function register(bindings, bindParams, handler, executeOnLoad) {
		bindings.forEach(function (b) {
			var elId = b[0];
			var formId = b[1];
			var ev = b[2];

			var cached = $C.objectCache[elId];
			if (cached && typeof cached._cf_register === "function") {
				cached._cf_register(ev, handler, bindParams);
				return;
			}

			var el = $D.getElement(elId, formId);
			if (!el) {
				$C.handleError(
					null,
					"Bind.register: element not found: " + elId,
					"bind",
				);
				return;
			}

			var els = Array.isArray(el) ? el : [el];
			els.forEach(function (e) {
				if (!$E.isListener(e, ev, handler, bindParams)) {
					$E.addListener(e, ev, handler, bindParams);
				}
			});
		});

		if (
			!$C.bindHandlerCache[bindParams.bindTo] &&
			typeof bindParams.bindTo === "string"
		) {
			$C.bindHandlerCache[bindParams.bindTo] = function () {
				handler.call(null, null, bindParams);
			};
		}

		if (executeOnLoad) handler.call(null, null, bindParams);
	}

	// --- Bind handler implementations ---

	function localBindHandler(event, params) {
		var val = _evaluateBindTemplate(params, true);
		assignValue(params.bindTo, params.bindToAttr, val, params.bindToParams);
	}
	localBindHandler._cf_bindhandler = true;

	function jsBindHandler(event, params) {
		var expr = params.bindExpr;
		var args = expr.map(function (part) {
			if (Array.isArray(part)) {
				if (part.length && typeof part[0] !== "object") {
					return getBindElementValue(
						part[0],
						part[1],
						part[2],
						false,
					);
				}
				return part;
			}
			return part;
		});
		var result = params.callFunction.apply(null, args);
		assignValue(
			params.bindTo,
			params.bindToAttr,
			result,
			params.bindToParams,
		);
	}
	jsBindHandler._cf_bindhandler = true;

	function urlBindHandler(event, params) {
		var target = params.bindTo;

		var cachedTarget = $C.objectCache[target];
		if (cachedTarget && cachedTarget._cf_visible === false) {
			cachedTarget._cf_dirtyview = true;
			return;
		}

		var url = _evaluateBindTemplate(params, false, true, false, true);
		var returnFormat = $U.extractReturnFormat(url) || "JSON";

		if (
			params.bindToAttr ||
			typeof target === "undefined" ||
			typeof target === "function"
		) {
			BoxLangAjax.utils
				.fetchContent(url, { method: "GET" })
				.then(function (data) {
					var val = data;
					if (returnFormat === "JSON" && typeof data === "string") {
						try {
							val = $C.JSON.decode(data);
						} catch (e) {
							val = data;
						}
					}
					assignValue(
						target,
						params.bindToAttr,
						val,
						params.bindToParams,
					);
				})
				.catch(function (err) {
					$C.handleError(
						params.errorHandler,
						"Bind.urlBindHandler error: " + err.message,
						"http",
					);
				});
		} else {
			$C.Ajax.replaceHTML(
				target,
				url,
				"GET",
				null,
				params.callback,
				params.errorHandler,
			);
		}
	}
	urlBindHandler._cf_bindhandler = true;

	return {
		register: register,
		assignValue: assignValue,
		getBindElementValue: getBindElementValue,
		localBindHandler: localBindHandler,
		jsBindHandler: jsBindHandler,
		urlBindHandler: urlBindHandler,
		evaluateBindTemplate: _evaluateBindTemplate,
	};
})();

var $B = $C.Bind;

// ---------------------------------------------------------------------------
// 3h. Pod core stub - full implementation is in pod.js
// ---------------------------------------------------------------------------
$C.Pod = {
	init: function (podId) {
		$C.objectCache[podId] = { _cf_body: podId + "_body" };
		$L.info("Pod.init", "widget", [podId]);
	},
};

// ---------------------------------------------------------------------------
// 3h-2. ProgressBar stub - provides no-op compat surface for legacy CF code
// ---------------------------------------------------------------------------
$C.ProgressBar = {
	_bars: {},

	show: function (barName) {
		var el = document.getElementById(barName);
		if (el) {
			el.style.display = "";
			el.classList.remove("bx-progressbar-hidden");
		}
		this._bars[barName] = this._bars[barName] || {};
		this._bars[barName].visible = true;
		$L.info("ProgressBar.show", "widget", [barName]);
	},

	hide: function (barName) {
		var el = document.getElementById(barName);
		if (el) {
			el.classList.add("bx-progressbar-hidden");
			el.style.display = "none";
		}
		if (this._bars[barName]) this._bars[barName].visible = false;
		$L.info("ProgressBar.hide", "widget", [barName]);
	},

	start: function (barName) {
		this._bars[barName] = this._bars[barName] || {};
		this._bars[barName].running = true;
		var el = document.getElementById(barName);
		if (el) el.classList.add("bx-progress-running");
		$L.info("ProgressBar.start", "widget", [barName]);
	},

	stop: function (barName) {
		if (this._bars[barName]) {
			if (this._bars[barName]._timerId) {
				clearInterval(this._bars[barName]._timerId);
				clearTimeout(this._bars[barName]._timerId);
				this._bars[barName]._timerId = null;
			}
			this._bars[barName].running = false;
		}
		var el = document.getElementById(barName);
		if (el) el.classList.remove("bx-progress-running");
		$L.info("ProgressBar.stop", "widget", [barName]);
	},
};

// ---------------------------------------------------------------------------
// 3i. Root-level public helpers
// ---------------------------------------------------------------------------

$C.empty = function () {};

$C.trim = function (str) {
	return str == null ? "" : String(str).trim();
};

$C.clone = function (obj, deep) {
	if (typeof obj !== "object" || obj === null) return obj;
	if (!deep) return Object.assign({}, obj);
	var out = {};
	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			out[key] = $C.clone(obj[key], true);
		}
	}
	return out;
};

$C.setGlobalErrorHandler = function (fn) {
	$C.userGlobalErrorHandler = fn;
};

$C.handleError = function (
	userErrorHandler,
	message,
	_category,
	args,
	status,
	_statusText,
	throwError,
	context,
) {
	var msg = args
		? args.reduce(function (m, a, i) {
				return m.replace("{" + i + "}", a);
			}, message)
		: message;

	$L.error(msg, _category);

	if (typeof userErrorHandler === "function") {
		userErrorHandler(status || -1, msg, context);
	} else if (typeof $C.userGlobalErrorHandler === "function") {
		$C.userGlobalErrorHandler(msg);
	} else if (throwError) {
		throw new Error(msg);
	}
};

$C.getFormQueryString = function (formId, asObject) {
	var form;
	if (typeof formId === "string") {
		form = document.getElementById(formId) || document.forms[formId];
	} else if (typeof formId === "object") {
		form = formId;
	}
	if (!form || !form.elements) return -1;

	var parts = asObject ? {} : [];

	function add(name, value) {
		if (asObject) {
			parts[name] =
				parts[name] !== undefined ? parts[name] + "," + value : value;
		} else {
			parts.push(
				encodeURIComponent(name) + "=" + encodeURIComponent(value),
			);
		}
	}

	for (var i = 0; i < form.elements.length; i++) {
		var el = form.elements[i];
		if (el.disabled || !el.name) continue;

		switch (el.type) {
			case "select-one":
			case "select-multiple":
				for (var j = 0; j < el.options.length; j++) {
					if (el.options[j].selected)
						add(el.name, el.options[j].value);
				}
				break;
			case "radio":
			case "checkbox":
				if (el.checked) add(el.name, el.value);
				break;
			case "file":
			case "reset":
				break;
			case "submit":
				if (el.cfinputbutton) {
					if (el.clicked) add(el.name, el.value);
				} else {
					add(el.name, el.value);
				}
				break;
			default:
				if (el.type !== undefined) add(el.name, el.value);
				break;
		}
	}

	return asObject ? parts : parts.join("&");
};

$C.setSubmitClicked = function (formId, buttonId) {
	var el = $D.getElement(buttonId, formId);
	if (!el) return;
	el.cfinputbutton = true;
	$E.addListener(el, "click", function () {
		el.clicked = true;
	});
};

$C.getElementValue = function (name, formId, attr) {
	if (!name) {
		$C.handleError(
			null,
			"getElementValue: element name is required",
			"bind",
			null,
			null,
			null,
			true,
		);
		return;
	}
	var val = $B.getBindElementValue(name, formId, attr || "value");
	if (val === null || val === undefined) {
		$C.handleError(
			null,
			"getElementValue: element not found: " + name,
			"bind",
			null,
			null,
			null,
			true,
		);
		return;
	}
	return val;
};

$C.setStyle = function (elementId, style, value) {
	var el = document.getElementById(elementId);
	if (el) el.style[style] = value;
};

$C.navigate = function (url, target, onSuccess, onError, method, formId) {
	if (!url) {
		$C.handleError(onError, "navigate: url is required", "widget");
		return;
	}

	method = (method || "GET").toUpperCase();

	var qs = "";
	if (formId) {
		qs = $C.getFormQueryString(formId);
		if (qs === -1) {
			$C.handleError(
				null,
				"navigate: form not found: " + formId,
				"http",
				null,
				null,
				null,
				true,
			);
			return;
		}
	}

	if (!target) {
		if (qs) url += (url.includes("?") ? "&" : "?") + qs;
		window.location.assign(url);
		return;
	}

	$C.Ajax.replaceHTML(target, url, method, qs || null, onSuccess, onError);
};

$C.initSelect = function (elementId, valueCol, displayCol, selected) {
	$C.objectCache[elementId] = {
		valueCol: valueCol,
		displayCol: displayCol,
		selected: selected,
	};
};

// ---------------------------------------------------------------------------
// 4. Wire BoxLangAjax shared references back to BXUICompat
// ---------------------------------------------------------------------------
BoxLangAjax.config = $C.config;

// ---------------------------------------------------------------------------
// 5. DOMContentLoaded initialisation
// ---------------------------------------------------------------------------
function initBoxLangAjax() {
	window.addEventListener("unhandledrejection", function (event) {
		if (
			event.reason &&
			event.reason.message &&
			event.reason.message.includes("BoxLang AJAX")
		) {
			console.error("Unhandled BoxLang AJAX error:", event.reason);
		}
	});

	document
		.querySelectorAll("[data-refresh-url][data-refresh-interval]")
		.forEach(function (element) {
			var url = element.dataset.refreshUrl;
			var interval = parseInt(element.dataset.refreshInterval) * 1000;
			if (element.id && url && interval > 0) {
				BoxLangAjax.utils.autoRefresh(element.id, url, interval);
			}
		});

	document
		.querySelectorAll("form[data-ajax-target]")
		.forEach(function (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				BoxLangAjax.utils.submitForm(form, form.dataset.ajaxTarget);
			});
		});

	$L.info("BoxLang AJAX + BXUICompat initialised successfully", "core");
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initBoxLangAjax);
} else {
	initBoxLangAjax();
}

// ---------------------------------------------------------------------------
// 6. Drop-in ColdFusion compatibility alias - MUST be the very last statement
// ---------------------------------------------------------------------------
window.ColdFusion = window.BXUICompat;
