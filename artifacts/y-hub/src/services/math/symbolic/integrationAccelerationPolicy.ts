/** Heuristic for choosing a local or Python integration attempt. */
export function isHeavyIntegrationAst(ast: unknown): boolean {
      if (!ast) return false;
      const str = JSON.stringify(ast);
      if (str.includes('"exp"') || str.includes('"log"') || str.includes('"erf"') || str.includes('"sin"') || str.includes('"cos"')) {
          return true;
      }
      const divMatch = str.match(/"operator":"\/"/g);
      if (divMatch && divMatch.length > 1) {
          return true;
      }
      return false;

}
