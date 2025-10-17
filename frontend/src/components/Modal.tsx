import type { ReactNode } from "react";

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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* wrapper scrollable */}
      <div className="absolute inset-0 flex items-start justify-center p-4 overflow-y-auto">
        {/* pakai margin top & bottom biar ada ruang saat scroll */}
        <div className="card w-full max-w-4xl my-8 overflow-hidden">
          {/* header tetap */}
          <div className="card-h flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950">
            <span>{title ?? "Details"}</span>
            <button className="btn-ghost" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
          {/* area konten scroll */}
          <div className="card-b max-h-[80vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
