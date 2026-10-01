import type { WardrobeItem } from '@/schemas/wardrobe'
import { normalizeColor } from '@/lib/wardrobe/colors'

/**
 * Interpreta um ajuste escrito à mão sobre um look já montado:
 * "inclua sapato vermelho e cinto vermelho", "troca a camisa pela blusa",
 * "tira a bolsa", "põe um casaco".
 *
 * Determinístico primeiro (§31): o vocabulário é o do próprio guarda-roupa, e
 * comparar palavra com peça é busca, não raciocínio. A IA entra só quando nada
 * casou — aí sim é ambiguidade de verdade.
 */

export interface Refinement {
  /** Peças que DEVEM entrar. */
  includeIds: string[]
  /** Peças que NÃO podem entrar. */
  excludeIds: string[]
  /** O que foi entendido, para mostrar de volta à pessoa. */
  notes: string[]
  /** Nada casou: vale tentar a IA. */
  unresolved: boolean
}

const VERBOS_INCLUIR = /\b(inclu[ai]|adiciona?r?|coloca?r?|p[oõ]e|põe|bota?r?|acrescenta?r?|usa?r?|quero|com)\b/i
const VERBOS_REMOVER = /\b(tira?r?|remove?r?|retira?r?|sem|n[aã]o quero|tire)\b/i
const VERBO_TROCAR = /\b(troca?r?|substitu[ia]r?|muda?r?)\b/i

/** Palavras que identificam uma peça, mapeadas para subcategorias do banco. */
const TERMOS: Array<{ re: RegExp; subs: string[] }> = [
  { re: /\bsapatos?\b|\bscarpins?\b/i, subs: ['sapato', 'salto', 'sapatilha'] },
  { re: /\bsalto\b/i, subs: ['salto'] },
  { re: /\bsapatilhas?\b/i, subs: ['sapatilha'] },
  { re: /\bt[eê]nis\b/i, subs: ['tenis', 'tenis-corrida', 'tenis-tenis'] },
  { re: /\bbotas?\b/i, subs: ['bota'] },
  { re: /\bsand[aá]lias?\b/i, subs: ['sandalia'] },
  { re: /\bcintos?\b/i, subs: ['cinto'] },
  { re: /\bbrincos?\b/i, subs: ['brinco', 'joia', 'bijuteria'] },
  { re: /\bcolar(es)?\b/i, subs: ['colar', 'joia', 'bijuteria'] },
  { re: /\ban[eé]is\b|\banel\b/i, subs: ['anel', 'joia', 'bijuteria'] },
  { re: /\bpulseiras?\b/i, subs: ['pulseira', 'joia'] },
  { re: /\bj[oó]ias?\b|\bbijuterias?\b/i, subs: ['joia', 'bijuteria', 'colar', 'brinco'] },
  { re: /\brel[oó]gios?\b/i, subs: ['relogio'] },
  { re: /\b[oó]culos\b/i, subs: ['oculos'] },
  { re: /\bbon[eé]s?\b/i, subs: ['bone'] },
  { re: /\bviseiras?\b/i, subs: ['viseira'] },
  { re: /\ble[nç]os?\b|\blenço\b/i, subs: ['lenco'] },
  { re: /\bbolsas?\b/i, subs: ['bolsa'] },
  { re: /\bmochilas?\b/i, subs: ['mochila'] },
  { re: /\bcasacos?\b|\bsobretudos?\b/i, subs: ['casaco'] },
  { re: /\bblazers?\b/i, subs: ['blazer'] },
  { re: /\bjaquetas?\b/i, subs: ['jaqueta'] },
  { re: /\bcardig[aã]s?\b|\bcardigans?\b/i, subs: ['cardiga'] },
  { re: /\bcamisas?\b/i, subs: ['camisa'] },
  { re: /\bcamisetas?\b/i, subs: ['camiseta'] },
  { re: /\bblusas?\b/i, subs: ['blusa'] },
  { re: /\bsu[eé]ter(es)?\b|\btric[oô]s?\b/i, subs: ['sueter'] },
  { re: /\bregatas?\b/i, subs: ['regata'] },
  { re: /\bcal[cç]as?\b/i, subs: ['calca'] },
  { re: /\bsaias?\b/i, subs: ['saia'] },
  { re: /\bshorts?\b|\bbermudas?\b/i, subs: ['shorts', 'bermuda'] },
  { re: /\bleggings?\b/i, subs: ['legging'] },
  { re: /\bvestidos?\b/i, subs: ['vestido'] },
]

