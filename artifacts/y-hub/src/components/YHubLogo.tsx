import { useEffect, useRef } from 'react';

type YHubLogoProps = {
  className?: string;
  showText?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md' | 'hero';
};

function OriginalYMark({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      /*
       * Crop only the original circuit-Y from logo.png.
       * The text "Y HUB" below it is intentionally excluded.
       */
      const sx = 530;
      const sy = 105;
      const sw = 540;
      const sh = 490;

      canvas.width = sw;
      canvas.height = sh;

      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sw,
        sh
      );

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const data = imageData.data;

      /*
       * Estimate the original navy background from the crop corners.
       * Then convert pixels close to that background to transparency.
       */
      const samplePoints = [
        [8, 8],
        [sw - 9, 8],
        [8, sh - 9],
        [sw - 9, sh - 9],
      ];

      let bgR = 0;
      let bgG = 0;
      let bgB = 0;

      for (const [x, y] of samplePoints) {
        const index = (y * sw + x) * 4;
        bgR += data[index];
        bgG += data[index + 1];
        bgB += data[index + 2];
      }

      bgR /= samplePoints.length;
      bgG /= samplePoints.length;
      bgB /= samplePoints.length;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dr = r - bgR;
        const dg = g - bgG;
        const db = b - bgB;

        const distance = Math.sqrt(
          dr * dr +
          dg * dg +
          db * db
        );

        /*
         * Completely remove background/JPEG noise.
         * Preserve anti-aliased glow and the original colored logo.
         */
        const transparentAt = 13;
        const solidAt = 62;

        let alpha =
          (distance - transparentAt) /
          (solidAt - transparentAt);

        alpha = Math.max(0, Math.min(1, alpha));

        /*
         * Smooth transition so edges don't look cut out.
         */
        alpha = alpha * alpha * (3 - 2 * alpha);

        data[i + 3] = Math.round(alpha * 255);
      }

      ctx.clearRect(0, 0, sw, sh);
      ctx.putImageData(imageData, 0, 0);
    };

    img.src = '/logo.png';

    return () => {
      img.onload = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={540}
      height={490}
      className={className}
      aria-hidden="true"
    />
  );
}

export default function YHubLogo({
  className = '',
  showText = true,
  compact = false,
  size = 'md',
}: YHubLogoProps) {
  const iconSize =
    size === 'hero'
      ? 'h-24 sm:h-28 lg:h-32'
      : size === 'sm'
        ? 'h-10'
        : 'h-14';

  const titleSize =
    size === 'hero'
      ? 'text-5xl sm:text-6xl lg:text-7xl'
      : size === 'sm'
        ? 'text-lg'
        : 'text-xl';

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      aria-label="Y HUB"
    >
      <OriginalYMark
        className={`${iconSize} w-auto shrink-0 object-contain`}
      />

      {showText && (
        <div className="leading-none">
          <div
            className={`${titleSize} font-black tracking-[0.06em] text-white`}
          >
            {size === 'hero' ? 'HUB' : 'Y HUB'}
          </div>

          {!compact && size !== 'hero' && (
            <div className="mt-1 text-[9px] font-semibold tracking-[0.22em] text-slate-500">
              ACADEMIC PLATFORM
            </div>
          )}
        </div>
      )}
    </div>
  );
}
