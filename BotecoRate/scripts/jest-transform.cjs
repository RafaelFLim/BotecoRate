const { pathToFileURL } = require('node:url');
const babelJest = require('babel-jest');

// Os testes usam URLs de arquivo para ler fontes e regras em qualquer sistema.
function fileUrlForImportMeta({ types }) {
  return {
    visitor: {
      MemberExpression(path, state) {
        if (types.isMetaProperty(path.node.object) &&
            path.node.object.meta.name === 'import' &&
            path.node.object.property.name === 'meta' &&
            types.isIdentifier(path.node.property, { name: 'url' })) {
          path.replaceWith(types.stringLiteral(pathToFileURL(state.filename).href));
        }
      },
    },
  };
}

module.exports = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  plugins: [
    fileUrlForImportMeta,
    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
    '@babel/plugin-transform-modules-commonjs',
  ],
});
