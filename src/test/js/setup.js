/**
 * Vitest setup file - loads the JS source files into the jsdom environment.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const JS_DIR = resolve(__dirname, "../../main/bx/public/js");

/**
 * Helper to load a script file into the current jsdom window via eval.
 * Uses an IIFE wrapper to avoid `const` redeclaration errors across calls.
 */
export function loadScript(filename) {
	const code = readFileSync(resolve(JS_DIR, filename), "utf-8");
	// Wrap in IIFE so top-level const/let don't conflict on reload
	const wrapped = `(function(){\n${code}\n}).call(this);`;
	const fn = new Function(wrapped);
	fn.call(window);
}
