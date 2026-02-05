# BulletHistory — TypeScript + React Architecture

## Overview

This is the TypeScript/React rewrite of BulletHistory. The codebase uses:
- **React 18** for UI components
- **Zustand** for state management (replaces BulletHistory class state)
- **Vite + CRXJS** for building the Chrome extension
- **Jest** for testing

## Directory Structure

```
src/
├── background/          # Service worker (Chrome extension background)
│   ├── index.ts         # Entry point
│   └── services/        # Background services
├── panel/               # Side panel UI (React)
│   ├── index.tsx        # React entry point
│   ├── App.tsx          # Root component
│   ├── store/           # Zustand state management
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   └── services/        # API wrappers
├── shared/              # Shared code
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
└── test/                # Test setup and mocks
```

## Key Conventions

### State Management
- All state is managed by Zustand in `panel/store/`
- Slices are modular: `history-slice.ts`, `view-slice.ts`
- Use `useHistoryStore()` hook to access state

### Chrome APIs
- All Chrome API calls go through wrappers in `panel/services/chrome-api.ts`
- This allows mocking for tests
- Background communication uses `chrome.runtime.sendMessage`

### Performance Patterns (from original codebase)
- **Pre-computed sort keys:** Build Map before `.sort()`, never compute in comparator
- **Virtual scrolling:** Use IntersectionObserver for large lists
- **Debounced writes:** Background uses `StorageService` with 5s debounce
- **Hover tracking:** Use Set to track hovered elements, avoid querySelectorAll

## Build Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build to dist/
npm run test         # Run Jest tests
npm run test:watch   # Jest in watch mode
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

## Testing

- Tests are in `__tests__/` directories adjacent to source files
- Chrome APIs are mocked in `test/mocks/chrome.ts`
- Use `@testing-library/react` for component tests

## Migration Status

The migration from vanilla JS preserves all original functionality:
- [x] Build infrastructure
- [x] Shared utilities (date-utils, url-utils)
- [x] TypeScript types
- [x] Background service worker
- [x] Panel React structure
- [ ] Grid components
- [ ] Expanded view components
- [ ] Tab views
- [ ] Calendar integration
