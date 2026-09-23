import { CanonicalAST } from '../types/ast';

export interface Rational {
  num: bigint;
  den: bigint;
}

export const Rat = {
  zero: { num: 0n, den: 1n } as Rational,
  one: { num: 1n, den: 1n } as Rational,
  
  gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  },
  
  simplify(r: Rational): Rational {
    if (r.num === 0n) return { num: 0n, den: 1n };
    const g = this.gcd(r.num, r.den);
    let num = r.num / g;
    let den = r.den / g;
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    return { num, den };
  },
  
  add(a: Rational, b: Rational): Rational {
    return this.simplify({
      num: a.num * b.den + b.num * a.den,
      den: a.den * b.den
    });
  },
  
  sub(a: Rational, b: Rational): Rational {
    return this.simplify({
      num: a.num * b.den - b.num * a.den,
      den: a.den * b.den
    });
  },
  
  mul(a: Rational, b: Rational): Rational {
    return this.simplify({
      num: a.num * b.num,
      den: a.den * b.den
    });
  },
  
  div(a: Rational, b: Rational): Rational {
    if (b.num === 0n) throw new Error('Division by zero');
    return this.simplify({
      num: a.num * b.den,
      den: a.den * b.num
    });
  },
  
  pow(a: Rational, exp: bigint): Rational {
    if (exp === 0n) return this.one;
    if (exp < 0n) return this.pow(this.div(this.one, a), -exp);
    let res = this.one;
    let base = a;
    let p = exp;
    while (p > 0n) {
      if (p % 2n === 1n) res = this.mul(res, base);
      base = this.mul(base, base);
      p /= 2n;
    }
    return res;
  },
  
  isZero(a: Rational): boolean {
    return a.num === 0n;
  },
  
  isEqual(a: Rational, b: Rational): boolean {
    const sa = this.simplify(a);
    const sb = this.simplify(b);
    return sa.num === sb.num && sa.den === sb.den;
  },

  fromNumber(n: number): Rational | null {
    if (!Number.isFinite(n)) return null;
    if (Number.isInteger(n)) return { num: BigInt(n), den: 1n };
    const s = n.toString();
    if (s.includes('e')) return null; // Fallback for very small/large
    const parts = s.split('.');
    if (parts.length === 1) return { num: BigInt(parts[0]), den: 1n };
    const dec = parts[1];
    const num = BigInt(parts[0] + dec);
    const den = 10n ** BigInt(dec.length);
    return this.simplify({ num, den });
  },
  
  fromAST(ast: CanonicalAST): Rational | null {
    if (ast.type === 'Number') return this.fromNumber(parseFloat(ast.value));
    if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 1) {
      const inner = this.fromAST(ast.args[0]);
      if (!inner) return null;
      return this.simplify({ num: -inner.num, den: inner.den });
    }
    if (ast.type === 'Operator' && ast.operator === '/') {
      const num = this.fromAST(ast.args[0]);
      const den = this.fromAST(ast.args[1]);
      if (!num || !den || den.num === 0n) return null;
      return this.div(num, den);
    }
    return null;
  }
};

export interface LocalSeries {
  variable: string;
  center: Rational;
  terms: Rational[];
  remainderOrder: number;
  remainderType: 'big_O' | 'unknown';
}

export class LocalSeriesEngine {
  public expand(ast: CanonicalAST, variable: string, centerNum: number, order: number): LocalSeries | null {
    const center = Rat.fromNumber(centerNum);
    if (!center) return null;
    
    const terms = this.expandInternal(ast, variable, center, order);
    if (!terms) return null;
    
    return {
      variable,
      center,
      terms,
      remainderOrder: order + 1,
      remainderType: 'big_O'
    };
  }

