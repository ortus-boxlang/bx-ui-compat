/**
 * BoxLang Div Component AJAX JavaScript
 * Enhanced AJAX functionality for div components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// Div-specific AJAX utilities
	BoxLangAjax.components.div = {
		/**
		 * Refresh a div with optional parameters
		 */
		refresh: function (divId, params = {}) {
			const div = document.getElementById(divId);
			if (!div) {
				console.error("Div not found: " + divId);
				return Promise.reject(new Error("Div not found: " + divId));
			}

			let url = div.dataset.source || div.dataset.refreshUrl;
			if (!url) {
				console.error("No refresh URL found for div: " + divId);
				return Promise.reject(new Error("No refresh URL found"));
			}

			// Append parameters to URL
			if (Object.keys(params).length > 0) {
				const urlParams = new URLSearchParams(params);
				url += (url.includes("?") ? "&" : "?") + urlParams.toString();
			}

			return BoxLangAjax.utils.loadIntoContainer(divId, url);
		},

		/**
		 * Set up auto-refresh for a div
		 */
		autoRefresh: function (divId, interval) {
			const div = document.getElementById(divId);
			if (!div) {
				console.error("Div not found for auto-refresh: " + divId);
				return;
			}

			const url = div.dataset.source || div.dataset.refreshUrl;
			if (!url) {
				console.error(
					"No refresh URL found for auto-refresh div: " + divId,
				);
				return;
			}

			// Stop existing auto-refresh (uses shared utility)
			this.stopAutoRefresh(divId);

			div.classList.add("bx-auto-refreshing");
			return BoxLangAjax.utils.autoRefresh(divId, url, interval);
		},

		/**
		 * Stop auto-refresh for a div
		 */
		stopAutoRefresh: function (divId) {
			BoxLangAjax.utils.stopAutoRefresh(divId);
			const div = document.getElementById(divId);
			if (div) {
				div.classList.remove("bx-auto-refreshing");
				delete div.dataset.refreshIntervals;
			}
		},

		/**
		 * Load content into div with loading overlay
		 */
		loadWithOverlay: function (divId, url, options = {}) {
			const div = document.getElementById(divId);
			if (!div) {
				console.error("Div not found: " + divId);
				return Promise.reject(new Error("Div not found: " + divId));
			}

			// Create overlay
			const overlay = document.createElement("div");
			overlay.className = "bx-ajax-overlay";
			overlay.innerHTML =
				options.loadingTemplate ||
				'<div class="bx-loading">Loading...</div>';

			// Position overlay
			const currentPosition = getComputedStyle(div).position;
			if (currentPosition === "static") {
				div.style.position = "relative";
			}

			div.appendChild(overlay);

			return BoxLangAjax.utils
				.fetchContent(url, options)
				.then(function (content) {
					div.removeChild(overlay);
					div.innerHTML = content;
					div.classList.add("bx-source-loaded");

					// Execute scripts in loaded content
					BoxLangAjax.utils.executeScripts(div);

					// Trigger loaded event
					const event = new CustomEvent("div-loaded", {
						detail: { divId: divId, url: url, content: content },
						bubbles: true,
					});
					div.dispatchEvent(event);

					return content;
				})
				.catch(function (error) {
					div.removeChild(overlay);

					var esc = BoxLangAjax.utils.escapeHTML;
					const errorHtml =
						options.errorTemplate ||
						`<div class="bx-source-error">
                            <div class="bx-error-title">Failed to load content</div>
                            <div class="bx-error-message">${esc(error.message)}</div>
                            <div class="bx-error-retry">
                                <button type="button" class="bx-retry-button">
                                    Retry
                                </button>
                            </div>
                        </div>`;

					div.innerHTML = errorHtml;
					div.classList.add("bx-source-error");

					// Attach retry handler via addEventListener (no inline onclick)
					var retryBtn = div.querySelector(".bx-retry-button");
					if (retryBtn) {
						retryBtn.addEventListener("click", function () {
							BoxLangAjax.components.div.loadWithOverlay(
								divId,
								url,
								options,
							);
						});
					}

					// Trigger error event
					const errorEvent = new CustomEvent("div-error", {
						detail: { divId: divId, url: url, error: error },
						bubbles: true,
					});
					div.dispatchEvent(errorEvent);

					throw error;
				});
		},

		/**
		 * Append content to existing div content
		 */
		appendContent: function (divId, url, options = {}) {
			const div = document.getElementById(divId);
			if (!div) {
				console.error("Div not found: " + divId);
				return Promise.reject(new Error("Div not found: " + divId));
			}

			const loadingIndicator = document.createElement("div");
			loadingIndicator.className = "bx-loading bx-append-loading";
			loadingIndicator.textContent = "Loading more...";
			div.appendChild(loadingIndicator);

			return BoxLangAjax.utils
				.fetchContent(url, options)
				.then(function (content) {
					div.removeChild(loadingIndicator);

					// Create temporary container to parse content
					const tempDiv = document.createElement("div");
					tempDiv.innerHTML = content;

					// Append child nodes
					while (tempDiv.firstChild) {
						div.appendChild(tempDiv.firstChild);
					}

					// Execute scripts in appended content
					BoxLangAjax.utils.executeScripts(div);

					return content;
				})
				.catch(function (error) {
					loadingIndicator.textContent = "Error loading content";
					loadingIndicator.className =
						"bx-source-error bx-append-error";

					setTimeout(function () {
						if (div.contains(loadingIndicator)) {
							div.removeChild(loadingIndicator);
						}
					}, 3000);

					throw error;
				});
		},
	};

	// Enhanced div event handling for AJAX
	function enhanceDivEvents() {
		// Set up click handlers for divs with data-click-url
		document.addEventListener("click", function (event) {
			const div = event.target.closest(".bx-div[data-click-url]");
			if (div) {
				event.preventDefault();
				const url = div.dataset.clickUrl;
				if (url && div.id) {
					BoxLangAjax.utils.loadIntoContainer(div.id, url);
				}
			}
		});

		// Set up hover handlers for divs with data-hover-url
		document.addEventListener(
			"mouseenter",
			function (event) {
				var target = event.target;
				if (!target || !target.closest) return;
				const div = target.closest(".bx-div[data-hover-url]");
				if (div && !div.dataset.hoverLoaded) {
					const url = div.dataset.hoverUrl;
					const delay = parseInt(div.dataset.hoverDelay) || 500;

					if (url && div.id) {
						setTimeout(function () {
							if (div.matches(":hover")) {
								BoxLangAjax.utils
									.loadIntoContainer(div.id, url)
									.then(function () {
										div.dataset.hoverLoaded = "true";
									});
							}
						}, delay);
					}
				}
			},
			true,
		);
	}

	// Auto-load content for divs with data-source
	function autoLoadDivContent() {
		document
			.querySelectorAll(".bx-div[data-source]")
			.forEach(function (div) {
				const url = div.dataset.source;
				const delay = parseInt(div.dataset.loadDelay) || 0;
				const loadType = div.dataset.loadType || "replace";

				if (url && div.id) {
					setTimeout(function () {
						if (loadType === "overlay") {
							BoxLangAjax.components.div.loadWithOverlay(
								div.id,
								url,
							);
						} else {
							BoxLangAjax.utils.loadIntoContainer(div.id, url);
						}
					}, delay);
				}
			});
	}

	// Set up auto-refresh for divs
	function setupAutoRefresh() {
		document
			.querySelectorAll(".bx-div[data-refresh-interval]")
			.forEach(function (div) {
				const interval = parseInt(div.dataset.refreshInterval) * 1000; // Convert to milliseconds
				const url = div.dataset.source || div.dataset.refreshUrl;

				if (url && div.id && interval > 0) {
					BoxLangAjax.components.div.autoRefresh(div.id, interval);
				}
			});
	}

	// Initialize div AJAX enhancements
	function initDivAjax() {
		enhanceDivEvents();
		autoLoadDivContent();
		setupAutoRefresh();

		// Set up manual refresh buttons
		document
			.querySelectorAll("[data-refresh-target]")
			.forEach(function (button) {
				button.addEventListener("click", function () {
					const targetId = button.dataset.refreshTarget;
					const params = {};

					// Collect parameters from data attributes
					Object.keys(button.dataset).forEach(function (key) {
						if (key.startsWith("param")) {
							const paramName = key.substring(5).toLowerCase();
							params[paramName] = button.dataset[key];
						}
					});

					BoxLangAjax.components.div
						.refresh(targetId, params)
						.catch(function (error) {
							console.error("Manual refresh failed:", error);
						});
				});
			});

		// Set up load more buttons
		document
			.querySelectorAll("[data-load-more-target]")
			.forEach(function (button) {
				button.addEventListener("click", function () {
					const targetId = button.dataset.loadMoreTarget;
					const url = button.dataset.loadMoreUrl;

					if (targetId && url) {
						BoxLangAjax.components.div
							.appendContent(targetId, url)
							.then(function () {
								// Optionally hide or update the button
								if (button.dataset.hideAfterLoad === "true") {
									button.style.display = "none";
								}
							})
							.catch(function (error) {
								console.error("Load more failed:", error);
							});
					}
				});
			});
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initDivAjax);
	} else {
		initDivAjax();
	}

	// -------------------------------------------------------------------
	// BXUICompat.Div facade
	// -------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.Div = {
		refresh: function (divId, params) {
			return BoxLangAjax.components.div.refresh(divId, params);
		},
		load: function (divId, url) {
			return BoxLangAjax.components.div.loadWithOverlay(divId, url);
		},
		appendContent: function (divId, url) {
			return BoxLangAjax.components.div.appendContent(divId, url);
		},
		stopRefresh: function (divId) {
			return BoxLangAjax.components.div.stopAutoRefresh(divId);
		},
	};
})();
