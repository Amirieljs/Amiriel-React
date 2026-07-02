# Amiriel React

React components for Amiriel letter documents.

`@amiriel/react` provides a React implementation of the Amiriel document
renderer and a controlled editor shell. It is built on `amiriel`, so the
document model, themes, labels, and normalization rules stay aligned with the
Vue package.

[![npm version (beta)](https://img.shields.io/npm/v/@amiriel/react/beta?style=flat-square)](https://www.npmjs.com/package/@amiriel/react)
[![license](https://img.shields.io/npm/l/@amiriel/react?style=flat-square)](https://www.npmjs.com/package/@amiriel/react)
[![React](https://img.shields.io/badge/react-18%2B%20%7C%2019+-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white)]()

The full hosted product lives at [amiriel.com](https://amiriel.com).

## Features

- React read-only renderer for Amiriel documents
- Controlled React editor shell for pages, themes, text blocks, paper size, and media list
- Image/video media lightbox
- Inline video component with duration badge
- Shared document model from `amiriel`
- TypeScript declarations

The current React editor is a usable foundation. Advanced parity with the Vue
editor, such as drag-and-drop placement, resize handles, upload retry UI, and
text overflow inspection, should be added incrementally.

## Install

Pre-release builds are published under the `beta` dist-tag:

```bash
npm install @amiriel/react@beta react
pnpm add @amiriel/react@beta react
yarn add @amiriel/react@beta react
bun add @amiriel/react@beta react
```

After the first stable release, install without the tag:

```bash
npm install @amiriel/react react
```

Import the stylesheet once:

```tsx
import "@amiriel/react/style.css";
```

The package depends on `amiriel` for the shared document model and declares
`react` as a peer dependency.

## Usage

```tsx
import { useState } from "react";
import {
  AmirielBodyEditor,
  AmirielBodyRenderer,
  type AmirielDocument,
  type AmirielMediaRequest,
} from "@amiriel/react";
import "@amiriel/react/style.css";

const initialDocument: AmirielDocument = {
  theme: "midnight",
  media: [],
  pages: [],
};

export function LetterComposer() {
  const [document, setDocument] = useState(initialDocument);

  async function onMediaRequest(request: AmirielMediaRequest<File>) {
    request.handled = true;
    try {
      const media = await uploadMediaSomewhere(request.file);
      request.resolve(media);
    } catch (error) {
      request.reject(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <>
      <AmirielBodyEditor
        value={document}
        onChange={setDocument}
        locale="en"
        onMediaRequest={onMediaRequest}
      />

      <AmirielBodyRenderer document={document} locale="en" />
    </>
  );
}
```

Host applications own media upload and pass the resulting media object back
through `request.resolve(media)`. The package does not include storage,
authentication, routing, database, or delivery workflows.

## Main Exports

| Export | Description |
| --- | --- |
| `AmirielBodyEditor` | Controlled React editor shell |
| `AmirielBodyRenderer` | Read-only React renderer |
| `AmirielMediaLightbox` | Image/video lightbox |
| `AmirielMediaVideo` | Inline video component |
| Core types and helpers | Re-exported from `amiriel` |

## Editor Props

| Prop | Default | Description |
| --- | --- | --- |
| `value` | required | Controlled document value |
| `onChange` | required | Called when the document changes |
| `readOnly` | `false` | Render the editor shell without editing controls |
| `locale` | `"en"` | Built-in label locale: `en` or `zh` |
| `labels` | none | Partial override for UI labels |
| `themes` | none | Override built-in themes or register custom paper themes |
| `defaultPaperSize` | `{ width: 720, height: 520 }` | Fallback paper size |
| `paperSizeLimits` | `{ minWidth: 320, maxWidth: 1600, minHeight: 240, maxHeight: 2200 }` | Paper resizing bounds |
| `paperResizable` | `true` | Allow users to edit paper width and height |
| `onMediaRequest` | none | Host-controlled upload hook for new media files |
| `onMediaRemoved` | none | Called when the user removes media from the document |

`AmirielBodyRenderer` accepts the same theme, label, and paper-size props so
read-only rendering can match the editor.

## Themes

Built-in themes: `midnight`, `paper`, `memorial`.

```tsx
import {
  AmirielBodyEditor,
  type AmirielDocument,
  type AmirielThemeDefinition,
} from "@amiriel/react";

const customThemes: AmirielThemeDefinition[] = [
  {
    id: "ocean",
    label: "Ocean dusk",
    swatch: "linear-gradient(135deg, #1e3a5f, #0a1628)",
    defaultTextColor: "white",
    vars: {
      paperBorder: "rgba(96, 165, 250, 0.28)",
      paperBg: "linear-gradient(180deg, #1a2f4a 0%, #0d1824 100%)",
      paperText: "#dbeafe",
      paperDivider: "rgba(96, 165, 250, 0.2)",
      paperAccent: "rgba(147, 197, 253, 0.88)",
    },
  },
];

function Editor({ document, onChange }: {
  document: AmirielDocument;
  onChange: (value: AmirielDocument) => void;
}) {
  return (
    <AmirielBodyEditor
      value={document}
      onChange={onChange}
      themes={customThemes}
    />
  );
}
```

## Package Architecture

This repository is the React implementation. The shared framework-agnostic core
lives in [`amiriel`](https://github.com/Amirieljs/Amiriel), and the Vue
implementation lives in [`@amiriel/vue`](https://github.com/Amirieljs/Amiriel-Vue).

## Release Sync

This repository listens for `core-release` events dispatched from
`Amirieljs/Amiriel`. On sync, GitHub Actions upgrades `amiriel`, runs checks,
bumps the React package beta version, publishes to npm, and creates a GitHub
release.

Configure these secrets:

- `NPM_TOKEN`: npm automation token used for publishing
- `AMIRIELJS_SYNC_TOKEN`: GitHub token with permission to push sync commits and tags

## License

MIT. The React editor package is open source and can be used commercially. The
official hosted Amiriel product at [amiriel.com](https://amiriel.com) may still
provide paid services around storage, accounts, delivery, hosting, collaboration,
or other product workflows.
