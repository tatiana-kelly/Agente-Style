import Link from 'next/link'
import { ArrowRight, Shirt, Sparkles } from 'lucide-react'
import { isDemoMode } from '@/lib/env'

/** Atalhos de intenção da Home (PRP §5). */
const QUICK_STYLES = [
  { style: 'tenis', label: 'Tênis', hint: 'Quadra, treino, torneio', tone: 'from-[#e8efe6] to-[#d6e2d2]' },
  { style: 'social', label: 'Social', hint: 'Jantar, evento, festa', tone: 'from-[#efe4e2] to-[#e0cdc9]' },
  { style: 'trabalho', label: 'Trabalho', hint: 'Reunião, escritório', tone: 'from-[#e9e4dc] to-[#dbd1c4]' },
  { style: 'casual', label: 'Casual', hint: 'Dia comum, passeio', tone: 'from-[#f0eae2] to-[#e2d8cb]' },
  { style: 'esporte', label: 'Esporte', hint: 'Treino, corrida', tone: 'from-[#e3e8ee] to-[#d0d9e3]' },
  { style: 'viagem', label: 'Viagem', hint: 'Aeroporto, bagagem leve', tone: 'from-[#ece7e0] to-[#ddd3c7]' },
] as const

export default function HomePage() {
  return (
    <div className="rise">
      <section className="py-8 md:py-14">
        <p className="eyebrow">Personal stylist com IA</p>
        <h1 className="display mt-4 text-[2.75rem] md:text-6xl">
          Vista o que
          <br />
          você já tem.
        </h1>
        <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-cocoa">
          Seu guarda-roupa. Seu estilo. A IA monta o look com as peças que já estão no seu armário —
          não com roupa que você não comprou.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create-look"
            className="inline-flex items-center gap-2 rounded-full bg-espresso px-7 py-3.5 text-sm text-bone transition-colors hover:bg-cocoa"
          >
            <Sparkles className="size-4" />
            Montar meu look
          </Link>
          <Link
            href="/wardrobe"
            className="inline-flex items-center gap-2 rounded-full border border-sand px-7 py-3.5 text-sm text-espresso transition-colors hover:border-clay hover:bg-ivory/60"
          >
            <Shirt className="size-4" />
            Meu guarda-roupa
          </Link>
        </div>

        {isDemoMode && (
          <p className="mt-6 inline-block rounded-soft bg-ivory px-4 py-2.5 text-xs leading-relaxed text-cocoa">
            <strong className="font-medium">Modo demo.</strong> Sem Supabase configurado — você está
            vendo um guarda-roupa de 20 peças fictícias, e nada é persistido.
          </p>
        )}
      </section>

      <section className="pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-2xl">Qual look você precisa hoje?</h2>
          <Link href="/create-look" className="text-sm text-mist transition-colors hover:text-espresso">
            Ver tudo
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {QUICK_STYLES.map((card) => (
            <Link
              key={card.style}
              href={`/create-look?style=${card.style}`}
              className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-card bg-gradient-to-br ${card.tone} p-4 transition-transform hover:-translate-y-0.5 md:aspect-[5/4]`}
            >
              <span className="display text-xl">{card.label}</span>
              <span className="mt-1 text-xs text-cocoa">{card.hint}</span>
              <ArrowRight className="absolute right-4 top-4 size-4 text-cocoa opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-card border border-sand/70 bg-ivory/50 p-6 md:p-8">
        <p className="eyebrow">Como funciona</p>
        <ol className="mt-4 grid gap-5 md:grid-cols-3">
          {[
            ['01', 'Cadastre suas peças', 'Fotografe ou envie. A IA identifica categoria, cor, tecido e formalidade.'],
            ['02', 'Diga a ocasião', 'Tênis, trabalho, jantar. Some clima e uma preferência, se quiser.'],
            ['03', 'Receba o look', 'Peças reais do seu armário, com a explicação da escolha e alternativas.'],
          ].map(([num, title, text]) => (
            <li key={num}>
              <span className="display text-3xl text-clay">{num}</span>
              <p className="mt-2 font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-cocoa">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
