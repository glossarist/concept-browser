const path = {
  resolve: (..._args: string[]) => '',
  dirname: (_p: string) => '',
  basename: (_p: string) => '',
  extname: (_p: string) => '',
  join: (..._args: string[]) => '',
  sep: '/',
};
export default path;
export const { resolve, dirname, basename, extname, join, sep } = path;
