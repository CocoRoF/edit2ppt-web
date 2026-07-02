"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { useMemo } from "react";

import { withBase } from "@/lib/basePath";

export interface PreviewSlide {
    index: number;
    svg: string;
}

interface SlideCanvasProps {
    filename: string;
    assetId: string;
    slides: PreviewSlide[];
    widthPx: number;
    heightPx: number;
    /** A chat turn is running — dim the canvas and show a spinner. */
    busy: boolean;
    /** Preview fetch in flight (initial load or refresh after an edit). */
    loading: boolean;
    onReset: () => void;
}

/**
 * Right-hand canvas of the studio: a vertically scrolling reading view of
 * every slide, rendered from the engine's self-contained SVGs.
 *
 * SVGs are displayed through <img> with a data URL — the browser treats
 * them as images, so no script inside user-supplied deck content can run.
 */
export default function SlideCanvas({
    filename,
    assetId,
    slides,
    widthPx,
    heightPx,
    busy,
    loading,
    onReset,
}: SlideCanvasProps) {
    const sources = useMemo(
        () =>
            slides.map(
                (s) =>
                    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`,
            ),
        [slides],
    );

    return (
        <div className="flex h-full flex-col bg-neutral-100">
            <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                    {filename}
                    <span className="ml-2 text-xs font-normal text-neutral-500">
                        {slides.length}장
                    </span>
                </p>
                <a
                    href={withBase(`/api/assets/${assetId}/download`)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                    <Download className="size-3.5" />
                    PPTX 다운로드
                </a>
                <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                    <FileUp className="size-3.5" />
                    다른 파일
                </button>
            </div>

            <div className="relative flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
                    {slides.map((slide, i) => (
                        <figure key={`${assetId}-${slide.index}`}>
                            <figcaption className="mb-1.5 text-xs font-medium text-neutral-500">
                                {i + 1} / {slides.length}
                            </figcaption>
                            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={sources[i]}
                                    alt={`슬라이드 ${i + 1}`}
                                    width={widthPx}
                                    height={heightPx}
                                    className="block h-auto w-full"
                                />
                            </div>
                        </figure>
                    ))}
                    {slides.length === 0 && !loading && (
                        <p className="py-20 text-center text-sm text-neutral-500">
                            미리보기를 불러오지 못했습니다.
                        </p>
                    )}
                </div>

                {(busy || loading) && (
                    <div className="pointer-events-none sticky bottom-0 inset-x-0 flex justify-center pb-6">
                        <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
                            <Loader2 className="size-3.5 animate-spin" />
                            {busy ? "편집 반영 중…" : "미리보기 갱신 중…"}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
