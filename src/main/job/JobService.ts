import { checkJobSafety } from '@shared/job/SafetyChecker'
import type { JobEventName, JobProgress, JobStartOptions } from '@shared/types/job'
import type { DeviceService } from '../device/DeviceService'
import { GrblSender, prepareLines } from '../grbl/GrblSender'

type JobListener = (event: JobEventName, progress: JobProgress) => void

export class JobService {
  private readonly sender: GrblSender
  private readonly listeners = new Set<JobListener>()

  constructor(private readonly device: DeviceService) {
    this.sender = new GrblSender(device.getController(), device.getSerial())
    this.sender.on('progress', (progress) => this.emit('job:progress', progress))
    this.sender.on('paused', (progress) => this.emit('job:paused', progress))
    this.sender.on('completed', (progress) => this.emit('job:completed', progress))
    this.sender.on('error', (progress) => this.emit('job:error', progress))
  }

  on(listener: JobListener): void {
    this.listeners.add(listener)
  }

  getProgress(): JobProgress {
    return this.sender.getProgress()
  }

  async start(options: JobStartOptions): Promise<JobProgress> {
    const status = this.device.getStatus()
    const lines = prepareLines(options.lines ?? [], Boolean(options.dryRun))
    const safety = checkJobSafety({
      connected: status.state === 'connected',
      alarm: status.machineState === 'alarm',
      inBounds: true,
      hasLines: lines.length > 0,
    })
    if (!safety.ok) {
      throw new Error(safety.message)
    }
    await this.sender.start({
      ...options,
      lines,
      dryRun: Boolean(options.dryRun),
    })
    return this.sender.getProgress()
  }

  pause(): Promise<void> {
    return this.sender.pause()
  }

  resume(): Promise<void> {
    return this.sender.resume()
  }

  stop(): Promise<void> {
    return this.sender.stop()
  }

  private emit(event: JobEventName, progress: JobProgress): void {
    this.listeners.forEach((listener) => listener(event, progress))
  }
}
