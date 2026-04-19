export const errorCodes = {
  WSL_NOT_FOUND: "WSL_NOT_FOUND",
  DISTRO_NOT_FOUND: "DISTRO_NOT_FOUND",
  COMMAND_EXECUTION_FAILED: "COMMAND_EXECUTION_FAILED",
  HEALTHCHECK_FAILED: "HEALTHCHECK_FAILED",
  UNKNOWN: "UNKNOWN"
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export class UfrenError extends Error {
  public readonly code: ErrorCode;
  public readonly meta: Record<string, string | number | boolean>;

  public constructor(
    code: ErrorCode,
    message: string,
    meta: Record<string, string | number | boolean> = {}
  ) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}
