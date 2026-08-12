/**
 * BoxLang Pod Component AJAX JavaScript
 * Enhanced AJAX functionality for pod components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// Pod-specific AJAX utilities
	BoxLangAjax.components.pod = {
		/**
		 * Refresh pod content
		 */
		refresh: function (podId, showOverlay = true) {
			const pod = document.getElementById(podId);
			if (!pod) {
				console.error("Pod not found: " + podId);
				return Promise.reject(new Error("Pod not found: " + podId));
			}

			const url = pod.dataset.source || pod.dataset.refreshUrl;
			if (!url) {
				console.error("No refresh URL found for pod: " + podId);
				return Promise.reject(new Error("No refresh URL found"));
			}

			const content = pod.querySelector(".bx-pod-content");
			if (!content) {
				console.error("Pod content area not found: " + podId);
				return Promise.reject(new Error("Pod content area not found"));
			}

			let overlay = null;

			if (showOverlay) {
				// Create and show overlay
				overlay = document.createElement("div");
				overlay.className = "bx-loading-overlay";
				overlay.innerHTML =
					'<div class="bx-loading">Refreshing...</div>';
				pod.appendChild(overlay);
				pod.classList.add("bx-refreshing");
			}

			return BoxLangAjax.utils
				.fetchContent(url)
				.then(function (data) {
					content.innerHTML = data;
					content.classList.add("bx-source-loaded");

					if (overlay) {
						pod.removeChild(overlay);
						pod.classList.remove("bx-refreshing");
					}

					// Execute scripts in loaded content
					BoxLangAjax.utils.executeScripts(content);

					// Trigger refresh event
					const event = new CustomEvent("pod-refreshed", {
						detail: { podId: podId, url: url, content: data },
						bubbles: true,
					});
					pod.dispatchEvent(event);

					return data;
				})
				.catch(function (error) {
					if (overlay) {
						pod.removeChild(overlay);
						pod.classList.remove("bx-refreshing");
					}

					var esc = BoxLangAjax.utils.escapeHTML;
					content.innerHTML = `
                        <div class="bx-source-error">
                            <div class="bx-error-title">Failed to refresh content</div>
                            <div class="bx-error-message">${esc(error.message)}</div>
                            <div class="bx-error-retry">
                                <button type="button" class="bx-retry-button">
                                    Retry
                                </button>
                            </div>
                        </div>
                    `;

					// Attach retry via addEventListener (no inline onclick)
					var retryBtn = content.querySelector(".bx-retry-button");
					if (retryBtn) {
						retryBtn.addEventListener("click", function () {
							BoxLangAjax.components.pod.refresh(podId);
						});
					}

					// Trigger error event
					const errorEvent = new CustomEvent("pod-error", {
						detail: { podId: podId, url: url, error: error },
						bubbles: true,
					});
					pod.dispatchEvent(errorEvent);

					throw error;
				});
		},

		/**
		 * Toggle pod collapse state
		 */
		toggle: function (podId) {
			const pod = document.getElementById(podId);
			if (!pod || !pod.classList.contains("bx-collapsible")) {
				return;
			}

			pod.classList.toggle("bx-collapsed");

			// Trigger toggle event
			const event = new CustomEvent("pod-toggled", {
				detail: {
					podId: podId,
					collapsed: pod.classList.contains("bx-collapsed"),
				},
				bubbles: true,
			});
			pod.dispatchEvent(event);
		},

		/**
		 * Set up auto-refresh for a pod (uses setTimeout chains to prevent stacking)
		 */
		autoRefresh: function (podId, interval) {
			const pod = document.getElementById(podId);
			if (!pod) {
				console.error("Pod not found for auto-refresh: " + podId);
				return;
			}

			const url = pod.dataset.source || pod.dataset.refreshUrl;
			if (!url) {
				console.error(
					"No refresh URL found for auto-refresh pod: " + podId,
				);
				return;
			}

			// Stop any existing auto-refresh
			this.stopAutoRefresh(podId);

			// Use a pod-specific setTimeout chain that skips refresh when collapsed
			if (!BoxLangAjax._podAutoRefresh) {
				BoxLangAjax._podAutoRefresh = new Map();
			}

			var active = true;

			function scheduleNext() {
				if (!active) return;
				var timerId = setTimeout(function () {
					if (!active || !document.contains(pod)) {
						active = false;
						BoxLangAjax._podAutoRefresh.delete(podId);
						return;
					}
					// Skip if collapsed
					if (pod.classList.contains("bx-collapsed")) {
						scheduleNext();
						return;
					}
					BoxLangAjax.components.pod
						.refresh(podId, false)
						.catch(function (error) {
							if (error && error.name !== "AbortError") {
								console.error(
									"Pod auto-refresh failed:",
									error,
								);
							}
						})
						.finally(function () {
							scheduleNext();
						});
				}, interval);
				BoxLangAjax._podAutoRefresh.set(podId, {
					timerId: timerId,
					stop: function () {
						active = false;
						clearTimeout(timerId);
					},
				});
			}

			scheduleNext();
			return podId;
		},

		/**
		 * Stop auto-refresh for a pod
		 */
		stopAutoRefresh: function (podId) {
			if (BoxLangAjax._podAutoRefresh) {
				var entry = BoxLangAjax._podAutoRefresh.get(podId);
				if (entry) {
					entry.stop();
					BoxLangAjax._podAutoRefresh.delete(podId);
				}
			}
			// Clean up legacy dataset property
			var pod = document.getElementById(podId);
			if (pod) {
				delete pod.dataset.refreshIntervals;
			}
		},

		/**
		 * Resize pod to specific dimensions
		 */
		resize: function (podId, width, height) {
			const pod = document.getElementById(podId);
			if (!pod) return;

			if (width)
				pod.style.width =
					typeof width === "number" ? width + "px" : width;
			if (height)
				pod.style.height =
					typeof height === "number" ? height + "px" : height;

			// Trigger resize event
			const event = new CustomEvent("pod-resized", {
				detail: { podId: podId, width: width, height: height },
				bubbles: true,
			});
			pod.dispatchEvent(event);
		},

		/**
		 * Load content with specific parameters
		 */
		loadWithParams: function (podId, params = {}) {
			const pod = document.getElementById(podId);
			if (!pod) {
				console.error("Pod not found: " + podId);
				return Promise.reject(new Error("Pod not found: " + podId));
			}

			let url = pod.dataset.source || pod.dataset.refreshUrl;
			if (!url) {
				console.error("No URL found for pod: " + podId);
				return Promise.reject(new Error("No URL found"));
			}

			// Append parameters to URL
			if (Object.keys(params).length > 0) {
				const urlParams = new URLSearchParams(params);
				url += (url.includes("?") ? "&" : "?") + urlParams.toString();
			}

			const content = pod.querySelector(".bx-pod-content");
			if (!content || !content.id) {
				// Create content area if it doesn't exist
				if (!content) {
					const newContent = document.createElement("div");
					newContent.className = "bx-pod-content";
					newContent.id = podId + "_content";
					pod.appendChild(newContent);
				}
			}

			const contentId = content ? content.id : podId + "_content";
			return BoxLangAjax.utils.loadIntoContainer(contentId, url);
		},
	};

	// Enhanced pod event handling for AJAX
	function enhancePodEvents() {
		// Set up collapse/expand functionality
		document.addEventListener("click", function (event) {
			const header = event.target.closest(".bx-pod-header");
			if (header) {
				const pod = header.closest(".bx-pod.bx-collapsible");
				if (pod && pod.id) {
					BoxLangAjax.components.pod.toggle(pod.id);
				}
			}
		});

		// Set up refresh buttons
		document.addEventListener("click", function (event) {
			if (
				event.target.matches(".bx-pod-refresh") ||
				event.target.closest(".bx-pod-refresh")
			) {
				const button = event.target.matches(".bx-pod-refresh")
					? event.target
					: event.target.closest(".bx-pod-refresh");
				const pod = button.closest(".bx-pod");
				if (pod && pod.id) {
					BoxLangAjax.components.pod.refresh(pod.id);
				}
			}
		});

		// Set up resize handles
		document.addEventListener("mousedown", function (event) {
			if (event.target.matches(".bx-resize-handle")) {
				const pod = event.target.closest(".bx-pod");
				if (!pod) return;

				event.preventDefault();

				const startX = event.clientX;
				const startY = event.clientY;
				const startWidth = parseInt(getComputedStyle(pod).width, 10);
				const startHeight = parseInt(getComputedStyle(pod).height, 10);

				function handleMouseMove(e) {
					const newWidth = startWidth + (e.clientX - startX);
					const newHeight = startHeight + (e.clientY - startY);

					BoxLangAjax.components.pod.resize(
						pod.id,
						Math.max(200, newWidth),
						Math.max(100, newHeight),
					);
				}

				function handleMouseUp() {
					document.removeEventListener("mousemove", handleMouseMove);
					document.removeEventListener("mouseup", handleMouseUp);
				}

				document.addEventListener("mousemove", handleMouseMove);
				document.addEventListener("mouseup", handleMouseUp);
			}
		});
	}

	// Auto-load content for pods with data-source
	function autoLoadPodContent() {
		document
			.querySelectorAll(".bx-pod[data-source]")
			.forEach(function (pod) {
				const url = pod.dataset.source;
				const delay = parseInt(pod.dataset.loadDelay) || 0;

				if (url && pod.id) {
					setTimeout(function () {
						BoxLangAjax.components.pod
							.refresh(pod.id, false) // No overlay for initial load
							.catch(function (error) {
								console.error(
									"Failed to auto-load pod content:",
									error,
								);
							});
					}, delay);
				}
			});
	}

	// Set up auto-refresh for pods
	function setupAutoRefresh() {
		document
			.querySelectorAll(".bx-pod[data-refresh-interval]")
			.forEach(function (pod) {
				const interval = parseInt(pod.dataset.refreshInterval) * 1000; // Convert to milliseconds

				if (pod.id && interval > 0) {
					BoxLangAjax.components.pod.autoRefresh(pod.id, interval);
				}
			});
	}

	// Set up keyboard accessibility
	function setupPodAccessibility() {
		document
			.querySelectorAll(".bx-pod.bx-collapsible .bx-pod-header")
			.forEach(function (header) {
				if (!header.hasAttribute("tabindex")) {
					header.setAttribute("tabindex", "0");
				}

				header.addEventListener("keydown", function (event) {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						const pod = header.closest(".bx-pod");
						if (pod && pod.id) {
							BoxLangAjax.components.pod.toggle(pod.id);
						}
					}
				});
			});
	}

	// Initialize pod AJAX enhancements
	function initPodAjax() {
		enhancePodEvents();
		autoLoadPodContent();
		setupAutoRefresh();
		setupPodAccessibility();
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPodAjax);
	} else {
		initPodAjax();
	}

	// -------------------------------------------------------------------
	// BXUICompat.Pod facade
	// -------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.Pod = window.BXUICompat.Pod || {};
	window.BXUICompat.Pod.refresh = function (podId, showOverlay) {
		return BoxLangAjax.components.pod.refresh(podId, showOverlay);
	};
})();
