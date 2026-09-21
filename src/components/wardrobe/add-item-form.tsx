'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Expand, ImageIcon, Loader2, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ALL_SUBCATEGORIES, CATEGORIES, OCCASIONS, type DetectedGarment,
} from '@/schemas/wardrobe'
import { garmentName, occasionLabel, subcategoryLabel } from '@/lib/labels'
import { cropPiece, emLotes, loadPhoto, toDataUrl, type LoadedPhoto } from '@/lib/images/client-pipeline'
import type { Box } from '@/lib/images/geometry'

type Step = 'capture' | 'detecting' | 'cropping' | 'review' | 'saving' | 'done'

interface Peca extends DetectedGarment {
  chave: string
  name: string
  incluir: boolean
  /** Margem atual do recorte; "ampliar" aumenta. */
  margem: number
  /** true = usar a foto inteira porque o recorte não ficou bom. */
  fotoInteira: boolean
  original: string
  semFundo: string | null
  avisoFundo: string | null
  /** Qual versão salvar como miniatura. */
  usarSemFundo: boolean
  caixaUsada: Box
  status: 'pendente' | 'salvando' | 'salva' | 'erro'
  erro?: string
}

const MARGEM_INICIAL = 0.2
const PASSO_MARGEM = 0.15

/** Cede a vez ao navegador entre recortes, para a tela não congelar com 15 peças. */
const respirar = () => new Promise((r) => setTimeout(r, 0))

/**
 * Cadastro em lote.
 *
 * Uma foto com várias peças vira várias peças, cada uma com o SEU recorte.
 * Antes, todas herdavam a foto inteira — dez sapatos no guarda-roupa, dez
 * miniaturas idênticas, e o motor de looks sem como distinguir um do outro.
 */