/** Estampas como a pessoa fala, mapeadas para o que o banco guarda. */
const ESTAMPAS: Array<{ re: RegExp; pattern: string }> = [
  { re: /\blistrad[ao]s?\b|\blistras?\b/i, pattern: 'listrado' },
  { re: /\bxadrez\b/i, pattern: 'xadrez' },
  { re: /\bflora(l|is)\b/i, pattern: 'floral' },
  { re: /\bpo[aá]\b|\bbolinhas?\b/i, pattern: 'poa' },
  { re: /\banimal[- ]?print\b|\bon[cç]a\b/i, pattern: 'animal-print' },
  { re: /\bestampad[ao]s?\b/i, pattern: 'estampado' },
  { re: /\blis[ao]s?\b/i, pattern: 'liso' },
]

const CORES = [
  'preto', 'preta', 'branco', 'branca', 'vermelho', 'vermelha', 'azul', 'marinho',
  'verde', 'amarelo', 'amarela', 'rosa', 'roxo', 'roxa', 'cinza', 'bege', 'nude',
  'marrom', 'vinho', 'bordo', 'oliva', 'caramelo', 'creme', 'jeans', 'dourado', 'prata',
]

/** Divide a frase em pedidos independentes ("inclua X e tira Y"). */
function segmentar(texto: string): string[] {
  return texto
    // Sem \b depois do prefixo: ele exigiria limite de palavra logo após "tir",
    // e "tira" continua com letra — a frase nunca era separada.
    .split(/[.;,]|\be\b(?=\s*(?:inclu|adicion|coloc|p[oõ]e|tir|remov|retir|troc|sem))/i)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Peças do guarda-roupa que casam com um trecho de texto. */
function casar(trecho: string, items: WardrobeItem[]): WardrobeItem[] {
  const termo = TERMOS.find((t) => t.re.test(trecho))
  const corPedida = CORES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(trecho))

  let candidatos = items
  if (termo) candidatos = candidatos.filter((i) => termo.subs.includes(i.subcategory))
  if (corPedida) {
    const alvo = normalizeColor(corPedida.replace(/a$/, 'o'))
    candidatos = candidatos.filter((i) => {
      const c = normalizeColor(i.color)
      return c === alvo || c.startsWith(alvo) || alvo.startsWith(c)
    })
  }

  // Sem termo nem cor não dá para afirmar nada: melhor não adivinhar.
  if (!termo && !corPedida) return []
  return candidatos
}

export function parseRefinement(instrucao: string, items: WardrobeItem[]): Refinement {
  const texto = (instrucao ?? '').trim()
  const includeIds: string[] = []
  const excludeIds: string[] = []
  const notes: string[] = []

  if (!texto) return { includeIds, excludeIds, notes, unresolved: false }

  for (const trecho of segmentar(texto)) {
    // "troca A por B" — o que vem antes do "por" sai, o que vem depois entra.
    // "pela"/"pelo" são tão comuns quanto "por" em fala natural.
    const troca = /(.+?)\b(?:por|pel[oa])\b(.+)/i.exec(trecho)
    if (VERBO_TROCAR.test(trecho) && troca) {
      const sai = casar(troca[1], items)
      const entra = casar(troca[2], items)
      if (sai.length > 0) {
        excludeIds.push(...sai.map((i) => i.id))
        notes.push(`Tirei ${sai[0].name.toLowerCase()}.`)
      }
      if (entra.length > 0) {
        includeIds.push(entra[0].id)
        notes.push(`Coloquei ${entra[0].name.toLowerCase()}.`)
      }
      continue
    }

    const remover = VERBOS_REMOVER.test(trecho)
    const casados = casar(trecho, items)
    if (casados.length === 0) continue

    if (remover) {
      excludeIds.push(...casados.map((i) => i.id))
      notes.push(`Tirei ${casados[0].name.toLowerCase()}.`)
    } else if (VERBOS_INCLUIR.test(trecho) || !remover) {
      includeIds.push(casados[0].id)
      notes.push(`Incluí ${casados[0].name.toLowerCase()}.`)
    }
  }

  const unresolved = includeIds.length === 0 && excludeIds.length === 0
  return {
    includeIds: [...new Set(includeIds)],
    excludeIds: [...new Set(excludeIds)],
    notes,
    unresolved,
  }
}

