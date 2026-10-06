import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DerivativeEngine } from '../symbolic/derivative';
import { IntegrationEngine } from '../symbolic/integration';
import { DomainAnalyzer } from '../domain';

export class VariationOfParametersEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private iEngine = new IntegrationEngine();
    private domainAnalyzer = new DomainAnalyzer();

    public solveParticular(req: ODERequest, y1: CanonicalAST, y2: CanonicalAST, g: CanonicalAST, x: string): { yp: CanonicalAST, steps: ODEStep[], wCondition: CanonicalAST } | null {
        const steps: ODEStep[] = [];
        
        // 1. Wronskian W = y1 y2' - y2 y1'
        const y1p = this.simplifier.simplify(this.dEngine.differentiate(y1, x));
        const y2p = this.simplifier.simplify(this.dEngine.differentiate(y2, x));
        
        const W = this.simplifier.simplify({
            type: 'Operator', operator: '-', args: [
                { type: 'Operator', operator: '*', args: [y1, y2p] },
                { type: 'Operator', operator: '*', args: [y2, y1p] }
            ]
        });
        
        if (W.type === 'Number' && W.value === '0') return null;
        
        const wCondition = { type: 'Inequality', operator: '!=', lhs: W, rhs: { type: 'Number', value: '0' } } as CanonicalAST;
        
        // 2. u1' = -y2 g / W
        const u1p = this.simplifier.simplify({
            type: 'Operator', operator: '/', args: [
                { type: 'Operator', operator: '*', args: [ { type: 'Number', value: '-1' }, { type: 'Operator', operator: '*', args: [y2, g] } ] },
                W
            ]
        });
        
        // 3. u2' = y1 g / W
        const u2p = this.simplifier.simplify({
            type: 'Operator', operator: '/', args: [
                { type: 'Operator', operator: '*', args: [y1, g] },
                W
            ]
        });
        
        try {
            const integrateOrFormal = (
                integrand: CanonicalAST
            ): CanonicalAST => {
                try {
                    return this.iEngine.integrate(
                        integrand,
                        x,
                        []
                    );
                } catch {
                    // An unevaluated integral is still an exact
                    // symbolic Variation-of-Parameters expression.
                    return {
                        type: 'Function',
                        name: 'Integral',
                        args: [
                            integrand,
                            {
                                type: 'Symbol',
                                name: x
                            }
                        ]
                    };
                }
            };

            const u1 = integrateOrFormal(u1p);
            const u2 = integrateOrFormal(u2p);

            const yp = this.simplifier.simplify({
                type: 'Operator',
                operator: '+',
                args: [
                    {
                        type: 'Operator',
                        operator: '*',
                        args: [u1, y1]
                    },
                    {
                        type: 'Operator',
                        operator: '*',
                        args: [u2, y2]
                    }
                ]
            });

            const containsFormalIntegral = (
                node: CanonicalAST
            ): boolean => {
                if (
                    node.type === 'Function' &&
                    node.name === 'Integral'
                ) {
                    return true;
                }

                if (
                    node.type === 'Operator' ||
                    node.type === 'Function'
                ) {
                    return node.args.some(
                        containsFormalIntegral
                    );
                }

                if (node.type === 'Parenthesis') {
                    return containsFormalIntegral(
                        node.content
                    );
                }

                if (
                    node.type === 'Equation' ||
                    node.type === 'Inequality'
                ) {
                    return (
                        containsFormalIntegral(node.lhs) ||
                        containsFormalIntegral(node.rhs)
                    );
                }

                if (node.type === 'Matrix') {
                    return node.rows.some(row =>
                        row.some(
                            containsFormalIntegral
                        )
                    );
                }

                if (node.type === 'Vector') {
                    return node.elements.some(
                        containsFormalIntegral
                    );
                }

                return false;
            };

            const hasFormalIntegral =
                containsFormalIntegral(yp);

            steps.push({
                strategy: 'Variation of Parameters',
                inputExpression: g,
                transformation:
                    hasFormalIntegral
                        ? 'Wronskian evaluated; unsupported antiderivatives preserved as formal symbolic integrals'
                        : 'Wronskian evaluated and integrals computed',
                resultingExpression: yp,
                verificationCondition: wCondition
            });

            return {
                yp,
                steps,
                wCondition
            };
        } catch (e) {
            return null;
        }
    }
}

