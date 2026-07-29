export type RollMode = "normal" | "advantage" | "disadvantage";

export function applyRollMode(current: string, rollMode: RollMode): string {
  const formula = current.trim();
  if (!formula) return formula;

  const notation =
    rollMode === "advantage" ? "d20adv" : rollMode === "disadvantage" ? "d20dis" : "d20";
  const d20TermPattern = /(^|[+-])(?:1?d20(?:adv|dis)?|2d20k[hl]1)(?=$|[+-])/i;

  return formula.replace(d20TermPattern, (_term, sign: string) => `${sign}${notation}`);
}

export function incrementDiceFormula(current: string, sides: number, rollMode: RollMode): string {
  const formula = current.trim();
  const notation = buildDieNotation(sides, rollMode);
  if (!formula) return notation;
  if (notation.endsWith("adv") || notation.endsWith("dis")) return `${formula}+${notation}`;

  const escapedNotation = notation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termPattern = new RegExp(`(^|[+\\-])(?:(\\d+)?)${escapedNotation}(?=$|[+\\-])`, "i");
  const match = formula.match(termPattern);
  if (match && match.index !== undefined) {
    const sign = match[1] ?? "";
    const count = Number(match[2] || "1") + 1;
    return `${formula.slice(0, match.index)}${sign}${count}${notation}${formula.slice(
      match.index + match[0].length,
    )}`;
  }

  return `${formula}+${notation}`;
}

export function appendModifier(current: string, amount: number): string {
  const formula = current.trim();
  const value = Math.abs(amount);
  if (!formula) return amount < 0 ? `-${value}` : `${value}`;
  return `${formula}${amount < 0 ? "-" : "+"}${value}`;
}

function buildDieNotation(sides: number, rollMode: RollMode): string {
  if (sides === 20 && rollMode === "advantage") return "d20adv";
  if (sides === 20 && rollMode === "disadvantage") return "d20dis";
  return `d${sides}`;
}
