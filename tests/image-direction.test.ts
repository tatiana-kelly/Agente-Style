import { describe, expect, it } from 'vitest'
import { runImageDirector } from '@/agents/image-director'
import { escolherPose, escolherCenario, escolherEnquadramento, MODEL_PROFILE } from '@/agents/image-director/direction'
import { resolveStyleIntent } from '@/agents/style-agent'
import { item } from './helpers/wardrobe-benchmark'
import type { OutfitRole } from '@/schemas/outfit'
import type { WardrobeItem } from '@/schemas/wardrobe'

const peca = (role: OutfitRole, i: WardrobeItem) => ({ role, item: i })

const camisa = item({ id: 'c', name: 'Camisa branca', category: 'top', subcategory: 'camisa', color: 'branco', formality: 7 })
const calca = item({ id: 'b', name: 'Calça de alfaiataria preta', category: 'bottom', subcategory: 'calca', color: 'preto', formality: 7 })
const salto = item({ id: 's', name: 'Scarpin nude', category: 'shoes', subcategory: 'salto', color: 'nude', formality: 8 })
const tenis = item({ id: 't', name: 'Tênis branco', category: 'shoes', subcategory: 'tenis', color: 'branco', formality: 3 })
const blazer = item({ id: 'o', name: 'Blazer preto', category: 'outerwear', subcategory: 'blazer', color: 'preto', formality: 7 })
const colete = item({ id: 'v', name: 'Colete cru', category: 'outerwear', subcategory: 'colete', color: 'cru', formality: 6 })
const short = item({ id: 'sh', name: 'Short bege', category: 'bottom', subcategory: 'shorts', color: 'bege', formality: 5 })

const intent = (occasion: string) => resolveStyleIntent({ style: 'social', occasion })

describe('direção de imagem — pose escolhida pelo look', () => {
  it('alfaiataria com blazer e salto pede pose de alfaiataria', () => {
    const pose = escolherPose([peca('top', camisa), peca('bottom', calca), peca('shoes', salto), peca('outerwear', blazer)])
    expect(pose.nome).toBe('alfaiataria')
  })

  it('colete tem pose própria', () => {
    expect(escolherPose([peca('bottom', calca), peca('shoes', salto), peca('outerwear', colete)]).nome).toBe('colete')
  })

  it('short tem pose própria', () => {
    expect(escolherPose([peca('top', camisa), peca('bottom', short), peca('shoes', salto)]).nome).toBe('short')
  })

  it('tênis pede pose em movimento', () => {
    expect(escolherPose([peca('top', camisa), peca('bottom', calca), peca('shoes', tenis)]).nome).toBe('tênis')
  })

  it('cada ocasião tem cenário próprio', () => {
    const cenarios = ['trabalho', 'jantar', 'viagem', 'passeio', 'igreja'].map(escolherCenario)
    expect(new Set(cenarios).size).toBe(cenarios.length)
  })

  it('as três opções recebem enquadramentos diferentes', () => {
    const tres = [0, 1, 2].map(escolherEnquadramento)
    expect(new Set(tres).size).toBe(3)
  })
})

describe('os dois modos de imagem', () => {
  const look = [peca('top', camisa), peca('bottom', calca), peca('shoes', salto)]

  it('lookbook usa a modelo do app e não manda a foto dela', () => {
    const r = runImageDirector({ personPhotoUrl: 'https://exemplo/foto.jpg', items: look, intent: intent('trabalho'), modo: 'lookbook' })
    expect(r.references.some((ref) => ref.kind === 'person')).toBe(false)
    expect(r.prompt).toContain(MODEL_PROFILE.split('\n')[0])
  })

  it('try-on manda a foto dela e pede para preservar a identidade', () => {
    const r = runImageDirector({ personPhotoUrl: 'https://exemplo/foto.jpg', items: look, intent: intent('trabalho'), modo: 'try-on' })
    expect(r.references[0].kind).toBe('person')
    expect(r.prompt).toMatch(/Preserve exatamente rosto/)
  })

  it('o prompt proíbe pose de catálogo', () => {
    const r = runImageDirector({ personPhotoUrl: null, items: look, intent: intent('trabalho') })
    expect(r.negative_notes.join(' ')).toMatch(/catálogo/)
  })

  it('o prompt lista as peças do plano e manda não inventar', () => {
    const r = runImageDirector({ personPhotoUrl: null, items: look, intent: intent('trabalho') })
    expect(r.prompt).toContain('Camisa branca')
    expect(r.prompt).toContain('Scarpin nude')
    expect(r.negative_notes.join(' ')).toMatch(/adicionar qualquer peça/)
  })

  it('o calçado nunca sai do quadro', () => {
    const r = runImageDirector({ personPhotoUrl: null, items: look, intent: intent('jantar') })
    expect(r.prompt).toMatch(/calçado inteiro visível/)
  })
})
