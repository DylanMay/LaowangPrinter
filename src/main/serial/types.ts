export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 250000] as const
export type BaudRate = (typeof BAUD_RATES)[number]
export const DEFAULT_BAUD_RATE: BaudRate = 115200

export type SerialPortInfo = {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
}

export type SerialPortLike = {
  readonly path: string
  readonly isOpen: boolean
  open(): Promise<void>
  close(): Promise<void>
  write(data: string | Buffer): Promise<void>
  onData(handler: (chunk: Buffer) => void): void
  onError(handler: (error: Error) => void): void
  onClose(handler: () => void): void
}

export type SerialBackend = {
  list(): Promise<SerialPortInfo[]>
  open(path: string, baudRate: BaudRate): Promise<SerialPortLike>
}
