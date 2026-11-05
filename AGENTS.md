# @amiriel/react

React 信件编辑器与渲染器。模型、主题、标签和归一化从 `@amiriel/core` 重导出（`src/index.ts` 中的 `export * from "@amiriel/core"`）。不要在本仓库复制这些实现。

## 组件

| 文件 | 导出 |
| --- | --- |
| `src/components/AmirielBodyEditor.tsx` | 分页编辑器 |
| `src/components/AmirielBodyRenderer.tsx` | 只读渲染 |
| `src/components/AmirielMediaLightbox.tsx` | 灯箱 |
| `src/components/AmirielMediaVideo.tsx` | 视频 |

样式在 `src/style.css`，构建时由 `scripts/copy-style.mjs` 带上。本包不实现上传、账号、存储或投递；媒体文件由宿主处理。

与 `@amiriel/vue` 保持同一文档行为和同一套主题。改交互时优先对照 Vue 包里已经做好的编辑器，避免两套交互规则。

图标不要用 emoji 代替。选项并排时，图标和标题在选项内部同一行，不要用 `flex-col` 把图标放到标题上方。

## 规则与验证

- 说明用简体中文。不启动长期进程。没有明确要求时不改版本、不发布、不推 tag。
- Core 升级走 `.github/workflows/sync-core.yml`。只改本包走 `release.yml`。
- `Amiriel.com` 当前不依赖本包。

```bash
pnpm install && pnpm typecheck && pnpm build
```
