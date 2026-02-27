export class TreeKEMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TreeKEMError';
  }
}

export class TreeKEMInvalidStateError extends TreeKEMError {
  constructor(message: string) {
    super(message);
    this.name = 'TreeKEMInvalidStateError';
  }
}

export class TreeKEMDecryptionError extends TreeKEMError {
  constructor(message: string) {
    super(message);
    this.name = 'TreeKEMDecryptionError';
  }
}
