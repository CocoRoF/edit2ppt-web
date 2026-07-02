"use client";

import { MessageSquareText } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import ChatPanel, {
    type ChatMessage,
    type StudioConfig,
} from "@/components/studio/ChatPanel";
import SlideCanvas, { type PreviewSlide } from "@/components/studio/SlideCanvas";
import UploadDropzone, { type UploadedAsset } from "@/components/UploadDropzone";
import { useJobEvents, type JobEvent } from "@/hooks/useJobEvents";
import { withBase } from "@/lib/basePath";

const PPTX_MIME =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Korean labels for the edit-deck pipeline stages. */
const STAGE_LABEL: Record<string, string> = {
    queued: "작업 대기 중…",
    analyzing_deck: "덱 렌더링 중…",
    planning_edits: "편집 계획 수립 중…",
    editing_slides: "슬라이드 편집 중…",
    applying_edits: "PPTX 반영 중…",
    done: "완료",
    failed: "실패",
};

interface DeckState {
    assetId: string;
    filename: string;
}

interface EditJobResult {
    changed: boolean;
    page_count: number;
    reply: string;
    operations: Array<{ action: string; slide?: number; after?: number }>;
    pptx_asset_id: string;
}

/**
 * "PPT 같이 만들기" studio — chat on the left, deck canvas on the right.
 *
 * One chat turn = one engine edit-deck job: the message becomes the
 * instruction, the SSE stream drives the progress bubble, and on
 * completion the canvas re-renders the new revision (the previous asset
 * is preserved server-side).
 */
