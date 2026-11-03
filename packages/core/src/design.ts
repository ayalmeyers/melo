/** Melo design tokens, shared by the iPhone app and the website. */
export const colors = {
  ink: '#070910',
  ink2: '#171a23',
  ink3: '#262a36',
  onInk: '#fdfdfd',
  onInkDim: '#8b91a2',
  blue: '#047eef',
  blueDeep: '#0367c4',
  blueSoft: '#e4f0fd',
  blueMid: '#9ccaf8',
  mist: '#f2f2f2',
  paper: '#fdfdfd',
  text: '#070910',
  dim: '#6b7181',
  line: '#e7e8ec',
  good: '#11a053',
  bad: '#e5484d',
} as const;

export const radii = { sm: 12, md: 16, lg: 22, xl: 30 } as const;
export const space = [4, 8, 12, 16, 20, 24, 32, 48, 72] as const;
export const AVATAR_COLORS = ['#e07a2e', '#6a5ad0', '#12a07d', '#d4427a', '#b8901a', '#2f86d0', '#9446c8', '#239a9a', '#c2410c', '#4d7c0f'];

export const fonts = {
  family: 'Urbanist',
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;
