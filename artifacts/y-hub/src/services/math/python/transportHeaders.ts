export type MathHeaderProvider = () => Promise<Record<string,string>>;
let provider: MathHeaderProvider = async()=>({});
/** Host supplies transport credentials; math never imports session/storage modules. */
export function configureMathHeaders(next:MathHeaderProvider){provider=next;}
export const mathHeaders=()=>provider();
