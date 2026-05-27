/**
 * BoxLang Tooltip Component AJAX JavaScript
 * Enhanced AJAX functionality for tooltip components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// Tooltip-specific AJAX utilities
	BoxLangAjax.components.tooltip = {
		/** @type {Map<string, AbortController>} Track in-flight tooltip fetches */
		_controllers: new Map(),

		/**
		 * Load content for a tooltip
		 */
		loadContent: function (tooltipId, url) {
			const tooltip = document.getElementById(tooltipId);
			if (!tooltip) {
				console.error("Tooltip not found: " + tooltipId);
				return Promise.reject(
					new Error("Tooltip not found: " + tooltipId),
				);
			}

			// Cancel any previous in-flight fetch for this tooltip
			var prevController = this._controllers.get(tooltipId);
			if (prevController) prevController.abort();
			var controller = new AbortController();
			this._controllers.set(tooltipId, controller);

			// Show loading state
			tooltip.innerHTML = '<div class="bx-loading">Loading...</div>';
			tooltip.classList.add("bx-ajax-loading");

			return BoxLangAjax.utils
				.fetchContent(url, {
					timeout: 10000,
					signal: controller.signal,
				})
				.then(function (content) {
					tooltip.innerHTML = content;
					tooltip.classList.remove("bx-ajax-loading");
					tooltip.classList.add("bx-ajax-loaded");

					// Reposition tooltip after content loads
					BoxLangAjax.components.tooltip.reposition(tooltipId);

					// Trigger loaded event
					const event = new CustomEvent("tooltip-loaded", {
						detail: {
							tooltipId: tooltipId,
							url: url,
							content: content,
						},
						bubbles: true,
					});
					tooltip.dispatchEvent(event);

					return content;
				})
				.catch(function (error) {
					// Silently ignore aborted requests (tooltip was hidden)
					if (error.name === "AbortError") return;

					var esc = BoxLangAjax.utils.escapeHTML;
					tooltip.innerHTML = `<div class="bx-source-error">Error: ${esc(error.message)}</div>`;
					tooltip.classList.remove("bx-ajax-loading");
					tooltip.classList.add("bx-ajax-error");

					// Trigger error event
					const errorEvent = new CustomEvent("tooltip-error", {
						detail: {
							tooltipId: tooltipId,
							url: url,
							error: error,
						},
						bubbles: true,
					});
					tooltip.dispatchEvent(errorEvent);

					throw error;
				});
		},

		/**
		 * Reposition tooltip (called after content loads)
		 */
		reposition: function (tooltipId) {
			const tooltip = document.getElementById(tooltipId);
			if (!tooltip || !tooltip.classList.contains("bx-tooltip-visible"))
				return;

			const trigger = tooltip.trigger; // Assume trigger is stored during show
			if (!trigger) return;

			const triggerRect = trigger.getBoundingClientRect();
			const tooltipRect = tooltip.getBoundingClientRect();

			let left =
				triggerRect.left +
				triggerRect.width / 2 -
				tooltipRect.width / 2;
			let top = triggerRect.bottom + 5;

			// Adjust for viewport boundaries
			if (left < 5) left = 5;
			if (left + tooltipRect.width > window.innerWidth - 5) {
				left = window.innerWidth - tooltipRect.width - 5;
			}

			if (top + tooltipRect.height > window.innerHeight - 5) {
				top = triggerRect.top - tooltipRect.height - 5; // Show above instead
			}

			tooltip.style.left = left + window.pageXOffset + "px";
			tooltip.style.top = top + window.pageYOffset + "px";
		},

		/**
		 * Show tooltip with optional AJAX content loading
		 */
		show: function (triggerId, tooltipId, url = null) {
			const trigger = document.getElementById(triggerId);
			const tooltip = document.getElementById(tooltipId);

			if (!trigger || !tooltip) {
				console.error(
					"Trigger or tooltip not found:",
					triggerId,
					tooltipId,
				);
				return Promise.reject(new Error("Elements not found"));
			}

			// Store trigger reference for repositioning
			tooltip.trigger = trigger;

			// Show tooltip
			tooltip.style.display = "block";
			tooltip.classList.add("bx-tooltip-visible");

			// Position initially
			this.reposition(tooltipId);

			// Load content if URL provided
			if (url) {
				return this.loadContent(tooltipId, url);
			}

			return Promise.resolve();
		},

		/**
		 * Hide tooltip and abort any in-flight fetch
		 */
		hide: function (tooltipId, delay = 300) {
			const tooltip = document.getElementById(tooltipId);
			if (!tooltip) return;

			// Abort any in-flight content fetch
			var controller = this._controllers.get(tooltipId);
			if (controller) {
				controller.abort();
				this._controllers.delete(tooltipId);
			}

			setTimeout(function () {
				tooltip.style.display = "none";
				tooltip.classList.remove("bx-tooltip-visible");
				tooltip.trigger = null;
			}, delay);
		},

		/**
		 * Set up hover behavior for AJAX tooltips
		 */
		setupHover: function (triggerId, tooltipId, url, options = {}) {
			const trigger = document.getElementById(triggerId);
			if (!trigger) {
				console.error("Trigger not found for hover setup:", triggerId);
				return;
			}

			const showDelay = options.showDelay || 500;
			const hideDelay = options.hideDelay || 300;
			let showTimer = null;
			let hideTimer = null;

			trigger.addEventListener("mouseenter", function () {
				clearTimeout(hideTimer);

				showTimer = setTimeout(function () {
					BoxLangAjax.components.tooltip.show(
						triggerId,
						tooltipId,
						url,
					);
				}, showDelay);
			});

			trigger.addEventListener("mouseleave", function () {
				clearTimeout(showTimer);

				hideTimer = setTimeout(function () {
					BoxLangAjax.components.tooltip.hide(tooltipId, hideDelay);
				}, hideDelay);
			});

			// Keep tooltip visible when hovering over it
			const tooltip = document.getElementById(tooltipId);
			if (tooltip) {
				tooltip.addEventListener("mouseenter", function () {
					clearTimeout(hideTimer);
				});

				tooltip.addEventListener("mouseleave", function () {
					hideTimer = setTimeout(function () {
						BoxLangAjax.components.tooltip.hide(
							tooltipId,
							hideDelay,
						);
					}, hideDelay);
				});
			}
		},

		/**
		 * Set up click behavior for AJAX tooltips
		 */
		setupClick: function (triggerId, tooltipId, url) {
			const trigger = document.getElementById(triggerId);
			if (!trigger) {
				console.error("Trigger not found for click setup:", triggerId);
				return;
			}

			trigger.addEventListener("click", function (event) {
				event.preventDefault();

				const tooltip = document.getElementById(tooltipId);
				if (
					tooltip &&
					tooltip.classList.contains("bx-tooltip-visible")
				) {
					BoxLangAjax.components.tooltip.hide(tooltipId);
				} else {
					BoxLangAjax.components.tooltip.show(
						triggerId,
						tooltipId,
						url,
					);
				}
			});
		},

		/**
		 * Refresh tooltip content
		 */
		refresh: function (tooltipId) {
			const tooltip = document.getElementById(tooltipId);
			if (!tooltip) return;

			const url = tooltip.dataset.source || tooltip.dataset.refreshUrl;
			if (!url) {
				console.error("No refresh URL found for tooltip:", tooltipId);
				return Promise.reject(new Error("No refresh URL found"));
			}

			return this.loadContent(tooltipId, url);
		},
	};

	// Auto-setup tooltips with AJAX functionality
	function setupAjaxTooltips() {
		// Setup hover tooltips
		document
			.querySelectorAll("[data-tooltip-hover][data-tooltip-source]")
			.forEach(function (trigger) {
				const tooltipId = trigger.dataset.tooltipHover;
				const url = trigger.dataset.tooltipSource;
				const showDelay =
					parseInt(trigger.dataset.tooltipShowDelay) || 500;
				const hideDelay =
					parseInt(trigger.dataset.tooltipHideDelay) || 300;

				if (tooltipId && url && trigger.id) {
					BoxLangAjax.components.tooltip.setupHover(
						trigger.id,
						tooltipId,
						url,
						{
							showDelay: showDelay,
							hideDelay: hideDelay,
						},
					);
				}
			});

		// Setup click tooltips
		document
			.querySelectorAll("[data-tooltip-click][data-tooltip-source]")
			.forEach(function (trigger) {
				const tooltipId = trigger.dataset.tooltipClick;
				const url = trigger.dataset.tooltipSource;

				if (tooltipId && url && trigger.id) {
					BoxLangAjax.components.tooltip.setupClick(
						trigger.id,
						tooltipId,
						url,
					);
				}
			});

		// Setup auto-refresh tooltips
		document
			.querySelectorAll(".bx-tooltip[data-refresh-interval]")
			.forEach(function (tooltip) {
				const interval =
					parseInt(tooltip.dataset.refreshInterval) * 1000;
				const url =
					tooltip.dataset.source || tooltip.dataset.refreshUrl;

				if (url && tooltip.id && interval > 0) {
					setInterval(function () {
						if (tooltip.classList.contains("bx-tooltip-visible")) {
							BoxLangAjax.components.tooltip
								.refresh(tooltip.id)
								.catch(function (error) {
									console.error(
										"Tooltip auto-refresh failed:",
										error,
									);
								});
						}
					}, interval);
				}
			});
	}

	// Handle responsive behavior for tooltips
	function handleResponsiveTooltips() {
		// Convert tooltips to modal-style on small screens
		function checkScreenSize() {
			const isMobile = window.innerWidth <= 768;

			document
				.querySelectorAll(".bx-tooltip")
				.forEach(function (tooltip) {
					if (isMobile) {
						tooltip.classList.add("bx-tooltip-mobile");
					} else {
						tooltip.classList.remove("bx-tooltip-mobile");
					}
				});
		}

		checkScreenSize();
		window.addEventListener("resize", checkScreenSize);
	}

	// Handle keyboard accessibility
	function setupTooltipAccessibility() {
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") {
				// Close all visible tooltips
				document
					.querySelectorAll(".bx-tooltip-visible")
					.forEach(function (tooltip) {
						if (tooltip.id) {
							BoxLangAjax.components.tooltip.hide(tooltip.id);
						}
					});
			}
		});

		// Focus management for keyboard navigation
		document
			.querySelectorAll("[data-tooltip-hover], [data-tooltip-click]")
			.forEach(function (trigger) {
				if (!trigger.hasAttribute("tabindex")) {
					trigger.setAttribute("tabindex", "0");
				}

				trigger.addEventListener("keydown", function (event) {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						const tooltipId =
							trigger.dataset.tooltipClick ||
							trigger.dataset.tooltipHover;
						const url = trigger.dataset.tooltipSource;

						if (tooltipId && url && trigger.id) {
							BoxLangAjax.components.tooltip.show(
								trigger.id,
								tooltipId,
								url,
							);
						}
					}
				});
			});
	}

	// Initialize tooltip AJAX enhancements
	function initTooltipAjax() {
		setupAjaxTooltips();
		handleResponsiveTooltips();
		setupTooltipAccessibility();

		// Close tooltips when clicking outside
		document.addEventListener("click", function (event) {
			if (
				!event.target.closest(".bx-tooltip") &&
				!event.target.closest("[data-tooltip-click]")
			) {
				document
					.querySelectorAll(".bx-tooltip-visible")
					.forEach(function (tooltip) {
						if (tooltip.id) {
							BoxLangAjax.components.tooltip.hide(tooltip.id);
						}
					});
			}
		});

		console.log("BoxLang Tooltip AJAX enhancements initialized");
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initTooltipAjax);
	} else {
		initTooltipAjax();
	}

	// -------------------------------------------------------------------
	// BXUICompat.Tooltip facade
	// -------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.Tooltip = {
		loadContent: function (tooltipId, url) {
			return BoxLangAjax.components.tooltip.loadContent(tooltipId, url);
		},
	};
})();
