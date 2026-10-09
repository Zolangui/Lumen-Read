/* eslint-disable import/order */
const path = require('path')

const { withSentryConfig } = require('@sentry/nextjs')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const IS_EXPORT = process.env.NEXT_PUBLIC_IS_EXPORT === 'true'

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: IS_EXPORT,
})
const withTM = require('next-transpile-modules')([
  '@flow/internal',
  '@flow/epubjs',
  '@flow/epub-engine',
  '@material/material-color-utilities',
  'voy-search',
  '@wllama/wllama',
])

const IS_DEV = process.env.NODE_ENV === 'development'
const IS_DOCKER = process.env.DOCKER
const shouldSkipBuildValidation =
  process.env.FAST_BUILD === 'true' ||
  process.env.SKIP_BUILD_VALIDATION === 'true'

/**
 * @type {import('@sentry/nextjs').SentryWebpackPluginOptions}
 **/
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
}

/**
 * @type {import('next').NextConfig}
 **/
let config = {
  ...(IS_EXPORT && {
    generateBuildId: async () =>
      `lumen-${require('../extension/package.json').version}`,
  }),
  swcMinify: false, // Use Terser instead of SWC (Fixes Zod v4 mangling bug in Next.js 12)
  compress: process.env.FAST_BUILD !== 'true', // Disable gzip for fast builds
  productionBrowserSourceMaps: false, // Disable for faster builds
  typescript: {
    ignoreBuildErrors: shouldSkipBuildValidation, // Release checks run in parallel
  },
  eslint: {
    ignoreDuringBuilds: shouldSkipBuildValidation, // Release checks run in parallel
  },
  pageExtensions: ['ts', 'tsx'],
  webpack(config, { dev, isServer }) {
    if (IS_EXPORT && !isServer) {
      config.module.rules.push({
        test: /[\\/]zod[\\/]v4[\\/]core[\\/](?:util|doc)\.(?:js|cjs)$/,
        enforce: 'pre',
        use: path.resolve(__dirname, '../../scripts/loaders/zod-csp-loader.js'),
      })
    }
    if (process.env.FAST_BUILD === 'true') {
      config.optimization.minimize = false
    }

    // SOTA 2026: Use Esbuild for minification to fix Zod v4 mangling in Next.js 12
    if (!dev && !isServer) {
      const { EsbuildPlugin } = require('esbuild-loader')
      config.optimization.minimizer = [
        new EsbuildPlugin({
          target: 'esnext',
          keepNames: true, // Prevent Zod/Valtio property mangling
          // Worker child compilations do not inherit minimizer detection. Keep
          // their minification explicit rather than dependent on invocation.
          minify: true,
          css: true, // SOTA: Minify CSS with Esbuild
        }),
      ]
    }

    // AMO gate: addons-linter refuses to parse any single file above 5 MB
    // (MAX_FILE_SIZE_TO_PARSE_MB = 5 in mozilla/addons-linter src/const.js),
    // which is a hard submission blocker for the ~8.3 MB `_app` chunk. Keep
    // every emitted client chunk comfortably below that ceiling. Scoped to the
    // static extension export so dev/docker/web builds are untouched.
    if (!dev && !isServer && IS_EXPORT) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...(config.optimization.splitChunks || {}),
          maxSize: 3500000,
          maxAsyncSize: 3500000,
          maxInitialSize: 3500000,
        },
      }
    }

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    return config
  },
  ...(IS_DOCKER && {
    output: 'standalone',
    experimental: {
      outputFileTracingRoot: path.join(__dirname, '../../'),
    },
  }),
}

if (!IS_EXPORT) {
  config.i18n = {
    locales: ['en-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP'],
    defaultLocale: 'en-US',
  }
} else {
  config.images = {
    unoptimized: true,
  }
}

const base = withPWA(withTM(withBundleAnalyzer(config)))

const dev = base
const docker = base

// Only enable Sentry if not skipped
const shouldEnableSentry = !IS_EXPORT && process.env.SKIP_SENTRY !== 'true'
const prod = shouldEnableSentry
  ? withSentryConfig(
      base,
      // Make sure adding Sentry options is the last code to run before exporting, to
      // ensure that your source maps include changes from all other Webpack plugins
      sentryWebpackPluginOptions,
    )
  : base

module.exports = IS_DEV ? dev : IS_DOCKER ? docker : prod
