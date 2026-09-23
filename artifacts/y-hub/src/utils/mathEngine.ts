import * as math from 'mathjs';

export type Operation = 'simplify' | 'derive' | 'integrate' | 'zeroes' | 'area' | 'tangent';

export interface MathResponse {
  operation: string;
  expression: string;
  result: string;
}

const NEWTON_API = 'https://newton.vercel.app/api/v2';

export const mathEngine = {
  async compute(operation: Operation, expression: string): Promise<string> {
    const safeExpr = encodeURIComponent(expression.replace(/\s+/g, ''));
    try {
      const res = await fetch(`${NEWTON_API}/${operation}/${safeExpr}`);
      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
      const data: MathResponse = await res.json();
      return data.result;
    } catch (error) {
      console.error('MathEngine Error:', error);
      throw new Error('فشل المحرك في حل المسألة رياضياً. يرجى التحقق من الصيغة.');
    }
  },

  // Helper to cleanly extract numerator and denominator for fractions
  splitFraction(expression: string): { num: string; den: string } | null {
    // Basic heuristic: looks for the main '/'
    // A real parser would count parentheses. Here we do a simple balanced parenthesis split.
    let balance = 0;
    for (let i = 0; i < expression.length; i++) {
      if (expression[i] === '(') balance++;
      if (expression[i] === ')') balance--;
      if (expression[i] === '/' && balance === 0) {
        return {
          num: expression.slice(0, i),
          den: expression.slice(i + 1)
        };
      }
    }
    return null;
  },

  // Evaluates a simple expression numerically using math.js securely
  evaluateNumerically(expression: string, scope: Record<string, number>): number {
    try {
      // Clean up common syntax differences if any (e.g., ln -> log is standard in mathjs)
      let sanitized = expression
        .replace(/ln/g, 'log')
        .replace(/pi/gi, 'pi');
      
      return math.evaluate(sanitized, scope);
    } catch (e) {
      console.error("Numerical Evaluation Error:", e);
      return NaN;
    }
  },

  async applyLHopital(numerator: string, denominator: string): Promise<{ stepNum: string; stepDen: string; result: string }> {
    const stepNum = await this.compute('derive', numerator);
    const stepDen = await this.compute('derive', denominator);
    const simplified = await this.compute('simplify', `(${stepNum})/(${stepDen})`);
    return { stepNum, stepDen, result: simplified };
  },

  async toTex(expression: string): Promise<string> {
    try {
      const sanitized = expression.replace(/ln/g, 'log');
      return math.parse(sanitized).toTex();
    } catch {
      return expression; // fallback
    }
  },

  // Calculus 3 Extensions: Partial Derivatives
  async derivePartial(expression: string, variable: 'x' | 'y' | 'z'): Promise<string> {
    try {
      const math = await import('mathjs');
      // Clean syntax to work with mathjs
      const sanitized = expression.replace(/ln/g, 'log');
      const derivative = math.derivative(sanitized, variable);
      // Return raw string; components can use toTex if they want LaTeX formatting
      return derivative.toString();
    } catch (e) {
      console.error("Derivative Error:", e);
      throw new Error('فشل حساب المشتقة باستخدام المحرك الداخلي.');
    }
  },

  // Calculus 3 Extensions: Multiple Integrals
  async integratePartial(expression: string, variable: 'x' | 'y' | 'z'): Promise<string> {
    try {
      if (variable === 'x') {
        return await this.compute('integrate', expression);
      } else {
        // Swap variable with x because Newton API defaults to integrating w.r.t x
        let swapped = expression
          .replace(/x/g, 'TMP_W')
          .replace(new RegExp(variable, 'g'), 'x')
          .replace(/TMP_W/g, variable);
        
        let integrated = await this.compute('integrate', swapped);
        
        // Swap back
        let restored = integrated
          .replace(/x/g, 'TMP_W')
          .replace(new RegExp(variable, 'g'), 'x')
          .replace(/TMP_W/g, variable);
        return restored;
      }
    } catch (e) {
      throw new Error(`فشل حساب التكامل بالنسبة لـ ${variable}`);
    }
  },

  // Calculus 3 Extensions: Vector Math (Numeric)
  crossProduct(v1: [number, number, number], v2: [number, number, number]): [number, number, number] {
    return [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
    ];
  },

  dotProduct(v1: [number, number, number], v2: [number, number, number]): number {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  },

  magnitude(v: [number, number, number]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
};
