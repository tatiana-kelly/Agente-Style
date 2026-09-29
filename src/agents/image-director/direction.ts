import type { WardrobeItem } from '@/schemas/wardrobe'
import type { OutfitRole } from '@/schemas/outfit'

/**
 * Direção de moda da imagem: quem é a modelo, como ela posa, onde está.
 *
 * O gerador entregava catálogo de provador — braços ao lado do corpo, mesma
 * pose em tudo, fundo sempre igual. O que as referências dela mostram é outra
 * coisa: uma mulher que sabe se vestir, em movimento, num cenário que combina
 * com o compromisso. Esta é a diferença entre "IA vestindo alguém" e "uma
 * estilista montou isto para mim".
 */

export interface PecaDoLook {
  item: WardrobeItem
  role: OutfitRole
}

/**
 * Perfil fixo da modelo do lookbook.
 *
 * Fixo de propósito: sem ele, cada geração inventava uma mulher diferente e as
 * três opções pareciam três pessoas. Pessoa fictícia — não descreve, não
 * reproduz e não se inspira no rosto de ninguém real.
 */
export const MODEL_PROFILE = `MODELO (pessoa fictícia, não reproduza nenhuma pessoa real):
mulher adulta, por volta de 30 anos, aparência sofisticada e contemporânea.
Corpo atlético e magro, silhueta alongada e proporções realistas.
Cabelo castanho comprido, com leve ondulação e aspecto bem cuidado.
Pele natural, com textura real — nada de acabamento plástico.
Maquiagem elegante e discreta. Presença de editorial de moda.
A MESMA modelo em todas as imagens desta sessão.`

/** Pose escolhida pelo look, não sorteada: cada composição pede uma atitude. */
interface Pose {
  nome: string
  descricao: string
}

const POSES: Record<string, Pose> = {
  alfaiataria: {
    nome: 'alfaiataria',
    descricao:
      'Corpo em três quartos, ombros abertos, uma mão no bolso da calça, queixo levemente erguido. Postura de quem manda na sala.',
  },
  colete: {
    nome: 'colete',
    descricao:
      'Postura fashion de editorial, corpo levemente inclinado, uma mão no bolso, a outra solta com naturalidade.',
  },
  casaquinho: {
    nome: 'casaquinho',
    descricao:
      'Caminhando em direção à câmera, uma mão ajustando a lapela do casaquinho, movimento natural no tecido.',
  },
  jeansSalto: {
    nome: 'jeans com salto',
    descricao:
      'Corpo em três quartos, uma perna à frente, postura alongada, peso em um pé só, atitude elegante.',
  },
  tenis: {
    nome: 'tênis',
    descricao:
      'Postura descontraída, em movimento como quem está saindo, uma mão no bolso, passo curto à frente.',
  },
  short: {
    nome: 'short',
    descricao:
      'Uma perna discretamente à frente, postura alongada, braços naturais, leve torção do tronco.',
  },
  vestido: {
    nome: 'vestido',
    descricao:
      'De frente, peso em um pé, uma mão na cintura, silhueta alongada, movimento leve na barra do vestido.',
  },
  base: {
    nome: 'base',
    descricao:
      'Corpo levemente de lado, olhar para a câmera, uma mão no bolso, postura relaxada e confiante.',
  },
}

export function escolherPose(pecas: PecaDoLook[]): Pose {
  const sub = (role: OutfitRole) => pecas.find((p) => p.role === role)?.item.subcategory
  const terceira = sub('outerwear')
  const baixo = sub('bottom')
  const calcado = sub('shoes')

  if (sub('dress')) return POSES.vestido
  if (terceira === 'colete') return POSES.colete
  if (baixo === 'shorts' || baixo === 'bermuda') return POSES.short
  if (terceira === 'cardiga') return POSES.casaquinho
  if (terceira === 'blazer' && baixo === 'calca' && calcado === 'salto') return POSES.alfaiataria
  if (calcado === 'salto') return POSES.jeansSalto
  if (calcado && calcado.startsWith('tenis')) return POSES.tenis
  return POSES.base
}

/** O cenário acompanha o compromisso — e nunca rouba a cena da roupa. */
const CENARIOS: Record<string, string> = {
  trabalho: 'lobby de escritório moderno, concreto claro e vidro, luz natural lateral',
  reuniao: 'corredor de escritório sofisticado, linhas retas, luz difusa',
  jantar: 'entrada de restaurante elegante à noite, luz quente e discreta ao fundo',
  festa: 'ambiente noturno elegante, fundo escuro e limpo, luz suave no rosto',
  evento: 'salão claro de arquitetura clássica, colunas desfocadas ao fundo',
  almoco: 'calçada de café sofisticado, parede clara, luz natural de fim de manhã',
  passeio: 'rua urbana elegante, fachada clara desfocada, luz natural',
  'dia-comum': 'rua tranquila de bairro, parede lisa clara, luz natural',
  viagem: 'saguão claro de hotel ou aeroporto, linhas limpas, luz natural ampla',
  igreja: 'arquitetura sóbria e clara, ambiente discreto, luz natural suave',
  'partida-tenis': 'área externa de clube esportivo, fundo limpo',
  treino: 'área externa de clube, piso claro, fundo limpo',
}

export function escolherCenario(ocasiao: string): string {
  return CENARIOS[ocasiao] ?? 'fachada clara de arquitetura moderna, luz natural suave'
}

/**
 * Enquadramento variado entre as opções: as três não podem ser a mesma foto
 * com roupa diferente. O look inteiro continua visível em todos.
 */
const ENQUADRAMENTOS = [
  'Corpo inteiro, de frente, modelo levemente à esquerda do quadro.',
  'Corpo inteiro, três quartos, modelo centralizada, um passo em movimento.',
  'Corpo inteiro, leve ângulo lateral, modelo à direita do quadro, olhar fora da câmera.',
]

export function escolherEnquadramento(variacao: number): string {
  return ENQUADRAMENTOS[Math.abs(variacao) % ENQUADRAMENTOS.length]
}

/** Expressão sem "cara de documento" nem sorriso de propaganda. */
const EXPRESSOES = [
  'Expressão confiante, olhar direto, sem sorriso forçado.',
  'Leve sorriso espontâneo, olhar natural.',
  'Expressão serena e sofisticada, olhar levemente fora da câmera.',
]

export function escolherExpressao(variacao: number): string {
  return EXPRESSOES[Math.abs(variacao) % EXPRESSOES.length]
}
