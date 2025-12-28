export class ParserException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParserException';
  }
}

export class Parser {
  private input: string;
  private pos: number = -1;
  private ch: number = -1;

  constructor(input: string) {
    this.input = input;
  }

  private nextChar(): void {
    this.pos++;
    if (this.pos < this.input.length) {
      this.ch = this.input.charCodeAt(this.pos);
    } else {
      this.ch = -1;
    }
  }

  private eat(charToEat: number): boolean {
    while (this.ch === 32) this.nextChar(); // Skip whitespace (32 is space)
    if (this.ch === charToEat) {
      this.nextChar();
      return true;
    }
    return false;
  }
  
  // Helper to peek without consuming if matches
  private skipWhitespace(): void {
      while(this.ch === 32) this.nextChar();
  }

  public parse(): number {
    this.nextChar();
    const x = this.parseExpression();
    if (this.pos < this.input.length) {
      throw new ParserException(`Unexpected: ${String.fromCharCode(this.ch)}`);
    }
    return x;
  }

  private parseExpression(): number {
    let x = this.parseTerm();
    while (true) {
      if (this.eat(43)) { // +
        x += this.parseTerm();
      } else if (this.eat(45)) { // -
        x -= this.parseTerm();
      } else {
        return x;
      }
    }
  }

  private parseTerm(): number {
    let x = this.parseFactor();
    while (true) {
      if (this.eat(42)) { // *
        x *= this.parseFactor();
      } else if (this.eat(47)) { // /
        const divisor = this.parseFactor();
        if (divisor === 0) throw new ParserException("Div by Zero");
        x /= divisor;
      } else if (this.eat(37)) { // %
        const divisor = this.parseFactor();
        
        // Strict logic: Int Mod Only
        if (x % 1 !== 0 || divisor % 1 !== 0) throw new ParserException("Int Mod Only");
        if (divisor === 0) throw new ParserException("Div by Zero");
        
        x %= divisor;

        // Strict logic: Ambiguous Chained Modulo
        // Check if next token is %
        this.skipWhitespace();
        if (this.ch === 37) { // 37 is %
            throw new ParserException("Ambiguous");
        }
      } else {
        return x;
      }
    }
  }

  private parseFactor(): number {
    if (this.eat(43)) throw new ParserException("Unexpected: +"); // 5+ is bad, +5 is bad if treated as unary here without primary
    if (this.eat(45)) return -this.parseFactor(); // Unary minus

    let x: number;
    const startPos = this.pos;

    if (this.eat(40)) { // (
      x = this.parseExpression();
      if (!this.eat(41)) throw new ParserException("Missing ')'"); // )
    } else if ((this.ch >= 48 && this.ch <= 57) || this.ch === 46) { // 0-9 or .
      while ((this.ch >= 48 && this.ch <= 57) || this.ch === 46) {
        this.nextChar();
      }
      const sub = this.input.substring(startPos, this.pos);
      // Strict logic: Invalid Number (standalone decimal)
      if (sub === '.') throw new ParserException("Invalid Number");
      x = parseFloat(sub);
    } else {
      // Strict logic: Incomplete or Unexpected
      if (this.ch === -1) throw new ParserException("Incomplete");
      throw new ParserException(`Unexpected: ${String.fromCharCode(this.ch)}`);
    }
    return x;
  }
}