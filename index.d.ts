// Type definitions for cordova-plugin-boogie-insomnia.

interface BoogieInsomnia {
  /** Keep the screen on until allowSleepAgain() (or a page reload). Idempotent. */
  keepAwake(): Promise<void>;

  /** Let the screen sleep on its normal schedule again. Idempotent. */
  allowSleepAgain(): Promise<void>;

  /** Resolves whether keep-awake is currently requested. */
  isKeptAwake(): Promise<boolean>;
}

declare var boogieInsomnia: BoogieInsomnia;
