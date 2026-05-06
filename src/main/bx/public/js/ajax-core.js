/**
 * BoxLang AJAX Core JavaScript
 * Core functionality for AJAX operations using the Fetch API
 */

// Ensure BoxLang AJAX namespace exists
window.BoxLangAjax = window.BoxLangAjax || {
	version: "1.0.0",
	config: {
		cssSrc: "/bx-ui-compat/css",
		scriptSrc: "/bx-ui-compat/js",
		defaultTimeout: 30000,
		retryAttempts: 3,
		retryDelay: 1000,
	},
	utils: {},
	components: {},
	cache: new Map(),
};

/**
 * Enhanced Fetch API wrapper with retry logic and error handling
 */
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

	// Add cache control headers if not specified
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
			// Create AbortController for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(
				() => controller.abort(),
				fetchOptions.timeout,
			);

			fetchOptions.signal = controller.signal;

			const response = await fetch(url, fetchOptions);
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

			// Cache successful responses if cacheable
			if (response.headers.get("cache-control") !== "no-cache") {
				BoxLangAjax.cache.set(url, {
					data: result,
					timestamp: Date.now(),
					contentType: contentType,
				});
			}

			return result;
		} catch (error) {
			lastError = error;

			// Don't retry on abort (user cancelled) or client errors (4xx)
			if (
				error.name === "AbortError" ||
				(error.message && error.message.includes("4"))
			) {
				break;
			}

			// Wait before retry (exponential backoff)
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
 * Load content into a specific container element
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

	// Show loading indicator
	const originalContent = container.innerHTML;
	const loadingHtml =
		options.loadingTemplate || '<div class="bx-loading">Loading...</div>';
	container.innerHTML = loadingHtml;

	// Add loading class for CSS styling
	container.classList.add("bx-loading");

	return BoxLangAjax.utils
		.fetchContent(url, options)
		.then(function (content) {
			container.innerHTML = content;
			container.classList.remove("bx-loading");
			container.classList.add("bx-source-loaded");

			// Trigger custom event for loaded content
			const event = new CustomEvent("boxlang-content-loaded", {
				detail: {
					url: url,
					container: containerId,
					content: content,
				},
				bubbles: true,
			});
			container.dispatchEvent(event);

			// Execute any scripts in the loaded content
			BoxLangAjax.utils.executeScripts(container);

			return content;
		})
		.catch(function (error) {
			const errorTemplate =
				options.errorTemplate ||
				`<div class="bx-source-error">
                    <div class="bx-error-title">Error loading content</div>
                    <div class="bx-error-message">${error.message}</div>
                    <div class="bx-error-retry">
                        <button type="button" class="bx-retry-button" onclick="BoxLangAjax.utils.loadIntoContainer('${containerId}', '${url}', ${JSON.stringify(
							options,
						).replace(/'/g, "\\'")})">
                            Retry
                        </button>
                    </div>
                </div>`;

			container.innerHTML = errorTemplate;
			container.classList.remove("bx-loading");
			container.classList.add("bx-source-error");

			// Trigger error event
			const errorEvent = new CustomEvent("boxlang-content-error", {
				detail: {
					url: url,
					container: containerId,
					error: error,
				},
				bubbles: true,
			});
			container.dispatchEvent(errorEvent);

			throw error;
		});
};

/**
 * Handle AJAX links - finds the nearest AJAX container and loads content
 */
BoxLangAjax.utils.handleAjaxLink = function (url, event) {
	if (event) {
		event.preventDefault();
	}

	// Find the nearest AJAX container (div with bx-* class or specific containers)
	let currentElement = event ? event.target : null;
	let container = null;

	// Search up the DOM tree for a suitable container
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
		// If no suitable container found, try to find the first available one
		container =
			document.querySelector(".bx-layout, .bx-div, .bx-pod, [id]") ||
			document.body;
	}

	// Load content into the container
	if (container.id) {
		return BoxLangAjax.utils.loadIntoContainer(container.id, url);
	} else {
		// If container has no ID, generate one
		const containerId = "bx-ajax-container-" + Date.now();
		container.id = containerId;
		return BoxLangAjax.utils.loadIntoContainer(containerId, url);
	}
};

/**
 * Execute JavaScript code found in loaded content
 */
BoxLangAjax.utils.executeScripts = function (container) {
	const scripts = container.querySelectorAll("script");
	scripts.forEach(function (script) {
		if (script.src) {
			// External script
			const newScript = document.createElement("script");
			newScript.src = script.src;
			newScript.async = false;
			document.head.appendChild(newScript);
		} else if (script.textContent) {
			// Inline script
			try {
				eval(script.textContent);
			} catch (error) {
				console.error("Error executing loaded script:", error);
			}
		}
	});
};

/**
 * Form submission with AJAX
 */
BoxLangAjax.utils.submitForm = function (form, targetContainer) {
	const formData = new FormData(form);
	const url = form.action || window.location.href;
	const method = (form.method || "POST").toUpperCase();

	const options = {
		method: method,
		headers: {
			"X-Requested-With": "XMLHttpRequest",
		},
	};

	if (method === "POST") {
		options.body = formData;
	} else {
		// For GET requests, append form data to URL
		const params = new URLSearchParams(formData);
		const separator = url.includes("?") ? "&" : "?";
		const getUrl = url + separator + params.toString();
		return BoxLangAjax.utils.loadIntoContainer(targetContainer, getUrl);
	}

	return BoxLangAjax.utils.loadIntoContainer(targetContainer, url, options);
};

/**
 * Auto-refresh functionality
 */
BoxLangAjax.utils.autoRefresh = function (containerId, url, interval) {
	const container = document.getElementById(containerId);
	if (!container) {
		console.error("Auto-refresh container not found: " + containerId);
		return;
	}

	const refreshFn = function () {
		if (document.contains(container)) {
			BoxLangAjax.utils
				.loadIntoContainer(containerId, url)
				.catch(function (error) {
					console.error("Auto-refresh failed:", error);
				});
		} else {
			// Container no longer in DOM, stop refreshing
			clearInterval(refreshInterval);
		}
	};

	const refreshInterval = setInterval(refreshFn, interval);

	// Store interval ID for potential cleanup
	if (!container.dataset.refreshIntervals) {
		container.dataset.refreshIntervals = "";
	}
	container.dataset.refreshIntervals += refreshInterval + ",";

	return refreshInterval;
};

/**
 * Initialize BoxLang AJAX on DOM ready
 */
function initBoxLangAjax() {
	// Set up global error handling
	window.addEventListener("unhandledrejection", function (event) {
		if (
			event.reason &&
			event.reason.message &&
			event.reason.message.includes("BoxLang AJAX")
		) {
			console.error("Unhandled BoxLang AJAX error:", event.reason);
		}
	});

	// Initialize auto-refresh elements
	document
		.querySelectorAll("[data-refresh-url][data-refresh-interval]")
		.forEach(function (element) {
			const url = element.dataset.refreshUrl;
			const interval = parseInt(element.dataset.refreshInterval) * 1000; // Convert to milliseconds
			if (element.id && url && interval > 0) {
				BoxLangAjax.utils.autoRefresh(element.id, url, interval);
			}
		});

	// Initialize AJAX forms
	document
		.querySelectorAll("form[data-ajax-target]")
		.forEach(function (form) {
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				const targetContainer = form.dataset.ajaxTarget;
				BoxLangAjax.utils.submitForm(form, targetContainer);
			});
		});

	console.log("BoxLang AJAX initialized successfully");
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initBoxLangAjax);
} else {
	initBoxLangAjax();
}
