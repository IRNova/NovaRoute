"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { GITHUB_CONFIG } from "@/shared/constants/config";

export default function DonateModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKey);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const openDonate = () => {
    window.open(GITHUB_CONFIG.donateUrl, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        className="relative w-full bg-elevated border border-border rounded-brand-lg shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-200 max-w-md overflow-hidden"
      >
        {/* Hero */}
        <div className="relative bg-[image:var(--grad)] px-6 pt-8 pb-20 text-center">
          <button
            onClick={onClose}
            className="absolute top-3 end-3 p-1.5 rounded-lg text-[color:var(--on-accent)]/70 hover:text-[color:var(--on-accent)] hover:bg-black/10 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm mb-4">
            <span className="material-symbols-outlined text-[color:var(--on-accent)] text-[34px]">volunteer_activism</span>
          </div>
          <h2 className="text-2xl font-bold text-[color:var(--on-accent)]">Support NovaRoute</h2>
          <p className="mt-2 text-sm text-[color:var(--on-accent)]/80 leading-relaxed">
            NovaRoute is free and open source. A small donation helps keep servers
            running, develop new features, and support the project.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 -mt-10 relative">
          <div className="rounded-brand-lg bg-elevated border border-border shadow-[var(--shadow-pop)] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] text-[color:var(--violet)]">
                <span className="material-symbols-outlined text-[22px]">favorite</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-main">Make a one-time donation</p>
                <p className="text-xs text-text-muted">Secure payment via NovaProxy</p>
              </div>
            </div>
            <button
              onClick={openDonate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover transition-all"
            >
              Donate now
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </button>
            <p className="mt-3 text-center text-xs text-text-muted">
              Thanks for supporting NovaRoute!
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

DonateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
