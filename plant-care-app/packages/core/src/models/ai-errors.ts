export enum AIErrorCode {
  SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  NOT_A_PLANT         = 'AI_NOT_A_PLANT',
  INVALID_IMAGE       = 'AI_INVALID_IMAGE',
  RATE_LIMITED        = 'AI_RATE_LIMITED',
}

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AIError'
  }
}