  private expandInternal(ast: CanonicalAST, variable: string, center: Rational, order: number): Rational[] | null {
    if (ast.type === 'Number') {
      const r = Rat.fromAST(ast);
      if (!r) return null;
      const res = new Array(order + 1).fill(Rat.zero);
      res[0] = r;
      return res;
    }
    
    if (ast.type === 'Constant') {
      // Irrationals cannot be expanded exactly as Rationals
      return null;
    }
    
    if (ast.type === 'Symbol') {
      if (ast.name === variable) {
        const res = new Array(order + 1).fill(Rat.zero);
        res[0] = center;
        if (order >= 1) res[1] = Rat.one;
        return res;
      }
      return null;
    }
    
    if (ast.type === 'Operator') {
      if (ast.operator === '+') {
        let res = new Array(order + 1).fill(Rat.zero);
        for (const arg of ast.args) {
          const e = this.expandInternal(arg, variable, center, order);
          if (!e) return null;
          res = res.map((v, i) => Rat.add(v, e[i]));
        }
        return res;
      }
      if (ast.operator === '-') {
        if (ast.args.length === 1) {
          const e = this.expandInternal(ast.args[0], variable, center, order);
          return e ? e.map(x => Rat.mul(x, { num: -1n, den: 1n })) : null;
        }
        const left = this.expandInternal(ast.args[0], variable, center, order);
        const right = this.expandInternal(ast.args[1], variable, center, order);
        if (!left || !right) return null;
        return left.map((v, i) => Rat.sub(v, right[i]));
      }
      if (ast.operator === '*' || ast.operator === 'implicit_multiply') {
        let res = new Array(order + 1).fill(Rat.zero);
        res[0] = Rat.one;
        for (const arg of ast.args) {
          const e = this.expandInternal(arg, variable, center, order);
          if (!e) return null;
          res = this.mulSeries(res, e, order);
        }
        return res;
      }
      if (ast.operator === '/') {
        const num = this.expandInternal(ast.args[0], variable, center, order);
        const den = this.expandInternal(ast.args[1], variable, center, order);
        if (!num || !den) return null;
        const invDen = this.invSeries(den, order);
        if (!invDen) return null;
        return this.mulSeries(num, invDen, order);
      }
      if (ast.operator === '^') {
        const base = this.expandInternal(ast.args[0], variable, center, order);
        if (!base) return null;
        
        const alpha = Rat.fromAST(ast.args[1]);
        if (!alpha) return null; // Requires rational exponent

        // Constant integer exponent
        if (alpha.den === 1n && alpha.num >= 0n) {
          return this.powSeries(base, alpha.num, order);
        }
        
        // Fractional exponent
        if (Rat.isZero(base[0])) return null; // Puiseux series unsupported
        if (base[0].num < 0n) return null; // Complex branch
        
        // Exact roots only supported if base[0] is exactly 1 (to avoid irrational roots)
        if (!Rat.isEqual(base[0], Rat.one)) return null; 
        
        const v = base.map(x => Rat.div(x, base[0]));
        v[0] = Rat.zero;
        return this.compose_binomial(v, alpha, order);
      }
    }
    
    if (ast.type === 'Function') {
      const u = this.expandInternal(ast.args[0], variable, center, order);
      if (!u) return null;
      const u0 = u[0];
      const v = [...u];
      v[0] = Rat.zero;
      
      if (ast.name === 'exp') {
        if (!Rat.isZero(u0)) return null; // series_unsupported_at_center
        return this.compose_exp(v, order);
      }
      if (ast.name === 'sin') {
        if (!Rat.isZero(u0)) return null;
        return this.compose_sin(v, order);
      }
      if (ast.name === 'cos') {
        if (!Rat.isZero(u0)) return null;
        return this.compose_cos(v, order);
      }
      if (ast.name === 'tan') {
        if (!Rat.isZero(u0)) return null;
        const s_v = this.compose_sin(v, order);
        const c_v = this.compose_cos(v, order);
        const inv_cos = this.invSeries(c_v, order);
        if (!inv_cos) return null;
        return this.mulSeries(s_v, inv_cos, order);
      }
      if (ast.name === 'ln' || ast.name === 'log') {
        if (!Rat.isEqual(u0, Rat.one)) return null; // Only around ln(1) supported exactly
        return this.compose_ln1p(v, order);
      }
      if (ast.name === 'sqrt') {
        if (!Rat.isEqual(u0, Rat.one)) return null;
        return this.compose_binomial(v, { num: 1n, den: 2n }, order);
      }
    }
    
    if (ast.type === 'Parenthesis') return this.expandInternal(ast.content, variable, center, order);
    
    return null;
  }

