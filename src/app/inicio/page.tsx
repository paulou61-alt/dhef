import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  MessageCircle,
  Package,
  Smartphone,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { LandingPlans } from "@/components/landing/LandingPlans";

export const metadata: Metadata = {
  title: "Cobrei: vendas no crediário e cobranças na palma da mão",
  description: "Controle vendas fiado, fichas, parcelas, estoque e cobranças pelo WhatsApp. Teste grátis por 7 dias.",
};

const PAINS = [
  "Caderno de fiado que some, molha ou ninguém entende a letra",
  "Cliente que diz que já pagou e você não tem como provar",
  "Não saber quanto tem para receber nem quanto lucrou no mês",
];

const FEATURES = [
  { icon: ClipboardList, title: "Fichas numeradas", text: "Cada cliente com a sua ficha, compras, parcelas e tudo o que já pagou." },
  { icon: MessageCircle, title: "Cobrança no WhatsApp", text: "Um toque e a mensagem de cobrança sai pronta, com o valor certo." },
  { icon: Package, title: "Estoque por cor e tamanho", text: "Saiba o que tem, o que está acabando e o que mais vende." },
  { icon: Wallet, title: "Financeiro de verdade", text: "Caixa, despesas, lucro e contas a receber, sem planilha." },
  { icon: Users, title: "Equipe na rua", text: "Vendedores e cobradores com acesso próprio, e você escolhe o que cada um vê." },
  { icon: WifiOff, title: "Funciona sem internet", text: "Vende e recebe mesmo sem sinal; tudo sincroniza quando a internet volta." },
  { icon: FileText, title: "Relatório em PDF", text: "O mês inteiro num relatório pronto para guardar ou mandar." },
  { icon: Smartphone, title: "No celular ou no computador", text: "Instala como aplicativo no celular. Nada para baixar da loja." },
];

const STEPS = [
  { title: "Crie sua conta", text: "Leva menos de 1 minuto. Só nome, e-mail e senha." },
  { title: "Cadastre clientes e produtos", text: "Comece pelas fichas que já tem; o resto vai entrando no dia a dia." },
  { title: "Venda e cobre pelo celular", text: "Lance a venda, as parcelas são calculadas e o Cobrei lembra quem está devendo." },
];

const FAQ = [
  { q: "Preciso de cartão para testar?", a: "Não. Você cria a conta e usa tudo por 7 dias. Só escolhe um plano se quiser continuar." },
  { q: "Funciona no celular?", a: "Sim. O Cobrei abre no navegador e pode ser instalado na tela inicial como um aplicativo." },
  { q: "E se a internet cair na rua?", a: "Nos planos Profissional e Equipe, a equipe continua vendendo e recebendo offline. Quando o sinal volta, tudo sincroniza." },
  { q: "Posso trocar de plano depois?", a: "Pode. Comece pelo que faz sentido hoje e mude quando o negócio crescer." },
  { q: "Meus dados ficam guardados se eu parar de pagar?", a: "Ficam. O acesso é suspenso, mas nada é apagado. Ao voltar, está tudo lá." },
];

export default function InicioPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/inicio" className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <span className="text-lg font-black tracking-tight text-slate-900">Cobrei</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#planos" className="hidden text-sm font-semibold text-slate-600 hover:text-slate-900 sm:block">Planos</a>
            <a href="#duvidas" className="hidden text-sm font-semibold text-slate-600 hover:text-slate-900 sm:block">Dúvidas</a>
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Entrar</Link>
            <Link href="/cadastro" className="btn-primary !px-4 !py-2.5 text-sm">Testar grátis</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Abertura */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center md:pt-20">
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Para sacoleiros e revendedores</span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-slate-900 md:text-6xl">
            Venda no crediário e <span className="text-brand-500">receba em dia</span>, sem caderno.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Fichas, parcelas, estoque e cobrança no WhatsApp num só lugar. Você sabe na hora quem deve, quanto e desde quando.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-primary w-full !px-7 !py-4 text-base sm:w-auto">
              Testar grátis por 7 dias <ArrowRight size={18} />
            </Link>
            <a href="#planos" className="btn-secondary w-full !px-7 !py-4 text-base sm:w-auto">Ver planos</a>
          </div>
          <p className="mt-4 text-sm text-slate-500">Sem cartão de crédito. Cancele quando quiser.</p>
        </section>

        {/* Dor */}
        <section className="bg-slate-900 px-4 py-16 text-white">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-black tracking-tight md:text-3xl">Se você vende fiado, já passou por isso:</h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {PAINS.map((pain) => (
                <li key={pain} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">{pain}</li>
              ))}
            </ul>
            <p className="mt-8 text-center text-lg font-semibold text-brand-200">O Cobrei resolve isso e coloca o controle no seu bolso.</p>
          </div>
        </section>

        {/* Recursos */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-black tracking-tight text-slate-900">Tudo o que o seu negócio precisa</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">Feito para quem vende de porta em porta, em loja pequena ou com equipe na rua.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section className="bg-white px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-black tracking-tight text-slate-900">Comece hoje, em 3 passos</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-lg font-black text-white">{index + 1}</span>
                  <h3 className="mt-4 font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <h2 className="text-center text-3xl font-black tracking-tight text-slate-900">Escolha o plano do seu negócio</h2>
          <p className="mx-auto mb-8 mt-3 max-w-2xl text-center text-slate-600">Teste tudo grátis por 7 dias. Depois, fique no plano que combina com o tamanho da sua operação.</p>
          <LandingPlans />
        </section>

        {/* Dúvidas */}
        <section id="duvidas" className="scroll-mt-20 bg-white px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-black tracking-tight text-slate-900">Dúvidas frequentes</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-900">
                    {item.q}
                    <span className="text-xl text-brand-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Chamada final */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-4xl rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-14 text-center text-white shadow-[0_24px_60px_-24px_rgba(47,91,246,0.7)]">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">Pare de perder dinheiro no fiado.</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">Crie sua conta agora e teste o Cobrei por 7 dias, sem pagar nada.</p>
            <Link href="/cadastro" className="mx-auto mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 font-bold text-brand-700 shadow-lg transition hover:-translate-y-0.5">
              Começar meu teste grátis <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="font-bold text-slate-700">Cobrei</span>
          </div>
          <p>© {new Date().getFullYear()} Cobrei. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
