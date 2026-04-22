import { sleep } from "k6";

export function thinkTime(minSec: number, maxSec: number): void {
  sleep(minSec + Math.random() * (maxSec - minSec));
}