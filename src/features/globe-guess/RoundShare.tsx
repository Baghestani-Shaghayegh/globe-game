import ShareResult from "../../components/ShareResult";
import { GAME_TYPES, type GameType, type Mode } from "../../data/modes";
import { formatDuration } from "../../lib/records";
import { siteHost } from "../../lib/site";
import type { Replay } from "../../lib/replay";

/** The found and missed colours on the card, fixed: the card is always dark. */
export const CARD_FOUND = "#34d399";
export const CARD_MISSED = "#fb7185";

/**
 * Sharing a free-play round: the result in words and as a card, with a
 * link to the game's home page.
 */
export default function RoundShare({
  type,
  mode,
  found,
  missed,
  ms,
  points,
  replay,
}: {
  type: GameType;
  mode: Mode;
  found: string[];
  missed: string[];
  ms: number;
  points: number;
  replay?: Replay | null;
}) {
  const label = `${GAME_TYPES.find((t) => t.id === type)?.label ?? ""} · ${mode.name}`;
  const total = found.length + missed.length;
  const said = `found ${found.length}/${total} in ${formatDuration(ms)}`;
  return (
    <ShareResult
      replay={replay}
      text={`I ${said} on GuessGlobe (${label}).`}
      filename={`guessglobe-${type}-${mode.id}.png`}
      card={(features) => ({
        eyebrow: label,
        title: `${found.length} / ${total}`,
        subtitle: `${formatDuration(ms)} · ${points.toLocaleString()} points`,
        // A square each while they fit; past thirty the globe says it better.
        tiles:
          total <= 30
            ? [...found.map(() => CARD_FOUND), ...missed.map(() => CARD_MISSED)]
            : [],
        globe: features
          ? {
              features,
              colors: Object.fromEntries([
                ...found.map((name) => [name, CARD_FOUND]),
                ...missed.map((name) => [name, CARD_MISSED]),
              ]),
            }
          : undefined,
        site: siteHost(),
      })}
    />
  );
}
