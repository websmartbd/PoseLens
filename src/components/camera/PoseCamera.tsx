"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { analyzePoseFromImage } from "@/lib/ai-service";
import { drawSkeleton } from "@/lib/skeletonDraw";
import type { Provider, PoseResponse } from "@/types";
import { ENERGY_BADGE_COLORS, ENERGY_GLOW, USER_ERRORS } from "@/config/constants";
import SettingsModal from "@/components/ui/SettingsModal";

type AppState = "idle" | "camera" | "capturing" | "analyzing" | "result" | "error";

const friendlyError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : "Unknown error occurred";
  const key = Object.keys(USER_ERRORS).find((k) => msg.toLowerCase().includes(k.toLowerCase()));
  return key ? USER_ERRORS[key] : msg;
};

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

  // Check for API key on mount and react to cross-tab changes
  useEffect(() => {
    const check = () => setHasApiKey(!!localStorage.getItem("aipose_api_key")?.trim());
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [settingsOpen]);

  // Animate skeleton fade-in
  const animateSkeleton = useCallback(
    (poseData: PoseResponse, ctx: CanvasRenderingContext2D, w: number, h: number) => {
      cancelAnimationFrame(animFrameRef.current);
      alphaRef.current = 0;

      const animate = () => {
        alphaRef.current = Math.min(alphaRef.current + 0.04, 1);
        drawSkeleton(ctx, poseData, w, h, alphaRef.current);
        if (alphaRef.current < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    },
    []
  );

  // Start camera with a given facingMode
  const startCamera = useCallback(async (mode: "environment" | "user" = "environment") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      // Give Android hardware time to release the lens
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setCameraReady(false);
    setIsMirrored(mode === "user");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
      setFacingMode(mode);
      setAppState("camera");
      setError("");
    } catch (err: any) {
      // If the specific facing mode fails, try generic video as a fallback
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

  // Toggle between front and back camera
  const cycleCamera = useCallback(() => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    startCamera(newMode);
  }, [facingMode, startCamera]);

  // Stop camera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setPose(null);
    setAppState("idle");
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  }, []);

  // Capture and analyze
  const captureAndAnalyze = useCallback(async () => {
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (!video || !captureCanvas || !overlayCanvas || !cameraReady) return;

    const apiKey = localStorage.getItem("aipose_api_key")?.trim();
    const modelName = localStorage.getItem("aipose_model")?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
    const provider = (localStorage.getItem("aipose_provider") ?? "groq") as Provider;
    const language = localStorage.getItem("aipose_language") ?? "Bangla";
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }

    setAppState("capturing");

    // Brief flash effect
    await new Promise((r) => setTimeout(r, 150));

    // Draw current video frame to hidden capture canvas
    const { videoWidth, videoHeight } = video;
    captureCanvas.width = videoWidth;
    captureCanvas.height = videoHeight;
    const captureCtx = captureCanvas.getContext("2d")!;
    
    // If mirrored, flip the canvas before drawing the video so the AI gets the correct orientation
    if (isMirrored) {
      captureCtx.translate(videoWidth, 0);
      captureCtx.scale(-1, 1);
    }
    captureCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    // Reset transform just in case
    captureCtx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = captureCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];

    setAppState("analyzing");

    try {
      const result = await analyzePoseFromImage(base64, apiKey, modelName, provider, language, facingMode);
      setPose(result);
      setAppState("result");

      // Size overlay canvas to match the video element's displayed dimensions
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

  // Sync overlay canvas size on resize (coalesced via rAF)
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

  const glowColor = pose ? ENERGY_GLOW[pose.energy] ?? "#c77dff" : "#c77dff";

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white selection:bg-violet-500/30">
      {/* === BACKGROUND CAMERA === */}
      <div className="absolute inset-0 z-0 bg-gray-950">
        {appState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5">
              <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Camera is off</p>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${isMirrored ? "scale-x-[-1]" : ""}`}
          style={{ opacity: appState === "idle" ? 0 : 1 }}
        />

        {/* Canvas overlay for skeleton */}
        <canvas
          ref={overlayCanvasRef}
          className={`pointer-events-none absolute inset-0 h-full w-full ${isMirrored ? "scale-x-[-1]" : ""}`}
        />

        {/* Flash effect on capture */}
        {appState === "capturing" && (
          <div className="absolute inset-0 z-10 animate-[ping_0.3s_ease-out] bg-white" />
        )}

        {/* Analyzing overlay */}
        {appState === "analyzing" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-md">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-400" />
              <div
                className="absolute inset-2 animate-pulse rounded-full"
                style={{ background: "radial-gradient(circle, #c77dff40, transparent)" }}
              />
            </div>
            <p className="text-sm font-medium text-white tracking-wide">Designing Pose...</p>
          </div>
        )}

        {/* Shadow overlays for top and bottom readability */}
        <div className="pointer-events-none absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/90 to-transparent" />
      </div>

      {/* === HEADER (Floating) === */}
      <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between p-4 pt-safe-top">
        <div className="flex items-center gap-1">
          {/* Subtle Logo */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
            <img src="/images/logo.png" alt="PoseLens" className="h-full w-full object-cover" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white/90 drop-shadow-md">
            PoseLens
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {(appState === "camera" || appState === "result") && (
            <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 border border-red-500/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">Live</span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white transition hover:bg-black/70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Error Toast */}
      {appState === "error" && error && (
        <div className="absolute top-20 left-4 right-4 z-50 flex items-start gap-2 rounded-2xl bg-red-500/90 backdrop-blur-md p-3 shadow-2xl">
          <span className="text-white text-sm">⚠</span>
          <p className="text-xs text-white/90">{error}</p>
        </div>
      )}

      {/* === RESULT BOTTOM SHEET === */}
      {pose && appState === "result" && (
        <div className="absolute bottom-[100px] left-4 right-4 z-20 animate-fade-in">
          <div
            className="rounded-3xl border bg-black/60 backdrop-blur-xl p-4 shadow-2xl transition-all duration-500"
            style={{
              borderColor: glowColor + "40",
              boxShadow: `0 20px 40px ${glowColor}15, inset 0 1px 0 ${glowColor}30`,
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white leading-tight">{pose.pose_name}</h3>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  ENERGY_BADGE_COLORS[pose.energy] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                }`}
              >
                {pose.energy}
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-snug">{pose.description}</p>
          </div>
        </div>
      )}

      {/* === FLOATING BOTTOM CONTROLS === */}
      <div className="absolute bottom-0 left-0 z-30 flex w-full flex-col items-center pb-safe-bottom">
        <div className="flex w-full max-w-sm items-center justify-center gap-6 p-6">
          {appState === "idle" ? (
            <button
              onClick={() => startCamera()}
              className="flex w-full max-w-[200px] items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-3.5 text-sm font-bold shadow-xl transition active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open Camera
            </button>
          ) : (
            <>
              {/* Stop / Cancel button */}
              <button
                onClick={stopCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white transition active:scale-90"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Shutter Button (Capture) */}
              <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/40">
                <button
                  onClick={captureAndAnalyze}
                  disabled={!cameraReady || appState === "analyzing" || appState === "capturing"}
                  className="h-14 w-14 rounded-full bg-white transition active:scale-90 disabled:opacity-50"
                />
              </div>

              {/* Retake / Refresh OR Camera Flip */}
              {appState === "result" ? (
                <button
                  onClick={captureAndAnalyze}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white transition active:scale-90"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={cycleCamera}
                  disabled={!cameraReady || appState === "analyzing" || appState === "capturing"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white transition active:scale-90 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Settings modal */}
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
