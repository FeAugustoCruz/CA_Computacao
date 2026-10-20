import logoSrc from '../assets/logo-ca.png'

/** Logotipo oficial (emblema da coruja), estático. Arquivo recortado na área útil, 192×176, para manter a proporção. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <img
      src={logoSrc}
      width={192}
      height={176}
      alt=""
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  )
}

/** Marca provisória: monograma "CA". Ainda usada no rodapé. */
export function Monogram({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`display grid shrink-0 place-items-center rounded-md bg-orange text-night ${className}`}
      style={{ fontStretch: '100%' }}
    >
      CA
    </span>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex min-w-0 flex-col leading-none ${className}`}>
      <span className="display truncate text-[1.05rem] tracking-tight text-white" style={{ fontStretch: '100%' }}>
        CA Computação
      </span>
      <span className="eyebrow mt-1 text-[0.62rem] tracking-[0.18em] text-white/65">UFES · Alegre</span>
    </span>
  )
}
