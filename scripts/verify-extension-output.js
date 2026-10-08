const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const MAX_PARSED_ASSET_BYTES = 5 * 1024 * 1024

function validateParsedAsset(name, bytes) {
  if (/\.(?:js|json|html|css)$/i.test(name)) {
    assert(
      bytes.length <= MAX_PARSED_ASSET_BYTES,
      `${name} exceeds Mozilla's 5 MiB parser limit (${bytes.length} bytes)`,
    )
  }
  if (/\.css$/i.test(name)) {
    assert(
      !/fonts\.(?:googleapis|gstatic)\.com/i.test(bytes.toString('utf8')),
      `${name} still references remote UI fonts`,
    )
  }
  if (/\.js$/i.test(name)) {
    assert(
      !/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Function\s*;[\s\S]{0,600}?\bnew\s+\1\s*\(/.test(
        bytes.toString('utf8'),
      ),
      `${name} contains an aliased dynamic Function constructor`,
    )
  }
  if (/\.html$/i.test(name)) {
    assert(
      !/googletagmanager\.com/i.test(bytes.toString('utf8')),
      `${name} contains analytics in an extension export`,
    )
  }
}

function verifyExtensionOutput(directory, expectedVersion) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'),
  )
  assert.equal(
    manifest.version,
    expectedVersion,
    'Manifest/package versions differ',
  )
  const consent =
    manifest.browser_specific_settings?.gecko?.data_collection_permissions
  if (consent) {
    assert.deepEqual(
      consent.required,
      ['none'],
      'Transmission must remain optional',
    )
    for (const type of [
      'authenticationInfo',
      'personalCommunications',
      'websiteContent',
      'technicalAndInteraction',
    ]) {
      assert(
        consent.optional?.includes(type),
        `Missing optional data category: ${type}`,
      )
    }
  }
  const visit = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) visit(file)
      else {
        assert(
          !/\.epub$/i.test(entry.name),
          'Personal EPUBs must not be packaged',
        )
        if (/\.(?:js|json|html|css)$/i.test(entry.name)) {
          validateParsedAsset(
            path.relative(directory, file),
            fs.readFileSync(file),
          )
        }
      }
    }
  }
  visit(directory)
  for (const name of [
    'inter-cyrillic-ext',
    'inter-cyrillic',
    'inter-greek-ext',
    'inter-greek',
    'inter-vietnamese',
    'inter-latin-ext',
    'inter-latin',
    'material-symbols-outlined',
  ]) {
    const bytes = fs.readFileSync(
      path.join(directory, 'fonts', `${name}.woff2`),
    )
    assert.equal(
      bytes.subarray(0, 4).toString('ascii'),
      'wOF2',
      `Invalid font: ${name}`,
    )
  }
  for (const name of ['Inter-OFL.txt', 'Material-Symbols-LICENSE.txt']) {
    assert(
      fs.statSync(path.join(directory, 'fonts', name)).size > 1000,
      `Missing font license: ${name}`,
    )
  }
  console.log('Extension release output checks passed.')
}

module.exports = {
  MAX_PARSED_ASSET_BYTES,
  validateParsedAsset,
  verifyExtensionOutput,
}
