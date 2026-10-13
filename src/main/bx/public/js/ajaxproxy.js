/**
 * BoxLang AJAX Proxy JavaScript
 * Enhanced functionality for AJAX proxy components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// AJAX Proxy utilities
	BoxLangAjax.components.ajaxproxy = {
		/**
		 * Create a dynamic proxy for a CFC
		 */
		createCFCProxy: function (cfcPath, jsClassName = null) {
			if (!jsClassName) {
				// Derive class name from dotted path (com.example.OrderService) or file path (/path/OrderService.cfc)
				const base = cfcPath.split("/").pop();
				jsClassName = base.includes(".") && !/\.(cfc|bx)$/i.test(base)
					? base.split(".").pop()
					: base.replace(/\.(cfc|bx)$/i, "");
			}

			// Don't create if already exists
			if (window[jsClassName]) {
				console.warn("Proxy class already exists:", jsClassName);
				return window[jsClassName];
			}

			class CFCProxy {
				constructor() {
					this.cfcPath = cfcPath;
					this.timeout = 30000;
					this.retryAttempts = 3;
				}

				// Generic method caller using Fetch API
				async callMethod(methodName, args = {}, options = {}) {
					const url = options.url || this.cfcPath;
					const formData = new FormData();
					formData.append("method", methodName);
					formData.append("returnFormat", "json");

					// Add method arguments
					if (args && typeof args === "object") {
						formData.append(
							"argumentCollection",
							window.BXUICompat.JSON
								? window.BXUICompat.JSON.encode(args)
								: JSON.stringify(args),
						);
					}

					const fetchOptions = {
						method: "POST",
						body: formData,
						headers: {
							"X-Requested-With": "XMLHttpRequest",
						},
						timeout: options.timeout || this.timeout,
					};

					return BoxLangAjax.utils.fetchContent(url, fetchOptions);
				}

				// Convenience method for synchronous-looking calls
				call(
					methodName,
					args = {},
					callback = null,
					errorCallback = null,
				) {
					this.callMethod(methodName, args)
						.then((result) => {
							if (callback && typeof callback === "function") {
								callback(result);
							}
						})
						.catch((error) => {
							if (
								errorCallback &&
								typeof errorCallback === "function"
							) {
								errorCallback(
									error.message || "Unknown error",
									error,
								);
							} else {
								console.error("CFC Method Call Failed:", error);
							}
						});
				}

				// Set timeout for all calls
				setTimeout(timeout) {
					this.timeout = timeout;
					return this;
				}

				// Set retry attempts
				setRetryAttempts(attempts) {
					this.retryAttempts = attempts;
					return this;
				}
			}

			// Create instance and make it globally available
			const proxyInstance = new CFCProxy();
			window[jsClassName] = proxyInstance;

			// Store reference in BoxLang namespace
			if (!BoxLangAjax.proxies) {
				BoxLangAjax.proxies = {};
			}
			BoxLangAjax.proxies[jsClassName] = proxyInstance;

			return proxyInstance;
		},

		/**
		 * Get or create proxy by name
		 */
		getProxy: function (proxyName) {
			return BoxLangAjax.proxies
				? BoxLangAjax.proxies[proxyName]
				: window[proxyName];
		},

		/**
		 * List all available proxies
		 */
		listProxies: function () {
			return BoxLangAjax.proxies ? Object.keys(BoxLangAjax.proxies) : [];
		},

		/**
		 * Remove a proxy
		 */
		removeProxy: function (proxyName) {
			if (BoxLangAjax.proxies && BoxLangAjax.proxies[proxyName]) {
				delete BoxLangAjax.proxies[proxyName];
			}
			if (window[proxyName]) {
				delete window[proxyName];
			}
		},
	};

	// -----------------------------------------------------------------------
	// Expose BXUICompat.AjaxProxy public facade
	// -----------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};

	window.BXUICompat.AjaxProxy = {
		/**
		 * Create/register a CFC proxy class (CF-compatible API).
		 * Returns the constructor function (or prototype if isPrototype=true).
		 */
		init: function (cfcPath, jsClassName, isPrototype) {
			var proxy = BoxLangAjax.components.ajaxproxy.createCFCProxy(
				cfcPath,
				jsClassName,
			);
			if (isPrototype) return proxy;
			return window[jsClassName || cfcPath.split(".").pop()];
		},

		/**
		 * Invoke a method on a proxy object.
		 */
		invoke: function (proxyObj, methodName, token, args, context) {
			var targetUrl = proxyObj.cfcPath;
			var httpMethod = (proxyObj.httpMethod || "POST").toUpperCase();

			var params = "method=" + encodeURIComponent(methodName) + "&returnFormat=json";
			if (token) {
				params += "&_cf_ajaxproxytoken=" + encodeURIComponent(token);
			}
			if (args) {
				var jsonArgs = window.BXUICompat.JSON
					? window.BXUICompat.JSON.encode(args)
					: JSON.stringify(args);
				params += "&argumentCollection=" + encodeURIComponent(jsonArgs);
			}

			var fetchUrl = targetUrl;
			var fetchOptions = {
				method: httpMethod,
				headers: { "X-Requested-With": "XMLHttpRequest" },
			};

			if (httpMethod === "POST") {
				fetchOptions.headers["Content-Type"] =
					"application/x-www-form-urlencoded";
				fetchOptions.body = params;
			} else {
				fetchUrl += (fetchUrl.indexOf("?") === -1 ? "?" : "&") + params;
			}

			return BoxLangAjax.utils
				.fetchContent(fetchUrl, fetchOptions)
				.then(function (data) {
					// Decode JSON string if returnFormat is json (CF endpoints often return text/html Content-Type)
					if (typeof data === "string") {
						try {
							data = window.BXUICompat.JSON
								? window.BXUICompat.JSON.decode(data)
								: JSON.parse(data);
						} catch (e) {
							// Leave as string if not valid JSON
						}
					}
					if (proxyObj.callbackHandler)
						proxyObj.callbackHandler(data, context);
					return data;
				})
				.catch(function (err) {
					if (proxyObj.errorHandler) {
						proxyObj.errorHandler(-1, err.message, context);
					} else {
						window.BXUICompat.handleError(
							null,
							"AjaxProxy.invoke error: " + err.message,
							"http",
						);
					}
					throw err;
				});
		},
	};

	// Register Bind.cfcBindHandler now that AjaxProxy is available
	if (window.BXUICompat.Bind) {
		window.BXUICompat.Bind.cfcBindHandler = function (event, params) {
			var args = {};
			var expr = params.bindExpr;
			for (var i = 0; i < expr.length; i++) {
				var val;
				if (expr[i].length === 2) {
					val = expr[i][1];
				} else {
					val = window.BXUICompat.Bind.getBindElementValue(
						expr[i][1],
						expr[i][2],
						expr[i][3],
						false,
					);
				}
				args[expr[i][0]] = val;
			}

			var proxyObj = {
				cfcPath: params.cfc,
				httpMethod: params.httpMethod || "GET",
				async: true,
				callbackHandler: function (result, ctx) {
					window.BXUICompat.Bind.assignValue(
						ctx.bindTo,
						ctx.bindToAttr,
						result,
						ctx.bindToParams,
					);
				},
				errorHandler: params.errorHandler,
			};

			var ctx = {
				bindTo: params.bindTo,
				bindToAttr: params.bindToAttr,
				bindToParams: params.bindToParams,
			};

			window.BXUICompat.AjaxProxy.invoke(
				proxyObj,
				params.cfcFunction,
				params._cf_ajaxproxytoken,
				args,
				ctx,
			);
		};
		window.BXUICompat.Bind.cfcBindHandler._cf_bindhandler = true;
	}

	// Keep internal reference pointing to the public facade
	BoxLangAjax.components.ajaxproxy._bxUICompat = window.BXUICompat.AjaxProxy;
})();
