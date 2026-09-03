// Type definitions for cordova-plugin-boogie-insomnia.

/** What the native half reports about itself — see boogieInsomnia.describe(). */
interface BoogieInsomniaDescription {
  /** Plugin id, exactly as in plugin.xml. */
  id: string;
  /** plugin.xml version the native half was built from. */
  version: string;
  platform: 'android' | 'ios' | 'browser';
  /** Bridge contract revision. */
  api: 1;
  /** Every action name the native half dispatches, sorted, "describe" included. */
  actions: string[];
  /** Plugin-specific static facts; only flat scalar (or scalar-array) values. */
  features: {
    /** The keep-awake is re-asserted natively when the app returns to the foreground. */
    reassertOnResume?: boolean;
    [name: string]: boolean | number | string | Array<boolean | number | string> | undefined;
  };
}

interface BoogieInsomnia {
  /** Plugin id. */
  readonly ID: string;

  /** Bridge version — equals plugin.xml at install time. */
  readonly VERSION: string;

  /** Native service (feature) name the bridge talks to. */
  readonly SERVICE: string;

  /** Keep the screen on until allowSleepAgain() (or a page reload). Idempotent. */
  keepAwake(): Promise<void>;

  /** Let the screen sleep on its normal schedule again. Idempotent. */
  allowSleepAgain(): Promise<void>;

  /** Resolves whether keep-awake is currently requested. */
  isKeptAwake(): Promise<boolean>;

  /** Resolves what the native half is and can do. Cheap, side-effect free. */
  describe(): Promise<BoogieInsomniaDescription>;

  /**
   * Raw passthrough to cordova.exec — an escape hatch for native actions this
   * bridge does not expose. No argument normalisation. With onProgress, every
   * native success callback is forwarded to it and the Promise resolves with the
   * first result. Rejects with an Error carrying the raw payload on `.native`.
   */
  exec(action: string, args?: any[], onProgress?: (result: any) => void): Promise<any>;
}

declare var boogieInsomnia: BoogieInsomnia;
