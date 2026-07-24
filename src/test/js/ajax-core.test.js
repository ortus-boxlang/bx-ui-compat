import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("ajax-core.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
	});

	describe("Namespace initialization", () => {
		it("should define window.BXUICompat", () => {
			expect(window.BXUICompat).toBeDefined();
			expect(window.BXUICompat.version).toBe("2.0.0");
		});

		it("should define window.ColdFusion as alias of BXUICompat", () => {
			expect(window.ColdFusion).toBe(window.BXUICompat);
		});

		it("should define window.BoxLangAjax internal namespace", () => {
			expect(window.BoxLangAjax).toBeDefined();
			expect(window.BoxLangAjax.version).toBe("2.0.0");
		});
	});

	describe("BXUICompat.Log", () => {
		it("should expose log methods", () => {
			const $C = window.BXUICompat;
			expect($C.Log.debug).toBeTypeOf("function");
			expect($C.Log.info).toBeTypeOf("function");
			expect($C.Log.warn).toBeTypeOf("function");
			expect($C.Log.error).toBeTypeOf("function");
			expect($C.Log.dump).toBeTypeOf("function");
		});

		it("should call console methods with formatted messages", () => {
			const spy = vi.spyOn(console, "info").mockImplementation(() => {});
			window.BXUICompat.Log.info("test message", "testCat");
			expect(spy).toHaveBeenCalledWith(
				"[BXUICompat:testCat] test message",
			);
			spy.mockRestore();
		});
	});

	describe("BXUICompat.Util", () => {
		let $U;

		beforeEach(() => {
			$U = window.BXUICompat.Util;
		});

		it("isWhitespace detects whitespace-only strings", () => {
			expect($U.isWhitespace("   ")).toBe(true);
			expect($U.isWhitespace("  a ")).toBe(false);
			expect($U.isWhitespace("")).toBe(true);
		});

		it("isInteger validates integers", () => {
			expect($U.isInteger(5)).toBe(true);
			expect($U.isInteger("123")).toBe(true);
			expect($U.isInteger(-1)).toBe(false);
			expect($U.isInteger("3.5")).toBe(false);
		});

		it("isArray delegates to Array.isArray", () => {
			expect($U.isArray([])).toBe(true);
			expect($U.isArray({})).toBe(false);
		});

		it("isBoolean validates booleans", () => {
			expect($U.isBoolean(true)).toBe(true);
			expect($U.isBoolean("false")).toBe(true);
			expect($U.isBoolean("yes")).toBe(false);
		});

		it("castBoolean converts values", () => {
			expect($U.castBoolean(true)).toBe(true);
			expect($U.castBoolean("true")).toBe(true);
			expect($U.castBoolean("false")).toBe(false);
			expect($U.castBoolean(0)).toBe(false);
		});

		it("checkQuery detects row-format CF query", () => {
			const rowQuery = {
				COLUMNS: ["ID", "NAME"],
				DATA: [
					[1, "Foo"],
					[2, "Bar"],
				],
			};
			expect($U.checkQuery(rowQuery)).toBe("row");
		});

		it("checkQuery detects col-format CF query", () => {
			const colQuery = {
				COLUMNS: ["ID", "NAME"],
				ROWCOUNT: 2,
				DATA: { ID: [1, 2], NAME: ["Foo", "Bar"] },
			};
			expect($U.checkQuery(colQuery)).toBe("col");
		});

		it("checkQuery returns null for non-query objects", () => {
			expect($U.checkQuery({ foo: "bar" })).toBeNull();
			expect($U.checkQuery(null)).toBeNull();
		});

		it("extractReturnFormat parses URL param", () => {
			expect($U.extractReturnFormat("/api?returnFormat=JSON&x=1")).toBe(
				"JSON",
			);
			expect($U.extractReturnFormat("/api?x=1")).toBeNull();
		});
	});

	describe("BXUICompat.JSON", () => {
		let $J;

		beforeEach(() => {
			$J = window.BXUICompat.JSON;
		});

		it("encode serializes objects to JSON", () => {
			expect($J.encode({ a: 1 })).toBe('{"a":1}');
		});

		it("encode serializes Date objects (via toJSON/ISO format)", () => {
			const d = new Date(2024, 0, 15, 10, 30, 45);
			const result = $J.encode({ d: d });
			// Note: JSON.stringify calls Date.toJSON() before the replacer sees it
			// so the value arrives as an ISO string. This test confirms encode works.
			expect(result).toContain("2024-01-15");
		});

		it("decode parses JSON strings", () => {
			expect($J.decode('{"a":1}')).toEqual({ a: 1 });
		});

		it("decode returns object as-is if already parsed", () => {
			const obj = { x: 1 };
			expect($J.decode(obj)).toBe(obj);
		});

		it("decode handles whitespace-only and null gracefully", () => {
			expect($J.decode("")).toBeNull();
			expect($J.decode("   ")).toBeNull();
			expect($J.decode(null)).toBeNull();
		});
	});

	describe("BXUICompat.DOM", () => {
		let $D;

		beforeEach(() => {
			$D = window.BXUICompat.DOM;
			document.body.innerHTML =
				'<div id="test-el">Hello</div><span class="item">A</span>';
		});

		it("get returns element by ID string", () => {
			const el = $D.get("test-el");
			expect(el).not.toBeNull();
			expect(el.textContent).toBe("Hello");
		});

		it("get returns null for missing element", () => {
			expect($D.get("nonexistent")).toBeNull();
		});

		it("get returns element directly if passed an element", () => {
			const el = document.getElementById("test-el");
			expect($D.get(el)).toBe(el);
		});

		it("getElementsBy filters elements", () => {
			document.body.innerHTML = '<input name="foo"/><input name="bar"/>';
			const results = $D.getElementsBy(
				(el) => el.name === "foo",
				"input",
			);
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("foo");
		});
	});

	describe("BXUICompat.Event", () => {
		let $E;

		beforeEach(() => {
			$E = window.BXUICompat.Event;
		});

		it("should expose the Event API", () => {
			expect($E.addListener).toBeTypeOf("function");
			expect($E.registerOnLoad).toBeTypeOf("function");
			expect($E.CustomEvent).toBeTypeOf("function");
			expect($E.addOnLoad).toBeTypeOf("function");
		});

		it("CustomEvent creates subscribable events", () => {
			const evt = $E.CustomEvent("testEvent", document.body);
			const handler = vi.fn();
			evt.subscribe(handler, { key: "value" });
			evt.fire();
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(evt, { key: "value" });
		});

		it("CustomEvent unsubscribe clears handlers", () => {
			const evt = $E.CustomEvent("testEvent", document.body);
			const handler = vi.fn();
			evt.subscribe(handler);
			evt.unsubscribe();
			evt.fire();
			expect(handler).not.toHaveBeenCalled();
		});

		it("addListener attaches DOM event handlers", () => {
			document.body.innerHTML = '<button id="btn">Click</button>';
			const btn = document.getElementById("btn");
			const handler = vi.fn();
			$E.addListener(btn, "click", handler, { data: 1 });
			btn.click();
			expect(handler).toHaveBeenCalled();
		});

		it("isListener detects registered listeners", () => {
			document.body.innerHTML = '<button id="btn2">Click</button>';
			const btn = document.getElementById("btn2");
			const handler = vi.fn();
			$E.addListener(btn, "click", handler, null);
			expect($E.isListener(btn, "click", handler, null)).toBe(true);
			expect($E.isListener(btn, "click", vi.fn(), null)).toBe(false);
		});
	});

	describe("BXUICompat.Ajax", () => {
		let $A;

		beforeEach(() => {
			$A = window.BXUICompat.Ajax;
		});

		it("should expose Ajax methods", () => {
			expect($A.sendMessage).toBeTypeOf("function");
			expect($A.submitForm).toBeTypeOf("function");
			expect($A.replaceHTML).toBeTypeOf("function");
			expect($A.checkForm).toBeTypeOf("function");
		});

		it("sendMessage makes a fetch request", async () => {
			const mockResponse = new Response("hello", { status: 200 });
			vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

			const result = await $A.sendMessage("/api/test", "GET");
			expect(globalThis.fetch).toHaveBeenCalled();
			expect(result).toBe("hello");

			vi.restoreAllMocks();
		});

		it("sendMessage passes POST body correctly", async () => {
			const mockResponse = new Response('{"ok":true}', {
				status: 200,
				headers: { "content-type": "application/json" },
			});
			vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

			const result = await $A.sendMessage(
				"/api/save",
				"POST",
				"name=test&value=1",
			);
			const fetchCall = globalThis.fetch.mock.calls[0];
			expect(fetchCall[1].method).toBe("POST");
			expect(fetchCall[1].body).toBe("name=test&value=1");
			expect(result).toEqual({ ok: true });

			vi.restoreAllMocks();
		});

		it("replaceHTML injects content into container", async () => {
			document.body.innerHTML = '<div id="target">old</div>';
			const mockResponse = new Response("<p>new content</p>", {
				status: 200,
			});
			vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

			await new Promise((resolve) => {
				$A.replaceHTML("target", "/api/content", "GET", null, resolve);
			});

			expect(document.getElementById("target").innerHTML).toBe(
				"<p>new content</p>",
			);
			vi.restoreAllMocks();
		});
	});

	describe("BXUICompat.Bind", () => {
		it("should expose Bind methods", () => {
			const $B = window.BXUICompat.Bind;
			expect($B.register).toBeTypeOf("function");
			expect($B.assignValue).toBeTypeOf("function");
			expect($B.getBindElementValue).toBeTypeOf("function");
			expect($B.localBindHandler).toBeTypeOf("function");
			expect($B.jsBindHandler).toBeTypeOf("function");
			expect($B.urlBindHandler).toBeTypeOf("function");
		});

		it("getBindElementValue reads input value", () => {
			document.body.innerHTML =
				'<input id="myInput" name="myInput" value="hello"/>';
			const val = window.BXUICompat.Bind.getBindElementValue("myInput");
			expect(val).toBe("hello");
		});

		it("getBindElementValue reads select value", () => {
			document.body.innerHTML = `
				<select id="mySelect" name="mySelect">
					<option value="a">A</option>
					<option value="b" selected>B</option>
				</select>
			`;
			const val = window.BXUICompat.Bind.getBindElementValue("mySelect");
			expect(val).toBe("b");
		});

		it("assignValue sets element value", () => {
			document.body.innerHTML = '<input id="out" value=""/>';
			window.BXUICompat.Bind.assignValue("out", "value", "updated");
			expect(document.getElementById("out").value).toBe("updated");
		});
	});

	describe("Root-level helpers", () => {
		let $C;

		beforeEach(() => {
			$C = window.BXUICompat;
		});

		it("trim handles null and whitespace", () => {
			expect($C.trim(null)).toBe("");
			expect($C.trim("  hello  ")).toBe("hello");
		});

		it("clone creates shallow copy", () => {
			const obj = { a: 1, b: { c: 2 } };
			const copy = $C.clone(obj);
			expect(copy).toEqual(obj);
			expect(copy).not.toBe(obj);
			expect(copy.b).toBe(obj.b); // shallow
		});

		it("clone deep creates deep copy", () => {
			const obj = { a: 1, b: { c: 2 } };
			const copy = $C.clone(obj, true);
			expect(copy).toEqual(obj);
			expect(copy.b).not.toBe(obj.b);
		});

		it("getFormQueryString serializes form data", () => {
			document.body.innerHTML = `
				<form id="testForm">
					<input name="name" value="John"/>
					<input name="age" value="30"/>
				</form>
			`;
			const qs = $C.getFormQueryString("testForm");
			expect(qs).toContain("name=John");
			expect(qs).toContain("age=30");
		});

		it("getFormQueryString returns -1 for missing form", () => {
			expect($C.getFormQueryString("nonexistent")).toBe(-1);
		});

		it("getFormQueryString as object returns key-value map", () => {
			document.body.innerHTML = `
				<form id="objForm">
					<input name="x" value="1"/>
					<input name="y" value="2"/>
				</form>
			`;
			const obj = $C.getFormQueryString("objForm", true);
			expect(obj).toEqual({ x: "1", y: "2" });
		});

		it("handleError calls user error handler", () => {
			const handler = vi.fn();
			$C.handleError(handler, "something failed", "test", null, 500);
			expect(handler).toHaveBeenCalledWith(
				500,
				"something failed",
				undefined,
			);
		});

		it("handleError calls global handler when no local handler", () => {
			const globalHandler = vi.fn();
			$C.setGlobalErrorHandler(globalHandler);
			$C.handleError(null, "global error", "test");
			expect(globalHandler).toHaveBeenCalledWith("global error");
		});

		it("navigate calls replaceHTML when target is provided", async () => {
			document.body.innerHTML = '<div id="nav-target">old</div>';
			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response("navigated", { status: 200 }),
			);

			await new Promise((resolve) => {
				$C.navigate("/new-page", "nav-target", resolve);
			});

			expect(document.getElementById("nav-target").innerHTML).toBe(
				"navigated",
			);
			vi.restoreAllMocks();
		});

		it("initSelect stores metadata in objectCache", () => {
			$C.initSelect("mySelect", "ID", "NAME", ["1", "2"]);
			expect($C.objectCache["mySelect"]).toEqual({
				valueCol: "ID",
				displayCol: "NAME",
				selected: ["1", "2"],
			});
		});
	});

	describe("BoxLangAjax.utils", () => {
		it("fetchContent retries on server errors", async () => {
			let attempts = 0;
			vi.spyOn(globalThis, "fetch").mockImplementation(() => {
				attempts++;
				if (attempts < 3) {
					return Promise.reject(new Error("Network error"));
				}
				return Promise.resolve(new Response("ok", { status: 200 }));
			});

			// Reduce retry delay for test speed
			window.BoxLangAjax.config.retryDelay = 10;

			const result =
				await window.BoxLangAjax.utils.fetchContent("/api/test");
			expect(result).toBe("ok");
			expect(attempts).toBe(3);

			vi.restoreAllMocks();
		});

		it("fetchContent does not retry on 4xx errors", async () => {
			let attempts = 0;
			vi.spyOn(globalThis, "fetch").mockImplementation(() => {
				attempts++;
				return Promise.resolve(
					new Response("Not Found", {
						status: 404,
						statusText: "Not Found",
					}),
				);
			});

			window.BoxLangAjax.config.retryDelay = 10;

			await expect(
				window.BoxLangAjax.utils.fetchContent("/api/missing"),
			).rejects.toThrow("HTTP 404");
			expect(attempts).toBe(1);

			vi.restoreAllMocks();
		});

		it("loadIntoContainer updates element innerHTML", async () => {
			document.body.innerHTML = '<div id="container">old</div>';
			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response("<b>new</b>", { status: 200 }),
			);

			await window.BoxLangAjax.utils.loadIntoContainer(
				"container",
				"/content",
			);
			expect(document.getElementById("container").innerHTML).toBe(
				"<b>new</b>",
			);

			vi.restoreAllMocks();
		});

		it("loadIntoContainer rejects for missing container", async () => {
			await expect(
				window.BoxLangAjax.utils.loadIntoContainer(
					"nonexistent",
					"/content",
				),
			).rejects.toThrow("Container not found");
		});
	});

	describe("BXUICompat.Bind grid-dependent registry", () => {
		let $B;

		beforeEach(() => {
			$B = window.BXUICompat.Bind;
			document.body.innerHTML = "";
		});

		it("resolveGridColumnValue returns column value when selectedRowData exists", () => {
			document.body.innerHTML =
				'<div id="myGrid" data-name="myGrid" data-selected-row-data=\'{"LocID":"LOC123","Name":"Test"}\'></div>';
			expect($B.resolveGridColumnValue("myGrid", "LocID")).toBe("LOC123");
			expect($B.resolveGridColumnValue("myGrid", "Name")).toBe("Test");
		});

		it("resolveGridColumnValue returns empty string when column not in data", () => {
			document.body.innerHTML =
				'<div id="myGrid" data-name="myGrid" data-selected-row-data=\'{"LocID":"LOC123"}\'></div>';
			expect($B.resolveGridColumnValue("myGrid", "MissingCol")).toBe("");
		});

		it("resolveGridColumnValue returns empty string when no selectedRowData", () => {
			document.body.innerHTML =
				'<div id="myGrid" data-name="myGrid"></div>';
			expect($B.resolveGridColumnValue("myGrid", "LocID")).toBe("");
		});

		it("resolveGridColumnValue returns empty string when grid not found", () => {
			expect($B.resolveGridColumnValue("nonexistent", "LocID")).toBe("");
		});

		it("registerGridDependent and unregisterGridDependent work end-to-end", () => {
			const fn = vi.fn();
			// Register
			$B.registerGridDependent("gridTables", "div1", fn);
			// Register again with same id — should not duplicate
			$B.registerGridDependent("gridTables", "div1", fn);
			// Unregister
			$B.unregisterGridDependent("gridTables", "div1");

			// After unregister, dispatch should NOT trigger the fn
			document.body.innerHTML =
				'<div id="gridTables" data-name="gridTables"></div>';
			const event = new CustomEvent("gridSelectionChange", {
				detail: { gridName: "gridTables" },
				bubbles: true,
			});
			document.getElementById("gridTables").dispatchEvent(event);
			expect(fn).not.toHaveBeenCalled();
		});

		it("gridSelectionChange triggers registered dependents", () => {
			document.body.innerHTML =
				'<div id="gridTables" data-name="gridTables"></div>';
			const fn = vi.fn();
			$B.registerGridDependent("gridTables", "div1", fn);
			const event = new CustomEvent("gridSelectionChange", {
				detail: { gridName: "gridTables" },
			});
			document.dispatchEvent(event);
			expect(fn).toHaveBeenCalled();
		});

		it("resolveBindExpression replaces grid tokens", () => {
			document.body.innerHTML =
				'<div id="myGrid" data-name="myGrid" data-selected-row-data=\'{"LocID":"LOC123"}\'></div>';
			const result = $B.resolveBindExpression(
				"url:page.cfm?id={myGrid.LocID}&name={myGrid.Name}",
			);
			expect(result).toBe("url:page.cfm?id=LOC123&name=");
		});
	});
});