  private mulSeries(a: Rational[], b: Rational[], order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    for (let i = 0; i <= order; i++) {
      if (Rat.isZero(a[i])) continue;
      for (let j = 0; i + j <= order; j++) {
        res[i + j] = Rat.add(res[i + j], Rat.mul(a[i], b[j]));
      }
    }
    return res;
  }

  private powSeries(a: Rational[], n: bigint, order: number): Rational[] {
    if (n === 0n) { const r = new Array(order + 1).fill(Rat.zero); r[0] = Rat.one; return r; }
    let res = new Array(order + 1).fill(Rat.zero); res[0] = Rat.one;
    let base = [...a];
    let p = n;
    while (p > 0n) {
      if (p % 2n === 1n) res = this.mulSeries(res, base, order);
      base = this.mulSeries(base, base, order);
      p /= 2n;
    }
    return res;
  }

  private invSeries(a: Rational[], order: number): Rational[] | null {
    if (Rat.isZero(a[0])) return null;
    const v = a.map(x => Rat.div(x, a[0]));
    v[0] = Rat.zero;
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = new Array(order + 1).fill(Rat.zero); vk[0] = Rat.one;
    
    for (let k = 0; k <= order; k++) {
      const sign = k % 2 === 0 ? Rat.one : { num: -1n, den: 1n };
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(sign, vk[i]));
      }
      vk = this.mulSeries(vk, v, order);
    }
    return res.map(x => Rat.div(x, a[0]));
  }

  private getFact(k: number): Rational {
    let f = 1n;
    for (let i = 2n; i <= BigInt(k); i++) f *= i;
    return { num: 1n, den: f };
  }

  private compose_exp(v: Rational[], order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = new Array(order + 1).fill(Rat.zero); vk[0] = Rat.one;
    
    for (let k = 0; k <= order; k++) {
      const fact = this.getFact(k);
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(vk[i], fact));
      }
      vk = this.mulSeries(vk, v, order);
    }
    return res;
  }

  private compose_sin(v: Rational[], order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = [...v];
    
    for (let k = 0; 2 * k + 1 <= order; k++) {
      const fact = this.getFact(2 * k + 1);
      const sign = k % 2 === 0 ? Rat.one : { num: -1n, den: 1n };
      const coeff = Rat.mul(sign, fact);
      
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(vk[i], coeff));
      }
      vk = this.mulSeries(vk, v, order);
      vk = this.mulSeries(vk, v, order);
    }
    return res;
  }

  private compose_cos(v: Rational[], order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = new Array(order + 1).fill(Rat.zero); vk[0] = Rat.one;
    
    for (let k = 0; 2 * k <= order; k++) {
      const fact = this.getFact(2 * k);
      const sign = k % 2 === 0 ? Rat.one : { num: -1n, den: 1n };
      const coeff = Rat.mul(sign, fact);
      
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(vk[i], coeff));
      }
      vk = this.mulSeries(vk, v, order);
      vk = this.mulSeries(vk, v, order);
    }
    return res;
  }

  private compose_ln1p(v: Rational[], order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = [...v];
    
    for (let k = 1; k <= order; k++) {
      const sign = k % 2 === 1 ? Rat.one : { num: -1n, den: 1n };
      const coeff = Rat.mul(sign, { num: 1n, den: BigInt(k) });
      
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(vk[i], coeff));
      }
      vk = this.mulSeries(vk, v, order);
    }
    return res;
  }

  private compose_binomial(v: Rational[], alpha: Rational, order: number): Rational[] {
    const res = new Array(order + 1).fill(Rat.zero);
    let vk = new Array(order + 1).fill(Rat.zero); vk[0] = Rat.one;
    
    let binom = Rat.one;
    for (let k = 0; k <= order; k++) {
      if (k > 0) {
        const numTerm = Rat.sub(alpha, { num: BigInt(k - 1), den: 1n });
        const denTerm = { num: 1n, den: BigInt(k) };
        binom = Rat.mul(binom, Rat.mul(numTerm, denTerm));
      }
      for (let i = 0; i <= order; i++) {
        res[i] = Rat.add(res[i], Rat.mul(binom, vk[i]));
      }
      vk = this.mulSeries(vk, v, order);
    }
    return res;
  }
}
