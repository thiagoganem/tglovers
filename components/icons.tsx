/** Ícones inline (sem dependência externa). */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const UploadIcon = ({ size = 26 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

/** Folha com seta para cima — o glifo do círculo da área de upload. */
export const FileUploadIcon = ({ size = 26 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 17v-5m0 0-2 2m2-2 2 2" />
  </svg>
);

export const SunIcon = ({ size = 19 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 19 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const FileIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const CheckIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const DownloadIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
);

export const CopyIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const AlertIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 9v4.5m0 3.5v.01" />
    <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const InfoIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-8.5v.01" />
  </svg>
);

export const TrashIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 .8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7" />
  </svg>
);

export const ScanIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" />
  </svg>
);

/** Tesoura — o botão que gera o recorte final da figurinha. */
export const ScissorsIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M20 4 8.6 15.4M8.6 8.6 20 20M14 12l-6.2-3.4" />
  </svg>
);

/** Avião de papel — envio. */
export const SendIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8.5L2 8.5z" />
  </svg>
);

/** Compartilhar — abre a folha do sistema (WhatsApp, Instagram, e o que houver). */
export const ShareIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" />
    <path d="M20 13v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V13" />
  </svg>
);

/** Imagem — a área de upload da aba de figurinhas. */
export const ImageIcon = ({ size = 26 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.75" cy="9.5" r="1.6" />
    <path d="M21 15.5 16.5 11 6 20.5" />
  </svg>
);

/** Balão de conversa — status do WhatsApp e destinos. */
export const ChatIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20.5 11.6a7.9 7.9 0 0 1-11.2 7.2L3.5 20.5l1.7-5.6A7.9 7.9 0 1 1 20.5 11.6z" />
  </svg>
);

/** Duas pessoas — grupos. */
export const GroupIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
  </svg>
);

/** Faísca — recursos de IA. */
export const SparkIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />
    <path d="M18.5 3v3M20 4.5h-3" />
  </svg>
);

/** Três traços — abre a navegação lateral em telas estreitas. */
export const MenuIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/** X — fecha a navegação lateral. */
export const CloseIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Retrato dentro de um círculo — o módulo de foto de perfil. */
/** Contorno de teclado — glifo do módulo Teclado. */
export const KeyboardIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16h8" />
  </svg>
);

export const PortraitIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.2 18.4a6.2 6.2 0 0 1 11.6 0" />
  </svg>
);

/** Selo/roseta — a arte que entra por cima da foto. */
export const BadgeIcon = ({ size = 26 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3 14.3 7.7l5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 8.5l5.2-.8z" />
    <path d="M8.5 15.5 7 21l5-2 5 2-1.5-5.5" />
  </svg>
);

/** Alvo — recentrar o enquadramento. */
export const TargetIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
  </svg>
);
