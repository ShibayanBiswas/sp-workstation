"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  title: string;
  message: string;
  onClose: () => void;
};

export function AuthDisclaimerModal({ title, message, onClose }: Props) {
  const titleId = useId();
  const descId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    actionRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="auth-modal-backdrop" role="presentation">
      <div
        className="auth-disclaimer-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="auth-disclaimer-icon">
          <AlertTriangle size={24} strokeWidth={1.8} />
        </div>
        <div>
          <p id={titleId} className="auth-disclaimer-title">
            {title}
          </p>
          <p id={descId} className="auth-disclaimer-copy">
            {message}
          </p>
        </div>
        <button
          ref={actionRef}
          type="button"
          className="btn-primary auth-disclaimer-action"
          onClick={onClose}
        >
          Understood
        </button>
      </div>
    </div>
  );
}
