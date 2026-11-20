"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  X,
  AlertCircle,
  RefreshCw,
  Hash,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
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

const ALL_TABLE_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

export default function QrScannerModal({ isOpen, onClose }: QrScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");
  const [scanSuccessCode, setScanSuccessCode] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStartingCamera(false);
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
      } else {
        setUploadNotice(`Unrecognized QR: "${scannedString.slice(0, 30)}". Please select table below.`);
      }
    },
    [onClose, router, stopCamera]
  );

  const requestScan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleDetectedCode(code.data);
            return;
          }
        } catch {}
      }
    }

    animFrameRef.current = requestAnimationFrame(requestScan);
  }, [handleDetectedCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setUploadNotice(null);
    setIsStartingCamera(true);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Camera access is not supported by your browser or environment. You can enter table code manually or upload QR photo below."
      );
      setIsStartingCamera(false);
      return;
    }

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    let stream: MediaStream | null = null;

    // Strategy 1: Ideal environment camera (smartphones back camera)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      // Strategy 2: Fallback to any default video device (laptops, webcams, desktop USB cameras)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err: unknown) {
        setIsStartingCamera(false);
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          errorMsg.toLowerCase().includes("permission") ||
          errorMsg.toLowerCase().includes("denied") ||
          (err as { name?: string }).name === "NotAllowedError"
        ) {
          setCameraError(
            "Camera permission was denied in your browser settings. Please allow camera permissions, or select your table below."
          );
        } else if (
          errorMsg.toLowerCase().includes("notfound") ||
          (err as { name?: string }).name === "NotFoundError"
        ) {
          setCameraError(
            "No webcam or camera device was found on this computer. Select your table below."
          );
        } else if (
          errorMsg.toLowerCase().includes("readable") ||
          (err as { name?: string }).name === "NotReadableError"
        ) {
          setCameraError(
            "Camera is currently being used by another application (e.g. Zoom or Teams). Please close other apps or pick table below."
          );
        } else {
          setCameraError(
            `Unable to start camera (${errorMsg || "Device busy"}). Select your table below.`
          );
        }
        return;
      }
    }

    if (!stream) {
      setIsStartingCamera(false);
      setCameraError("Unable to access video stream. Select your table below.");
      return;
    }

    streamRef.current = stream;

    // Ensure video element receives the stream
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      const onPlaying = () => {
        setIsStartingCamera(false);
        requestScan();
      };

      video.onloadedmetadata = async () => {
        try {
          await video.play();
          onPlaying();
        } catch {
          // Fallback if browser requires user gesture
          setIsStartingCamera(false);
        }
      };
    } else {
      setIsStartingCamera(false);
    }
  }, [requestScan]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setScanSuccessCode(null);
      setUploadNotice(null);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadNotice("Scanning uploaded image for QR code...");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setUploadNotice("Failed to inspect photo.");
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            handleDetectedCode(code.data);
          } else {
            setUploadNotice("No QR code found in this photo. Please select your table below.");
          }
        } catch {
          setUploadNotice("Unable to read image. Please enter table number directly.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 text-white shadow-2xl space-y-0">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 sm:px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-black shadow-xs">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-white">Scan Table QR</h3>
              <p className="text-[11px] text-zinc-400">Brew &amp; Bean Digital Table Service</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[250px] overflow-hidden">
          {/* Always mount video element to avoid ref detachment */}
          <video
            ref={videoRef}
            className={`w-full h-[250px] object-cover ${cameraError || scanSuccessCode ? "opacity-10 pointer-events-none" : "opacity-100"}`}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Success Overlay */}
          {scanSuccessCode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center animate-fade-in z-20">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="font-serif text-2xl font-bold text-emerald-400">
                Table {scanSuccessCode} Detected!
              </h4>
              <p className="text-xs text-zinc-300 mt-1">
                Opening your digital table menu...
              </p>
            </div>
          )}

          {/* Loading Camera Overlay */}
          {isStartingCamera && !cameraError && !scanSuccessCode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-10 text-zinc-300 p-4 text-center">
              <RefreshCw className="h-7 w-7 animate-spin text-amber-400 mb-2.5" />
              <span className="text-xs font-bold">Accessing camera stream...</span>
              <span className="text-[11px] text-zinc-400 mt-1">Please allow camera permissions if prompted</span>
            </div>
          )}

          {/* Camera Error / Notice Overlay */}
          {cameraError && !scanSuccessCode && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center z-20 space-y-2.5">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-1">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-zinc-200">
                Camera Notice
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed font-light max-w-xs">
                {cameraError}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-amber-300 font-bold transition"
                >
                  <RefreshCw className="h-3 w-3" /> Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-white font-bold transition"
                >
                  <UploadCloud className="h-3.5 w-3.5" /> Upload QR Image
                </button>
              </div>
            </div>
          )}

          {/* Viewfinder Target Overlay when camera is active */}
          {!cameraError && !scanSuccessCode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-44 w-44 border-2 border-amber-400/80 rounded-2xl">
                {/* Glowing corners */}
                <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-amber-400" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-400/40 animate-pulse" />
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                <span className="inline-block bg-black/75 backdrop-blur-md px-3.5 py-1 rounded-full text-[10px] font-bold text-amber-300">
                  Point camera at the table QR stand
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Upload notice if any */}
        {uploadNotice && (
          <div className="bg-amber-950/80 border-t border-amber-800/40 px-4 py-2 text-[11px] text-amber-200 text-center">
            {uploadNotice}
          </div>
        )}

        {/* Hidden File Input for QR Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Manual Table Entry & All 12 Tables Grid */}
        <div className="border-t border-zinc-800/80 bg-zinc-900/90 p-4 sm:p-5 space-y-3.5">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <Hash className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter Table No. (e.g. 01, 04)"
                maxLength={4}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>Open</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Quick Select Table Buttons Grid */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Direct Table Jump (12 Available Tables):
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline"
              >
                Upload QR image
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-6 gap-1.5">
              {ALL_TABLE_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/t/${code}`);
                  }}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 text-center text-xs font-bold text-zinc-200 hover:border-amber-400 hover:bg-amber-400/10 hover:text-amber-300 transition"
                >
                  T-{code}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
