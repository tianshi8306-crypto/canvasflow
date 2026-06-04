import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useComposeNodeEditor } from "@/hooks/useComposeNodeEditor";

import { buildTimelineLayoutFromClips, TIMELINE_PX_PER_SEC } from "@/lib/compose";

import { useCanvasUiStore } from "@/store/canvasUiStore";

import { ComposeEditorPreview } from "@/components/compose/ComposeEditorPreview";

import { ComposeTimelineToolbar } from "@/components/compose/ComposeTimelineToolbar";

import type { ComposeContextMenuAction } from "@/components/compose/ComposeTimelineContextMenu";
import { ComposeTimelineTrack } from "@/components/compose/ComposeTimelineTrack";

import { IconClose } from "@/components/compose/composeEditorIcons";
import { ComposeEditorExportMenu } from "@/components/compose/ComposeEditorExportMenu";

import { BgmSelector, readBgmParams, type BgmAlignSettings } from "@/components/nodes/BgmSelector";
import { useProjectStore } from "@/store/projectStore";



type Props = {

  nodeId: string;

  title: string;

  onClose: () => void;

};



export function ComposeEditorBody({ nodeId, title, onClose }: Props) {

  const editor = useComposeNodeEditor(nodeId);

  const timelineScrollRef = useRef<HTMLDivElement>(null);



  const handleClose = useCallback(() => {

    editor.stopSequence();

    useCanvasUiStore.getState().requestCanvasFitToNode(nodeId);

    onClose();

  }, [editor, nodeId, onClose]);

  // BGM 参数管理
  const nodeParams = useProjectStore((s) => s.nodes.find((n) => n.id === nodeId)?.data?.params);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const bgmState = useMemo(() => readBgmParams(nodeParams as Record<string, unknown> | undefined), [nodeParams]);
  const [bgmCollapsed, setBgmCollapsed] = useState(
    !bgmState.presetId && !bgmState.relPath,
  );

  const patchNodeParams = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(nodeId, {
        params: {
          ...(nodeParams && typeof nodeParams === "object" ? nodeParams : {}),
          ...patch,
        },
      });
    },
    [nodeId, nodeParams, updateNodeData],
  );

  const handleBgmPresetChange = useCallback(
    (presetId: string | undefined) => {
      patchNodeParams({ bgmPresetId: presetId ?? null });
    },
    [patchNodeParams],
  );

  const handleBgmRelPathChange = useCallback(
    (relPath: string | undefined) => {
      patchNodeParams({ bgmRelPath: relPath ?? null });
    },
    [patchNodeParams],
  );

  const handleBgmSettingsChange = useCallback(
    (settings: BgmAlignSettings) => {
      patchNodeParams({ bgmSettings: settings });
    },
    [patchNodeParams],
  );

  const handleToggleOutput = () => {

    editor.stopSequence();

    editor.setPreviewMode((m) => (m === "clip" ? "output" : "clip"));

  };



  const handleZoomFit = useCallback(() => {

    const host = timelineScrollRef.current;

    const available = (host?.clientWidth ?? 720) - 8;

    const natural = buildTimelineLayoutFromClips(
      editor.timelineClips,
      editor.durations,
      TIMELINE_PX_PER_SEC,
    );

    if (natural.totalWidthPx <= 0) return;

    const next = Math.min(2.5, Math.max(0.5, available / natural.totalWidthPx));

    editor.setTimelineZoom(next);

  }, [editor.timelineClips, editor.durations, editor.setTimelineZoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editor.hasInputs) {
          e.preventDefault();
          editor.handleRemoveClip(editor.selectedIndex);
        }
        return;
      }
      if (e.key.toLowerCase() === "s" && !mod) {
        e.preventDefault();
        editor.handleSplitAtPlayhead();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        editor.togglePreviewPlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);



  const canPlay = Boolean(editor.selectedClip) || (editor.previewMode === "output" && editor.canPreviewOutput);



  return (

    <>

      <header className="composeEditorTop">

        <h1 className="composeEditorTitle" title={title}>

          {title}

        </h1>

        <div className="composeEditorTopActions">

          {editor.canPreviewOutput ? (

            <button

              type="button"

              className="composeEditorTopLink"

              onClick={handleToggleOutput}

            >

              {editor.previewMode === "output" ? "看片段" : "看成片"}

            </button>

          ) : null}

          <ComposeEditorExportMenu

            format={editor.exportFormat}

            onFormatChange={editor.setExportFormat}

            encode={editor.exportEncode}

            onEncodeChange={editor.setExportEncode}

            onExport={() => void editor.handleConcat()}

            disabled={!editor.canConcat}

            running={editor.running}

            outputTitle={editor.output}

          />

          <button

            type="button"

            className="composeEditorCloseBtn"

            onClick={handleClose}

            aria-label="关闭剪辑"

          >

            <IconClose size={20} />

          </button>

        </div>

      </header>



      <div className="composeEditorMain">

        <section className="composeEditorPreview" aria-label="预览">

          <ComposeEditorPreview

            mode={editor.previewMode}

            clipPath={editor.selectedClip}

            outputPath={editor.outputPath}

            seekInClipSec={editor.seekInClipSec}

            sequencePlaying={editor.sequencePlaying}

            onClipDuration={editor.registerDuration}

            setVideoElement={editor.setVideoElement}

            onClipEnded={editor.handleClipEnded}

            onPlaybackTime={editor.handlePlaybackTime}

            onPlayStateChange={editor.setPreviewPlayingState}

            onTogglePlay={editor.togglePreviewPlay}

          />

        </section>



        <section className="composeEditorTimelineDock" aria-label="时间线">

          <ComposeTimelineToolbar
            playing={editor.previewPlaying}
            playheadSec={editor.playheadSec}
            totalSec={editor.totalSec}
            clipCount={editor.timelineClips.length}
            selectedIndex={editor.selectedIndex}
            timelineZoom={editor.timelineZoom}
            canPlay={canPlay}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            canSplit={editor.canSplit}
            canTrimIn={editor.canTrimIn}
            canTrimOut={editor.canTrimOut}
            canDelete={editor.hasInputs}
            canLocate={Boolean(editor.timelineClips[editor.selectedIndex]?.sourceNodeId)}
            refreshing={editor.refreshing}
            running={editor.running}
            sequencePlaying={editor.sequencePlaying}
            canSequence={editor.timelineClips.length > 1}
            onUndo={editor.undo}
            onRedo={editor.redo}
            onSplit={editor.handleSplitAtPlayhead}
            onTrimIn={editor.handleTrimIn}
            onTrimOut={editor.handleTrimOut}
            onTogglePlay={editor.togglePreviewPlay}
            onToggleSequence={editor.toggleSequencePlay}
            onDelete={() => editor.handleRemoveClip(editor.selectedIndex)}
            onZoomIn={() => editor.setTimelineZoom((z) => Math.min(2.5, z + 0.2))}
            onZoomOut={() => editor.setTimelineZoom((z) => Math.max(0.5, z - 0.2))}
            onZoomFit={handleZoomFit}
            onLocate={() => editor.locateSourceForIndex(editor.selectedIndex)}
            onRefresh={() => void editor.handleRefreshFromEdges(false)}
            onFillFromScript={() => void editor.handleRefreshFromScript()}
            canFillFromScript={Boolean(editor.scriptNodeIdForCompose)}
            onSortScript={() => void editor.handleRefreshFromEdges(true)}
            onClear={editor.handleClearAll}
            onZoomChange={editor.setTimelineZoom}
            timelineSnapEnabled={editor.timelineSnapEnabled}
            onToggleTimelineSnap={() =>
              editor.setTimelineSnapEnabled((v) => !v)
            }
          />



          <ComposeTimelineTrack
            segments={editor.segments}
            timelineClips={editor.timelineClips}
            totalSec={editor.totalSec}
            totalWidthPx={editor.totalWidthPx}
            selectedIndex={editor.selectedIndex}
            playheadSec={editor.playheadSec}
            scrollHostRef={timelineScrollRef}
            canSplit={editor.canSplit}
            canTrimIn={editor.canTrimIn}
            canTrimOut={editor.canTrimOut}
            canLocate={Boolean(editor.timelineClips[editor.selectedIndex]?.sourceNodeId)}
            onSelect={(i) => editor.selectClip(i, 0)}
            onReorder={editor.reorderClips}
            onDuration={editor.registerDuration}
            onSeek={editor.seekToGlobalSec}
            onTrimDragStart={editor.handleTrimDragStart}
            onTrimDrag={editor.handleTrimDrag}
            onTrimDragEnd={editor.handleTrimDragEnd}
            onContextAction={(clipIndex, action: ComposeContextMenuAction) => {
              switch (action) {
                case "split":
                  editor.handleSplitAtPlayhead();
                  break;
                case "trimIn":
                  editor.handleTrimIn();
                  break;
                case "trimOut":
                  editor.handleTrimOut();
                  break;
                case "locate":
                  editor.locateSourceForIndex(clipIndex);
                  break;
                case "delete":
                  editor.handleRemoveClip(clipIndex);
                  break;
              }
            }}
          />



          {editor.status ? (

            <div

              className={`composeEditorStatus${editor.outputReady ? " composeEditorStatus--ok" : ""}`}

              role="status"

            >

              {editor.status}

            </div>

          ) : null}

          <BgmSelector
            nodeId={nodeId}
            videoDurationSec={editor.totalSec}
            selectedPresetId={bgmState.presetId}
            customBgmRelPath={bgmState.relPath}
            settings={bgmState.settings}
            onPresetChange={handleBgmPresetChange}
            onCustomBgmChange={handleBgmRelPathChange}
            onSettingsChange={handleBgmSettingsChange}
            collapsed={bgmCollapsed}
            onToggleCollapsed={() => setBgmCollapsed((v) => !v)}
          />

        </section>

      </div>

    </>

  );

}


