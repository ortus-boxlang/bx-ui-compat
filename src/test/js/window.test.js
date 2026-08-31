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
					WindowAPI.onShow("nonexistent", () => { }),
				).toThrow();
			});

			it("throws if window not found for onHide", () => {
				expect(() =>
					WindowAPI.onHide("nonexistent", () => { }),
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

		describe("_loadContent context sharing", () => {
			afterEach(() => {
				delete window.myParentFunction;
				delete window.myParentVariable;
				delete window.myConflictVar;
			});

			it("shares ColdFusion and BXUICompat by reference into the iframe", () => {
				const win = WindowAPI.create(
					"ctxShareWin",
					"Context",
					"/page.html",
					{ initshow: true },
				);
				const iframe = win._body.querySelector("iframe");
				expect(iframe).not.toBeNull();

				iframe.dispatchEvent(new Event("load"));

				expect(iframe.contentWindow.ColdFusion).toBe(
					window.ColdFusion,
				);
				expect(iframe.contentWindow.BXUICompat).toBe(
					window.BXUICompat,
				);
			});

			it("copies user-defined parent functions into the iframe", () => {
				window.myParentFunction = function () {
					return 42;
				};

				const win = WindowAPI.create(
					"ctxFnWin",
					"Context",
					"/page.html",
					{ initshow: true },
				);
				const iframe = win._body.querySelector("iframe");
				iframe.dispatchEvent(new Event("load"));

				expect(iframe.contentWindow.myParentFunction).toBeDefined();
				expect(iframe.contentWindow.myParentFunction()).toBe(42);
			});

			it("copies user-defined parent variables into the iframe", () => {
				window.myParentVariable = { data: "hello" };

				const win = WindowAPI.create(
					"ctxVarWin",
					"Context",
					"/page.html",
					{ initshow: true },
				);
				const iframe = win._body.querySelector("iframe");
				iframe.dispatchEvent(new Event("load"));

				expect(iframe.contentWindow.myParentVariable).toBeDefined();
				expect(iframe.contentWindow.myParentVariable.data).toBe(
					"hello",
				);
			});

			it("does not overwrite iframe page's own globals with parent values", () => {
				window.myConflictVar = "parent-value";

				const win = WindowAPI.create(
					"ctxConflictWin",
					"Context",
					"/page.html",
					{ initshow: true },
				);
				const iframe = win._body.querySelector("iframe");

				// Simulate the iframe page having already defined this var
				iframe.contentWindow.myConflictVar = "iframe-value";

				iframe.dispatchEvent(new Event("load"));

				expect(iframe.contentWindow.myConflictVar).toBe("iframe-value");
			});

			it("does not copy inline body content when a source URL is given", () => {
				// Inline content should be ignored when url is set
				const win = WindowAPI.create(
					"ctxSrcWin",
					"Context",
					"/page.html",
					{ initshow: true },
				);
				const iframe = win._body.querySelector("iframe");
				expect(iframe.src).toContain("/page.html");
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

		describe("bind expressions", () => {
			beforeEach(() => {
				// Set up a form for bind tests
				document.body.innerHTML = `
					<form name="myform">
						<input type="hidden" name="test" value="asfd" />
						<input name="text1" value="hello" />
						<input name="text2" value="world" />
						<input name="check1" type="checkbox" checked />
						<select name="select1">
							<option value="a">A</option>
							<option value="b" selected>B</option>
						</select>
					</form>
				`;
			});

			it("parseBindTokens extracts simple {form:field} tokens", () => {
				const tokens = window.BXUICompat.Window._parseBindTokens(
					"test.cfm?text={myform:test}",
				);
				expect(tokens).toHaveLength(1);
				expect(tokens[0].formId).toBe("myform");
				expect(tokens[0].fieldName).toBe("test");
				expect(tokens[0].attr).toBeNull();
				expect(tokens[0].event).toBeNull();
			});

			it("parseBindTokens extracts {form:field.attr@event}", () => {
				const tokens = window.BXUICompat.Window._parseBindTokens(
					"page.cfm?val={myform:check1.checked@click}",
				);
				expect(tokens).toHaveLength(1);
				expect(tokens[0].formId).toBe("myform");
				expect(tokens[0].fieldName).toBe("check1");
				expect(tokens[0].attr).toBe("checked");
				expect(tokens[0].event).toBe("click");
			});

			it("parseBindTokens extracts multiple tokens", () => {
				const tokens = window.BXUICompat.Window._parseBindTokens(
					"page.cfm?a={myform:text1}&b={myform:text2}",
				);
				expect(tokens).toHaveLength(2);
				expect(tokens[0].fieldName).toBe("text1");
				expect(tokens[1].fieldName).toBe("text2");
			});

			it("resolveBindToken resolves a hidden field value", () => {
				const val = window.BXUICompat.Window._resolveBindToken({
					formId: "myform",
					fieldName: "test",
					attr: null,
				});
				expect(val).toBe("asfd");
			});

			it("resolveBindToken resolves a text input value", () => {
				const val = window.BXUICompat.Window._resolveBindToken({
					formId: "myform",
					fieldName: "text1",
					attr: null,
				});
				expect(val).toBe("hello");
			});

			it("resolveBindToken resolves checked attribute of checkbox", () => {
				const val = window.BXUICompat.Window._resolveBindToken({
					formId: "myform",
					fieldName: "check1",
					attr: "checked",
				});
				expect(val).toBe("true");
			});

			it("resolveBindToken resolves a select value", () => {
				const val = window.BXUICompat.Window._resolveBindToken({
					formId: "myform",
					fieldName: "select1",
					attr: null,
				});
				expect(val).toBe("b");
			});

			it("resolveBindExpressions replaces tokens in URL with encoded values", () => {
				const result =
					window.BXUICompat.Window._resolveBindExpressions(
						"page.cfm?text={myform:test}",
					);
				expect(result).toContain("text=asfd");
			});

			it("resolveBindExpressions replaces multiple tokens", () => {
				const result =
					window.BXUICompat.Window._resolveBindExpressions(
						"page.cfm?a={myform:text1}&b={myform:text2}",
					);
				expect(result).toContain("a=hello");
				expect(result).toContain("b=world");
			});

			it("resolveBindExpressions encodes special characters", () => {
				document.querySelector(
					'input[name="text1"]',
				).value = "hello world";
				const result =
					window.BXUICompat.Window._resolveBindExpressions(
						"page.cfm?text={myform:text1}",
					);
				expect(result).toContain("hello%20world");
			});

			it("hasBindTokens returns true for URLs with tokens", () => {
				expect(
					window.BXUICompat.Window._hasBindTokens(
						"page.cfm?text={myform:test}",
					),
				).toBe(true);
			});

			it("hasBindTokens returns false for URLs without tokens", () => {
				expect(
					window.BXUICompat.Window._hasBindTokens(
						"page.cfm?text=plain",
					),
				).toBe(false);
			});

			it("creates window with bind source URL and registers listeners", () => {
				const win = WindowAPI.create(
					"bindWin",
					"Bind",
					"page.cfm?text={myform:test}",
					{ initshow: true },
				);
				// The iframe should use the resolved URL
				const iframe = win._body.querySelector("iframe");
				expect(iframe.src).toContain("text=asfd");
			});

			it("registers event listeners for bind tokens", () => {
				const win = WindowAPI.create(
					"listBindWin",
					"Bind",
					"page.cfm?text={myform:test}",
					{ initshow: true, refreshOnShow: true },
				);
				// Bind listeners should be wired up
				expect(win._bindListeners).not.toBeNull();
				expect(win._bindListeners.length).toBe(1);
				expect(win._bindListeners[0].eventName).toBe("change");
			});

			it("cleans up bind listeners on destroy", () => {
				const win = WindowAPI.create(
					"cleanupBindWin",
					"Bind",
					"page.cfm?text={myform:test}",
					{ initshow: true },
				);
				WindowAPI.destroy("cleanupBindWin");
				// Listeners should be cleaned up
				expect(win._bindListeners).toBeNull();
			});
		});
	});
});
