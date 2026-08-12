import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("tooltip.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("tooltip.js");
	});

	describe("BoxLangAjax.components.tooltip", () => {
		let ttComp;

		beforeEach(() => {
			ttComp = window.BoxLangAjax.components.tooltip;
			document.body.innerHTML = "";
		});

		describe("loadContent", () => {
			it("rejects if tooltip not found", async () => {
				await expect(
					ttComp.loadContent("nonexistent", "/url"),
				).rejects.toThrow("Tooltip not found");
			});

			it("loads content into tooltip element", async () => {
				document.body.innerHTML =
					'<div id="myTip" class="bx-tooltip">old</div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("tip content", { status: 200 }),
				);

				await ttComp.loadContent("myTip", "/api/tooltip");
				const tip = document.getElementById("myTip");
				expect(tip.innerHTML).toBe("tip content");
				expect(tip.classList.contains("bx-ajax-loaded")).toBe(true);
				expect(tip.classList.contains("bx-ajax-loading")).toBe(false);
				vi.restoreAllMocks();
			});

			it("shows error message on failure", async () => {
				document.body.innerHTML =
					'<div id="myTip" class="bx-tooltip"></div>';
				vi.spyOn(globalThis, "fetch").mockRejectedValue(
					new Error("timeout"),
				);
				window.BoxLangAjax.config.retryAttempts = 1;

				await expect(
					ttComp.loadContent("myTip", "/api/fail"),
				).rejects.toThrow("timeout");
				const tip = document.getElementById("myTip");
				expect(tip.innerHTML).toContain("Error: timeout");
				expect(tip.classList.contains("bx-ajax-error")).toBe(true);

				vi.restoreAllMocks();
				window.BoxLangAjax.config.retryAttempts = 3;
			});

			it("dispatches tooltip-loaded event", async () => {
				document.body.innerHTML =
					'<div id="myTip" class="bx-tooltip"></div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("data", { status: 200 }),
				);

				const handler = vi.fn();
				document
					.getElementById("myTip")
					.addEventListener("tooltip-loaded", handler);
				await ttComp.loadContent("myTip", "/api/tip");
				expect(handler).toHaveBeenCalled();
				vi.restoreAllMocks();
			});
		});

		describe("show", () => {
			it("rejects if elements not found", async () => {
				await expect(ttComp.show("noTrigger", "noTip")).rejects.toThrow(
					"Elements not found",
				);
			});

			it("shows tooltip and sets visible class", async () => {
				document.body.innerHTML = `
					<button id="trigger">Hover me</button>
					<div id="tip" class="bx-tooltip" style="display:none">Tooltip</div>`;

				await ttComp.show("trigger", "tip");
				const tip = document.getElementById("tip");
				expect(tip.style.display).toBe("block");
				expect(tip.classList.contains("bx-tooltip-visible")).toBe(true);
			});

			it("loads content when URL provided", async () => {
				document.body.innerHTML = `
					<button id="trigger">Hover</button>
					<div id="tip" class="bx-tooltip" style="display:none"></div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("ajax tip", { status: 200 }),
				);

				await ttComp.show("trigger", "tip", "/api/tooltip");
				expect(document.getElementById("tip").innerHTML).toBe(
					"ajax tip",
				);
				vi.restoreAllMocks();
			});
		});

		describe("hide", () => {
			it("hides tooltip after delay", async () => {
				vi.useFakeTimers();
				document.body.innerHTML =
					'<div id="tip" class="bx-tooltip bx-tooltip-visible" style="display:block">content</div>';

				ttComp.hide("tip", 100);
				vi.advanceTimersByTime(100);

				const tip = document.getElementById("tip");
				expect(tip.style.display).toBe("none");
				expect(tip.classList.contains("bx-tooltip-visible")).toBe(
					false,
				);
				vi.useRealTimers();
			});

			it("handles missing tooltip gracefully", () => {
				expect(() => ttComp.hide("nonexistent")).not.toThrow();
			});
		});

		describe("reposition", () => {
			it("does nothing if tooltip not visible", () => {
				document.body.innerHTML =
					'<div id="tip" class="bx-tooltip"></div>';
				expect(() => ttComp.reposition("tip")).not.toThrow();
			});

			it("does nothing if no trigger reference", () => {
				document.body.innerHTML =
					'<div id="tip" class="bx-tooltip bx-tooltip-visible"></div>';
				expect(() => ttComp.reposition("tip")).not.toThrow();
			});
		});

		describe("setupHover", () => {
			it("does nothing if trigger not found", () => {
				expect(() =>
					ttComp.setupHover("noEl", "tip", "/url"),
				).not.toThrow();
			});

			it("attaches mouseenter/mouseleave handlers", () => {
				document.body.innerHTML = `
					<button id="trigger">Hover</button>
					<div id="tip" class="bx-tooltip" style="display:none"></div>`;

				ttComp.setupHover("trigger", "tip", "/api/tip", {
					showDelay: 0,
					hideDelay: 0,
				});

				// Verify no error when triggering
				const trigger = document.getElementById("trigger");
				expect(() =>
					trigger.dispatchEvent(new Event("mouseenter")),
				).not.toThrow();
				expect(() =>
					trigger.dispatchEvent(new Event("mouseleave")),
				).not.toThrow();
			});
		});

		describe("setupClick", () => {
			it("does nothing if trigger not found", () => {
				expect(() =>
					ttComp.setupClick("noEl", "tip", "/url"),
				).not.toThrow();
			});

			it("toggles tooltip on click", async () => {
				document.body.innerHTML = `
					<button id="trigger">Click</button>
					<div id="tip" class="bx-tooltip" style="display:none"></div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("clicked", { status: 200 }),
				);

				ttComp.setupClick("trigger", "tip", "/api/tip");
				document.getElementById("trigger").click();

				await new Promise((r) => setTimeout(r, 50));
				expect(
					document
						.getElementById("tip")
						.classList.contains("bx-tooltip-visible"),
				).toBe(true);
				vi.restoreAllMocks();
			});
		});

		describe("refresh", () => {
			it("rejects if no URL on tooltip", () => {
				document.body.innerHTML =
					'<div id="tip" class="bx-tooltip"></div>';
				expect(ttComp.refresh("tip")).rejects.toThrow(
					"No refresh URL found",
				);
			});

			it("reloads content from data-source", async () => {
				document.body.innerHTML =
					'<div id="tip" class="bx-tooltip" data-source="/api/tip">old</div>';
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("refreshed", { status: 200 }),
				);

				await ttComp.refresh("tip");
				expect(document.getElementById("tip").innerHTML).toBe(
					"refreshed",
				);
				vi.restoreAllMocks();
			});
		});
	});

	describe("BXUICompat.Tooltip facade", () => {
		it("exposes loadContent method", () => {
			expect(window.BXUICompat.Tooltip.loadContent).toBeTypeOf(
				"function",
			);
		});
	});
});
