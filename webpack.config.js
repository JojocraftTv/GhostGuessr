const path = require('path');
const WebpackUserscript = require('webpack-userscript').default;
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDev = argv.mode === 'development';

  return {
    entry: './src/userscript/index.js',
    output: {
      path: path.resolve(__dirname, isDev ? 'dist/local' : 'dist'),
      filename: 'ghostguessr-core.user.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          include: /src[\\/]userscript/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
      ],
    },
    plugins: [
      new WebpackUserscript({
        headers: {
          name: isDev ? 'GhostGuessr (DEV)' : 'GhostGuessr',
          namespace: 'https://github.com/JojocraftTv/GhostGuessr',
          version: isDev ? 'DEV' : '[version]',
          description: 'Marks your Current Streetview Location on the GeoGuessr Map with a Red Dot. Toggle with hotkey.',
          author: 'VellusFox, Niceas',
          match: 'https://www.geoguessr.com/*',
          'run-at': 'document-start',
          'inject-into': 'page',
          icon: 'https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/icons/GhostGuessr.png',
          grant: ['GM_setValue', 'GM_getValue'],
          downloadURL: 'https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js',
          updateURL: 'https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/refs/heads/main/dist/ghostguessr-core.user.js',
          license: 'MIT',
        },
        proxyScript: {
          enable: isDev,
          filename: '[basename].proxy.user.js',
          baseUrl: isDev ? 'http://localhost:8080/ghostguessr-core.user.js' : "https://github.com/JojocraftTv/GhostGuessr/raw/refs/heads/main/dist/ghostguessr-core.user.js",
        },
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'dist/ghostguessr-core.proxy.user.js',
            to: '../GhostGuessr.user.js',
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devtool: isProduction ? false : 'inline-source-map',
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 8080,
      hot: false,
      liveReload: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    mode: argv.mode,
  };
};
