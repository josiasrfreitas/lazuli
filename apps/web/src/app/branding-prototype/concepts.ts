export const VARIANTS = ["D", "E", "F", "B"] as const;
export const COMPOSITIONS = ["lockup", "symbol", "wordmark"] as const;
export const TONES = ["dark", "light"] as const;

export type Variant = (typeof VARIANTS)[number];
export type Composition = (typeof COMPOSITIONS)[number];
export type Tone = (typeof TONES)[number];
export type WorkshopOptions = { variant: Variant; composition: Composition; tone: Tone };
export type ChangeOptions = (options: Partial<WorkshopOptions>) => void;

export const COMPOSITION_OPTIONS = [
  { key: "lockup", label: "Com nome", width: 420, height: 120 },
  { key: "symbol", label: "Só símbolo", width: 100, height: 100 },
  { key: "wordmark", label: "Só nome", width: 320, height: 100 },
] as const;

export const CONCEPTS = [
  {
    key: "D",
    name: "Companhia",
    previewTone: "light",
    palette: "Coral, pêssego e ameixa",
    character: "Corpo inteiro, curvas e uma presença próxima.",
    description:
      "Uma pequena coruja de corpo inteiro, com rosto em coração e asas arredondadas. O coral e o letreiro macio aproximam o Lazuli de uma companhia para o dia a dia da escola.",
    construction: "Silhueta arredondada, rosto claro e duas asas laterais.",
    typography: "lazuli · letras arredondadas, próximas e em minúsculas.",
    strength: "Acolhimento e personalidade; pode crescer como personagem da marca.",
    tradeoff: "Tem uma voz mais lúdica. É preciso dosar o uso para conversar também com adultos.",
  },
  {
    key: "E",
    name: "Ex-líbris",
    previewTone: "dark",
    palette: "Verde profundo, creme e ouro fosco",
    character: "Um selo de biblioteca, com calma e tradição.",
    description:
      "A coruja é desenhada em linha contínua dentro de um selo oval. Verde profundo, papel creme e letras com serifas evocam livros, conhecimento e uma escola com história.",
    construction: "Contornos leves, moldura oval e um único detalhe dourado.",
    typography: "LAZULI · serifas delicadas, maiúsculas e respiro entre letras.",
    strength: "Presença editorial; funciona como assinatura em materiais e documentos da escola.",
    tradeoff:
      "O traço fino perde definição em 16 px. Essa direção pede uma redução própria para o app.",
  },
  {
    key: "F",
    name: "Voo",
    previewTone: "dark",
    palette: "Azul elétrico, lima e marinho",
    character: "Asas abertas, diagonais e energia.",
    description:
      "Uma coruja em voo feita de planos angulares. O azul elétrico encontra o lima, e o nome inclinado acompanha o movimento: uma escola que incentiva a descoberta e a autonomia.",
    construction: "Asas assimétricas, grandes planos azuis e cabeça em lima.",
    typography: "lazuli · letras estreitas, pesadas e inclinadas.",
    strength: "Silhueta dinâmica e uma combinação de cores com muita presença.",
    tradeoff: "A atitude se aproxima do universo esportivo. A coruja é menos literal nesta pose.",
  },
  {
    key: "B",
    name: "Livro aberto",
    previewTone: "dark",
    palette: "Amarelo #D8AD4A e carvão",
    character: "O aprendizado vira a própria forma.",
    description:
      "Duas páginas formam o rosto da coruja. A divisão central sugere a dobra de um livro, enquanto o letreiro em minúsculas traz leveza para a aplicação.",
    construction: "Duas páginas espelhadas, dois vazios e um bico central.",
    typography: "lazuli · geometria limpa, toda em minúsculas.",
    strength: "Une a ideia de coruja à de aprendizado em poucas formas.",
    tradeoff: "A leitura do livro é sutil; o símbolo se apoia na simetria para ser reconhecido.",
  },
] as const;

export function artworkPath({ variant, composition, tone }: WorkshopOptions): string {
  return `/brand/workshop/${variant.toLowerCase()}-${composition}-${tone}.svg`;
}

export function compositionDetails(
  composition: Composition,
  variant?: Variant,
): { key: Composition; label: string; width: number; height: number } {
  const details =
    COMPOSITION_OPTIONS.find((item) => item.key === composition) ?? COMPOSITION_OPTIONS[0];
  return variant === "E" && composition === "lockup"
    ? { ...details, width: 240, height: 210 }
    : details;
}

export function conceptDetails(variant: Variant): (typeof CONCEPTS)[number] {
  return CONCEPTS.find((item) => item.key === variant) ?? CONCEPTS[0];
}

export function adjacentVariant(variant: Variant, direction: -1 | 1): Variant {
  const index = VARIANTS.indexOf(variant);
  return VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length] ?? "D";
}
