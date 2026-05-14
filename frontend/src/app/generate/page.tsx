"use client";

import Link from "next/link";
import { useState } from "react";

import UploadDropzone, {
    type UploadedAsset,
} from "@/components/UploadDropzone";

/**
 * Generate screen — W2 version.
 *
 * Step 1: upload source (this commit).
 * Steps 2 (BYOK + options + SSE) and 3 (preview + download) land in W3+W4;
 * for now the page collapses to a single "next step" stub once the
 * upload completes so the URL flow is end-to-end testable.
 */
export default function GeneratePage() {
    const [uploaded, setUploaded] = useState<UploadedAsset | null>(null);

    return (
        <main className="flex-1 flex flex-col items-center px-6 py-12 max-w-3xl mx-auto w-full">
            <header className="w-full text-center">
                <p className="text-sm font-medium text-primary-600">
                    Step 1 / 3
                </p>
                <h1 className="mt-2 text-3xl font-bold text-neutral-900">
                    소스 파일 업로드
                </h1>
                <p className="mt-3 text-neutral-600">
                    PDF · DOCX · PPTX · XLSX · HTML · EPUB 중 하나를 올려주세요.
                    한글 파일명은 원본 그대로 보존됩니다.
                </p>
            </header>

            <section className="mt-10 w-full">
                <UploadDropzone onUploaded={setUploaded} />
            </section>

            {uploaded && (
                <section className="mt-8 w-full rounded-xl border border-primary-200 bg-primary-50/40 px-5 py-5">
                    <h2 className="font-semibold text-neutral-900">
                        Step 2 — 곧 추가됩니다
                    </h2>
                    <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
                        W3 PR에서 발표 의도 입력 · BYOK 키 입력 · 페이지 수 등의 옵션 폼 + SSE
                        진행률 화면이 추가됩니다. 업로드된 자산 id 는 다음 단계에서 그대로 사용됩니다.
                    </p>
                    <pre className="mt-3 text-xs font-mono bg-white border border-neutral-200 rounded-md px-3 py-2 overflow-x-auto">
{`asset_id: ${uploaded.id}
original_filename: ${uploaded.original_filename ?? "(none)"}
storage_key: ${uploaded.storage_key}`}
                    </pre>
                    <Link
                        href="/"
                        className="mt-4 inline-block text-sm text-primary-700 hover:text-primary-800"
                    >
                        ← 홈으로 돌아가기
                    </Link>
                </section>
            )}
        </main>
    );
}