export default function StudioPage() {
    const [deck, setDeck] = useState<DeckState | null>(null);
    const [slides, setSlides] = useState<PreviewSlide[]>([]);
    const [canvasPx, setCanvasPx] = useState<{ w: number; h: number }>({ w: 1280, h: 720 });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [config, setConfig] = useState<StudioConfig>({
        anthropicKey: "",
        model: "claude-opus-4-7",
        lang: "ko-KR",
    });
    const [jobId, setJobId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // The instruction of the in-flight turn; folded into history afterwards.
    const pendingInstruction = useRef<string | null>(null);

    const loadPreview = useCallback(async (assetId: string) => {
        setPreviewLoading(true);
        try {
            const res = await fetch(withBase("/api/preview"), {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept-Language": "ko-KR" },
                body: JSON.stringify({ pptx_asset_id: assetId }),
            });
            if (!res.ok) {
                let msg = `미리보기 렌더링에 실패했습니다 (HTTP ${res.status}).`;
                try {
                    const j = (await res.json()) as { error?: { message?: string } };
                    if (j.error?.message) msg = j.error.message;
                } catch {
                    /* ignore */
                }
                setMessages((prev) => [...prev, { role: "assistant", content: msg, kind: "error" }]);
                setSlides([]);
                return;
            }
            const body = (await res.json()) as {
                slides: PreviewSlide[];
                width_px: number;
                height_px: number;
            };
            setSlides(body.slides);
            setCanvasPx({ w: body.width_px, h: body.height_px });
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    const handleUploaded = useCallback(
        (asset: UploadedAsset) => {
            setDeck({ assetId: asset.id, filename: asset.original_filename ?? "deck.pptx" });
            setMessages([]);
            setSlides([]);
            void loadPreview(asset.id);
        },
        [loadPreview],
    );

    const finishTurn = useCallback(
        async (finalEvent: JobEvent) => {
            const id = finalEvent.job_id;
            try {
                const result = await pollJobResult(id);
                if (result === null) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "assistant",
                            content: "작업 결과를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
                            kind: "error",
                        },
                    ]);
                    return;
                }
                if (result.status === "failed") {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "assistant",
                            content: `편집에 실패했습니다: ${result.error_message ?? "알 수 없는 오류"}`,
                            kind: "error",
                        },
                    ]);
                    return;
                }
                const r = result.result as unknown as EditJobResult;
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: r.reply || "요청을 처리했습니다.",
                        ops: r.changed ? r.operations : undefined,
                    },
                ]);
                if (r.changed && r.pptx_asset_id) {
                    setDeck((prev) =>
                        prev ? { ...prev, assetId: r.pptx_asset_id } : prev,
                    );
                    void loadPreview(r.pptx_asset_id);
                }
            } finally {
                pendingInstruction.current = null;
                setBusy(false);
                setJobId(null);
            }
        },
        [loadPreview],
    );

    const { events } = useJobEvents({ jobId, onTerminal: finishTurn });
    const lastStage = [...events].reverse().find((e) => typeof e.payload.stage === "string")
        ?.payload.stage as string | undefined;

    const send = useCallback(
        async (instruction: string) => {
            if (!deck) return;
            const history = messages
                .filter((m) => m.kind !== "error")
                .map((m) => ({ role: m.role, content: m.content }));
            setMessages((prev) => [...prev, { role: "user", content: instruction }]);
            setBusy(true);
            pendingInstruction.current = instruction;

            try {
                const res = await fetch(withBase("/api/jobs/edit-deck"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept-Language": "ko-KR",
                        "X-Anthropic-API-Key": config.anthropicKey.trim(),
                    },
                    body: JSON.stringify({
                        pptx_asset_id: deck.assetId,
                        instruction,
                        chat_history: history.slice(-12),
                        lang: config.lang,
                        model: config.model,
                        output_basename: deck.filename.replace(/\.pptx$/i, "") || "deck",
                    }),
                });
                if (!res.ok) {
                    let msg = `요청에 실패했습니다 (HTTP ${res.status}).`;
                    try {
                        const j = (await res.json()) as { error?: { message?: string } };
                        if (j.error?.message) msg = j.error.message;
                    } catch {
                        /* ignore */
                    }
                    setMessages((prev) => [...prev, { role: "assistant", content: msg, kind: "error" }]);
                    setBusy(false);
                    return;
                }
                const job = (await res.json()) as { id: string };
                setJobId(job.id);
            } catch (err) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `요청 중 오류: ${err instanceof Error ? err.message : String(err)}`,
                        kind: "error",
                    },
                ]);
                setBusy(false);
            }
        },
        [deck, messages, config],
    );

    const reset = useCallback(() => {
        setDeck(null);
        setSlides([]);
        setMessages([]);
        setJobId(null);
        setBusy(false);
    }, []);

    return (
        <main className="flex h-[calc(100vh-3.5rem)] min-h-[480px]">
            <aside className="flex w-[400px] shrink-0 flex-col border-r border-neutral-200 bg-white">
                <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
                    <MessageSquareText className="size-4 text-primary-600" />
                    <h1 className="text-sm font-semibold text-neutral-900">PPT 같이 만들기</h1>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                        beta
                    </span>
                </div>
                <ChatPanel
                    messages={messages}
                    config={config}
                    onConfigChange={setConfig}
                    onSend={send}
                    busy={busy}
                    stageLabel={busy ? STAGE_LABEL[lastStage ?? "queued"] ?? "작업 중…" : null}
                    disabled={deck === null}
                />
            </aside>

            <section className="min-w-0 flex-1">
                {deck === null ? (
                    <div className="flex h-full items-center justify-center bg-neutral-100 px-6">
                        <div className="w-full max-w-lg space-y-4 text-center">
                            <h2 className="text-xl font-bold text-neutral-900">
                                PPTX를 올리고 채팅으로 편집하세요
                            </h2>
                            <p className="text-sm text-neutral-600">
                                업로드하면 모든 슬라이드가 여기 미리보기로 나타나고,
                                왼쪽 채팅으로 수정·추가·삭제를 요청할 수 있습니다.
                                편집할 때마다 새 버전이 만들어지며 언제든 다운로드할 수 있습니다.
                            </p>
                            <UploadDropzone
                                inputId="studio-upload"
                                accept={PPTX_MIME}
                                formatsLabel="PPTX 전용 (최대 200 MB)"
                                onUploaded={handleUploaded}
                            />
                        </div>
                    </div>
                ) : (
                    <SlideCanvas
                        filename={deck.filename}
                        assetId={deck.assetId}
                        slides={slides}
                        widthPx={canvasPx.w}
                        heightPx={canvasPx.h}
                        busy={busy}
                        loading={previewLoading}
                        onReset={reset}
                    />
                )}
            </section>
        </main>
    );
}

interface JobRow {
    status: string;
    error_message: string | null;
    result: Record<string, unknown>;
}

/** The `done` SSE event can beat the job row's final commit; poll briefly. */
async function pollJobResult(jobId: string): Promise<JobRow | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const res = await fetch(withBase(`/api/jobs/${jobId}`), {
            headers: { "Accept-Language": "ko-KR" },
        });
        if (res.ok) {
            const job = (await res.json()) as JobRow;
            if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
                return job;
            }
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
}
