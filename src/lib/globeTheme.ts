/** Shared palette for the dark UI and both globes (menu backdrop + game). */
export const theme = {
  page: "#07111c",
  /** Ocean. */
  sphere: "#0d1b2a",
  stroke: "#8fb8d1",
  atmosphere: "#1e7d76",
  /** Menu backdrop: every country the same steel blue. */
  idle: "#2f4f6b",
  /** In game: not yet identified — a step darker so found/selected carry. */
  unfound: "#28455e",
  found: "#5bb98c",
  /** Revealed at the end of a run: found by nobody. */
  missed: "#a85466",
  selected: "#f2a93b",
} as const;
