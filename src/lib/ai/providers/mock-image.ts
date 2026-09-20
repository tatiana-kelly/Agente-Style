import type { ImageGenerationInput, ImageGenerationResult, ImageProvider } from '@/schemas/image'

/**
 * Provider determinístico usado quando não há OPENAI_API_KEY.
 * Existe para que o fluxo completo (e os testes) rodem sem custo e sem rede.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = 'mock'

  async generateLook(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const started = Date.now()
    const svg = renderFlatLay(input)
    return {
      success: true,
      image_base64: Buffer.from(svg, 'utf8').toString('base64'),
      model: 'mock-flat-lay-svg',
      provider: this.name,
      estimated_cost: 0,
      latency_ms: Date.now() - started,
    }
  }
}

const SWATCHES: Record<string, string> = {
  preto: '#2b2724', branco: '#f7f4f0', cinza: '#9b9691', bege: '#d9c8b4',
  nude: '#dcc0ad', marinho: '#2a3852', jeans: '#5a7396', oliva: '#6b7248',
  vinho: '#5e2733', prata: '#c3c6ca', verde: '#5d7a52', azul: '#3f5a7a',
  rosa: '#c08490', vermelho: '#a8443c', amarelo: '#c9a227', marrom: '#7a5c44',
}

/**
 * Flat lay das peças reais escolhidas.
 * Não é a pessoa vestida — é a composição, que é o que dá para mostrar sem modelo de imagem.
 */
function renderFlatLay(input: ImageGenerationInput): string {
  const garments = input.garments.length
    ? input.garments
    : input.references
        .filter((r) => r.kind === 'garment')
        .map((r) => ({ role: '', name: r.label, color: 'bege' }))

  const rows = garments
    .map((g, i) => {
      const y = 360 + i * 150
      const fill = SWATCHES[normalize(g.color)] ?? '#cfc4b8'
      const textFill = isLight(fill) ? '#2b2320' : '#faf7f3'
      return `<g>
  <rect x="80" y="${y}" width="864" height="118" rx="18" fill="${fill}"/>
  <text x="112" y="${y + 52}" font-family="Georgia, serif" font-size="34" fill="${textFill}">${escapeXml(g.name)}</text>
  <text x="112" y="${y + 90}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${textFill}" opacity="0.75">${escapeXml(label(g.role))}</text>
</g>`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#faf7f3"/><stop offset="100%" stop-color="#ece3d9"/>
</linearGradient></defs>
<rect width="1024" height="1536" fill="url(#bg)"/>
<text x="80" y="150" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="6" fill="#9a8b82">SEU LOOK</text>
<text x="80" y="238" font-family="Georgia, serif" font-size="62" fill="#2b2320">Composicao montada</text>
<text x="80" y="292" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#6b5a50">Pre-visualizacao sem modelo de imagem configurado</text>
${rows}
</svg>`
}

function label(role: string): string {
  const map: Record<string, string> = {
    top: 'Parte de cima', bottom: 'Parte de baixo', dress: 'Vestido',
    shoes: 'Calcado', outerwear: 'Sobreposicao', accessory: 'Acessorio', bag: 'Bolsa',
  }
  return map[role] ?? role
}

function normalize(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  )
}
