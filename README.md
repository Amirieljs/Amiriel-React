# Amiriel React

React components for Amiriel letter documents.

`@amiriel/react` provides a React implementation of the Amiriel document
renderer and a controlled editor shell. It is built on `@amiriel/core`, so the
document model, themes, labels, and normalization rules stay aligned with the
Vue package.

## Features

- React read-only renderer for Amiriel documents
- Controlled React editor shell for pages, themes, text blocks, paper size, and media list
- Image/video media lightbox
- Inline video component with duration badge
- Shared document model from `@amiriel/core`
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

Import the stylesheet once:

```tsx
import "@amiriel/react/style.css";
```

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

The package does not include storage, authentication, routing, database, or
delivery workflows. Host applications own those concerns.

## Main Exports

| Export | Description |
| --- | --- |
| `AmirielBodyEditor` | Controlled React editor shell |
| `AmirielBodyRenderer` | Read-only React renderer |
| `AmirielMediaLightbox` | Image/video lightbox |
| `AmirielMediaVideo` | Inline video component |
| Core types and helpers | Re-exported from `@amiriel/core` |

## Release Sync

This repository listens for `core-release` events dispatched from
`Amirieljs/Amiriel`. On sync, GitHub Actions upgrades `@amiriel/core`, runs
checks, bumps the React package beta version, publishes to npm, and creates a
GitHub release.

Configure these secrets:

- `NPM_TOKEN`: npm automation token used for publishing
- `AMIRIELJS_SYNC_TOKEN`: GitHub token with permission to push sync commits and tags

## License

MIT. The React editor package is open source and can be used commercially. The
official hosted Amiriel product may still provide paid services around storage,
accounts, delivery, hosting, collaboration, or other product workflows.
