"use client";

import { SiteHeader } from "@/components/SiteHeader";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <><SiteHeader /><main className="state-page"><span className="eyebrow">Something went wrong</span><h1>कृपया पुन्हा प्रयत्न करा.</h1><p>या विनंतीवर प्रक्रिया करता आली नाही.</p><button className="button" onClick={reset}>पुन्हा प्रयत्न</button></main></>; }
