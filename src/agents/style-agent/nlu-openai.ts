import { clienteDeStyling } from '@/lib/ai/openai-client'
import { env, hasOpenAI } from '@/lib/env'
import { approxTokens, estimateTextCost } from '@/lib/ai/cost'
import { OCCASIONS } from '@/schemas/wardrobe'
import { STYLES } from '@/schemas/outfit'

/**
 * Entender o pedido escrito, em vez de fazer a pessoa preencher formulário.
 *
 * "Vou jantar em Campos do Jordão. Está frio. Quero algo elegante e
 * confortável." tem ocasião, clima, formalidade e conforto — tudo o que a tela
 * perguntaria em quatro cliques. A regex que existia acerta o caso simples;
 * esta camada entende o resto, e cai de volta na regex quando não há chave ou
 * a chamada falha.
 */

export interface PedidoEntendido {
  occasion?: string
  clima?: 'calor' | 'ameno' | 'frio'
  style?: string
  /** Faixa de formalidade pedida em palavras ("elegante", "sem formalidade"). */
  formalidade?: [number, number]
  /** Pediu conforto explicitamente. */
  conforto?: boolean
  /** O que ela citou e o sistema deve respeitar ("quero usar minha calça preta"). */
  pecasCitadas: string[]
  notas: string[]
  custo: number
}

const SYSTEM = `Você interpreta o pedido de uma cliente para uma personal stylist.
Extraia só o que estiver dito ou for consequência direta do que ela disse.
Não invente ocasião nem clima: campo sem informação fica fora do JSON.

Responda SOMENTE JSON:
{"occasion":"...","clima":"calor|ameno|frio","style":"...","formalidade":[min,max],
 "conforto":boolean,"pecas_citadas":["..."],"notas":["..."]}

occasion, um destes: OCASIOES
style, um destes: ESTILOS
formalidade: 0 pijama, 5 dia a dia arrumado, 8 social, 10 black tie.
"Campos do Jordão no inverno" implica clima frio. "Praia" implica calor.
"notas": no máximo duas frases curtas sobre o que você entendeu, na segunda pessoa.`

export async function interpretarPedido(texto: string): Promise<PedidoEntendido> {
  const vazio: PedidoEntendido = { pecasCitadas: [], notas: [], custo: 0 }
  if (!hasOpenAI || texto.trim().length < 8) return vazio

  const system = SYSTEM.replace('OCASIOES', OCCASIONS.join(', ')).replace('ESTILOS', STYLES.join(', '))

  try {
    const client = clienteDeStyling()
    const completion = await client.chat.completions.create({
      model: env.textModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: texto },
      ],
    })

    const bruto = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Record<string, unknown>
    const usage = completion.usage
    const custo = estimateTextCost(
      usage?.prompt_tokens ?? approxTokens(system + texto),
      usage?.completion_tokens ?? 120,
    )

    const occasion = typeof bruto.occasion === 'string' && OCCASIONS.includes(bruto.occasion as never)
      ? bruto.occasion
      : undefined
    const style = typeof bruto.style === 'string' && STYLES.includes(bruto.style as never)
      ? bruto.style
      : undefined
    const clima = ['calor', 'ameno', 'frio'].includes(String(bruto.clima))
      ? (bruto.clima as 'calor' | 'ameno' | 'frio')
      : undefined

    const faixa = Array.isArray(bruto.formalidade) ? bruto.formalidade.map(Number) : []
    const formalidade =
      faixa.length === 2 && faixa.every((n) => Number.isFinite(n) && n >= 0 && n <= 10)
        ? ([Math.min(faixa[0], faixa[1]), Math.max(faixa[0], faixa[1])] as [number, number])
        : undefined

    return {
      occasion,
      clima,
      style,
      formalidade,
      conforto: bruto.conforto === true,
      pecasCitadas: Array.isArray(bruto.pecas_citadas) ? bruto.pecas_citadas.map(String) : [],
      notas: Array.isArray(bruto.notas) ? bruto.notas.map(String).slice(0, 2) : [],
      custo,
    }
  } catch {
    // Sem interpretação, a regex do style-agent continua respondendo.
    return vazio
  }
}
