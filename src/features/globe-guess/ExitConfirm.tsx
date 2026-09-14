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
        <>
          You've found {found} of {total}. It goes to your records either way.
        </>
      }
      confirmLabel="Yes, I'm leaving"
      onConfirm={onFinish}
      cancelLabel="Keep playing"
      onCancel={onKeepPlaying}
    />
  );
}
