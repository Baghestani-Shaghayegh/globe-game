/**
 * The question a round asks before it ends.
 *
 * One shell for both of them — leaving and finishing — because they are the
 * same moment from two directions, and two copies of a dialog drift apart.
 *
 * Two ways out, never three. A played-down third button that threw the run
 * away is the kind of thing pressed once by accident and regretted.
 *
 * Staying is the top button, and the loud one, and the one the keyboard lands
 * on. The dialog only ever appears because somebody may be about to lose a
 * run they are in the middle of, so the prominent action should be the one
 * that keeps it — and Enter, pressed on reflex, should not end anything.
 *
 * `body` is optional, and usually absent. At the moment of deciding whether
 * to walk away, nobody is reading a paragraph about what gets filed where;
 * the question is the whole message.
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
  body?: React.ReactNode;
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
        <p className="text-base font-medium text-zinc-100">{title}</p>
        {body && <p className="mt-1.5 text-sm text-zinc-400">{body}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button
            autoFocus
            onClick={onCancel}
            className="rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-[#07111c] transition-colors hover:bg-teal-200"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
