"use client";

import {
    AlertCircle,
    FileText,
    Key,
    Loader2,
    Paperclip,
    SendHorizonal,
    Settings2,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { withBase } from "@/lib/basePath";
import type { UploadedAsset } from "@/components/UploadDropzone";

/** One rendered chat bubble. */
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    kind?: "normal" | "error";
    /** Applied operations summary chips (assistant messages only). */
    ops?: Array<{ action: string; slide?: number; after?: number }>;
}

export interface StudioConfig {
    anthropicKey: string;
    model: string;
    lang: "ko-KR" | "en-US" | "zh-CN" | "ja-JP";
}

interface ChatPanelProps {
    messages: ChatMessage[];
    config: StudioConfig;
    onConfigChange: (config: StudioConfig) => void;
    /** attachments = source asset ids uploaded for THIS turn. */
    onSend: (instruction: string, attachments: UploadedAsset[]) => void;
    /** A turn is running: input disabled, progress bubble shown. */
    busy: boolean;
    /** Current stage label while busy (from the SSE stream). */
    stageLabel: string | null;
    /** Chat is enabled only once a deck is loaded. */
    disabled: boolean;
}

const ATTACH_ACCEPT =
    "application/pdf," +
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
    "application/msword," +
    "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
    "text/html,application/epub+zip";

const MODELS = [
    { value: "claude-opus-4-7", label: "Claude Opus 4.7 (기본)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (빠름)" },
];

const OP_LABEL: Record<string, string> = {
    edit: "수정",
    add: "추가",
    delete: "삭제",
};

/**
 * Left-hand panel of the studio: BYOK config on top, chat transcript in
 * the middle, instruction input at the bottom.
 */
