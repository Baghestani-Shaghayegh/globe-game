type Props = {
  found: number;
  total: number;
  onFinish: () => void;
  onKeepPlaying: () => void;
  onDiscard: () => void;
};

/** Asked when the back button is pressed with progress worth keeping. */
export default function ExitConfirm({
  found,
  total,
  onFinish,
  onKeepPlaying,
  onDiscard,
}: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07111c]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141b23] p-6 text-center">
        <p className="font-medium text-zinc-100">Leave this run?</p>
        <p className="mt-1.5 text-sm text-zinc-400">
          You've found {found} of {total}. Finishing saves it to your records.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onFinish}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            Finish &amp; save
          </button>
          <button
            onClick={onKeepPlaying}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
          >
            Keep playing
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Discard and leave
          </button>
        </div>
      </div>
    </div>
  );
}
