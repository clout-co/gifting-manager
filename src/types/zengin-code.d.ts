declare module 'zengin-code' {
  type ZenginBranch = {
    name: string;
    kana: string;
    hira?: string;
    roma?: string;
  };

  type ZenginBank = {
    name: string;
    kana: string;
    hira?: string;
    roma?: string;
    branches?: Record<string, ZenginBranch>;
  };

  const zenginCode: Record<string, ZenginBank>;
  export default zenginCode;
}
