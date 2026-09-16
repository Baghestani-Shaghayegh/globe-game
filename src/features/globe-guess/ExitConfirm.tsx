import ConfirmDialog from "./ConfirmDialog";

type Props = {
  found: number;
  total: number;
  onFinish: () => void;
  onKeepPlaying: () => void;
};

/**
 * Asked when the back button is pressed with progress worth keeping.
 *
 * There used to be a third way out — "Discard and leave" — which threw the
 * run away. It is gone: a run is saved either way now, so the question is
 * only whether you are leaving, and a button that quietly bins what you just
 * played is a thing to press by mistake once and regret.
 */
export default function ExitConfirm({
  found,
  total,
  onFinish,
  onKeepPlaying,
}: Props) {
  return (
    <ConfirmDialog
      title="Leave this run?"
      body={
        // A run with nothing in it is not filed — `end` only records a round
        // that found something — so promising it "goes to your records" would
        // be a lie told at exactly the moment somebody is deciding.
        found === 0 ? (
          <>You haven't found any yet. Leaving now keeps nothing.</>
        ) : (
          <>
            You've found {found} of {total}. It goes to your records either way.
          </>
        )
      }
      confirmLabel="Yes, I'm leaving"
      onConfirm={onFinish}
      cancelLabel="Keep playing"
      onCancel={onKeepPlaying}
    />
  );
}
