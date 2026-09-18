import { COPY } from '@shared/copy'
import { useAppStore } from '../store/appStore'

export function DeviceStatus() {
  const deviceState = useAppStore((state) => state.deviceState)
  const notice = useAppStore((state) => state.notice)
  const machineState = useAppStore((state) => state.machineState)
  const activity = useAppStore((state) => state.activity)
  const connected = deviceState === 'connected'
  const detecting = deviceState === 'detecting' || deviceState === 'connecting'
  const errored = deviceState === 'error'
  const label = statusLabel(deviceState, machineState, activity, notice)

  return (
    <div
      className={[
        'inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px]',
        connected ? 'bg-brand-soft text-brand' : errored ? 'bg-[#f8e8e5] text-[#c4473a]' : 'bg-paper text-muted',
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          connected ? 'bg-[#2c9b6a]' : detecting ? 'animate-pulse bg-[#c4842a]' : errored ? 'bg-[#c4473a]' : 'bg-[#b0a89e]',
        ].join(' ')}
      />
      {label}
    </div>
  )
}

function statusLabel(
  deviceState: 'disconnected' | 'detecting' | 'connecting' | 'connected' | 'error',
  machineState: string,
  activity: string | undefined,
  notice: string | null,
): string {
  if (activity === 'homing' || machineState === 'homing') return COPY.findingOrigin
  if (activity === 'resetting') return COPY.resetting
  if (activity === 'testing') return COPY.testingMove
  if (machineState === 'paused') return COPY.paused
  if (deviceState === 'error' && notice) return notice.split('。')[0] || COPY.deviceUnplugged
  if (deviceState === 'disconnected') return COPY.deviceDisconnected
  if (deviceState === 'detecting' || deviceState === 'connecting') return COPY.deviceDetecting
  if (deviceState === 'connected') return COPY.deviceConnected
  return COPY.deviceUnplugged
}