export default function ChatPanel({
    messages,
    config,
    onConfigChange,
    onSend,
    busy,
    stageLabel,
    disabled,
}: ChatPanelProps) {
    const [draft, setDraft] = useState("");
    const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
    const [uploading, setUploading] = useState(false);
    const [attachError, setAttachError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, busy, stageLabel]);

    const keyMissing = config.anthropicKey.trim().length === 0;
    const canSend =
        !disabled && !busy && !uploading && !keyMissing && draft.trim().length >= 2;

    function submit() {
        if (!canSend) return;
        onSend(draft.trim(), attachments);
        setDraft("");
        setAttachments([]);
    }

    async function attachFile(file: File) {
        setAttachError(null);
        if (file.size > 200 * 1024 * 1024) {
            setAttachError("파일이 200 MB를 초과합니다.");
            return;
        }
        setUploading(true);
        try {
            const form = new FormData();
            form.set("file", file, file.name);
            const res = await fetch(withBase("/api/upload"), {
                method: "POST",
                body: form,
                headers: { "Accept-Language": "ko-KR" },
            });
            if (!res.ok) {
                setAttachError(`첨부 업로드 실패 (HTTP ${res.status})`);
                return;
            }
            const asset = (await res.json()) as UploadedAsset;
            setAttachments((prev) => [...prev, asset]);
        } catch (err) {
            setAttachError(
                `첨부 중 오류: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex h-full flex-col">
            <details
                className="border-b border-neutral-200 px-4 py-3"
                open={keyMissing}
            >
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800 select-none">
                    <Settings2 className="size-4" />
                    설정
                    {keyMissing && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            API 키 필요
                        </span>
                    )}
                </summary>
                <div className="mt-3 space-y-3">
                    <label className="block space-y-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                            <Key className="size-3.5" />
                            Anthropic API 키 (BYOK)
                        </span>
                        <input
                            type="password"
                            value={config.anthropicKey}
                            onChange={(e) =>
                                onConfigChange({ ...config, anthropicKey: e.target.value })
                            }
                            autoComplete="off"
                            placeholder="sk-ant-…"
                            className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 font-mono text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <span className="block text-[11px] text-neutral-500">
                            편집 요청에만 사용하며 저장하지 않습니다. 새로고침하면 다시 입력해야 합니다.
                        </span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1">
                            <span className="text-xs font-medium text-neutral-700">모델</span>
                            <select
                                value={config.model}
                                onChange={(e) =>
                                    onConfigChange({ ...config, model: e.target.value })
                                }
                                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                            >
                                {MODELS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-medium text-neutral-700">언어</span>
                            <select
                                value={config.lang}
                                onChange={(e) =>
                                    onConfigChange({
                                        ...config,
                                        lang: e.target.value as StudioConfig["lang"],
                                    })
                                }
                                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                            >
                                <option value="ko-KR">한국어</option>
                                <option value="en-US">English</option>
                                <option value="zh-CN">简体中文</option>
                                <option value="ja-JP">日本語</option>
                            </select>
                        </label>
                    </div>
                </div>
            </details>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 && !busy && (
                    <div className="space-y-2 rounded-lg bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                        <p className="font-medium text-neutral-800">이렇게 요청해 보세요</p>
                        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                            <li>3번 슬라이드 제목을 &lsquo;Q3 실적 요약&rsquo;으로 바꿔줘</li>
                            <li>2번 슬라이드 뒤에 로드맵 슬라이드를 추가해줘</li>
                            <li>마지막 슬라이드를 지워줘</li>
                            <li>📎 문서를 첨부하고 &ldquo;이 내용으로 5번을 채워줘&rdquo;</li>
                            <li>이 덱의 구성이 어떻게 돼? (질문만 해도 됩니다)</li>
                        </ul>
                        <p className="pt-1 text-[11px] text-neutral-500">
                            팁: 오른쪽 캔버스에서 텍스트를 <b>더블클릭</b>하면 AI 없이 즉시 수정됩니다.
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                    >
                        <div
                            className={
                                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                                (msg.role === "user"
                                    ? "bg-primary-600 text-white"
                                    : msg.kind === "error"
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : "bg-neutral-100 text-neutral-800")
                            }
                        >
                            {msg.kind === "error" && (
                                <AlertCircle className="mb-1 size-4" aria-hidden />
                            )}
                            {msg.content}
                            {msg.ops && msg.ops.length > 0 && (
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                    {msg.ops.map((op, j) => (
                                        <span
                                            key={j}
                                            className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-neutral-700 border border-neutral-200"
                                        >
                                            {OP_LABEL[op.action] ?? op.action}
                                            {op.slide != null && ` ${op.slide}p`}
                                            {op.after != null && ` ${op.after}p 뒤`}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {busy && (
                    <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-2xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-600">
                            <Loader2 className="size-4 animate-spin text-primary-600" />
                            {stageLabel ?? "작업 중…"}
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t border-neutral-200 p-3">
                {attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {attachments.map((a) => (
                            <span
                                key={a.id}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700"
                            >
                                <FileText className="size-3 shrink-0 text-primary-600" />
                                <span className="truncate">
                                    {a.original_filename ?? "파일"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAttachments((prev) =>
                                            prev.filter((x) => x.id !== a.id),
                                        )
                                    }
                                    aria-label="첨부 제거"
                                    className="text-neutral-400 hover:text-neutral-700"
                                >
                                    <X className="size-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                {attachError && (
                    <p className="mb-1.5 text-[11px] text-red-600">{attachError}</p>
                )}
                <div className="flex items-end gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ATTACH_ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void attachFile(f);
                            e.target.value = "";
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || busy || uploading}
                        aria-label="문서 첨부"
                        title="참고 문서 첨부 (PDF·DOCX·PPTX·…)"
                        className="rounded-lg border border-neutral-300 p-2.5 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
                    >
                        {uploading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Paperclip className="size-4" />
                        )}
                    </button>
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        rows={2}
                        disabled={disabled || busy}
                        placeholder={
                            disabled
                                ? "먼저 PPTX 파일을 업로드하세요"
                                : "편집 요청을 입력하세요 (Enter 전송 · Shift+Enter 줄바꿈)"
                        }
                        className="flex-1 resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-50"
                    />
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSend}
                        aria-label="보내기"
                        className="rounded-lg bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                        <SendHorizonal className="size-4" />
                    </button>
                </div>
                {keyMissing && !disabled && (
                    <p className="mt-1.5 text-[11px] text-amber-600">
                        설정에서 Anthropic API 키를 입력하면 채팅 편집을 시작할 수 있습니다.
                    </p>
                )}
            </div>
        </div>
    );
}
