"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, AlertCircle, RefreshCw, Hash, ArrowRight } from "lucide-react";
import jsQR from "jsqr";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function parseTableCodeFromText(text: string): string | null {
  const trimmed = text.trim();
  // Pattern 1: URL like https://.../t/04 or /t/04
  const urlMatch = trimmed.match(/\/t\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].padStart(2, "0");
  }
  // Pattern 2: "table 4" or "Table-04"
  const tableMatch = trimmed.match(/table[\s_-]*(\d+)/i);
  if (tableMatch && tableMatch[1]) {
    return tableMatch[1].padStart(2, "0");
  }
  // Pattern 3: plain number "1" or "01"
  const numberMatch = trimmed.match(/^(\d{1,2})$/);
  if (numberMatch && numberMatch[1]) {
    return numberMatch[1].padStart(2, "0");
  }
  return null;
}

export default function QrScannerModal({ isOpen, onClose }: QrScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasCameraSupport, setHasCameraSupport] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");
  const [scanSuccessCode, setScanSuccessCode] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDetectedCode = useCallback(
    (scannedString: string) => {
      const tableCode = parseTableCodeFromText(scannedString);
      if (tableCode) {
        setScanSuccessCode(tableCode);
        stopCamera();
        setTimeout(() => {
          onClose();
          router.push(`/t/${tableCode}`);
        }, 700);
      }
    },
    [onClose, router, stopCamera]
  );

  const requestScan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(requestScan);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      handleDetectedCode(code.data);
      return;
    }

    animFrameRef.current = requestAnimationFrame(requestScan);
  }, [handleDetectedCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsStartingCamera(true);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setHasCameraSupport(false);
      setCameraError(
        "Camera access is not supported by this browser context (requires HTTPS or modern browser)."
      );
      setIsStartingCamera(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsStartingCamera(false);
        requestScan();
      }
    } catch (err: unknown) {
      setIsStartingCamera(false);
      const errorMsg =
        err instanceof Error ? err.message : "Unable to access camera.";
      if (
        errorMsg.toLowerCase().includes("permission") ||
        errorMsg.toLowerCase().includes("denied") ||
        (err as { name?: string }).name === "NotAllowedError"
      ) {
        setCameraError(
          "Camera permission was denied. Please allow camera permissions in your browser or enter your table code manually below."
        );
      } else {
        setCameraError(
          "Could not initialize camera stream. You can enter the table code manually below."
        );
      }
    }
  }, [requestScan]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setScanSuccessCode(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const formatted = manualCode.trim().padStart(2, "0");
    onClose();
    router.push(`/t/${formatted}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">Scan Table QR</h3>
              <p className="text-xs text-zinc-400">Brew & Bean Café</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[280px] overflow-hidden">
          {scanSuccessCode ? (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-pulse">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Hash className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold text-emerald-400">
                Table {scanSuccessCode} Detected!
              </h4>
              <p className="text-sm text-zinc-300 mt-1">
                Opening your digital table menu...
              </p>
            </div>
          ) : cameraError || !hasCameraSupport ? (
            <div className="p-6 text-center max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm text-zinc-300 font-medium mb-1">
                Camera Notice
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                {cameraError || "Camera scanner unavailable."}
              </p>
              {hasCameraSupport && (
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 underline font-medium"
                >
                  <RefreshCw className="h-3 w-3" /> Try Reconnecting Camera
                </button>
              )}
            </div>
          ) : (
            <div className="relative w-full h-[280px] bg-black">
              {isStartingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-zinc-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-500 mb-2" />
                  <span className="text-xs">Initializing camera feed...</span>
                </div>
              )}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-48 border-2 border-amber-400/80 rounded-xl">
                  {/* Glowing corners */}
                  <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-amber-400" />
                  <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-amber-400" />
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-400/30 animate-pulse" />
                </div>
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                <span className="inline-block bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-zinc-300">
                  Align Table QR code inside frame
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Table Code Entry Fallback */}
        <div className="border-t border-zinc-800 bg-zinc-950/80 p-5">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">
              Manual Table Entry
            </span>
            <span>Example: 01, 02, 03</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Hash className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter Table No. (e.g. 01)"
                maxLength={4}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>Go</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Table Pills */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-500">Quick Test:</span>
            {["01", "02", "03", "04"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/t/${code}`);
                }}
                className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300 hover:bg-amber-600/30 hover:text-amber-300 transition"
              >
                Table {code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

