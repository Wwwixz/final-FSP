import { rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
for (const [folder, file] of [['build', 'krasnopars-chrome.zip'], ['build-firefox', 'krasnopars-firefox.xpi']]) {
  await rm(`extension/${file}`, { force: true })
  execFileSync('zip', ['-qr', `../${file}`, '.'], { cwd: `extension/${folder}` })
}
