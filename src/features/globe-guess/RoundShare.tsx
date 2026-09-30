import ShareResult from "../../components/ShareResult";
import { GAME_TYPES, type GameType, type Mode, type Ruleset } from "../../data/modes";
import { formatDuration } from "../../lib/records";

/** The found and missed colours on the card, fixed: the card is always dark. */
export const CARD_FOUND = "#34d399";
export const CARD_MISSED = "#fb7185";

/**
 * Sharing a free-play round: the same map, rules and clock, so a friend
 * opening the link plays exactly the round they're being challenged on.
 */
export default function RoundShare({
  type,
  mode,
  ruleset,
  limitMs,
  found,
  missed,
  ms,
  points,
}: {
  type: GameType;
  mode: Mode;
  ruleset: Ruleset;
  limitMs: number | null;
  found: string[];
  missed: string[];
  ms: number;
  points: number;
}) {
  const label = `${GAME_TYPES.find((t) => t.id === type)?.label ?? ""} · ${mode.name}`;
  const total = found.length + missed.length;
  const said = `found ${found.length}/${total} in ${formatDuration(ms)}`;
  return (
    <ShareResult
      mine={{
        game: `${type}:${mode.id}:${ruleset}:${limitMs ?? "up"}`,
        score: found.length,
        higherWins: true,
        ms,
        said,
      }}
      text={`I ${said} on WorldGuess (${label}).`}
      filename={`worldguess-${type}-${mode.id}.png`}
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
        site: window.location.host,
      })}
    />
  );
}
