export type Point = {
  x: number
  y: number
}

export type Path = {
  points: Point[]
}

export type SvgDocument = {
  widthMm: number
  heightMm: number
  paths: Path[]
}

export type OpenSvgResult = {
  fileName: string
  document: SvgDocument
}
