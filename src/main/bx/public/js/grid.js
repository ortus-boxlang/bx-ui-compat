/**
 * BoxLang Grid Component AJAX JavaScript
 * Enhanced AJAX functionality for grid components
 */

(function () {
	"use strict";

	// Ensure BoxLang AJAX is available
	if (!window.BoxLangAjax) {
		console.error("BoxLang AJAX core not loaded");
		return;
	}

	// Grid-specific AJAX utilities
	BoxLangAjax.components.grid = {
		/**
		 * Load grid data with pagination
		 */
		loadData: function (
			gridId,
			page = 1,
			pageSize = 25,
			sortColumn = "",
			sortOrder = "asc",
		) {
			const grid = document.getElementById(gridId);
			if (!grid) {
				console.error("Grid not found: " + gridId);
				return Promise.reject(new Error("Grid not found: " + gridId));
			}

			const url = grid.dataset.source;
			if (!url) {
				console.error("No data source found for grid: " + gridId);
				return Promise.reject(new Error("No data source found"));
			}

			const params = new URLSearchParams({
				page: page,
				pageSize: pageSize,
				sortColumn: sortColumn,
				sortOrder: sortOrder,
			});

			const fullUrl =
				url + (url.includes("?") ? "&" : "?") + params.toString();

			// Show loading skeleton
			this.showLoadingSkeleton(gridId);

			return BoxLangAjax.utils
				.fetchContent(fullUrl)
				.then(function (data) {
					// Assume data is JSON with { data: rows[], totalRows: number }
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch (e) {
							// If not JSON, treat as HTML and replace grid content
							grid.innerHTML = data;
							return data;
						}
					}

					BoxLangAjax.components.grid.renderGrid(gridId, data);
					return data;
				})
				.catch(function (error) {
					BoxLangAjax.components.grid.showError(gridId, error);
					throw error;
				});
		},

		/**
		 * Render grid with data
		 */
		renderGrid: function (gridId, data) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			const tbody = grid.querySelector("tbody");
			const pagination = grid.querySelector(".bx-grid-pagination");

			if (!tbody) return;

			// Clear existing rows
			tbody.innerHTML = "";

			if (!data.data || data.data.length === 0) {
				tbody.innerHTML =
					'<tr><td colspan="100%" class="bx-grid-empty">No data available</td></tr>';
				return;
			}

			// Render rows
			data.data.forEach(function (row, index) {
				const tr = document.createElement("tr");
				tr.dataset.rowIndex = index;

				// Get column definitions from header
				const headers = grid.querySelectorAll("thead th");
				headers.forEach(function (header) {
					const columnName =
						header.dataset.column ||
						header.textContent.toLowerCase().replace(/\s+/g, "_");
					const td = document.createElement("td");
					td.textContent = row[columnName] || "";
					tr.appendChild(td);
				});

				tbody.appendChild(tr);
			});

			// Update pagination if present
			if (pagination && data.totalRows !== undefined) {
				this.updatePagination(gridId, data);
			}

			// Trigger grid rendered event
			const event = new CustomEvent("grid-rendered", {
				detail: { gridId: gridId, data: data },
				bubbles: true,
			});
			grid.dispatchEvent(event);
		},

		/**
		 * Show loading skeleton
		 */
		showLoadingSkeleton: function (gridId) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			const tbody = grid.querySelector("tbody");
			if (!tbody) return;

			const columnCount = grid.querySelectorAll("thead th").length || 3;
			const rowCount = 5;

			tbody.innerHTML = "";

			for (let i = 0; i < rowCount; i++) {
				const tr = document.createElement("tr");
				for (let j = 0; j < columnCount; j++) {
					const td = document.createElement("td");
					td.innerHTML = '<div class="bx-loading-row"></div>';
					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}
		},

		/**
		 * Show error state
		 */
		showError: function (gridId, error) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			const tbody = grid.querySelector("tbody");
			if (!tbody) return;

			const columnCount = grid.querySelectorAll("thead th").length || 1;

			tbody.innerHTML = `
                <tr>
                    <td colspan="${columnCount}" class="bx-grid-error">
                        <div class="bx-error-title">Failed to load data</div>
                        <div class="bx-error-message">${error.message}</div>
                        <button type="button" class="bx-retry-button" onclick="BoxLangAjax.components.grid.refresh('${gridId}')">
                            Retry
                        </button>
                    </td>
                </tr>
            `;
		},

		/**
		 * Update pagination controls
		 */
		updatePagination: function (gridId, data) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			let pagination = grid.querySelector(".bx-grid-pagination");

			if (!pagination) {
				pagination = document.createElement("div");
				pagination.className = "bx-grid-pagination";
				grid.appendChild(pagination);
			}

			const currentPage = data.page || 1;
			const pageSize = data.pageSize || 25;
			const totalRows = data.totalRows || 0;
			const totalPages = Math.ceil(totalRows / pageSize);

			pagination.innerHTML = `
                <div class="bx-pagination-info">
                    Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(
						currentPage * pageSize,
						totalRows,
					)} of ${totalRows}
                </div>
                <div class="bx-pagination-controls">
                    <button type="button" ${
						currentPage <= 1 ? "disabled" : ""
					} onclick="BoxLangAjax.components.grid.goToPage('${gridId}', ${
						currentPage - 1
					})">
                        Previous
                    </button>
                    <span class="bx-page-info">Page ${currentPage} of ${totalPages}</span>
                    <button type="button" ${
						currentPage >= totalPages ? "disabled" : ""
					} onclick="BoxLangAjax.components.grid.goToPage('${gridId}', ${
						currentPage + 1
					})">
                        Next
                    </button>
                </div>
            `;
		},

		/**
		 * Go to specific page
		 */
		goToPage: function (gridId, page) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			const currentSort = grid.dataset.currentSort || "";
			const currentOrder = grid.dataset.currentOrder || "asc";
			const pageSize = parseInt(grid.dataset.pageSize) || 25;

			return this.loadData(
				gridId,
				page,
				pageSize,
				currentSort,
				currentOrder,
			);
		},

		/**
		 * Sort by column
		 */
		sortBy: function (gridId, column) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			let sortOrder = "asc";

			// Toggle sort order if clicking the same column
			if (grid.dataset.currentSort === column) {
				sortOrder =
					grid.dataset.currentOrder === "asc" ? "desc" : "asc";
			}

			grid.dataset.currentSort = column;
			grid.dataset.currentOrder = sortOrder;

			// Update header indicators
			const headers = grid.querySelectorAll("th[data-sort]");
			headers.forEach(function (header) {
				header.classList.remove(
					"bx-sorted-asc",
					"bx-sorted-desc",
					"bx-sorting",
				);
				if (header.dataset.sort === column) {
					header.classList.add("bx-sorting");
				}
			});

			const currentPage = parseInt(grid.dataset.currentPage) || 1;
			const pageSize = parseInt(grid.dataset.pageSize) || 25;

			return this.loadData(
				gridId,
				currentPage,
				pageSize,
				column,
				sortOrder,
			).then(function () {
				// Update header after successful load
				const sortedHeader = grid.querySelector(
					`th[data-sort="${column}"]`,
				);
				if (sortedHeader) {
					sortedHeader.classList.remove("bx-sorting");
					sortedHeader.classList.add("bx-sorted-" + sortOrder);
				}
			});
		},

		/**
		 * Search/filter grid
		 */
		search: function (gridId, query) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			grid.dataset.searchQuery = query;

			// Reset to first page when searching
			const pageSize = parseInt(grid.dataset.pageSize) || 25;
			const currentSort = grid.dataset.currentSort || "";
			const currentOrder = grid.dataset.currentOrder || "asc";

			return this.loadData(
				gridId,
				1,
				pageSize,
				currentSort,
				currentOrder,
			);
		},

		/**
		 * Refresh grid with current settings
		 */
		refresh: function (gridId) {
			const grid = document.getElementById(gridId);
			if (!grid) return;

			const currentPage = parseInt(grid.dataset.currentPage) || 1;
			const pageSize = parseInt(grid.dataset.pageSize) || 25;
			const currentSort = grid.dataset.currentSort || "";
			const currentOrder = grid.dataset.currentOrder || "asc";

			return this.loadData(
				gridId,
				currentPage,
				pageSize,
				currentSort,
				currentOrder,
			);
		},
	};

	// Enhanced grid event handling for AJAX
	function enhanceGridEvents() {
		// Set up sorting
		document.addEventListener("click", function (event) {
			const sortHeader = event.target.closest("th[data-sort]");
			if (sortHeader) {
				const grid = sortHeader.closest(".bx-grid");
				if (grid && grid.id) {
					const column = sortHeader.dataset.sort;
					BoxLangAjax.components.grid.sortBy(grid.id, column);
				}
			}
		});

		// Set up search
		document.addEventListener("input", function (event) {
			if (event.target.matches(".bx-grid-search input")) {
				const grid = event.target.closest(".bx-grid");
				if (grid && grid.id) {
					// Debounce search
					clearTimeout(grid.searchTimeout);
					grid.searchTimeout = setTimeout(function () {
						BoxLangAjax.components.grid.search(
							grid.id,
							event.target.value,
						);
					}, 500);
				}
			}
		});
	}

	// Auto-load grid data
	function autoLoadGridData() {
		document
			.querySelectorAll(".bx-grid[data-source]")
			.forEach(function (grid) {
				if (grid.id) {
					const delay = parseInt(grid.dataset.loadDelay) || 0;
					setTimeout(function () {
						BoxLangAjax.components.grid.loadData(grid.id);
					}, delay);
				}
			});
	}

	// Initialize grid AJAX enhancements
	function initGridAjax() {
		enhanceGridEvents();
		autoLoadGridData();

		console.log("BoxLang Grid AJAX enhancements initialized");
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initGridAjax);
	} else {
		initGridAjax();
	}
})();
