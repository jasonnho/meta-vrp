import { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-start justify-center p-4">
        <div className="card w-full max-w-4xl overflow-hidden">
          <div className="card-h flex items-center justify-between">
            <span>{title ?? "Details"}</span>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
          <div className="card-b">{children}</div>
        </div>
      </div>
    </div>
  );
}
