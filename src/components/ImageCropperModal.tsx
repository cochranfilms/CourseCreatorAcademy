"use client";
import { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

type Props = {
  imageSrc: string;
  aspect: number; // e.g., 1 for square, 16/9 for banner
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
};

export default function ImageCropperModal({ imageSrc, aspect, onCancel, onCropped }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const createCroppedImage = useCallback(async () => {
    if (!croppedAreaPixels) return;
    const image = await createHTMLImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.max(1, Math.round(croppedAreaPixels.width));
    canvas.height = Math.max(1, Math.round(croppedAreaPixels.height));
    ctx.drawImage(
      image,
      Math.round(croppedAreaPixels.x),
      Math.round(croppedAreaPixels.y),
      Math.round(croppedAreaPixels.width),
      Math.round(croppedAreaPixels.height),
      0,
      0,
      canvas.width,
      canvas.height
    );
    canvas.toBlob((blob) => {
      if (blob) onCropped(blob);
    }, 'image/jpeg', 0.92);
  }, [croppedAreaPixels, imageSrc, onCropped]);

  return (
    <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-3xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col">
        <div className="relative flex-1 min-h-[50vh] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="rect"
            showGrid={false}
          />
        </div>
        <div className="p-4 flex items-center justify-between gap-3 border-t border-neutral-800">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-1/2"
          />
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800">Cancel</button>
            <button onClick={createCroppedImage} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue">Save Crop</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function createHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}


