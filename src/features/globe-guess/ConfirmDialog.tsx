/**
 * The question a round asks before it ends.
 *
 * One shell for both of them — leaving and finishing — because they are the
 * same moment from two directions, and two copies of a dialog drift apart.
 *
 * Two ways out, never three. A played-down third button that threw the run
 * away is the kind of thing pressed once by accident and regretted.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#07111c]/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141b23] p-6 text-center">
        <p className="font-medium text-zinc-100">{title}</p>
        <p className="mt-1.5 text-sm text-zinc-400">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            autoFocus
            onClick={onConfirm}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
