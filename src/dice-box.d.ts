declare module "@3d-dice/dice-box" {
  export interface DiceBoxConfig {
    assetPath: string;
    container: string;
    enableShadows?: boolean;
    offscreen?: boolean;
    scale?: number;
    theme?: string;
    themeColor?: string;
    throwForce?: number;
  }

  export interface DiceBoxRollNotation {
    data?: string;
    modifier?: number;
    qty?: number;
    sides: number | string;
    theme?: string;
    themeColor?: string;
  }

  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    clear(): DiceBox;
    init(): Promise<DiceBox>;
    roll(
      notation: string | string[] | DiceBoxRollNotation | DiceBoxRollNotation[],
      options?: { theme?: string; themeColor?: string; newStartPoint?: boolean },
    ): Promise<unknown>;
  }
}
