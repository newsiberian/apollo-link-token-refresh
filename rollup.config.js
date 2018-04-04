export default {
  input: 'lib/tokenRefreshLink.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
    name: 'tokenRefreshLink',
    globals: {
      'apollo-link': 'httpLink'
    },
    sourcemap: true,
    exports: 'named',
  },
  onwarn,
  external: [
    'apollo-link'
  ],
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
