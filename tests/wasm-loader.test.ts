import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('MediaPipe module-worker loader compatibility', () => {
  for (const name of ['vision_wasm_internal.js', 'vision_wasm_nosimd_internal.js']) {
    it(`${name} emits WASM diagnostics without a strict-mode ReferenceError`, () => {
      const source = readFileSync(`public/vision/wasm/${name}`, 'utf8');
      const diagnostic = source.match(/function custom_emscripten_dbgn\(str,len\)\{.*?\}\}var _free/)?.[0].replace(/var _free$/, '');
      expect(diagnostic).toBeTruthy();
      const messages: string[] = [];
      runInNewContext(`"use strict"; ${diagnostic}; custom_emscripten_dbgn(0, 4);`, {
        UTF8ToString: () => 'WASM diagnostic',
        console: { warn: (message: string) => messages.push(message) },
      });
      expect(messages).toEqual(['WASM diagnostic']);
      expect(source).toContain('globalThis.ModuleFactory = ModuleFactory');
    });
  }
});
