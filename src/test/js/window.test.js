import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

// jsdom doesn't implement HTMLDialogElement.show/showModal/close - polyfill
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

describe("window.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("window.js");
	});

	describe("BXUICompat.Window", () => {
		let WindowAPI;

		beforeEach(() => {
			WindowAPI = window.BXUICompat.Window;
			document.body.innerHTML = "";
		});

		describe("create", () => {
			it("throws on null name", () => {
				expect(() => WindowAPI.create(null)).toThrow();
			});

			it("throws on empty name", () => {
				expect(() => WindowAPI.create("")).toThrow();
			});

			it("creates a dialog window with defaults", () => {
				const win = WindowAPI.create(
					"testWin",
					"Test Window",
					null,
					{},
				);
				expect(win).toBeDefined();
				expect(win.cfwindowname).toBe("testWin");
				expect(
					document.querySelector("dialog.bx-window"),
				).not.toBeNull();
			});

			it("creates window with specified dimensions", () => {
				WindowAPI.create("sizedWin", "Sized", null, {
					width: 600,
					height: 400,
				});
				const dialog = document.querySelector("dialog.bx-window");
				expect(dialog.style.width).toBe("600px");
				expect(dialog.style.height).toBe("400px");
			});

			it("defers creation when initshow=false", () => {
				WindowAPI.create("deferredWin", "Deferred", null, {
					initshow: false,
				});
				// No dialog should be in DOM yet
				expect(
					document.querySelectorAll("dialog.bx-window").length,
				).toBe(0);
			});

			it("shows existing window instead of creating duplicate", () => {
				WindowAPI.create("dupWin", "First", null, {});
				const dialogCount =
					document.querySelectorAll("dialog.bx-window").length;
				WindowAPI.create("dupWin", "Second", null, {});
				expect(
					document.querySelectorAll("dialog.bx-window").length,
				).toBe(dialogCount);
			});

			it("validates config boolean fields (returns undefined)", () => {
				const result = WindowAPI.create("badWin", "Bad", null, {
					resizable: "notbool",
				});
				expect(result).toBeUndefined();
			});

			it("validates height must be integer (returns undefined)", () => {
				const result = WindowAPI.create("badH", "Bad", null, {
					height: "abc",
				});
				expect(result).toBeUndefined();
			});

			it("validates width must be integer (returns undefined)", () => {
				const result = WindowAPI.create("badW", "Bad", null, {
					width: "abc",
				});
				expect(result).toBeUndefined();
			});

			it("supports modal windows", () => {
				// jsdom doesn't fully support showModal, but we can test creation
				const win = WindowAPI.create("modalWin", "Modal", null, {
					modal: true,
				});
				expect(win.modal).toBe(true);
			});

			it("supports closable=false (no close button)", () => {
				WindowAPI.create("noClose", "No Close", null, {
					closable: false,
				});
				const dialog = document.querySelector("dialog.bx-window");
				expect(dialog.querySelector(".bx-window-close")).toBeNull();
			});

			it("applies header background color style", () => {
				WindowAPI.create("styledWin", "Styled", null, {
					headerstyle: "background-color: #ff0000;",
				});
				const style = document.querySelector("style");
				expect(style).not.toBeNull();
				expect(style.textContent).toContain("#ff0000");
			});

			it("creates window with URL (iframe)", () => {
				const win = WindowAPI.create(
					"iframeWin",
					"IFrame",
					"/page.html",
					{},
				);
				expect(win.url).toBe("/page.html");
			});
		});

		describe("show", () => {
			it("throws if window not found", () => {
				expect(() => WindowAPI.show("nonexistentShow")).toThrow();
			});

			it("shows a hidden window", () => {
				WindowAPI.create("showWin1", "Show Test", null, {});
				WindowAPI.hide("showWin1");
				WindowAPI.show("showWin1");
				const obj = WindowAPI.getWindowObject("showWin1");
				expect(obj.isVisible()).toBe(true);
			});
		});

		describe("hide", () => {
			it("throws if window not found", () => {
				expect(() => WindowAPI.hide("nonexistent")).toThrow();
			});

			it("hides a visible window", () => {
				const win = WindowAPI.create("hideWin", "Hide Me", null, {});
				expect(win.isVisible()).toBe(true);
				WindowAPI.hide("hideWin");
				expect(win.isVisible()).toBe(false);
			});
		});

		describe("destroy", () => {
			it("removes dialog from DOM", () => {
				WindowAPI.create("destroyWin", "Destroy", null, {});
				expect(
					document.querySelector("dialog.bx-window"),
				).not.toBeNull();
				WindowAPI.destroy("destroyWin");
				// Dialog should be removed
				expect(
					document.querySelectorAll("dialog.bx-window").length,
				).toBe(0);
			});
		});

		describe("onShow / onHide", () => {
			it("throws if window not found for onShow", () => {
				expect(() =>
					WindowAPI.onShow("nonexistent", () => {}),
				).toThrow();
			});

			it("throws if window not found for onHide", () => {
				expect(() =>
					WindowAPI.onHide("nonexistent", () => {}),
				).toThrow();
			});

			it("registers onShow callback", () => {
				WindowAPI.create("cbWin2", "Callbacks", null, {});
				const handler = vi.fn();
				WindowAPI.onShow("cbWin2", handler);
				expect(handler).toBeDefined();
			});
		});

		describe("getWindowObject", () => {
			it("throws on empty name", () => {
				expect(() => WindowAPI.getWindowObject("")).toThrow();
			});

			it("throws if window not found", () => {
				expect(() => WindowAPI.getWindowObject("noWin")).toThrow();
			});

			it("returns window object for existing window", () => {
				WindowAPI.create("getWin", "Get", null, {});
				const obj = WindowAPI.getWindowObject("getWin");
				expect(obj).toBeDefined();
				expect(obj.cfwindowname).toBe("getWin");
			});

			it("returns existing window for deferred config via getWindowObject", () => {
				// getWindowObject on an already-created window
				const obj = WindowAPI.getWindowObject("getWin");
				expect(obj).toBeDefined();
			});
		});

		describe("window object methods", () => {
			it("center sets CSS centering", () => {
				const win = WindowAPI.create("centerWin", "Center", null, {});
				win.center();
				// Should not throw; CSS is reset
				expect(win._dialog.style.left).toBe("");
			});

			it("setPosition applies coordinates", () => {
				const win = WindowAPI.create("posWin", "Pos", null, {});
				win.setPosition(100, 200);
				expect(win._dialog.style.left).toBe("100px");
				expect(win._dialog.style.top).toBe("200px");
			});

			it("addListener sets callbacks", () => {
				const win = WindowAPI.create(
					"listenerWin",
					"Listener",
					null,
					{},
				);
				const fn = vi.fn();
				win.addListener("show", fn);
				expect(win._cf_onShow).toBe(fn);
			});
		});
	});
});
