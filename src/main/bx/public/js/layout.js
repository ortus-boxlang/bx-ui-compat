/**
 * BoxLang Layout Component AJAX JavaScript
 * Enhanced AJAX functionality for layout components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// Layout-specific AJAX utilities
	BoxLangAjax.components.layout = {
		/**
		 * Load content into a specific layout area
		 */
		loadIntoArea: function (layoutId, areaIndex, url, options = {}) {
			const layout = document.getElementById(layoutId);
			if (!layout) {
				console.error("Layout not found: " + layoutId);
				return Promise.reject(
					new Error("Layout not found: " + layoutId),
				);
			}

			let targetArea;

			if (layout.classList.contains("bx-layout-tab")) {
				const panels = layout.querySelectorAll(".bx-tab-panel");
				targetArea = panels[areaIndex] || panels[0];
			} else if (layout.classList.contains("bx-layout-accordion")) {
				const contents = layout.querySelectorAll(
					".bx-accordion-content",
				);
				targetArea = contents[areaIndex] || contents[0];
			} else {
				// For border and box layouts, find by data attribute or class
				targetArea =
					layout.querySelector(`[data-area-index="${areaIndex}"]`) ||
					layout.querySelector(
						".bx-box-item:nth-child(" + (areaIndex + 1) + ")",
					) ||
					layout.querySelector(".bx-border-center");
			}

			if (!targetArea) {
				console.error("Layout area not found at index: " + areaIndex);
				return Promise.reject(new Error("Layout area not found"));
			}

			// Ensure area has an ID for loading
			if (!targetArea.id) {
				targetArea.id =
					layoutId + "_area_" + areaIndex + "_" + Date.now();
			}

			return BoxLangAjax.utils.loadIntoContainer(
				targetArea.id,
				url,
				options,
			);
		},

		/**
		 * Refresh all layout areas that have data sources
		 */
		refreshAll: function (layoutId) {
			const layout = document.getElementById(layoutId);
			if (!layout) {
				console.error("Layout not found: " + layoutId);
				return Promise.reject(
					new Error("Layout not found: " + layoutId),
				);
			}

			const promises = [];
			const areasWithSources = layout.querySelectorAll("[data-source]");

			areasWithSources.forEach(function (area) {
				const url = area.dataset.source;
				if (url && area.id) {
					promises.push(
						BoxLangAjax.utils.loadIntoContainer(area.id, url),
					);
				}
			});

			return Promise.allSettled(promises);
		},

		/**
		 * Switch to a tab and optionally load content
		 */
		switchTab: function (layoutId, tabIndex, url = null) {
			const layout = document.getElementById(layoutId);
			if (!layout || !layout.classList.contains("bx-layout-tab")) {
				console.error("Tab layout not found: " + layoutId);
				return Promise.reject(new Error("Tab layout not found"));
			}

			const headers = layout.querySelectorAll(".bx-tab-header");
			const panels = layout.querySelectorAll(".bx-tab-panel");

			if (tabIndex >= headers.length || tabIndex >= panels.length) {
				console.error("Tab index out of range: " + tabIndex);
				return Promise.reject(new Error("Tab index out of range"));
			}

			// Hide all panels and deactivate headers
			headers.forEach((h) => h.classList.remove("active"));
			panels.forEach((p) => p.classList.remove("active"));

			// Activate selected tab
			headers[tabIndex].classList.add("active");
			panels[tabIndex].classList.add("active");

			// Load content if URL provided
			if (url && panels[tabIndex].id) {
				return BoxLangAjax.utils.loadIntoContainer(
					panels[tabIndex].id,
					url,
				);
			}

			return Promise.resolve();
		},

		/**
		 * Toggle accordion panel and optionally load content
		 */
		toggleAccordion: function (layoutId, panelIndex, url = null) {
			const layout = document.getElementById(layoutId);
			if (!layout || !layout.classList.contains("bx-layout-accordion")) {
				console.error("Accordion layout not found: " + layoutId);
				return Promise.reject(new Error("Accordion layout not found"));
			}

			const panels = layout.querySelectorAll(".bx-accordion-panel");

			if (panelIndex >= panels.length) {
				console.error(
					"Accordion panel index out of range: " + panelIndex,
				);
				return Promise.reject(new Error("Panel index out of range"));
			}

			const panel = panels[panelIndex];
			const content = panel.querySelector(".bx-accordion-content");

			// Toggle collapsed state
			panel.classList.toggle("collapsed");

			// Load content if URL provided and panel is being expanded
			if (
				url &&
				!panel.classList.contains("collapsed") &&
				content &&
				content.id
			) {
				return BoxLangAjax.utils.loadIntoContainer(content.id, url);
			}

			return Promise.resolve();
		},

		/**
		 * Find a titled area wrapper by area id within a layout.
		 *
		 * Looks for either a `.bx-accordion-panel` (accordion layout) or a
		 * `.bx-border-area` (border layout) whose first child header carries
		 * the matching `data-area-id` attribute. Returns null when not found
		 * or when the area is locked (`collapsible="false"`).
		 */
		_findAreaElement: function (layout, areaId) {
			if (!layout || !areaId) {
				return null;
			}
			const headers = layout.querySelectorAll(
				".bx-accordion-header, .bx-border-title",
			);
			for (let i = 0; i < headers.length; i++) {
				if (headers[i].getAttribute("data-area-id") === areaId) {
					return headers[i].parentNode;
				}
			}
			return null;
		},

		/**
		 * Collapse a titled area by id. No-op on locked (`collapsible="false"`)
		 * areas.
		 *
		 * @param {string} layoutId Layout container id
		 * @param {string} areaId   Area id (the value of `id` on `<bx:layoutarea>`)
		 * @returns {boolean} true if the area was collapsed, false otherwise
		 */
		collapseArea: function (layoutId, areaId) {
			const layout = document.getElementById(layoutId);
			const area = BoxLangAjax.components.layout._findAreaElement(
				layout,
				areaId,
			);
			if (!area) {
				console.error(
					"Layout area not found: " + layoutId + " / " + areaId,
				);
				return false;
			}
			if (area.classList.contains("bx-accordion-panel-locked")) {
				return false;
			}
			area.classList.add("collapsed");
			return true;
		},

		/**
		 * Expand a titled area by id. No-op on locked (`collapsible="false"`)
		 * areas.
		 *
		 * @param {string} layoutId Layout container id
		 * @param {string} areaId   Area id (the value of `id` on `<bx:layoutarea>`)
		 * @returns {boolean} true if the area was expanded, false otherwise
		 */
		expandArea: function (layoutId, areaId) {
			const layout = document.getElementById(layoutId);
			const area = BoxLangAjax.components.layout._findAreaElement(
				layout,
				areaId,
			);
			if (!area) {
				console.error(
					"Layout area not found: " + layoutId + " / " + areaId,
				);
				return false;
			}
			if (area.classList.contains("bx-accordion-panel-locked")) {
				return false;
			}
			area.classList.remove("collapsed");
			return true;
		},

		/**
		 * Toggle a titled area's collapsed state by id. No-op on locked panels.
		 */
		toggleArea: function (layoutId, areaId) {
			const layout = document.getElementById(layoutId);
			const area = BoxLangAjax.components.layout._findAreaElement(
				layout,
				areaId,
			);
			if (!area) {
				console.error(
					"Layout area not found: " + layoutId + " / " + areaId,
				);
				return false;
			}
			if (area.classList.contains("bx-accordion-panel-locked")) {
				return false;
			}
			area.classList.toggle("collapsed");
			return true;
		},
	};

	// Enhanced layout event handling for AJAX
	function enhanceLayoutEvents() {
		// Tab layout AJAX enhancement
		document.querySelectorAll(".bx-layout-tab").forEach(function (layout) {
			layout.addEventListener("click", function (event) {
				if (event.target.classList.contains("bx-tab-header")) {
					const ajaxUrl = event.target.dataset.ajaxUrl;
					const tabId = event.target.getAttribute("data-tab");

					if (ajaxUrl && tabId) {
						event.preventDefault();

						// Find tab index
						const headers = Array.from(
							layout.querySelectorAll(".bx-tab-header"),
						);
						const tabIndex = headers.indexOf(event.target);

						BoxLangAjax.components.layout
							.switchTab(layout.id, tabIndex, ajaxUrl)
							.catch(function (error) {
								console.error(
									"Failed to load tab content:",
									error,
								);
							});
					}
				}
			});
		});

		// Accordion layout AJAX enhancement
		document
			.querySelectorAll(".bx-layout-accordion")
			.forEach(function (layout) {
				layout.addEventListener("click", function (event) {
					if (
						event.target.classList.contains("bx-accordion-header")
					) {
						const panel = event.target.parentNode;
						const ajaxUrl = panel.dataset.ajaxUrl;

						if (ajaxUrl) {
							event.preventDefault();

							// Find panel index
							const panels = Array.from(
								layout.querySelectorAll(".bx-accordion-panel"),
							);
							const panelIndex = panels.indexOf(panel);

							BoxLangAjax.components.layout
								.toggleAccordion(layout.id, panelIndex, ajaxUrl)
								.catch(function (error) {
									console.error(
										"Failed to load accordion content:",
										error,
									);
								});
						}
					}
				});
			});
	}

	// Auto-load content for layout areas with data-source
	function autoLoadLayoutContent() {
		document
			.querySelectorAll(".bx-layout [data-source]:not(.bx-grid)")
			.forEach(function (area) {
				const url = area.dataset.source;
				const delay = parseInt(area.dataset.loadDelay) || 0;

				if (url && area.id) {
					setTimeout(function () {
						BoxLangAjax.utils
							.loadIntoContainer(area.id, url)
							.catch(function (error) {
								console.error(
									"Failed to auto-load layout content:",
									error,
								);
							});
					}, delay);
				}
			});
	}

	// Initialize layout AJAX enhancements
	function initLayoutAjax() {
		enhanceLayoutEvents();
		autoLoadLayoutContent();

		// Set up refresh buttons for layouts
		document
			.querySelectorAll(".bx-layout [data-refresh-button]")
			.forEach(function (button) {
				button.addEventListener("click", function () {
					const layoutId = button.closest(".bx-layout").id;
					if (layoutId) {
						BoxLangAjax.components.layout.refreshAll(layoutId);
					}
				});
			});
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initLayoutAjax);
	} else {
		initLayoutAjax();
	}

	// -------------------------------------------------------------------
	// BXUICompat.Layout facade
	// -------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.Layout = {
		loadIntoArea: function (layoutId, areaIndex, url) {
			return BoxLangAjax.components.layout.loadIntoArea(
				layoutId,
				areaIndex,
				url,
			);
		},
		refreshAll: function (layoutId) {
			return BoxLangAjax.components.layout.refreshAll(layoutId);
		},
		switchTab: function (layoutId, tabIndex, url) {
			return BoxLangAjax.components.layout.switchTab(
				layoutId,
				tabIndex,
				url,
			);
		},
		toggleAccordion: function (layoutId, panelIndex, url) {
			return BoxLangAjax.components.layout.toggleAccordion(
				layoutId,
				panelIndex,
				url,
			);
		},
		collapseArea: function (layoutId, areaId) {
			return BoxLangAjax.components.layout.collapseArea(layoutId, areaId);
		},
		expandArea: function (layoutId, areaId) {
			return BoxLangAjax.components.layout.expandArea(layoutId, areaId);
		},
		toggleArea: function (layoutId, areaId) {
			return BoxLangAjax.components.layout.toggleArea(layoutId, areaId);
		},
	};
})();
