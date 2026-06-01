# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run tauri dev    # Full Tauri dev (required for full functionality: new/open project, API calls)
npm run dev          # Vite browser-only (layout preview; Tauri APIs unavailable)
npm run build        # Production build (tsc + vite)
npm run typecheck    # TypeScript checking
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:rust    # Cargo tests (src-tauri)
npm run test:e2e     # Playwright E2E (first run: npm run test:e2e:install)
npm run quality:gate # Fast gate: typecheck + lint + vitest + rust tests
npm run quality:gate:full  # Full gate: quality:gate + e2e
npm run release:check  # quality:gate + golden-path E2E (recommended before PR)
npm run release:check:full  # Same as quality:gate:full
```

## Architecture

### Overview
CanvasFlow AI Studio is a Tauri desktop app combining a React/Vite frontend with a Rust backend. The frontend uses ReactFlow for a node-based canvas workflow.

### Frontend Structure
- **Entry**: `src/App.tsx` - Root component, keyboard shortcuts, Hermes auto-chain init
- **Canvas**: `src/components/FlowCanvas.tsx` - ReactFlow canvas with nodeTypes mapping to node components
- **State**: Zustand stores in `src/store/`:
  - `projectStore.ts` - Canvas nodes/edges, viewport, selection, project path
  - `canvasUiStore.ts` - UI state (snap alignment, panel visibility, context menus)
  - `projectHistory.ts` - Undo/redo stacks
  - `projectSaveDebounce.ts` - Auto-save scheduling
- **Node Agents**: `src/lib/nodeAgentRuntime/` - LLM invocation, script/storyboard/video generation agents

### Node Types
Registered in `FlowCanvas.tsx`: `llm`, `mediaImport`, `imageAsset`, `ffmpegConcat`, `textNode`, `scriptNode`, `videoNode`, `audioNode`, `group`

### Key Files
- `src/lib/types.ts` - FlowNodeData, ScriptBeat, StoryboardShot, VideoNodePersisted types
- `src/lib/videoNodeTypes.ts` - VideoNode domain model (source kind, generation workflow, camera presets)
- `src/lib/canvasNodeDefaults.ts` - Default data per node type
- `src/lib/flowConnectionPolicy.ts` - Connection validation rules
- `src/lib/nodeAgentRuntime/` - Agent implementations (scriptStoryboardAgent, videoGenerationAgent, imageGenerationAgent, audioTtsAgent, etc.)
- `src/shared/api/` - API calls for assets, video generation, runs

### Backend Structure (src-tauri)
- `src-tauri/src/lib.rs` - Tauri app entry, state (HTTP client, video jobs), command registration
- `src-tauri/src/commands/` - Tauri command handlers (project, settings, runs, assets, graph, media_gen, video, etc.)
- `src-tauri/src/executor/` - Execution engines: `graph_flow.rs`, `llm.rs`, `script_node.rs`, `script_parse.rs`, `ffmpeg.rs`, `engine.rs`

### Production Flow
ThemeInput → ScriptWorkbench → StoryboardGeneration → VideoGeneration → TimelineExport

### Project Format
- `canvasflow.json` - Canvas nodes, edges, viewport
- `assets/` - Media files (relative paths)
- `.canvasflow/runs.db` - SQLite run logs

## Iteration Rules (Low Complexity Iteration)

Every iteration must:
1. Map to one layer: CanvasExperienceLayer, ProductionFlowLayer, ProviderOrchestrationLayer, AssetAndQualityLayer
2. Keep the production flow continuous
3. Be limited to 1 core goal, 3 modules, 2-4 feature items
4. Include "Out of scope" section, 3-5 manual acceptance steps, rollback trigger/action
5. NOT mix unrelated refactors

Iterations touching main shell, canvas, side panels, or new modal/panel surfaces must include a UI/UX subsection.

See `CONTRIBUTING.md` and `docs/iterations/ITERATION_TEMPLATE.md` for details.