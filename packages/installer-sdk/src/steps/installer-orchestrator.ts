import {
  type InstallerContext,
  reduceInstallerState
} from "../state-machine/installer-machine.js";

export class InstallerOrchestrator {
  private context: InstallerContext = { state: "idle" };

  public getContext(): InstallerContext {
    return this.context;
  }

  public start(): InstallerContext {
    this.context = reduceInstallerState(this.context, { type: "START" });
    return this.context;
  }

  public markStepCompleted(): InstallerContext {
    this.context = reduceInstallerState(this.context, { type: "NEXT" });
    return this.context;
  }

  public fail(message: string): InstallerContext {
    this.context = reduceInstallerState(this.context, { type: "FAIL", message });
    return this.context;
  }

  public reset(): InstallerContext {
    this.context = reduceInstallerState(this.context, { type: "RESET" });
    return this.context;
  }
}
