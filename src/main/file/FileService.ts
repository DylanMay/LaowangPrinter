import { COPY } from '@shared/copy'
import type { OpenSvgResult } from '@shared/types/svg'
import { parseSvg } from '@shared/svg/SvgParser'
import { basename, extname } from 'node:path'
import { readFile, stat } from 'node:fs/promises'

export const MAX_SVG_BYTES = 5 * 1024 * 1024

type FileStat = { size: number }

export type FileServiceDeps = {
  openDialog: () => Promise<string | null>
  readFile?: (filePath: string) => Promise<string>
  stat?: (filePath: string) => Promise<FileStat>
}

export class FileService {
  constructor(private readonly deps: FileServiceDeps) {}

  async openSvg(): Promise<OpenSvgResult | null> {
    const filePath = await this.deps.openDialog()
    if (!filePath) return null
    return this.importSvg(filePath)
  }

  async importSvg(filePath: string): Promise<OpenSvgResult> {
    if (typeof filePath !== 'string' || extname(filePath).toLowerCase() !== '.svg') {
      throw new Error(COPY.importInvalid)
    }
    let info: FileStat
    try {
      info = await (this.deps.stat ?? defaultStat)(filePath)
    } catch {
      throw new Error(COPY.importFailed)
    }
    if (info.size > MAX_SVG_BYTES) {
      throw new Error(COPY.importTooLarge)
    }
    let text: string
    try {
      text = await (this.deps.readFile ?? defaultRead)(filePath)
    } catch {
      throw new Error(COPY.importFailed)
    }
    let document
    try {
      document = parseSvg(text)
    } catch {
      throw new Error(COPY.importInvalid)
    }
    if (document.paths.length === 0) {
      throw new Error(COPY.importEmpty)
    }
    return {
      fileName: basename(filePath),
      document,
    }
  }
}

async function defaultRead(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8')
}

async function defaultStat(filePath: string): Promise<FileStat> {
  return stat(filePath)
}