export function AddItemForm() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const foto = useRef<LoadedPhoto | null>(null)

  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [pecas, setPecas] = useState<Peca[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setNotice(null)
    setPecas([])
    setStep('detecting')
    setProgresso('Procurando as peças na foto…')

    try {
      const carregada = await loadPhoto(file)
      foto.current = carregada

      // Para a IA: resolução suficiente para caixas precisas, sem estourar o
      // limite de requisição. O recorte, depois, sai da foto em resolução cheia.
      const paraDeteccao = toDataUrl(carregada, 1600, 0.85)
      setPreview(toDataUrl(carregada, 900, 0.8))

      const res = await fetch('/api/wardrobe/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: paraDeteccao, hint: file.name.replace(/\.[^.]+$/, '') }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Não consegui identificar as peças.')

      const detectadas = payload.items as DetectedGarment[]
      setNotice(payload.warning ?? null)
      setStep('cropping')

      const montadas: Peca[] = []
      for (const [i, d] of detectadas.entries()) {
        setProgresso(`Recortando peça ${i + 1} de ${detectadas.length}…`)
        await respirar()
        const recorte = cropPiece(carregada, d.box, { pad: MARGEM_INICIAL })
        montadas.push({
          ...d,
          chave: `${i}-${d.subcategory}`,
          name: garmentName(d.subcategory, d.color),
          incluir: true,
          margem: MARGEM_INICIAL,
          fotoInteira: !d.box,
          original: recorte.original,
          semFundo: recorte.semFundo,
          avisoFundo: recorte.avisoFundo,
          usarSemFundo: Boolean(recorte.semFundo),
          caixaUsada: recorte.box,
          status: 'pendente',
        })
      }

      setPecas(montadas)
      setProgresso(null)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar a foto.')
      setProgresso(null)
      setStep('capture')
    }
  }

  function patch<K extends keyof Peca>(chave: string, key: K, value: Peca[K]) {
    setPecas((prev) => prev.map((p) => (p.chave === chave ? { ...p, [key]: value } : p)))
  }

  /** Refaz o recorte de UMA peça — para quando a caixa da IA cortou a ponta. */
  function recortar(chave: string, opcoes: { margem?: number; fotoInteira?: boolean }) {
    const carregada = foto.current
    if (!carregada) return
    setPecas((prev) =>
      prev.map((p) => {
        if (p.chave !== chave) return p
        const margem = opcoes.margem ?? p.margem
        const fotoInteira = opcoes.fotoInteira ?? p.fotoInteira
        const r = cropPiece(carregada, fotoInteira ? null : p.box, { pad: margem })
        return {
          ...p,
          margem,
          fotoInteira,
          original: r.original,
          semFundo: r.semFundo,
          avisoFundo: r.avisoFundo,
          usarSemFundo: Boolean(r.semFundo),
          caixaUsada: r.box,
        }
      }),
    )
  }

  async function salvar() {
    const carregada = foto.current
    const selecionadas = pecas.filter((p) => p.incluir && p.status !== 'salva')
    if (selecionadas.length === 0 || !carregada) return

    setStep('saving')
    setError(null)

    try {
      // A foto do lote é guardada uma vez; cada peça aponta para ela.
      setProgresso('Guardando a foto original…')
      const origem = await fetch('/api/wardrobe/source-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: toDataUrl(carregada, 2048, 0.85) }),
      })
      const origemPayload = await origem.json()
      if (!origem.ok) throw new Error(origemPayload.error ?? 'Falha ao guardar a foto original.')
      const loteId = crypto.randomUUID()

      await emLotes(
        selecionadas,
        3,
        async (p) => {
          patch(p.chave, 'status', 'salvando')
          try {
            const res = await fetch('/api/wardrobe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: p.name,
                category: p.category,
                subcategory: p.subcategory,
                color: p.color,
                secondary_colors: p.secondary_colors,
                pattern: p.pattern,
                material: p.material,
                style: p.style,
                formality: p.formality,
                sport_type: p.sport_type,
                season: p.season,
                occasion: p.occasion,
                description: p.description,
                image_original_url: p.original,
                image_processed_url: p.usarSemFundo && p.semFundo ? p.semFundo : undefined,
                metadata: {
                  origem: 'lote',
                  lote_id: loteId,
                  foto_origem: origemPayload.ref,
                  caixa: p.caixaUsada,
                  caixa_ia: p.box,
                  posicao: p.position,
                },
              }),
            })
            const payload = await res.json()
            if (!res.ok) throw new Error(payload.error ?? 'Falha ao salvar.')
            patch(p.chave, 'status', 'salva')
          } catch (e) {
            // Uma peça falhando não derruba as outras: fica marcada para tentar de novo.
            setPecas((prev) =>
              prev.map((x) =>
                x.chave === p.chave
                  ? { ...x, status: 'erro', erro: e instanceof Error ? e.message : 'Falha ao salvar.' }
                  : x,
              ),
            )
          }
        },
        (feitos) => setProgresso(`Salvando ${feitos} de ${selecionadas.length}…`),
      )

      setProgresso(null)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
      setProgresso(null)
      setStep('review')
    }
  }

  const selecionadas = pecas.filter((p) => p.incluir).length
  const salvas = pecas.filter((p) => p.status === 'salva').length
  const comErro = pecas.filter((p) => p.status === 'erro').length
  const ocupado = step === 'detecting' || step === 'cropping' || step === 'saving'

  return (
    <div className="rise pb-8">
      <p className="eyebrow">Nova peça</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">Cadastrar no guarda-roupa</h1>

      {error && (
        <p role="alert" className="mt-5 rounded-soft bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>
      )}

      {/* Captura: some da vista quando já há peças para revisar, para a grade ter espaço. */}
      {(step === 'capture' || step === 'detecting' || step === 'cropping') && (
        <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
          <div>
            <div className="aspect-[3/4] overflow-hidden rounded-card bg-ivory">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview local
                <img src={preview} alt="Foto enviada" className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-mist">
                  <Camera className="size-8" strokeWidth={1.4} />
                  <span className="text-xs">Nenhuma foto ainda</span>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => cameraInput.current?.click()} disabled={ocupado}>
                <Camera className="size-4" /> Câmera
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={ocupado}>
                <Upload className="size-4" /> Galeria
              </Button>
            </div>
          </div>

          <div>
            {ocupado ? (
              <div className="flex items-center gap-3 rounded-card bg-ivory px-5 py-6 text-sm text-cocoa">
                <Loader2 className="size-4 animate-spin" />
                {progresso}
              </div>
            ) : (
              <div className="rounded-card border border-dashed border-sand px-5 py-8 text-sm leading-relaxed text-cocoa">
                <p>
                  Fotografe <strong>quantas peças quiser de uma vez</strong> — dez sapatos enfileirados,
                  as blusas estendidas na cama. Cada peça vira um item separado, com o seu próprio recorte.
                </p>
                <p className="mt-3 text-xs text-mist">
                  Funciona melhor com as peças separadas entre si e sobre fundo liso. Par de sapatos conta
                  como uma peça.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={fileInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {pecas.length > 0 && (step === 'review' || step === 'saving' || step === 'done') && (
        <div className="mt-6">
          {notice && (
            <p className="mb-4 rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">{notice}</p>
          )}

          <div className="sticky z-10 -mx-5 mb-4 flex flex-wrap items-center gap-2 border-b border-sand/60 bg-bone/95 px-5 py-3 backdrop-blur-md"
            style={{ top: 'calc(57px + env(safe-area-inset-top, 0px))' }}
          >
            <p className="mr-auto text-sm">
              <strong>{pecas.length}</strong> {pecas.length === 1 ? 'peça encontrada' : 'peças encontradas'}
              {step === 'done' && (
                <span className="text-mist"> · {salvas} salva{salvas === 1 ? '' : 's'}{comErro > 0 ? `, ${comErro} com erro` : ''}</span>
              )}
            </p>

            {step === 'review' && (
              <>
                <button
                  type="button"
                  className="text-xs text-mist hover:text-espresso"
                  onClick={() => setPecas((prev) => prev.map((p) => ({ ...p, incluir: true })))}
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  className="text-xs text-mist hover:text-espresso"
                  onClick={() => setPecas((prev) => prev.map((p) => ({ ...p, incluir: false })))}
                >
                  Desmarcar
                </button>
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="size-3.5" /> Outra foto
                </Button>
              </>
            )}

            {step === 'done' ? (
              comErro > 0 ? (
                <Button size="sm" onClick={salvar}>
                  <RotateCcw className="size-3.5" /> Tentar de novo as {comErro}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    router.push('/wardrobe')
                    router.refresh()
                  }}
                >
                  <Check className="size-3.5" /> Ver no guarda-roupa
                </Button>
              )
            ) : (
              <Button size="sm" onClick={salvar} disabled={step === 'saving' || selecionadas === 0}>
                {step === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {progresso ?? (selecionadas === 1 ? 'Salvar 1 peça' : `Salvar ${selecionadas} peças`)}
              </Button>
            )}
          </div>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {pecas.map((p, indice) => {
              const miniatura = p.usarSemFundo && p.semFundo ? p.semFundo : p.original
              const travado = step !== 'review'
              return (
                <li
                  key={p.chave}
                  className={`flex flex-col overflow-hidden rounded-card border transition-opacity ${
                    p.incluir ? 'border-sand bg-ivory/40' : 'border-sand/50 opacity-50'
                  }`}
                >
                  <div
                    className={`relative aspect-square overflow-hidden ${
                      p.usarSemFundo && p.semFundo ? 'bg-[repeating-conic-gradient(#f3ece4_0_25%,#faf7f3_0_50%)] bg-[length:16px_16px]' : 'bg-ivory'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- recorte local em data URL */}
                    <img
                      src={miniatura}
                      alt={p.name}
                      className={`size-full ${p.usarSemFundo && p.semFundo ? 'object-contain p-2' : 'object-cover'}`}
                    />
                    <label className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-bone/90 px-2 py-1 text-[0.6875rem]">
                      <input
                        type="checkbox"
                        checked={p.incluir}
                        disabled={travado}
                        onChange={(e) => patch(p.chave, 'incluir', e.target.checked)}
                        className="size-3.5 accent-[var(--color-espresso)]"
                      />
                      {indice + 1}
                    </label>
                    {p.status === 'salvando' && (
                      <span className="absolute inset-0 flex items-center justify-center bg-bone/60">
                        <Loader2 className="size-5 animate-spin" />
                      </span>
                    )}
                    {p.status === 'salva' && (
                      <span className="absolute right-2 top-2 rounded-full bg-espresso p-1 text-bone">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    {p.status === 'erro' && <p className="text-[0.6875rem] text-rose">{p.erro}</p>}

                    <input
                      value={p.name}
                      disabled={travado}
                      onChange={(e) => patch(p.chave, 'name', e.target.value)}
                      className="w-full rounded-soft border border-sand bg-transparent px-2 py-1.5 text-xs focus:border-clay focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={p.subcategory}
                        disabled={travado}
                        onChange={(e) => patch(p.chave, 'subcategory', e.target.value)}
                        className="w-full rounded-soft border border-sand bg-transparent px-1.5 py-1.5 text-[0.6875rem] focus:border-clay focus:outline-none"
                      >
                        {ALL_SUBCATEGORIES.map((sub) => (
                          <option key={sub} value={sub}>{subcategoryLabel(sub)}</option>
                        ))}
                      </select>
                      <input
                        value={p.color}
                        disabled={travado}
                        onChange={(e) => patch(p.chave, 'color', e.target.value)}
                        className="w-full rounded-soft border border-sand bg-transparent px-1.5 py-1.5 text-[0.6875rem] focus:border-clay focus:outline-none"
                      />
                    </div>

                    {step === 'review' && (
                      <>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-mist">
                          {p.semFundo && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-espresso"
                              onClick={() => patch(p.chave, 'usarSemFundo', !p.usarSemFundo)}
                            >
                              <ImageIcon className="size-3" />
                              {p.usarSemFundo ? 'Com fundo' : 'Sem fundo'}
                            </button>
                          )}
                          {!p.fotoInteira && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-espresso"
                              onClick={() => recortar(p.chave, { margem: p.margem + PASSO_MARGEM })}
                            >
                              <Expand className="size-3" /> Ampliar recorte
                            </button>
                          )}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-espresso"
                            onClick={() =>
                              recortar(p.chave, p.fotoInteira ? { fotoInteira: false, margem: MARGEM_INICIAL } : { fotoInteira: true })
                            }
                          >
                            {p.fotoInteira && p.box ? 'Voltar ao recorte' : p.fotoInteira ? 'Foto inteira' : 'Usar foto inteira'}
                          </button>
                        </div>
                        {p.avisoFundo && <p className="text-[0.625rem] leading-snug text-mist">{p.avisoFundo}</p>}

                        <details className="text-[0.6875rem]">
                          <summary className="cursor-pointer text-mist hover:text-espresso">Mais detalhes</summary>
                          <div className="mt-2 space-y-2">
                            <select
                              value={p.category}
                              onChange={(e) => patch(p.chave, 'category', e.target.value as Peca['category'])}
                              className="w-full rounded-soft border border-sand bg-transparent px-1.5 py-1.5 focus:border-clay focus:outline-none"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <label className="block">
                              Formalidade: {p.formality}
                              <input
                                type="range" min={0} max={10} value={p.formality}
                                onChange={(e) => patch(p.chave, 'formality', Number(e.target.value))}
                                className="w-full accent-[var(--color-espresso)]"
                              />
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {OCCASIONS.map((o) => {
                                const ativa = p.occasion.includes(o)
                                return (
                                  <button
                                    key={o}
                                    type="button"
                                    aria-pressed={ativa}
                                    onClick={() =>
                                      patch(p.chave, 'occasion', ativa ? p.occasion.filter((x) => x !== o) : [...p.occasion, o])
                                    }
                                    className={`rounded-full border px-2 py-0.5 ${
                                      ativa ? 'border-espresso bg-espresso text-bone' : 'border-sand text-cocoa'
                                    }`}
                                  >
                                    {occasionLabel(o)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
