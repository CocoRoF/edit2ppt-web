import { NextRequest, NextResponse } from "next/server";

import { authHeaders, engineUrl } from "@/lib/serverProxy";

/**
 * GET /edit2ppt/api/assets/[id]/download
 *
 * Asks the engine for a presigned download URL, then 302-redirects the
 * browser straight to MinIO. The presigned URL already carries the Korean
 * filename via `Content-Disposition: attachment; filename*=UTF-8''<encoded>`
 * — the browser saves the file under that name (no further work on our side).
 *
 * Why not stream through? The presigned URL points at MinIO which is on
 * the docker-internal network in dev but is also accessible via
 * /uploads/ in production. Either way, asking the browser to fetch the
 * presigned URL directly removes us from the byte path — faster downloads
 * and no Next.js memory pressure for ~50MB PPTX files.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const search = req.nextUrl.searchParams;
    const expires = search.get("expires_in_seconds") ?? "300";

    const upstream = await fetch(
        engineUrl(`/v1/assets/${id}/download?expires_in_seconds=${expires}`),
        {
            method: "GET",
            headers: {
                ...authHeaders(),
                "Accept-Language": req.headers.get("accept-language") ?? "ko-KR",
            },
        },
    );

    if (!upstream.ok) {
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
        });
    }

    const json = (await upstream.json()) as {
        download_url: string;
        expires_in_seconds: number;
        filename: string | null;
        mime_type: string;
    };

    // The user is expected to land here from an <a href> click, so a 302 to
    // the presigned URL is what we want — the browser follows automatically
    // and honors the Content-Disposition the engine baked into the URL.
    return NextResponse.redirect(json.download_url, {
        status: 302,
        // Forward the engine's metadata for callers that want to inspect
        // before following (e.g. fetch + AbortController). The Location
        // header is what does the work; these are advisory.
        headers: {
            "Content-Disposition": json.filename
                ? `attachment; filename*=UTF-8''${encodeURIComponent(
                      json.filename,
                  )}`
                : "attachment",
        },
    });
}
