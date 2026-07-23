export interface DiceTermRoll {
  sign: 1 | -1;
  notation: string;
  total: number;
  rolls?: number[];
  keptRolls?: number[];
}

export interface DiceRollResult {
  formula: string;
  total: number;
  terms: DiceTermRoll[];
}

const diceTermPattern = /([+-]?)(\d*d(?:\d+|%)(?:(?:kh|kl)\d+|adv|dis)?|\d+)/gi;
const maxDicePerTerm = 100;
const maxSides = 10000;

export function rollDiceFormula(value: string, suppliedRolls: number[][] = []): DiceRollResult {
  const formula = normalizeFormula(value);
  let diceTermIndex = 0;
  const terms = parseDiceFormula(formula).map((term) => {
    if (!term.dice) {
      return {
        sign: term.sign,
        notation: term.notation,
        total: term.value,
      };
    }

    const suppliedTermRolls = suppliedRolls[diceTermIndex++];
    const rolls =
      suppliedTermRolls && suppliedTermRolls.length === term.dice.count
        ? suppliedTermRolls
        : Array.from(
            { length: term.dice.count },
            () => Math.floor(Math.random() * term.dice!.sides) + 1,
          );
    const keptRolls = getKeptRolls(rolls, term.dice.keep);
    const totalRolls = keptRolls ?? rolls;

    return {
      sign: term.sign,
      notation: term.notation,
      keptRolls,
      rolls,
      total: totalRolls.reduce((sum, roll) => sum + roll, 0),
    };
  });

  return {
    formula,
    terms,
    total: terms.reduce((sum, term) => sum + term.sign * term.total, 0),
  };
}

export function getPhysicalDiceNotations(value: string): string[] {
  return parseDiceFormula(value)
    .filter((term) => term.dice)
    .map((term) => {
      const dice = term.dice!;
      return `${dice.count}d${dice.sides}`;
    });
}

export function formatDiceRoll(result: DiceRollResult): string {
  const breakdown = result.terms
    .map((term, index) => {
      const prefix = term.sign === -1 ? "-" : index === 0 ? "" : "+";
      if (term.rolls) {
        const kept = term.keptRolls ? ` -> ${term.keptRolls.join(", ")}` : "";
        return `${prefix}${term.notation}[${term.rolls.join(", ")}${kept}]`;
      }
      return `${prefix}${term.notation}`;
    })
    .join(" ");

  return `${result.formula} = ${result.total}${breakdown ? ` (${breakdown})` : ""}`;
}

export function normalizeFormula(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

interface ParsedTerm {
  sign: 1 | -1;
  notation: string;
  value: number;
  dice?: {
    count: number;
    sides: number;
    keep?: DiceKeepRule;
  };
}

interface DiceKeepRule {
  mode: "highest" | "lowest";
  count: number;
}

function parseDiceFormula(value: string): ParsedTerm[] {
  const formula = normalizeFormula(value);
  if (!formula) throw new Error("Add a dice formula first.");

  const terms: ParsedTerm[] = [];
  let consumed = "";
  let match: RegExpExecArray | null;
  diceTermPattern.lastIndex = 0;

  while ((match = diceTermPattern.exec(formula))) {
    const [raw, signValue, notationValue] = match;
    consumed += raw;
    const sign = signValue === "-" ? -1 : 1;
    const notation = notationValue.toLowerCase();

    if (notation.includes("d")) {
      const diceMatch = notation.match(/^(\d*)d(\d+|%)(?:(kh|kl)(\d+)|(adv|dis))?$/);
      if (!diceMatch) throw new Error("Use dice like 2d6, d20, 2d6+3, 2d20kh1, or 2d20kl1.");

      const [, rawCount, rawSides, keepMode, rawKeepCount, shortcut] = diceMatch;
      let count = rawCount ? Number(rawCount) : 1;
      const sides = rawSides === "%" ? 100 : Number(rawSides);
      let keep: DiceKeepRule | undefined;

      if (shortcut) {
        if (sides !== 20 || (rawCount && count !== 1)) {
          throw new Error("Use d20adv or d20dis for d20 advantage shortcuts.");
        }
        count = 2;
        keep = {
          mode: shortcut === "adv" ? "highest" : "lowest",
          count: 1,
        };
      } else if (keepMode) {
        keep = {
          mode: keepMode === "kh" ? "highest" : "lowest",
          count: Number(rawKeepCount),
        };
      }

      if (!Number.isInteger(count) || count < 1 || count > maxDicePerTerm) {
        throw new Error(`Dice count must be between 1 and ${maxDicePerTerm}.`);
      }

      if (!Number.isInteger(sides) || sides < 2 || sides > maxSides) {
        throw new Error(`Dice sides must be between 2 and ${maxSides}.`);
      }

      if (keep) {
        if (!Number.isInteger(keep.count) || keep.count < 1 || keep.count > count) {
          throw new Error(`Kept dice must be between 1 and ${count}.`);
        }
      }

      terms.push({
        sign,
        notation,
        value: 0,
        dice: { count, sides, keep },
      });
    } else {
      const value = Number(notation);
      if (!Number.isInteger(value)) throw new Error("Only whole-number modifiers are supported.");
      terms.push({ sign, notation, value });
    }
  }

  if (terms.length === 0 || consumed !== formula) {
    throw new Error("Use dice like 2d6, d20, 2d6+3, 2d20kh1, or 2d20kl1.");
  }

  return terms;
}

function getKeptRolls(
  rolls: number[],
  keep: DiceKeepRule | undefined,
): number[] | undefined {
  if (!keep) return undefined;

  const sorted = [...rolls].sort((first, second) =>
    keep.mode === "highest" ? second - first : first - second,
  );
  return sorted.slice(0, keep.count);
}
