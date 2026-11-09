#!/usr/bin/env node
import { runGrow } from './growCommand.ts'

const command = process.argv[2]

if (command === 'grow') {
  runGrow(process.argv.slice(3))
    .then((filePath) => {
      console.log(filePath)
    })
    .catch((error: Error) => {
      console.error(`[grass-harness] ${error.message}`)
      process.exit(1)
    })
} else {
  const { runChat } = await import('./chat.ts')
  runChat().catch((error: Error) => {
    console.error(`[grass-harness] ${error.message}`)
    process.exit(1)
  })
}
