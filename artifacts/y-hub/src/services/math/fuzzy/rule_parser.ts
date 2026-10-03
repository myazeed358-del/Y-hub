import { Rule, RuleNode, RulePredicate, LogicalExpression, HedgeType } from './rule_types';

export class RuleParser {
  private pos = 0;
  private tokens: string[] = [];
  private depth = 0;
  private MAX_DEPTH = 50;

  public parseRule(text: string, id: string = 'R_UNKNOWN'): Rule {
    this.tokens = text
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);
    this.pos = 0;
    this.depth = 0;

    if (this.match('IF') === null) throw new Error("Rule must start with 'IF'");
    
    const antecedent = this.parseExpression();

    if (this.match('THEN') === null) throw new Error("Rule must contain 'THEN'");
    
    const consequents = this.parseConsequents();

    return {
      id,
      antecedent,
      consequents,
      weight: 1.0, // Default weight, validated structurally later
      rawText: text
    };
  }

  private match(expected: string): string | null {
    if (this.pos < this.tokens.length && this.tokens[this.pos].toUpperCase() === expected) {
      return this.tokens[this.pos++];
    }
    return null;
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos].toUpperCase() : null;
  }

  private parseExpression(): RuleNode {
    this.depth++;
    if (this.depth > this.MAX_DEPTH) throw new Error('Maximum expression depth exceeded (Security constraint)');
    const node = this.parseOr();
    this.depth--;
    return node;
  }

  // Precedence: OR is lowest
  private parseOr(): RuleNode {
    let node = this.parseAnd();
    while (this.match('OR')) {
      const right = this.parseAnd();
      node = { type: 'OR', children: [node, right] } as LogicalExpression;
    }
    return node;
  }

  // Precedence: AND is higher than OR
  private parseAnd(): RuleNode {
    let node = this.parseNot();
    while (this.match('AND')) {
      const right = this.parseNot();
      node = { type: 'AND', children: [node, right] } as LogicalExpression;
    }
    return node;
  }

  // Precedence: NOT is highest
  private parseNot(): RuleNode {
    if (this.match('NOT')) {
      return { type: 'NOT', children: [this.parseNot()] } as LogicalExpression;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): RuleNode {
    if (this.match('(')) {
      const node = this.parseExpression();
      if (!this.match(')')) throw new Error("Missing closing parenthesis ')'");
      return node;
    }
    
    // Predicate: Variable IS [Hedge] Term
    const variable = this.tokens[this.pos++];
    if (!this.match('IS')) throw new Error(`Expected 'IS' after variable '${variable}'`);
    
    let hedge: HedgeType = 'none';
    const next = this.peek();
    if (next === 'VERY') { this.pos++; hedge = 'very'; }
    else if (next === 'SOMEWHAT') { this.pos++; hedge = 'somewhat'; }
    else if (next === 'MORE-OR-LESS' || next === 'MORE_OR_LESS') { this.pos++; hedge = 'more-or-less'; }
    
    const term = this.tokens[this.pos++];
    return { type: 'predicate', variable, term, hedge };
  }

  private parseConsequents(): RulePredicate[] {
    const consequents: RulePredicate[] = [];
    do {
      if (this.pos >= this.tokens.length) throw new Error("Missing consequent after THEN/AND");
      const variable = this.tokens[this.pos++];
      if (!this.match('IS')) throw new Error(`Expected 'IS' in consequent after '${variable}'`);
      
      let hedge: HedgeType = 'none';
      const next = this.peek();
      if (next === 'VERY') { this.pos++; hedge = 'very'; }
      else if (next === 'SOMEWHAT') { this.pos++; hedge = 'somewhat'; }
      else if (next === 'MORE-OR-LESS' || next === 'MORE_OR_LESS') { this.pos++; hedge = 'more-or-less'; }
      
      const term = this.tokens[this.pos++];
      consequents.push({ type: 'predicate', variable, term, hedge });
    } while (this.match('AND'));
    return consequents;
  }
}
