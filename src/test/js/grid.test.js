import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("grid.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("grid.js");
	});

	describe("BoxLangAjax.components.grid", () => {
		let gridComp;

		beforeEach(() => {
			gridComp = window.BoxLangAjax.components.grid;
			document.body.innerHTML = "";
		});

		describe("loadData", () => {
			it("rejects if grid not found", async () => {
				await expect(gridComp.loadData("nonexistent")).rejects.toThrow(
					"Grid not found",
				);
			});

			it("rejects if no data source", async () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid"><thead><tr><th>ID</th></tr></thead><tbody></tbody></table>';
				await expect(gridComp.loadData("myGrid")).rejects.toThrow(
					"No data source found",
				);
			});

			it("loads and renders JSON data", async () => {
				document.body.innerHTML = `
					<div id="myGrid" class="bx-grid" data-source="/api/data">
						<table class="bx-grid-table">
							<thead><tr><th data-column="id">ID</th><th data-column="name">Name</th></tr></thead>
							<tbody></tbody>
						</table>
					</div>`;

				const jsonData = {
					data: [
						{ id: "1", name: "Alice" },
						{ id: "2", name: "Bob" },
					],
					totalRows: 2,
				};
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify(jsonData), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.loadData("myGrid");
				const rows = document.querySelectorAll("#myGrid tbody tr");
				expect(rows.length).toBe(2);
				expect(rows[0].textContent).toContain("Alice");
				vi.restoreAllMocks();
			});

			it("handles HTML response by replacing grid content", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data">
						<thead><tr><th>Col</th></tr></thead>
						<tbody></tbody>
					</table>`;

				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("<tr><td>HTML row</td></tr>", { status: 200 }),
				);

				await gridComp.loadData("myGrid");
				expect(document.getElementById("myGrid").innerHTML).toContain(
					"HTML row",
				);
				vi.restoreAllMocks();
			});

			it("shows error state on failure", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data">
						<thead><tr><th>Col</th></tr></thead>
						<tbody></tbody>
					</table>`;

				vi.spyOn(globalThis, "fetch").mockRejectedValue(
					new Error("timeout"),
				);
				window.BoxLangAjax.config.retryAttempts = 1;

				await expect(gridComp.loadData("myGrid")).rejects.toThrow(
					"timeout",
				);
				expect(document.querySelector(".bx-grid-error")).not.toBeNull();

				vi.restoreAllMocks();
				window.BoxLangAjax.config.retryAttempts = 3;
			});
		});

		describe("renderGrid", () => {
			it("renders empty message when no data", () => {
				document.body.innerHTML = `
					<div id="myGrid" class="bx-grid">
						<table class="bx-grid-table"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>
					</div>`;
				gridComp.renderGrid("myGrid", { data: [] });
				expect(document.querySelector(".bx-grid-empty")).not.toBeNull();
			});

			it("renders rows from data array", () => {
				document.body.innerHTML = `
					<table id="myGrid"><thead><tr><th data-column="name">Name</th></tr></thead><tbody></tbody></table>`;
				gridComp.renderGrid("myGrid", { data: [{ name: "Test" }] });
				expect(document.querySelector("tbody tr td").textContent).toBe(
					"Test",
				);
			});

			it("dispatches grid-rendered event", () => {
				document.body.innerHTML = `
					<table id="myGrid"><thead><tr><th data-column="x">X</th></tr></thead><tbody></tbody></table>`;
				const handler = vi.fn();
				document
					.getElementById("myGrid")
					.addEventListener("grid-rendered", handler);
				gridComp.renderGrid("myGrid", { data: [{ x: "1" }] });
				expect(handler).toHaveBeenCalled();
			});
		});

		describe("showLoadingSkeleton", () => {
			it("renders skeleton rows in tbody", () => {
				document.body.innerHTML = `
					<table id="myGrid"><thead><tr><th>A</th><th>B</th></tr></thead><tbody></tbody></table>`;
				gridComp.showLoadingSkeleton("myGrid");
				const rows = document.querySelectorAll("#myGrid tbody tr");
				expect(rows.length).toBe(5);
				expect(rows[0].querySelectorAll("td").length).toBe(2);
			});
		});

		describe("updatePagination", () => {
			it("creates pagination controls", () => {
				document.body.innerHTML =
					'<table id="myGrid"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';
				gridComp.updatePagination("myGrid", {
					page: 1,
					pageSize: 10,
					totalRows: 50,
				});
				const pagination = document.querySelector(
					".bx-grid-pagination",
				);
				expect(pagination).not.toBeNull();
				expect(pagination.innerHTML).toContain("Page 1 of 5");
			});
		});

		describe("sortBy", () => {
			it("sets sort metadata on grid", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data">
						<thead><tr><th data-sort="name">Name</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [{ name: "A" }] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.sortBy("myGrid", "name");
				const grid = document.getElementById("myGrid");
				expect(grid.dataset.currentSort).toBe("name");
				expect(grid.dataset.currentOrder).toBe("asc");
				vi.restoreAllMocks();
			});

			it("toggles sort order on same column", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data" data-current-sort="name" data-current-order="asc">
						<thead><tr><th data-sort="name">Name</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.sortBy("myGrid", "name");
				expect(
					document.getElementById("myGrid").dataset.currentOrder,
				).toBe("desc");
				vi.restoreAllMocks();
			});
		});

		describe("search", () => {
			it("resets to page 1 and loads data", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data" data-page-size="10">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.search("myGrid", "test query");
				expect(
					document.getElementById("myGrid").dataset.searchQuery,
				).toBe("test query");
				vi.restoreAllMocks();
			});
		});

		describe("refresh", () => {
			it("reloads with current settings", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data" data-current-page="2" data-page-size="5">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.refresh("myGrid");
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).toContain("page=2");
				expect(url).toContain("pageSize=5");
				vi.restoreAllMocks();
			});
		});

		describe("goToPage", () => {
			it("loads specific page", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data" data-page-size="20">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.goToPage("myGrid", 3);
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).toContain("page=3");
				vi.restoreAllMocks();
			});
		});

		describe("resolveBindParams", () => {
			it("returns empty object when no data-bind-params", () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid" data-source="/api/data"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				expect(result).toEqual({});
			});

			it("maps cfgridpage to current page number", () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid" data-source="/api/data" data-bind-params="{cfgridpage}" data-current-page="3"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				expect(result.page).toBe("3");
			});

			it("maps cfgridpagesize to page size", () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid" data-source="/api/data" data-bind-params="{cfgridpagesize}" data-page-size="10"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				expect(result.pagesize).toBe("10");
			});

			it("maps cfgridsortcolumn and cfgridsortdirection", () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid" data-source="/api/data" data-bind-params="{cfgridsortcolumn},{cfgridsortdirection}" data-current-sort="name" data-current-order="desc"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				expect(result.gridsortcolumn).toBe("name");
				expect(result.gridsortdirection).toBe("DESC");
			});

			it("resolves formName:fieldName via BXUICompat.Bind", () => {
				// Set up a mock form element that getBindElementValue can find
				document.body.innerHTML = `
					<form id="testForm"><input name="inputName" value="formValue"></form>
					<table id="myGrid" class="bx-grid" data-bind-params="{testForm:inputName}"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>`;

				const result = gridComp.resolveBindParams("myGrid");
				expect(result.inputName).toBe("formValue");
			});

			it("resolves bare field name via BXUICompat.Bind", () => {
				document.body.innerHTML =
					'<input id="searchBox" name="searchBox" value="testSearch"><table id="myGrid" class="bx-grid" data-bind-params="{searchBox}"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				expect(result.searchBox).toBe("testSearch");
			});

			it("returns empty string for unknown field name", () => {
				document.body.innerHTML =
					'<table id="myGrid" class="bx-grid" data-bind-params="{nonexistentField}"><thead><tr><th>X</th></tr></thead><tbody></tbody></table>';

				const result = gridComp.resolveBindParams("myGrid");
				// getBindElementValue returns null for unknown fields, so the key is excluded
				expect(result.nonexistentField).toBeUndefined();
			});
		});

		describe("loadData with bind params", () => {
			it("appends bind params to URL when data-bind-params is present", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data" data-page-size="5"
						data-bind-params="{cfgridpage},{cfgridpagesize}">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.loadData("myGrid");
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).toContain("page=1");
				expect(url).toContain("pagesize=5");
				vi.restoreAllMocks();
			});

			it("includes grid-internal bind params in URL when data-bind-params present", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data"
						data-bind-params="{cfgridsortcolumn},{cfgridsortdirection}"
						data-current-sort="name" data-current-order="desc">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.loadData("myGrid");
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).toContain("gridsortcolumn=name");
				expect(url).toContain("gridsortdirection=DESC");
				vi.restoreAllMocks();
			});

			it("does NOT send legacy sortColumn/sortOrder URL params (CFC method signature has no such params)", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data"
						data-bind-params="{cfgridsortcolumn},{cfgridsortdirection}"
						data-current-sort="LocId" data-current-order="desc">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.loadData("myGrid");
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).not.toContain("sortColumn=");
				expect(url).not.toContain("sortOrder=");
				vi.restoreAllMocks();
			});

			it("does NOT send legacy sortColumn/sortOrder URL params even without bind", async () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-source="/api/data">
						<thead><tr><th>X</th></tr></thead>
						<tbody></tbody>
					</table>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);

				await gridComp.loadData("myGrid", 1, 25, "name", "asc");
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).not.toContain("sortColumn=");
				expect(url).not.toContain("sortOrder=");
				vi.restoreAllMocks();
			});
		});

		describe("_autoSelectAfterRender", () => {
			it("auto-selects first row when selectOnLoad is true", () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-name="myGrid" data-select-on-load="true">
						<thead><tr><th data-column="id">ID</th><th data-column="name">Name</th></tr></thead>
						<tbody></tbody>
					</table>`;
				gridComp.renderGrid("myGrid", {
					data: [{ id: "1", name: "Alice" }],
				});

				const grid = document.getElementById("myGrid");
				expect(grid.dataset.selectedRowData).toBeDefined();
				const rowData = JSON.parse(grid.dataset.selectedRowData);
				expect(rowData.id).toBe("1");
				expect(rowData.name).toBe("Alice");
			});

			it("does not auto-select when selectOnLoad is false", () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-name="myGrid" data-select-on-load="false">
						<thead><tr><th data-column="id">ID</th></tr></thead>
						<tbody></tbody>
					</table>`;
				gridComp.renderGrid("myGrid", { data: [{ id: "1" }] });

				const grid = document.getElementById("myGrid");
				expect(grid.dataset.selectedRowData || "").toBe("");
			});

			it("dispatches gridSelectionChange event after auto-select", () => {
				document.body.innerHTML = `
					<table id="myGrid" class="bx-grid" data-name="myGrid" data-select-on-load="true">
						<thead><tr><th data-column="id">ID</th></tr></thead>
						<tbody></tbody>
					</table>`;
				const grid = document.getElementById("myGrid");
				const handler = vi.fn();
				grid.addEventListener("gridSelectionChange", handler);

				gridComp.renderGrid("myGrid", { data: [{ id: "99" }] });

				expect(handler).toHaveBeenCalled();
				const detail = handler.mock.calls[0][0].detail;
				expect(detail.gridName).toBe("myGrid");
				expect(detail.selectedRowData.id).toBe("99");
			});
		});
	});

	describe("BXUICompat.Grid facade", () => {
		it("exposes all public methods", () => {
			const facade = window.BXUICompat.Grid;
			expect(facade.loadData).toBeTypeOf("function");
			expect(facade.refresh).toBeTypeOf("function");
			expect(facade.sortBy).toBeTypeOf("function");
			expect(facade.search).toBeTypeOf("function");
			expect(facade.goToPage).toBeTypeOf("function");
		});
	});
});
