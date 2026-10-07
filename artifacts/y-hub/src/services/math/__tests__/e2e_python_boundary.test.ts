import { vi } from 'vitest';
import { MathOrchestrator } from '../orchestration';
import { PythonMathAdapter } from '../python/adapter';
import { MathProblemRequest } from '../types/problem';
import { CanonicalAST } from '../types/ast';

describe('Step E.1 - End-to-End TS -> Python -> TS Pipeline Validation', () => {
  let orchestrator: MathOrchestrator;
  let adapterSpy: any;

  beforeEach(() => {
    orchestrator = new MathOrchestrator();
    adapterSpy = vi.spyOn(PythonMathAdapter.prototype, 'compute');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('E2E Case 1: d/dx [sin(x^2)] - Differentiation', async () => {
    adapterSpy.mockResolvedValueOnce({
      success: true,
      operation_performed: 'derive',
      result_ast: {
        type: 'Operator', operator: '*', args: [
          { type: 'Operator', operator: '*', args: [
            { type: 'Number', value: '2' },
            { type: 'Symbol', name: 'x' }
          ]},
          { type: 'Function', name: 'cos', args: [
            { type: 'Operator', operator: '^', args: [
              { type: 'Symbol', name: 'x' },
              { type: 'Number', value: '2' }
            ]}
          ]}
        ]
      },
      result_latex: '2x \\cos(x^2)',
      computation_time_ms: 12.4,
      steps: [
        { id: '1', title: 'Chain Rule', explanation: 'Applied chain rule on sin(x^2).' }
      ],
      warnings: []
    });

    const result = await orchestrator.solve('differentiate sin(x^2)');
    const pythonPayload: MathProblemRequest = adapterSpy.mock.calls[0][0];
    
    expect(pythonPayload.operation).toBe('derive');
    const ast = pythonPayload.expression as any;
    expect(ast.type).toBe('Function');
    expect(ast.name).toBe('sin'); 
    expect(ast.args[0].type).toBe('Operator');
    expect(ast.args[0].operator).toBe('^');
    
    expect(result.type).toBe('symbolic');
    if (result.type === 'symbolic') {
      expect(result.engineUsed).toBe('python_sympy');
      expect(result.latex).toBe('2x \\cos(x^2)');
      expect(result.steps.length).toBe(1);
      
      expect(result.verification).toBeDefined();
      expect(result.verification?.status).toBe('numerically_consistent');
    }
  });

  it('E2E Case 2: Integration - Verify limits and domain analysis', async () => {
    adapterSpy.mockResolvedValueOnce({
      success: true,
      operation_performed: 'integrate',
      result_ast: { type: 'Function', name: 'log', args: [{ type: 'Symbol', name: 'x' }] },
      result_latex: '\\ln|x|',
      computation_time_ms: 15.0,
      steps: [],
      warnings: []
    });

    const result = await orchestrator.solve('integrate 1/x');

    expect(result.type).toBe('symbolic');
    if (result.type === 'symbolic') {
      expect(result.conditions).toContain('Denominator must not equal zero');
      expect(result.verification).toBeDefined();
      expect(result.verification?.methodUsed).toBe('differentiation');
    }
  });
});
