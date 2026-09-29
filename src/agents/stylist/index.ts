import { clienteDeStyling } from '@/lib/ai/openai-client'
import { env, hasOpenAI } from '@/lib/env'
import { estimateTextCost, approxTokens } from '@/lib/ai/cost'
import type { WardrobeItem } from '@/schemas/wardrobe'
import type { StyleProfile } from '@/schemas/style-profile'
import type { OutfitProposal } from '@/agents/outfit-agent'
import { DNA_DAS_REFERENCIAS } from './referencias'

/**
 * Stylist — a OpenAI escolhendo entre os candidatos que o motor montou.
 *
 * A divisão é deliberada: o código garante o que é verificável (a peça existe,
 * a cor fecha, o clima bate, a fórmula é das referências dela) e a OpenAI faz
 * o que código não faz bem — dizer qual das combinações válidas é a mais
 * bonita, e por quê. Ela NÃO inventa peça: escolhe por índice entre os
 * candidatos recebidos, e qualquer índice inválido é descartado aqui.
 */

export interface StylistInput {
  /** Pedido em palavras da pessoa, quando houver. */
  pedido?: string
  ocasiao: string
  clima: string
  /** Candidatos já filtrados e aprovados pelo motor. */
  candidatos: OutfitProposal[]
  perfil?: StyleProfile | null
  /** Só para a IA descrever cor e peça com precisão. */
  acervo: WardrobeItem[]
  quantidade: number
}

export interface EscolhaDoStylist {
  /** Índices escolhidos, na ordem em que devem aparecer. */
  escolhidos: number[]
  /** Uma frase por look escolhido, na voz de quem escolheu. */
  explicacoes: string[]
  /** Etiqueta curta por look: "Casual chic", "Mais elegante"… */
  etiquetas: string[]
  custo: number
  fonte: 'openai' | 'motor'
  /** Modelo que respondeu — para conferir de fora qual está no ar. */
  modelo: string
  aviso?: string
}

const SYSTEM = `Você é personal stylist. Recebe looks JÁ MONTADOS a partir do guarda-roupa real
de uma cliente e escolhe os melhores. Você NÃO inventa peça e NÃO troca peça: só escolhe entre
os looks numerados que recebeu.

CRITÉRIOS, nesta ordem:
1. Harmonia de cor do conjunto (base neutra, no máximo um ponto de cor, tom sobre tom vale muito).
2. Styling: terceira peça quando melhora, proporção, calçado coerente com o registro.
3. Aderência ao estilo da cliente e ao pedido dela.
4. Adequação ao clima e à ocasião.
5. Diversidade real entre os escolhidos: estrutura diferente, não a mesma base com outra blusa.

Responda SOMENTE JSON:
{"escolhidos":[indices],"etiquetas":["Casual chic",...],"explicacoes":["...",...]}

"explicacoes": uma frase por look, falando como stylist para a cliente — o que o look faz por
ela e por que aquela combinação funciona. Cite as peças pelo nome. Nada de jargão de sistema,
nada de "score" ou "fórmula".
"etiquetas": duas ou três palavras que diferenciem os looks entre si.`

function descreverLook(p: OutfitProposal, indice: number): string {
  const pecas = p.items
    .map(({ role, item }) => `${role}: ${item.name} (${item.color}, formalidade ${item.formality})`)
    .join('; ')
  return `${indice}. [${p.formulaName}] ${pecas}`
}

function perfilEmTexto(perfil?: StyleProfile | null): string {
  if (!perfil) return 'Sem perfil declarado.'
  const partes = [
    `estilo principal: ${perfil.primary_style}`,
    perfil.secondary_styles.length ? `também gosta de: ${perfil.secondary_styles.join(', ')}` : '',
    `trabalho: ${perfil.work_style}`,
    perfil.preferred_colors.length ? `cores preferidas: ${perfil.preferred_colors.join(', ')}` : '',
    perfil.avoid_colors.length ? `evita: ${perfil.avoid_colors.join(', ')}` : '',
    perfil.preferred_shoes.length ? `calçados preferidos: ${perfil.preferred_shoes.join(', ')}` : '',
  ].filter(Boolean)
  return partes.join(' · ')
}

/** Escolha do motor, usada quando não há chave ou a IA falha. */
function escolhaDoMotor(input: StylistInput, aviso?: string): EscolhaDoStylist {
  const n = Math.min(input.quantidade, input.candidatos.length)
  return {
    escolhidos: Array.from({ length: n }, (_, i) => i),
    explicacoes: input.candidatos.slice(0, n).map((c) => c.explanation),
    etiquetas: input.candidatos.slice(0, n).map((c) => c.etiqueta),
    custo: 0,
    fonte: 'motor',
    modelo: 'motor',
    aviso,
  }
}

export async function runStylist(input: StylistInput): Promise<EscolhaDoStylist> {
  if (!hasOpenAI || input.candidatos.length <= input.quantidade) {
    // Com candidatos de menos não há o que escolher — e pagar por isso seria
    // gastar para confirmar o óbvio.
    return escolhaDoMotor(input)
  }

  const userText = `PEDIDO DA CLIENTE: ${input.pedido?.trim() || '(não escreveu nada; use ocasião e clima)'}
OCASIÃO: ${input.ocasiao} · CLIMA: ${input.clima}
PERFIL: ${perfilEmTexto(input.perfil)}

O QUE ELA CONSIDERA BONITO (extraído das referências que ela escolheu):
${DNA_DAS_REFERENCIAS}

LOOKS DISPONÍVEIS:
${input.candidatos.map(descreverLook).join('\n')}

Escolha ${input.quantidade} looks, do melhor para o menos bom.`

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
      escolhidos?: unknown
      etiquetas?: unknown
      explicacoes?: unknown
    }

    // Índice inválido é peça inventada com outro nome: descarta.
    const escolhidos = (Array.isArray(bruto.escolhidos) ? bruto.escolhidos : [])
      .map((i) => Number(i))
      .filter((i) => Number.isInteger(i) && i >= 0 && i < input.candidatos.length)
      .filter((i, pos, arr) => arr.indexOf(i) === pos)
      .slice(0, input.quantidade)

    if (escolhidos.length === 0) {
      return escolhaDoMotor(input, 'A stylist não devolveu escolha válida; usei a ordem do motor.')
    }

    const usage = completion.usage
    const custo = estimateTextCost(
      usage?.prompt_tokens ?? approxTokens(SYSTEM + userText),
      usage?.completion_tokens ?? 300,
    )

    const textos = Array.isArray(bruto.explicacoes) ? bruto.explicacoes.map(String) : []
    const etiquetas = Array.isArray(bruto.etiquetas) ? bruto.etiquetas.map(String) : []

    return {
      escolhidos,
      // Sem frase da IA, a explicação do motor continua valendo: ela é
      // derivada do motivo real da escolha, nunca inventada.
      explicacoes: escolhidos.map((indice, pos) => textos[pos] || input.candidatos[indice].explanation),
      etiquetas: escolhidos.map((indice, pos) => etiquetas[pos] || input.candidatos[indice].etiqueta),
      custo,
      fonte: 'openai',
      modelo: env.textModel,
    }
  } catch (error) {
    return escolhaDoMotor(
      input,
      error instanceof Error ? `Stylist indisponível (${error.message}); usei a ordem do motor.` : undefined,
    )
  }
}
