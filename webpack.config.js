const path = require('path');
const webpack = require('webpack');
const WebpackUserscript = require('webpack-userscript').default;
const pkg = require('./package.json');

const REPO = 'https://github.com/JojocraftTv/GhostGuessr';
const RAW = 'https://raw.githubusercontent.com/JojocraftTv/GhostGuessr/main';
const RELEASES = `${REPO}/releases`;

/**
 * Build channels
 *   stable  full releases (v* tags)            core: releases/latest/download/
 *   beta    pre-releases (every push to main)  core: releases/download/beta/  (rolling "beta" release)
 *   dev     local development                  core: http://localhost:8080/
 *
 * CI sets GG_CHANNEL and GG_VERSION (e.g. 3.1.0 or 3.1.0-beta.42); locally the
 * version comes from package.json.
 */
const RELEASE_BASE = {
  stable: `${RELEASES}/latest/download/`,
  beta: `${RELEASES}/download/beta/`,
  dev: 'http://localhost:8080/',
};

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  const channel = process.env.GG_CHANNEL || (isDev ? 'dev' : 'stable');
  const version = process.env.GG_VERSION || (isDev ? `${pkg.version}-dev` : pkg.version);
  const name = { stable: 'GhostGuessr', beta: 'GhostGuessr (Beta)', dev: 'GhostGuessr (DEV)' }[channel] || 'GhostGuessr';

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
              presets: [['@babel/preset-env', { targets: 'chrome >= 90, firefox >= 90, safari >= 15' }]],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        __GG_VERSION__: JSON.stringify(version),
        __GG_CHANNEL__: JSON.stringify(channel),
      }),
      new WebpackUserscript({
        headers: {
          name,
          namespace: REPO,
          version,
          description: pkg.description,
          author: pkg.author,
          match: 'https://www.geoguessr.com/*',
          'run-at': 'document-start',
          'inject-into': 'page',
          icon: `${RAW}/icons/GhostGuessr.png`,
          grant: ['GM_setValue', 'GM_getValue', 'unsafeWindow'],
          license: 'MIT',
        },
        // The installable script (GhostGuessr.user.js) is a small proxy that
        // @require's the core from the matching GitHub release.
        proxyScript: {
          enable: true,
          filename: '[basename].proxy.user.js',
          baseURL: RELEASE_BASE[channel] || RELEASE_BASE.stable,
        },
      }),
    ],
    // Bundled country borders (Safety mode) make the script ~270 KB; that's expected.
    performance: { hints: false },
    devtool: isDev ? 'inline-source-map' : false,
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist/local'),
      },
      compress: true,
      port: 8080,
      hot: false,
      liveReload: true,
      client: {
        webSocketURL: 'ws://localhost:8080/ws',
      },
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    mode: argv.mode,
  };
};
