"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  title: string;
  message: string;
  onClose: () => void;
};

export function AuthDisclaimerModal({ title, message, onClose }: Props) {
  return (
    <div className="auth-modal-backdrop" role="presentation">
      <div
        className="auth-disclaimer-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-disclaimer-title"
      >
        <div className="auth-disclaimer-icon">
          <AlertTriangle size={24} strokeWidth={1.8} />
        </div>
        <div>
          <p id="auth-disclaimer-title" className="auth-disclaimer-title">
            {title}
          </p>
          <p className="auth-disclaimer-copy">{message}</p>
        </div>
        <button
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
