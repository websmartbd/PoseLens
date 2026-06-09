"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { analyzePoseFromImage } from "@/lib/ai-service";
import { drawSkeleton } from "@/lib/skeletonDraw";
import type { Provider, PoseResponse } from "@/types";
import { USER_ERRORS } from "@/config/constants";
import SettingsModal from "@/components/ui/SettingsModal";

type AppState = "idle" | "camera" | "capturing" | "analyzing" | "result" | "error";

const friendlyError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : "Unknown error occurred";
  const key = Object.keys(USER_ERRORS).find((k) => msg.toLowerCase().includes(k.toLowerCase()));
  return key ? USER_ERRORS[key] : msg;
};

const DOT_COLORS = ["#a855f7", "#c084fc", "#e879f9", "#f0abfc"];

export default function PoseCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const alphaRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [appState, setAppState] = useState<AppState>("idle");
  const [pose, setPose] = useState<PoseResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [showCard, setShowCard] = useState(true);

  useEffect(() => {
    const check = () => setHasApiKey(!!localStorage.getItem("aipose_api_key")?.trim());
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [settingsOpen]);

  const animateSkeleton = useCallback(
    (poseData: PoseResponse, ctx: CanvasRenderingContext2D, w: number, h: number) => {
      cancelAnimationFrame(animFrameRef.current);
      alphaRef.current = 0;
      const animate = () => {
        alphaRef.current = Math.min(alphaRef.current + 0.04, 1);
        drawSkeleton(ctx, poseData, w, h, alphaRef.current);
        if (alphaRef.current < 1) animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
    },
    []
  );

  const startCamera = useCallback(async (mode: "environment" | "user" = "environment") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setCameraReady(false);
    setIsMirrored(mode === "user");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
      setFacingMode(mode);
      setAppState("camera");
      setError("");
    } catch (err: any) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
        setFacingMode(mode);
        setAppState("camera");
        setError("");
      } catch {
        setError(`Camera unavailable: ${err.message || "Unknown error"}`);
        setAppState("error");
      }
    }
  }, []);

  const cycleCamera = useCallback(() => {
    startCamera(facingMode === "environment" ? "user" : "environment");
  }, [facingMode, startCamera]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setPose(null);
    setShowCard(true);
    setAppState("idle");
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !captureCanvas || !overlayCanvas || !cameraReady) return;

    const apiKey = localStorage.getItem("aipose_api_key")?.trim();
    const modelName = localStorage.getItem("aipose_model")?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
    const provider = (localStorage.getItem("aipose_provider") ?? "groq") as Provider;
    const language = localStorage.getItem("aipose_language") ?? "Bangla";
    if (!apiKey) { setSettingsOpen(true); return; }

    setAppState("capturing");
    setShowCard(true);
    await new Promise((r) => setTimeout(r, 150));

    const { videoWidth, videoHeight } = video;
    captureCanvas.width = videoWidth;
    captureCanvas.height = videoHeight;
    const captureCtx = captureCanvas.getContext("2d")!;
    if (isMirrored) { captureCtx.translate(videoWidth, 0); captureCtx.scale(-1, 1); }
    captureCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    captureCtx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = captureCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    setAppState("analyzing");

    try {
      const result = await analyzePoseFromImage(base64, apiKey, modelName, provider, language, facingMode);
      setPose(result);
      setAppState("result");
      const rect = video.getBoundingClientRect();
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
      const ctx = overlayCanvas.getContext("2d")!;
      animateSkeleton(result, ctx, rect.width, rect.height);
    } catch (err) {
      setError(friendlyError(err));
      setAppState("error");
    }
  }, [cameraReady, animateSkeleton, isMirrored, facingMode]);

  useEffect(() => {
    if (!videoRef.current || !overlayCanvasRef.current) return;
    let rafId: number;
    const sync = () => {
      if (!videoRef.current || !overlayCanvasRef.current) return;
      const rect = videoRef.current.getBoundingClientRect();
      overlayCanvasRef.current.width = rect.width;
      overlayCanvasRef.current.height = rect.height;
      if (pose) {
        const ctx = overlayCanvasRef.current.getContext("2d")!;
        drawSkeleton(ctx, pose, rect.width, rect.height, 1);
      }
    };
    const onResize = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(sync); };
    const observer = new ResizeObserver(onResize);
    observer.observe(videoRef.current);
    return () => { observer.disconnect(); cancelAnimationFrame(rafId); };
  }, [pose]);

  // Determine if we need space for the bottom bar
  const isCameraActive = appState !== "idle";
  const BOTTOM_BAR_HEIGHT = 120;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">

      {/* ═══════════════ CAMERA BACKGROUND ═══════════════ */}
      {/* Container ends at the bottom bar when active, or fills screen when idle */}
      <div 
        className="absolute inset-x-0 top-0 z-0 bg-[#050505] transition-all duration-300"
        style={{ bottom: isCameraActive ? `${BOTTOM_BAR_HEIGHT}px` : "0px" }}
      >
        {appState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "radial-gradient(ellipse at 50% 60%, #1a0a2e 0%, #060010 100%)" }}>
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ border: "1px solid rgba(167,139,250,0.2)", background: "rgba(124,58,237,0.08)", boxShadow: "0 0 40px rgba(124,58,237,0.15)" }}>
              <svg className="h-10 w-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium tracking-wide text-purple-300/60">Tap to open camera</p>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${isMirrored ? "scale-x-[-1]" : ""}`}
          style={{ opacity: appState === "idle" ? 0 : 1 }} />

        <canvas ref={overlayCanvasRef}
          className={`pointer-events-none absolute inset-0 h-full w-full ${isMirrored ? "scale-x-[-1]" : ""}`} />

        {appState === "capturing" && (
          <div className="absolute inset-0 z-10 bg-white/70 animate-[ping_0.25s_ease-out]" />
        )}

        {appState === "analyzing" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
            style={{ background: "rgba(5,0,15,0.7)", backdropFilter: "blur(10px)" }}>
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full border border-purple-500/30" />
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-purple-500/20 border-t-purple-400" />
              <div className="absolute inset-3 animate-pulse rounded-full"
                style={{ background: "radial-gradient(circle, rgba(199,119,255,0.4), transparent)" }} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-purple-300">Designing Pose...</p>
          </div>
        )}
      </div>

      {/* ═══════════════ TOP LOGO BAR (always visible) ═══════════════ */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-2 pb-3">
        {/* Left: Logo */}
        <div className="flex items-center">
          <div className="h-6" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
            <img src="/images/logo.png" alt="PoseLens" className="h-full w-auto object-contain" />
          </div>
        </div>

        {/* Right: Settings */}
        <button id="settings-btn" onClick={() => setSettingsOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:text-white active:scale-90"
          style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* ═══════════════ ERROR TOAST ═══════════════ */}
      {appState === "error" && error && (
        <div className="absolute top-20 inset-x-4 z-50 flex items-start gap-3 rounded-2xl p-3 shadow-2xl"
          style={{ background: "rgba(200,30,30,0.88)", backdropFilter: "blur(12px)" }}>
          <span>⚠</span>
          <p className="text-xs text-white/90">{error}</p>
        </div>
      )}

      {/* ═══════════════ INSTRUCTION CARD (result only, dismissible) ═══════════════ */}
      {pose && appState === "result" && showCard && (
        <div className="absolute left-4 z-20 animate-fade-in" style={{ bottom: "120px" }}>
          <div className="rounded-2xl px-4 py-3.5 max-w-[240px] relative"
            style={{
              background: "rgba(10, 5, 20, 0.88)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
            {/* Header row: title + close */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-white tracking-tight">Instraction</h3>
              <button onClick={() => setShowCard(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 hover:text-white transition"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Bullet list */}
            {pose.annotations && pose.annotations.length > 0 ? (
              <ul className="space-y-2.5">
                {pose.annotations.map((ann, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[5px] flex h-3 w-3 shrink-0 items-center justify-center rounded-full"
                      style={{ background: DOT_COLORS[i % DOT_COLORS.length], boxShadow: `0 0 6px ${DOT_COLORS[i % DOT_COLORS.length]}80` }} />
                    <span className="text-[13px] font-semibold leading-snug text-white/90">{ann.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-snug text-white/80">{pose.description}</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM BAR ═══════════════ */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end pointer-events-none">
        {appState === "idle" ? (
          <div className="flex items-center justify-center pb-16 pt-4 pointer-events-auto">
            <button id="open-camera-btn" onClick={() => startCamera()}
              className="flex items-center gap-2.5 rounded-full px-8 py-4 text-sm font-bold text-white shadow-2xl transition active:scale-95"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                boxShadow: "0 0 30px rgba(124,58,237,0.5), 0 4px 20px rgba(0,0,0,0.4)",
              }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open Camera
            </button>
          </div>
        ) : (
          /* Dark solid bottom bar */
          <div className="flex items-center justify-between px-8 w-full pointer-events-auto"
            style={{ height: `${BOTTOM_BAR_HEIGHT}px`, background: "#000000" }}>

            {/* Left: Close / Stop camera */}
            <button id="stop-camera-btn" onClick={stopCamera}
              className="flex h-14 w-14 items-center justify-center rounded-full text-white transition active:scale-90"
              style={{ background: "#1c1c1e" }}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Center: Shutter / Click */}
            <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-full"
              style={{
                border: "3px solid rgba(168,85,247,0.6)",
                boxShadow: "0 0 20px rgba(168,85,247,0.4), inset 0 0 12px rgba(168,85,247,0.15)",
                background: "#1c1c1e",
              }}>
              <button id="shutter-btn" onClick={captureAndAnalyze}
                disabled={!cameraReady || appState === "analyzing" || appState === "capturing"}
                className="h-[60px] w-[60px] rounded-full transition active:scale-90 disabled:opacity-40"
                style={{
                  background: "radial-gradient(circle at 40% 35%, #ffffff 0%, #e8e8e8 100%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              />
            </div>

            {/* Right: Flip / Refresh */}
            {appState === "result" ? (
              <button id="retake-btn" onClick={captureAndAnalyze}
                className="flex h-14 w-14 items-center justify-center rounded-full text-white transition active:scale-90"
                style={{ background: "#1c1c1e" }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            ) : (
              <button id="flip-btn" onClick={cycleCamera}
                disabled={!cameraReady || appState === "analyzing" || appState === "capturing"}
                className="flex h-14 w-14 items-center justify-center rounded-full text-white transition active:scale-90 disabled:opacity-40"
                style={{ background: "#1c1c1e" }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setHasApiKey(!!localStorage.getItem("aipose_api_key")?.trim());
        }}
      />
    </div>
  );
}
