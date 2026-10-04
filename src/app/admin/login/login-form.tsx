"use client";

// Client só pelo estado do formulário (erro, QR gerado) e pelo botão pendente.
import { useFormState, useFormStatus } from "react-dom";

import type { EtapaDoLogin } from "@/lib/admin-auth";
import {
  confirmarCodigo,
  entrar,
  iniciarCadastroMfa,
  sair,
  type LoginState,
} from "@/lib/admin/auth-actions";

const INICIAL: LoginState = { erro: null };

const input =
  "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[16px] text-espresso placeholder:text-placeholder";
const label = "mb-1.5 block text-[13.5px] font-semibold text-ink-2";

type Props = { etapa: Exclude<EtapaDoLogin, "pronto">; next: string };

export function LoginForm({ etapa, next }: Props) {
  if (etapa === "senha") return <FormSenha next={next} />;
  if (etapa === "codigo") return <FormCodigo next={next} />;
  return <FormCadastro next={next} />;
}

function FormSenha({ next }: { next: string }) {
  const [state, action] = useFormState(entrar, INICIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Titulo>Entrar no admin</Titulo>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="senha" className={label}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          maxLength={256}
          autoComplete="current-password"
          className={input}
        />
      </div>
      <Erro erro={state.erro} />
      <Enviar>Entrar</Enviar>
    </form>
  );
}

function FormCodigo({ next }: { next: string }) {
  const [state, action] = useFormState(confirmarCodigo, INICIAL);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <Titulo>Código de verificação</Titulo>
        <p className="text-[14.5px] leading-[1.5] text-ink-2">
          Abra o app autenticador e digite o código de 6 dígitos do Mapa do Café.
        </p>
        <input type="hidden" name="next" value={next} />
        <CampoCodigo />
        <Erro erro={state.erro} />
        <Enviar>Confirmar</Enviar>
      </form>
      <OutraConta />
    </div>
  );
}

function FormCadastro({ next }: { next: string }) {
  const [gerado, gerar] = useFormState(iniciarCadastroMfa, INICIAL);
  const [state, confirmar] = useFormState(confirmarCodigo, INICIAL);
  const cadastro = gerado.cadastro;

  if (!cadastro) {
    return (
      <div className="flex flex-col gap-4">
        <form action={gerar} className="flex flex-col gap-4">
          <Titulo>Proteja sua conta</Titulo>
          <p className="text-[14.5px] leading-[1.5] text-ink-2">
            O admin pede um segundo fator: além da senha, um código de 6 dígitos de um app
            autenticador (Google Authenticator, 1Password, Authy…).
          </p>
          <input type="hidden" name="next" value={next} />
          <Erro erro={gerado.erro} />
          <Enviar>Configurar autenticador</Enviar>
        </form>
        <OutraConta />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={confirmar} className="flex flex-col gap-4">
        <Titulo>Configure o autenticador</Titulo>
        <ol className="list-decimal space-y-1 pl-5 text-[14.5px] leading-[1.5] text-ink-2">
          <li>No app autenticador, escaneie o QR code.</li>
          <li>Digite o código de 6 dígitos que aparecer.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL do Supabase, nada a otimizar */}
        <img
          src={cadastro.qrCode}
          alt="QR code para cadastrar o Mapa do Café no app autenticador"
          width={180}
          height={180}
          className="mx-auto rounded-lg border border-line bg-white p-2"
        />
        <div>
          <p className="mb-1.5 text-[13.5px] font-semibold text-ink-2">
            Sem câmera? Digite esta chave no app:
          </p>
          <code className="block select-all break-all rounded-lg bg-hover-soft px-3 py-2 font-mono text-[13px] text-espresso">
            {cadastro.segredo}
          </code>
        </div>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="factorId" value={cadastro.factorId} />
        <CampoCodigo />
        <Erro erro={state.erro} />
        <Enviar>Ativar e entrar</Enviar>
      </form>
      <OutraConta />
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-[26px] leading-[1.15] text-espresso">{children}</h1>;
}

function CampoCodigo() {
  return (
    <div>
      <label htmlFor="codigo" className={label}>
        Código
      </label>
      <input
        id="codigo"
        name="codigo"
        type="text"
        required
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        autoFocus
        className={`${input} font-mono tracking-[0.3em]`}
      />
    </div>
  );
}

function Erro({ erro }: { erro: string | null }) {
  return (
    <p role="alert" className="text-[14px] font-medium text-terracotta empty:hidden">
      {erro}
    </p>
  );
}

function Enviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 h-[46px] rounded-full bg-terracotta px-6 text-[14.5px] font-semibold text-on-terracotta transition-colors hover:bg-terracotta-hover disabled:opacity-60"
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}

function OutraConta() {
  return (
    <form action={sair} className="text-center">
      <button type="submit" className="text-[13.5px] font-medium text-ink-3 underline underline-offset-2 hover:text-espresso">
        Usar outra conta
      </button>
    </form>
  );
}
