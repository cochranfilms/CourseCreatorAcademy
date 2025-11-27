"use client";

interface ProcessingStatusProps {
  state: {
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
    currentStep?: string;
    results?: {
      assetId?: string;
      filesProcessed: number;
      conversionsCompleted: number;
      previewsGenerated: number;
      durationsExtracted: number;
      lutPreviewsCreated: number;
      documentsCreated: number;
      errors: string[];
    };
    error?: string;
  };
}

export function ProcessingStatus({ state }: ProcessingStatusProps) {
  if (state.status === 'idle') {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Progress Bar */}
      {(state.status === 'uploading' || state.status === 'processing') && (
        <div className="bg-neutral-900 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-300">
              {state.currentStep || 'Processing...'}
            </span>
            <span className="text-sm text-neutral-500">
              {Math.round(state.progress)}%
            </span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-2">
            <div
              className="bg-ccaBlue h-2 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {state.status === 'error' && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-red-300">{state.error || 'An unknown error occurred'}</p>
        </div>
      )}

      {/* Results */}
      {state.status === 'completed' && state.results && (
        <div className="bg-neutral-900 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-green-400">Processing Complete!</h3>
          
          {state.results.assetId && (
            <div>
              <span className="text-sm text-neutral-400">Asset ID: </span>
              <span className="text-sm font-mono text-neutral-300">{state.results.assetId}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-neutral-400">Files Processed: </span>
              <span className="text-sm font-semibold text-white">{state.results.filesProcessed}</span>
            </div>
            <div>
              <span className="text-sm text-neutral-400">Conversions (.mov → .mp4): </span>
              <span className="text-sm font-semibold text-white">{state.results.conversionsCompleted}</span>
            </div>
            <div>
              <span className="text-sm text-neutral-400">720p Previews Generated: </span>
              <span className="text-sm font-semibold text-white">{state.results.previewsGenerated}</span>
            </div>
            <div>
              <span className="text-sm text-neutral-400">Audio Durations Extracted: </span>
              <span className="text-sm font-semibold text-white">{state.results.durationsExtracted}</span>
            </div>
            <div>
              <span className="text-sm text-neutral-400">LUT Previews Created: </span>
              <span className="text-sm font-semibold text-white">{state.results.lutPreviewsCreated}</span>
            </div>
            <div>
              <span className="text-sm text-neutral-400">Documents Created: </span>
              <span className="text-sm font-semibold text-white">{state.results.documentsCreated}</span>
            </div>
          </div>

          {state.results.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">Errors:</h4>
              <ul className="list-disc list-inside space-y-1">
                {state.results.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-yellow-300">{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

