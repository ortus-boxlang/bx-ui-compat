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
		/** @type {Map<string, AbortController>} Track in-flight grid requests */
		_controllers: new Map(),

		/**
		 * Find a grid element by ID or data-name attribute.
		 * BoxLang renders <bx:grid> with a UUID id when no explicit id is
		 * specified, and the grid's CFML "name" becomes data-name. External
		 * JS (like ColdFusion.Grid.refresh('gridTables')) calls us by name,
		 * so we fall back from getElementById to [data-name] lookup.
		 *
		 * @param {string} gridId - The grid ID or name
		 * @returns {Element|null}
		 */
		_findGrid: function (gridId) {
			if (!gridId) return null;
			var el = document.getElementById(gridId);
			if (el) return el;
			return document.querySelector('[data-name="' + gridId + '"]');
		},

		/**
		 * Resolve bind variable tokens from data-bind-params to live DOM values.
		 *
		 * Reads the grid's data-bind-params attribute (comma-separated token list
		 * like "{cfgridpage},{cfgridpagesize},{tableform:inputName}") and resolves
		 * each token to its current value.
		 *
		 * Grid-internal tokens:
		 *   cfgridpage        → grid.dataset.currentPage || 1
		 *   cfgridpagesize    → grid.dataset.pageSize || 25
		 *   cfgridsortcolumn  → grid.dataset.currentSort || ""
		 *   cfgridsortdirection → (grid.dataset.currentOrder || "asc").toUpperCase()
		 *
		 * Form-scoped tokens (formName:fieldName) and bare tokens delegate to
		 * BXUICompat.Bind.getBindElementValue().
		 *
		 * @param {string} gridId - The grid element ID
		 * @returns {Object} Resolved key/value pairs to append as query params
		 */
		resolveBindParams: function (gridId) {
			const grid = this._findGrid(gridId);
			if (!grid) return {};

			const bindParamsStr = grid.dataset.bindParams;
			if (!bindParamsStr) return {};

			const result = {};
			const tokens = bindParamsStr.split(",");

			for (let token of tokens) {
				token = token.trim();
				// Strip leading { and trailing }
				token = token.replace(/^\{/, "").replace(/\}$/, "");
				if (!token) continue;

				let paramName, value;

				// Grid-internal tokens
				if (token === "cfgridpage") {
					paramName = "page";
					value = grid.dataset.currentPage || 1;
				} else if (token === "cfgridpagesize") {
					paramName = "pagesize";
					value = grid.dataset.pageSize || 25;
				} else if (token === "cfgridsortcolumn") {
					paramName = "gridsortcolumn";
					value = grid.dataset.currentSort || "";
				} else if (token === "cfgridsortdirection") {
					paramName = "gridsortdirection";
					value = (grid.dataset.currentOrder || "asc").toUpperCase();
				} else if (token.includes(":")) {
					// Form-scoped: formName:fieldName
					const colonPos = token.indexOf(":");
					const formName = token.substring(0, colonPos);
					const fieldName = token.substring(colonPos + 1);
					paramName = fieldName;
					value =
						window.BXUICompat &&
						window.BXUICompat.Bind &&
						window.BXUICompat.Bind.getBindElementValue
							? window.BXUICompat.Bind.getBindElementValue(
									fieldName,
									formName,
								)
							: "";
				} else {
					// Bare field name (no colon, no grid prefix)
					paramName = token;
					value =
						window.BXUICompat &&
						window.BXUICompat.Bind &&
						window.BXUICompat.Bind.getBindElementValue
							? window.BXUICompat.Bind.getBindElementValue(
									token,
									null,
								)
							: "";
				}

				if (value !== null && value !== undefined) {
					result[paramName] = value;
				}
			}

			return result;
		},

		/**
		 * Load grid data with pagination
		 */
		/**
		 * Load grid data with pagination.
		 *
		 * The page/pageSize/sortColumn/sortOrder arguments are kept on the
		 * signature for backwards compatibility but sortColumn/sortOrder are no
		 * longer sent on the wire — the sort info comes exclusively from the
		 * {cfgridsortcolumn}/{cfgridsortdirection} bind tokens (which resolve
		 * against grid.dataset.currentSort/currentOrder), so the CFC method
		 * signature stays clean.
		 */
		loadData: function (gridId, page = 1, pageSize = 25) {
			const grid = this._findGrid(gridId);
			if (!grid) {
				console.error("Grid not found: " + gridId);
				return Promise.reject(new Error("Grid not found: " + gridId));
			}

			// Use the grid's actual DOM id for the controller map key, so that
			// lookups by name and by id both cancel the same in-flight request.
			const controllerKey = grid.id || gridId;

			const url = grid.dataset.source;
			if (!url) {
				console.error("No data source found for grid: " + gridId);
				return Promise.reject(new Error("No data source found"));
			}

			// Internal pagination params sent on the wire. For grids WITHOUT a bind
			// expression we use the camelCase (page, pageSize) names that
			// match the local JS endpoint contract. For bind-driven grids
			// (data-bind-params present) the {cfgridpage}/{cfgridpagesize}
			// tokens resolve to the CFML wire names (page, pagesize), and
			// those are the canonical names — we must NOT also seed the
			// camelCase variants, or we'd end up with BOTH `page`/`pagesize`
			// AND `pageSize`/`pagesize` on the wire. The latter pair in
			// particular is what CFML parses as an invalid delimited list.
			//
			// NB: `URLSearchParams.set` replaces any existing value of the
			// same key, so the bind-token merge below will replace (not
			// duplicate) `page` if a `{cfgridpage}` token is present.
			const params = new URLSearchParams();
			const hasBind = !!grid.dataset.bindParams;
			if (!hasBind) {
				params.set("page", page);
				params.set("pageSize", pageSize);
			}

			// Merge resolved bind variable values into the query string. When a bind
			// expression defines {cfgridpage}/{cfgridpagesize}/{cfgridsortcolumn}/
			// {cfgridsortdirection} tokens, this is where the CF-named parameters
			// (page, pagesize, gridsortcolumn, gridsortdirection) are written.
			// `set` replaces any existing value instead of duplicating it.
			const bindParams = this.resolveBindParams(gridId);
			for (const [key, value] of Object.entries(bindParams)) {
				params.set(key, value);
			}

			const fullUrl =
				url + (url.includes("?") ? "&" : "?") + params.toString();

			// Show loading skeleton
			this.showLoadingSkeleton(gridId);

			// Cancel any previous in-flight request for this grid
			var prevController = this._controllers.get(controllerKey);
			if (prevController) prevController.abort();
			var controller = new AbortController();
			this._controllers.set(controllerKey, controller);

			return BoxLangAjax.utils
				.fetchContent(fullUrl, { signal: controller.signal })
				.then(function (data) {
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch (e) {
							// HTML or plain text — inject into tbody if exists
							var t = grid.querySelector("tbody");
							if (t) {
								t.innerHTML =
									'<tr><td colspan="100%">' +
									data +
									"</td></tr>";
							}
							return data;
						}
					}
					if (!data || typeof data !== "object") {
						return data;
					}
					var normalized =
						BoxLangAjax.components.grid._normalizeQueryData(data);
					if (!normalized || !normalized.data) {
						return data;
					}
					BoxLangAjax.components.grid.renderGrid(gridId, normalized);
					return normalized;
				})
				.catch(function (error) {
					BoxLangAjax.components.grid.showError(gridId, error);
					throw error;
				});
		},

		/**
		 * Normalize a CF-serialized query object into the { data: [...], totalRows: N } format
		 * that renderGrid() expects.
		 *
		 * CF format:  { QUERY: { COLUMNS: [...], DATA: [[...]] }, TOTALROWCOUNT: N }
		 * Our format: { data: [{ col: val }, ...], totalRows: N }
		 */
		_normalizeQueryData: function (data) {
			if (!data) return data;

			// Find the QUERY wrapper object (case-insensitive)
			var queryObj = null;
			for (var key in data) {
				if (data.hasOwnProperty(key) && key.toUpperCase() === "QUERY") {
					queryObj = data[key];
					break;
				}
			}
			if (!queryObj) return data;

			// Find COLUMNS and DATA arrays (case-insensitive)
			var columns = null;
			var rows = null;
			for (var key in queryObj) {
				if (queryObj.hasOwnProperty(key)) {
					var upper = key.toUpperCase();
					if (upper === "COLUMNS") columns = queryObj[key];
					if (upper === "DATA") rows = queryObj[key];
				}
			}
			if (!columns || !rows) return data;

			// Find TOTALROWCOUNT (case-insensitive)
			var totalRows = rows.length;
			for (var key in data) {
				if (
					data.hasOwnProperty(key) &&
					key.toUpperCase() === "TOTALROWCOUNT"
				) {
					totalRows = data[key];
					break;
				}
			}

			return {
				data: rows.map(function (row) {
					var obj = {};
					for (var i = 0; i < columns.length; i++) {
						obj[columns[i]] = row[i] != null ? row[i] : "";
					}
					return obj;
				}),
				totalRows: totalRows,
				// PAGE and PAGESIZE are serialized as strings by BoxLang's JSON
				// serializer. Parse them as integers so arithmetic in
				// updatePagination (currentPage + 1) does addition, not string
				// concatenation ("1" + 1 = "11").
				page: parseInt(data.PAGE || data.page || 1, 10) || 1,
				pageSize:
					parseInt(
						data.PAGESIZE || data.pagesize || rows.length,
						10,
					) || 25,
			};
		},

		/**
		 * Rebuild the grid's table structure if it has been corrupted.
		 */
		_ensureGridStructure: function (grid, data) {
			if (!data || !data.data || !data.data[0]) return null;
			var headers = Object.keys(data.data[0]);
			var thead = grid.querySelector("thead");
			if (!thead) {
				thead = document.createElement("thead");
				thead.className = "bx-grid-header";
				var tr = document.createElement("tr");
				headers.forEach(function (col) {
					var th = document.createElement("th");
					th.className = "bx-grid-column-header";
					th.dataset.column = col;
					th.textContent = col;
					tr.appendChild(th);
				});
				thead.appendChild(tr);
			}
			var table = grid.querySelector(".bx-grid-table");
			if (!table) {
				table = document.createElement("table");
				table.className = "bx-grid-table";
				grid.appendChild(table);
			}
			if (thead.parentNode !== table) {
				table.insertBefore(thead, table.firstChild);
			}
			var tbody = table.querySelector("tbody");
			if (!tbody) {
				tbody = document.createElement("tbody");
				tbody.className = "bx-grid-body";
				table.appendChild(tbody);
			}
			return tbody;
		},

		/**
		 * Render grid with data
		 */
		renderGrid: function (gridId, data) {
			const grid = this._findGrid(gridId);
			if (!grid) return;

			var tbody = grid.querySelector("tbody");

			// If the grid's structure has been corrupted, rebuild it
			if (!tbody || !grid.querySelector(".bx-grid-table")) {
				tbody = this._ensureGridStructure(grid, data);
				if (!tbody) return;
			}

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
				tr.classList.add("bx-grid-row");
				tr.dataset.row = index + 1;

				// Build a case-insensitive lookup map for this row once,
				// so column name matching works regardless of case (the
				// data-column attribute from the server preserves CFML
				// column name case, but AJAX JSON responses may use a
				// different case — e.g. query serialization uppercases).
				var rowLookup = {};
				for (var rk in row) {
					if (row.hasOwnProperty(rk)) {
						rowLookup[rk.toLowerCase()] = row[rk];
					}
				}

				// Get column definitions from header
				const headers = grid.querySelectorAll("thead th");
				headers.forEach(function (header) {
					if (typeof header.dataset.type === "undefined") {
						header.dataset.type = "text";
					}
					const columnName =
						header.dataset.column ||
						header.textContent.toLowerCase().replace(/\s+/g, "_");
					const td = document.createElement("td");
					td.classList.add("bx-grid-cell");
					td.dataset.column = columnName;
					// Exact match first, then case-insensitive fallback
					const contentAssignment =
						header.dataset.type.toLowerCase() == "html"
							? "innerHTML"
							: "textContent";
					td[contentAssignment] =
						row[columnName] !== undefined
							? row[columnName]
							: rowLookup[columnName.toLowerCase()] || "";
					tr.appendChild(td);
				});

				tbody.appendChild(tr);
			});

			// Update pagination. updatePagination() creates the pagination element on
			// demand (with class "bx-grid-pagination") if one does not already
			// exist, so we don't need to gate the call on its presence — for an
			// AJAX-bound grid the server-rendered skeleton has no pagination
			// child at all, and gating on `pagination &&` previously prevented
			// it from ever appearing.
			if (data.totalRows !== undefined) {
				this.updatePagination(gridId, data);
			}

			// Auto-select first row after AJAX render
			this._autoSelectAfterRender(gridId);

			// Trigger grid rendered event
			const event = new CustomEvent("grid-rendered", {
				detail: { gridId: gridId, data: data },
				bubbles: true,
			});
			grid.dispatchEvent(event);
		},

		/**
		 * Auto-select the first row after an AJAX render when selectOnLoad is true.
		 * Called internally by renderGrid().
		 */
		_autoSelectAfterRender: function (gridId) {
			const grid = this._findGrid(gridId);
			if (!grid) return;
			if (grid.dataset.selectOnLoad !== "true") return;

			const firstRow = grid.querySelector(".bx-grid-row");
			if (!firstRow) return;

			// Build selectedRowData from the first row's cells
			var rowData = {};
			firstRow.querySelectorAll(".bx-grid-cell").forEach(function (cell) {
				var colName = cell.dataset.column;
				if (colName) {
					rowData[colName] = cell.textContent.trim();
				}
			});
			grid.dataset.selectedRowData = JSON.stringify(rowData);

			// Update hidden selection input
			var hiddenInput = document.getElementById(gridId + "_selection");
			if (hiddenInput) {
				hiddenInput.value = String(firstRow.dataset.row || "1");
			}

			// Highlight the row
			firstRow.classList.add("bx-grid-row-selected");
			firstRow.querySelectorAll(".bx-grid-cell").forEach(function (c) {
				c.classList.add("bx-grid-cell-selected");
			});

			// Dispatch selection change event
			var event = new CustomEvent("gridSelectionChange", {
				detail: {
					gridName: grid.dataset.name,
					selectedRowIndex: parseInt(firstRow.dataset.row) || 1,
					selectedRowIndices: [parseInt(firstRow.dataset.row) || 1],
					selectedRowData: rowData,
				},
				bubbles: true,
			});
			grid.dispatchEvent(event);
		},

		/**
		 * Show loading skeleton
		 */
		showLoadingSkeleton: function (gridId) {
			const grid = this._findGrid(gridId);
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
			const grid = this._findGrid(gridId);
			if (!grid) return;

			const tbody = grid.querySelector("tbody");
			if (!tbody) return;

			const columnCount = grid.querySelectorAll("thead th").length || 1;
			var esc = BoxLangAjax.utils.escapeHTML;

			tbody.innerHTML = `
                <tr>
                    <td colspan="${columnCount}" class="bx-grid-error">
                        <div class="bx-error-title">Failed to load data</div>
                        <div class="bx-error-message">${esc(error.message)}</div>
                        <button type="button" class="bx-retry-button">
                            Retry
                        </button>
                    </td>
                </tr>
            `;

			var retryBtn = tbody.querySelector(".bx-retry-button");
			if (retryBtn) {
				retryBtn.addEventListener("click", function () {
					BoxLangAjax.components.grid.refresh(gridId);
				});
			}
		},

		/**
		 * Update pagination controls
		 */
		updatePagination: function (gridId, data) {
			const grid = this._findGrid(gridId);
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
                    <button type="button" class="bx-page-prev" ${
						currentPage <= 1 ? "disabled" : ""
					}>
                        Previous
                    </button>
                    <span class="bx-page-info">Page ${currentPage} of ${totalPages}</span>
                    <button type="button" class="bx-page-next" ${
						currentPage >= totalPages ? "disabled" : ""
					}>
                        Next
                    </button>
                </div>
            `;

			// Attach pagination handlers via addEventListener
			var prevBtn = pagination.querySelector(".bx-page-prev");
			var nextBtn = pagination.querySelector(".bx-page-next");
			if (prevBtn && currentPage > 1) {
				prevBtn.addEventListener("click", function () {
					BoxLangAjax.components.grid.goToPage(
						gridId,
						currentPage - 1,
					);
				});
			}
			if (nextBtn && currentPage < totalPages) {
				nextBtn.addEventListener("click", function () {
					BoxLangAjax.components.grid.goToPage(
						gridId,
						currentPage + 1,
					);
				});
			}
		},

		/**
		 * Go to specific page
		 */
		goToPage: function (gridId, page) {
			const grid = this._findGrid(gridId);
			if (!grid) return;

			const pageSize = parseInt(grid.dataset.pageSize) || 25;

			// Ensure the dataset is current-page-aware (resolveBindParams reads it)
			grid.dataset.currentPage = page;

			return this.loadData(gridId, page, pageSize);
		},

		/**
		 * Sort by column
		 */
		sortBy: function (gridId, column) {
			const grid = this._findGrid(gridId);
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

			return this.loadData(gridId, currentPage, pageSize).then(
				function () {
					// Update header after successful load
					const sortedHeader = grid.querySelector(
						`th[data-sort="${column}"]`,
					);
					if (sortedHeader) {
						sortedHeader.classList.remove("bx-sorting");
						sortedHeader.classList.add("bx-sorted-" + sortOrder);
					}
				},
			);
		},

		/**
		 * Search/filter grid
		 */
		search: function (gridId, query) {
			const grid = this._findGrid(gridId);
			if (!grid) return;

			grid.dataset.searchQuery = query;

			// Reset to first page when searching
			const pageSize = parseInt(grid.dataset.pageSize) || 25;

			return this.loadData(gridId, 1, pageSize);
		},

		/**
		 * Refresh grid with current settings
		 */
		refresh: function (gridId) {
			const grid = this._findGrid(gridId);
			if (!grid) return;

			const currentPage = parseInt(grid.dataset.currentPage) || 1;
			const pageSize = parseInt(grid.dataset.pageSize) || 25;

			return this.loadData(gridId, currentPage, pageSize);
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
	}

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initGridAjax);
	} else {
		initGridAjax();
	}

	// -------------------------------------------------------------------
	// BXUICompat.Grid facade
	// -------------------------------------------------------------------
	window.BXUICompat = window.BXUICompat || {};
	window.BXUICompat.Grid = {
		loadData: function (gridId, page, pageSize) {
			return BoxLangAjax.components.grid.loadData(gridId, page, pageSize);
		},
		refresh: function (gridId) {
			return BoxLangAjax.components.grid.refresh(gridId);
		},
		sortBy: function (gridId, col) {
			return BoxLangAjax.components.grid.sortBy(gridId, col);
		},
		search: function (gridId, query) {
			return BoxLangAjax.components.grid.search(gridId, query);
		},
		goToPage: function (gridId, page) {
			return BoxLangAjax.components.grid.goToPage(gridId, page);
		},
	};
})();
