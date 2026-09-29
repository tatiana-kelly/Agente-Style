import { clienteDeStyling } from '@/lib/ai/openai-client'
import { env, hasOpenAI } from '@/lib/env'
import { approxTokens, estimateTextCost } from '@/lib/ai/cost'
import type { OutfitProposal } from '@/agents/outfit-agent'
import { avaliarPaleta } from '@/lib/outfits/style-dna'

/**
 * Look Critic — a segunda opinião, antes de a cliente ver.
 *
 * O Stylist escolhe; o Critic olha o conjunto dos três e pergunta o que uma
 * amiga sincera perguntaria: as cores fecham? falta terceira peça? os três são
 * mesmo diferentes? É a última chance de trocar algo antes de a tela mostrar —
 * e antes de gastar com imagem.
 *
 * Ele reprova por índice; quem substitui é o chamador, com os candidatos que
 * sobraram. O crítico nunca inventa peça.
 */

export interface CriticaDoLook {
  /** Índice, dentro dos escolhidos, que deve sair. */
  indice: number
  problemas: string[]
  correcoes: string[]
}

export interface ResultadoDoCritic {
  aprovado: boolean
  criticas: CriticaDoLook[]
  custo: number
  fonte: 'openai' | 'regras'
  modelo: string
}

const SYSTEM = `Você revisa looks montados por uma stylist, antes de a cliente ver.
Não monte nem troque peça: aponte problema.

REPROVE um look quando:
- a paleta briga (duas cores fortes disputando, ou cor que não conversa com a base);
- o look está básico demais para a ocasião e uma terceira peça resolveria;
- o calçado está fora do registro do resto;
- ele é praticamente igual a outro da lista (mesma estrutura, só muda a blusa).

Responda SOMENTE JSON:
{"aprovado":boolean,"criticas":[{"indice":number,"problemas":["..."],"correcoes":["..."]}]}
Se estiver tudo bem, devolva {"aprovado":true,"criticas":[]}.
Seja exigente, mas não reprove look bom por gosto pessoal.`

/** Checagem sem IA: a paleta do conjunto, que é verificável em código. */
function criticaPorRegras(looks: OutfitProposal[]): CriticaDoLook[] {
  const criticas: CriticaDoLook[] = []

  looks.forEach((look, indice) => {
    const dna = avaliarPaleta(look.items.map((i) => ({ ...i, slotAffinity: 1 })))
    if (!dna.aprovada && dna.motivo) {
      criticas.push({ indice, problemas: [dna.motivo], correcoes: ['trocar a peça que traz a segunda cor forte'] })
    }
  })

  return criticas
}

export async function runLookCritic(looks: OutfitProposal[]): Promise<ResultadoDoCritic> {
  const porRegras = criticaPorRegras(looks)

  if (!hasOpenAI) {
    return { aprovado: porRegras.length === 0, criticas: porRegras, custo: 0, fonte: 'regras', modelo: 'regras' }
  }

  const userText = `Looks escolhidos:
${looks
  .map(
    (l, i) =>
      `${i}. ${l.items.map(({ role, item }) => `${role}: ${item.name} (${item.color}, formalidade ${item.formality})`).join('; ')}`,
  )
  .join('\n')}

Revise.`

  try {
    const client = clienteDeStyling()
    const completion = await client.chat.completions.create({
      model: env.textModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userText },
      ],
    })

    const bruto = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as {
      aprovado?: boolean
      criticas?: Array<{ indice?: unknown; problemas?: unknown; correcoes?: unknown }>
    }

    const criticas: CriticaDoLook[] = (bruto.criticas ?? [])
      .map((c) => ({
        indice: Number(c.indice),
        problemas: Array.isArray(c.problemas) ? c.problemas.map(String) : [],
        correcoes: Array.isArray(c.correcoes) ? c.correcoes.map(String) : [],
      }))
      .filter((c) => Number.isInteger(c.indice) && c.indice >= 0 && c.indice < looks.length)

    const usage = completion.usage
    const custo = estimateTextCost(
      usage?.prompt_tokens ?? approxTokens(SYSTEM + userText),
      usage?.completion_tokens ?? 200,
    )

    // As duas opiniões somam: a regra de paleta é verificável e não depende de
    // a IA ter reparado nela.
    const todas = [...criticas]
    for (const r of porRegras) {
      if (!todas.some((c) => c.indice === r.indice)) todas.push(r)
    }

    return {
      aprovado: todas.length === 0 && (bruto.aprovado ?? true),
      criticas: todas,
      custo,
      fonte: 'openai',
      modelo: env.textModel,
    }
  } catch {
    return { aprovado: porRegras.length === 0, criticas: porRegras, custo: 0, fonte: 'regras', modelo: 'regras' }
  }
}
