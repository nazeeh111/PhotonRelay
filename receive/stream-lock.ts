/** Keep a partially recovered transfer when another valid code enters view.
 * A sender restart is still picked up once the old stream has gone quiet and
 * two different frames identify the replacement. */
export class ReceiveStreamLock {
  private active = "";
  private lastActiveAt = 0;
  private candidate = "";
  private candidateSeq = 0;

  constructor(private readonly idleMs = 1500) {}

  accept(identity: string, seq: number, now: number): boolean {
    if (!this.active || identity === this.active) {
      this.active = identity;
      this.lastActiveAt = now;
      this.candidate = "";
      return true;
    }

    if (now - this.lastActiveAt < this.idleMs) {
      this.candidate = "";
      return false;
    }

    if (identity !== this.candidate) {
      this.candidate = identity;
      this.candidateSeq = seq;
      return false;
    }
    if (seq === this.candidateSeq) return false;

    this.active = identity;
    this.lastActiveAt = now;
    this.candidate = "";
    return true;
  }
}
