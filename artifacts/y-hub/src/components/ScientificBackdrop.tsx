import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

const neonStyle = {
  color: 'rgba(255,255,255,0.20)',
  textShadow:
    '0 0 4px rgba(23,59,122,.55), 0 0 10px rgba(23,59,122,.42), 0 0 22px rgba(10,30,75,.34)',
};

const softNeonStyle = {
  color: 'rgba(255,255,255,0.12)',
  textShadow:
    '0 0 4px rgba(23,59,122,.38), 0 0 12px rgba(10,30,75,.26)',
};

export default function ScientificBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Calculus */}
      <div
        className="absolute left-[5%] top-[15%] hidden -rotate-3 text-4xl lg:block"
        style={neonStyle}
      >
        <InlineMath math="\displaystyle \int_a^b f(x)\,dx" />
      </div>

      <div
        className="absolute left-[18%] top-[42%] hidden rotate-2 text-3xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \frac{\partial f}{\partial x}" />
      </div>

      <div
        className="absolute right-[5%] top-[14%] hidden rotate-2 text-3xl lg:block"
        style={neonStyle}
      >
        <InlineMath math="\displaystyle \frac{dy}{dx}=f(x,y)" />
      </div>

      <div
        className="absolute right-[7%] bottom-[13%] hidden -rotate-2 text-3xl lg:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \sum_{n=1}^{\infty}\frac{1}{n^2}" />
      </div>

      {/* Linear algebra */}
      <div
        className="absolute left-[40%] top-[27%] hidden rotate-1 text-2xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \begin{bmatrix}a_{11}&a_{12}&a_{13}\\a_{21}&a_{22}&a_{23}\\a_{31}&a_{32}&a_{33}\end{bmatrix}" />
      </div>

      <div
        className="absolute left-[3%] bottom-[11%] hidden -rotate-2 text-2xl md:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle A\mathbf{v}=\lambda\mathbf{v}" />
      </div>

      {/* Physics */}
      <div
        className="absolute right-[6%] top-[38%] hidden -rotate-2 text-3xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \nabla\cdot\mathbf{F}=\frac{\rho}{\varepsilon_0}" />
      </div>

      <div
        className="absolute right-[9%] bottom-[7%] hidden rotate-2 text-3xl lg:block"
        style={neonStyle}
      >
        <InlineMath math="E=mc^2" />
      </div>

      <div
        className="absolute left-[54%] top-[9%] hidden text-2xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \psi(x,t)=Ae^{i(kx-\omega t)}" />
      </div>

      {/* Statistics */}
      <div
        className="absolute left-[28%] top-[10%] hidden -rotate-1 text-2xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle \sigma^2=\frac{1}{N}\sum_{i=1}^{N}(x_i-\mu)^2" />
      </div>

      {/* Chemistry */}
      <div
        className="absolute right-[2%] top-[58%] hidden rotate-3 text-2xl lg:block"
        style={softNeonStyle}
      >
        <InlineMath math="\mathrm{H_2O}" />
      </div>

      <div
        className="absolute left-[8%] bottom-[31%] hidden -rotate-2 text-xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\mathrm{CO_2 + H_2O \rightleftharpoons H_2CO_3}" />
      </div>

      {/* Complex numbers */}
      <div
        className="absolute left-[48%] bottom-[8%] hidden rotate-1 text-2xl lg:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle e^{i\theta}=\cos\theta+i\sin\theta" />
      </div>

      {/* Probability */}
      <div
        className="absolute right-[27%] bottom-[18%] hidden -rotate-2 text-xl xl:block"
        style={softNeonStyle}
      >
        <InlineMath math="\displaystyle P(A\mid B)=\frac{P(B\mid A)P(A)}{P(B)}" />
      </div>

      {/* Computer science */}
      <div
        className="absolute left-[13%] top-[61%] hidden font-mono text-2xl xl:block"
        style={softNeonStyle}
      >
        {'</>'}
      </div>

      <div
        className="absolute right-[22%] top-[24%] hidden font-mono text-xl tracking-[0.28em] xl:block"
        style={softNeonStyle}
      >
        101101 011010 110001
      </div>

      {/* Scientific orbital line art */}
      <svg
        className="absolute bottom-[15%] right-[32%] hidden h-40 w-40 opacity-30 xl:block"
        viewBox="0 0 160 160"
        fill="none"
      >
        <g
          stroke="rgba(255,255,255,.18)"
          strokeWidth="1"
          style={{
            filter:
              'drop-shadow(0 0 5px rgba(23,59,122,.55)) drop-shadow(0 0 12px rgba(10,30,75,.35))',
          }}
        >
          <ellipse cx="80" cy="80" rx="64" ry="22" />
          <ellipse cx="80" cy="80" rx="64" ry="22" transform="rotate(60 80 80)" />
          <ellipse cx="80" cy="80" rx="64" ry="22" transform="rotate(-60 80 80)" />
          <circle cx="80" cy="80" r="4" fill="rgba(255,255,255,.18)" />
        </g>
      </svg>

      {/* Network / computing line art */}
      <svg
        className="absolute right-[7%] top-[44%] hidden h-40 w-52 opacity-25 xl:block"
        viewBox="0 0 210 150"
        fill="none"
      >
        <g
          stroke="rgba(255,255,255,.18)"
          strokeWidth="1"
          style={{
            filter:
              'drop-shadow(0 0 5px rgba(23,59,122,.55)) drop-shadow(0 0 12px rgba(10,30,75,.35))',
          }}
        >
          <path d="M24 82L82 35L142 68L184 26" />
          <path d="M24 82L76 126L142 68L178 118" />
          <path d="M82 35L76 126" />

          <circle cx="24" cy="82" r="4" fill="rgba(255,255,255,.18)" />
          <circle cx="82" cy="35" r="4" fill="rgba(255,255,255,.18)" />
          <circle cx="76" cy="126" r="4" fill="rgba(255,255,255,.18)" />
          <circle cx="142" cy="68" r="4" fill="rgba(255,255,255,.18)" />
          <circle cx="184" cy="26" r="4" fill="rgba(255,255,255,.18)" />
          <circle cx="178" cy="118" r="4" fill="rgba(255,255,255,.18)" />
        </g>
      </svg>

      {/* Spacetime fabric floor */}
      <div className="absolute inset-x-0 bottom-0 hidden h-[240px] xl:block opacity-60">
        <svg viewBox="0 0 1600 260" className="h-full w-full" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fabricFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.00)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>

            <filter id="fabricGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* horizontal warped lines */}
          <path d="M0 40 C280 30, 520 24, 800 22 C1080 24, 1320 30, 1600 40" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 70 C280 58, 520 50, 800 48 C1080 50, 1320 58, 1600 70" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 100 C280 86, 520 76, 800 74 C1080 76, 1320 86, 1600 100" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 130 C280 114, 520 100, 800 96 C1080 100, 1320 114, 1600 130" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 160 C280 142, 520 124, 800 118 C1080 124, 1320 142, 1600 160" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 190 C280 170, 520 148, 800 140 C1080 148, 1320 170, 1600 190" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 220 C280 198, 520 172, 800 162 C1080 172, 1320 198, 1600 220" stroke="url(#fabricFade)" strokeWidth="1.2" filter="url(#fabricGlow)" />
          <path d="M0 248 C280 224, 520 196, 800 184 C1080 196, 1320 224, 1600 248" stroke="url(#fabricFade)" strokeWidth="1.3" filter="url(#fabricGlow)" />

          {/* vertical perspective lines */}
          <path d="M120 260 C180 190, 220 120, 260 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M250 260 C295 192, 330 124, 370 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M380 260 C415 194, 445 126, 480 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M510 260 C535 194, 560 126, 590 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M640 260 C655 194, 675 126, 700 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M800 260 L800 0" stroke="rgba(255,255,255,0.10)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M960 260 C945 194, 925 126, 900 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M1090 260 C1065 194, 1040 126, 1010 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M1220 260 C1185 194, 1155 126, 1120 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M1350 260 C1305 192, 1270 124, 1230 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />
          <path d="M1480 260 C1420 190, 1380 120, 1340 0" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#fabricGlow)" />

          {/* center warp depression */}
          <path
            d="M620 150 C690 138, 740 128, 800 118 C860 128, 910 138, 980 150"
            stroke="rgba(130,170,255,0.16)"
            strokeWidth="1.2"
            filter="url(#fabricGlow)"
          />
          <path
            d="M655 186 C710 165, 755 148, 800 140 C845 148, 890 165, 945 186"
            stroke="rgba(130,170,255,0.14)"
            strokeWidth="1.2"
            filter="url(#fabricGlow)"
          />
        </svg>
      </div>

    </div>
  );
}
