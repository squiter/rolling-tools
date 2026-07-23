import { useRef, useState } from "react";
import DiceBox from "@3d-dice/dice-box";
import {
  BadgeHelp,
  Dices,
  Pencil,
  History,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { formatDiceRoll, getPhysicalDiceNotations, rollDiceFormula } from "./dice";
import { appendModifier, incrementDiceFormula, RollMode } from "./diceTools";
import { buildDeck, CardDraw, fullDeck, PlayingCard, shuffleCards, suitGlyph } from "./cards";

interface DiceHistoryEntry {
  id: string;
  label: string;
  detail?: string;
  parts?: DiceHistoryPart[];
  createdAt: Date;
}

interface DiceHistoryPart {
  color: string;
  name: string;
  value: number;
}

interface CustomDieConfig {
  id: string;
  name: string;
  color: string;
}

interface CustomRollPreset {
  id: string;
  label: string;
  sides: number;
  dice: CustomDieConfig[];
}

const diceBuilderTypes = [4, 6, 8, 10, 12, 20, 100];
const colorOptions = ["#2f6f8f", "#9c3434", "#b8792d", "#4f7d45", "#6b4aa0", "#2f3036"];
const defaultPreset: CustomRollPreset = {
  id: "hope-fear",
  label: "Hope / Fear",
  sides: 12,
  dice: [
    { id: "hope", name: "Hope", color: "#2f6f8f" },
    { id: "fear", name: "Fear", color: "#9c3434" },
  ],
};

export function App() {
  const [diceFormula, setDiceFormula] = useState("d20");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [diceHistory, setDiceHistory] = useState<DiceHistoryEntry[]>([]);
  const [customRolls, setCustomRolls] = useState<CustomRollPreset[]>([defaultPreset]);
  const [diceSettingsOpen, setDiceSettingsOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState<CustomRollPreset>(() => createPresetDraft());
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [cardHistory, setCardHistory] = useState<CardDraw[]>([]);
  const [cardCount, setCardCount] = useState(1);
  const [includeJokers, setIncludeJokers] = useState(true);
  const [deckRemaining, setDeckRemaining] = useState<PlayingCard[]>(() => shuffleCards(buildDeck(true)));
  const [drawnCards, setDrawnCards] = useState<PlayingCard[]>([]);
  const [diceError, setDiceError] = useState<string | null>(null);
  const [diceOverlayVisible, setDiceOverlayVisible] = useState(false);
  const diceBoxRef = useRef<DiceBox | null>(null);
  const diceBoxReadyRef = useRef<Promise<DiceBox> | null>(null);
  const diceOverlayTimeoutRef = useRef<number | null>(null);

  const deckSize = includeJokers ? fullDeck.length : fullDeck.length - 2;
  const emptyDeck = deckRemaining.length === 0;
  const latestDraw = cardHistory[0];

  function addDiceBuilderDie(sides: number) {
    setDiceFormula((current) => incrementDiceFormula(current, sides, rollMode));
  }

  function addDiceBuilderModifier(amount: number) {
    setDiceFormula((current) => appendModifier(current, amount));
  }

  async function rollTrayDice(event?: React.FormEvent) {
    event?.preventDefault();

    try {
      const visualRolls = await rollVisualDice(diceFormula);
      const result = formatDiceRoll(rollDiceFormula(diceFormula, visualRolls ?? undefined));
      setDiceHistory((current) => [
        { id: crypto.randomUUID(), label: result, detail: formatTime(new Date()), createdAt: new Date() },
        ...current,
      ].slice(0, 12));
      setDiceError(null);
    } catch (error) {
      setDiceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function rollPreset(preset: CustomRollPreset) {
    const formula = `${preset.dice.length}d${preset.sides}`;

    try {
      const visualRolls = await rollVisualDice(formula);
      const result = rollDiceFormula(formula, visualRolls ?? undefined);
      const rolls = result.terms[0]?.rolls ?? [];
      const parts = preset.dice.map((die, index) => ({
        color: die.color,
        name: die.name || `Die ${index + 1}`,
        value: rolls[index] ?? Math.floor(Math.random() * preset.sides) + 1,
      }));
      const total = parts.reduce((sum, part) => sum + part.value, 0);

      setDiceHistory((current) => [
        {
          id: crypto.randomUUID(),
          label: `${preset.label || formula}: ${total}`,
          detail: `${formula} at ${formatTime(new Date())}`,
          parts,
          createdAt: new Date(),
        },
        ...current,
      ].slice(0, 12));
      setDiceError(null);
    } catch (error) {
      setDiceError(error instanceof Error ? error.message : String(error));
    }
  }

  function savePreset() {
    const sanitizedPreset = sanitizePreset(presetDraft);
    setCustomRolls((current) => {
      if (editingPresetId) {
        return current.map((preset) => (preset.id === editingPresetId ? sanitizedPreset : preset));
      }
      return [...current, { ...sanitizedPreset, id: crypto.randomUUID() }];
    });
    setEditingPresetId(null);
    setPresetDraft(createPresetDraft());
  }

  function editPreset(preset: CustomRollPreset) {
    setEditingPresetId(preset.id);
    setPresetDraft(copyPreset(preset));
    setDiceSettingsOpen(true);
  }

  function deletePreset(id: string) {
    setCustomRolls((current) => current.filter((preset) => preset.id !== id));
    if (editingPresetId === id) {
      setEditingPresetId(null);
      setPresetDraft(createPresetDraft());
    }
  }

  function updatePresetDiceCount(count: number) {
    const nextCount = Math.min(12, Math.max(1, Math.floor(count) || 1));
    setPresetDraft((current) => {
      const dice = [...current.dice];
      while (dice.length < nextCount) {
        const index = dice.length;
        dice.push({
          id: crypto.randomUUID(),
          name: `Die ${index + 1}`,
          color: colorOptions[index % colorOptions.length],
        });
      }
      return { ...current, dice: dice.slice(0, nextCount) };
    });
  }

  async function rollVisualDice(formula: string): Promise<number[][] | null> {
    let notations: string[];
    try {
      notations = getPhysicalDiceNotations(formula);
    } catch {
      return null;
    }
    if (notations.length === 0) return null;

    if (diceOverlayTimeoutRef.current) window.clearTimeout(diceOverlayTimeoutRef.current);
    setDiceOverlayVisible(true);

    try {
      const diceBox = await getDiceBox();
      const results = await diceBox.roll(notations);
      return getDiceBoxRollValues(results, notations);
    } catch (error) {
      console.error("3D dice roll failed", error);
      return null;
    } finally {
      diceOverlayTimeoutRef.current = window.setTimeout(() => {
        setDiceOverlayVisible(false);
        diceBoxRef.current?.clear();
      }, 2200);
    }
  }

  function getDiceBox() {
    if (diceBoxReadyRef.current) return diceBoxReadyRef.current;

    const diceBox = new DiceBox({
      assetPath: "/assets/",
      container: "#rolling-tools-3d-dice-box",
      enableShadows: true,
      offscreen: true,
      scale: 6,
      theme: "default",
      themeColor: "#d5aa6d",
      throwForce: 8,
    });
    diceBoxRef.current = diceBox;
    diceBoxReadyRef.current = diceBox.init();
    return diceBoxReadyRef.current;
  }

  function drawCardSet() {
    if (deckRemaining.length === 0) return;

    const drawCount = Math.min(Math.max(Math.floor(cardCount), 1), deckRemaining.length);
    const cards = deckRemaining.slice(0, drawCount);
    setDeckRemaining((current) => current.slice(drawCount));
    setDrawnCards((current) => [...cards, ...current]);
    setCardHistory((current) => [
      { id: crypto.randomUUID(), cards, createdAt: new Date() },
      ...current,
    ].slice(0, 12));
  }

  function adjustCardCount(amount: number) {
    setCardCount((current) => Math.min(Math.max(deckRemaining.length, 1), Math.max(1, current + amount)));
  }

  function shuffleRemainingDeck() {
    setDeckRemaining((current) => shuffleCards(current));
  }

  function refillDeck() {
    const nextDeck = shuffleCards([...deckRemaining, ...drawnCards]);
    setDeckRemaining(nextDeck);
    setDrawnCards([]);
    setCardCount((current) => Math.min(Math.max(nextDeck.length, 1), Math.max(1, current)));
  }

  function updateJokerSetting(include: boolean) {
    const nextDeck = shuffleCards(buildDeck(include));
    setIncludeJokers(include);
    setDeckRemaining(nextDeck);
    setDrawnCards([]);
    setCardCount((current) => Math.min(Math.max(nextDeck.length, 1), Math.max(1, current)));
  }

  return (
    <main className="app-shell">
      <section className="toolbar" aria-label="Tool overview">
        <div>
          <span className="eyebrow">DM Toolbox</span>
          <h1>Rolling Tools</h1>
        </div>
        <div className="toolbar-stat">
          <History size={16} />
          <span>{diceHistory.length + cardHistory.length} recent results</span>
        </div>
      </section>

      <section className="tool-grid">
        <article className="tool-panel dice-panel">
          <header className="panel-header">
            <div>
              <span className="eyebrow">3D Dice</span>
              <h2>Dice tray</h2>
            </div>
            <div className="panel-actions">
              <button
                className="icon-button"
                type="button"
                onClick={() => setDiceSettingsOpen((current) => !current)}
                title="Configure custom rolls"
                aria-label="Configure custom rolls"
                aria-expanded={diceSettingsOpen}
              >
                <Settings size={17} />
              </button>
              {diceHistory.length > 0 && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setDiceHistory([])}
                  title="Clear dice history"
                  aria-label="Clear dice history"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </header>

          <form className="roll-form" onSubmit={rollTrayDice}>
            <label>
              <span>Formula</span>
              <input
                value={diceFormula}
                onChange={(event) => setDiceFormula(event.target.value)}
                placeholder="2d6+3"
                aria-label="Dice formula"
              />
            </label>
            <button className="primary-button" type="submit">
              <Dices size={18} />
              <span>Roll</span>
            </button>
          </form>

          {diceError && <p className="error-text">{diceError}</p>}

          {customRolls.length > 0 && (
            <div className="custom-rolls" aria-label="Custom dice rolls">
              {customRolls.map((preset) => (
                <button key={preset.id} type="button" onClick={() => rollPreset(preset)} title={`Roll ${preset.dice.length}d${preset.sides}`}>
                  <span className="custom-roll-label">{preset.label}</span>
                  <span className="custom-roll-dice">
                    {preset.dice.map((die) => (
                      <span className="custom-roll-dot" key={die.id} style={{ background: die.color }} title={die.name} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {diceSettingsOpen && (
            <section className="dice-settings" aria-label="Custom roll settings">
              <header>
                <div>
                  <span className="eyebrow">Custom Button</span>
                  <h3>{editingPresetId ? "Edit roll" : "New roll"}</h3>
                </div>
                {editingPresetId && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setEditingPresetId(null);
                      setPresetDraft(createPresetDraft());
                    }}
                  >
                    <X size={15} />
                    <span>Cancel</span>
                  </button>
                )}
              </header>

              <div className="preset-grid">
                <label>
                  <span>Name</span>
                  <input
                    value={presetDraft.label}
                    onChange={(event) => setPresetDraft((current) => ({ ...current, label: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Dice count</span>
                  <input
                    min={1}
                    max={12}
                    type="number"
                    value={presetDraft.dice.length}
                    onChange={(event) => updatePresetDiceCount(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Sides</span>
                  <input
                    min={2}
                    max={100}
                    type="number"
                    value={presetDraft.sides}
                    onChange={(event) =>
                      setPresetDraft((current) => ({
                        ...current,
                        sides: Math.min(100, Math.max(2, Number(event.target.value) || 2)),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="die-config-list">
                {presetDraft.dice.map((die, index) => (
                  <div className="die-config-row" key={die.id}>
                    <label>
                      <span>Die {index + 1}</span>
                      <input
                        value={die.name}
                        onChange={(event) =>
                          setPresetDraft((current) => ({
                            ...current,
                            dice: current.dice.map((draftDie) =>
                              draftDie.id === die.id ? { ...draftDie, name: event.target.value } : draftDie,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="color-field">
                      <span>Color</span>
                      <input
                        type="color"
                        value={die.color}
                        onChange={(event) =>
                          setPresetDraft((current) => ({
                            ...current,
                            dice: current.dice.map((draftDie) =>
                              draftDie.id === die.id ? { ...draftDie, color: event.target.value } : draftDie,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>

              <button className="primary-button save-preset-button" type="button" onClick={savePreset}>
                <Save size={16} />
                <span>{editingPresetId ? "Update button" : "Create button"}</span>
              </button>

              {customRolls.length > 0 && (
                <div className="preset-list">
                  {customRolls.map((preset) => (
                    <div className="preset-list-row" key={preset.id}>
                      <div>
                        <strong>{preset.label}</strong>
                        <small>
                          {preset.dice.length}d{preset.sides}
                        </small>
                      </div>
                      <div className="preset-list-actions">
                        <button type="button" onClick={() => editPreset(preset)} title={`Edit ${preset.label}`} aria-label={`Edit ${preset.label}`}>
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(preset.id)}
                          title={`Delete ${preset.label}`}
                          aria-label={`Delete ${preset.label}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="dice-builder" aria-label="Dice builder">
            {diceBuilderTypes.map((sides) => (
              <button key={sides} type="button" onClick={() => addDiceBuilderDie(sides)} title={`Add d${sides}`}>
                <DicePolyIcon sides={sides} />
                <span>d{sides}</span>
              </button>
            ))}
          </div>

          <div className="segmented-control" aria-label="Roll mode">
            {[
              ["normal", "Normal"],
              ["advantage", "Adv"],
              ["disadvantage", "Dis"],
            ].map(([mode, label]) => (
              <button
                className={rollMode === mode ? "active" : ""}
                key={mode}
                type="button"
                onClick={() => setRollMode(mode as RollMode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="modifier-tools" aria-label="Modifiers">
            {[-5, -1, 1, 5].map((modifier) => (
              <button key={modifier} type="button" onClick={() => addDiceBuilderModifier(modifier)}>
                {modifier > 0 ? `+${modifier}` : modifier}
              </button>
            ))}
            <button type="button" onClick={() => setDiceFormula("")} aria-label="Clear formula">
              <RotateCcw size={15} />
            </button>
          </div>

          <HistoryList
            emptyText="No dice rolled yet."
            entries={diceHistory.map((entry) => ({
              id: entry.id,
              title: entry.label,
              detail: entry.detail ?? formatTime(entry.createdAt),
              parts: entry.parts,
            }))}
          />
        </article>

        <article className="tool-panel cards-panel">
          <header className="panel-header">
            <div>
              <span className="eyebrow">Cards</span>
              <h2>Deck draw</h2>
            </div>
            {cardHistory.length > 0 && (
              <button
                className="icon-button"
                type="button"
                onClick={() => setCardHistory([])}
                title="Clear card history"
                aria-label="Clear card history"
              >
                <Trash2 size={17} />
              </button>
            )}
          </header>

          <div className={`card-stage ${emptyDeck ? "empty-deck-stage" : ""}`} aria-live="polite">
            {emptyDeck ? (
              <div className="empty-deck">
                <Shuffle size={34} />
                <strong>Deck empty</strong>
                <span>Refill the deck to draw again.</span>
              </div>
            ) : latestDraw ? (
              latestDraw.cards.slice(0, 5).map((card, index) => <CardFace card={card} key={`${latestDraw.id}-${card.id}-${index}`} />)
            ) : (
              <div className="card-back">
                <BadgeHelp size={42} />
                <span>Draw</span>
              </div>
            )}
          </div>

          <div className="draw-controls">
            <div className="stepper">
              <button type="button" onClick={() => adjustCardCount(-1)} title="Draw fewer cards" disabled={emptyDeck}>
                <Minus size={17} />
              </button>
              <label>
                <span>Cards</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(deckRemaining.length, 1)}
                  value={cardCount}
                  disabled={emptyDeck}
                  onChange={(event) => setCardCount(Math.min(Math.max(deckRemaining.length, 1), Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <button type="button" onClick={() => adjustCardCount(1)} title="Draw more cards" disabled={emptyDeck}>
                <Plus size={17} />
              </button>
            </div>

            <label className="toggle-row">
              <input type="checkbox" checked={includeJokers} onChange={(event) => updateJokerSetting(event.target.checked)} />
              <span>Jokers</span>
            </label>

            <button className="primary-button" type="button" onClick={drawCardSet} disabled={emptyDeck}>
              <Shuffle size={18} />
              <span>Draw</span>
            </button>
          </div>

          <div className="deck-tools" aria-label="Deck controls">
            <button type="button" onClick={shuffleRemainingDeck} disabled={deckRemaining.length < 2}>
              <Shuffle size={16} />
              <span>Shuffle</span>
            </button>
            <button type="button" onClick={refillDeck} disabled={drawnCards.length === 0}>
              <RotateCcw size={16} />
              <span>Refill</span>
            </button>
            <span>
              {deckRemaining.length}/{deckSize} left
            </span>
          </div>

          <HistoryList
            emptyText="No cards drawn yet."
            entries={cardHistory.map((entry) => ({
              id: entry.id,
              title: entry.cards.map((card) => card.label).join(", "),
              detail: `${entry.cards.length} card${entry.cards.length === 1 ? "" : "s"} at ${formatTime(entry.createdAt)}`,
            }))}
          />
        </article>
      </section>

      <div className={`dice-box-overlay ${diceOverlayVisible ? "active" : ""}`} aria-hidden="true">
        <div id="rolling-tools-3d-dice-box" />
      </div>
    </main>
  );
}

function DicePolyIcon({ sides }: { sides: number }) {
  return (
    <span className={`dice-poly dice-poly-d${sides}`} aria-hidden="true">
      <span>{sides === 100 ? "%" : sides}</span>
    </span>
  );
}

function CardFace({ card }: { card: PlayingCard }) {
  const glyph = suitGlyph(card.suit);
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isJoker = card.rank === "Joker";

  return (
    <div className={`playing-card ${card.color}${isJoker ? " joker-card" : ""}`} title={card.label}>
      <span className="card-corner">
        <strong>{isJoker ? "J" : card.rank}</strong>
        <span>{glyph}</span>
      </span>
      <span className="card-center">
        <span className={isJoker ? "joker-word" : undefined}>{isJoker ? "Joker" : isCourt ? card.rank : glyph}</span>
        {isJoker ? <span className="joker-mark">{glyph}</span> : <small>{card.suit}</small>}
      </span>
      <span className="card-corner inverted">
        <strong>{isJoker ? "J" : card.rank}</strong>
        <span>{glyph}</span>
      </span>
    </div>
  );
}

function HistoryList({
  emptyText,
  entries,
}: {
  emptyText: string;
  entries: Array<{ id: string; title: string; detail: string; parts?: DiceHistoryPart[] }>;
}) {
  return (
    <div className="history-list">
      {entries.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        entries.map((entry) => (
          <output key={entry.id}>
            <strong>{entry.title}</strong>
            {entry.parts && (
              <span className="roll-parts">
                {entry.parts.map((part) => (
                  <span className="roll-part" key={`${entry.id}-${part.name}`} style={{ borderColor: part.color }}>
                    <span style={{ background: part.color }} />
                    {part.name}: {part.value}
                  </span>
                ))}
              </span>
            )}
            <small>{entry.detail}</small>
          </output>
        ))
      )}
    </div>
  );
}

function getDiceBoxRollValues(results: unknown, notations: string[]): number[][] | null {
  const flatRolls = getDiceBoxFlatRollValues(results);
  if (flatRolls.length === 0) return null;

  const rolls: number[][] = [];
  let cursor = 0;
  for (const notation of notations) {
    const count = getPhysicalDiceCount(notation);
    const termRolls = flatRolls.slice(cursor, cursor + count);
    if (termRolls.length !== count) return null;
    rolls.push(termRolls);
    cursor += count;
  }

  return cursor === flatRolls.length ? rolls : null;
}

function getDiceBoxFlatRollValues(results: unknown): number[] {
  if (!Array.isArray(results)) return [];

  return results.flatMap(extractDiceBoxValues);
}

function extractDiceBoxValues(result: unknown): number[] {
  if (!result || typeof result !== "object") return [];
  if ("value" in result) {
    const value = Number((result as { value: unknown }).value);
    return Number.isInteger(value) ? [value] : [];
  }
  if ("rolls" in result && Array.isArray((result as { rolls: unknown }).rolls)) {
    return (result as { rolls: unknown[] }).rolls.flatMap(extractDiceBoxValues);
  }
  return [];
}

function getPhysicalDiceCount(notation: string): number {
  const match = notation.match(/^(\d+)d/i);
  return match ? Number(match[1]) : 1;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createPresetDraft(): CustomRollPreset {
  return {
    id: crypto.randomUUID(),
    label: "Hope / Fear",
    sides: 12,
    dice: [
      { id: crypto.randomUUID(), name: "Hope", color: "#2f6f8f" },
      { id: crypto.randomUUID(), name: "Fear", color: "#9c3434" },
    ],
  };
}

function copyPreset(preset: CustomRollPreset): CustomRollPreset {
  return {
    ...preset,
    dice: preset.dice.map((die) => ({ ...die })),
  };
}

function sanitizePreset(preset: CustomRollPreset): CustomRollPreset {
  return {
    ...preset,
    label: preset.label.trim() || `${preset.dice.length}d${preset.sides}`,
    sides: Math.min(100, Math.max(2, Math.floor(preset.sides) || 12)),
    dice: preset.dice.map((die, index) => ({
      ...die,
      name: die.name.trim() || `Die ${index + 1}`,
      color: /^#[0-9a-f]{6}$/i.test(die.color) ? die.color : colorOptions[index % colorOptions.length],
    })),
  };
}
