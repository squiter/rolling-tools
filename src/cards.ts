export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface PlayingCard {
  id: string;
  rank: Rank | "Joker";
  suit: Suit | "joker";
  color: "red" | "black";
  label: string;
  shortLabel: string;
}

export interface CardDraw {
  id: string;
  cards: PlayingCard[];
  createdAt: Date;
}

const suits: Array<{ suit: Suit; label: string; symbol: string; color: "red" | "black" }> = [
  { suit: "spades", label: "Spades", symbol: "S", color: "black" },
  { suit: "hearts", label: "Hearts", symbol: "H", color: "red" },
  { suit: "diamonds", label: "Diamonds", symbol: "D", color: "red" },
  { suit: "clubs", label: "Clubs", symbol: "C", color: "black" },
];

const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const fullDeck: PlayingCard[] = [
  ...suits.flatMap(({ suit, label, symbol, color }) =>
    ranks.map((rank) => ({
      id: `${rank.toLowerCase()}-${suit}`,
      rank,
      suit,
      color,
      label: `${rankLabel(rank)} of ${label}`,
      shortLabel: `${rank}${symbol}`,
    })),
  ),
  {
    id: "joker-red",
    rank: "Joker",
    suit: "joker",
    color: "red",
    label: "Red Joker",
    shortLabel: "JR",
  },
  {
    id: "joker-black",
    rank: "Joker",
    suit: "joker",
    color: "black",
    label: "Black Joker",
    shortLabel: "JB",
  },
];

export function buildDeck(includeJokers: boolean): PlayingCard[] {
  return includeJokers ? fullDeck : fullDeck.filter((card) => card.suit !== "joker");
}

export function shuffleCards(cards: PlayingCard[]): PlayingCard[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function rankLabel(rank: Rank): string {
  switch (rank) {
    case "A":
      return "Ace";
    case "J":
      return "Jack";
    case "Q":
      return "Queen";
    case "K":
      return "King";
    default:
      return rank;
  }
}

export function suitGlyph(suit: PlayingCard["suit"]): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    default:
      return "★";
  }
}
