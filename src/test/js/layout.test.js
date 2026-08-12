import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("layout.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("layout.js");
	});

	describe("BoxLangAjax.components.layout", () => {
		let layoutComp;

		beforeEach(() => {
			layoutComp = window.BoxLangAjax.components.layout;
			document.body.innerHTML = "";
		});

		describe("loadIntoArea", () => {
			it("rejects if layout not found", async () => {
				await expect(
					layoutComp.loadIntoArea("nonexistent", 0, "/url"),
				).rejects.toThrow("Layout not found");
			});

			it("loads into tab panel by index", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-tab">
						<div class="bx-tab-panel" id="panel0">old</div>
						<div class="bx-tab-panel" id="panel1">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("tab content", { status: 200 }),
				);

				await layoutComp.loadIntoArea("myLayout", 1, "/api/tab");
				expect(document.getElementById("panel1").innerHTML).toBe(
					"tab content",
				);
				vi.restoreAllMocks();
			});

			it("loads into accordion content by index", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-accordion">
						<div class="bx-accordion-content" id="acc0">old</div>
						<div class="bx-accordion-content" id="acc1">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("accordion content", { status: 200 }),
				);

				await layoutComp.loadIntoArea("myLayout", 0, "/api/acc");
				expect(document.getElementById("acc0").innerHTML).toBe(
					"accordion content",
				);
				vi.restoreAllMocks();
			});

			it("loads into border layout center area", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout">
						<div class="bx-border-center" id="center">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("center", { status: 200 }),
				);

				await layoutComp.loadIntoArea("myLayout", 0, "/api/center");
				expect(document.getElementById("center").innerHTML).toBe(
					"center",
				);
				vi.restoreAllMocks();
			});

			it("generates an ID if target area has none", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-tab">
						<div class="bx-tab-panel">no id</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("ok", { status: 200 }),
				);

				await layoutComp.loadIntoArea("myLayout", 0, "/api/tab");
				const panel = document.querySelector(".bx-tab-panel");
				expect(panel.id).toContain("myLayout_area_0");
				vi.restoreAllMocks();
			});

			it("rejects if area not found", async () => {
				document.body.innerHTML =
					'<div id="myLayout" class="bx-layout bx-layout-tab"></div>';
				await expect(
					layoutComp.loadIntoArea("myLayout", 5, "/url"),
				).rejects.toThrow("Layout area not found");
			});
		});

		describe("refreshAll", () => {
			it("rejects if layout not found", async () => {
				await expect(
					layoutComp.refreshAll("nonexistent"),
				).rejects.toThrow("Layout not found");
			});

			it("loads all areas with data-source", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout">
						<div id="area1" data-source="/api/a1">old</div>
						<div id="area2" data-source="/api/a2">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockImplementation(() =>
					Promise.resolve(new Response("loaded", { status: 200 })),
				);

				await layoutComp.refreshAll("myLayout");
				expect(document.getElementById("area1").innerHTML).toBe(
					"loaded",
				);
				expect(document.getElementById("area2").innerHTML).toBe(
					"loaded",
				);
				vi.restoreAllMocks();
			});
		});

		describe("switchTab", () => {
			it("rejects if not a tab layout", async () => {
				document.body.innerHTML =
					'<div id="myLayout" class="bx-layout"></div>';
				await expect(
					layoutComp.switchTab("myLayout", 0),
				).rejects.toThrow("Tab layout not found");
			});

			it("activates the correct tab", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-tab">
						<div class="bx-tab-header active">Tab 1</div>
						<div class="bx-tab-header">Tab 2</div>
						<div class="bx-tab-panel active" id="p0">Content 1</div>
						<div class="bx-tab-panel" id="p1">Content 2</div>
					</div>`;

				await layoutComp.switchTab("myLayout", 1);
				const headers = document.querySelectorAll(".bx-tab-header");
				const panels = document.querySelectorAll(".bx-tab-panel");
				expect(headers[0].classList.contains("active")).toBe(false);
				expect(headers[1].classList.contains("active")).toBe(true);
				expect(panels[0].classList.contains("active")).toBe(false);
				expect(panels[1].classList.contains("active")).toBe(true);
			});

			it("loads content via URL when switching", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-tab">
						<div class="bx-tab-header">Tab 1</div>
						<div class="bx-tab-panel" id="p0">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("new tab", { status: 200 }),
				);

				await layoutComp.switchTab("myLayout", 0, "/api/tab-content");
				expect(document.getElementById("p0").innerHTML).toBe("new tab");
				vi.restoreAllMocks();
			});

			it("rejects if tab index out of range", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-tab">
						<div class="bx-tab-header">Tab 1</div>
						<div class="bx-tab-panel" id="p0">Content</div>
					</div>`;
				await expect(
					layoutComp.switchTab("myLayout", 5),
				).rejects.toThrow("Tab index out of range");
			});
		});

		describe("toggleAccordion", () => {
			it("rejects if not an accordion layout", async () => {
				document.body.innerHTML =
					'<div id="myLayout" class="bx-layout"></div>';
				await expect(
					layoutComp.toggleAccordion("myLayout", 0),
				).rejects.toThrow("Accordion layout not found");
			});

			it("toggles collapsed state on panel", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-accordion">
						<div class="bx-accordion-panel">
							<div class="bx-accordion-content" id="ac0">Content</div>
						</div>
					</div>`;

				await layoutComp.toggleAccordion("myLayout", 0);
				expect(
					document
						.querySelector(".bx-accordion-panel")
						.classList.contains("collapsed"),
				).toBe(true);

				await layoutComp.toggleAccordion("myLayout", 0);
				expect(
					document
						.querySelector(".bx-accordion-panel")
						.classList.contains("collapsed"),
				).toBe(false);
			});

			it("loads content when expanding with URL", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-accordion">
						<div class="bx-accordion-panel collapsed">
							<div class="bx-accordion-content" id="ac0">old</div>
						</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("expanded", { status: 200 }),
				);

				await layoutComp.toggleAccordion("myLayout", 0, "/api/expand");
				expect(document.getElementById("ac0").innerHTML).toBe(
					"expanded",
				);
				vi.restoreAllMocks();
			});

			it("rejects if panel index out of range", async () => {
				document.body.innerHTML = `
					<div id="myLayout" class="bx-layout bx-layout-accordion">
						<div class="bx-accordion-panel"><div class="bx-accordion-content"></div></div>
					</div>`;
				await expect(
					layoutComp.toggleAccordion("myLayout", 10),
				).rejects.toThrow("Panel index out of range");
			});
		});
	});

	describe("BXUICompat.Layout facade", () => {
		it("exposes all public methods", () => {
			const facade = window.BXUICompat.Layout;
			expect(facade.loadIntoArea).toBeTypeOf("function");
			expect(facade.refreshAll).toBeTypeOf("function");
			expect(facade.switchTab).toBeTypeOf("function");
			expect(facade.toggleAccordion).toBeTypeOf("function");
		});
	});
});
