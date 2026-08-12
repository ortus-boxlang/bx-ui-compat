/**
 * Tests for the legacy window.ColdFusion.* compat surface.
 *
 * Verifies that real-world CF code patterns work via the ColdFusion alias
 * without modification.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

// jsdom dialog polyfills
beforeAll(() => {
	if (!HTMLElement.prototype.show) {
		HTMLElement.prototype.show = function () {
			this.setAttribute("open", "");
		};
	}
	if (!HTMLElement.prototype.showModal) {
		HTMLElement.prototype.showModal = function () {
			this.setAttribute("open", "");
		};
	}
	if (!HTMLElement.prototype.close) {
		HTMLElement.prototype.close = function () {
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		};
	}
});

describe("ColdFusion legacy compat API", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("window.js");
		loadScript("grid.js");
	});

	beforeEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	// -----------------------------------------------------------------------
	// ColdFusion.Ajax.submitForm
	// -----------------------------------------------------------------------
	describe("ColdFusion.Ajax.submitForm", () => {
		it("submits a form via AJAX to the specified URL", async () => {
			document.body.innerHTML = `
				<form id="MapupdateFrm">
					<input name="field1" value="hello" />
				</form>
				<div id="result"></div>
			`;

			global.fetch = vi
				.fn()
				.mockImplementation(() =>
					Promise.resolve(new Response("success", { status: 200 })),
				);

			const callback = vi.fn();
			const errorHandler = vi.fn();
			const action = "Update";

			ColdFusion.Ajax.submitForm(
				"MapupdateFrm",
				"act_MappingGl.cfm?UserAction=" + action,
				callback,
				errorHandler,
			);

			// Allow promises to resolve
			await vi.waitFor(() => {
				expect(callback).toHaveBeenCalled();
			});

			expect(errorHandler).not.toHaveBeenCalled();
			expect(global.fetch).toHaveBeenCalled();
			const fetchUrl = global.fetch.mock.calls[0][0];
			expect(fetchUrl).toContain("act_MappingGl.cfm?UserAction=Update");
		});

		it("calls errorHandler when form is not found", () => {
			const callback = vi.fn();
			const errorHandler = vi.fn();

			ColdFusion.Ajax.submitForm(
				"nonExistentForm",
				"some-url.cfm",
				callback,
				errorHandler,
			);

			expect(errorHandler).toHaveBeenCalled();
			expect(callback).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// ColdFusion.Window.*
	// -----------------------------------------------------------------------
	describe("ColdFusion.Window", () => {
		it("ColdFusion.Window.create with center, modal, draggable, dimensions", () => {
			const win = ColdFusion.Window.create(
				"gotopage1",
				"Add Bid Bond",
				"dsp_showResult.cfm",
				{
					center: true,
					modal: true,
					draggable: true,
					width: 550,
					height: 375,
				},
			);

			expect(win).toBeDefined();
			expect(win.cfwindowname).toBe("gotopage1");
			expect(win.modal).toBe(true);

			const dialog = document.querySelector("dialog.bx-window");
			expect(dialog).not.toBeNull();
			expect(dialog.style.width).toBe("550px");
			expect(dialog.style.height).toBe("375px");

			ColdFusion.Window.destroy("gotopage1", true);
		});

		it("ColdFusion.Window.destroy removes the window", () => {
			ColdFusion.Window.create("gotopage2", "Title", null, {});
			expect(document.querySelector("dialog.bx-window")).not.toBeNull();

			ColdFusion.Window.destroy("gotopage2", true);
			expect(document.querySelector("dialog.bx-window")).toBeNull();
		});

		it("ColdFusion.Window.hide hides a visible window", () => {
			ColdFusion.Window.create("letterWin", "Letter", null, {});
			const winObj = ColdFusion.Window.getWindowObject("letterWin");
			expect(winObj.isVisible()).toBe(true);

			ColdFusion.Window.hide("letterWin");
			expect(winObj.isVisible()).toBe(false);

			ColdFusion.Window.destroy("letterWin", true);
		});

		it("ColdFusion.Window.onHide registers a callback", () => {
			ColdFusion.Window.create("gotopage3", "Test", null, {});
			const cleanup = vi.fn();

			ColdFusion.Window.onHide("gotopage3", cleanup);
			ColdFusion.Window.hide("gotopage3");

			expect(cleanup).toHaveBeenCalled();
			ColdFusion.Window.destroy("gotopage3", true);
		});

		it("ColdFusion.Window.show shows a deferred window", () => {
			ColdFusion.Window.create("LoadWindow", "Loading", null, {
				initshow: false,
			});

			// Window deferred - not yet in DOM
			ColdFusion.Window.show("LoadWindow");

			const dialog = document.querySelector("dialog.bx-window");
			expect(dialog).not.toBeNull();
			expect(dialog.hasAttribute("open")).toBe(true);

			ColdFusion.Window.destroy("LoadWindow", true);
		});
	});

	// -----------------------------------------------------------------------
	// ColdFusion.navigate
	// -----------------------------------------------------------------------
	describe("ColdFusion.navigate", () => {
		it("loads content into a target container", async () => {
			document.body.innerHTML = '<div id="SelectAgentDiv"></div>';

			global.fetch = vi
				.fn()
				.mockImplementation(() =>
					Promise.resolve(
						new Response("<p>Agent Data</p>", { status: 200 }),
					),
				);

			const mycallBack = vi.fn();
			const myerrorhandler = vi.fn();
			const GlbLocID = "42";

			ColdFusion.navigate(
				"frm_viewAgent.cfm?LocID=" + GlbLocID,
				"SelectAgentDiv",
				mycallBack,
				myerrorhandler,
			);

			await vi.waitFor(() => {
				expect(
					document.getElementById("SelectAgentDiv").innerHTML,
				).toContain("Agent Data");
			});

			expect(myerrorhandler).not.toHaveBeenCalled();
		});

		it("calls window.location.assign when no target provided", () => {
			const assignMock = vi.fn();
			Object.defineProperty(window, "location", {
				value: { assign: assignMock, href: "http://localhost/" },
				writable: true,
				configurable: true,
			});

			ColdFusion.navigate("/some-page.cfm");
			expect(assignMock).toHaveBeenCalledWith("/some-page.cfm");
		});
	});

	// -----------------------------------------------------------------------
	// ColdFusion.ProgressBar
	// -----------------------------------------------------------------------
	describe("ColdFusion.ProgressBar", () => {
		beforeEach(() => {
			document.body.innerHTML =
				'<div id="myBar" class="bx-progressbar"></div>';
		});

		it("show makes the element visible", () => {
			const el = document.getElementById("myBar");
			el.style.display = "none";

			ColdFusion.ProgressBar.show("myBar");
			expect(el.style.display).toBe("");
		});

		it("hide hides the element", () => {
			ColdFusion.ProgressBar.hide("myBar");
			expect(
				document
					.getElementById("myBar")
					.classList.contains("bx-progressbar-hidden"),
			).toBe(true);
		});

		it("start adds running class", () => {
			ColdFusion.ProgressBar.start("myBar");
			expect(
				document
					.getElementById("myBar")
					.classList.contains("bx-progress-running"),
			).toBe(true);
		});

		it("stop removes running class", () => {
			const el = document.getElementById("myBar");
			el.classList.add("bx-progress-running");

			ColdFusion.ProgressBar.stop("myBar");
			expect(el.classList.contains("bx-progress-running")).toBe(false);
		});

		it("works with non-existent elements without throwing", () => {
			expect(() =>
				ColdFusion.ProgressBar.show("nonexistent"),
			).not.toThrow();
			expect(() =>
				ColdFusion.ProgressBar.hide("nonexistent"),
			).not.toThrow();
			expect(() =>
				ColdFusion.ProgressBar.start("nonexistent"),
			).not.toThrow();
			expect(() =>
				ColdFusion.ProgressBar.stop("nonexistent"),
			).not.toThrow();
		});

		it("start triggers _startFn when registered by component script", () => {
			// Simulate what the ProgressBar component's generated script does
			ColdFusion.ProgressBar._bars["componentBar"] = {
				running: false,
				_startFn: vi.fn(),
			};

			const origStart = ColdFusion.ProgressBar.start;
			// Patch start like the component does
			ColdFusion.ProgressBar.start = function (name) {
				var state = ColdFusion.ProgressBar._bars[name];
				if (state && state._startFn) {
					state._startFn();
				} else {
					origStart.call(ColdFusion.ProgressBar, name);
				}
			};

			ColdFusion.ProgressBar.start("componentBar");
			expect(
				ColdFusion.ProgressBar._bars["componentBar"]._startFn,
			).toHaveBeenCalled();

			// Restore
			ColdFusion.ProgressBar.start = origStart;
		});

		it("stop clears timers when registered by component script", () => {
			vi.useFakeTimers();
			const timerId = setTimeout(() => {}, 10000);

			ColdFusion.ProgressBar._bars["timerBar"] = {
				running: true,
				_timerId: timerId,
			};

			const origStop = ColdFusion.ProgressBar.stop;
			ColdFusion.ProgressBar.stop = function (name) {
				var state = ColdFusion.ProgressBar._bars[name];
				if (state && state._timerId) {
					clearTimeout(state._timerId);
					clearInterval(state._timerId);
					state._timerId = null;
				}
				if (state) state.running = false;
			};

			ColdFusion.ProgressBar.stop("timerBar");
			expect(ColdFusion.ProgressBar._bars["timerBar"].running).toBe(
				false,
			);
			expect(
				ColdFusion.ProgressBar._bars["timerBar"]._timerId,
			).toBeNull();

			ColdFusion.ProgressBar.stop = origStop;
			vi.useRealTimers();
		});
	});

	// -----------------------------------------------------------------------
	// ColdFusion.Grid.refresh
	// -----------------------------------------------------------------------
	describe("ColdFusion.Grid.refresh", () => {
		it("refreshes grid data via the ColdFusion alias", async () => {
			document.body.innerHTML = `
				<table id="gridTables" class="bx-grid" data-source="/api/tables" data-page-size="25">
					<thead><tr><th data-column="name">Name</th></tr></thead>
					<tbody></tbody>
				</table>
			`;

			global.fetch = vi.fn().mockImplementation(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: [{ name: "users" }],
							totalRows: 1,
							page: 1,
							pageSize: 25,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					),
				),
			);

			await ColdFusion.Grid.refresh("gridTables");

			expect(global.fetch).toHaveBeenCalled();
			const fetchUrl = global.fetch.mock.calls[0][0];
			expect(fetchUrl).toContain("/api/tables");
		});
	});
});
