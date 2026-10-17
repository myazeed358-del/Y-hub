export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'CELL_REF'
  | 'RANGE_REF'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export class Tokenizer {
  private input: string;
  private pos = 0;
  private length: number;

  constructor(input: string) {
    // If formula begins with '=', skip it
    this.input = input.startsWith('=') ? input.slice(1) : input;
    this.length = this.input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.length) {
      this.skipWhitespace();
      if (this.pos >= this.length) break;

      const ch = this.input[this.pos];
      const startPos = this.pos;

      // Single characters
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(', position: startPos });
        this.pos++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')', position: startPos });
        this.pos++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',', position: startPos });
        this.pos++;
        continue;
      }

      // String literal: "..." or '...'
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let strVal = '';
        this.pos++; // skip open quote
        while (this.pos < this.length) {
          if (this.input[this.pos] === quote) {
            // Check for escaped quote ""
            if (this.pos + 1 < this.length && this.input[this.pos + 1] === quote) {
              strVal += quote;
              this.pos += 2;
            } else {
              this.pos++; // skip closing quote
              break;
            }
          } else {
            strVal += this.input[this.pos];
            this.pos++;
          }
        }
        tokens.push({ type: 'STRING', value: strVal, position: startPos });
        continue;
      }

      // Operators: <=, >=, <>, =, <, >, +, -, *, /, ^, %, &
      if (ch === '<') {
        if (this.peek(1) === '=') {
          tokens.push({ type: 'OPERATOR', value: '<=', position: startPos });
          this.pos += 2;
        } else if (this.peek(1) === '>') {
          tokens.push({ type: 'OPERATOR', value: '<>', position: startPos });
          this.pos += 2;
        } else {
          tokens.push({ type: 'OPERATOR', value: '<', position: startPos });
          this.pos++;
        }
        continue;
      }
      if (ch === '>') {
        if (this.peek(1) === '=') {
          tokens.push({ type: 'OPERATOR', value: '>=', position: startPos });
          this.pos += 2;
        } else {
          tokens.push({ type: 'OPERATOR', value: '>', position: startPos });
          this.pos++;
        }
        continue;
      }
      if ('+-*/^%&='.includes(ch)) {
        tokens.push({ type: 'OPERATOR', value: ch, position: startPos });
        this.pos++;
        continue;
      }

      // Number literal
      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek(1)))) {
        const numStr = this.readNumber();
        tokens.push({ type: 'NUMBER', value: numStr, position: startPos });
        continue;
      }

      // Range reference or Cell reference or Function / Identifier
      // Could also start with sheet name in quotes: 'Sheet 1'!A1:B10
      if (ch === "'" || this.isAlpha(ch) || ch === '$' || ch === '_') {
        const token = this.readReferenceOrIdentifier();
        tokens.push(token);
        continue;
      }

      // Unknown character, skip to avoid infinite loop
      this.pos++;
    }

    tokens.push({ type: 'EOF', value: '', position: this.pos });
    return tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.length && /\s/.test(this.input[this.pos] || '')) {
      this.pos++;
    }
  }

  private peek(offset = 1): string {
    const idx = this.pos + offset;
    return idx < this.length ? this.input[idx] || '' : '';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private readNumber(): string {
    let numStr = '';
    let hasDot = false;
    let hasExponent = false;

    while (this.pos < this.length) {
      const ch = this.input[this.pos] || '';
      if (this.isDigit(ch)) {
        numStr += ch;
        this.pos++;
      } else if (ch === '.' && !hasDot && !hasExponent) {
        hasDot = true;
        numStr += ch;
        this.pos++;
      } else if ((ch === 'e' || ch === 'E') && !hasExponent) {
        hasExponent = true;
        numStr += ch;
        this.pos++;
        if (this.input[this.pos] === '+' || this.input[this.pos] === '-') {
          numStr += this.input[this.pos];
          this.pos++;
        }
      } else {
        break;
      }
    }
    return numStr;
  }

  private readReferenceOrIdentifier(): Token {
    const startPos = this.pos;
    let text = '';

    // If starts with single quote, it's a quoted sheet name: 'Sheet 1'!A1
    if (this.input[this.pos] === "'") {
      text += "'";
      this.pos++;
      while (this.pos < this.length && this.input[this.pos] !== "'") {
        text += this.input[this.pos];
        this.pos++;
      }
      if (this.pos < this.length && this.input[this.pos] === "'") {
        text += "'";
        this.pos++;
      }
      if (this.pos < this.length && this.input[this.pos] === '!') {
        text += '!';
        this.pos++;
      }
    }

    // Read remaining word / reference characters: alphanumeric, $, : (for range), !
    while (this.pos < this.length) {
      const ch = this.input[this.pos] || '';
      if (/[A-Za-z0-9_$!]/.test(ch)) {
        text += ch;
        this.pos++;
      } else if (ch === ':') {
        // Range separator!
        // Peek if following is range target, like :B10 or :$B$10
        text += ':';
        this.pos++;
        while (this.pos < this.length && /[A-Za-z0-9_$]/.test(this.input[this.pos] || '')) {
          text += this.input[this.pos];
          this.pos++;
        }
        break;
      } else {
        break;
      }
    }

    // Check if Range Reference (e.g. A1:B10 or Sheet1!A1:B10)
    if (text.includes(':')) {
      return { type: 'RANGE_REF', value: text, position: startPos };
    }

    // Check if Boolean
    const upper = text.toUpperCase();
    if (upper === 'TRUE' || upper === 'FALSE') {
      return { type: 'BOOLEAN', value: upper, position: startPos };
    }

    // Check if Cell Reference (e.g. A1, $A$1, Sheet1!A1)
    const cellRegex = /^(?:(?:'[^']+'|[A-Za-z0-9_]+)!)?\$?[A-Za-z]+\$?[1-9][0-9]*$/;
    if (cellRegex.test(text)) {
      return { type: 'CELL_REF', value: text, position: startPos };
    }

    // Otherwise it's an Identifier (Function name or variable)
    return { type: 'IDENTIFIER', value: text, position: startPos };
  }
}
