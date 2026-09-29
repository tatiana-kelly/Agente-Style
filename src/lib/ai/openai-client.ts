import OpenAI from 'openai'
import { env } from '@/lib/env'

/**
 * Clientes da OpenAI com prazo para responder.
 *
 * Montar look passou a chamar a stylist e o crítico antes de devolver o
 * resultado. Sem prazo, um modelo lento — ou um id de modelo errado que caia
 * em retentativa — segura a requisição inteira até a função estourar, e a tela
 * fica carregando para sempre. Com prazo, a chamada falha rápido, o motor
 * assume, e a pessoa recebe o look: pior é ficar sem resposta.
 */

/**
 * Chamada de julgamento (escolher look, criticar, entender o pedido).
 * Sem retentativa: se não respondeu em segundos, o motor resolve melhor.
 */
export function clienteDeStyling(): OpenAI {
  return new OpenAI({
    apiKey: env.openaiKey,
    timeout: env.stylingTimeoutMs,
    maxRetries: 0,
  })
}

/**
 * Chamada de visão (classificar peça na foto, auditar imagem gerada).
 * Prazo maior: a pessoa está esperando por ISSO, não é acabamento.
 */
export function clienteDeVisao(): OpenAI {
  return new OpenAI({
    apiKey: env.openaiKey,
    timeout: env.visionTimeoutMs,
    maxRetries: 1,
  })
}
