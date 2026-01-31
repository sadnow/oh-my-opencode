import { ITokenizer } from './tokenizers'
import Tokenizer, { models } from 'ai-tokenizer'
import * as encoding from 'ai-tokenizer/encoding'

export class TokenizerAdapter implements ITokenizer {
  private tokenizers: Map<string, Tokenizer> = new Map()

  private getTokenizer(encodingName: string): Tokenizer {
    if (!this.tokenizers.has(encodingName)) {
      const data = (encoding as any)[encodingName]
      if (data) {
        this.tokenizers.set(encodingName, new Tokenizer(data))
      } else {
        // Fallback to o200k_base if encoding not found
        if (!this.tokenizers.has('o200k_base')) {
          this.tokenizers.set('o200k_base', new Tokenizer(encoding.o200k_base))
        }
        return this.tokenizers.get('o200k_base')!
      }
    }
    return this.tokenizers.get(encodingName)!
  }

  countTokens(provider: string, model: string, text: string): number {
    try {
      const modelKey = `${provider}/${model}` as keyof typeof models
      const modelData = models[modelKey]
      
      const tokenizer = modelData 
        ? this.getTokenizer(modelData.encoding) 
        : this.getTokenizer('o200k_base')

      return tokenizer.count(text)
    } catch (error) {
      return this.estimateTokens(provider, model, text)
    }
  }

  estimateTokens(provider: string, model: string, text: string): number {
    return Math.ceil(text.length / 4)
  }
}
