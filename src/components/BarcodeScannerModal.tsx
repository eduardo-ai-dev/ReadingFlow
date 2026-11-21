"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (isbn: string) => void;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualFallbackIsbn, setManualFallbackIsbn] = useState("");

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let zxingStop: (() => void) | null = null;

    async function startCamera() {
      setCameraError(null);
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          "Câmera indisponível neste navegador ou dispositivo. Digite o ISBN abaixo."
        );
        return;
      }

      try {
        const BarcodeDetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts: {
              formats: string[];
            }) => NativeBarcodeDetector;
          }
        ).BarcodeDetector;

        if (BarcodeDetectorCtor && videoRef.current) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (cancelled || !videoRef.current) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const detector = new BarcodeDetectorCtor({
            formats: ["ean_13", "ean_8"],
          });

          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const hit = codes.find(
                (c) => c.rawValue && c.rawValue.length >= 10
              );
              if (hit?.rawValue) {
                onDetected(hit.rawValue);
                onClose();
                return;
              }
            } catch {
              // Ignore transient frame errors
            }
            rafId = window.requestAnimationFrame(() => {
              void tick();
            });
          };
          void tick();
          return;
        }

        // Fallback to @zxing/browser when BarcodeDetector is unavailable
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!cancelled && result) {
              const raw = result.getText();
              if (raw && raw.length >= 10) {
                onDetected(raw);
                onClose();
              }
            }
          }
        );
        zxingStop = () => controls.stop();
      } catch {
        if (!cancelled) {
          setCameraError(
            "Permissão de câmera negada ou câmera ocupada. Você pode digitar o ISBN manualmente abaixo."
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (zxingStop) zxingStop();
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, onClose, onDetected]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="scanner-modal-title"
            className="font-serif text-lg font-semibold text-[var(--text-heading)]"
          >
            Escanear código de barras (ISBN)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-[6px] border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Fechar
          </button>
        </div>

        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Aponte a câmera para o código EAN-13 no verso do livro (geralmente
          iniciado por 978 ou 979).
        </p>

        {!cameraError ? (
          <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-[8px] border border-[var(--border-ui)] bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--accent-primary)] opacity-80"
            />
          </div>
        ) : (
          <div
            role="alert"
            className="mt-4 rounded-[8px] border border-[var(--status-warn)] bg-[var(--status-warn-bg)] p-3 text-xs text-[var(--status-warn)]"
          >
            {cameraError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualFallbackIsbn.trim()) {
              onDetected(manualFallbackIsbn.trim());
              onClose();
            }
          }}
          className="mt-4 border-t border-[var(--border-subtle)] pt-4"
        >
          <label
            htmlFor="scanner-manual-isbn"
            className="block text-xs font-semibold text-[var(--text-primary)]"
          >
            Ou digite o ISBN diretamente:
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="scanner-manual-isbn"
              type="text"
              inputMode="numeric"
              placeholder="Ex.: 9788535931983"
              value={manualFallbackIsbn}
              onChange={(e) => setManualFallbackIsbn(e.target.value)}
              className="min-h-[44px] flex-1 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              Usar ISBN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
