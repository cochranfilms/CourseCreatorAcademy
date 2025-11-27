declare module 'tus-js-client' {
  export class Upload {
    constructor(file: File, options: {
      endpoint: string;
      retryDelays?: number[];
      metadata?: Record<string, string>;
      onError?: (error: Error) => void;
      onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
      onSuccess?: () => void;
    });
    start(): void;
    abort(): void;
  }
}


