import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as path from 'path'
import * as exec from '@actions/exec'
import {Architecture, Platform} from '../utils/platforms'
import {validateChecksum} from './checksum/checksum'
import {OWNER, REPO, TOOL_CACHE_NAME} from '../utils/utils'

export async function downloadLatest(
  platform: Platform,
  arch: Architecture,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<{cachedToolDir: string; version: string}> {
  const binary = `uv-${arch}-${platform}`
  let downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${binary}`
  if (platform === 'pc-windows-msvc') {
    downloadUrl += '.zip'
  } else {
    downloadUrl += '.tar.gz'
  }
  core.info(`Downloading uv from "${downloadUrl}" ...`)

  const downloadDir = `${process.cwd()}${path.sep}uv`
  const downloadPath = await tc.downloadTool(
    downloadUrl,
    downloadDir,
    githubToken
  )
  let uvExecutablePath: string
  let extracted: string
  if (platform === 'pc-windows-msvc') {
    extracted = await tc.extractZip(downloadPath)
    uvExecutablePath = path.join(extracted, 'uv.exe')
  } else {
    extracted = await tc.extractTar(downloadPath)
    uvExecutablePath = path.join(extracted, 'uv')
  }
  const version = await getVersion(uvExecutablePath)
  await validateChecksum(checkSum, downloadPath, arch, platform, version)
  const cachedToolDir = await tc.cacheDir(
    downloadPath,
    TOOL_CACHE_NAME,
    version,
    arch
  )

  return {cachedToolDir, version}
}

async function getVersion(uvExecutablePath: string): Promise<string> {
  // Parse the output of `uv --version` to get the version
  // The output looks like
  // uv 0.3.1 (be17d132a 2024-08-21)

  const options: exec.ExecOptions = {
    silent: !core.isDebug()
  }
  const execArgs = ['--version']

  let output = ''
  options.listeners = {
    stdout: (data: Buffer) => {
      output += data.toString()
    }
  }
  await exec.exec(uvExecutablePath, execArgs, options)
  const parts = output.split(' ')
  return parts[1]
}
