/**
 * BoxLang ProgressBar Component JavaScript
 * Runtime controller for <bx:progressbar> components.
 *
 * Enhances the ColdFusion.ProgressBar API stub (defined in ajax-core.js) with
 * DOM-aware start/stop/show/hide behaviour for rendered progress bars.
 *
 * Load order: ajax-core.js → progressbar.js (optional, after core)
 */

(function () {
	"use strict";

	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	var $PB = window.ColdFusion && window.ColdFusion.ProgressBar;

	if (!$PB) {
		console.warn(
			"ColdFusion.ProgressBar not available — progressbar.js skipped",
		);
		return;
	}

	// -----------------------------------------------------------------------
	// BoxLangAjax.components.progressbar namespace
	// -----------------------------------------------------------------------
	BoxLangAjax.components.progressbar = {
		/**
		 * Get the state object for a named bar, creating it if needed.
		 */
		getState: function (barName) {
			$PB._bars[barName] = $PB._bars[barName] || {};
			return $PB._bars[barName];
		},

		/**
		 * Get the DOM elements for a progress bar by name.
		 * Returns null if the element is not in the DOM.
		 */
		getElements: function (barName) {
			var el = document.getElementById(barName);
			if (!el) return null;
			return {
				container: el,
				fill: el.querySelector(".bx-progressbar-fill"),
				message: el.querySelector(".bx-progressbar-message"),
			};
		},

		/**
		 * Update the visual progress of a bar.
		 *
		 * @param {string} barName
		 * @param {number} progress - 0 to 1
		 * @param {string} [message] - optional text to display
		 */
		setProgress: function (barName, progress, message) {
			var els = this.getElements(barName);
			if (!els) return;

			var pct = Math.max(0, Math.min(1, progress)) * 100;
			if (els.fill) els.fill.style.width = pct + "%";
			if (els.message) {
				els.message.textContent = message || Math.round(pct) + "%";
			}

			var state = this.getState(barName);
			state._progress = progress;

			if (progress >= 1) {
				els.container.classList.add("bx-progress-complete");
				els.container.classList.remove("bx-progress-running");
			}
		},

		/**
		 * Reset a progress bar to 0%.
		 */
		reset: function (barName) {
			var els = this.getElements(barName);
			if (!els) return;

			if (els.fill) els.fill.style.width = "0%";
			if (els.message) els.message.textContent = "";
			els.container.classList.remove(
				"bx-progress-complete",
				"bx-progress-running",
				"bx-progress-indeterminate",
			);

			var state = this.getState(barName);
			state._progress = 0;
			state.running = false;
		},
	};

	// -----------------------------------------------------------------------
	// Enhanced $PB.start — if no component script has patched it, provide a
	// generic implementation that handles duration-based bars rendered in DOM.
	// Always resets to 0 and restarts.
	// -----------------------------------------------------------------------
	var _originalStart = $PB.start;
	var _originalStop = $PB.stop;
	var _originalShow = $PB.show;
	var _originalHide = $PB.hide;

	$PB.show = function (barName) {
		var els = BoxLangAjax.components.progressbar.getElements(barName);
		if (els) {
			els.container.classList.remove("bx-progressbar-hidden");
			els.container.style.display = "";
		}
		this._bars[barName] = this._bars[barName] || {};
		this._bars[barName].visible = true;
	};

	$PB.hide = function (barName) {
		var els = BoxLangAjax.components.progressbar.getElements(barName);
		if (els) {
			els.container.classList.add("bx-progressbar-hidden");
			els.container.style.display = "none";
		}
		if (this._bars[barName]) this._bars[barName].visible = false;
	};

	$PB.start = function (barName) {
		var state = BoxLangAjax.components.progressbar.getState(barName);

		// Always stop any existing timer and reset to 0 before starting
		$PB.stop(barName);
		BoxLangAjax.components.progressbar.reset(barName);

		// If the component script already registered a _startFn, use it.
		if (typeof state._startFn === "function") {
			state._startFn();
			return;
		}

		// Fallback: use data attributes on the DOM element for a generic start
		var els = BoxLangAjax.components.progressbar.getElements(barName);
		if (els && els.container.dataset.duration) {
			var duration = parseInt(els.container.dataset.duration, 10);
			var interval = parseInt(
				els.container.dataset.interval || "1000",
				10,
			);
			var steps = Math.ceil(duration / interval);
			var step = 0;

			state.running = true;
			els.container.classList.add("bx-progress-running");

			state._timerId = setInterval(function () {
				step++;
				var progress = Math.min(step / steps, 1);
				BoxLangAjax.components.progressbar.setProgress(
					barName,
					progress,
				);

				if (progress >= 1) {
					clearInterval(state._timerId);
					state._timerId = null;
					state.running = false;
					els.container.classList.remove("bx-progress-running");
				}
			}, interval);
		} else {
			// No DOM element or no duration — delegate to original stub
			_originalStart.call($PB, barName);
		}
	};

	$PB.stop = function (barName) {
		var state = BoxLangAjax.components.progressbar.getState(barName);

		// Clear any active timer (setInterval or setTimeout)
		if (state._timerId) {
			clearInterval(state._timerId);
			clearTimeout(state._timerId);
			state._timerId = null;
		}
		state.running = false;

		var els = BoxLangAjax.components.progressbar.getElements(barName);
		if (els) {
			els.container.classList.remove("bx-progress-running");
		}
	};

	// -----------------------------------------------------------------------
	// Auto-initialise any progress bars already in the DOM that have
	// data-duration and should auto-start (no explicit ColdFusion.ProgressBar.start needed).
	// -----------------------------------------------------------------------
	function initProgressBars() {
		document
			.querySelectorAll(".bx-progressbar[data-duration][data-autostart]")
			.forEach(function (el) {
				if (el.id) {
					$PB.start(el.id);
				}
			});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initProgressBars);
	} else {
		initProgressBars();
	}

	// -----------------------------------------------------------------------
	// BXUICompat.ProgressBar facade (already on $C, but ensure component helpers
	// are accessible)
	// -----------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.ProgressBar = $PB;
	window.BXUICompat.ProgressBar.setProgress =
		BoxLangAjax.components.progressbar.setProgress.bind(
			BoxLangAjax.components.progressbar,
		);
	window.BXUICompat.ProgressBar.reset =
		BoxLangAjax.components.progressbar.reset.bind(
			BoxLangAjax.components.progressbar,
		);
})();
