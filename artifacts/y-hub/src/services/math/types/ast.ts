export type MathNodeType = 
  | 'Number' 
  | 'Symbol' 
  | 'Constant' 
  | 'Operator' 
  | 'Function' 
  | 'Parenthesis'
  | 'Equation'
  | 'Inequality'
  | 'Matrix'
  | 'Vector';

export interface BaseNode {
  type: MathNodeType;
}

export interface NumberNode extends BaseNode {
  type: 'Number';
  value: string; // Store as string to preserve precision/formatting
}

export interface SymbolNode extends BaseNode {
  type: 'Symbol';
  name: string;
}

export interface ConstantNode extends BaseNode {
  type: 'Constant';
  name: string; // e.g., 'pi', 'e'
}

export interface OperatorNode extends BaseNode {
  type: 'Operator';
  operator: '+' | '-' | '*' | '/' | '^' | '!' | '%' | 'implicit_multiply';
  args: CanonicalAST[];
}

export interface FunctionNode extends BaseNode {
  type: 'Function';
  name: string; // e.g., 'sin', 'log', 'sqrt'
  args: CanonicalAST[];
}

export interface ParenthesisNode extends BaseNode {
  type: 'Parenthesis';
  content: CanonicalAST;
}

export interface EquationNode extends BaseNode {
  type: 'Equation';
  lhs: CanonicalAST;
  rhs: CanonicalAST;
}

export interface InequalityNode extends BaseNode {
  type: 'Inequality';
  operator: '<' | '<=' | '>' | '>=' | '!=';
  lhs: CanonicalAST;
  rhs: CanonicalAST;
}

// Extensible Canonical Union
export interface MatrixNode extends BaseNode {
  type: 'Matrix';
  rows: CanonicalAST[][];
}

export interface VectorNode extends BaseNode {
  type: 'Vector';
  elements: CanonicalAST[];
}

export type CanonicalAST = 
  | NumberNode 
  | SymbolNode 
  | ConstantNode 
  | OperatorNode 
  | FunctionNode 
  | ParenthesisNode
  | EquationNode
  | InequalityNode
  | MatrixNode
  | VectorNode;

