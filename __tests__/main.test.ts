import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

test('kops', () => {
  const options: cp.ExecSyncOptions = {
    env: {
      ...process.env,
      RUNNER_TEMP: path.join('..', 'build', 'kops').toString(),
    },
  }
  console.log(cp.execSync(`node ${path.join(__dirname, '..', 'kops', 'index.js')}`, options).toString())
})
