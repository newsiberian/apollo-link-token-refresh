export default {
  input: 'lib/tokenRefreshLink.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd'
  },
  sourcemap: true,
  name: 'tokenRefreshLink',
  exports: 'named',
  onwarn,
  external: [
    'apollo-link'
  ],
  globals: {
    'apollo-link': 'httpLink'
  }
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
