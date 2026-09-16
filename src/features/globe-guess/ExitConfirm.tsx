import ConfirmDialog from "./ConfirmDialog";

type Props = {
  onFinish: () => void;
  onKeepPlaying: () => void;
};

/**
 * Asked before a run in progress is abandoned, however that is attempted.
 *
 * The question is the whole message. It used to explain which runs get filed
 * and which do not, tallied what had been found so far, and changed its
 * wording depending on the score — none of which anybody reads while deciding
 * whether to walk away, and all of which made walking away feel like paperwork
 * rather than a shame.
 */
export default function ExitConfirm({ onFinish, onKeepPlaying }: Props) {
  return (
    <ConfirmDialog
      title="Sure you want to leave?"
      confirmLabel="Leave"
      onConfirm={onFinish}
      cancelLabel="Keep playing"
      onCancel={onKeepPlaying}
    />
  );
}
