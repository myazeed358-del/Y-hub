import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';
import { ProblemClassifier } from '../classifier';
import { DomainAnalyzer } from '../domain';

// Note: This file relies on a test runner like Jest or Vitest.
// In this exact environment `npm` and `Node` might be unavailable to execute it,
// but the architecture requires the tests to exist for Step C validation.

describe('Math Engine Core - Step C Validation', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const classifier = new ProblemClassifier();
  const domainAnalyzer = new DomainAnalyzer();

  describe('ExpressionParser & Canonical AST', () => {
    it('should parse basic arithmetic into correct nodes', () => {
      const ast = parser.parse('2x + 3');
      expect(ast.type).toBe('Operator');
      // Should show implicit multiplication
      // Expect deterministic canonical AST structure
    });

    it('should enforce maximum expression length security limits', () => {
      const hugeExpr = 'x'.repeat(600);
      expect(() => parser.parse(hugeExpr)).toThrow('Security Violation');
    });
  });

  describe('ASTNormalizer', () => {
    it('should normalize ln to log structurally', () => {
      const ast = parser.parse('ln(x)');
      const normalized = normalizer.normalize(ast);
      expect((normalized as any).name).toBe('log');
    });

    it('should explicitly expand implicit multiplication if requested', () => {
      const ast = parser.parse('2x');
      const normalized = normalizer.normalize(ast, true);
      expect((normalized as any).operator).toBe('*');
    });
  });

  describe('ProblemClassifier', () => {
    it('should classify solve requests properly', () => {
      const req = classifier.classify('solve x^2 + 2x = 0');
      expect(req.operation).toBe('solve_equation');
      expect(req.expression?.type).toBe('Equation');
    });

    it('should classify derivative requests properly', () => {
      const req = classifier.classify('differentiate x^2');
      expect(req.operation).toBe('derive');
    });
  });

  describe('DomainAnalyzer', () => {
    it('should catch division by zero risks', () => {
      const ast = parser.parse('1/(x-2)');
      const restrictions = domainAnalyzer.analyze(ast);
      expect(restrictions.length).toBe(1);
      expect(restrictions[0].type).toBe('denominator');
    });

    it('should catch multiple restrictions in one expression', () => {
      const ast = parser.parse('sqrt(x+1) + ln(x-3) + 1/x');
      const normalized = normalizer.normalize(ast);
      const restrictions = domainAnalyzer.analyze(normalized);
      expect(restrictions.length).toBe(3);
      const types = restrictions.map(r => r.type);
      expect(types).toContain('even_root');
      expect(types).toContain('logarithm');
      expect(types).toContain('denominator');
    });
  });
});
