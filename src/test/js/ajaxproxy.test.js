import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./setup.js";

describe("ajaxproxy.js", () => {
	beforeAll(() => {
		loadScript("ajax-core.js");
		loadScript("ajaxproxy.js");
	});

	describe("BoxLangAjax.components.ajaxproxy", () => {
		let proxy;

		beforeEach(() => {
			proxy = window.BoxLangAjax.components.ajaxproxy;
			// Clean up any created proxies
			Object.keys(window.BoxLangAjax.proxies || {}).forEach((k) => {
				delete window[k];
			});
			window.BoxLangAjax.proxies = {};
		});

		describe("createCFCProxy", () => {
			it("creates a proxy and assigns to window by class name", () => {
				const result = proxy.createCFCProxy(
					"com.example.UserService",
					"UserService",
				);
				expect(result).toBeDefined();
				expect(window.UserService).toBe(result);
				expect(window.BoxLangAjax.proxies.UserService).toBe(result);
			});

			it("derives jsClassName from cfc path when not provided", () => {
				const result = proxy.createCFCProxy("com.example.OrderService");
				expect(window.OrderService).toBe(result);
			});

			it("returns existing proxy if already created", () => {
				const first = proxy.createCFCProxy(
					"com.example.Test",
					"TestProxy",
				);
				window.TestProxy = first;
				const second = proxy.createCFCProxy(
					"com.example.Test",
					"TestProxy",
				);
				expect(second).toBe(first);
			});

			it("proxy has callMethod that uses fetchContent", async () => {
				const mockResponse = new Response('{"id":1}', {
					status: 200,
					headers: { "content-type": "application/json" },
				});
				vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

				const p = proxy.createCFCProxy("com.example.Svc", "Svc");
				const result = await p.callMethod("getData", { id: "1" });
				expect(result).toEqual({ id: 1 });

				vi.restoreAllMocks();
			});

			it("proxy.call invokes callback on success", async () => {
				const mockResponse = new Response('"hello"', {
					status: 200,
					headers: { "content-type": "application/json" },
				});
				vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

				const p = proxy.createCFCProxy("com.test.A", "AProxy");
				const cb = vi.fn();

				await new Promise((resolve) => {
					p.call("greet", {}, (result) => {
						cb(result);
						resolve();
					});
				});

				expect(cb).toHaveBeenCalledWith("hello");
				vi.restoreAllMocks();
			});

			it("proxy.call invokes error callback on failure", async () => {
				vi.spyOn(globalThis, "fetch").mockRejectedValue(
					new Error("Network fail"),
				);
				window.BoxLangAjax.config.retryAttempts = 1;

				const p = proxy.createCFCProxy("com.test.B", "BProxy");
				const errCb = vi.fn();

				await new Promise((resolve) => {
					p.call("doStuff", {}, null, (msg, err) => {
						errCb(msg);
						resolve();
					});
				});

				expect(errCb).toHaveBeenCalledWith("Network fail");
				vi.restoreAllMocks();
				window.BoxLangAjax.config.retryAttempts = 3;
			});

			it("proxy.setTimeout and setRetryAttempts are chainable", () => {
				const p = proxy.createCFCProxy("com.test.C", "CProxy");
				expect(p.setTimeout(5000)).toBe(p);
				expect(p.timeout).toBe(5000);
				expect(p.setRetryAttempts(5)).toBe(p);
				expect(p.retryAttempts).toBe(5);
			});
		});

		describe("executeBind", () => {
			it("parses and executes cfc bind expression", async () => {
				const mockResponse = new Response("result", { status: 200 });
				vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

				const successCb = vi.fn();
				proxy.executeBind(
					"cfc:com.example.Service.getData(arg1,arg2)",
					successCb,
				);

				await new Promise((r) => setTimeout(r, 50));
				expect(successCb).toHaveBeenCalledWith("result");
				vi.restoreAllMocks();
			});

			it("rejects non-cfc bind expressions", () => {
				const errorCb = vi.fn();
				proxy.executeBind("javascript:alert(1)", null, errorCb);
				expect(errorCb).toHaveBeenCalled();
			});

			it("rejects invalid bind expression format", () => {
				const errorCb = vi.fn();
				proxy.executeBind("cfc:invalidformat", null, errorCb);
				expect(errorCb).toHaveBeenCalled();
			});

			it("handles empty params in bind expression", async () => {
				const mockResponse = new Response("ok", { status: 200 });
				vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

				const successCb = vi.fn();
				proxy.executeBind("cfc:com.Svc.noArgs()", successCb);

				await new Promise((r) => setTimeout(r, 50));
				expect(successCb).toHaveBeenCalledWith("ok");
				vi.restoreAllMocks();
			});
		});

		describe("getProxy / listProxies / removeProxy", () => {
			it("getProxy returns a registered proxy", () => {
				proxy.createCFCProxy("com.test.X", "XProxy");
				expect(proxy.getProxy("XProxy")).toBeDefined();
			});

			it("listProxies returns all proxy names", () => {
				proxy.createCFCProxy("com.test.Y", "YProxy");
				expect(proxy.listProxies()).toContain("YProxy");
			});

			it("removeProxy deletes proxy from both locations", () => {
				proxy.createCFCProxy("com.test.Z", "ZProxy");
				proxy.removeProxy("ZProxy");
				expect(window.ZProxy).toBeUndefined();
				expect(window.BoxLangAjax.proxies.ZProxy).toBeUndefined();
			});
		});
	});

	describe("BXUICompat.AjaxProxy facade", () => {
		it("init creates and returns proxy", () => {
			const result = window.BXUICompat.AjaxProxy.init(
				"com.facade.Test",
				"FacadeTest",
			);
			expect(result).toBeDefined();
			expect(window.FacadeTest).toBeDefined();
		});

		it("invoke calls fetchContent with proper form data", async () => {
			const mockResponse = new Response('"invoked"', {
				status: 200,
				headers: { "content-type": "application/json" },
			});
			vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

			const proxyObj = { cfcPath: "/api/test.cfc" };
			const result = await window.BXUICompat.AjaxProxy.invoke(
				proxyObj,
				"myMethod",
				"token123",
				{ arg1: "val1" },
				{},
			);

			expect(result).toBe("invoked");
			vi.restoreAllMocks();
		});

		it("invoke calls callbackHandler on success", async () => {
			const mockResponse = new Response('"data"', {
				status: 200,
				headers: { "content-type": "application/json" },
			});
			vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

			const handler = vi.fn();
			const proxyObj = {
				cfcPath: "/api/test.cfc",
				callbackHandler: handler,
			};
			await window.BXUICompat.AjaxProxy.invoke(
				proxyObj,
				"method",
				null,
				null,
				{ ctx: 1 },
			);

			expect(handler).toHaveBeenCalledWith("data", { ctx: 1 });
			vi.restoreAllMocks();
		});

		it("invoke calls errorHandler on failure", async () => {
			vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));
			window.BoxLangAjax.config.retryAttempts = 1;

			const errHandler = vi.fn();
			const proxyObj = {
				cfcPath: "/api/test.cfc",
				errorHandler: errHandler,
			};

			await expect(
				window.BXUICompat.AjaxProxy.invoke(
					proxyObj,
					"method",
					null,
					null,
					{ ctx: 2 },
				),
			).rejects.toThrow("fail");

			expect(errHandler).toHaveBeenCalledWith(-1, "fail", { ctx: 2 });
			vi.restoreAllMocks();
			window.BoxLangAjax.config.retryAttempts = 3;
		});
	});

	describe("BXUICompat.Bind.cfcBindHandler", () => {
		it("is registered and marked as bind handler", () => {
			expect(window.BXUICompat.Bind.cfcBindHandler).toBeTypeOf(
				"function",
			);
			expect(window.BXUICompat.Bind.cfcBindHandler._cf_bindhandler).toBe(
				true,
			);
		});
	});
});
