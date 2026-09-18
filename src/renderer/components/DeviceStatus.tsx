import { COPY } from '@shared/copy'
import { useAppStore } from '../store/appStore'

const STATUS_COPY = {
  disconnected: COPY.deviceDisconnected,
  detecting: COPY.deviceDetecting,
  connecting: COPY.deviceDetecting,
  connected: COPY.deviceConnected,
  error: COPY.deviceUnplugged,
} as const

export function DeviceStatus() {
  const deviceState = useAppStore((state) => state.deviceState)
  const notice = useAppStore((state) => state.notice)
  const connected = deviceState === 'connected'
  const detecting = deviceState === 'detecting' || deviceState === 'connecting'
  const errored = deviceState === 'error'
  const label =
    errored && notice ? notice.split('。')[0] || STATUS_COPY.error : STATUS_COPY[deviceState]

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
