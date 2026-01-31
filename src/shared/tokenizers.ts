export interface ITokenizer {
  countTokens(provider: string, model: string, text: string): number
  estimateTokens(provider: string, model: string, text: string): number
}
