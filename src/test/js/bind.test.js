/**
 * Tests for the CF-style `bind` attribute scanner in ajax-core.js.
 *
 * These cover the client-side auto-wiring added so plain HTML emitted by
 * sibling modules (e.g. bx-ui-forms <cfselect bind="cfc:...">) works without
 * any server-side registration glue.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Build a JSON Response with the given CF query wire format.
 */
function queryResponse(columns, rows) {
	return new Response(
		JSON.stringify({ COLUMNS: columns, DATA: rows, ROWCOUNT: rows.length }),
		{
			status: 200,
			headers: { "content-type": "application/json" },
		},
	);
}

describe("bind scanner", () => {
	let $B;

	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("ajaxproxy.js");
	});

	beforeEach(() => {
		$B = window.BXUICompat.Bind;
		document.body.innerHTML = "";
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			queryResponse(["VALUE", "DISPLAY"], []),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parseBindExpression", () => {
		it("parses a cfc bind with a reference argument", () => {
			const parsed = $B.parseBindExpression(
				"cfc:myService.getOptions({searchTerm})",
			);

			expect(parsed.type).toBe("cfc");
			expect(parsed.cfc).toBe("myService");
			expect(parsed.cfcFunction).toBe("getOptions");
			expect(parsed.argParts).toHaveLength(1);
			expect(parsed.argParts[0].token.control).toBe("searchTerm");
		});

		it("parses a cfc bind with form-qualified, attribute and event tokens", () => {
			const parsed = $B.parseBindExpression(
				"cfc:svc.get({exampleForm:sourceField.text@change})",
			);

			expect(parsed.type).toBe("cfc");
			expect(parsed.cfc).toBe("svc");
			expect(parsed.cfcFunction).toBe("get");

			const token = parsed.argParts[0].token;
			expect(token.form).toBe("exampleForm");
			expect(token.control).toBe("sourceField");
			expect(token.attr).toBe("text");
			expect(token.event).toBe("change");
		});

		it("parses a url bind preserving literals and tokens", () => {
			const parsed = $B.parseBindExpression(
				"url:/api/options?query={searchTerm}&page=1",
			);

			expect(parsed.type).toBe("url");
			expect(parsed.parts.filter((p) => p.token)).toHaveLength(1);
			expect(
				parsed.parts
					.map((p) => (p.token ? "{" + p.token.control + "}" : p.literal))
					.join(""),
			).toBe("/api/options?query={searchTerm}&page=1");
		});

		it("parses a javascript bind", () => {
			const parsed = $B.parseBindExpression(
				"javascript:handleResults({results})",
			);

			expect(parsed.type).toBe("javascript");
			expect(parsed.fnName).toBe("handleResults");
			expect(parsed.argParts[0].token.control).toBe("results");
		});

		it("treats an unprefixed value as a local bind", () => {
			const parsed = $B.parseBindExpression("{searchTerm}");

			expect(parsed.type).toBe("local");
			expect(parsed.parts[0].token.control).toBe("searchTerm");
		});
	});

	describe("bindElement", () => {
		it("defaults id to name and populates bindHandlerCache", () => {
			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})" bindonload="false"></select>
				</form>
			`;

			const select = document.querySelector("select");
			expect(select.id).toBe("");

			expect($B.bindElement(select)).toBe(true);

			// CF parity: id defaults to name so the bind target is addressable
			expect(select.id).toBe("results");

			// The ColdFusion bind cache must support manual event triggers.
			expect(window.BXUICompat.bindHandlerCache["results"]).toBeTypeOf(
				"function",
			);
			expect(window.ColdFusion.bindHandlerCache["results"]).toBeTypeOf(
				"function",
			);
		});

		it("is idempotent - repeated calls do not double-register", () => {
			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})" bindonload="false"></select>
				</form>
			`;

			const select = document.querySelector("select");
			$B.bindElement(select);

			$B.bindElement(select);
			$B.bindElement(select);

			const count = window.BXUICompat.Event.listeners.filter(
				(l) => l.el === document.getElementById("searchTerm"),
			).length;
			expect(count).toBe(1);
		});

		it("returns false when the element has no bind attribute", () => {
			document.body.innerHTML = '<select name="results"></select>';
			expect($B.bindElement(document.querySelector("select"))).toBe(false);
		});
	});

	describe("scan", () => {
		it("wires every [bind] element in the document", () => {
			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})" bindonload="false"></select>
				</form>
			`;

			expect($B.scan(document)).toBe(1);
			expect(document.querySelector("select").id).toBe("results");
			expect(window.BXUICompat.bindHandlerCache["results"]).toBeTypeOf(
				"function",
			);
		});

		it("returns 0 when there are no binds", () => {
			document.body.innerHTML = "<p>nothing here</p>";
			expect($B.scan(document)).toBe(0);
		});
	});

	describe("execution", () => {
		it("executes a cfc bind on load when bindonload is true", async () => {
			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})" bindonload="true"></select>
				</form>
			`;

			$B.scan(document);
			await flush();

			expect(globalThis.fetch).toHaveBeenCalled();
		});

		it("does not execute on load when bindonload is absent", async () => {
			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})"></select>
				</form>
			`;

			$B.scan(document);
			await flush();

			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it("re-runs the cfc bind when the source control changes", async () => {
			globalThis.fetch.mockResolvedValue(
				queryResponse(
					["OPTION_ID", "OPTION_LABEL"],
					[
						["1", "Option One"],
						["2", "Option Two"],
					],
				),
			);

			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})"></select>
				</form>
			`;

			$B.scan(document);

			// Trigger the bind
			document
				.getElementById("searchTerm")
				.dispatchEvent(new Event("change"));
			await flush();

			expect(globalThis.fetch).toHaveBeenCalledTimes(1);

			// Untyped CFC query results default to column 1 = value, 2 = display
			const select = document.getElementById("results");
			expect(select.options).toHaveLength(2);
			expect(select.options[0].value).toBe("1");
			expect(select.options[0].text).toBe("Option One");
			expect(select.options[1].value).toBe("2");
			expect(select.options[1].text).toBe("Option Two");
		});

		it("uses initSelect columns when the tag declares value/display", async () => {
			globalThis.fetch.mockResolvedValue(
				queryResponse(
					["OPTION_ID", "OPTION_LABEL", "CATEGORY"],
					[
						["1", "Option One", "A"],
						["2", "Option Two", "B"],
					],
				),
			);

			document.body.innerHTML = `
				<form name="exampleForm" id="exampleForm">
					<input name="searchTerm" id="searchTerm" value="example">
					<select name="results" bind="cfc:myService.getOptions({searchTerm})"></select>
				</form>
			`;

			// Declare the columns the tag knows about
			window.BXUICompat.initSelect("results", "OPTION_ID", "OPTION_LABEL", null);

			$B.scan(document);
			document
				.getElementById("searchTerm")
				.dispatchEvent(new Event("change"));
			await flush();

			const select = document.getElementById("results");
			expect(select.options[0].value).toBe("1");
			expect(select.options[0].text).toBe("Option One");
		});
	});
});
