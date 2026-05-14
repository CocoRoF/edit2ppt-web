"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import GenerateForm from "@/components/GenerateForm";
import ProgressTimeline from "@/components/ProgressTimeline";
import UploadDropzone, {
    type UploadedAsset,
} from "@/components/UploadDropzone";
import { useJobEvents, type JobEvent } from "@/hooks/useJobEvents";

/**
 * Generate screen — W3 wiring.
 *
 * Three steps:
 *   1. Upload source (UploadDropzone) — Korean filename preserved.
 *   2. Fill the form (GenerateForm) — BYOK Anthropic key per session.
 *   3. Watch the SSE stream (ProgressTimeline).
 *
 * The download-and-preview step (W4) hooks into the `onTerminal` callback
 * to navigate the user to `/jobs/<id>`. For now we display the final
 * payload inline so the flow is testable end-to-end.
 */
export default function GeneratePage() {
    const router = useRouter();
    const [asset, setAsset] = useState<UploadedAsset | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [terminal, setTerminal] = useState<JobEvent | null>(null);

    // When the engine flips the job to `done`, hop to the result view so the
    // user lands on the PPTX download + design_spec page.
    const handleTerminal = useCallback(
        (ev: JobEvent) => {
            setTerminal(ev);
            if (ev.payload.stage === "done" && jobId) {
                // Small delay so the success banner is visible briefly
                // before navigation; smoothing the transition.
                setTimeout(() => router.push(`/jobs/${jobId}`), 750);
            }
        },
        [router, jobId],
    );

    const { events, connected, error } = useJobEvents({
        jobId,
        onTerminal: handleTerminal,
    });

    const step: 1 | 2 | 3 = asset === null ? 1 : jobId === null ? 2 : 3;

    return (
        <main className="flex-1 flex flex-col items-center px-6 py-12 max-w-5xl mx-auto w-full">
            <header className="w-full text-center">
                <p className="text-sm font-medium text-primary-600">
                    Step {step} / 3
                </p>
                <h1 className="mt-2 text-3xl font-bold text-neutral-900">
                    {step === 1
                        ? "소스 파일 업로드"
                        : step === 2
                          ? "발표 의도 + 옵션"
                          : "생성 진행 중"}
                </h1>
                <p className="mt-3 text-neutral-600">
                    {step === 1 && "PDF · DOCX · PPTX · XLSX · HTML · EPUB 중 하나. 한글 파일명은 원본 그대로 보존됩니다."}
                    {step === 2 && "BYOK Anthropic 키는 이 요청에만 사용됩니다. 추가 옵션을 펼쳐 페이지 수 · 이미지 · 내레이션을 조정하세요."}
                    {step === 3 && "진행 상황을 실시간으로 받아옵니다. 완료되면 결과 PPTX 와 미리보기가 나타납니다."}
                </p>
            </header>

            {step === 1 && asset === null && (
                <section className="mt-10 w-full">
                    <UploadDropzone onUploaded={setAsset} />
                </section>
            )}

            {step === 2 && asset !== null && (
                <section className="mt-10 w-full max-w-2xl">
                    <UploadSummary asset={asset} onReset={() => setAsset(null)} />
                    <div className="mt-8">
                        <GenerateForm
                            asset={asset}
                            onSubmitted={({ jobId }) => setJobId(jobId)}
                        />
                    </div>
                </section>
            )}

            {step === 3 && jobId !== null && (
                <section className="mt-10 w-full max-w-3xl space-y-6">
                    <ProgressTimeline
                        events={events}
                        connected={connected}
                        error={error}
                    />
                    {terminal && (
                        <TerminalSummary jobId={jobId} terminal={terminal} />
                    )}
                </section>
            )}
        </main>
    );
}

function UploadSummary({
    asset,
    onReset,
}: {
    asset: UploadedAsset;
    onReset: () => void;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-900 truncate">
                    {asset.original_filename ?? "(이름 없음)"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                    {(asset.size / 1024 / 1024).toFixed(2)} MB · {asset.mime_type}
                </p>
            </div>
            <button
                type="button"
                onClick={onReset}
                className="text-xs text-neutral-500 hover:text-neutral-800 underline-offset-2 hover:underline"
            >
                다른 파일
            </button>
        </div>
    );
}

function TerminalSummary({
    jobId,
    terminal,
}: {
    jobId: string;
    terminal: JobEvent;
}) {
    const stage = terminal.payload.stage ?? "?";
    const isDone = stage === "done";
    return (
        <div
            className={
                isDone
                    ? "rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-5"
                    : "rounded-xl border border-red-200 bg-red-50 px-5 py-5"
            }
        >
            <h3 className="font-semibold text-neutral-900">
                {isDone ? "✅ 생성이 완료되었습니다" : "❌ 작업이 실패했습니다"}
            </h3>
            <p className="mt-1 text-sm text-neutral-700">
                job id <code className="font-mono">{jobId.slice(0, 8)}…</code>
            </p>
            <p className="mt-3 text-xs text-neutral-600">
                상세 결과 / 미리보기 / 다운로드는 W4 PR 에서 추가됩니다.
            </p>
        </div>
    );
}
