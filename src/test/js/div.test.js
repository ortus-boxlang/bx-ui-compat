import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("div.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("div.js");
	});

	describe("BoxLangAjax.components.div", () => {
		let divComp;

		beforeEach(() => {
			divComp = window.BoxLangAjax.components.div;
			document.body.innerHTML = "";
		});

		describe("refresh", () => {
			it("rejects if div not found", async () => {
				await expect(divComp.refresh("nonexistent")).rejects.toThrow(
					"Div not found",
				);
			});

			it("rejects if no source URL", async () => {
				document.body.innerHTML = '<div id="myDiv"></div>';
				await expect(divComp.refresh("myDiv")).rejects.toThrow(
					"No refresh URL found",
				);
			});

			it("loads content from data-source", async () => {
				document.body.innerHTML =
					'<div id="myDiv" data-source="/api/content"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("refreshed", { status: 200 }),
				);

				await divComp.refresh("myDiv");
				expect(document.getElementById("myDiv").innerHTML).toBe(
					"refreshed",
				);
				vi.restoreAllMocks();
			});

			it("appends params to URL", async () => {
				document.body.innerHTML =
					'<div id="myDiv" data-source="/api/data"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("ok", { status: 200 }),
				);

				await divComp.refresh("myDiv", { page: "2", size: "10" });
				const fetchUrl = globalThis.fetch.mock.calls[0][0];
				expect(fetchUrl).toContain("page=2");
				expect(fetchUrl).toContain("size=10");
				vi.restoreAllMocks();
			});

			it("uses data-refreshUrl as fallback", async () => {
				document.body.innerHTML =
					'<div id="myDiv" data-refresh-url="/alt/url"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("alt", { status: 200 }),
				);

				await divComp.refresh("myDiv");
				expect(document.getElementById("myDiv").innerHTML).toBe("alt");
				vi.restoreAllMocks();
			});
		});

		describe("autoRefresh", () => {
			it("returns undefined if div not found", () => {
				expect(
					divComp.autoRefresh("nonexistent", 1000),
				).toBeUndefined();
			});

			it("returns undefined if no URL", () => {
				document.body.innerHTML = '<div id="myDiv"></div>';
				expect(divComp.autoRefresh("myDiv", 1000)).toBeUndefined();
			});

			it("sets up interval for refresh", () => {
				document.body.innerHTML =
					'<div id="myDiv" data-source="/api/data"></div>';
				vi.useFakeTimers();
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("ok", { status: 200 }),
				);

				const intervalId = divComp.autoRefresh("myDiv", 5000);
				expect(intervalId).toBeDefined();
				expect(
					document
						.getElementById("myDiv")
						.classList.contains("bx-auto-refreshing"),
				).toBe(true);

				vi.useRealTimers();
				vi.restoreAllMocks();
			});
		});

		describe("stopAutoRefresh", () => {
			it("clears intervals and removes class", () => {
				document.body.innerHTML =
					'<div id="myDiv" class="bx-auto-refreshing" data-refresh-intervals="123,456,"></div>';
				divComp.stopAutoRefresh("myDiv");
				const div = document.getElementById("myDiv");
				expect(div.classList.contains("bx-auto-refreshing")).toBe(
					false,
				);
				expect(div.dataset.refreshIntervals).toBeUndefined();
			});

			it("handles missing div gracefully", () => {
				expect(() =>
					divComp.stopAutoRefresh("nonexistent"),
				).not.toThrow();
			});
		});

		describe("loadWithOverlay", () => {
			it("rejects if div not found", async () => {
				await expect(
					divComp.loadWithOverlay("nonexistent", "/url"),
				).rejects.toThrow("Div not found");
			});

			it("loads content with overlay and removes it on success", async () => {
				document.body.innerHTML = '<div id="myDiv">old</div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("<p>new</p>", { status: 200 }),
				);

				await divComp.loadWithOverlay("myDiv", "/api/content");
				const div = document.getElementById("myDiv");
				expect(div.innerHTML).toBe("<p>new</p>");
				expect(div.classList.contains("bx-source-loaded")).toBe(true);
				expect(div.querySelector(".bx-ajax-overlay")).toBeNull();
				vi.restoreAllMocks();
			});

			it("shows error template on failure", async () => {
				document.body.innerHTML = '<div id="myDiv">old</div>';
				vi.spyOn(globalThis, "fetch").mockRejectedValue(
					new Error("Server error"),
				);
				window.BoxLangAjax.config.retryAttempts = 1;

				await expect(
					divComp.loadWithOverlay("myDiv", "/api/fail"),
				).rejects.toThrow("Server error");
				const div = document.getElementById("myDiv");
				expect(div.classList.contains("bx-source-error")).toBe(true);
				expect(div.innerHTML).toContain("Failed to load content");

				vi.restoreAllMocks();
				window.BoxLangAjax.config.retryAttempts = 3;
			});

			it("dispatches div-loaded custom event", async () => {
				document.body.innerHTML = '<div id="myDiv"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("loaded", { status: 200 }),
				);

				const handler = vi.fn();
				document
					.getElementById("myDiv")
					.addEventListener("div-loaded", handler);

				await divComp.loadWithOverlay("myDiv", "/content");
				expect(handler).toHaveBeenCalled();
				expect(handler.mock.calls[0][0].detail.content).toBe("loaded");
				vi.restoreAllMocks();
			});
		});

		describe("appendContent", () => {
			it("rejects if div not found", async () => {
				await expect(
					divComp.appendContent("nonexistent", "/url"),
				).rejects.toThrow("Div not found");
			});

			it("appends content to existing content", async () => {
				document.body.innerHTML =
					'<div id="myDiv"><p>existing</p></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("<p>appended</p>", { status: 200 }),
				);

				await divComp.appendContent("myDiv", "/api/more");
				const div = document.getElementById("myDiv");
				expect(div.querySelectorAll("p").length).toBe(2);
				expect(div.innerHTML).toContain("existing");
				expect(div.innerHTML).toContain("appended");
				vi.restoreAllMocks();
			});

			it("removes loading indicator after success", async () => {
				document.body.innerHTML = '<div id="myDiv"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("<span>more</span>", { status: 200 }),
				);

				await divComp.appendContent("myDiv", "/api/more");
				expect(document.querySelector(".bx-append-loading")).toBeNull();
				vi.restoreAllMocks();
			});
		});
	});

	describe("BXUICompat.Div facade", () => {
		it("exposes refresh, load, appendContent, stopRefresh", () => {
			const facade = window.BXUICompat.Div;
			expect(facade.refresh).toBeTypeOf("function");
			expect(facade.load).toBeTypeOf("function");
			expect(facade.appendContent).toBeTypeOf("function");
			expect(facade.stopRefresh).toBeTypeOf("function");
		});
	});
});