/**
 * O que o pedido menciona mas o guarda-roupa não tem.
 * É isto que permite dizer "você não tem sapato vermelho cadastrado" em vez de
 * ignorar o pedido em silêncio.
 */
export function faltantes(instrucao: string, items: WardrobeItem[]): string[] {
  const faltas: string[] = []

  // Quebra também em "e" solto, para listar item a item em vez de devolver a
  // frase inteira: "sapato vermelho; cinto vermelho" é acionável, a frase não.
  const pedacos = segmentar(instrucao ?? '').flatMap((t) => t.split(/\be\b/i))

  for (const bruto of pedacos) {
    const trecho = bruto.trim()
    if (!trecho || VERBOS_REMOVER.test(trecho)) continue
    const termo = TERMOS.find((t) => t.re.test(trecho))
    if (!termo) continue
    if (casar(trecho, items).length > 0) continue

    const limpo = trecho
      .replace(VERBOS_INCLUIR, '')
      .replace(/^\s*(um|uma|o|a|os|as)\s+/i, '')
      .trim()
    if (limpo) faltas.push(limpo)
  }
  return [...new Set(faltas)]
}

/**
 * Exigência de peça tirada do texto livre.
 *
 * "Calça preta" na caixa de pedido não é ajuste de um look existente — é a
 * condição do look inteiro: TODAS as opções precisam ter uma calça preta.
 * Diferente de travar um id (que repetiria a mesma calça nas três), a exigência
 * restringe o PAPEL: qualquer calça preta do armário serve, e as três opções
 * ainda podem variar entre elas.
 */
export interface Exigencia {
  role: WardrobeItem['category']
  subcategories: string[]
  /** Cor normalizada, quando foi dita. */
  color?: string
  /** Estampa, quando foi dita ("camisa listrada"). */
  pattern?: string
  /** Como a pessoa escreveu, para devolver na explicação. */
  texto: string
}

export function exigenciasDoTexto(texto: string, items: WardrobeItem[]): Exigencia[] {
  const limpo = (texto ?? '').trim()
  if (!limpo) return []

  const exigencias: Exigencia[] = []
  for (const trecho of segmentar(limpo)) {
    // Negação é exclusão, não exigência — isso o parseRefinement já trata.
    if (VERBOS_REMOVER.test(trecho) || VERBO_TROCAR.test(trecho)) continue

    const termo = TERMOS.find((t) => t.re.test(trecho))
    if (!termo) continue

    const corPedida = CORES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(trecho))
    const color = corPedida ? normalizeColor(corPedida.replace(/a$/, 'o')) : undefined
    // "camisa listrada": a estampa é parte do pedido tanto quanto a cor.
    const pattern = ESTAMPAS.find((e) => e.re.test(trecho))?.pattern
    const casados = casar(trecho, items).filter((i) => !pattern || i.pattern === pattern)
    // Exigir o que não existe só deixaria a pessoa sem look.
    if (casados.length === 0) continue

    exigencias.push({
      role: casados[0].category,
      subcategories: termo.subs,
      color,
      pattern,
      texto: trecho,
    })
  }
  return exigencias
}
