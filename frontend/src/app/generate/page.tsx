/**
 * Generate screen (placeholder).
 *
 * The real upload + form + SSE-progress UI lands in W2 / W3 / W4.
 * This placeholder gets the route reachable so W1's nginx + compose
 * integration has something to smoke-test.
 */
export const metadata = {
    title: "PPT 생성",
};

export default function GeneratePage() {
    return (
        <main className="flex-1 flex flex-col items-center px-6 py-16 max-w-3xl mx-auto w-full">
            <h1 className="text-3xl font-bold text-neutral-900">PPT 생성</h1>
            <p className="mt-3 text-neutral-600 text-center">
                업로드 · 생성 · 미리보기 화면이 곧 추가됩니다. (W2 / W3 / W4)
            </p>
            <p className="mt-12 text-sm text-neutral-500 max-w-md text-center leading-relaxed">
                현재 화면은 W0 스캐폴드의 라우트 확인용입니다. nginx가 <code className="font-mono text-xs px-1 py-0.5 bg-neutral-100 rounded">/edit2ppt/generate</code> 를
                이 페이지로 라우팅한다면 W1 통합도 정상 작동 중입니다.
            </p>
        </main>
    );
}
