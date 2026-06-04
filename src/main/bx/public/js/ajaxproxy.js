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
				jsClassName = cfcPath.split(".").pop();
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
					const url = options.url || "/index.cfm";
					const formData = new FormData();
					formData.append("method", methodName);
					formData.append("cfc", this.cfcPath);

					// Add method arguments
					for (const [key, value] of Object.entries(args)) {
						if (value !== null && value !== undefined) {
							formData.append(key, value);
						}
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
		 * Execute a bind expression
		 */
		executeBind: function (
			bindExpression,
			onSuccess = null,
			onError = null,
		) {
			if (!bindExpression.startsWith("cfc:")) {
				console.error(
					"Only CFC bind expressions are supported:",
					bindExpression,
				);
				if (onError)
					onError(
						"Unsupported bind expression",
						new Error("Unsupported bind expression"),
					);
				return;
			}

			// Parse bind expression: cfc:component.method(param1,param2)
			const cfcCall = bindExpression.replace("cfc:", "");
			const methodStart = cfcCall.indexOf(".");
			const paramsStart = cfcCall.indexOf("(");

			if (methodStart === -1 || paramsStart === -1) {
				console.error(
					"Invalid bind expression format:",
					bindExpression,
				);
				if (onError)
					onError(
						"Invalid bind expression format",
						new Error("Invalid format"),
					);
				return;
			}

			const cfcName = cfcCall.substring(0, methodStart);
			const methodName = cfcCall.substring(methodStart + 1, paramsStart);
			let params = "";

			if (paramsStart < cfcCall.length - 1) {
				params = cfcCall.substring(paramsStart + 1, cfcCall.length - 1);
			}

			// Parse parameters
			const args = {};
			if (params.trim()) {
				const paramList = params.split(",");
				paramList.forEach((param, index) => {
					const trimmedParam = param.trim();
					if (trimmedParam) {
						args[`param${index + 1}`] = trimmedParam;
					}
				});
			}

			// Execute the call
			const formData = new FormData();
			formData.append("method", methodName);
			formData.append("cfc", cfcName);

			Object.keys(args).forEach((key) => {
				formData.append(key, args[key]);
			});

			BoxLangAjax.utils
				.fetchContent("/index.cfm", {
					method: "POST",
					body: formData,
					headers: {
						"X-Requested-With": "XMLHttpRequest",
					},
				})
				.then((result) => {
					if (onSuccess && typeof onSuccess === "function") {
						onSuccess(result);
					}
				})
				.catch((error) => {
					console.error("Bind execution failed:", error);
					if (onError && typeof onError === "function") {
						onError(error.message || "Unknown error", error);
					}
				});
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

	// Enhanced form submission with AJAX proxy
	function enhanceProxyForms() {
		document
			.querySelectorAll("form[data-cfc-proxy]")
			.forEach(function (form) {
				form.addEventListener("submit", function (event) {
					event.preventDefault();

					const cfcPath = form.dataset.cfcProxy;
					const method = form.dataset.cfcMethod || "processForm";
					const successCallback = form.dataset.successCallback;
					const errorCallback = form.dataset.errorCallback;

					if (!cfcPath) {
						console.error("No CFC path specified for proxy form");
						return;
					}

					// Get or create proxy
					let proxy =
						BoxLangAjax.components.ajaxproxy.getProxy(cfcPath);
					if (!proxy) {
						proxy =
							BoxLangAjax.components.ajaxproxy.createCFCProxy(
								cfcPath,
							);
					}

					// Collect form data
					const formData = new FormData(form);
					const args = {};
					for (const [key, value] of formData.entries()) {
						args[key] = value;
					}

					// Submit via proxy
					proxy.call(
						method,
						args,
						function (result) {
							if (successCallback && window[successCallback]) {
								window[successCallback](result, form);
							} else {
								console.debug(
									"Form submitted successfully:",
									result,
								);
							}
						},
						function (error) {
							if (errorCallback && window[errorCallback]) {
								window[errorCallback](error, form);
							} else {
								console.error("Form submission failed:", error);
							}
						},
					);
				});
			});
	}

	// Auto-execute bind expressions on page load
	function executePageBinds() {
		document
			.querySelectorAll("[data-bind-expression]")
			.forEach(function (element) {
				const bindExpr = element.dataset.bindExpression;
				const successCallback = element.dataset.bindSuccess;
				const errorCallback = element.dataset.bindError;
				const delay = parseInt(element.dataset.bindDelay) || 0;

				setTimeout(function () {
					BoxLangAjax.components.ajaxproxy.executeBind(
						bindExpr,
						successCallback ? window[successCallback] : null,
						errorCallback ? window[errorCallback] : null,
					);
				}, delay);
			});
	}

	// Set up periodic bind execution
	function setupPeriodicBinds() {
		document
			.querySelectorAll("[data-bind-interval]")
			.forEach(function (element) {
				const bindExpr = element.dataset.bindExpression;
				const interval = parseInt(element.dataset.bindInterval) * 1000; // Convert to milliseconds
				const successCallback = element.dataset.bindSuccess;
				const errorCallback = element.dataset.bindError;

				if (bindExpr && interval > 0) {
					setInterval(function () {
						BoxLangAjax.components.ajaxproxy.executeBind(
							bindExpr,
							successCallback ? window[successCallback] : null,
							errorCallback ? window[errorCallback] : null,
						);
					}, interval);
				}
			});
	}

	// Global error handler for proxy calls
	function setupProxyErrorHandling() {
		// Override the default proxy error handling to be more user-friendly
		if (!window.BoxLangProxyErrorHandler) {
			window.BoxLangProxyErrorHandler = function (error, context = {}) {
				console.error("BoxLang Proxy Error:", error, context);

				// Dispatch global error event
				const errorEvent = new CustomEvent("boxlang-proxy-error", {
					detail: { error: error, context: context },
					bubbles: true,
				});
				document.dispatchEvent(errorEvent);
			};
		}
	}

	// Initialize AJAX proxy enhancements
	function initAjaxProxy() {
		enhanceProxyForms();
		executePageBinds();
		setupPeriodicBinds();
		setupProxyErrorHandling();
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initAjaxProxy);
	} else {
		initAjaxProxy();
	}

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
			var formData = new FormData();
			formData.append("method", methodName);
			formData.append("cfc", proxyObj.cfcPath || "");
			if (token) formData.append("_cf_ajaxproxytoken", token);

			if (args) {
				formData.append(
					"argumentCollection",
					window.BXUICompat.JSON.encode(args),
				);
			}

			return BoxLangAjax.utils
				.fetchContent(proxyObj.cfcPath || "/index.cfm", {
					method: "POST",
					body: formData,
					headers: { "X-Requested-With": "XMLHttpRequest" },
				})
				.then(function (data) {
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
