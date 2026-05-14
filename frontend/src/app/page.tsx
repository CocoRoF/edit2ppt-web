import Link from "next/link";
import { FileText, Zap, Plug } from "lucide-react";

/**
 * edit2ppt-web home / demo entry point.
 *
 * Polishing arrives in W5 — this placeholder confirms the basePath is
 * wired, the Korean typography stack loads, and the three primary
 * call-to-actions point at the right routes.
 */
export default function Home() {
    return (
        <main className="flex-1 flex flex-col items-center px-6 py-16 max-w-4xl mx-auto w-full">
            <section className="text-center">
                <p className="text-sm font-medium text-primary-600 mb-3">
                    한국어 네이티브 · AI Agent 호환
                </p>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
                    한국어 PDF를
                    <br />
                    편집 가능한 PowerPoint로
                </h1>
                <p className="mt-6 text-lg text-neutral-600 leading-relaxed">
                    문서를 올리고, Anthropic 키를 붙여 넣고, &ldquo;생성&rdquo;을 누르세요. <br />
                    Pretendard로 조판된 한국어 슬라이드를 진짜 편집 가능한 PPTX로 받아갑니다.
                </p>

                <div className="mt-10 flex flex-wrap justify-center gap-3">
                    <Link
                        href="/generate"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-white font-medium shadow-sm hover:bg-primary-700 transition-colors"
                    >
                        <Zap className="size-4" />
                        지금 만들어보기
                    </Link>
                    <a
                        href="/edit2ppt-api/docs"
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-5 py-3 font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                        <FileText className="size-4" />
                        REST API 문서
                    </a>
                    <Link
                        href="/docs/mcp"
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-5 py-3 font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                        <Plug className="size-4" />
                        MCP 연결 가이드
                    </Link>
                </div>
            </section>

            <section className="mt-20 grid sm:grid-cols-3 gap-6 w-full">
                <Feature title="한국어 우선" body="Hangul 텍스트 폭 정확 계산, OOXML lang=ko-KR, Pretendard / Apple SD Gothic Neo / Malgun Gothic 스택." />
                <Feature title="진짜 편집 가능" body="이미지가 아닌 DrawingML 도형. PowerPoint에서 모든 텍스트·차트·도형을 그대로 편집." />
                <Feature title="AI Agent 호환" body="MCP 서버를 같은 호스트에서 노출. Claude Desktop / Cursor에서 URL 한 줄로 연결." />
            </section>

            <footer className="mt-24 text-sm text-neutral-500">
                <a className="hover:text-neutral-700" href="https://github.com/CocoRoF/edit2ppt" target="_blank" rel="noreferrer">
                    엔진 소스 — github.com/CocoRoF/edit2ppt
                </a>
                {" · "}
                <a className="hover:text-neutral-700" href="https://github.com/CocoRoF/edit2ppt-web" target="_blank" rel="noreferrer">
                    이 화면 소스
                </a>
            </footer>
        </main>
    );
}

function Feature({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-2">{title}</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{body}</p>
        </div>
    );
}
