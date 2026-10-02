import type { ChuteWinEvent } from "./chuteSensor";

export interface CabinetWinResult {
  prizeId: string;
  sensorSequence: number;
  resultSequence: number;
  inventoryCount: number;
}

export class CabinetResultInventoryState {
  private readonly processedEventKeys = new Set<string>();
  private readonly awardedPrizeIds = new Set<string>();
  private readonly results: CabinetWinResult[] = [];

  consume(event: ChuteWinEvent): CabinetWinResult | null {
    const eventKey = `${event.sequence}:${event.prizeId}`;
    if (this.processedEventKeys.has(eventKey)) {
      return null;
    }
    this.processedEventKeys.add(eventKey);

    if (this.awardedPrizeIds.has(event.prizeId)) {
      return null;
    }
    this.awardedPrizeIds.add(event.prizeId);

    const result: CabinetWinResult = {
      prizeId: event.prizeId,
      sensorSequence: event.sequence,
      resultSequence: this.results.length + 1,
      inventoryCount: this.awardedPrizeIds.size,
    };
    this.results.push(result);
    return result;
  }

  hasPrize(prizeId: string): boolean {
    return this.awardedPrizeIds.has(prizeId);
  }

  get resultCount(): number {
    return this.results.length;
  }

  get inventoryCount(): number {
    return this.awardedPrizeIds.size;
  }

  get lastResult(): CabinetWinResult | null {
    return this.results.at(-1) ?? null;
  }
}
