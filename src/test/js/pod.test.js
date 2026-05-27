import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("pod.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("pod.js");
	});

	describe("BoxLangAjax.components.pod", () => {
		let podComp;

		beforeEach(() => {
			podComp = window.BoxLangAjax.components.pod;
			document.body.innerHTML = "";
		});

		describe("refresh", () => {
			it("rejects if pod not found", async () => {
				await expect(podComp.refresh("nonexistent")).rejects.toThrow(
					"Pod not found",
				);
			});

			it("rejects if no source URL", async () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"><div class="bx-pod-content"></div></div>';
				await expect(podComp.refresh("myPod")).rejects.toThrow(
					"No refresh URL found",
				);
			});

			it("rejects if no content area", async () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod" data-source="/api"></div>';
				await expect(podComp.refresh("myPod")).rejects.toThrow(
					"Pod content area not found",
				);
			});

			it("loads content into pod-content area", async () => {
				document.body.innerHTML = `
					<div id="myPod" class="bx-pod" data-source="/api/pod">
						<div class="bx-pod-content">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("new content", { status: 200 }),
				);

				await podComp.refresh("myPod");
				expect(
					document.querySelector(".bx-pod-content").innerHTML,
				).toBe("new content");
				expect(
					document
						.querySelector(".bx-pod-content")
						.classList.contains("bx-source-loaded"),
				).toBe(true);
				vi.restoreAllMocks();
			});

			it("shows and removes overlay when showOverlay=true", async () => {
				document.body.innerHTML = `
					<div id="myPod" class="bx-pod" data-source="/api/pod">
						<div class="bx-pod-content">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("ok", { status: 200 }),
				);

				await podComp.refresh("myPod", true);
				expect(
					document.querySelector(".bx-loading-overlay"),
				).toBeNull();
				expect(
					document
						.getElementById("myPod")
						.classList.contains("bx-refreshing"),
				).toBe(false);
				vi.restoreAllMocks();
			});

			it("shows error content on failure", async () => {
				document.body.innerHTML = `
					<div id="myPod" class="bx-pod" data-source="/api/pod">
						<div class="bx-pod-content">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockRejectedValue(
					new Error("Server down"),
				);
				window.BoxLangAjax.config.retryAttempts = 1;

				await expect(podComp.refresh("myPod")).rejects.toThrow(
					"Server down",
				);
				expect(
					document.querySelector(".bx-pod-content").innerHTML,
				).toContain("Failed to refresh");
				vi.restoreAllMocks();
				window.BoxLangAjax.config.retryAttempts = 3;
			});

			it("dispatches pod-refreshed event", async () => {
				document.body.innerHTML = `
					<div id="myPod" class="bx-pod" data-source="/api/pod">
						<div class="bx-pod-content"></div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("data", { status: 200 }),
				);

				const handler = vi.fn();
				document
					.getElementById("myPod")
					.addEventListener("pod-refreshed", handler);
				await podComp.refresh("myPod", false);
				expect(handler).toHaveBeenCalled();
				vi.restoreAllMocks();
			});
		});

		describe("toggle", () => {
			it("does nothing if pod not collapsible", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"></div>';
				podComp.toggle("myPod");
				expect(
					document
						.getElementById("myPod")
						.classList.contains("bx-collapsed"),
				).toBe(false);
			});

			it("toggles collapsed class on collapsible pod", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod bx-collapsible"></div>';
				podComp.toggle("myPod");
				expect(
					document
						.getElementById("myPod")
						.classList.contains("bx-collapsed"),
				).toBe(true);
				podComp.toggle("myPod");
				expect(
					document
						.getElementById("myPod")
						.classList.contains("bx-collapsed"),
				).toBe(false);
			});

			it("dispatches pod-toggled event", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod bx-collapsible"></div>';
				const handler = vi.fn();
				document
					.getElementById("myPod")
					.addEventListener("pod-toggled", handler);
				podComp.toggle("myPod");
				expect(handler).toHaveBeenCalled();
				expect(handler.mock.calls[0][0].detail.collapsed).toBe(true);
			});
		});

		describe("autoRefresh / stopAutoRefresh", () => {
			it("returns undefined if pod not found", () => {
				expect(
					podComp.autoRefresh("nonexistent", 1000),
				).toBeUndefined();
			});

			it("returns undefined if no URL", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"></div>';
				expect(podComp.autoRefresh("myPod", 1000)).toBeUndefined();
			});

			it("sets up interval", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod" data-source="/api"><div class="bx-pod-content"></div></div>';
				const id = podComp.autoRefresh("myPod", 60000);
				expect(id).toBeDefined();
				podComp.stopAutoRefresh("myPod");
			});

			it("stopAutoRefresh clears intervals", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod" data-refresh-intervals="111,222,"></div>';
				podComp.stopAutoRefresh("myPod");
				expect(
					document.getElementById("myPod").dataset.refreshIntervals,
				).toBeUndefined();
			});
		});

		describe("resize", () => {
			it("sets width and height on pod", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"></div>';
				podComp.resize("myPod", 400, 300);
				const pod = document.getElementById("myPod");
				expect(pod.style.width).toBe("400px");
				expect(pod.style.height).toBe("300px");
			});

			it("handles string dimensions", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"></div>';
				podComp.resize("myPod", "50%", "100vh");
				const pod = document.getElementById("myPod");
				expect(pod.style.width).toBe("50%");
				expect(pod.style.height).toBe("100vh");
			});

			it("dispatches pod-resized event", () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"></div>';
				const handler = vi.fn();
				document
					.getElementById("myPod")
					.addEventListener("pod-resized", handler);
				podComp.resize("myPod", 200, 150);
				expect(handler).toHaveBeenCalled();
			});
		});

		describe("loadWithParams", () => {
			it("rejects if pod not found", async () => {
				await expect(
					podComp.loadWithParams("nonexistent"),
				).rejects.toThrow("Pod not found");
			});

			it("rejects if no URL", async () => {
				document.body.innerHTML =
					'<div id="myPod" class="bx-pod"><div class="bx-pod-content" id="myPod_content"></div></div>';
				await expect(podComp.loadWithParams("myPod")).rejects.toThrow(
					"No URL found",
				);
			});

			it("loads with params appended to URL", async () => {
				document.body.innerHTML = `
					<div id="myPod" class="bx-pod" data-source="/api/pod">
						<div class="bx-pod-content" id="myPod_content">old</div>
					</div>`;
				vi.spyOn(globalThis, "fetch").mockResolvedValue(
					new Response("parameterized", { status: 200 }),
				);

				await podComp.loadWithParams("myPod", { filter: "active" });
				const url = globalThis.fetch.mock.calls[0][0];
				expect(url).toContain("filter=active");
				vi.restoreAllMocks();
			});
		});
	});

	describe("BXUICompat.Pod facade", () => {
		it("exposes refresh method", () => {
			expect(window.BXUICompat.Pod.refresh).toBeTypeOf("function");
		});
	});
});
