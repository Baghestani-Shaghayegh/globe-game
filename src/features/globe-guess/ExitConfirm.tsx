import ConfirmDialog from "./ConfirmDialog";

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
    <ConfirmDialog
      title="Leave this run?"
      body={
        <>
          You've found {found} of {total}. Finishing saves it to your records.
        </>
      }
      confirmLabel="Finish &amp; save"
      onConfirm={onFinish}
      cancelLabel="Keep playing"
      onCancel={onKeepPlaying}
      quietLabel="Discard and leave"
      onQuiet={onDiscard}
    />
  );
}
