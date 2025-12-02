// Browser polyfill for Node.js 'stream' module
// Provides minimal stream APIs for browser compatibility

// Stub PassThrough class - throws if actually used
export class PassThrough {
  constructor() {
    throw new Error(
      'stream.PassThrough is not available in browser environment. ' +
        'This functionality requires Node.js runtime.'
    );
  }
}

export class Readable {
  constructor() {
    throw new Error(
      'stream.Readable is not available in browser environment. ' +
        'This functionality requires Node.js runtime.'
    );
  }
}

export class Writable {
  constructor() {
    throw new Error(
      'stream.Writable is not available in browser environment. ' +
        'This functionality requires Node.js runtime.'
    );
  }
}

export class Transform {
  constructor() {
    throw new Error(
      'stream.Transform is not available in browser environment. ' +
        'This functionality requires Node.js runtime.'
    );
  }
}

export class Duplex {
  constructor() {
    throw new Error(
      'stream.Duplex is not available in browser environment. ' +
        'This functionality requires Node.js runtime.'
    );
  }
}

// Export default object
export default {
  PassThrough,
  Readable,
  Writable,
  Transform,
  Duplex,
};
