import { readFile, writeFile, cp, rm } from 'node:fs/promises'
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'))
const chrome = structuredClone(manifest)
delete chrome.browser_specific_settings
await writeFile('extension/build/manifest.json', JSON.stringify(chrome, null, 2))
await rm('extension/build-firefox', { recursive: true, force: true })
await cp('extension/build', 'extension/build-firefox', { recursive: true })
const firefox = structuredClone(manifest)
firefox.background = { scripts: ['background.js'] }
await writeFile('extension/build-firefox/manifest.json', JSON.stringify(firefox, null, 2))
