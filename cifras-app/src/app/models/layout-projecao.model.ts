export interface LayoutProjecao {
  fundo: string;
  cor: string;
  tamanho: number;
  caixa: 'original' | 'uppercase' | 'lowercase';
  negrito: boolean;
  entrelinhas: number;
  espacoParagrafo: number;
  alinhamento: 'left' | 'center' | 'right' | 'justify';
}

export const LAYOUT_PROJECAO_PADRAO: Readonly<LayoutProjecao> = {
  fundo: '#000000', cor: '#ffffff', tamanho: 6, caixa: 'original',
  negrito: false, entrelinhas: 1.4, espacoParagrafo: 0,
  alinhamento: 'center',
};

/** Normaliza preferências antigas e mensagens recebidas pela janela do telão. */
export function normalizarLayout(valor: unknown): LayoutProjecao {
  const dados = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const padrao = LAYOUT_PROJECAO_PADRAO;
  const cor = (valor: unknown, fallback: string) => typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor) ? valor : fallback;
  const numero = (valor: unknown, min: number, max: number, fallback: number) => typeof valor === 'number' && Number.isFinite(valor) ? Math.min(max, Math.max(min, valor)) : fallback;
  return {
    fundo: cor(dados['fundo'], padrao.fundo), cor: cor(dados['cor'], padrao.cor),
    tamanho: numero(dados['tamanho'], 2, 12, padrao.tamanho),
    caixa: dados['caixa'] === 'uppercase' || dados['caixa'] === 'lowercase' ? dados['caixa'] : 'original',
    negrito: typeof dados['negrito'] === 'boolean' ? dados['negrito'] : padrao.negrito,
    entrelinhas: numero(dados['entrelinhas'], 1, 2.5, padrao.entrelinhas),
    espacoParagrafo: numero(dados['espacoParagrafo'], 0, 2, padrao.espacoParagrafo),
    alinhamento: dados['alinhamento'] === 'left' || dados['alinhamento'] === 'right' || dados['alinhamento'] === 'justify' ? dados['alinhamento'] : 'center',
  };
}
