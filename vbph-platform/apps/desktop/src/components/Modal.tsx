import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
}

export function Modal({ children }: ModalProps) {
  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
