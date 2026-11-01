# Credits

- 概念与创作方向：本项目作者；由 Codex 辅助代码和文档，具体使用见 PROCESS.md。
- 前置个人项目：`20261026_WUDAO`，借鉴其低饱和绿色、圆形点精灵、稳定随机种子和程序化竹林思路。本项目独立重新实现，不包含原项目素材、电影截图或视频。
- React / React DOM：Meta，MIT，https://github.com/facebook/react 。
- Three.js：Three.js authors，MIT，https://github.com/mrdoob/three.js 。
- React Three Fiber：pmndrs，MIT，https://github.com/pmndrs/react-three-fiber 。
- MediaPipe Tasks Vision 0.10.32：Google，Apache-2.0，https://github.com/google-ai-edge/mediapipe 。WASM 来自同版本 npm 包。
  两个 WASM JavaScript 加载器末尾增加 `globalThis.ModuleFactory = ModuleFactory`，使其可经动态 import 在模块 Worker 中加载；WASM 二进制未修改。
  同时修复 `custom_emscripten_dbgn` 中块级函数声明在模块严格模式下不可见的问题，直接调用 `console.warn` 保留原有诊断信息，避免 `custom_dbg is not defined`。
- Face Landmarker 模型：Google MediaPipe 官方发布，https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task 。SHA256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`。
- 模型及使用文档：https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker 。使用者应遵守官方模型与软件许可；本项目不对第三方模型主张原创权利。
- Vite、Vitest、TypeScript：各自作者及开源许可，完整版本见 package-lock.json。

程序化人物、剑、竹林与点阵由本项目代码生成；无第三方音频或外部字体。


## WIND//01 interface direction

Original CSS layout and procedural presentation, assisted by OpenAI Codex. The author cited Cowboy Bebop for poster composition and Evangelion for compact tactical information design. Only general typography/composition principles are referenced; no logos, artwork, film frames, fonts, or UI assets from these works are copied or bundled. System fonts are used locally. UI UX Pro Max provided accessibility/design-system guidance; Playwright CLI was used for local browser review. Traditional Chinese/English interface copy and English score captions were authored for this project with Codex assistance.


The optional CRT revision uses procedural CSS scanline/hatching patterns and a local Canvas 2D raster-text renderer authored with Codex assistance. It uses installed system fonts only. No CRT image texture, third-party UI kit, font download or real-face sample is included. The explicitly named landing-page-design skill was not installed; the supplied visual brief and existing UI UX Pro Max readability guidance informed the revision.
