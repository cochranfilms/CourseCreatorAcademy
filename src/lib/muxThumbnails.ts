/**
 * Helper functions for MUX video thumbnails
 * 
 * MUX provides both static JPG thumbnails and animated GIF thumbnails.
 * These are generated on-demand from the playback ID.
 */

/**
 * Generate static JPG thumbnail URL from MUX playback ID
 * @param playbackId MUX playback ID
 * @param durationSec Optional duration to calculate midpoint for thumbnail
 * @param width Optional width (default: 640)
 * @returns Thumbnail URL or empty string if no playbackId
 */
export function getMuxThumbnailUrl(
  playbackId?: string,
  durationSec?: number,
  width: number = 640
): string {
  if (!playbackId) return '';
  const time = durationSec && durationSec > 0 ? Math.floor(durationSec / 2) : 1;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}&fit_mode=preserve`;
}

/**
 * Generate animated GIF thumbnail URL from MUX playback ID
 * MUX generates animated GIFs on-demand - no API call needed
 * 
 * @param playbackId MUX playback ID
 * @param width Optional width (default: 320, max: 640)
 * @param start Optional start time in seconds (default: 0)
 * @param end Optional end time in seconds (default: 5 seconds after start)
 * @param fps Optional frames per second (default: 15, max: 30)
 * @returns Animated GIF URL or empty string if no playbackId
 */
export function getMuxAnimatedGifUrl(
  playbackId?: string,
  width: number = 320,
  start?: number,
  end?: number,
  fps?: number
): string {
  if (!playbackId) return '';
  
  const params = new URLSearchParams();
  if (width) params.set('width', String(Math.min(width, 640))); // Max width is 640
  if (start !== undefined) params.set('start', String(start));
  if (end !== undefined) params.set('end', String(end));
  if (fps) params.set('fps', String(Math.min(fps, 30))); // Max fps is 30
  
  const queryString = params.toString();
  return `https://image.mux.com/${playbackId}/animated.gif${queryString ? `?${queryString}` : ''}`;
}

/**
 * Get the best available thumbnail URL (prefers animated GIF if available)
 * Falls back to static JPG if animated GIF not available
 * 
 * @param playbackId MUX playback ID
 * @param animatedGifUrl Optional pre-stored animated GIF URL
 * @param durationSec Optional duration for static thumbnail fallback
 * @param preferAnimated Whether to prefer animated GIF (default: true)
 * @returns Best available thumbnail URL
 */
export function getBestMuxThumbnailUrl(
  playbackId?: string,
  animatedGifUrl?: string,
  durationSec?: number,
  preferAnimated: boolean = true
): string {
  if (preferAnimated && animatedGifUrl) {
    return animatedGifUrl;
  }
  if (preferAnimated && playbackId) {
    return getMuxAnimatedGifUrl(playbackId);
  }
  return getMuxThumbnailUrl(playbackId, durationSec);
}

